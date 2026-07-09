const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/san-pham', asyncHandler(async (req, res) => {
  const { category, search } = req.query;
  let products;
  let categoryName = null;

  if (category) {
    const cat = await get('SELECT * FROM categories WHERE slug = ?', [category]);
    if (cat) {
      categoryName = cat.name;
      products = await all('SELECT * FROM products WHERE category_id = ? ORDER BY id DESC', [cat.id]);
    } else {
      products = [];
    }
  } else if (search) {
    products = await all('SELECT * FROM products WHERE name LIKE ? ORDER BY id DESC', [`%${search}%`]);
  } else {
    products = await all('SELECT * FROM products ORDER BY id DESC');
  }

  res.render('products-list', {
    products,
    categoryName,
    activeCategory: category || null,
    searchQuery: search || ''
  });
}));

router.get('/san-pham/:slug', asyncHandler(async (req, res) => {
  const product = await get('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
  if (!product) return res.status(404).send('Không tìm thấy sản phẩm.');

  const related = await all(
    'SELECT * FROM products WHERE category_id = ? AND id != ? ORDER BY RANDOM() LIMIT 4',
    [product.category_id, product.id]
  );

  res.render('product-detail', { product, related, successMsg: req.query.added ? 'Đã thêm sản phẩm vào giỏ hàng.' : null });
}));

module.exports = router;
