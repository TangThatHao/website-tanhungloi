const express = require('express');
const router = express.Router();
const { get, run, all } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { orderLookupRateLimit } = require('../middleware/auth');
const { notifyNewOrder } = require('../utils/notify');

async function getCartWithDetails(req) {
  const cart = req.session.cart || [];
  const rows = await Promise.all(
    cart.map(async (item) => {
      const product = await get('SELECT * FROM products WHERE id = ?', [item.productId]);
      if (!product) return null;
      const unitPrice = product.price || 0;
      return { product, qty: item.qty, lineTotal: unitPrice * item.qty };
    })
  );
  const items = rows.filter(Boolean);
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items, total };
}

router.post('/gio-hang/them', asyncHandler(async (req, res) => {
  const productId = Number(req.body.productId);
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const redirectTo = req.body.redirectTo || '/gio-hang';

  const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return res.redirect(redirectTo);

  if (!req.session.cart) req.session.cart = [];
  const existing = req.session.cart.find((i) => i.productId === productId);
  if (existing) existing.qty += qty;
  else req.session.cart.push({ productId, qty });

  const sep = redirectTo.includes('?') ? '&' : '?';
  res.redirect(redirectTo.startsWith('/san-pham/') ? `${redirectTo}${sep}added=1` : redirectTo);
}));

router.get('/gio-hang', asyncHandler(async (req, res) => {
  const { items, total } = await getCartWithDetails(req);
  res.render('cart', { items, total });
}));

router.post('/gio-hang/cap-nhat', (req, res) => {
  if (req.session.cart) {
    req.session.cart.forEach((item) => {
      const newQty = parseInt(req.body['qty_' + item.productId], 10);
      if (newQty && newQty > 0) item.qty = newQty;
    });
  }
  res.redirect(req.query.goto === 'thanh-toan' ? '/thanh-toan' : '/gio-hang');
});

router.post('/gio-hang/xoa', (req, res) => {
  const productId = Number(req.body.productId);
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter((i) => i.productId !== productId);
  }
  res.redirect('/gio-hang');
});

router.get('/thanh-toan', asyncHandler(async (req, res) => {
  const { items, total } = await getCartWithDetails(req);
  if (items.length === 0) return res.redirect('/gio-hang');
  if (!req.session.userId) return res.render('checkout-choice', { items, total });
  res.render('checkout', { items, total, error: null, form: {} });
}));

router.post('/thanh-toan/dat-nhanh', asyncHandler(async (req, res) => {
  const { items } = await getCartWithDetails(req);
  if (items.length === 0) return res.redirect('/gio-hang');
  if (!req.session.userId) {
    const guest = await get('SELECT id FROM users WHERE is_shared_guest = 1 LIMIT 1');
    if (guest) req.session.userId = guest.id;
  }
  res.redirect('/thanh-toan');
}));

router.post('/thanh-toan', asyncHandler(async (req, res) => {
  const { items, total } = await getCartWithDetails(req);
  if (items.length === 0) return res.redirect('/gio-hang');

  const { customer_name, phone, email, address, note } = req.body;
  if (!customer_name || !phone || !address) {
    return res.render('checkout', { items, total, error: 'Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.', form: req.body });
  }

  const orderResult = await run(
    `INSERT INTO orders (user_id, customer_name, phone, email, address, note, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'moi') RETURNING id`,
    [req.session.userId || null, customer_name, phone, email || null, address, note || null, total]
  );
  const orderId = Number(orderResult.rows[0].id);

  for (const item of items) {
    await run(
      'INSERT INTO order_items (order_id, product_id, product_name, price, qty) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.product.id, item.product.name, item.product.price || 0, item.qty]
    );
  }

  notifyNewOrder(
    { id: orderId, customer_name, phone, address, total },
    items.map((item) => ({ name: item.product.name, qty: item.qty }))
  ).catch((err) => console.error('[notify] Loi khi gui thong bao don hang moi:', err.message));

  req.session.cart = [];
  res.locals.cartCount = 0;
  res.render('order-success', { orderId, total });
}));

router.get('/tra-cuu-don-hang', (req, res) => {
  // Khách đã đăng nhập bằng tài khoản cá nhân đã có sẵn đơn hàng của mình ở
  // /tai-khoan (kèm sửa/xóa đơn mới) - không cần bắt nhập lại số điện thoại.
  if (res.locals.currentUser && !res.locals.currentUser.is_shared_guest) {
    return res.redirect('/tai-khoan');
  }
  res.render('order-lookup', { phone: '', orders: null, error: null, sharedAccountNotice: req.query.tk === 'chung' });
});

router.post('/tra-cuu-don-hang', orderLookupRateLimit, asyncHandler(async (req, res) => {
  const phone = (req.body.phone || '').trim();
  let orders = [];
  if (phone) {
    orders = await all('SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC', [phone]);
    for (const o of orders) {
      o.items = await all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    }
  }
  res.render('order-lookup', { phone, orders, error: null, sharedAccountNotice: false });
}));

module.exports = router;
