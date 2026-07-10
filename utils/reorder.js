const { get, run } = require('../db');

const ALLOWED_TABLES = new Set(['products', 'categories']);

async function moveItem(table, id, direction) {
  if (!ALLOWED_TABLES.has(table)) throw new Error('Bảng không hợp lệ');

  const current = await get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!current) return;

  const cmp = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'DESC' : 'ASC';
  // Sản phẩm chỉ so vị trí với sản phẩm cùng danh mục, vì thứ tự chỉ có ý nghĩa
  // trong phạm vi 1 danh mục (trang danh mục hiển thị sản phẩm lọc theo category_id).
  let sql = `SELECT id, sort_order FROM ${table} WHERE sort_order ${cmp} ?`;
  const params = [current.sort_order];
  if (table === 'products') {
    sql += ' AND category_id = ?';
    params.push(current.category_id);
  }
  sql += ` ORDER BY sort_order ${order} LIMIT 1`;
  const neighbor = await get(sql, params);
  if (!neighbor) return;

  await run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [neighbor.sort_order, current.id]);
  await run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [current.sort_order, neighbor.id]);
}

module.exports = { moveItem };
