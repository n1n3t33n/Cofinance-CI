/* ============================================================
   COFINANCE CI - parametres.js
   Gestion des parametres du compte utilisateur
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', function() {
  Session.redirectIfNotLoggedIn();
  chargerProfil();
  chargerAvatar();
});

/* ============================================================
   CHARGEMENT DU PROFIL
   ============================================================ */
async function chargerProfil() {
  try {
    const res = await API.get('/auth/profile/');
    if (!res.ok) return;

    const d = res.data;
    const email = d.email || '';

    /* Champs modifiables */
    if (document.getElementById('param-email'))     document.getElementById('param-email').value     = email;
    if (document.getElementById('param-telephone')) document.getElementById('param-telephone').value = d.telephone || '';
    if (document.getElementById('param-region'))    document.getElementById('param-region').value    = d.region    || '';

    /* Champ username (lecture seule) */
    const usernameEl = document.getElementById('param-username');
    if (usernameEl) usernameEl.value = d.username || '';

    /* Initiale avatar */
    const initiale = document.getElementById('avatar-initiale');
    if (initiale) initiale.textContent = (d.username || 'U').charAt(0).toUpperCase();

    /* Statut 2FA */
    _afficherStatut2FA(email);
    _afficherBadgeEmail(email);

  } catch (err) {}
}

function _afficherStatut2FA(email) {
  const badge = document.getElementById('badge-2fa-statut');
  const icon  = document.getElementById('icon-2fa');
  const wrap  = document.getElementById('icon-2fa-wrapper');
  const desc  = document.getElementById('label-2fa-desc');

  if (!badge) return;

  if (email) {
    /* Masquer email : a***@gmail.com */
    const masked = email.replace(/(.{1}).+(@.+)/, '$1***$2');
    badge.className   = 'cf-badge cf-badge-green';
    badge.textContent = 'Active';
    if (icon) { icon.className = 'bi bi-shield-fill-check fs-4'; icon.style.color = 'var(--cf-green)'; }
    if (wrap) { wrap.style.background = 'rgba(0,168,107,0.1)'; wrap.style.borderRadius = 'var(--cf-radius)'; }
    if (desc) desc.textContent = `Codes OTP envoyes a ${masked}`;
  } else {
    badge.className   = 'cf-badge cf-badge-gray';
    badge.textContent = 'Non activee';
    if (icon) { icon.className = 'bi bi-shield-slash fs-4'; icon.style.color = '#6B7280'; }
    if (wrap) { wrap.style.background = 'rgba(107,114,128,0.1)'; wrap.style.borderRadius = 'var(--cf-radius)'; }
    if (desc) desc.textContent = 'Ajoutez un email pour activer la verification en deux etapes.';
  }
}

function _afficherBadgeEmail(email) {
  const badge = document.getElementById('badge-email-2fa');
  if (!badge) return;
  if (email) {
    badge.className   = 'cf-badge cf-badge-green ms-1';
    badge.style.display = 'inline-flex';
    badge.innerHTML   = '<i class="bi bi-shield-check me-1"></i>2FA active';
  } else {
    badge.className   = 'cf-badge cf-badge-orange ms-1';
    badge.style.display = 'inline-flex';
    badge.innerHTML   = '<i class="bi bi-shield-exclamation me-1"></i>2FA requis';
  }
}

/* ============================================================
   SAUVEGARDE DU PROFIL
   ============================================================ */
async function sauverParametres() {
  const btn = document.getElementById('btn-sauver-param');
  UI.btnLoading(btn, true);

  try {
    const res = await API.patch('/auth/profile/', {
      email:     document.getElementById('param-email').value.trim(),
      telephone: document.getElementById('param-telephone').value.trim(),
      region:    document.getElementById('param-region').value.trim(),
    });

    const alerte = document.getElementById('alerte-profil-param');
    const icon   = document.getElementById('alerte-param-icon');
    const msgEl  = document.getElementById('alerte-param-msg');

    if (res.ok) {
      alerte.className  = 'cf-alert cf-alert-success mb-4 show';
      icon.className    = 'bi bi-check-circle';
      msgEl.textContent = 'Profil mis a jour avec succes.';

      /* Mettre a jour l'objet user en session */
      const user = Session.getUser();
      if (user) {
        user.email     = res.data.email;
        user.telephone = res.data.telephone;
        user.region    = res.data.region;
        localStorage.setItem('cf_user', JSON.stringify(user));
      }

      /* Rafraîchir le badge 2FA */
      _afficherStatut2FA(res.data.email || '');
      _afficherBadgeEmail(res.data.email || '');
    } else {
      alerte.className  = 'cf-alert cf-alert-error mb-4 show';
      icon.className    = 'bi bi-exclamation-circle';
      msgEl.textContent = 'Erreur lors de la mise a jour.';
    }
  } catch (err) {
    console.error(err);
  }

  UI.btnLoading(btn, false);
}

/* ============================================================
   PHOTO DE PROFIL (localStorage uniquement)
   ============================================================ */
function chargerAvatar() {
  const user = Session.getUser();
  if (!user) return;
  const photo = localStorage.getItem('cf_avatar_' + user.username);
  if (photo) {
    const apercu = document.getElementById('apercu-avatar');
    if (apercu) {
      apercu.innerHTML = `
        <img src="${photo}"
             style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    }
  }
}

function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert('La photo ne doit pas depasser 2 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;

    /* Afficher dans l'apercu */
    const apercu = document.getElementById('apercu-avatar');
    if (apercu) {
      apercu.innerHTML = `
        <img src="${dataUrl}"
             style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    }

    /* Sauvegarder dans localStorage avec clé spécifique à l'utilisateur */
    const user = Session.getUser();
    if (user) localStorage.setItem('cf_avatar_' + user.username, dataUrl);

    /* Mettre a jour tous les cercles avatar (navbar + sidebar) */
    document.querySelectorAll('.cf-avatar-circle').forEach(el => {
      el.innerHTML = `
        <img src="${dataUrl}"
             style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    });
  };
  reader.readAsDataURL(file);
}

function supprimerPhoto() {
  const user = Session.getUser();
  if (user) localStorage.removeItem('cf_avatar_' + user.username);
  const initiale = user?.username?.charAt(0).toUpperCase() || 'U';
  const apercu   = document.getElementById('apercu-avatar');
  if (apercu) {
    apercu.innerHTML = `<span id="avatar-initiale">${initiale}</span>`;
  }
  document.querySelectorAll('.cf-avatar-circle').forEach(el => {
    el.innerHTML = `<span class="cf-user-avatar">${initiale}</span>`;
  });
}