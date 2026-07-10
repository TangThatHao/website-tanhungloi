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
    all('SELECT * FROM products WHERE is_hot = 1 ORDER BY hot_order ASC LIMIT 3'),
    all('SELECT * FROM news ORDER BY created_at DESC LIMIT 3'),
    all('SELECT * FROM products WHERE is_export = 1 ORDER BY export_order ASC LIMIT 5')
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

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

function loginRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (entry && now - entry.firstAttempt < LOGIN_WINDOW_MS) {
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      return res.status(429).render('admin/login', {
        error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.'
      });
    }
    entry.count++;
  } else {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  }
  next();
}

function clearLoginAttempts(req) {
  loginAttempts.delete(req.ip);
}

module.exports = { loadUser, requireMember, requireAdmin, loginRateLimit, clearLoginAttempts };
