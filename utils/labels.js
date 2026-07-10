const { get, run, all } = require('../db');

const LABELS = {
  hot: { flag: 'is_hot', order: 'hot_order', name: 'Sản phẩm HOT' },
  new: { flag: 'is_new', order: 'new_order', name: 'Sản phẩm mới' },
  export: { flag: 'is_export', order: 'export_order', name: 'Sản phẩm xuất khẩu' }
};

// Gọi sau khi bật cờ is_hot/is_new/is_export cho 1 sản phẩm (từ form sửa sản
// phẩm hoặc từ trang quản lý nhãn) để gán thứ tự hiển thị nếu sản phẩm đó
// chưa từng có thứ tự trong nhãn này.
async function syncLabelOrder(productId, type) {
  const cfg = LABELS[type];
  if (!cfg) return;
  const current = await get(`SELECT ${cfg.order} AS ord FROM products WHERE id = ?`, [productId]);
  if (!current || Number(current.ord) !== 0) return;
  const maxOrder = Number((await get(`SELECT COALESCE(MAX(${cfg.order}),0) m FROM products WHERE ${cfg.flag} = 1`)).m);
  await run(`UPDATE products SET ${cfg.order} = ? WHERE id = ?`, [maxOrder + 1, productId]);
}

async function addToLabel(type, productId) {
  const cfg = LABELS[type];
  if (!cfg) return;
  await run(`UPDATE products SET ${cfg.flag} = 1 WHERE id = ?`, [productId]);
  await syncLabelOrder(productId, type);
}

async function removeFromLabel(type, productId) {
  const cfg = LABELS[type];
  if (!cfg) return;
  await run(`UPDATE products SET ${cfg.flag} = 0 WHERE id = ?`, [productId]);
}

async function moveLabelItem(type, id, direction) {
  const cfg = LABELS[type];
  if (!cfg) return;
  const current = await get(`SELECT id, ${cfg.order} AS ord FROM products WHERE id = ?`, [id]);
  if (!current) return;

  const cmp = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'DESC' : 'ASC';
  const neighbor = await get(
    `SELECT id, ${cfg.order} AS ord FROM products WHERE ${cfg.flag} = 1 AND ${cfg.order} ${cmp} ? ORDER BY ${cfg.order} ${order} LIMIT 1`,
    [current.ord]
  );
  if (!neighbor) return;

  await run(`UPDATE products SET ${cfg.order} = ? WHERE id = ?`, [neighbor.ord, current.id]);
  await run(`UPDATE products SET ${cfg.order} = ? WHERE id = ?`, [current.ord, neighbor.id]);
}

async function labelProducts(type) {
  const cfg = LABELS[type];
  if (!cfg) return [];
  return all(`SELECT * FROM products WHERE ${cfg.flag} = 1 ORDER BY ${cfg.order} ASC`);
}

module.exports = { LABELS, syncLabelOrder, addToLabel, removeFromLabel, moveLabelItem, labelProducts };
