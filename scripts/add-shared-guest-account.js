// One-off script: insert the shared "quick checkout" guest account that was
// added to db/seed.js after the initial seed already ran (seedIfEmpty only
// fires when the table is empty). Safe to re-run: skips if it already exists.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { run, get } = require('../db/index');

async function main() {
  const exists = await get('SELECT id FROM users WHERE username = ?', ['0919454484']);
  if (exists) {
    console.log('[skip] Tai khoan dat nhanh dung chung da ton tai.');
    return;
  }
  const hash = bcrypt.hashSync('0919454484', 10);
  await run(
    `INSERT INTO users (full_name, email, phone, username, password_hash, role, is_shared_guest) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Khách đặt nhanh', null, '0919454484', '0919454484', hash, 'guest', 1]
  );
  console.log('[added] Tai khoan dat nhanh dung chung: 0919454484 / 0919454484');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
