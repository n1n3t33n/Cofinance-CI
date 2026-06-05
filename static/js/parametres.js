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
    if (res.ok) {
      document.getElementById('param-email').value     = res.data.email     || '';
      document.getElementById('param-telephone').value = res.data.telephone || '';
      document.getElementById('param-region').value    = res.data.region    || '';

      /* Initiale avatar */
      const initiale = document.getElementById('avatar-initiale');
      if (initiale) {
        initiale.textContent = (res.data.username || 'U').charAt(0).toUpperCase();
      }
    }
  } catch (err) {}
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
  const photo = localStorage.getItem('cf_avatar');
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

    /* Sauvegarder dans localStorage */
    localStorage.setItem('cf_avatar', dataUrl);

    /* Mettre a jour la navbar immediatement */
    document.querySelectorAll('#nav-avatar').forEach(el => {
      el.innerHTML = `
        <img src="${dataUrl}"
             style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    });
  };
  reader.readAsDataURL(file);
}

function supprimerPhoto() {
  localStorage.removeItem('cf_avatar');
  const initiale = Session.getUser()?.username?.charAt(0).toUpperCase() || 'U';
  const apercu   = document.getElementById('apercu-avatar');
  if (apercu) {
    apercu.innerHTML = `<span id="avatar-initiale">${initiale}</span>`;
  }
  document.querySelectorAll('#nav-avatar').forEach(el => {
    el.innerHTML = `<span class="cf-user-avatar">${initiale}</span>`;
  });
}