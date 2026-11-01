'use strict';

/* ================= Lưu trữ trên máy ================= */
const K = {
  products: 'thl.products', settings: 'thl.settings', invoices: 'thl.invoices', draft: 'thl.draft',
  customers: 'thl.customers', auth: 'thl.auth', outbox: 'thl.outbox'
};
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Không lưu được dữ liệu: ' + e.message); } };

const DEFAULT_SETTINGS = {
  name: 'TÂN HƯNG LỢI',
  slogan: 'Đặc sản bánh pía Sóc Trăng',
  addr: 'Sóc Trăng: 122 Lý Thường Kiệt, TP Sóc Trăng\nSài Gòn: 418/45 Hồng Bàng, P. Minh Phụng, TP.HCM',
  phone: '0919 454 484',
  thanks: 'Cảm ơn quý khách! Hẹn gặp lại.',
  bankBin: '', bankAcc: '', bankOwner: '',
  paper: '58',
  api: 'https://banhpiasoctrang.onrender.com'
};
let settings = { ...DEFAULT_SETTINGS, ...load(K.settings, {}) };
let catalog = load(K.products, null);          // { updatedAt, products: [...] }
let invoices = load(K.invoices, []);
invoices.forEach((v) => { v.id = v.id || v.no; });   // hóa đơn cũ chưa có id riêng
let customers = load(K.customers, []);         // [{ id, name, phone, addr, note, createdAt }]
const emptyDraft = () => ({ name: '', phone: '', addr: '', lines: [], ship: 0, discount: 0, paid: 0, note: '', qr: true });
let draft = { ...emptyDraft(), ...load(K.draft, {}) };

/* ================= Tiện ích ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('vi-VN');
const parseMoney = (s) => +String(s).replace(/\D/g, '') || 0;
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const pad = (n) => String(n).padStart(2, '0');
const digits = (s) => String(s || '').replace(/\D/g, '');
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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
  $('#printQR').checked = draft.qr !== false;
  renderQrRow();
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
  $('#' + id).addEventListener('input', (e) => {
    draft[key] = e.target.value; saveDraft();
    if (key === 'name' || key === 'phone') renderSuggest(e.target.value);
  });
}

/* --- Gợi ý khách cũ khi gõ tên hoặc số điện thoại --- */
function renderSuggest(q) {
  const box = $('#cusSuggest');
  const nq = norm(q.trim()), dq = digits(q);
  const list = nq.length < 2 ? [] : customers.filter((c) =>
    norm(c.name).includes(nq) || (dq.length >= 3 && digits(c.phone).includes(dq))).slice(0, 5);
  // Đã chọn đúng khách rồi thì thôi không gợi ý nữa
  if (list.length === 1 && list[0].name === draft.name && list[0].phone === draft.phone) list.length = 0;
  box.hidden = !list.length;
  box.innerHTML = list.map((c) => `<button data-id="${c.id}">👤 <b>${esc(c.name || 'Không tên')}</b>
    <small>${esc(c.phone)}${c.addr ? ' · ' + esc(c.addr) : ''}</small></button>`).join('');
}
$('#cusSuggest').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  const c = btn && customers.find((x) => x.id === btn.dataset.id);
  if (!c) return;
  fillCustomer(c);
  $('#cusSuggest').hidden = true;
});
function fillCustomer(c) {
  Object.assign(draft, { name: c.name, phone: c.phone, addr: c.addr });
  saveDraft();
  $('#cusName').value = c.name; $('#cusPhone').value = c.phone; $('#cusAddr').value = c.addr;
}
// Chạm ra ngoài thì ẩn gợi ý
document.addEventListener('click', (e) => {
  if (!e.target.closest('#cusSuggest, #cusName, #cusPhone')) $('#cusSuggest').hidden = true;
});
// Ô tick in mã QR chuyển khoản: chỉ hiện khi đã nhập tài khoản ngân hàng trong Cài đặt
function renderQrRow() { $('#qrRow').hidden = !(settings.bankBin && settings.bankAcc); }
$('#printQR').addEventListener('change', (e) => { draft.qr = e.target.checked; saveDraft(); });

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
    id: newId(), no: nextInvoiceNo(now), date: now.toISOString(),
    name: draft.name.trim(), phone: draft.phone.trim(), addr: draft.addr.trim(), note: draft.note.trim(),
    lines: lines.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
    ship: draft.ship, discount: draft.discount, paid: draft.paid, qr: draft.qr !== false
  };
  Object.assign(inv, calc(inv));
  inv.customerId = upsertCustomer(inv);
  invoices.unshift(inv);
  save(K.invoices, invoices);
  queuePut('invoices', inv);
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

/* ================= Khách hàng ================= */
const saveCustomers = () => save(K.customers, customers);

// Tìm khách trùng: ưu tiên theo số điện thoại, không có SĐT thì theo tên
function matchCustomer({ name, phone }) {
  const p = digits(phone);
  if (p) return customers.find((c) => digits(c.phone) === p);
  const n = norm(name || '').trim();
  return n ? customers.find((c) => !digits(c.phone) && norm(c.name).trim() === n) : undefined;
}

// Sau mỗi hóa đơn: thêm khách mới hoặc cập nhật thông tin khách cũ. Trả về id khách.
function upsertCustomer({ name, phone, addr }) {
  if (!name && !phone) return null;
  let c = matchCustomer({ name, phone });
  if (c) {
    if (name) c.name = name;
    if (phone) c.phone = phone;
    if (addr) c.addr = addr;
  } else {
    c = { id: newId(), name, phone, addr, note: '', createdAt: new Date().toISOString() };
    customers.push(c);
  }
  saveCustomers();
  queuePut('customers', c);
  return c.id;
}

function invoicesOf(c) {
  const p = digits(c.phone);
  return invoices.filter((v) => v.customerId === c.id || (!v.customerId && p && digits(v.phone) === p));
}

function renderCustomers() {
  const q = norm($('#cusSearch').value.trim()), dq = digits($('#cusSearch').value);
  const rows = customers.map((c) => {
    const invs = invoicesOf(c);
    return { c, count: invs.length, spent: invs.reduce((s, v) => s + v.total, 0), last: invs[0]?.date || c.createdAt };
  }).filter(({ c }) => !q || norm(c.name).includes(q) || (dq.length >= 3 && digits(c.phone).includes(dq)))
    .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  $('#cusSummary').textContent = `${customers.length} khách hàng`;
  $('#cusList').innerHTML = rows.length ? rows.map(({ c, count, spent }) => `
    <div class="citem" data-id="${c.id}">
      <div class="av">${esc((c.name || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase())}</div>
      <div class="ci"><div class="cn">${esc(c.name || 'Không tên')}</div><div class="cs">${esc(c.phone || 'Chưa có SĐT')}</div></div>
      <div class="cm">${count ? `<b>${fmt(spent)} đ</b>${count} lần mua` : 'Chưa mua'}</div>
    </div>`).join('')
    : `<div class="empty">${customers.length ? 'Không tìm thấy khách' : 'Chưa có khách hàng nào.<br>Khách sẽ tự được lưu khi xuất hóa đơn.'}</div>`;
}
$('#cusSearch').addEventListener('input', renderCustomers);
$('#cusList').addEventListener('click', (e) => {
  const item = e.target.closest('.citem');
  const c = item && customers.find((x) => x.id === item.dataset.id);
  if (c) openCustomer(c);
});
$('#addCustomer').addEventListener('click', () => openCustomer(null));

let editingCus = null;
function openCustomer(c) {
  editingCus = c;
  $('#cusSheetTitle').textContent = c ? 'Khách hàng' : 'Thêm khách mới';
  $('#cName').value = c?.name || ''; $('#cPhone').value = c?.phone || '';
  $('#cAddr').value = c?.addr || ''; $('#cNote').value = c?.note || '';
  $('#cusActions').hidden = !c; $('#delCus').hidden = !c;
  $('#callCus').hidden = !c?.phone;
  if (c?.phone) $('#callCus').href = 'tel:' + digits(c.phone);
  const invs = c ? invoicesOf(c) : [];
  $('#cusStats').textContent = invs.length
    ? `Đã mua ${invs.length} lần · tổng ${fmt(invs.reduce((s, v) => s + v.total, 0))} đ` : '';
  $('#cusInvoices').innerHTML = invs.map(historyItem).join('');
  $('#cusSheet').hidden = false;
  if (!c) $('#cName').focus();
}
$('#closeCus').addEventListener('click', () => { $('#cusSheet').hidden = true; renderCustomers(); });
$('#saveCus').addEventListener('click', () => {
  const data = { name: $('#cName').value.trim(), phone: $('#cPhone').value.trim(), addr: $('#cAddr').value.trim(), note: $('#cNote').value.trim() };
  if (!data.name && !data.phone) return toast('Nhập tên hoặc số điện thoại');
  const dup = data.phone && customers.find((x) => x !== editingCus && digits(x.phone) === digits(data.phone));
  if (dup) return toast(`Số này đã có trong danh sách: ${dup.name}`, 3500);
  let c = editingCus;
  if (c) Object.assign(c, data);
  else customers.push(c = { id: newId(), ...data, createdAt: new Date().toISOString() });
  saveCustomers();
  queuePut('customers', c);
  $('#cusSheet').hidden = true; renderCustomers();
  toast('Đã lưu khách hàng');
});
$('#delCus').addEventListener('click', () => {
  if (!editingCus || !confirm(`Xóa khách "${editingCus.name}"? (Hóa đơn cũ vẫn giữ lại)`)) return;
  customers = customers.filter((x) => x !== editingCus);
  saveCustomers();
  queueDel('customers', editingCus.id);
  $('#cusSheet').hidden = true; renderCustomers();
});
$('#sellCus').addEventListener('click', () => {
  fillCustomer(editingCus);
  $('#cusSheet').hidden = true;
  switchTab('new');
});
$('#cusInvoices').addEventListener('click', (e) => {
  const item = e.target.closest('.hitem');
  const inv = item && invoices.find((v) => v.no === item.dataset.no);
  if (inv) openInvoice(inv);
});

/* --- Nhập danh sách khách từ Excel (dán) hoặc file .txt/.csv --- */
// Đổi đầu số di động 11 số cũ sang 10 số (quy định chuyển đổi năm 2018)
const OLD_MOBILE = {
  '0120': '070', '0121': '079', '0122': '077', '0126': '076', '0128': '078', '0123': '083', '0124': '084',
  '0125': '085', '0127': '081', '0129': '082', '0162': '032', '0163': '033', '0164': '034', '0165': '035',
  '0166': '036', '0167': '037', '0168': '038', '0169': '039', '0186': '056', '0188': '058', '0199': '059'
};
function fixPhone(p) {
  const d = digits(p);
  if (d.length === 11 && OLD_MOBILE[d.slice(0, 4)]) {
    return (OLD_MOBILE[d.slice(0, 4)] + d.slice(4)).replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  return String(p || '').trim().replace(/\s+/g, ' ');
}
const looksPhone = (s) => /^[\d\s.()+-]+$/.test(s.trim()) && digits(s).length >= 9;
// Tách 1 dòng CSV có ngoặc kép (Excel lưu .csv sẽ bọc ô có dấu phẩy trong "...")
function csvCells(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCustomerList(text) {
  const list = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cells = (raw.includes('\t') ? raw.split('\t') : csvCells(raw)).map((c) => c.trim());
    const pi = cells.map(looksPhone).lastIndexOf(true);
    const phone = pi >= 0 ? fixPhone(cells[pi]) : '';
    const rest = cells.filter((c, i) => i !== pi && c);
    const name = (rest[0] || '').replace(/\s+/g, ' ');
    const addr = rest.slice(1).join(', ').replace(/\s+/g, ' ');
    if (/^(t[eê]n|ho ten|họ tên)$/i.test(name) && !phone) continue;   // dòng tiêu đề
    if (!name && !phone) continue;
    list.push({ name, phone, addr });
  }
  return list;
}
const cusKey = (c) => digits(c.phone) + '|' + norm(c.name).replace(/\s+/g, ' ').trim();
let importRows = [];
function previewImport() {
  const have = new Set(customers.map(cusKey)), seen = new Set();
  importRows = parseCustomerList($('#importText').value).map((c) => {
    const k = cusKey(c), dup = have.has(k) || seen.has(k);
    seen.add(k);
    return { ...c, dup };
  });
  const fresh = importRows.filter((r) => !r.dup).length;
  $('#doImport').disabled = !fresh;
  $('#importPreview').innerHTML = importRows.length ? `
    <div>Đọc được <b>${importRows.length}</b> khách: <span class="ok">${fresh} khách mới</span>${importRows.length - fresh ? `, ${importRows.length - fresh} đã có (bỏ qua)` : ''}.</div>
    <table>${importRows.map((r) => `<tr class="${r.dup ? 'dup' : ''}"><td><b>${esc(r.name || '(không tên)')}</b><br>${esc(r.addr)}</td>
      <td style="white-space:nowrap">${esc(r.phone || '—')}${r.dup ? '<br><i>đã có</i>' : ''}</td></tr>`).join('')}</table>` : '';
}
$('#importCus').addEventListener('click', () => {
  $('#importText').value = ''; previewImport();
  $('#importSheet').hidden = false;
});
$('#closeImport').addEventListener('click', () => { $('#importSheet').hidden = true; });
$('#importText').addEventListener('input', previewImport);
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  $('#importText').value = await f.text();
  e.target.value = '';
  previewImport();
});
$('#doImport').addEventListener('click', () => {
  const now = new Date().toISOString();
  const add = importRows.filter((r) => !r.dup);
  for (const r of add) {
    const c = { id: newId(), name: r.name, phone: r.phone, addr: r.addr, note: '', createdAt: now };
    customers.push(c);
    queuePut('customers', c);
  }
  saveCustomers();
  $('#importSheet').hidden = true;
  renderCustomers();
  toast(`Đã thêm ${add.length} khách hàng`);
});

/* ================= Hóa đơn ================= */
let viewing = null, receiptCanvas = null;
async function openInvoice(inv) {
  viewing = inv;
  $('#receiptImg').removeAttribute('src');
  $('#viewer').hidden = false;
  $('#viewer .paper-wrap').scrollTop = 0;
  receiptCanvas = await renderReceipt(inv, settings, fmt, moneyToWords);
  $('#receiptImg').src = receiptCanvas.toDataURL('image/png');
}
$('#closeViewer').addEventListener('click', () => { $('#viewer').hidden = true; renderHistory(); });

// Mở bảng chia sẻ của iPhone với ảnh hóa đơn (Zalo, Messenger, app máy in, Lưu ảnh...)
async function shareReceipt() {
  const blob = await new Promise((r) => receiptCanvas.toBlob(r, 'image/png'));
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
}
async function busy(btn, label, fn) {
  if (!receiptCanvas) return;
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { await fn(); } catch (e) {
    if (e.name !== 'AbortError' && e.name !== 'NotFoundError') toast('Lỗi: ' + e.message, 4000);
  } finally { btn.disabled = false; btn.textContent = old; }
}
$('#shareBtn').addEventListener('click', () => busy($('#shareBtn'), 'Đang tạo…', shareReceipt));
$('#printBtn').addEventListener('click', () => busy($('#printBtn'), 'Đang in…', async () => {
  if (btSupported()) {
    await btPrint(receiptCanvas, (p) => { $('#printBtn').textContent = `Đang in ${p}%`; });
    toast('Đã gửi lệnh in ✓');
    renderBtStatus();
  } else {
    // Safari iPhone không có Bluetooth cho web -> gửi ảnh sang app của máy in
    toast('Chọn app máy in trong danh sách để in', 3500);
    await shareReceipt();
  }
}));

function historyItem(v) {
  const d = new Date(v.date);
  return `<div class="hitem" data-no="${esc(v.no)}">
    <div class="top"><span>${esc(v.name || 'Khách lẻ')}</span><b>${fmt(v.total)} đ</b></div>
    <div class="sub">${esc(v.no)} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}
      · ${v.lines.reduce((s, l) => s + l.qty, 0)} món${v.phone ? ' · ' + esc(v.phone) : ''}</div>
  </div>`;
}

/* ================= Lịch sử ================= */
function renderHistory() {
  const q = norm($('#histSearch').value.trim());
  const list = invoices.filter((v) => !q || norm(`${v.no} ${v.name} ${v.phone}`).includes(q));
  const today = new Date().toDateString();
  const todays = invoices.filter((v) => new Date(v.date).toDateString() === today);
  $('#histSummary').textContent = `Hôm nay: ${todays.length} hóa đơn · ${fmt(todays.reduce((s, v) => s + v.total, 0))} đ`;
  $('#histList').innerHTML = list.length ? list.map(historyItem).join('') : '<div class="empty">Chưa có hóa đơn nào</div>';
}
$('#histSearch').addEventListener('input', renderHistory);
$('#histList').addEventListener('click', (e) => {
  const item = e.target.closest('.hitem');
  const inv = item && invoices.find((v) => v.no === item.dataset.no);
  if (inv) openInvoice(inv);
});

/* ================= Cài đặt ================= */
const SETTING_FIELDS = {
  sName: 'name', sSlogan: 'slogan', sAddr: 'addr', sPhone: 'phone', sThanks: 'thanks',
  sBankBin: 'bankBin', sBankAcc: 'bankAcc', sBankOwner: 'bankOwner', sPaper: 'paper', sApi: 'api'
};
$('#sBankBin').innerHTML = '<option value="">— Chọn ngân hàng —</option>'
  + BANKS.map(([bin, name]) => `<option value="${bin}">${esc(name)}</option>`).join('');
function fillSettings() {
  for (const [id, k] of Object.entries(SETTING_FIELDS)) $('#' + id).value = settings[k];
}
$('#saveSettings').addEventListener('click', () => {
  for (const [id, k] of Object.entries(SETTING_FIELDS)) settings[k] = $('#' + id).value.trim() || DEFAULT_SETTINGS[k];
  settings.bankAcc = settings.bankAcc.replace(/\s/g, '');
  if (settings.bankAcc && !settings.bankBin) return toast('Chọn ngân hàng cho số tài khoản');
  save(K.settings, settings); fillSettings(); renderQrRow();
  queueSettings();
  toast('Đã lưu cài đặt');
});
$('#sApi').addEventListener('change', () => {
  settings.api = $('#sApi').value.trim() || DEFAULT_SETTINGS.api;
  save(K.settings, settings);
});
$('#syncBtn').addEventListener('click', () => syncProducts(true));

// Máy in Bluetooth: chỉ hiện nút kết nối khi trình duyệt hỗ trợ (Bluefy, Chrome Android...)
function renderBtStatus() {
  $('#btBox').hidden = !btSupported();
  $('#btHelp').hidden = btSupported();
  $('#btStatus').textContent = bt.ch && bt.device.gatt.connected
    ? '✓ Đã kết nối: ' + (bt.device.name || 'Máy in') : 'Chưa kết nối. Khi bấm In, app sẽ hỏi chọn máy in.';
}
$('#btConnect').addEventListener('click', async () => {
  try { const name = await btConnect(); toast('Đã kết nối ' + name); } catch (e) {
    if (e.name !== 'NotFoundError') toast('Không kết nối được: ' + e.message, 4000);
  }
  renderBtStatus();
});

// Hóa đơn mẫu để thử máy in, mã QR (không lưu vào lịch sử)
$('#testPrint').addEventListener('click', () => {
  const sample = {
    no: 'HD-MAU', date: new Date().toISOString(), name: 'Khách in thử', phone: '0900 000 000', addr: '', note: '',
    lines: [{ name: 'Pía đậu sầu riêng 500gram', price: 70000, qty: 2 }, { name: 'Bánh in nhân (500gram)', price: 50000, qty: 1 }],
    ship: 0, discount: 0, paid: 0
  };
  Object.assign(sample, calc(sample));
  openInvoice(sample);
});

/* ================= Sao lưu online (khách, hóa đơn, cài đặt) ================= */
// Dữ liệu vẫn lưu trên máy để dùng khi mất mạng; mỗi thay đổi được xếp vào "hộp thư đi"
// (outbox) rồi gửi lên website khi có mạng. Khi mở app thì tải bản mới nhất về.
let auth = load(K.auth, null);                 // { token, name, lastSync }
const emptyOutbox = () => ({ customers: { put: {}, del: [] }, invoices: { put: {}, del: [] }, settings: null });
let outbox = { ...emptyOutbox(), ...load(K.outbox, {}) };
const saveOutbox = () => save(K.outbox, outbox);
const outboxCount = () => ['customers', 'invoices'].reduce((n, k) =>
  n + Object.keys(outbox[k].put).length + outbox[k].del.length, 0) + (outbox.settings ? 1 : 0);
const cloudSettings = () => { const { api, ...rest } = settings; return rest; };   // địa chỉ website giữ riêng từng máy

// Chưa đăng nhập thì khỏi xếp hàng: lúc đăng nhập app gửi toàn bộ dữ liệu trên máy lên
function queuePut(kind, item) {
  if (!auth) return;
  outbox[kind].put[item.id] = item;
  outbox[kind].del = outbox[kind].del.filter((id) => id !== item.id);
  saveOutbox(); scheduleSync();
}
function queueDel(kind, id) {
  if (!auth) return;
  delete outbox[kind].put[id];
  if (!outbox[kind].del.includes(id)) outbox[kind].del.push(id);
  saveOutbox(); scheduleSync();
}
function queueSettings() { if (!auth) return; outbox.settings = cloudSettings(); saveOutbox(); scheduleSync(); }

const apiBase = () => settings.api.replace(/\/$/, '');
async function posApi(path, body) {
  const res = await fetch(apiBase() + '/api/pos/' + path, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth && path !== 'dang-nhap') {
    auth = null; save(K.auth, null); renderCloud();
    toast('Phiên đăng nhập sao lưu đã hết, vào Cài đặt để đăng nhập lại', 4000);
  }
  if (!res.ok) throw new Error(data.error || 'Lỗi máy chủ (' + res.status + ')');
  return data;
}

let syncTimer = null, syncing = false, lastPull = 0, cloudMsg = '';
function scheduleSync(ms = 1500) {
  if (!auth) { renderCloud(); return; }
  clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms);
}

// Gộp dữ liệu website với các thay đổi trên máy chưa gửi được
function applyServer(data) {
  const merge = (list, kind) => {
    const map = new Map(list.map((x) => [x.id, x]));
    for (const [id, x] of Object.entries(outbox[kind].put)) map.set(id, x);
    for (const id of outbox[kind].del) map.delete(id);
    return [...map.values()];
  };
  customers = merge(data.customers || [], 'customers');
  invoices = merge(data.invoices || [], 'invoices').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (data.settings && !outbox.settings) settings = { ...DEFAULT_SETTINGS, ...data.settings, api: settings.api };
  save(K.customers, customers); save(K.invoices, invoices); save(K.settings, settings);
  fillSettings(); renderQrRow(); renderCustomers(); renderHistory();
}

async function syncNow() {
  if (!auth || syncing) return;
  syncing = true; cloudMsg = 'Đang đồng bộ…'; renderCloud();
  let failed = false;
  try {
    if (outboxCount()) {
      const sending = outbox;
      outbox = emptyOutbox(); saveOutbox();
      try {
        await posApi('dong-bo', {
          customers: { put: Object.values(sending.customers.put), del: sending.customers.del },
          invoices: { put: Object.values(sending.invoices.put), del: sending.invoices.del },
          settings: sending.settings
        });
      } catch (e) {
        // Gửi lỗi -> trả lại hộp thư đi (không đè lên thay đổi mới hơn vừa xếp vào)
        for (const k of ['customers', 'invoices']) {
          outbox[k].put = { ...sending[k].put, ...outbox[k].put };
          outbox[k].del = [...new Set([...sending[k].del, ...outbox[k].del])];
        }
        outbox.settings = outbox.settings || sending.settings;
        saveOutbox();
        throw e;
      }
    }
    applyServer(await posApi('du-lieu'));
    lastPull = Date.now();
    auth.lastSync = new Date().toISOString(); save(K.auth, auth);
    cloudMsg = '';
  } catch (e) {
    failed = true;
    cloudMsg = navigator.onLine ? 'Chưa đồng bộ được: ' + e.message : 'Đang mất mạng – sẽ tự gửi khi có mạng';
  } finally {
    syncing = false; renderCloud();
    if (!failed && outboxCount()) scheduleSync(500);   // có thay đổi mới trong lúc đang gửi
  }
}

function renderCloud() {
  const on = !!auth, pending = outboxCount();
  $('#cloudOut').hidden = on; $('#cloudIn').hidden = !on;
  document.querySelectorAll('.cloud-warn').forEach((el) => { el.hidden = on; });
  $('#cloudStatus').textContent = !on ? '' : syncing ? '☁ …' : pending ? `☁ chờ gửi ${pending}` : '☁ ✓';
  if (on) {
    const t = auth.lastSync ? new Date(auth.lastSync).toLocaleString('vi-VN') : 'chưa';
    $('#cloudInfo').innerHTML = `✓ Đã đăng nhập: <b>${esc(auth.name)}</b><br>Đồng bộ lần cuối: ${t}`
      + (pending ? `<br>Còn <b>${pending}</b> thay đổi chờ gửi lên` : '')
      + (cloudMsg ? `<br><span class="muted">${esc(cloudMsg)}</span>` : '');
  }
}

$('#lgBtn').addEventListener('click', async () => {
  const user = $('#lgUser').value.trim(), pass = $('#lgPass').value;
  if (!user || !pass) return toast('Nhập tài khoản và mật khẩu');
  const btn = $('#lgBtn');
  btn.disabled = true; btn.textContent = 'Đang đăng nhập… (website có thể mất ~1 phút để thức dậy)';
  try {
    const r = await posApi('dang-nhap', { tai_khoan: user, password: pass });
    auth = { token: r.token, name: r.name }; save(K.auth, auth);
    $('#lgPass').value = '';
    // Lần đầu đăng nhập trên máy này: gửi dữ liệu đang có lên. Khách đã có trên website
    // (trùng tên + SĐT) thì dùng bản trên website, không tạo trùng.
    const server = await posApi('du-lieu');
    const byKey = new Map((server.customers || []).map((c) => [cusKey(c), c.id]));
    const remap = {};
    for (const c of customers) {
      const sid = byKey.get(cusKey(c));
      if (sid && sid !== c.id) remap[c.id] = sid; else outbox.customers.put[c.id] = c;
    }
    for (const v of invoices) {
      if (remap[v.customerId]) v.customerId = remap[v.customerId];
      outbox.invoices.put[v.id] = v;
    }
    customers = customers.filter((c) => !remap[c.id]);
    if (!server.settings) outbox.settings = cloudSettings();
    saveOutbox();
    await syncNow();
    toast('Đã bật sao lưu online ✓');
  } catch (e) {
    toast(e.message, 4000);
  } finally {
    btn.disabled = false; btn.textContent = 'Đăng nhập';
    renderCloud();
  }
});
$('#syncNowBtn').addEventListener('click', () => syncNow());
$('#logoutBtn').addEventListener('click', async () => {
  const pending = outboxCount();
  if (!confirm(pending ? `Còn ${pending} thay đổi CHƯA gửi lên website, đăng xuất sẽ không gửi nữa. Vẫn đăng xuất?`
    : 'Đăng xuất sao lưu online? Dữ liệu trên máy vẫn giữ nguyên.')) return;
  try { await posApi('dang-xuat', {}); } catch { /* vẫn đăng xuất trên máy */ }
  auth = null; save(K.auth, null);
  outbox = emptyOutbox(); saveOutbox();
  renderCloud();
});
document.querySelectorAll('.cloud-warn').forEach((el) => el.addEventListener('click', () => {
  switchTab('settings'); $('#cloudCard').scrollIntoView({ block: 'start' });
}));
window.addEventListener('online', () => scheduleSync(500));
// Mở lại app (từ nền) thì tải dữ liệu mới, tối đa 1 lần / 30 giây
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastPull > 30000) scheduleSync(300);
});

/* ================= Chuyển tab ================= */
const TITLES = { new: 'Tạo hóa đơn', customers: 'Khách hàng', history: 'Lịch sử hóa đơn', settings: 'Cài đặt' };
function switchTab(tab) {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + tab));
  $('#title').textContent = TITLES[tab];
  if (tab === 'history') renderHistory();
  if (tab === 'customers') renderCustomers();
  if (tab === 'settings') { renderBtStatus(); renderCloud(); }
  window.scrollTo(0, 0);
}
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) switchTab(btn.dataset.tab);
});

/* ================= Khởi động ================= */
fillDraftForm();
fillSettings();
renderDataInfo();
syncProducts(false);
renderCloud();
if (auth) syncNow();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // Có bản app mới (sw.js đổi VERSION) thì tự tải lại để dùng ngay, không phải mở app 2 lần
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
