'use strict';
/* Vẽ hóa đơn cho máy in nhiệt (58mm = 384 điểm, 80mm = 576 điểm), mã VietQR và in qua Bluetooth. */

/* ================= Ngân hàng (mã BIN theo NAPAS) ================= */
const BANKS = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'],
  ['970407', 'Techcombank'], ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'],
  ['970403', 'Sacombank'], ['970423', 'TPBank'], ['970441', 'VIB'], ['970443', 'SHB'],
  ['970437', 'HDBank'], ['970448', 'OCB'], ['970426', 'MSB'], ['970440', 'SeABank'],
  ['970431', 'Eximbank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970409', 'Bac A Bank'],
  ['970425', 'ABBANK'], ['970427', 'VietABank'], ['970452', 'KienlongBank'], ['970412', 'PVcomBank'],
  ['970438', 'BaoViet Bank'], ['970400', 'Saigonbank'], ['970433', 'VietBank'], ['970419', 'NCB'],
  ['970430', 'PG Bank'], ['970408', 'GPBank'], ['970454', 'BVBank (Timo)'], ['970444', 'CBBank'],
  ['970424', 'Shinhan Bank'], ['970457', 'Woori Bank'], ['546034', 'CAKE by VPBank'], ['546035', 'Ubank by VPBank']
];
const bankName = (bin) => (BANKS.find((b) => b[0] === bin) || [])[1] || '';

/* ================= VietQR (chuẩn EMVCo của NAPAS) ================= */
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
// Nội dung chuyển khoản chỉ nên dùng chữ không dấu
const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .replace(/[^A-Za-z0-9 .-]/g, '').slice(0, 25);
function vietQRPayload({ bin, acc, amount, info }) {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', acc)) + tlv('02', 'QRIBFTTA');
  const p = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704')
    + (amount ? tlv('54', String(Math.round(amount))) : '') + tlv('58', 'VN')
    + (info ? tlv('62', tlv('08', ascii(info))) : '') + '6304';
  return p + crc16(p);
}

/* ================= Vẽ hóa đơn ================= */
// Hóa đơn chỉ in tên sản phẩm, bỏ mã ở cuối: "(MSP: P5)", "(MSP: P5_KT)", "(P4_CC)"...
const shortName = (name) => String(name).replace(/\s*\((?:MSP\s*:\s*)?[A-Z0-9_]+\)\s*$/, '').trim()
  || String(name);
const FF = '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif';
/**
 * Trả về canvas đen trắng đúng khổ giấy. Cùng một hình dùng cho xem trước, gửi ảnh và in Bluetooth.
 * inv: hóa đơn; s: cài đặt cửa hàng; money: hàm định dạng tiền; words: hàm đọc số thành chữ
 */
async function renderReceipt(inv, s, money, words) {
  const W = s.paper === '80' ? 576 : 384;
  const P = 4;                       // lề trái/phải (máy in đã có lề riêng)
  const c = document.createElement('canvas');
  c.width = W; c.height = 2400 + inv.lines.length * 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, c.height);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
  let y = 6;

  const font = (size, bold, italic) => { ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${FF}`; };
  const wrap = (str, maxW) => {
    const out = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width <= maxW) { line = test; continue; }
        if (line) out.push(line);
        line = word;
        while (ctx.measureText(line).width > maxW) {   // từ quá dài: cắt theo ký tự
          let k = line.length - 1;
          while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
          out.push(line.slice(0, k)); line = line.slice(k);
        }
      }
      out.push(line);
    }
    return out;
  };
  const text = (str, { size = 24, bold = false, italic = false, align = 'left', after = 4, lh = 1.28 } = {}) => {
    if (!str) return;
    font(size, bold, italic);
    for (const ln of wrap(str, W - 2 * P)) {
      const w = ctx.measureText(ln).width;
      ctx.fillText(ln, align === 'center' ? (W - w) / 2 : align === 'right' ? W - P - w : P, y);
      y += Math.round(size * lh);
    }
    y += after;
  };
  // Nhãn bên trái (tự xuống dòng) + số tiền canh phải ở dòng cuối
  const row = (left, right, { size = 24, bold = false, rbold = bold, after = 4, indent = 0 } = {}) => {
    font(size, rbold);
    const rw = ctx.measureText(right).width;
    font(size, bold);
    const lines = wrap(left, W - 2 * P - indent - rw - 12);
    lines.forEach((ln, i) => {
      ctx.fillText(ln, P + indent, y);
      if (i === lines.length - 1) { font(size, rbold); ctx.fillText(right, W - P - rw, y); font(size, bold); }
      y += Math.round(size * 1.28);
    });
    y += after;
  };
  const rule = (style = 'dash') => {
    y += 6;
    if (style === 'dash') for (let x = P; x < W - P; x += 12) ctx.fillRect(x, y, 7, 2);
    else ctx.fillRect(P, y, W - 2 * P, style === 'thick' ? 4 : 2);
    y += style === 'thick' ? 14 : 12;
  };

  /* --- Đầu hóa đơn --- */
  text(s.name, { size: 36, bold: true, align: 'center', after: 0 });
  text(s.slogan, { size: 22, align: 'center', after: 4 });
  // Mỗi dòng địa chỉ in trên đúng 1 dòng: dòng nào dài thì thu nhỏ chữ cho vừa khổ giấy (tối thiểu 15px)
  for (const ln of String(s.addr || '').split('\n').filter((x) => x.trim())) {
    let size = 21;
    for (font(size); size > 15 && ctx.measureText(ln).width > W - 2 * P; font(size)) size--;
    text(ln, { size, align: 'center', after: 0, lh: 1.25 });
  }
  y += 2;
  text('ĐT: ' + s.phone, { size: 26, bold: true, align: 'center', after: 0 });
  rule('thick');

  text('HÓA ĐƠN BÁN HÀNG', { size: 34, bold: true, align: 'center', after: 2 });
  const d = new Date(inv.date), pad = (n) => String(n).padStart(2, '0');
  text('Số: ' + inv.no, { size: 24, bold: true, align: 'center', after: 0 });
  text(`${pad(d.getHours())}:${pad(d.getMinutes())}  ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    { size: 24, align: 'center', after: 0 });

  if (inv.name || inv.phone || inv.addr) {
    rule();
    if (inv.name) text('Khách: ' + inv.name, { size: 28, bold: true, after: 0 });
    if (inv.phone) text('ĐT: ' + inv.phone, { size: 27, after: 0 });
    if (inv.addr) text('Đ/c: ' + inv.addr, { size: 25, after: 0 });
  }
  rule();

  /* --- Hàng hóa: tên 1 dòng, "SL x đơn giá ....... thành tiền" dòng dưới --- */
  inv.lines.forEach((l, i) => {
    text(`${i + 1}. ${shortName(l.name)}`, { size: 26, bold: true, after: 0 });
    row(`${l.qty} x ${money(l.price)}`, money(l.price * l.qty), { size: 26, rbold: true, after: 8, indent: 30 });
  });
  rule();

  /* --- Tổng tiền --- */
  const qty = inv.lines.reduce((t, l) => t + l.qty, 0);
  row(`Tiền hàng (${qty} món)`, money(inv.sub), { size: 25 });
  if (inv.ship) row('Phí vận chuyển', '+' + money(inv.ship), { size: 25 });
  if (inv.discount) row('Giảm giá', '-' + money(inv.discount), { size: 25 });

  // Khối nền đen chữ trắng cho TỔNG CỘNG: nổi bật, dễ đọc
  y += 6;
  const boxTop = y, boxH = 8 + Math.round(26 * 1.28) + Math.round(44 * 1.28) + 4;
  ctx.fillRect(P, boxTop, W - 2 * P, boxH);
  ctx.fillStyle = '#fff';
  y += 8; text('TỔNG CỘNG', { size: 26, bold: true, align: 'center', after: 0 });
  text(money(inv.total) + ' đ', { size: 44, bold: true, align: 'center', after: 0 });
  ctx.fillStyle = '#000';
  y = boxTop + boxH + 8;
  text('(' + words(inv.total) + ')', { size: 21, italic: true, align: 'center', after: 4, lh: 1.2 });

  if (inv.paid) {
    row('Đã trả trước', money(inv.paid), { size: 25 });
    row('CÒN PHẢI THU', money(inv.due) + ' đ', { size: 28, bold: true });
  }
  if (inv.note) { rule(); text('Ghi chú: ' + inv.note, { size: 23, after: 0 }); }

  /* --- Mã QR chuyển khoản --- */
  if (inv.qr !== false && s.bankBin && s.bankAcc && typeof qrcode === 'function') {
    const amount = inv.paid ? inv.due : inv.total;
    rule();
    text('QUÉT MÃ ĐỂ CHUYỂN KHOẢN', { size: 25, bold: true, align: 'center', after: 6 });
    const qr = qrcode(0, 'M');
    // Nội dung chuyển khoản chỉ ghi tên khách (không dấu), không ghi số hóa đơn/hàng hóa
    const info = ascii(inv.name || '').trim();
    qr.addData(vietQRPayload({ bin: s.bankBin, acc: s.bankAcc, amount, info }));
    qr.make();
    const n = qr.getModuleCount();
    const cell = Math.max(3, Math.floor(Math.min(290, W - 2 * P) / n));  // ô vuông nguyên điểm -> in nét, dễ quét
    const qx = Math.round((W - n * cell) / 2);
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (qr.isDark(r, col)) ctx.fillRect(qx + col * cell, y + r * cell, cell, cell);
    }
    y += n * cell + 10;
    text(bankName(s.bankBin), { size: 24, bold: true, align: 'center', after: 0 });
    text('STK: ' + s.bankAcc, { size: 28, bold: true, align: 'center', after: 0 });
    if (s.bankOwner) text(s.bankOwner.toUpperCase(), { size: 23, align: 'center', after: 0 });
    if (amount) text('Số tiền: ' + money(amount) + ' đ', { size: 24, align: 'center', after: 0 });
    if (info) text('Nội dung: ' + info, { size: 22, align: 'center', after: 0 });
  }

  rule();
  text(s.thanks, { size: 24, bold: true, italic: true, align: 'center', after: 0 });
  y += 18;

  // Cắt đúng chiều cao, ép mọi điểm về đen/trắng tuyệt đối (máy in nhiệt chỉ có 2 màu)
  const out = document.createElement('canvas');
  out.width = W; out.height = Math.ceil(y);
  const octx = out.getContext('2d');
  octx.drawImage(c, 0, 0);
  const img = octx.getImageData(0, 0, W, out.height), px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 170 ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/* ================= In qua Bluetooth (BLE, lệnh ESC/POS) ================= */
// Các dịch vụ BLE phổ biến của máy in nhiệt giá rẻ (Xprinter, Goojprt, MTP, PeriPage...)
const BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb', '0000af30-0000-1000-8000-00805f9b34fb'
];
const bt = { device: null, ch: null };
const btSupported = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PRINTER_KEY = 'thl.printer';             // máy in dùng lần trước: { id, name }
const savedPrinter = () => { try { return JSON.parse(localStorage.getItem(PRINTER_KEY)); } catch { return null; } };
// Kết nối Bluetooth có thể treo rất lâu khi máy in tắt/ở xa -> cắt sau ms giây
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Hết thời gian chờ máy in')), ms))]);

// Kết nối tới 1 máy in đã biết, tìm đặc tính (characteristic) cho phép ghi dữ liệu in
async function openPrinter(device) {
  const server = await device.gatt.connect();
  let ch = null;
  for (const svc of await server.getPrimaryServices()) {
    for (const c of await svc.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) { ch = c; break; }
    }
    if (ch) break;
  }
  if (!ch) { device.gatt.disconnect(); throw new Error('Máy này không phải máy in hoặc chưa hỗ trợ'); }
  if (bt.device !== device) device.addEventListener('gattserverdisconnected', () => { bt.ch = null; });
  bt.device = device; bt.ch = ch;
  try { localStorage.setItem(PRINTER_KEY, JSON.stringify({ id: device.id, name: device.name || '' })); } catch { /* bỏ qua */ }
  return device.name || 'Máy in';
}

// Hiện bảng chọn máy in (trình duyệt bắt buộc người dùng tự chọn lần đầu).
// onlySaved: chỉ liệt kê máy in đã dùng trước đó -> chạm 1 cái là xong (Bluefy không nhớ thiết bị
// giữa các lần mở app nên mỗi lần mở lại phải chọn lại 1 lần)
async function btConnect(onlySaved = false) {
  const saved = onlySaved && savedPrinter();
  const device = await navigator.bluetooth.requestDevice(saved && saved.name
    ? { filters: [{ name: saved.name }], optionalServices: BT_SERVICES }
    : { acceptAllDevices: true, optionalServices: BT_SERVICES });
  return openPrinter(device);
}
const btRemembers = () => !!(navigator.bluetooth && navigator.bluetooth.getDevices);

// Kết nối lại máy in cũ mà không hỏi: máy in tự ngắt khi để lâu không in,
// hoặc app vừa mở lại (trình duyệt nào nhớ thiết bị đã cho phép thì dùng được getDevices)
let reconnecting = null;                        // đang nối sẵn ở chế độ nền thì bấm In dùng chung lần nối đó
function btReconnect() {
  if (!reconnecting) reconnecting = tryReconnect().finally(() => { reconnecting = null; });
  return reconnecting;
}
async function tryReconnect() {
  if (bt.ch && bt.device.gatt.connected) return true;
  if (bt.device) {
    try { await withTimeout(openPrinter(bt.device), 4000); return true; } catch { /* thử cách khác */ }
  }
  const saved = savedPrinter();
  if (saved && navigator.bluetooth.getDevices) {
    try {
      const list = await navigator.bluetooth.getDevices();
      const d = list.find((x) => x.id === saved.id) || list.find((x) => saved.name && x.name === saved.name);
      if (d) { await withTimeout(openPrinter(d), 4000); return true; }
    } catch { /* trình duyệt không nhớ được -> phải chọn lại */ }
  }
  return false;
}

function escposRaster(canvas) {
  const W = canvas.width, H = canvas.height, bpr = W / 8;
  const px = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  const BAND = 64;                                  // gửi từng dải 64 dòng để không tràn bộ nhớ máy in
  const parts = [[0x1b, 0x40]];                     // ESC @ : khởi động lại máy in
  for (let y0 = 0; y0 < H; y0 += BAND) {
    const h = Math.min(BAND, H - y0);
    const band = new Uint8Array(8 + bpr * h);
    band.set([0x1d, 0x76, 0x30, 0, bpr & 255, bpr >> 8, h & 255, h >> 8]);   // GS v 0 : in ảnh
    for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
      if (px[((y0 + y) * W + x) * 4] < 128) band[8 + y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    }
    parts.push(band);
  }
  parts.push([0x1b, 0x64, 4]);                      // ESC d 4 : đẩy giấy ra 4 dòng để xé
  const total = parts.reduce((t, p) => t + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function btPrint(canvas, onProgress) {
  if (!bt.ch || !bt.device.gatt.connected) {
    if (!(await btReconnect())) await btConnect(true);
  }
  const data = escposRaster(canvas);
  const ch = bt.ch, noResp = ch.properties.writeWithoutResponse;
  // Gửi gói 180 byte cho nhanh; máy in/điện thoại nào chỉ nhận gói nhỏ (20 byte) thì tự chuyển sang gói nhỏ
  let size = 180, sent = 0;
  for (let i = 0; i < data.length;) {
    const chunk = data.slice(i, i + size);
    try {
      if (noResp) { await ch.writeValueWithoutResponse(chunk); await sleep(size > 20 ? 12 : 4); }
      else await ch.writeValue(chunk);
    } catch (e) {
      if (size > 20 && i === 0) { size = 20; continue; }
      throw e;
    }
    i += chunk.length;
    if (onProgress && ++sent % 30 === 0) onProgress(Math.round(i * 100 / data.length));
  }
}
