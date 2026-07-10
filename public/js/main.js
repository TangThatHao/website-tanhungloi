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
