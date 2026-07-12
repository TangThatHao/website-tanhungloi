(function () {
  var orderId = window.__PGH_ORDER_ID__;
  var wrapEl = document.getElementById('pghPreviewWrap');
  var scaleBoxEl = document.getElementById('pghScaleBox');
  var pageEl = document.getElementById('pghPage');
  var paperSizeSelect = document.getElementById('pghPaperSize');
  var statusEl = document.getElementById('pghStatus');
  var exportBtn = document.getElementById('pghExportPdf');

  function fitPreview() {
    pageEl.style.transform = 'none';
    var naturalW = pageEl.offsetWidth;
    var naturalH = pageEl.offsetHeight;
    var available = wrapEl.clientWidth - 48;
    var scale = Math.min(1, available / naturalW);
    pageEl.style.transformOrigin = 'top left';
    pageEl.style.transform = 'scale(' + scale + ')';
    scaleBoxEl.style.width = Math.round(naturalW * scale) + 'px';
    scaleBoxEl.style.height = Math.round(naturalH * scale) + 'px';
  }

  paperSizeSelect.addEventListener('change', function () {
    pageEl.classList.remove('pgh-a4', 'pgh-a5');
    pageEl.classList.add(paperSizeSelect.value === 'A5' ? 'pgh-a5' : 'pgh-a4');
    applySavedColumnWidths();
    fitPreview();
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitPreview, 150);
  });

  // ---------- Column resize ----------
  var itemsTable = document.getElementById('pghItemsTable');
  var COL_CLASSES = ['pgh-name-cell', 'pgh-qty', 'pgh-price', 'pgh-subtotal'];

  function widthsStorageKey() {
    return 'pgh-col-widths-' + (paperSizeSelect.value === 'A5' ? 'a5' : 'a4');
  }

  function resizableHeaderCells() {
    return itemsTable.querySelectorAll('thead th.pgh-resizable');
  }

  function columnClassOf(th) {
    for (var i = 0; i < COL_CLASSES.length; i++) {
      if (th.classList.contains(COL_CLASSES[i])) return COL_CLASSES[i];
    }
    return null;
  }

  function applySavedColumnWidths() {
    var saved;
    try {
      saved = JSON.parse(localStorage.getItem(widthsStorageKey()) || '{}');
    } catch (e) {
      saved = {};
    }
    resizableHeaderCells().forEach(function (th) {
      var col = columnClassOf(th);
      if (col && saved[col]) th.style.width = saved[col] + 'px';
    });
  }

  function saveColumnWidths() {
    var widths = {};
    resizableHeaderCells().forEach(function (th) {
      var col = columnClassOf(th);
      if (col) widths[col] = Math.round(th.getBoundingClientRect().width);
    });
    localStorage.setItem(widthsStorageKey(), JSON.stringify(widths));
  }

  function lockAllColumnWidths() {
    resizableHeaderCells().forEach(function (th) {
      th.style.width = th.getBoundingClientRect().width + 'px';
    });
  }

  function beginResize(handle, startX) {
    handle.classList.add('pgh-resizing');
    // Drag math needs real (unscaled) pixels, but the preview may currently
    // be shrunk to fit the window (see fitPreview) - disable that scaling
    // for the duration of the drag so mouse-delta math isn't distorted.
    pageEl.style.transform = 'none';
    lockAllColumnWidths();
    var th = handle.parentElement;
    var startW = th.getBoundingClientRect().width;
    return { th: th, startX: startX, startW: startW, handle: handle };
  }

  function updateResize(state, clientX) {
    var newW = Math.max(30, Math.round(state.startW + (clientX - state.startX)));
    state.th.style.width = newW + 'px';
  }

  function endResize(state) {
    state.handle.classList.remove('pgh-resizing');
    saveColumnWidths();
    fitPreview();
  }

  resizableHeaderCells().forEach(function (th) {
    var handle = th.querySelector('.pgh-resize-handle');
    if (!handle) return;
    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var state = beginResize(handle, e.clientX);
      function onMove(ev) { updateResize(state, ev.clientX); }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        endResize(state);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    handle.addEventListener('touchstart', function (e) {
      var state = beginResize(handle, e.touches[0].clientX);
      function onMove(ev) { updateResize(state, ev.touches[0].clientX); }
      function onEnd() {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        endResize(state);
      }
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('touchend', onEnd);
    }, { passive: true });
  });

  applySavedColumnWidths();
  fitPreview();

  var PAPER_MM = { A4: [210, 297], A5: [148, 210] };

  async function exportPdf() {
    exportBtn.disabled = true;
    statusEl.textContent = 'Đang tạo PDF...';
    pageEl.classList.add('pgh-capturing');
    var prevTransform = pageEl.style.transform;
    pageEl.style.transform = 'none';
    try {
      var canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      var jsPDF = window.jspdf.jsPDF;
      var size = paperSizeSelect.value === 'A5' ? 'A5' : 'A4';
      var dims = PAPER_MM[size];
      var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: size.toLowerCase() });
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, dims[0], dims[1]);
      var fileName = 'phieu-giao-hang-don-' + orderId + '.pdf';
      var blob = pdf.output('blob');
      var file = new File([blob], fileName, { type: 'application/pdf' });

      var shared = false;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName, text: 'Phiếu giao hàng đơn #' + orderId });
          shared = true;
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') {
            statusEl.textContent = 'Đã hủy chia sẻ.';
            return;
          }
        }
      }

      if (shared) {
        statusEl.textContent = 'Đã chia sẻ phiếu giao hàng.';
      } else {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        statusEl.textContent = 'Đã tải PDF về máy (thiết bị này chưa hỗ trợ chia sẻ trực tiếp) - gửi file vừa tải cho khách qua Zalo giúp mình nhé.';
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Có lỗi khi tạo PDF: ' + err.message;
    } finally {
      pageEl.classList.remove('pgh-capturing');
      pageEl.style.transform = prevTransform;
      exportBtn.disabled = false;
    }
  }

  exportBtn.addEventListener('click', exportPdf);
})();
