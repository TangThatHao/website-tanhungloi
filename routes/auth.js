const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { run, get, all } = require('../db');
const { requireMember } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/dang-nhap', (req, res) => {
  if (req.session.userId) return res.redirect('/tai-khoan');
  res.render('login', { error: null, next: req.query.next || '/' });
});

router.post('/dang-nhap', asyncHandler(async (req, res) => {
  const { username, password, next } = req.body;
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng.', next: next || '/' });
  }

  req.session.userId = user.id;
  res.redirect(next && next.startsWith('/') ? next : '/');
}));

router.get('/dang-ky', (req, res) => {
  if (req.session.userId) return res.redirect('/tai-khoan');
  res.render('register', { error: null, form: {} });
});

router.post('/dang-ky', asyncHandler(async (req, res) => {
  const { full_name, email, phone, username, password, confirm_password } = req.body;

  if (!full_name || !email || !phone || !username || !password) {
    return res.render('register', { error: 'Vui lòng điền đầy đủ thông tin.', form: req.body });
  }
  if (password !== confirm_password) {
    return res.render('register', { error: 'Mật khẩu xác nhận không khớp.', form: req.body });
  }
  if (await get('SELECT id FROM users WHERE username = ?', [username])) {
    return res.render('register', { error: 'Tên đăng nhập đã tồn tại.', form: req.body });
  }
  if (await get('SELECT id FROM users WHERE email = ?', [email])) {
    return res.render('register', { error: 'Email đã được sử dụng.', form: req.body });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    'INSERT INTO users (full_name, email, phone, username, password_hash, role) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [full_name, email, phone, username, hash, 'member']
  );

  req.session.userId = Number(result.rows[0].id);
  res.redirect('/tai-khoan');
}));

router.get('/dang-xuat', (req, res) => {
  req.session.userId = null;
  req.session.adminId = null;
  res.redirect('/');
});

router.get('/tai-khoan', requireMember, asyncHandler(async (req, res) => {
  const orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
  res.render('account', { orders, successMsg: null });
}));

router.post('/tai-khoan', requireMember, asyncHandler(async (req, res) => {
  const { full_name, phone } = req.body;
  await run('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [full_name, phone, req.session.userId]);
  const orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
  res.render('account', { orders, successMsg: 'Cập nhật thông tin thành công.' });
}));

module.exports = router;
