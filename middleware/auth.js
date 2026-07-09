const { get, all } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

const loadUser = asyncHandler(async (req, res, next) => {
  res.locals.currentUser = null;
  if (req.session.userId) {
    const user = await get('SELECT id, full_name, email, phone, username, role FROM users WHERE id = ?', [req.session.userId]);
    if (user) res.locals.currentUser = user;
  }
  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const [navCategories, sidebarHotProducts, sidebarNews, sidebarExportProducts] = await Promise.all([
    all('SELECT * FROM categories ORDER BY sort_order ASC'),
    all('SELECT * FROM products WHERE is_hot = 1 ORDER BY id DESC LIMIT 3'),
    all('SELECT * FROM news ORDER BY created_at DESC LIMIT 3'),
    all('SELECT * FROM products WHERE is_export = 1 ORDER BY id DESC LIMIT 5')
  ]);
  res.locals.navCategories = navCategories;
  res.locals.sidebarHotProducts = sidebarHotProducts;
  res.locals.sidebarNews = sidebarNews;
  res.locals.sidebarExportProducts = sidebarExportProducts;
  next();
});

function requireMember(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/dang-nhap?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.redirect('/admin/dang-nhap');
  }
  next();
}

module.exports = { loadUser, requireMember, requireAdmin };
