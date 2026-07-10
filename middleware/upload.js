const multer = require('multer');
const path = require('path');

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp).'));
};

// Memory storage: files are held as a buffer in req.file.buffer and handed off
// to utils/storage.js (Supabase Storage) instead of being written to disk,
// since Render's local disk is ephemeral.
module.exports = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
