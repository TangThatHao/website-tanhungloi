// Simple in-memory IP-based rate limiter factory. Fine for a single-instance
// deployment (Render free tier); would need a shared store (e.g. Postgres)
// if the app ever ran on multiple instances.
function createRateLimiter({ max = 5, windowMs = 15 * 60 * 1000, onLimited }) {
  const attempts = new Map();

  // Dọn định kỳ các entry đã hết hạn cửa sổ, tránh Map phình to vô hạn khi
  // có nhiều IP khác nhau truy cập trong thời gian server chạy dài.
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now - entry.firstAttempt >= windowMs) attempts.delete(key);
    }
  }, windowMs);
  cleanupTimer.unref();

  function middleware(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const entry = attempts.get(key);

    if (entry && now - entry.firstAttempt < windowMs) {
      if (entry.count >= max) {
        return onLimited(req, res);
      }
      entry.count++;
    } else {
      attempts.set(key, { count: 1, firstAttempt: now });
    }
    next();
  }

  function clear(req) {
    attempts.delete(req.ip);
  }

  return { middleware, clear };
}

module.exports = { createRateLimiter };
