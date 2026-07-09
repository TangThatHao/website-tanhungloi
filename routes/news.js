const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/tin-tuc', asyncHandler(async (req, res) => {
  const newsItems = await all('SELECT * FROM news ORDER BY created_at DESC');
  res.render('news-list', { newsItems });
}));

router.get('/tin-tuc/:slug', asyncHandler(async (req, res) => {
  const news = await get('SELECT * FROM news WHERE slug = ?', [req.params.slug]);
  if (!news) return res.status(404).send('Không tìm thấy bài viết.');
  res.render('news-detail', { news });
}));

module.exports = router;
