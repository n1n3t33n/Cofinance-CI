/* ============================================================
   COFINANCE CI - animations.js
   Couche d'effets vivants (additif, sans toucher à cofinance.js) :
   reveal au scroll, parallax, projecteur, magnétisme, accordéon,
   barre de progression, retour en haut, marquee sans couture.
   ============================================================ */

'use strict';

(function () {

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------
     1. Reveal au scroll — [data-reveal] avec stagger
     -------------------------------------------------------- */
  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    if (reduceMotion) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el    = entry.target;
        const delay = parseFloat(el.dataset.revealDelay || '0');
        if (delay) el.style.transitionDelay = delay + 's';
        el.classList.add('is-visible');
        /* Nettoyer le délai une fois l'animation jouée */
        setTimeout(() => { el.style.transitionDelay = ''; }, 900 + delay * 1000);
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(el => obs.observe(el));
  }

  /* --------------------------------------------------------
     2. Barre de progression de lecture
     -------------------------------------------------------- */
  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'cf-scroll-progress';
    document.body.appendChild(bar);

    let ticking = false;
    function update() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = pct + '%';
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* --------------------------------------------------------
     3. Bouton retour en haut
     -------------------------------------------------------- */
  function initToTop() {
    const btn = document.createElement('button');
    btn.className = 'cf-to-top';
    btn.setAttribute('aria-label', 'Retour en haut');
    btn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    window.addEventListener('scroll', () => {
      btn.classList.toggle('show', window.scrollY > 600);
    }, { passive: true });
  }

  /* --------------------------------------------------------
     4. Effet projecteur — .cf-spotlight
     -------------------------------------------------------- */
  function initSpotlight() {
    if (reduceMotion) return;
    document.querySelectorAll('.cf-spotlight, .cf-card-stat').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* --------------------------------------------------------
     5. Magnétisme — .cf-magnetic suit légèrement le curseur
     -------------------------------------------------------- */
  function initMagnetic() {
    if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll('.cf-magnetic').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic || '0.3');
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* --------------------------------------------------------
     6. Parallax léger au scroll — [data-parallax="0.15"]
     -------------------------------------------------------- */
  function initParallax() {
    if (reduceMotion) return;
    const els = document.querySelectorAll('[data-parallax]');
    if (!els.length) return;

    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const offset = (center - vh / 2) * (parseFloat(el.dataset.parallax) || 0.15);
        el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* --------------------------------------------------------
     7. Marquee sans couture — duplique le contenu
     -------------------------------------------------------- */
  function initMarquee() {
    document.querySelectorAll('.cf-marquee-track').forEach(track => {
      track.innerHTML += track.innerHTML;
    });
  }

  /* --------------------------------------------------------
     8. Accordéon FAQ — .cf-accordion
     -------------------------------------------------------- */
  function initAccordion() {
    document.querySelectorAll('.cf-accordion').forEach(acc => {
      const single = acc.dataset.single !== 'false';
      acc.querySelectorAll('.cf-acc-head').forEach(head => {
        head.addEventListener('click', () => {
          const item = head.closest('.cf-acc-item');
          const body = item.querySelector('.cf-acc-body');
          const isOpen = item.classList.contains('open');

          if (single) {
            acc.querySelectorAll('.cf-acc-item.open').forEach(it => {
              it.classList.remove('open');
              it.querySelector('.cf-acc-body').style.maxHeight = null;
            });
          }
          if (!isOpen) {
            item.classList.add('open');
            body.style.maxHeight = body.scrollHeight + 'px';
          } else {
            item.classList.remove('open');
            body.style.maxHeight = null;
          }
        });
      });
    });
  }

  /* --------------------------------------------------------
     INIT
     -------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initReveal();
    initScrollProgress();
    initToTop();
    initSpotlight();
    initMagnetic();
    initParallax();
    initMarquee();
    initAccordion();
  });

})();
