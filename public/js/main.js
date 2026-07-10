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
