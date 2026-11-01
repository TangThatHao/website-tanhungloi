const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

const LABELS = {
  hot: { name: 'Sản phẩm bán chạy', column: 'is_hot', order: 'hot_order' },
  new: { name: 'Sản phẩm mới', column: 'is_new', order: 'new_order' },
  export: { name: 'Sản phẩm xuất khẩu', column: 'is_export', order: 'export_order' }
};

router.get('/san-pham', asyncHandler(async (req, res) => {
  const { category, search, label } = req.query;
  let products;
  let categoryName = null;

  if (category) {
    const cat = await get('SELECT * FROM categories WHERE slug = ?', [category]);
    if (cat) {
      categoryName = cat.name;
      products = await all('SELECT * FROM products WHERE category_id = ? ORDER BY sort_order ASC', [cat.id]);
    } else {
      products = [];
    }
  } else if (search) {
    products = await all('SELECT * FROM products WHERE name LIKE ? ORDER BY sort_order ASC', [`%${search}%`]);
  } else if (label && LABELS[label]) {
    const { name, column, order } = LABELS[label];
    categoryName = name;
    products = await all(`SELECT * FROM products WHERE ${column} = 1 ORDER BY ${order} ASC`);
  } else {
    products = await all('SELECT * FROM products ORDER BY sort_order ASC');
  }

  if (req.get('X-Requested-With') === 'fetch') {
    return res.render('partials/product-results', {
      products,
      categoryName,
      searchQuery: search || ''
    });
  }

  res.render('products-list', {
    products,
    categoryName,
    activeCategory: category || null,
    searchQuery: search || ''
  });
}));

// Danh sách sản phẩm + đơn giá dạng JSON cho app bán hàng trên điện thoại
// (Phan mem ban hang). Chỉ trả các cột vốn đã hiện công khai trên trang
// sản phẩm. Cho phép gọi từ domain khác (CORS) vì app có thể chạy ở nơi khác.
router.get('/api/san-pham', asyncHandler(async (req, res) => {
  const products = await all(
    `SELECT p.id, p.name, p.slug, p.price, p.image, c.name AS category
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order ASC, p.sort_order ASC`
  );
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'no-store');
  res.json({ updatedAt: new Date().toISOString(), products });
}));

router.get('/san-pham/:slug',asyncHandler(async (req, res) => {
  const product = await get('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
  if (!product) return res.status(404).send('Không tìm thấy sản phẩm.');

  const [related, extraImages] = await Promise.all([
    all('SELECT * FROM products WHERE category_id = ? AND id != ? ORDER BY RANDOM() LIMIT 4', [product.category_id, product.id]),
    all('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [product.id])
  ]);

  const gallery = [product.image, ...extraImages.map((img) => img.image)].filter(Boolean);

  res.render('product-detail', { product, related, gallery, successMsg: req.query.added ? 'Đã thêm sản phẩm vào giỏ hàng.' : null });
}));

module.exports = router;
