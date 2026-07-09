const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:55432/postgres';
const useSSL = /supabase\.co|sslmode=require/.test(connectionString);
// The local pglite dev server (used when DATABASE_URL isn't set) only
// handles one connection reliably; a real Postgres/Supabase instance
// handles the normal pool size fine.
const poolMax = process.env.DATABASE_URL ? 10 : 1;

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: poolMax
});

// Route files were written with SQLite-style `?` placeholders; translate
// them to Postgres-style $1, $2... here so callers don't need to change.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function run(sql, params = []) {
  return pool.query(toPgSql(sql), params);
}

async function get(sql, params = []) {
  const result = await pool.query(toPgSql(sql), params);
  return result.rows[0];
}

async function all(sql, params = []) {
  const result = await pool.query(toPgSql(sql), params);
  return result.rows;
}

async function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = { pool, run, get, all, initSchema };
