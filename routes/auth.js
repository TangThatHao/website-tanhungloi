const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { run, get, all } = require('../db');
const { requireMember, requirePersonalMember, memberLoginRateLimit, clearMemberLoginAttempts } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

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
  res.redirect(isSafeRedirect(next) ? next : '/');
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
