// API cho app bán hàng trên điện thoại (public/ban-hang): đăng nhập bằng tài
// khoản admin, sao lưu/đồng bộ khách hàng, hóa đơn, cài đặt lên DB.
// Dữ liệu có tên/SĐT/địa chỉ khách nên mọi route (trừ đăng nhập) đều bắt buộc
// token của admin, và KHÔNG mở CORS - chỉ app chạy cùng domain mới gọi được.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { pool, get, run } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { createRateLimiter } = require('../utils/rateLimit');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const loginLimiter = createRateLimiter({
  onLimited: (req, res) => res.status(429).json({ error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' })
});

router.use('/api/pos', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/api/pos/dang-nhap', loginLimiter.middleware, asyncHandler(async (req, res) => {
  const { tai_khoan, password } = req.body || {};
  const user = await get(
    "SELECT * FROM users WHERE role = 'admin' AND (username = ? OR email = ? OR phone = ?)",
    [tai_khoan || '', tai_khoan || '', tai_khoan || '']
  );
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng (cần tài khoản quản trị website).' });
  }
  loginLimiter.clear(req);
  // Token ngẫu nhiên trả cho app giữ; DB chỉ lưu bản băm để lộ DB cũng không dùng được token
  const token = crypto.randomBytes(32).toString('hex');
  await run('INSERT INTO pos_tokens (token_hash, user_id) VALUES (?, ?)', [hashToken(token), user.id]);
  res.json({ token, name: user.full_name || user.username });
}));

const requirePosAuth = asyncHandler(async (req, res, next) => {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
  const row = m && await get(
    `SELECT t.token_hash, u.id, u.role FROM pos_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?`, [hashToken(m[1])]
  );
  if (!row || row.role !== 'admin') return res.status(401).json({ error: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' });
  req.posTokenHash = row.token_hash;
  run('UPDATE pos_tokens SET last_used = CURRENT_TIMESTAMP WHERE token_hash = ?', [row.token_hash]).catch(() => {});
  next();
});

router.post('/api/pos/dang-xuat', requirePosAuth, asyncHandler(async (req, res) => {
  await run('DELETE FROM pos_tokens WHERE token_hash = ?', [req.posTokenHash]);
  res.json({ ok: true });
}));

// Toàn bộ dữ liệu hiện có (app gọi khi mở, sau khi gửi các thay đổi của mình)
router.get('/api/pos/du-lieu', requirePosAuth, asyncHandler(async (req, res) => {
  const [customers, invoices, settings] = await Promise.all([
    pool.query('SELECT data FROM pos_customers WHERE deleted = 0'),
    pool.query("SELECT data FROM pos_invoices WHERE deleted = 0 ORDER BY data->>'date' DESC"),
    pool.query('SELECT data FROM pos_settings WHERE id = 1')
  ]);
  res.json({
    customers: customers.rows.map((r) => r.data),
    invoices: invoices.rows.map((r) => r.data),
    settings: settings.rows[0] ? settings.rows[0].data : null
  });
}));

const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;
const listOf = (x) => (Array.isArray(x) ? x : []);

// Nhận các thay đổi từ app: { customers: {put: [...], del: [id]}, invoices: {put: [...]}, settings }
router.post('/api/pos/dong-bo', requirePosAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const tables = { customers: 'pos_customers', invoices: 'pos_invoices' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, table] of Object.entries(tables)) {
      const part = body[key] || {};
      for (const item of listOf(part.put)) {
        if (!item || typeof item !== 'object' || !validId(item.id)) continue;
        await client.query(
          `INSERT INTO ${table} (id, data, deleted, updated_at) VALUES ($1, $2, 0, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, deleted = 0, updated_at = CURRENT_TIMESTAMP`,
          [item.id, JSON.stringify(item)]
        );
      }
      for (const id of listOf(part.del)) {
        if (!validId(id)) continue;
        await client.query(`UPDATE ${table} SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      }
    }
    if (body.settings && typeof body.settings === 'object') {
      await client.query(
        `INSERT INTO pos_settings (id, data, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(body.settings)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

// Lỗi trong API trả JSON thay vì trang HTML để app hiển thị được
router.use('/api/pos', (err, req, res, next) => {
  console.error('[pos]', err);
  res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'Dữ liệu quá lớn' : 'Lỗi máy chủ' });
});

module.exports = router;
