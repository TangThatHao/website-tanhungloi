require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const { pool, initSchema, get, run } = require('./db');
const { seedIfEmpty } = require('./db/seed');
const { formatPrice, categoryIcon } = require('./utils/format');
const { loadUser } = require('./middleware/auth');
const { ensureBucket, isSupabaseConfigured } = require('./utils/storage');
const pgSession = require('connect-pg-simple')(session);

// Repo này là public trên GitHub - không được phép có secret dự phòng "cứng"
// trong code cho session, vì ai cũng đọc được. Nếu thiếu biến môi trường
// SESSION_SECRET thì dừng khởi động luôn thay vì âm thầm chạy với secret yếu.
if (!process.env.SESSION_SECRET) {
  console.error('Thiếu biến môi trường SESSION_SECRET - dừng khởi động để tránh dùng secret yếu, không an toàn.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.formatPrice = formatPrice;
app.locals.categoryIcon = categoryIcon;

// Vài header bảo mật cơ bản (không cần cài thêm package như helmet):
// - X-Content-Type-Options: trình duyệt không tự đoán loại file khác với
//   Content-Type khai báo (chống 1 số kiểu tấn công qua file upload).
// - X-Frame-Options: trang không bị nhúng trong <iframe> ở site khác (chống clickjacking).
// - Referrer-Policy: không gửi URL đầy đủ (có thể chứa token) sang site khác khi bấm link ra ngoài.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, sameSite: 'lax', secure: 'auto' }
  })
);

// Đếm lượt truy cập, lưu vào DB (bảng site_stats) để không bị mất mỗi khi
// Render deploy lại. Tăng biến đếm trong RAM ở mỗi request (rẻ, hiển thị
// ngay), nhưng chỉ ghi xuống DB định kỳ mỗi 30s (nếu có thay đổi) thay vì
// ghi ở từng request - đỡ tốn 1 lượt UPDATE DB cho mỗi lượt xem trang.
let visitCount = 0;
let lastSavedVisitCount = 0;
setInterval(() => {
  if (visitCount === lastSavedVisitCount) return;
  const toSave = visitCount;
  run('UPDATE site_stats SET visit_count = ? WHERE id = 1', [toSave])
    .then(() => { lastSavedVisitCount = toSave; })
    .catch((err) => console.error('[visitCount] Loi luu luot truy cap:', err.message));
}, 30 * 1000).unref();

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/admin') && !req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico)$/)) {
    visitCount++;
  }
  res.locals.visitCount = visitCount;
  next();
});

app.use(loadUser);

app.use(require('./routes/admin'));
app.use(require('./routes/auth'));
app.use(require('./routes/cart'));
app.use(require('./routes/products'));
app.use(require('./routes/news'));
app.use(require('./routes/pages'));
app.use(require('./routes/index'));

app.use((req, res) => {
  res.status(404).send('<h1 style="font-family:sans-serif; text-align:center; margin-top:80px;">404 - Không tìm thấy trang</h1><p style="text-align:center;"><a href="/">Về trang chủ</a></p>');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('<h1 style="font-family:sans-serif; text-align:center; margin-top:80px;">Đã có lỗi xảy ra</h1><p style="text-align:center;"><a href="/">Về trang chủ</a></p>');
});

async function main() {
  await initSchema();
  await seedIfEmpty();
  const stats = await get('SELECT visit_count FROM site_stats WHERE id = 1');
  if (stats) visitCount = Number(stats.visit_count);
  if (isSupabaseConfigured) {
    await ensureBucket();
  } else {
    console.warn('[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY chua duoc cau hinh - anh upload se luu tam vao dia, khong ben vung tren Render.');
  }
  app.listen(PORT, () => {
    console.log(`Tan Hung Loi website dang chay tai http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Khong the khoi dong server:', err);
  process.exit(1);
});
