const { get, run } = require('../db');

const ALLOWED_TABLES = new Set(['products', 'categories']);

async function moveItem(table, id, direction) {
  if (!ALLOWED_TABLES.has(table)) throw new Error('Bảng không hợp lệ');

  const current = await get(`SELECT id, sort_order FROM ${table} WHERE id = ?`, [id]);
  if (!current) return;

  const cmp = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'DESC' : 'ASC';
  const neighbor = await get(
    `SELECT id, sort_order FROM ${table} WHERE sort_order ${cmp} ? ORDER BY sort_order ${order} LIMIT 1`,
    [current.sort_order]
  );
  if (!neighbor) return;

  await run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [neighbor.sort_order, current.id]);
  await run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [current.sort_order, neighbor.id]);
}

module.exports = { moveItem };
