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
   THEME
   ============================================================ */
const Theme = {
  init() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this._updateIcon(saved);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    this._updateIcon(next);
  },
  _updateIcon(theme) {
    document.querySelectorAll('.cf-theme-icon').forEach(i => {
      i.textContent = theme === 'dark' ? '☀️' : '🌙';
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
};

/* ============================================================
   UTILITAIRES UI
   ============================================================ */
const UI = {
  alert(selector, message, type = 'error') {
    const el = document.querySelector(selector);
    if (!el) return;
    el.className = `cf-alert cf-alert-${type} show`;
    const icones = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    el.innerHTML = `<span>${icones[type] || 'ℹ️'}</span> ${message}`;
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
    const photo = localStorage.getItem('cf_avatar');

    /* Noms et roles */
    document.querySelectorAll('.cf-user-name').forEach(el => {
      el.textContent = user.username;
    });
    document.querySelectorAll('.cf-user-role').forEach(el => {
      el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    });

    /* Avatar */
    const avatarCircle = document.getElementById('nav-avatar');
    if (avatarCircle) {
      if (photo) {
        avatarCircle.innerHTML =
          `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        avatarCircle.innerHTML =
          `<span class="cf-user-avatar">${user.username.charAt(0).toUpperCase()}</span>`;
      }
    }
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
}

/* Fermer si clic ailleurs */
document.addEventListener('click', () => closeAllDropdowns());

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

    if (dashLink)       dashLink.href       = href;
    if (mobileDashLink) mobileDashLink.href = href;
    if (notifLink)      notifLink.href      = href;

    /* Infos user + badge */
    UI.initUserNav();
    UI.updateNotifBadge();

    /* Bouton temoignage blog : visible uniquement si connecte */
    const btnTemoignage = document.getElementById('btn-temoignage');
    if (btnTemoignage) btnTemoignage.style.display = 'inline-flex';

    /* Masquer le CTA visiteur sur l'accueil */
    const ctaVisiteur = document.getElementById('cta-visiteur');
    if (ctaVisiteur) ctaVisiteur.style.display = 'none';

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
});