(function () {
  var saveUrl = window.__OI_SAVE_URL__;
  var redirectUrl = window.__OI_REDIRECT_URL__ || '/tai-khoan';
  var initialItems = window.__OI_ITEMS__ || [];
  var shippingFee = Number(window.__OI_SHIPPING_FEE__) || 0;

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
  var subtotalEl = document.getElementById('oiSubtotal');
  var shipDisplayEl = document.getElementById('oiShipDisplay');
  var grandTotalEl = document.getElementById('oiGrandTotal');
  var saveBtn = document.getElementById('oiSaveBtn');
  var statusEl = document.getElementById('saveStatus');

  var nameInput = document.getElementById('oiCustomerName');
  var phoneInput = document.getElementById('oiPhone');
  var emailInput = document.getElementById('oiEmail');
  var addressInput = document.getElementById('oiAddress');
  var noteInput = document.getElementById('oiNote');

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
    return {
      items: items,
      customer_name: nameInput.value,
      phone: phoneInput.value,
      email: emailInput.value,
      address: addressInput.value,
      note: noteInput.value
    };
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
    shipDisplayEl.textContent = shippingFee > 0 ? formatPrice(shippingFee) : 'Miễn phí';
    grandTotalEl.textContent = formatPrice(subtotal + shippingFee);
    updateDirty();
  }

  function updateDirty() {
    var current = JSON.stringify(getState());
    saveBtn.disabled = current === pristineSnapshot;
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
  [nameInput, phoneInput, emailInput, addressInput, noteInput].forEach(function (el) {
    el.addEventListener('input', updateDirty);
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

  initialItems.forEach(function (item) { body.appendChild(rowTemplate(item)); });
  recalc();
  pristineSnapshot = JSON.stringify(getState());
  updateDirty();

  saveBtn.addEventListener('click', function () {
    var state = getState();
    if (state.items.length === 0) {
      statusEl.textContent = 'Đơn hàng phải có ít nhất một sản phẩm.';
      return;
    }
    saveBtn.disabled = true;
    statusEl.textContent = 'Đang lưu...';
    fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');
          return data;
        });
      })
      .then(function () {
        statusEl.textContent = 'Đã lưu, đang quay lại...';
        window.location.href = redirectUrl;
      })
      .catch(function (err) {
        statusEl.textContent = 'Lỗi: ' + err.message;
        updateDirty();
      });
  });
})();
