const express = require('express');
const router = express.Router();
const { all } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const banners = [1, 2, 3, 4, 5].map((i) => `/images/banners/banner${i}.jpg`);
  const [bestSellers, newProducts, featuredNews] = await Promise.all([
    all('SELECT * FROM products ORDER BY is_hot DESC, sort_order ASC LIMIT 6'),
    all('SELECT * FROM products WHERE is_new = 1 ORDER BY sort_order ASC LIMIT 6'),
    all('SELECT * FROM news WHERE is_featured = 1 ORDER BY created_at DESC LIMIT 3')
  ]);

  res.render('home', { banners, bestSellers, newProducts, featuredNews });
}));

module.exports = router;
