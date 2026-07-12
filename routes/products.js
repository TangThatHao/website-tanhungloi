const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

const LABELS = {
  hot: { name: 'Sản phẩm bán chạy', column: 'is_hot', order: 'hot_order' },
  new: { name: 'Sản phẩm mới', column: 'is_new', order: 'new_order' }
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

router.get('/san-pham/:slug', asyncHandler(async (req, res) => {
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
