/* ============================================================
   COFINANCE CI — JavaScript principal
   - Gestion du thème clair/sombre
   - Helpers API (fetch avec token JWT)
   - Utilitaires UI (alertes, loaders, badges)
   - Gestion de la session (login/logout)
   ============================================================ */

'use strict';

/* ── Constantes ─────────────────────────────────────────────── */
const API_BASE = '/api';
const THEME_KEY = 'cf_theme';
const TOKEN_KEY = 'cf_access';
const REFRESH_KEY = 'cf_refresh';
const USER_KEY = 'cf_user';

/* ── Thème clair / sombre ───────────────────────────────────── */
const Theme = {
  init() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this._updateIcon(saved);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    this._updateIcon(next);
  },

  _updateIcon(theme) {
    const icons = document.querySelectorAll('.cf-theme-icon');
    icons.forEach(i => {
      i.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
  }
};

/* ── Gestion de la session ──────────────────────────────────── */
const Session = {
  getToken()   { return localStorage.getItem(TOKEN_KEY); },
  getRefresh() { return localStorage.getItem(REFRESH_KEY); },
  getUser()    {
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

  isLoggedIn() { return !!this.getToken(); },

  redirectIfNotLoggedIn() {
    if (!this.isLoggedIn()) {
      window.location.href = '/connexion/';
    }
  },

  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      this.redirectToDashboard();
    }
  },

  redirectToDashboard() {
    const user = this.getUser();
    if (!user) return;
    const routes = {
      client:        '/dashboard/client/',
      agent:         '/dashboard/agent/',
      administrateur: '/dashboard/admin/',
    };
    window.location.href = routes[user.role] || '/';
  }
};

/* ── API Helper ─────────────────────────────────────────────── */
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

    // Token expiré → tenter le refresh
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

    if (response.status === 204) return null;
    return response.json().then(data => ({ ok: response.ok, status: response.status, data }));
  },

  async refreshToken() {
    const refresh = Session.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.access);
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

/* ── Utilitaires UI ─────────────────────────────────────────── */
const UI = {
  /* Afficher une alerte */
  alert(selector, message, type = 'error') {
    const el = document.querySelector(selector);
    if (!el) return;
    el.className = `cf-alert cf-alert-${type} show`;
    el.innerHTML = `<span>${this._icon(type)}</span> ${message}`;
    setTimeout(() => el.classList.remove('show'), 5000);
  },

  _icon(type) {
    return { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }[type] || 'ℹ️';
  },

  /* Loader sur un bouton */
  btnLoading(btn, loading = true) {
    if (loading) {
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = '<span class="cf-spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle"></span>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.original || btn.innerHTML;
      btn.disabled = false;
    }
  },

  /* Badge de statut crédit */
  statutBadge(statut) {
    const map = {
      soumise:    ['cf-badge-blue',   '📋 Soumise'],
      en_analyse: ['cf-badge-orange', '🔍 En analyse'],
      approuvee:  ['cf-badge-green',  '✅ Approuvée'],
      decaissee:  ['cf-badge-purple', '💰 Décaissée'],
      rejetee:    ['cf-badge-red',    '❌ Rejetée'],
      active:     ['cf-badge-green',  '✅ Active'],
      expiree:    ['cf-badge-gray',   '⏰ Expirée'],
      resiliee:   ['cf-badge-red',    '🚫 Résiliée'],
      ouverte:    ['cf-badge-green',  '💬 Ouverte'],
      en_attente: ['cf-badge-orange', '⏳ En attente'],
      fermee:     ['cf-badge-gray',   '🔒 Fermée'],
    };
    const [cls, label] = map[statut] || ['cf-badge-gray', statut];
    return `<span class="cf-badge ${cls}">${label}</span>`;
  },

  /* Formater une date */
  date(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  },

  /* Formater un montant FCFA */
  montant(val) {
    if (!val) return '—';
    return new Intl.NumberFormat('fr-FR').format(parseFloat(val)) + ' FCFA';
  },

  /* Mettre à jour le badge notifications dans la navbar */
  async updateNotifBadge() {
    const res = await API.get('/notifications/');
    if (!res?.ok) return;
    const count = res.data.non_lues || 0;
    document.querySelectorAll('.cf-notif-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  /* Initialiser le nom d'utilisateur dans la navbar */
  initUserNav() {
    const user = Session.getUser();
    if (!user) return;
    document.querySelectorAll('.cf-user-name').forEach(el => {
      el.textContent = user.username;
    });
    document.querySelectorAll('.cf-user-role').forEach(el => {
      el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    });
    document.querySelectorAll('.cf-user-avatar').forEach(el => {
      el.textContent = user.username.charAt(0).toUpperCase();
    });
  }
};

/* ── Logout ─────────────────────────────────────────────────── */
function logout() {
  Session.clear();
  window.location.href = '/';
}

/* ── Init globale ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Thème
  Theme.init();

  // Toggle thème
  document.querySelectorAll('.cf-toggle-theme').forEach(btn => {
    btn.addEventListener('click', () => Theme.toggle());
  });

  // User nav
  UI.initUserNav();

  // Badge notifications si connecté
  if (Session.isLoggedIn()) {
    UI.updateNotifBadge();
  }

  // Lien logout
  document.querySelectorAll('.cf-logout').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  });
});