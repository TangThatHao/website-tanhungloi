const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { run, get, all } = require('../db');
const { requireAdmin, loginRateLimit, clearLoginAttempts, forgotPasswordRateLimit } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { saveUploadedFile } = require('../utils/storage');
const { sendAdminPasswordReset } = require('../utils/notify');
const { createResetToken, clearResetToken } = require('../utils/passwordReset');
const { slugify } = require('../utils/format');
const { asyncHandler } = require('../utils/asyncHandler');
const { moveItem } = require('../utils/reorder');
const { LABELS, syncLabelOrder, addToLabel, removeFromLabel, moveLabelItem, labelProducts } = require('../utils/labels');

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
  // Cookie phiên (không có Expires/Max-Age) -> trình duyệt tự xóa khi đóng,
  // admin phải đăng nhập lại ở lần mở trình duyệt tiếp theo.
  req.session.cookie.expires = false;
  // Vừa đăng nhập bằng mật khẩu tạm (gửi qua "quên mật khẩu") -> đưa thẳng
  // tới trang đổi mật khẩu, có thể bỏ qua nếu muốn giữ mật khẩu ngẫu nhiên.
  res.redirect(user.password_reset_pending ? '/admin/doi-mat-khau' : '/admin');
}));

router.get('/admin/dang-xuat', (req, res) => {
  req.session.adminId = null;
  req.session.userId = null;
  res.redirect('/admin/dang-nhap');
});

// ---------- Quên mật khẩu (gửi mật khẩu mới qua email, không cần đăng nhập) ----------
router.get('/admin/quen-mat-khau', (req, res) => {
  res.render('admin/forgot-password', { error: null, success: null });
});

router.post('/admin/quen-mat-khau', forgotPasswordRateLimit, asyncHandler(async (req, res) => {
  const admin = await get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    return res.render('admin/forgot-password', { error: 'Không tìm thấy tài khoản admin.', success: null });
  }

  const token = await createResetToken(admin.id);
  const resetLink = `${req.protocol}://${req.get('host')}/dat-lai-mat-khau/${token}`;

  // Gửi email trước, chỉ lưu token nếu gửi thành công không phụ thuộc gì
  // thêm - nhưng vẫn dọn token nếu gửi lỗi để không để lại token treo.
  const sent = await sendAdminPasswordReset(resetLink);
  if (!sent) {
    await clearResetToken(admin.id);
    return res.render('admin/forgot-password', {
      error: 'Chưa cấu hình gửi email trên server, không thể gửi liên kết đặt lại mật khẩu. Vui lòng liên hệ kỹ thuật.',
      success: null
    });
  }

  res.render('admin/forgot-password', {
    error: null,
    success: 'Liên kết đặt lại mật khẩu đã được gửi tới email khôi phục.'
  });
}));

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

  if (req.body.is_hot) await syncLabelOrder(inserted.id, 'hot');
  if (req.body.is_new) await syncLabelOrder(inserted.id, 'new');
  if (req.body.is_export) await syncLabelOrder(inserted.id, 'export');

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
  const image = coverFile ? await saveUploadedFile(coverFile) : (image_url || product.image);

  await run(
    `UPDATE products SET category_id=?, name=?, price=?, image=?, description=?, is_hot=?, is_new=?, is_export=? WHERE id=?`,
    [category_id, name, price ? Number(price) : null, image, description || '', req.body.is_hot ? 1 : 0, req.body.is_new ? 1 : 0, req.body.is_export ? 1 : 0, req.params.id]
  );

  if (req.body.is_hot) await syncLabelOrder(req.params.id, 'hot');
  if (req.body.is_new) await syncLabelOrder(req.params.id, 'new');
  if (req.body.is_export) await syncLabelOrder(req.params.id, 'export');

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

// ---------- Nhãn sản phẩm (HOT / mới / xuất khẩu) ----------
router.get('/admin/nhan', asyncHandler(async (req, res) => {
  const [hotList, newList, exportList, allProducts] = await Promise.all([
    labelProducts('hot'),
    labelProducts('new'),
    labelProducts('export'),
    all('SELECT id, name FROM products ORDER BY name ASC')
  ]);
  res.render('admin/labels', { labels: LABELS, hotList, newList, exportList, allProducts });
}));

router.post('/admin/nhan/:type/them', asyncHandler(async (req, res) => {
  if (LABELS[req.params.type] && req.body.product_id) {
    await addToLabel(req.params.type, req.body.product_id);
  }
  res.redirect('/admin/nhan');
}));

router.post('/admin/nhan/:type/:id/xoa', asyncHandler(async (req, res) => {
  if (LABELS[req.params.type]) await removeFromLabel(req.params.type, req.params.id);
  res.redirect('/admin/nhan');
}));

router.post('/admin/nhan/:type/:id/len', asyncHandler(async (req, res) => {
  if (LABELS[req.params.type]) await moveLabelItem(req.params.type, req.params.id, 'up');
  res.redirect('/admin/nhan');
}));

router.post('/admin/nhan/:type/:id/xuong', asyncHandler(async (req, res) => {
  if (LABELS[req.params.type]) await moveLabelItem(req.params.type, req.params.id, 'down');
  res.redirect('/admin/nhan');
}));

// ---------- Categories ----------
router.get('/admin/danh-muc', asyncHandler(async (req, res) => {
  const categories = await categoriesWithCounts();
  res.render('admin/categories', { categories, error: null });
}));

router.post('/admin/danh-muc/them', upload.single('image_file'), asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect('/admin/danh-muc');
  const slug = await uniqueSlug(name, 'categories');
  const maxOrder = Number((await get('SELECT COALESCE(MAX(sort_order),0) m FROM categories')).m);
  const image = req.file ? await saveUploadedFile(req.file) : null;
  await run('INSERT INTO categories (name, slug, sort_order, image) VALUES (?, ?, ?, ?)', [name, slug, maxOrder + 1, image]);
  res.redirect('/admin/danh-muc');
}));

router.post('/admin/danh-muc/:id/anh', upload.single('image_file'), asyncHandler(async (req, res) => {
  if (req.file) {
    const image = await saveUploadedFile(req.file);
    await run('UPDATE categories SET image = ? WHERE id = ?', [image, req.params.id]);
  }
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

router.get('/admin/bao-cao-doanh-thu', asyncHandler(async (req, res) => {
  const { tu_ngay, den_ngay, khach } = req.query;
  const conditions = ["status != 'huy'"];
  const params = [];
  if (tu_ngay) { conditions.push('created_at >= ?'); params.push(tu_ngay); }
  if (den_ngay) { conditions.push("created_at < (?::date + interval '1 day')"); params.push(den_ngay); }
  if (khach) { conditions.push('(phone ILIKE ? OR customer_name ILIKE ?)'); params.push(`%${khach}%`, `%${khach}%`); }
  const where = 'WHERE ' + conditions.join(' AND ');

  const orders = await all(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);
  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

  res.render('admin/revenue', {
    orders,
    revenue,
    orderCount: orders.length,
    filters: { tu_ngay: tu_ngay || '', den_ngay: den_ngay || '', khach: khach || '' }
  });
}));

// ---------- Đổi mật khẩu ----------
router.get('/admin/doi-mat-khau', asyncHandler(async (req, res) => {
  const user = await get('SELECT password_reset_pending FROM users WHERE id = ?', [req.session.adminId]);
  res.render('admin/change-password', { error: null, success: null, pending: !!user.password_reset_pending });
}));

router.post('/admin/doi-mat-khau', asyncHandler(async (req, res) => {
  const { mat_khau_cu, mat_khau_moi, mat_khau_moi_lai } = req.body;
  const user = await get('SELECT * FROM users WHERE id = ?', [req.session.adminId]);
  const pending = !!user.password_reset_pending;

  if (!bcrypt.compareSync(mat_khau_cu || '', user.password_hash)) {
    return res.render('admin/change-password', { error: 'Mật khẩu hiện tại không đúng.', success: null, pending });
  }
  if (!mat_khau_moi || mat_khau_moi.length < 6) {
    return res.render('admin/change-password', { error: 'Mật khẩu mới phải có ít nhất 6 ký tự.', success: null, pending });
  }
  if (mat_khau_moi !== mat_khau_moi_lai) {
    return res.render('admin/change-password', { error: 'Xác nhận mật khẩu mới không khớp.', success: null, pending });
  }

  const newHash = bcrypt.hashSync(mat_khau_moi, 10);
  await run('UPDATE users SET password_hash = ?, password_reset_pending = 0 WHERE id = ?', [newHash, req.session.adminId]);
  res.render('admin/change-password', { error: null, success: 'Đã đổi mật khẩu thành công.', pending: false });
}));

router.post('/admin/doi-mat-khau/bo-qua', asyncHandler(async (req, res) => {
  await run('UPDATE users SET password_reset_pending = 0 WHERE id = ?', [req.session.adminId]);
  res.redirect('/admin');
}));

// ---------- Contacts ----------
router.get('/admin/lien-he', asyncHandler(async (req, res) => {
  const contacts = await all('SELECT * FROM contacts ORDER BY created_at DESC');
  res.render('admin/contacts', { contacts });
}));

module.exports = router;
