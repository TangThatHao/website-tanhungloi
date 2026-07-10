(function () {
  const toggle = document.getElementById('adminSidebarToggle');
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('adminSidebarBackdrop');
  if (!toggle || !sidebar) return;

  function close() {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open');
  });
  if (backdrop) backdrop.addEventListener('click', close);
  sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
})();

(function () {
  const navToggle = document.getElementById('navToggle');
  const navCollapse = document.getElementById('navCollapse');
  if (navToggle && navCollapse) {
    navToggle.addEventListener('click', () => {
      const isOpen = navCollapse.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    navCollapse.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navCollapse.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();

(function () {
  const results = document.getElementById('productResults');
  const chips = document.getElementById('categoryChips');
  if (!results) return;

  function syncBreadcrumb(url) {
    const breadcrumb = document.getElementById('productsBreadcrumb');
    if (!breadcrumb) return;
    let extra = document.getElementById('breadcrumbExtra');
    const hasCategory = url.includes('category=');
    if (hasCategory) {
      const title = results.querySelector('.section-title');
      const text = title ? title.textContent : '';
      if (!extra) {
        extra = document.createElement('span');
        extra.id = 'breadcrumbExtra';
        breadcrumb.appendChild(document.createTextNode(' / '));
        breadcrumb.appendChild(extra);
      }
      extra.textContent = text;
    } else if (extra) {
      extra.previousSibling && extra.previousSibling.remove();
      extra.remove();
    }
  }

  async function loadCategory(url, pushState) {
    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } });
      if (!res.ok) throw new Error('bad response');
      results.innerHTML = await res.text();
      syncBreadcrumb(url);
      if (pushState) history.pushState({ productsUrl: url }, '', url);
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      window.location.href = url;
    }
  }

  function setActiveChip(url) {
    if (!chips) return;
    const links = chips.querySelectorAll('a');
    links.forEach((a) => a.classList.remove('active'));
    const target = Array.from(links).find((a) => a.getAttribute('href') === url) || links[0];
    if (target) target.classList.add('active');
  }

  document.querySelectorAll('#categoryChips a, .cat-list a').forEach((link) => {
    link.addEventListener('click', (e) => {
      const url = link.getAttribute('href');
      if (!url || !url.startsWith('/san-pham')) return;
      e.preventDefault();
      setActiveChip(url);
      loadCategory(url, true);
    });
  });

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.productsUrl) {
      setActiveChip(e.state.productsUrl);
      loadCategory(e.state.productsUrl, false);
    }
  });
})();

(function () {
  const slider = document.getElementById('topBanner');
  if (!slider) return;

  const track = slider.querySelector('.slides');
  const slides = track.children;
  const dots = slider.querySelectorAll('.banner-dots span');
  let current = 0;
  let timer = null;

  function goTo(i) {
    current = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      goTo(Number(dot.dataset.i));
      resetTimer();
    });
  });

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 4000);
  }

  resetTimer();
})();

(function () {
  const galleryEl = document.querySelector('.gallery[data-gallery]');
  const overlay = document.getElementById('lightboxOverlay');
  if (!galleryEl || !overlay) return;

  let images = [];
  try { images = JSON.parse(galleryEl.dataset.gallery) || []; } catch (e) { images = []; }
  if (!images.length) return;

  const viewport = overlay.querySelector('.lightbox-viewport');
  const img = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');
  const mainImg = document.getElementById('mainProductImage');
  const thumbs = Array.from(galleryEl.querySelectorAll('.gallery-thumb'));

  let index = 0;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startTx = 0;
  let startTy = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  function clampPan() {
    const maxX = (img.clientWidth * scale - img.clientWidth) / 2 + 40;
    const maxY = (img.clientHeight * scale - img.clientHeight) / 2 + 40;
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  function applyTransform() {
    clampPan();
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    viewport.classList.toggle('dragging', dragging);
  }

  function resetZoom() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function show(i) {
    index = (i + images.length) % images.length;
    img.src = images[index];
    resetZoom();
    counter.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : '';
    overlay.querySelectorAll('.lightbox-nav').forEach((b) => { b.style.display = images.length > 1 ? '' : 'none'; });
  }

  function open(i) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(i);
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (mainImg) mainImg.addEventListener('click', () => open(Number(mainImg.dataset.index) || 0));
  const zoomHint = galleryEl.querySelector('.gallery-zoom-hint');
  if (zoomHint) zoomHint.addEventListener('click', () => open(0));
  thumbs.forEach((t) => {
    t.addEventListener('click', () => {
      thumbs.forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      if (mainImg) mainImg.src = t.src;
      if (mainImg) mainImg.dataset.index = t.dataset.index;
    });
    t.addEventListener('dblclick', () => open(Number(t.dataset.index)));
  });

  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  overlay.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
  overlay.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });

  // Wheel zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
    applyTransform();
  }, { passive: false });

  // Double-click to toggle zoom
  img.addEventListener('dblclick', () => {
    scale = scale > 1 ? 1 : 2.5;
    tx = 0;
    ty = 0;
    applyTransform();
  });

  // Mouse drag to pan
  img.addEventListener('mousedown', (e) => {
    if (scale <= 1) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startTx = tx;
    startTy = ty;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    tx = startTx + (e.clientX - dragStartX);
    ty = startTy + (e.clientY - dragStartY);
    applyTransform();
  });
  window.addEventListener('mouseup', () => { dragging = false; applyTransform(); });

  // Touch: single-finger pan, two-finger pinch zoom
  function touchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      dragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      startTx = tx;
      startTy = ty;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = touchDist(e.touches);
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale * (dist / pinchStartDist)));
      applyTransform();
    } else if (e.touches.length === 1 && dragging) {
      e.preventDefault();
      tx = startTx + (e.touches[0].clientX - dragStartX);
      ty = startTy + (e.touches[0].clientY - dragStartY);
      applyTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', () => { dragging = false; });
})();
