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
  const filename = randomFilename(file.originalname);

  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(filename, file.buffer, {
      contentType: file.mimetype,
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
