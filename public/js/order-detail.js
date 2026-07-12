(function () {
  var orderId = window.__OI_ORDER_ID__;
  var initialItems = window.__OI_ITEMS__ || [];
  var initialShippingFee = Number(window.__OI_SHIPPING_FEE__) || 0;

  function formatPrice(n) {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  }
  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var body = document.getElementById('oiBody');
  var picker = document.getElementById('oiProductPicker');
  var addBtn = document.getElementById('oiAddProduct');
  var freeShipCheckbox = document.getElementById('oiFreeShip');
  var shippingFeeInput = document.getElementById('oiShippingFee');
  var subtotalEl = document.getElementById('oiSubtotal');
  var shipDisplayEl = document.getElementById('oiShipDisplay');
  var grandTotalEl = document.getElementById('oiGrandTotal');
  var saveBtn = document.getElementById('oiSaveBtn');
  var exportLink = document.getElementById('oiExportLink');
  var statusEl = document.getElementById('saveStatus');

  var pristineSnapshot = null;

  function rowTemplate(item) {
    var tr = document.createElement('tr');
    tr.dataset.productId = item.product_id || '';
    tr.innerHTML =
      '<td class="oi-name">' + escapeAttr(item.product_name || '') + '</td>' +
      '<td class="oi-num"><input type="number" class="oi-input oi-price" min="0" step="1000" value="' + Number(item.price || 0) + '"></td>' +
      '<td class="oi-num"><input type="number" class="oi-input oi-qty" min="1" step="1" value="' + Number(item.qty || 1) + '"></td>' +
      '<td class="oi-num oi-subtotal"></td>' +
      '<td><button type="button" class="oi-remove-row" title="Xóa">✕</button></td>';
    return tr;
  }

  function addRow(item) {
    body.appendChild(rowTemplate(item));
    recalc();
  }

  function getState() {
    var items = Array.prototype.map.call(body.children, function (tr) {
      return {
        product_id: tr.dataset.productId ? Number(tr.dataset.productId) : null,
        product_name: tr.querySelector('.oi-name').textContent,
        price: Number(tr.querySelector('.oi-price').value) || 0,
        qty: Number(tr.querySelector('.oi-qty').value) || 1
      };
    });
    var shippingFee = freeShipCheckbox.checked ? 0 : (Number(shippingFeeInput.value) || 0);
    return { items: items, shippingFee: shippingFee };
  }

  function recalc() {
    var state = getState();
    var subtotal = state.items.reduce(function (sum, it) { return sum + it.price * it.qty; }, 0);
    Array.prototype.forEach.call(body.children, function (tr) {
      var price = Number(tr.querySelector('.oi-price').value) || 0;
      var qty = Number(tr.querySelector('.oi-qty').value) || 0;
      tr.querySelector('.oi-subtotal').textContent = formatPrice(price * qty);
    });
    subtotalEl.textContent = formatPrice(subtotal);
    shipDisplayEl.textContent = state.shippingFee > 0 ? formatPrice(state.shippingFee) : 'Miễn phí';
    grandTotalEl.textContent = formatPrice(subtotal + state.shippingFee);
    updateDirty();
  }

  function updateDirty() {
    var current = JSON.stringify(getState());
    var dirty = current !== pristineSnapshot;
    saveBtn.disabled = !dirty;
    if (dirty) {
      exportLink.style.display = 'none';
    } else {
      exportLink.style.display = '';
    }
  }

  body.addEventListener('input', function (e) {
    if (e.target.classList.contains('oi-input')) recalc();
  });
  body.addEventListener('click', function (e) {
    if (e.target.classList.contains('oi-remove-row')) {
      e.target.closest('tr').remove();
      recalc();
    }
  });

  addBtn.addEventListener('click', function () {
    var opt = picker.options[picker.selectedIndex];
    if (!opt || !opt.value) return;
    addRow({
      product_id: Number(opt.value),
      product_name: opt.dataset.name,
      price: Number(opt.dataset.price) || 0,
      qty: 1
    });
    picker.value = '';
  });

  freeShipCheckbox.addEventListener('change', function () {
    shippingFeeInput.disabled = freeShipCheckbox.checked;
    if (freeShipCheckbox.checked) shippingFeeInput.value = 0;
    recalc();
  });
  shippingFeeInput.addEventListener('input', recalc);

  initialItems.forEach(function (item) { body.appendChild(rowTemplate(item)); });
  if (initialShippingFee > 0) {
    shippingFeeInput.value = initialShippingFee;
  } else {
    freeShipCheckbox.checked = true;
    shippingFeeInput.disabled = true;
    shippingFeeInput.value = 0;
  }
  recalc();
  pristineSnapshot = JSON.stringify(getState());
  updateDirty();

  saveBtn.addEventListener('click', function () {
    var state = getState();
    saveBtn.disabled = true;
    statusEl.textContent = 'Đang lưu...';
    fetch('/admin/don-hang/' + orderId + '/luu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: state.items, shipping_fee: state.shippingFee })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Lưu thất bại (HTTP ' + res.status + ')');
        return res.json();
      })
      .then(function () {
        pristineSnapshot = JSON.stringify(getState());
        updateDirty();
        statusEl.textContent = 'Đã lưu.';
      })
      .catch(function (err) {
        statusEl.textContent = 'Lỗi: ' + err.message;
        updateDirty();
      });
  });
})();
