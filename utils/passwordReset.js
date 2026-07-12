const crypto = require('crypto');
const { run, get } = require('../db');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

async function createResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + RESET_TOKEN_TTL_MS;
  await run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, userId]);
  return token;
}

async function getUserByResetToken(token) {
  if (!token) return null;
  const user = await get('SELECT * FROM users WHERE reset_token = ?', [token]);
  if (!user || !user.reset_token_expires || Number(user.reset_token_expires) < Date.now()) return null;
  return user;
}

async function clearResetToken(userId) {
  await run('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [userId]);
}

module.exports = { createResetToken, getUserByResetToken, clearResetToken };
