const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'uploads';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const localUploadDir = path.join(__dirname, '..', 'public', 'uploads');

function randomFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
}

// Kiểm tra nội dung file thật (magic bytes) thay vì chỉ tin vào đuôi file/
// mimetype do trình duyệt gửi lên - đuôi file/mimetype rất dễ giả mạo.
const IMAGE_SIGNATURES = [
  { mime: 'image/jpeg', check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', check: (b) => b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/gif', check: (b) => b.length > 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { mime: 'image/webp', check: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }
];

function detectImageMime(buffer) {
  const match = IMAGE_SIGNATURES.find((sig) => sig.check(buffer));
  return match ? match.mime : null;
}

async function ensureBucket() {
  if (!supabase) return;
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('[storage] Khong the kiem tra bucket Supabase:', error.message);
    return;
  }
  if (!buckets.some((b) => b.name === BUCKET)) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createError) console.error('[storage] Khong the tao bucket:', createError.message);
    else console.log(`[storage] Da tao bucket "${BUCKET}" tren Supabase Storage`);
  }
}

// Uploads a multer memory-storage file and returns the public URL to store in the DB.
// Falls back to writing on local disk (public/uploads) when Supabase Storage isn't configured,
// which is fine for local dev but NOT durable on Render's ephemeral disk.
async function saveUploadedFile(file) {
  const detectedMime = detectImageMime(file.buffer);
  if (!detectedMime) throw new Error('File không phải ảnh hợp lệ (jpg, png, gif, webp).');

  const filename = randomFilename(file.originalname);

  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(filename, file.buffer, {
      contentType: detectedMime,
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  }

  fs.mkdirSync(localUploadDir, { recursive: true });
  fs.writeFileSync(path.join(localUploadDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

module.exports = { saveUploadedFile, ensureBucket, isSupabaseConfigured: !!supabase };
