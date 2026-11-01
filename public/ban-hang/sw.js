// Lưu sẵn giao diện app để mở được cả khi không có mạng.
// Mỗi lần sửa app, tăng số VERSION để iPhone tải bản mới.
const VERSION = 'banhang-v13';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'receipt.js', 'manifest.webmanifest',
  'vendor/qrcode.js', 'data/products.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Chỉ phục vụ file của app từ bộ nhớ đệm; giá sản phẩm (/api/...) luôn lấy từ mạng.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
