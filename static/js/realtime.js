/* ============================================================
   REALTIME — notifications quasi temps réel

   Deux canaux complémentaires :
     1) WebSocket /ws/notifications/  → instantané quand il aboutit.
     2) Polling /notifications/ (10 s) → FIABLE en toutes circonstances.

   Le polling est nécessaire car, avec InMemoryChannelLayer, un group_send
   émis depuis une vue synchrone (async_to_sync) n'atteint pas toujours les
   consumers (boucles d'événements différentes). Le polling garantit que les
   notifications, le badge et les rafraîchissements arrivent sans recharger.

   Dépend de cofinance.js (Session, API, Toast).
   Réémet : 'cf:notification' (detail = notif) et 'cf:dossier-nouveau'.
   Expose : window.Realtime { rafraichir, chargerListe, connecter, deconnecter }.
   ============================================================ */
(function () {
  'use strict';

  let socket          = null;
  let tentatives      = 0;
  let fermetureVoulue = false;
  let pollTimer       = null;
  let amorce          = false;        // 1re synchro faite (ne pas toaster l'historique)
  const idsVues       = new Set();    // dédoublonnage WS + polling

  /* ---- WebSocket (best-effort) ---- */
  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws/notifications/?token=${Session.getToken()}`;
  }

  function connecter() {
    if (!Session.isLoggedIn()) return;
    if (socket && (socket.readyState === WebSocket.OPEN ||
                   socket.readyState === WebSocket.CONNECTING)) return;
    fermetureVoulue = false;
    try { socket = new WebSocket(wsUrl()); } catch (_) { return; }

    socket.onopen = () => { tentatives = 0; };
    socket.onmessage = (e) => {
      let data; try { data = JSON.parse(e.data); } catch { return; }
      if (data.type === 'notification') {
        signalerNotif(data.notification || {}, true);
      } else if (data.type === 'dossier_nouveau') {
        window.dispatchEvent(new CustomEvent('cf:dossier-nouveau', { detail: data.dossier }));
      }
    };
    socket.onclose = () => {
      socket = null;
      if (fermetureVoulue || !Session.isLoggedIn()) return;
      tentatives++;
      setTimeout(connecter, Math.min(30000, 1000 * Math.pow(2, tentatives)));
    };
    socket.onerror = () => { try { socket.close(); } catch (_) {} };
  }

  function deconnecter() {
    fermetureVoulue = true;
    if (socket) { try { socket.close(); } catch (_) {} socket = null; }
  }

  /* ---- Traitement d'une notification (commun WS + polling) ---- */
  function signalerNotif(n, toast) {
    if (!n || n.id == null || idsVues.has(n.id)) return;
    idsVues.add(n.id);
    if (toast && typeof Toast !== 'undefined' && Toast.show) {
      Toast.show(n.titre || 'Nouvelle notification', 'info');
    }
    window.dispatchEvent(new CustomEvent('cf:notification', { detail: n }));
  }

  function majBadge(count) {
    document.querySelectorAll('.cf-notif-count, .cf-notif-dot').forEach(el => {
      el.textContent   = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  /* ---- Polling (fiable) ---- */
  async function sonder() {
    if (!Session.isLoggedIn()) return;
    try {
      const res = await API.get('/notifications/');
      if (!res || !res.ok) return;
      majBadge(res.data.non_lues || 0);

      const liste = res.data.resultats || [];
      if (!amorce) {
        // 1re passe : on mémorise l'existant sans toaster.
        liste.forEach(n => idsVues.add(n.id));
        amorce = true;
      } else {
        // Du plus ancien au plus récent pour un ordre de toast naturel.
        liste.slice().reverse().forEach(n => signalerNotif(n, true));
      }
    } catch (_) {}
  }

  function demarrerPolling() {
    if (pollTimer) return;
    sonder();
    pollTimer = setInterval(sonder, 10000);
  }
  function arreterPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ---- Liste pour la cloche déroulante ---- */
  async function chargerListe() {
    const res = await API.get('/notifications/');
    return (res && res.ok) ? res.data : { non_lues: 0, resultats: [] };
  }

  /* ---- API publique ---- */
  window.Realtime = { connecter, deconnecter, rafraichir: sonder, chargerListe, majBadge };

  document.addEventListener('DOMContentLoaded', () => {
    if (!Session.isLoggedIn()) return;
    connecter();
    demarrerPolling();
  });

  // Synchronisation entre onglets (connexion / déconnexion).
  window.addEventListener('storage', (e) => {
    if (e.key !== 'cf_access') return;
    if (e.newValue) { connecter(); demarrerPolling(); }
    else { deconnecter(); arreterPolling(); }
  });
})();
