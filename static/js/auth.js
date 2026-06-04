/* ============================================================
   COFINANCE CI - auth.js
   Gestion de la connexion et de l'inscription
   ============================================================ */

'use strict';

/* ============================================================
   CONNEXION
   ============================================================ */


function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'bi bi-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'bi bi-eye';
  }
}

/* Alias utilise dans le template connexion */
function toggleMdp(inputId, iconId) {
  togglePassword(inputId, iconId);
}

/* Toggle oeil sur la page connexion */
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggle-password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      togglePassword('password', 'eye-icon');
    });
  }
});

async function seConnecter() {
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  const btn      = document.getElementById('btn-connexion');
  const alerte   = document.getElementById('alerte-connexion');
  const msg      = document.getElementById('msg-erreur');

  /* Masquer alerte precedente */
  if (alerte) alerte.classList.remove('show');

  if (!username || !password) {
    if (msg) msg.textContent = 'Veuillez remplir tous les champs.';
    if (alerte) alerte.classList.add('show');
    return;
  }

  UI.btnLoading(btn, true);

  try {
    /* 1. Obtenir les tokens */
    const repLogin = await API.post('/auth/login/', { username, password }, false);

    if (!repLogin.ok) {
      const detail = repLogin.data?.detail || 'Identifiants incorrects.';
      if (msg) msg.textContent = detail;
      if (alerte) alerte.classList.add('show');
      UI.btnLoading(btn, false);
      return;
    }

    const { access, refresh } = repLogin.data;

    /* 2. Recuperer le profil */
    localStorage.setItem('cf_access', access);
    const repProfil = await API.get('/auth/profile/');

    if (!repProfil.ok) {
      if (msg) msg.textContent = 'Erreur lors de la recuperation du profil.';
      if (alerte) alerte.classList.add('show');
      UI.btnLoading(btn, false);
      return;
    }

    /* 3. Sauvegarder la session */
    Session.save(access, refresh, repProfil.data);

    /* 4. Rediriger selon le role */
    Session.redirectToDashboard();

  } catch (err) {
    if (msg) msg.textContent = 'Une erreur est survenue. Reessayez.';
    if (alerte) alerte.classList.add('show');
    UI.btnLoading(btn, false);
  }
}

/* ============================================================
   INSCRIPTION
   ============================================================ */

function evaluerForce(password) {
  const barre = document.getElementById('barre-force');
  const label = document.getElementById('label-force');
  if (!barre || !label) return;

  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const niveaux = [
    { pct: '20%',  couleur: '#EF4444', texte: 'Tres faible' },
    { pct: '40%',  couleur: '#F97316', texte: 'Faible'      },
    { pct: '60%',  couleur: '#EAB308', texte: 'Moyen'       },
    { pct: '80%',  couleur: '#22C55E', texte: 'Fort'        },
    { pct: '100%', couleur: '#00A86B', texte: 'Tres fort'   },
  ];

  const niveau = niveaux[Math.min(score - 1, 4)] || niveaux[0];

  if (password.length === 0) {
    barre.style.width = '0%';
    label.textContent = '';
    return;
  }

  barre.style.width      = niveau.pct;
  barre.style.background = niveau.couleur;
  label.textContent      = niveau.texte;
  label.style.color      = niveau.couleur;
}

async function sInscrire() {
  const username  = document.getElementById('username')?.value.trim();
  const email     = document.getElementById('email')?.value.trim();
  const telephone = document.getElementById('telephone')?.value.trim();
  const region    = document.getElementById('region')?.value.trim();
  const password  = document.getElementById('password')?.value;
  const password2 = document.getElementById('password2')?.value;
  const btn       = document.getElementById('btn-inscription');
  const alerte    = document.getElementById('alerte-inscription');
  const alerteMsg = document.getElementById('alerte-msg');
  const alerteIcon = document.getElementById('alerte-icon');

  /* Masquer alerte */
  if (alerte) alerte.classList.remove('show');

  /* Validation cote client */
  if (!username || !email || !password || !password2) {
    afficherAlerteInscription('Veuillez remplir tous les champs obligatoires.', 'error');
    return;
  }

  if (password !== password2) {
    afficherAlerteInscription('Les mots de passe ne correspondent pas.', 'error');
    return;
  }

  if (password.length < 8) {
    afficherAlerteInscription('Le mot de passe doit contenir au moins 8 caracteres.', 'error');
    return;
  }

  UI.btnLoading(btn, true);

  try {
    const repInscription = await API.post('/auth/register/', {
      username,
      email,
      telephone,
      region,
      password,
      role: 'client',
    }, false);

    if (!repInscription.ok) {
      const erreurs = repInscription.data;
      let msgErreur = 'Erreur lors de l\'inscription.';

      /* Extraire le premier message d'erreur */
      const premiereClef = Object.keys(erreurs)[0];
      if (premiereClef && Array.isArray(erreurs[premiereClef])) {
        msgErreur = erreurs[premiereClef][0];
      }

      afficherAlerteInscription(msgErreur, 'error');
      UI.btnLoading(btn, false);
      return;
    }

    /* Connexion automatique apres inscription */
    const { access, refresh } = repInscription.data;
    Session.save(access, refresh, repInscription.data.user);

    afficherAlerteInscription('Compte cree avec succes ! Redirection...', 'success');

    setTimeout(() => {
      Session.redirectToDashboard();
    }, 1200);

  } catch (err) {
    afficherAlerteInscription('Une erreur est survenue. Reessayez.', 'error');
    UI.btnLoading(btn, false);
  }
}

function afficherAlerteInscription(message, type) {
  const alerte     = document.getElementById('alerte-inscription');
  const alerteMsg  = document.getElementById('alerte-msg');
  const alerteIcon = document.getElementById('alerte-icon');

  if (!alerte) return;

  alerte.className = `cf-alert cf-alert-${type} mb-4 show`;

  const icones = {
    success: 'bi bi-check-circle',
    error:   'bi bi-exclamation-circle',
    info:    'bi bi-info-circle',
    warning: 'bi bi-exclamation-triangle',
  };

  if (alerteIcon) alerteIcon.className = icones[type] || 'bi bi-info-circle';
  if (alerteMsg)  alerteMsg.textContent = message;
}