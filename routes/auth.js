const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { run, get, all } = require('../db');
const { requireMember, requirePersonalMember, memberLoginRateLimit, clearMemberLoginAttempts, memberForgotPasswordRateLimit } = require('../middleware/auth');
const { sendMemberPasswordReset, sendAdminPasswordReset } = require('../utils/notify');
const { asyncHandler } = require('../utils/asyncHandler');
const { createResetToken, getUserByResetToken, clearResetToken } = require('../utils/passwordReset');

router.get('/dang-nhap', (req, res) => {
  if (req.session.userId) return res.redirect('/tai-khoan');
  res.render('login', { error: null, next: req.query.next || '/' });
});

// Chỉ cho redirect nội bộ (bắt đầu bằng "/" nhưng không phải "//..." hay chứa
// "://") để tránh open-redirect qua tham số next.
function isSafeRedirect(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
}

router.post('/dang-nhap', memberLoginRateLimit, asyncHandler(async (req, res) => {
  const { username, password, next } = req.body;
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng.', next: next || '/' });
  }

  clearMemberLoginAttempts(req);
  req.session.userId = user.id;
  if (user.role === 'admin') {
    // Tài khoản admin cũng đăng nhập được qua form này (dùng chung với
    // khách hàng) - phải set luôn adminId, không thì bấm "Trang quản trị"
    // sau đó sẽ bị bắt đăng nhập lại vì requireAdmin chỉ kiểm tra adminId.
    req.session.adminId = user.id;
    req.session.cookie.expires = false;
  }
  // Vừa đăng nhập bằng mật khẩu tạm (gửi qua "quên mật khẩu") -> đưa thẳng
  // tới trang đổi mật khẩu, có thể bỏ qua nếu muốn giữ mật khẩu ngẫu nhiên.
  if (user.password_reset_pending) {
    return res.redirect(user.role === 'admin' ? '/admin/doi-mat-khau' : '/tai-khoan/doi-mat-khau');
  }
  res.redirect(user.role === 'admin' ? '/admin' : (isSafeRedirect(next) ? next : '/'));
}));

router.get('/quen-mat-khau', (req, res) => {
  res.render('forgot-password', { error: null, success: null });
});

router.post('/quen-mat-khau', memberForgotPasswordRateLimit, asyncHandler(async (req, res) => {
  const { tai_khoan } = req.body;
  const genericSuccess = 'Nếu tài khoản tồn tại, một liên kết đặt lại mật khẩu đã được gửi tới email đã đăng ký.';

  const user = await get(
    "SELECT * FROM users WHERE role IN ('member', 'admin') AND (username = ? OR email = ?)",
    [tai_khoan || '', tai_khoan || '']
  );

  // Không tiết lộ tài khoản có tồn tại hay không (tránh dò username/email),
  // và tài khoản dùng chung không có email cá nhân nên không đổi qua đây -
  // khách dùng chung tra cứu đơn qua /tra-cuu-don-hang thay vì đăng nhập.
  if (!user || user.is_shared_guest || (user.role === 'member' && !user.email)) {
    return res.render('forgot-password', { error: null, success: genericSuccess });
  }

  const token = await createResetToken(user.id);
  const resetLink = `${req.protocol}://${req.get('host')}/dat-lai-mat-khau/${token}`;
  // Admin không có email cá nhân riêng trong hệ thống này - gửi tới 2 email
  // khôi phục cố định thay vì user.email (giống /admin/quen-mat-khau).
  const sent =
    user.role === 'admin' ? await sendAdminPasswordReset(resetLink) : await sendMemberPasswordReset(user.email, resetLink);
  if (!sent) {
    await clearResetToken(user.id);
    return res.render('forgot-password', {
      error: 'Không thể gửi email lúc này, vui lòng thử lại sau.',
      success: null
    });
  }

  res.render('forgot-password', { error: null, success: genericSuccess });
}));

router.get('/dat-lai-mat-khau/:token', asyncHandler(async (req, res) => {
  const user = await getUserByResetToken(req.params.token);
  res.render('reset-password', { valid: !!user, token: req.params.token, error: null, success: false });
}));

router.post('/dat-lai-mat-khau/:token', asyncHandler(async (req, res) => {
  const user = await getUserByResetToken(req.params.token);
  if (!user) {
    return res.render('reset-password', { valid: false, token: req.params.token, error: null, success: false });
  }

  const { mat_khau_moi, mat_khau_moi_lai } = req.body;
  if (!mat_khau_moi || mat_khau_moi.length < 6) {
    return res.render('reset-password', { valid: true, token: req.params.token, error: 'Mật khẩu mới phải có ít nhất 6 ký tự.', success: false });
  }
  if (mat_khau_moi !== mat_khau_moi_lai) {
    return res.render('reset-password', { valid: true, token: req.params.token, error: 'Mật khẩu xác nhận không khớp.', success: false });
  }

  const newHash = bcrypt.hashSync(mat_khau_moi, 10);
  await run('UPDATE users SET password_hash = ?, password_reset_pending = 0 WHERE id = ?', [newHash, user.id]);
  await clearResetToken(user.id);

  res.render('reset-password', { valid: false, token: req.params.token, error: null, success: true });
}));

router.get('/dang-ky', (req, res) => {
  if (req.session.userId) return res.redirect('/tai-khoan');
  res.render('register', { error: null, form: {}, next: req.query.next || '/tai-khoan' });
});

router.post('/dang-ky', asyncHandler(async (req, res) => {
  const { full_name, email, phone, username, password, confirm_password, next } = req.body;
  const nextUrl = next || '/tai-khoan';

  if (!full_name || !email || !phone || !username || !password) {
    return res.render('register', { error: 'Vui lòng điền đầy đủ thông tin.', form: req.body, next: nextUrl });
  }
  if (password !== confirm_password) {
    return res.render('register', { error: 'Mật khẩu xác nhận không khớp.', form: req.body, next: nextUrl });
  }
  if (await get('SELECT id FROM users WHERE username = ?', [username])) {
    return res.render('register', { error: 'Tên đăng nhập đã tồn tại.', form: req.body, next: nextUrl });
  }
  if (await get('SELECT id FROM users WHERE email = ?', [email])) {
    return res.render('register', { error: 'Email đã được sử dụng.', form: req.body, next: nextUrl });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    'INSERT INTO users (full_name, email, phone, username, password_hash, role) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [full_name, email, phone, username, hash, 'member']
  );

  req.session.userId = Number(result.rows[0].id);
  res.redirect(isSafeRedirect(nextUrl) ? nextUrl : '/tai-khoan');
}));

router.get('/dang-xuat', (req, res) => {
  req.session.userId = null;
  req.session.adminId = null;
  res.redirect('/');
});

router.get('/tai-khoan', requirePersonalMember, asyncHandler(async (req, res) => {
  const orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
  res.render('account', { orders, successMsg: null });
}));

router.post('/tai-khoan', requirePersonalMember, asyncHandler(async (req, res) => {
  const { full_name, phone } = req.body;
  await run('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [full_name, phone, req.session.userId]);
  const orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
  res.render('account', { orders, successMsg: 'Cập nhật thông tin thành công.' });
}));

router.get('/tai-khoan/doi-mat-khau', requirePersonalMember, asyncHandler(async (req, res) => {
  const user = await get('SELECT password_reset_pending FROM users WHERE id = ?', [req.session.userId]);
  res.render('account-change-password', { error: null, success: null, pending: !!user.password_reset_pending });
}));

router.post('/tai-khoan/doi-mat-khau', requirePersonalMember, asyncHandler(async (req, res) => {
  const { mat_khau_cu, mat_khau_moi, mat_khau_moi_lai } = req.body;
  const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  const pending = !!user.password_reset_pending;

  if (!bcrypt.compareSync(mat_khau_cu || '', user.password_hash)) {
    return res.render('account-change-password', { error: 'Mật khẩu hiện tại không đúng.', success: null, pending });
  }
  if (!mat_khau_moi || mat_khau_moi.length < 6) {
    return res.render('account-change-password', { error: 'Mật khẩu mới phải có ít nhất 6 ký tự.', success: null, pending });
  }
  if (mat_khau_moi !== mat_khau_moi_lai) {
    return res.render('account-change-password', { error: 'Xác nhận mật khẩu mới không khớp.', success: null, pending });
  }

  const newHash = bcrypt.hashSync(mat_khau_moi, 10);
  await run('UPDATE users SET password_hash = ?, password_reset_pending = 0 WHERE id = ?', [newHash, req.session.userId]);
  res.render('account-change-password', { error: null, success: 'Đã đổi mật khẩu thành công.', pending: false });
}));

router.post('/tai-khoan/doi-mat-khau/bo-qua', requirePersonalMember, asyncHandler(async (req, res) => {
  await run('UPDATE users SET password_reset_pending = 0 WHERE id = ?', [req.session.userId]);
  res.redirect('/tai-khoan');
}));

router.get('/tai-khoan/don-hang/:id/sua', requirePersonalMember, asyncHandler(async (req, res) => {
  const order = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
  if (!order || order.status !== 'moi') return res.redirect('/tai-khoan');
  res.render('account-order-edit', { order, error: null });
}));

router.post('/tai-khoan/don-hang/:id/sua', requirePersonalMember, asyncHandler(async (req, res) => {
  const order = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
  if (!order || order.status !== 'moi') return res.redirect('/tai-khoan');

  const { customer_name, phone, email, address, note } = req.body;
  if (!customer_name || !phone || !address) {
    return res.render('account-order-edit', {
      order: { ...order, customer_name, phone, email, address, note },
      error: 'Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.'
    });
  }

  await run(
    `UPDATE orders SET customer_name = ?, phone = ?, email = ?, address = ?, note = ?
     WHERE id = ? AND user_id = ? AND status = 'moi'`,
    [customer_name, phone, email || null, address, note || null, req.params.id, req.session.userId]
  );
  res.redirect('/tai-khoan');
}));

router.post('/tai-khoan/don-hang/:id/xoa', requirePersonalMember, asyncHandler(async (req, res) => {
  const order = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
  if (order && order.status === 'moi') {
    await run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
    await run(`DELETE FROM orders WHERE id = ? AND user_id = ? AND status = 'moi'`, [req.params.id, req.session.userId]);
  }
  res.redirect('/tai-khoan');
}));

module.exports = router;
