const { get, all } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { createRateLimiter } = require('../utils/rateLimit');

const loadUser = asyncHandler(async (req, res, next) => {
  res.locals.currentUser = null;
  if (req.session.userId) {
    const user = await get('SELECT id, full_name, email, phone, username, role, is_shared_guest FROM users WHERE id = ?', [req.session.userId]);
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

// Giống requireMember, nhưng chặn luôn tài khoản "đặt nhanh dùng chung" vì
// mật khẩu của nó vốn công khai - nếu cho vào /tai-khoan, ai cũng đăng nhập
// được và thấy đơn hàng (tên/SĐT/địa chỉ) của mọi khách dùng chung tài khoản
// đó. Khách dùng tài khoản chung nên tra cứu đơn qua /tra-cuu-don-hang.
function requirePersonalMember(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/dang-nhap?next=' + encodeURIComponent(req.originalUrl));
  }
  if (res.locals.currentUser && res.locals.currentUser.is_shared_guest) {
    return res.redirect('/tra-cuu-don-hang?tk=chung');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.redirect('/admin/dang-nhap');
  }
  next();
}

const adminLoginLimiter = createRateLimiter({
  onLimited: (req, res) =>
    res.status(429).render('admin/login', { error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' })
});
const loginRateLimit = adminLoginLimiter.middleware;
const clearLoginAttempts = (req) => adminLoginLimiter.clear(req);

const memberLoginLimiter = createRateLimiter({
  onLimited: (req, res) =>
    res.status(429).render('login', {
      error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      next: (req.body && req.body.next) || '/'
    })
});
const memberLoginRateLimit = memberLoginLimiter.middleware;
const clearMemberLoginAttempts = (req) => memberLoginLimiter.clear(req);

const forgotPasswordLimiter = createRateLimiter({
  max: 3,
  onLimited: (req, res) =>
    res.status(429).render('admin/forgot-password', {
      error: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      success: null
    })
});
const forgotPasswordRateLimit = forgotPasswordLimiter.middleware;

const orderLookupLimiter = createRateLimiter({
  max: 10,
  onLimited: (req, res) =>
    res.status(429).render('order-lookup', {
      phone: (req.body && req.body.phone) || '',
      orders: null,
      error: 'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau ít phút.'
    })
});
const orderLookupRateLimit = orderLookupLimiter.middleware;

module.exports = {
  loadUser,
  requireMember,
  requirePersonalMember,
  requireAdmin,
  loginRateLimit,
  clearLoginAttempts,
  memberLoginRateLimit,
  clearMemberLoginAttempts,
  orderLookupRateLimit,
  forgotPasswordRateLimit
};
