/* ============================================================
   COFINANCE CI - cofinance.js
   Theme, session, API helper, UI utilities, navbar custom
   ============================================================ */

'use strict';

/* ============================================================
   CONSTANTES
   ============================================================ */
const API_BASE    = '/api';
const THEME_KEY   = 'cf_theme';
const TOKEN_KEY   = 'cf_access';
const REFRESH_KEY = 'cf_refresh';
const USER_KEY    = 'cf_user';

/* ============================================================
   THEME — E : clé spécifique par utilisateur
   ============================================================ */
const Theme = {
  _key() {
    const user = Session.getUser();
    return user ? `${THEME_KEY}_${user.username}` : THEME_KEY;
  },
  init() {
    const saved = localStorage.getItem(this._key()) || localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this._updateIcon(saved);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(this._key(), next);
    this._updateIcon(next);
  },
  _updateIcon(theme) {
    document.querySelectorAll('.cf-theme-icon').forEach(i => {
      i.textContent = '';
      i.className = 'cf-theme-icon bi ' + (theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill');
    });
  }
};

/* ============================================================
   SESSION
   ============================================================ */
const Session = {
  getToken()   { return localStorage.getItem(TOKEN_KEY); },
  getRefresh() { return localStorage.getItem(REFRESH_KEY); },
  getUser() {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  save(access, refresh, user) {
    localStorage.setItem(TOKEN_KEY,   access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY,    JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn()              { return !!this.getToken(); },
  redirectIfNotLoggedIn()   { if (!this.isLoggedIn()) window.location.href = '/connexion/'; },
  redirectToDashboard() {
    const user = this.getUser();
    if (!user) return;
    const routes = {
      client:         '/dashboard/client/',
      agent:          '/dashboard/agent/',
      administrateur: '/dashboard/admin/',
    };
    window.location.href = routes[user.role] || '/';
  }
};

/* ============================================================
   API HELPER
   ============================================================ */
const API = {
  async request(method, endpoint, data = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = Session.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const config = { method, headers };
    if (data) config.body = JSON.stringify(data);

    let response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401 && auth) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${Session.getToken()}`;
        response = await fetch(`${API_BASE}${endpoint}`, { ...config, headers });
      } else {
        Session.clear();
        window.location.href = '/connexion/';
        return null;
      }
    }

    if (response.status === 204) return { ok: true, status: 204, data: null };
    const json = await response.json();
    return { ok: response.ok, status: response.status, data: json };
  },
  async refreshToken() {
    const refresh = Session.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh })
      });
      if (res.ok) {
        const d = await res.json();
        localStorage.setItem(TOKEN_KEY, d.access);
        return true;
      }
      return false;
    } catch { return false; }
  },
  get(endpoint, auth = true)         { return this.request('GET',    endpoint, null, auth); },
  post(endpoint, data, auth = true)  { return this.request('POST',   endpoint, data, auth); },
  patch(endpoint, data, auth = true) { return this.request('PATCH',  endpoint, data, auth); },
  delete(endpoint, auth = true)      { return this.request('DELETE', endpoint, null, auth); },

  /* Upload multipart (FormData) — ne pas fixer Content-Type (boundary auto). */
  async upload(endpoint, formData) {
    const faire = () => {
      const headers = {};
      const token = Session.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body: formData });
    };
    let response = await faire();
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        response = await faire();
      } else {
        Session.clear();
        window.location.href = '/connexion/';
        return null;
      }
    }
    const json = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data: json };
  },
};

/* ============================================================
   UTILITAIRES UI
   ============================================================ */
const UI = {
  alert(selector, message, type = 'error') {
    const el = document.querySelector(selector);
    if (!el) return;
    el.className = `cf-alert cf-alert-${type} show`;
    const icones = { success: 'bi-check-circle-fill', error: 'bi-exclamation-circle-fill', info: 'bi-info-circle-fill', warning: 'bi-exclamation-triangle-fill' };
    el.innerHTML = `<i class="bi ${icones[type] || 'bi-info-circle-fill'}"></i> ${message}`;
    setTimeout(() => el.classList.remove('show'), 5000);
  },
  btnLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = '<span class="cf-spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle"></span>';
      btn.disabled  = true;
    } else {
      btn.innerHTML = btn.dataset.original || btn.innerHTML;
      btn.disabled  = false;
    }
  },
  statutBadge(statut) {
    const map = {
      soumise:    ['cf-badge-blue',   'Soumise'],
      en_analyse: ['cf-badge-orange', 'En analyse'],
      approuvee:  ['cf-badge-green',  'Approuvee'],
      decaissee:  ['cf-badge-purple', 'Decaissee'],
      rejetee:    ['cf-badge-red',    'Rejetee'],
      active:     ['cf-badge-green',  'Active'],
      en_cours:   ['cf-badge-green',  'En cours'],
      resolue:    ['cf-badge-blue',   'Resolue'],
      expiree:    ['cf-badge-gray',   'Expiree'],
      resiliee:   ['cf-badge-red',    'Resiliee'],
      ouverte:    ['cf-badge-green',  'Ouverte'],
      en_attente: ['cf-badge-orange', 'En attente'],
      fermee:     ['cf-badge-gray',   'Fermee'],
    };
    const [cls, label] = map[statut] || ['cf-badge-gray', statut];
    return `<span class="cf-badge ${cls}">${label}</span>`;
  },
  date(isoString) {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  },
  montant(val) {
    if (val === null || val === undefined) return '--';
    return new Intl.NumberFormat('fr-FR').format(parseFloat(val)) + ' FCFA';
  },
  async updateNotifBadge() {
    if (!Session.isLoggedIn()) return;
    try {
      const res = await API.get('/notifications/');
      if (!res?.ok) return;
      const count = res.data.non_lues || 0;
      document.querySelectorAll('.cf-notif-count, .cf-notif-dot').forEach(el => {
        el.textContent   = count;
        el.style.display = count > 0 ? 'flex' : 'none';
      });
    } catch {}
  },
  initUserNav() {
    const user  = Session.getUser();
    if (!user) return;
    /* Noms et roles */
    document.querySelectorAll('.cf-user-name').forEach(el => {
      el.textContent = user.username;
    });
    document.querySelectorAll('.cf-user-role').forEach(el => {
      el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    });

    /* Avatar — clé spécifique à l'utilisateur pour éviter le partage entre comptes */
    const photo = localStorage.getItem('cf_avatar_' + user.username);
    const avatarHTML = photo
      ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<span class="cf-user-avatar">${user.username.charAt(0).toUpperCase()}</span>`;
    document.querySelectorAll('.cf-avatar-circle').forEach(el => {
      el.innerHTML = avatarHTML;
    });
  }
};

/* ============================================================
   DROPDOWN NAVBAR PERSONNALISE
   ============================================================ */
function toggleDropdown(event) {
  event.stopPropagation();
  const wrapper = document.getElementById('cf-user-dropdown');
  const menu    = document.getElementById('cf-dropdown-menu');
  if (!wrapper || !menu) return;
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    menu.classList.add('open');
    wrapper.classList.add('open');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.cf-dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.cf-user-dropdown').forEach(w => w.classList.remove('open'));
  document.querySelectorAll('.cf-notif-dropdown').forEach(w => w.classList.remove('open'));
}

/* Fermer si clic ailleurs */
document.addEventListener('click', () => closeAllDropdowns());

/* ============================================================
   CLOCHE — liste deroulante des notifications
   ============================================================ */
function cfEscape(s) {
  const d = document.createElement('div');
  d.textContent = (s == null) ? '' : s;
  return d.innerHTML;
}

function toggleNotifs(event) {
  event.stopPropagation();
  const wrapper = document.getElementById('cf-notif-dropdown');
  const menu    = document.getElementById('cf-notif-menu');
  if (!wrapper || !menu) return;
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    menu.classList.add('open');
    wrapper.classList.add('open');
    chargerNotifsDropdown();
  }
}

async function chargerNotifsDropdown() {
  const cont = document.getElementById('cf-notif-list');
  if (!cont || !window.Realtime) return;
  cont.innerHTML = '<div style="padding:16px;text-align:center;color:var(--cf-text-muted);font-size:0.82rem">Chargement...</div>';
  const data   = await Realtime.chargerListe();
  const notifs = (data.resultats || []).slice(0, 10);
  if (notifs.length === 0) {
    cont.innerHTML = '<div style="padding:18px;text-align:center;color:var(--cf-text-muted);font-size:0.82rem">Aucune notification</div>';
    return;
  }
  cont.innerHTML = notifs.map(n => `
    <div class="cf-notif-item ${n.est_lue ? '' : 'non-lue'}">
      <div class="cf-notif-item-titre">${cfEscape(n.titre)}</div>
      <div class="cf-notif-item-msg">${cfEscape((n.message || '').substring(0, 100))}</div>
      <div class="cf-notif-item-date">${UI.date(n.created_at)}</div>
    </div>`).join('');
}

async function toutMarquerLuNav(event) {
  event.preventDefault();
  event.stopPropagation();
  await API.post('/notifications/tout-lire/');
  if (window.Realtime) { Realtime.majBadge(0); Realtime.rafraichir(); }
  chargerNotifsDropdown();
}

/* ============================================================
   MENU MOBILE
   ============================================================ */
function toggleMobileMenu() {
  const menu   = document.getElementById('cf-mobile-menu');
  const burger = document.getElementById('cf-burger');
  if (!menu) return;
  menu.classList.toggle('open');
  if (burger) burger.classList.toggle('open');
}

/* ============================================================
   DECONNEXION
   ============================================================ */
function logout() {
  Session.clear();
  closeAllDropdowns();
  window.location.href = '/';
}

/* ============================================================
   NAVBAR — logique visiteur / utilisateur
   ============================================================ */
function initNavbar() {
  const isConnected = Session.isLoggedIn();
  const user        = Session.getUser();

  /* Elements desktop */
  const navGuest     = document.getElementById('nav-guest');
  const navUser      = document.getElementById('nav-user');
  const navLinkGuest = document.getElementById('nav-links-guest');
  const navLinkUser  = document.getElementById('nav-links-user');

  /* Elements mobile */
  const mobileGuest = document.getElementById('cf-mobile-guest');
  const mobileUser  = document.getElementById('cf-mobile-user');

  if (isConnected && user) {

    /* Desktop : cacher visiteur, montrer utilisateur */
    if (navGuest)     navGuest.style.display     = 'none';
    if (navLinkGuest) navLinkGuest.style.display  = 'none';
    if (navUser)      navUser.style.display       = 'flex';
    if (navLinkUser)  navLinkUser.style.display   = 'flex';

    /* Mobile */
    if (mobileGuest) mobileGuest.style.display = 'none';
    if (mobileUser)  mobileUser.style.display  = 'block';

    /* Liens dashboard */
    const routes = {
      client:         '/dashboard/client/',
      agent:          '/dashboard/agent/',
      administrateur: '/dashboard/admin/',
    };
    const href = routes[user.role] || '/';

    const dashLink       = document.getElementById('nav-dashboard-link');
    const mobileDashLink = document.getElementById('cf-mobile-dashboard');
    const notifLink      = document.getElementById('nav-notif-link');
    const navLinksDash   = document.getElementById('nav-links-dashboard');

    if (dashLink)       dashLink.href       = href;
    if (mobileDashLink) mobileDashLink.href = href;
    if (notifLink)      notifLink.href      = href;
    if (navLinksDash)   navLinksDash.href   = href;

    /* Infos user + badge */
    UI.initUserNav();
    UI.updateNotifBadge();

    /* E — Appliquer le thème spécifique à l'utilisateur */
    Theme.init();

    /* Bouton temoignage blog : visible uniquement si connecte */
    const btnTemoignage = document.getElementById('btn-temoignage');
    if (btnTemoignage) btnTemoignage.style.display = 'inline-flex';

    /* Masquer le CTA visiteur sur l'accueil, services, a-propos */
    const ctaVisiteur = document.getElementById('cta-visiteur');
    if (ctaVisiteur) ctaVisiteur.style.display = 'none';

    /* Rediriger les liens /inscription/ des pages publiques vers le dashboard */
    document.querySelectorAll('a.cf-cta-redirect[href="/inscription/"]').forEach(link => {
      link.href = href;
    });

  } else {

    /* Desktop : montrer visiteur, cacher utilisateur */
    if (navGuest)     navGuest.style.display     = 'flex';
    if (navLinkGuest) navLinkGuest.style.display  = 'flex';
    if (navUser)      navUser.style.display       = 'none';
    if (navLinkUser)  navLinkUser.style.display   = 'none';

    /* Mobile */
    if (mobileGuest) mobileGuest.style.display = 'block';
    if (mobileUser)  mobileUser.style.display  = 'none';

    /* Bouton temoignage : cache pour les visiteurs */
    const btnTemoignage = document.getElementById('btn-temoignage');
    if (btnTemoignage) btnTemoignage.style.display = 'none';
  }

  /* La navbar s'adapte a la page courante : lien actif surligne. */
  marquerLienActif();
}

/* Surligne le lien de navigation correspondant a la page affichee. */
function marquerLienActif() {
  const path = window.location.pathname;
  document.querySelectorAll('.cf-nav-links a, .cf-mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const actif = href === '/' ? path === '/' : path.startsWith(href);
    a.classList.toggle('cf-link-active', actif);
  });
}

/* ============================================================
   C — SYSTEME TOAST
   ============================================================ */
const Toast = {
  _icons: { success: 'bi-check-circle-fill', error: 'bi-exclamation-circle-fill', info: 'bi-info-circle-fill', warning: 'bi-exclamation-triangle-fill' },
  show(message, type = 'info', duration = 4000) {
    const container = document.getElementById('cf-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `cf-toast cf-toast-${type}`;
    toast.innerHTML = `
      <span class="cf-toast-icon"><i class="bi ${this._icons[type] || 'bi-info-circle-fill'}"></i></span>
      <span style="flex:1">${message}</span>
      <button class="cf-toast-close" aria-label="Fermer"><i class="bi bi-x-lg"></i></button>`;

    toast.querySelector('.cf-toast-close').addEventListener('click', () => this._dismiss(toast));
    container.appendChild(toast);

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    if (duration > 0) setTimeout(() => this._dismiss(toast), duration);
  },
  _dismiss(toast) {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }
};

/* ============================================================
   A+I — SCROLL REVEAL avec stagger en cascade par rangée
   ============================================================ */
function initScrollReveal() {
  if (document.querySelector('.cf-sidebar')) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('cf-animate-in');
        /* Réinitialiser le délai après l'animation pour éviter les effets de bord */
        setTimeout(() => { entry.target.style.transitionDelay = '0s'; }, 700);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  /* Grouper les cartes par rangée (parent .row) pour un stagger par groupe */
  const rowMap = new Map();
  document.querySelectorAll('.cf-card').forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.classList.add('cf-animate-ready');
    const row = el.closest('.row') || el.parentElement;
    if (!rowMap.has(row)) rowMap.set(row, []);
    rowMap.get(row).push(el);
  });

  rowMap.forEach(cards => {
    cards.forEach((card, i) => {
      card.style.transitionDelay = `${i * 0.12}s`;
    });
  });

  document.querySelectorAll('.cf-animate-ready').forEach(el => observer.observe(el));
}

/* ============================================================
   D — TILT 3D MAGNÉTIQUE
   ============================================================ */
function initTiltCards() {
  document.querySelectorAll('.cf-tilt').forEach(card => {
    let raf = null;

    card.addEventListener('mousemove', e => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x    = (e.clientX - rect.left) / rect.width  - 0.5;
        const y    = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transition = 'box-shadow 0.15s ease, border-color 0.4s ease, opacity 0.4s ease';
        card.style.transform  = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px)`;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (raf) cancelAnimationFrame(raf);
      card.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease';
      card.style.transform  = '';
      setTimeout(() => { card.style.transition = ''; }, 450);
    });
  });
}

/* ============================================================
   H — TIMELINE ANIMÉE AU SCROLL
   ============================================================ */
function initTimeline() {
  const line = document.getElementById('cf-timeline-line');
  if (!line) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        line.classList.add('cf-line-drawn');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  obs.observe(line.parentElement);
}

/* ============================================================
   J — NAVBAR GLASSMORPHISM AU SCROLL
   ============================================================ */
function initNavbarGlass() {
  const navbar = document.querySelector('.cf-navbar-wrap');
  if (!navbar) return;
  const update = () => navbar.classList.toggle('cf-navbar-glass', window.scrollY > 60);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ============================================================
   G — COMPTEURS ANIMÉS HERO
   ============================================================ */
function initCounters() {
  const elements = document.querySelectorAll('[data-counter]');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el       = entry.target;
      const target   = parseInt(el.dataset.counter, 10);
      const suffix   = el.dataset.suffix || '';
      const sep      = el.dataset.sep !== undefined;
      const duration = 1400;
      const start    = performance.now();

      function step(now) {
        const elapsed  = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        const value    = Math.round(eased * target);
        el.textContent = sep
          ? new Intl.NumberFormat('fr-FR').format(value) + suffix
          : value + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });

  elements.forEach(el => observer.observe(el));
}

/* ============================================================
   INIT GLOBALE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();

  /* Toggle theme */
  document.querySelectorAll('.cf-toggle-theme, .cf-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => Theme.toggle());
  });

  /* Navbar */
  initNavbar();

  /* Logout sur tous les elements .cf-logout */
  document.querySelectorAll('.cf-logout').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); logout(); });
  });

  /* A+I — Scroll reveal cartes avec stagger */
  initScrollReveal();

  /* D — Tilt 3D magnétique */
  initTiltCards();

  /* G — Compteurs animés */
  initCounters();

  /* H — Timeline animée */
  initTimeline();

  /* J — Navbar glass au scroll */
  initNavbarGlass();
});