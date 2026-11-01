'use strict';

/* ================= Lưu trữ trên máy ================= */
const K = { products: 'thl.products', settings: 'thl.settings', invoices: 'thl.invoices', draft: 'thl.draft' };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Không lưu được dữ liệu: ' + e.message); } };

const DEFAULT_SETTINGS = {
  name: 'TÂN HƯNG LỢI',
  slogan: 'Đặc sản bánh pía Sóc Trăng',
  addr: 'Sóc Trăng: 122 Lý Thường Kiệt, TP Sóc Trăng\nSài Gòn: 418/45 Hồng Bàng, P. Minh Phụng, TP.HCM',
  phone: '0919 454 484',
  bank: '',
  thanks: 'Cảm ơn quý khách! Hẹn gặp lại.',
  api: 'https://banhpiasoctrang.onrender.com'
};
let settings = { ...DEFAULT_SETTINGS, ...load(K.settings, {}) };
let catalog = load(K.products, null);          // { updatedAt, products: [...] }
let invoices = load(K.invoices, []);
const emptyDraft = () => ({ name: '', phone: '', addr: '', lines: [], ship: 0, discount: 0, paid: 0, note: '' });
let draft = { ...emptyDraft(), ...load(K.draft, {}) };

/* ================= Tiện ích ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('vi-VN');
const parseMoney = (s) => +String(s).replace(/\D/g, '') || 0;
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const pad = (n) => String(n).padStart(2, '0');

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Đọc số tiền thành chữ tiếng Việt, VD 1.250.000 -> "Một triệu hai trăm năm mươi nghìn đồng"
function moneyToWords(n) {
  n = Math.round(n);
  if (n === 0) return 'Không đồng';
  const D = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const read3 = (x, full) => {
    const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), u = x % 10, w = [];
    if (full || h) w.push(D[h] + ' trăm');
    if (t > 1) w.push(D[t] + ' mươi');
    else if (t === 1) w.push('mười');
    else if (u && (full || h)) w.push('lẻ');
    if (u) w.push(u === 1 && t > 1 ? 'mốt' : u === 5 && t ? 'lăm' : u === 4 && t > 1 ? 'tư' : D[u]);
    return w.join(' ');
  };
  const units = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups = [];
  let x = n;
  while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    // nhóm tỷ lặp lại cho số rất lớn (nghìn tỷ, triệu tỷ)
    const unit = i >= 4 ? units[i % 3 || 3] + ' tỷ' : units[i];
    out.push(read3(g, i < groups.length - 1) + unit);
  }
  const s = out.join(' ').replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
}

/* ================= Dữ liệu sản phẩm ================= */
function absImage(src) {
  if (!src) return '';
  return /^https?:/.test(src) ? src : settings.api.replace(/\/$/, '') + (src.startsWith('/') ? '' : '/') + src;
}

function setSync(text) { $('#syncStatus').textContent = text; }

async function syncProducts(manual) {
  setSync('Đang cập nhật giá…');
  const ctrl = new AbortController();
  // Render gói miễn phí "ngủ" khi không có ai truy cập, lần đầu có thể mất ~1 phút
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(settings.api.replace(/\/$/, '') + '/api/san-pham', { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data.products) || !data.products.length) throw new Error('Không có sản phẩm');
    catalog = { updatedAt: data.updatedAt || new Date().toISOString(), source: 'web', products: data.products };
    save(K.products, catalog);
    setSync('Giá mới nhất ✓');
    if (manual) toast(`Đã cập nhật ${catalog.products.length} sản phẩm`);
  } catch (e) {
    if (!catalog) {
      // Chưa có dữ liệu nào -> dùng bản danh sách đi kèm app
      try {
        const res = await fetch('data/products.json');
        const data = await res.json();
        catalog = { updatedAt: data.updatedAt, source: 'bundle', products: data.products };
        save(K.products, catalog);
      } catch { /* bỏ qua */ }
    }
    setSync(navigator.onLine ? 'Dùng giá đã lưu' : 'Ngoại tuyến');
    if (manual) toast('Không lấy được giá từ website (' + (e.name === 'AbortError' ? 'quá lâu' : e.message) + '), đang dùng giá đã lưu.', 4000);
  } finally {
    clearTimeout(timer);
    renderDataInfo();
    if (!$('#picker').hidden) renderPicker();
  }
}

function renderDataInfo() {
  if (!catalog) { $('#dataInfo').textContent = 'Chưa có dữ liệu sản phẩm.'; return; }
  const d = new Date(catalog.updatedAt);
  $('#dataInfo').textContent = `${catalog.products.length} sản phẩm · cập nhật ${d.toLocaleString('vi-VN')}`
    + (catalog.source === 'bundle' ? ' (bản kèm app)' : '');
}

/* ================= Lập hóa đơn ================= */
const saveDraft = () => save(K.draft, draft);

function calc(d) {
  const sub = d.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const total = Math.max(0, sub + (d.ship || 0) - (d.discount || 0));
  return { sub, total, due: Math.max(0, total - (d.paid || 0)) };
}

function renderLines() {
  const box = $('#lines');
  if (!draft.lines.length) {
    box.innerHTML = '<div class="empty">Chưa có sản phẩm nào</div>';
  } else {
    box.innerHTML = draft.lines.map((l, i) => `
      <div class="line" data-i="${i}">
        <div class="line-name"><span>${esc(l.name)}</span><button data-act="del" aria-label="Xóa">×</button></div>
        <div class="line-ctl">
          <div class="qty">
            <button data-act="minus">−</button>
            <input data-act="qty" inputmode="numeric" value="${l.qty}" />
            <button data-act="plus">+</button>
          </div>
          <input data-act="price" class="price money${l.price ? '' : ' need'}" inputmode="numeric"
            value="${l.price ? fmt(l.price) : ''}" placeholder="Nhập đơn giá" />
        </div>
        <div class="line-sum">= ${fmt(l.price * l.qty)} đ</div>
      </div>`).join('');
  }
  const qty = draft.lines.reduce((s, l) => s + l.qty, 0);
  $('#lineCount').textContent = qty ? `(${qty} món)` : '';
  renderTotals();
}

function renderTotals() {
  const { sub, total, due } = calc(draft);
  $('#tSub').textContent = fmt(sub) + ' đ';
  $('#tTotal').textContent = fmt(total) + ' đ';
  $('#tDueRow').hidden = !draft.paid;
  $('#tDue').textContent = fmt(due) + ' đ';
}

function fillDraftForm() {
  $('#cusName').value = draft.name;
  $('#cusPhone').value = draft.phone;
  $('#cusAddr').value = draft.addr;
  $('#note').value = draft.note;
  for (const k of ['ship', 'discount', 'paid']) $('#' + (k === 'ship' ? 'shipFee' : k)).value = draft[k] ? fmt(draft[k]) : '';
  renderLines();
}

function addProduct(p) {
  const line = draft.lines.find((l) => l.id === p.id);
  if (line) line.qty++;
  else draft.lines.push({ id: p.id, name: p.name, price: p.price || 0, qty: 1 });
  saveDraft(); renderLines(); renderPicker();
}

// Ô nhập tiền: tự thêm dấu chấm ngăn cách hàng nghìn khi gõ
function bindMoney(input, onValue) {
  input.addEventListener('input', () => {
    const v = parseMoney(input.value);
    input.value = v ? fmt(v) : '';
    onValue(v);
  });
}

$('#lines').addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  const row = e.target.closest('.line');
  if (!act || !row) return;
  const i = +row.dataset.i, l = draft.lines[i];
  if (act === 'del') draft.lines.splice(i, 1);
  else if (act === 'plus') l.qty++;
  else if (act === 'minus') { if (l.qty > 1) l.qty--; else draft.lines.splice(i, 1); }
  else return;
  saveDraft(); renderLines();
});
$('#lines').addEventListener('input', (e) => {
  const act = e.target.dataset.act;
  const row = e.target.closest('.line');
  if (!row) return;
  const l = draft.lines[+row.dataset.i];
  if (act === 'qty') {
    l.qty = Math.max(0, parseMoney(e.target.value));
    e.target.value = l.qty || '';
  } else if (act === 'price') {
    l.price = parseMoney(e.target.value);
    e.target.value = l.price ? fmt(l.price) : '';
    e.target.classList.toggle('need', !l.price);
  } else return;
  row.querySelector('.line-sum').textContent = '= ' + fmt(l.price * l.qty) + ' đ';
  saveDraft(); renderTotals();
});
// Số lượng để trống/0 khi rời ô -> bỏ dòng đó
$('#lines').addEventListener('focusout', (e) => {
  if (e.target.dataset.act !== 'qty') return;
  const before = draft.lines.length;
  draft.lines = draft.lines.filter((l) => l.qty > 0);
  if (draft.lines.length !== before) { saveDraft(); renderLines(); }
});

for (const [id, key] of [['cusName', 'name'], ['cusPhone', 'phone'], ['cusAddr', 'addr'], ['note', 'note']]) {
  $('#' + id).addEventListener('input', (e) => { draft[key] = e.target.value; saveDraft(); });
}
for (const [id, key] of [['shipFee', 'ship'], ['discount', 'discount'], ['paid', 'paid']]) {
  bindMoney($('#' + id), (v) => { draft[key] = v; saveDraft(); renderTotals(); });
}

$('#clearBtn').addEventListener('click', () => {
  if ((draft.lines.length || draft.name) && !confirm('Xóa hết nội dung đang nhập?')) return;
  draft = emptyDraft(); saveDraft(); fillDraftForm();
});

function nextInvoiceNo(date) {
  const prefix = `HD${String(date.getFullYear()).slice(2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}-`;
  const max = invoices.filter((v) => v.no.startsWith(prefix)).reduce((m, v) => Math.max(m, +v.no.slice(prefix.length) || 0), 0);
  return prefix + pad(max + 1);
}

$('#issueBtn').addEventListener('click', () => {
  const lines = draft.lines.filter((l) => l.qty > 0);
  if (!lines.length) return toast('Chưa chọn sản phẩm nào');
  const noPrice = lines.filter((l) => !l.price);
  if (noPrice.length && !confirm(`${noPrice.length} sản phẩm chưa có đơn giá (tính 0 đ). Vẫn xuất hóa đơn?`)) return;
  const now = new Date();
  const inv = {
    no: nextInvoiceNo(now), date: now.toISOString(),
    name: draft.name.trim(), phone: draft.phone.trim(), addr: draft.addr.trim(), note: draft.note.trim(),
    lines: lines.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
    ship: draft.ship, discount: draft.discount, paid: draft.paid
  };
  Object.assign(inv, calc(inv));
  invoices.unshift(inv);
  save(K.invoices, invoices);
  draft = emptyDraft(); saveDraft(); fillDraftForm();
  openInvoice(inv);
});

/* ================= Chọn sản phẩm ================= */
let pickCat = '';
function renderPicker() {
  const list = catalog?.products || [];
  const cats = [...new Set(list.map((p) => p.category).filter(Boolean))];
  $('#pCats').innerHTML = ['', ...cats].map((c) =>
    `<button data-cat="${esc(c)}" class="${c === pickCat ? 'on' : ''}">${c ? esc(c) : 'Tất cả'}</button>`).join('');
  const q = norm($('#pSearch').value.trim());
  const items = list.filter((p) => (!pickCat || p.category === pickCat) && (!q || norm(p.name).includes(q)));
  const inCart = Object.fromEntries(draft.lines.map((l) => [l.id, l.qty]));
  $('#pList').innerHTML = items.length ? items.map((p) => `
    <div class="pitem" data-id="${p.id}">
      <img src="${esc(absImage(p.image))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
      <div class="pinfo">
        <div class="pname">${esc(p.name)}</div>
        <div class="pprice${p.price ? '' : ' na'}">${p.price ? fmt(p.price) + ' đ' : 'Liên hệ – nhập giá khi bán'}</div>
      </div>
      <button class="padd" aria-label="Thêm">+${inCart[p.id] ? `<span class="badge">${inCart[p.id]}</span>` : ''}</button>
    </div>`).join('')
    : `<div class="empty">${catalog ? 'Không tìm thấy sản phẩm' : 'Đang tải danh sách sản phẩm…'}</div>`;
}
$('#openPicker').addEventListener('click', () => { $('#picker').hidden = false; renderPicker(); });
$('#closePicker').addEventListener('click', () => { $('#picker').hidden = true; });
$('#pSearch').addEventListener('input', renderPicker);
$('#pCats').addEventListener('click', (e) => {
  if (e.target.dataset.cat === undefined) return;
  pickCat = e.target.dataset.cat; renderPicker();
});
$('#pList').addEventListener('click', (e) => {
  const item = e.target.closest('.pitem');
  if (!item) return;
  const p = catalog.products.find((x) => String(x.id) === item.dataset.id);
  if (p) addProduct(p);
});

/* ================= Hóa đơn ================= */
let viewing = null;
function invoiceHTML(inv) {
  const d = new Date(inv.date);
  const when = `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const rows = inv.lines.map((l, i) => `
    <tr><td class="c">${i + 1}</td><td>${esc(l.name)}</td><td class="c">${l.qty}</td>
    <td class="r">${fmt(l.price)}</td><td class="r">${fmt(l.price * l.qty)}</td></tr>`).join('');
  const sumRow = (label, val, cls = '') => `<div class="row ${cls}"><span>${label}</span><b>${val}</b></div>`;
  return `
    <div class="inv-head">
      <img src="icons/logo.png" alt="" />
      <div>
        <div class="inv-shop">${esc(settings.name)}</div>
        <div class="s">${esc(settings.slogan)}</div>
        <div class="s">${esc(settings.addr).replace(/\n/g, '<br>')}</div>
        <div class="s">ĐT: <b>${esc(settings.phone)}</b></div>
      </div>
    </div>
    <div class="inv-title">HÓA ĐƠN BÁN HÀNG</div>
    <div class="inv-no">Số: <b>${esc(inv.no)}</b> · ${when}</div>
    <div class="inv-cus">
      ${inv.name ? `<div>Khách hàng: <b>${esc(inv.name)}</b></div>` : ''}
      ${inv.phone ? `<div>Điện thoại: ${esc(inv.phone)}</div>` : ''}
      ${inv.addr ? `<div>Địa chỉ: ${esc(inv.addr)}</div>` : ''}
    </div>
    <table class="inv-table">
      <thead><tr><th class="c">#</th><th>Sản phẩm</th><th class="c">SL</th><th class="r">Đ.giá</th><th class="r">T.tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="inv-sum">
      ${inv.ship || inv.discount ? sumRow('Tiền hàng', fmt(inv.sub) + ' đ') : ''}
      ${inv.ship ? sumRow('Phí vận chuyển', '+' + fmt(inv.ship) + ' đ') : ''}
      ${inv.discount ? sumRow('Giảm giá', '−' + fmt(inv.discount) + ' đ') : ''}
      ${sumRow('TỔNG CỘNG', fmt(inv.total) + ' đ', 'grand')}
      ${inv.paid ? sumRow('Đã trả trước', fmt(inv.paid) + ' đ') + sumRow('Còn phải thu', fmt(inv.due) + ' đ') : ''}
    </div>
    <div class="inv-words">Bằng chữ: ${moneyToWords(inv.total)}.</div>
    ${inv.note ? `<div class="inv-note">Ghi chú: ${esc(inv.note)}</div>` : ''}
    ${settings.bank ? `<div class="inv-bank">💳 ${esc(settings.bank)}</div>` : ''}
    <div class="inv-sign"><div><b>Khách hàng</b><i>(Ký, ghi rõ họ tên)</i></div><div><b>Người bán hàng</b><i>(Ký, ghi rõ họ tên)</i></div></div>
    <div class="inv-thanks">${esc(settings.thanks)}</div>`;
}

function openInvoice(inv) {
  viewing = inv;
  $('#paper').innerHTML = invoiceHTML(inv);
  $('#viewer').hidden = false;
  $('#viewer .paper-wrap').scrollTop = 0;
}
$('#closeViewer').addEventListener('click', () => { $('#viewer').hidden = true; renderHistory(); });
$('#printBtn').addEventListener('click', () => window.print());

// Chụp tờ hóa đơn thành ảnh PNG rồi mở bảng chia sẻ của iPhone (Zalo, Messenger, Lưu ảnh...)
$('#shareBtn').addEventListener('click', async () => {
  const btn = $('#shareBtn');
  btn.disabled = true; btn.textContent = 'Đang tạo ảnh…';
  try {
    const canvas = await html2canvas($('#paper'), { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], `${viewing.no}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Hóa đơn ' + viewing.no });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast('Đã lưu ảnh hóa đơn');
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Không tạo được ảnh: ' + e.message, 4000);
  } finally {
    btn.disabled = false; btn.textContent = 'Gửi ảnh';
  }
});

/* ================= Lịch sử ================= */
function renderHistory() {
  const q = norm($('#histSearch').value.trim());
  const list = invoices.filter((v) => !q || norm(`${v.no} ${v.name} ${v.phone}`).includes(q));
  const today = new Date().toDateString();
  const todays = invoices.filter((v) => new Date(v.date).toDateString() === today);
  $('#histSummary').textContent = `Hôm nay: ${todays.length} hóa đơn · ${fmt(todays.reduce((s, v) => s + v.total, 0))} đ`;
  $('#histList').innerHTML = list.length ? list.map((v) => {
    const d = new Date(v.date);
    return `<div class="hitem" data-no="${esc(v.no)}">
      <div class="top"><span>${esc(v.name || 'Khách lẻ')}</span><b>${fmt(v.total)} đ</b></div>
      <div class="sub">${esc(v.no)} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}
        · ${v.lines.reduce((s, l) => s + l.qty, 0)} món${v.phone ? ' · ' + esc(v.phone) : ''}</div>
    </div>`;
  }).join('') : '<div class="empty">Chưa có hóa đơn nào</div>';
}
$('#histSearch').addEventListener('input', renderHistory);
$('#histList').addEventListener('click', (e) => {
  const item = e.target.closest('.hitem');
  const inv = item && invoices.find((v) => v.no === item.dataset.no);
  if (inv) openInvoice(inv);
});

/* ================= Cài đặt ================= */
const SETTING_FIELDS = { sName: 'name', sSlogan: 'slogan', sAddr: 'addr', sPhone: 'phone', sBank: 'bank', sThanks: 'thanks', sApi: 'api' };
function fillSettings() { for (const [id, k] of Object.entries(SETTING_FIELDS)) $('#' + id).value = settings[k]; }
$('#saveSettings').addEventListener('click', () => {
  for (const [id, k] of Object.entries(SETTING_FIELDS)) settings[k] = $('#' + id).value.trim() || DEFAULT_SETTINGS[k];
  save(K.settings, settings); fillSettings();
  toast('Đã lưu thông tin cửa hàng');
});
$('#sApi').addEventListener('change', () => {
  settings.api = $('#sApi').value.trim() || DEFAULT_SETTINGS.api;
  save(K.settings, settings);
});
$('#syncBtn').addEventListener('click', () => syncProducts(true));

/* ================= Chuyển tab ================= */
const TITLES = { new: 'Tạo hóa đơn', history: 'Lịch sử hóa đơn', settings: 'Cài đặt' };
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + btn.dataset.tab));
  $('#title').textContent = TITLES[btn.dataset.tab];
  if (btn.dataset.tab === 'history') renderHistory();
  window.scrollTo(0, 0);
});

/* ================= Khởi động ================= */
fillDraftForm();
fillSettings();
renderDataInfo();
syncProducts(false);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
