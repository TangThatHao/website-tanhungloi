const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { run, get, all } = require('../db');
const { requireAdmin, loginRateLimit, clearLoginAttempts } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { saveUploadedFile } = require('../utils/storage');
const { slugify } = require('../utils/format');
const { asyncHandler } = require('../utils/asyncHandler');
const { moveItem } = require('../utils/reorder');

async function uniqueSlug(base, table) {
  const slug = slugify(base);
  let candidate = slug;
  let i = 1;
  while (await get(`SELECT id FROM ${table} WHERE slug = ?`, [candidate])) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}

async function categoriesWithCounts() {
  const categories = await all('SELECT * FROM categories ORDER BY sort_order ASC');
  return Promise.all(
    categories.map(async (c) => ({
      ...c,
      productCount: Number((await get('SELECT COUNT(*) c FROM products WHERE category_id = ?', [c.id])).c)
    }))
  );
}

// ---------- Admin auth ----------
router.get('/admin/dang-nhap', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/admin/dang-nhap', loginRateLimit, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await get("SELECT * FROM users WHERE username = ? AND role = 'admin'", [username]);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('admin/login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
  }
  clearLoginAttempts(req);
  req.session.adminId = user.id;
  req.session.userId = user.id;
  res.redirect('/admin');
}));

router.get('/admin/dang-xuat', (req, res) => {
  req.session.adminId = null;
  req.session.userId = null;
  res.redirect('/admin/dang-nhap');
});

router.use('/admin', requireAdmin);

// ---------- Dashboard ----------
router.get('/admin', asyncHandler(async (req, res) => {
  const [productCount, orderCount, revenue, memberCount, recentOrders] = await Promise.all([
    get('SELECT COUNT(*) c FROM products'),
    get('SELECT COUNT(*) c FROM orders'),
    get("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'huy'"),
    get("SELECT COUNT(*) c FROM users WHERE role = 'member'"),
    all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5')
  ]);
  const stats = {
    productCount: Number(productCount.c),
    orderCount: Number(orderCount.c),
    revenue: Number(revenue.s),
    memberCount: Number(memberCount.c)
  };
  res.render('admin/dashboard', { stats, recentOrders });
}));

// ---------- Products ----------
router.get('/admin/san-pham', asyncHandler(async (req, res) => {
  const categories = await all('SELECT * FROM categories ORDER BY sort_order ASC');
  const { category } = req.query;
  const activeCategory = category ? categories.find((c) => c.slug === category) : null;

  const products = await all(`
    SELECT p.*, c.name AS category_name FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${activeCategory ? 'WHERE p.category_id = ?' : ''}
    ORDER BY p.sort_order ASC
  `, activeCategory ? [activeCategory.id] : []);

  res.render('admin/products', { products, categories, activeCategory: activeCategory ? activeCategory.slug : '' });
}));

const productUpload = upload.fields([{ name: 'image_file', maxCount: 1 }, { name: 'gallery_files', maxCount: 10 }]);

async function addGalleryImages(productId, files) {
  if (!files || !files.length) return;
  const maxOrder = Number((await get('SELECT COALESCE(MAX(sort_order),0) m FROM product_images WHERE product_id = ?', [productId])).m);
  let i = 1;
  for (const file of files) {
    const url = await saveUploadedFile(file);
    await run('INSERT INTO product_images (product_id, image, sort_order) VALUES (?, ?, ?)', [productId, url, maxOrder + i]);
    i++;
  }
}

router.get('/admin/san-pham/them', asyncHandler(async (req, res) => {
  const categories = await all('SELECT * FROM categories ORDER BY sort_order ASC');
  res.render('admin/product-form', { product: null, categories, galleryImages: [], error: null });
}));

router.post('/admin/san-pham/them', productUpload, asyncHandler(async (req, res) => {
  const categories = await all('SELECT * FROM categories ORDER BY sort_order ASC');
  const { name, category_id, price, description, image_url } = req.body;

  if (!name || !category_id) {
    return res.render('admin/product-form', { product: null, categories, galleryImages: [], error: 'Vui lòng điền tên sản phẩm và chọn danh mục.' });
  }

  const coverFile = req.files && req.files.image_file ? req.files.image_file[0] : null;
  const image = coverFile ? await saveUploadedFile(coverFile) : (image_url || '/images/logo.jpg');
  const slug = await uniqueSlug(name, 'products');
  const maxOrder = Number((await get('SELECT COALESCE(MAX(sort_order),0) m FROM products')).m);

  const inserted = await get(
    `INSERT INTO products (category_id, name, slug, price, image, description, is_hot, is_new, is_export, stock, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [category_id, name, slug, price ? Number(price) : null, image, description || '', req.body.is_hot ? 1 : 0, req.body.is_new ? 1 : 0, req.body.is_export ? 1 : 0, 100, maxOrder + 1]
  );

  await addGalleryImages(inserted.id, req.files && req.files.gallery_files);

  res.redirect('/admin/san-pham');
}));

router.get('/admin/san-pham/:id/sua', asyncHandler(async (req, res) => {
  const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).send('Không tìm thấy sản phẩm.');
  const categories = await all('SELECT * FROM categories ORDER BY sort_order ASC');
  const galleryImages = await all('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [product.id]);
  res.render('admin/product-form', { product, categories, galleryImages, error: null });
}));

router.post('/admin/san-pham/:id/sua', productUpload, asyncHandler(async (req, res) => {
  const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).send('Không tìm thấy sản phẩm.');
  const categories = await all('SELECT * FROM categories ORDER BY sort_order ASC');
  const { name, category_id, price, description, image_url } = req.body;

  if (!name || !category_id) {
    const galleryImages = await all('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [product.id]);
    return res.render('admin/product-form', { product, categories, galleryImages, error: 'Vui lòng điền tên sản phẩm và chọn danh mục.' });
  }

  const coverFile = req.files && req.files.image_file ? req.files.image_file[0] : null;
  const image = coverFile
    ? await saveUploadedFile(coverFile)
    : image_url || (req.body.delete_image ? '/images/logo.jpg' : product.image);

  await run(
    `UPDATE products SET category_id=?, name=?, price=?, image=?, description=?, is_hot=?, is_new=?, is_export=? WHERE id=?`,
    [category_id, name, price ? Number(price) : null, image, description || '', req.body.is_hot ? 1 : 0, req.body.is_new ? 1 : 0, req.body.is_export ? 1 : 0, req.params.id]
  );

  const deleteIds = [].concat(req.body.delete_images || []);
  for (const imgId of deleteIds) {
    await run('DELETE FROM product_images WHERE id = ? AND product_id = ?', [imgId, req.params.id]);
  }

  await addGalleryImages(req.params.id, req.files && req.files.gallery_files);

  res.redirect('/admin/san-pham');
}));

router.post('/admin/san-pham/:id/xoa', asyncHandler(async (req, res) => {
  await run('DELETE FROM order_items WHERE product_id = ?', [req.params.id]);
  await run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.redirect('/admin/san-pham');
}));

router.post('/admin/san-pham/:id/len', asyncHandler(async (req, res) => {
  await moveItem('products', req.params.id, 'up');
  res.redirect(req.body.category ? `/admin/san-pham?category=${encodeURIComponent(req.body.category)}` : '/admin/san-pham');
}));

router.post('/admin/san-pham/:id/xuong', asyncHandler(async (req, res) => {
  await moveItem('products', req.params.id, 'down');
  res.redirect(req.body.category ? `/admin/san-pham?category=${encodeURIComponent(req.body.category)}` : '/admin/san-pham');
}));

// ---------- Categories ----------
router.get('/admin/danh-muc', asyncHandler(async (req, res) => {
  const categories = await categoriesWithCounts();
  res.render('admin/categories', { categories, error: null });
}));

router.post('/admin/danh-muc/them', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect('/admin/danh-muc');
  const slug = await uniqueSlug(name, 'categories');
  const maxOrder = Number((await get('SELECT COALESCE(MAX(sort_order),0) m FROM categories')).m);
  await run('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)', [name, slug, maxOrder + 1]);
  res.redirect('/admin/danh-muc');
}));

router.post('/admin/danh-muc/:id/xoa', asyncHandler(async (req, res) => {
  const productCount = Number((await get('SELECT COUNT(*) c FROM products WHERE category_id = ?', [req.params.id])).c);
  if (productCount > 0) {
    const categories = await categoriesWithCounts();
    return res.render('admin/categories', { categories, error: 'Không thể xóa danh mục đang có sản phẩm.' });
  }
  await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.redirect('/admin/danh-muc');
}));

router.post('/admin/danh-muc/:id/len', asyncHandler(async (req, res) => {
  await moveItem('categories', req.params.id, 'up');
  res.redirect('/admin/danh-muc');
}));

router.post('/admin/danh-muc/:id/xuong', asyncHandler(async (req, res) => {
  await moveItem('categories', req.params.id, 'down');
  res.redirect('/admin/danh-muc');
}));

// ---------- News ----------
router.get('/admin/tin-tuc', asyncHandler(async (req, res) => {
  const newsItems = await all('SELECT * FROM news ORDER BY created_at DESC');
  res.render('admin/news', { newsItems });
}));

router.get('/admin/tin-tuc/them', (req, res) => {
  res.render('admin/news-form', { news: null, error: null });
});

router.post('/admin/tin-tuc/them', upload.single('image_file'), asyncHandler(async (req, res) => {
  const { title, summary, content, image_url } = req.body;
  if (!title || !summary || !content) {
    return res.render('admin/news-form', { news: null, error: 'Vui lòng điền đầy đủ thông tin bài viết.' });
  }
  const thumbnail = req.file ? await saveUploadedFile(req.file) : (image_url || '/images/logo.jpg');
  const slug = await uniqueSlug(title, 'news');
  await run(
    'INSERT INTO news (title, slug, thumbnail, summary, content, is_featured) VALUES (?, ?, ?, ?, ?, ?)',
    [title, slug, thumbnail, summary, content, req.body.is_featured ? 1 : 0]
  );
  res.redirect('/admin/tin-tuc');
}));

router.get('/admin/tin-tuc/:id/sua', asyncHandler(async (req, res) => {
  const news = await get('SELECT * FROM news WHERE id = ?', [req.params.id]);
  if (!news) return res.status(404).send('Không tìm thấy bài viết.');
  res.render('admin/news-form', { news, error: null });
}));

router.post('/admin/tin-tuc/:id/sua', upload.single('image_file'), asyncHandler(async (req, res) => {
  const news = await get('SELECT * FROM news WHERE id = ?', [req.params.id]);
  if (!news) return res.status(404).send('Không tìm thấy bài viết.');
  const { title, summary, content, image_url } = req.body;
  if (!title || !summary || !content) {
    return res.render('admin/news-form', { news, error: 'Vui lòng điền đầy đủ thông tin bài viết.' });
  }
  const thumbnail = req.file ? await saveUploadedFile(req.file) : (image_url || news.thumbnail);
  await run(
    'UPDATE news SET title=?, thumbnail=?, summary=?, content=?, is_featured=? WHERE id=?',
    [title, thumbnail, summary, content, req.body.is_featured ? 1 : 0, req.params.id]
  );
  res.redirect('/admin/tin-tuc');
}));

router.post('/admin/tin-tuc/:id/xoa', asyncHandler(async (req, res) => {
  await run('DELETE FROM news WHERE id = ?', [req.params.id]);
  res.redirect('/admin/tin-tuc');
}));

// ---------- Orders ----------
router.get('/admin/don-hang', asyncHandler(async (req, res) => {
  const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
  res.render('admin/orders', { orders });
}));

router.get('/admin/don-hang/:id', asyncHandler(async (req, res) => {
  const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).send('Không tìm thấy đơn hàng.');
  const items = await all('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
  res.render('admin/order-detail', { order, items });
}));

router.post('/admin/don-hang/:id/trang-thai', asyncHandler(async (req, res) => {
  await run('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.redirect('/admin/don-hang/' + req.params.id);
}));

// ---------- Contacts ----------
router.get('/admin/lien-he', asyncHandler(async (req, res) => {
  const contacts = await all('SELECT * FROM contacts ORDER BY created_at DESC');
  res.render('admin/contacts', { contacts });
}));

module.exports = router;
