/* ============================================================
   COFINANCE CI - auth.js
   Connexion 2FA (OTP email) + inscription
   ============================================================ */

'use strict';

/* Stockage temporaire inter-étapes (jamais dans localStorage) */
let _tmpUsername = '';
let _tmpPassword = '';
let _countdownTimer = null;

/* ============================================================
   UTILITAIRES COMMUNS
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
function toggleMdp(inputId, iconId) { togglePassword(inputId, iconId); }

function afficherErreur(msg) {
  const alerte = document.getElementById('alerte-connexion');
  const msgEl  = document.getElementById('msg-erreur');
  if (!alerte || !msgEl) return;
  msgEl.textContent = msg;
  alerte.classList.add('show');
}
function masquerErreur() {
  const alerte = document.getElementById('alerte-connexion');
  if (alerte) alerte.classList.remove('show');
}

/* ============================================================
   INDICATEUR D'ETAPES
   ============================================================ */
function allerEtape(num) {
  document.getElementById('etape-identifiants').style.display = num === 1 ? 'block' : 'none';
  document.getElementById('etape-email').style.display        = num === 2 ? 'block' : 'none';
  document.getElementById('etape-otp').style.display          = num === 3 ? 'block' : 'none';

  masquerErreur();

  /* Mise à jour des dots */
  for (let i = 1; i <= 3; i++) {
    const dot  = document.getElementById(`step-dot-${i}`);
    const line = document.getElementById(`step-line-${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < num)  dot.classList.add('done');
    if (i === num) dot.classList.add('active');
    if (line) line.classList.toggle('done', i < num);
  }

  /* Focus automatique sur le premier champ OTP */
  if (num === 3) {
    const digits = document.querySelectorAll('.cf-otp-digit');
    digits.forEach(d => d.value = '');
    if (digits[0]) digits[0].focus();
    demarrerCountdown();
  }
}

function retourEtape1() {
  _tmpPassword = '';
  allerEtape(1);
}

/* ============================================================
   ETAPE 1 — Valider les credentials
   ============================================================ */
async function seConnecter() {
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;
  const btn      = document.getElementById('btn-connexion');

  masquerErreur();

  if (!username || !password) {
    afficherErreur('Veuillez remplir tous les champs.');
    return;
  }

  UI.btnLoading(btn, true);

  try {
    const res = await API.post('/auth/request-otp/', { username, password }, false);

    if (!res.ok) {
      afficherErreur(res.data?.detail || 'Identifiants incorrects.');
      UI.btnLoading(btn, false);
      return;
    }

    /* Stocker temporairement pour les étapes suivantes */
    _tmpUsername = username;
    _tmpPassword = password;

    if (res.data.needs_email) {
      allerEtape(2);
    } else {
      allerEtape(3);
      _devAutoFillOtp(res.data._dev_code);
    }

  } catch (err) {
    afficherErreur('Erreur réseau. Vérifiez votre connexion.');
  }

  UI.btnLoading(btn, false);
}

/* ============================================================
   ETAPE 2a — Sauvegarder l'email puis envoyer l'OTP
   ============================================================ */
async function soumettreEmail() {
  const email = document.getElementById('email-2fa')?.value.trim();
  const btn   = document.getElementById('btn-save-email');

  masquerErreur();

  if (!email || !email.includes('@')) {
    afficherErreur('Saisissez une adresse email valide.');
    return;
  }

  UI.btnLoading(btn, true);

  try {
    const res = await API.post('/auth/save-email-otp/', {
      username: _tmpUsername,
      password: _tmpPassword,
      email,
    }, false);

    if (!res.ok) {
      afficherErreur(res.data?.detail || 'Erreur lors de la sauvegarde.');
      UI.btnLoading(btn, false);
      return;
    }

    const hint = document.getElementById('otp-email-hint');
    if (hint) hint.textContent = `Code envoyé à ${email}.`;

    allerEtape(3);
    _devAutoFillOtp(res.data._dev_code);

  } catch (err) {
    afficherErreur('Erreur réseau. Réessayez.');
  }

  UI.btnLoading(btn, false);
}

/* ============================================================
   ETAPE 3 — Vérifier le code OTP
   ============================================================ */
async function verifierOTP() {
  const digits = document.querySelectorAll('.cf-otp-digit');
  const code   = Array.from(digits).map(d => d.value).join('').trim();
  const btn    = document.getElementById('btn-verify-otp');

  masquerErreur();

  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    afficherErreur('Entrez les 6 chiffres du code reçu.');
    return;
  }

  UI.btnLoading(btn, true);

  try {
    const res = await API.post('/auth/verify-otp/', {
      username: _tmpUsername,
      code,
    }, false);

    if (!res.ok) {
      afficherErreur(res.data?.detail || 'Code incorrect ou expiré.');
      digits.forEach(d => { d.value = ''; d.style.borderColor = '#EF4444'; });
      if (digits[0]) digits[0].focus();
      UI.btnLoading(btn, false);
      return;
    }

    const { access, refresh } = res.data;

    /* Récupérer le profil puis sauvegarder la session */
    localStorage.setItem('cf_access', access);
    const resProfil = await API.get('/auth/profile/');

    if (!resProfil.ok) {
      afficherErreur('Erreur lors du chargement du profil.');
      UI.btnLoading(btn, false);
      return;
    }

    Session.save(access, refresh, resProfil.data);

    /* Effacer les variables temporaires */
    _tmpUsername = '';
    _tmpPassword = '';
    if (_countdownTimer) clearInterval(_countdownTimer);

    Toast.show('Connexion réussie ! Redirection...', 'success', 2000);
    setTimeout(() => Session.redirectToDashboard(), 1000);

  } catch (err) {
    afficherErreur('Erreur réseau. Réessayez.');
    UI.btnLoading(btn, false);
  }
}

/* ============================================================
   RENVOYER LE CODE
   ============================================================ */
async function renvoyerOTP() {
  if (!_tmpUsername || !_tmpPassword) { retourEtape1(); return; }

  const btn = document.getElementById('btn-renvoyer');
  if (btn) btn.disabled = true;

  masquerErreur();

  try {
    const res = await API.post('/auth/request-otp/', {
      username: _tmpUsername,
      password: _tmpPassword,
    }, false);

    if (res.ok) {
      Toast.show('Nouveau code envoyé.', 'info', 3000);
      document.querySelectorAll('.cf-otp-digit').forEach(d => {
        d.value = '';
        d.style.borderColor = '';
      });
      document.querySelector('.cf-otp-digit')?.focus();
      demarrerCountdown();
    } else {
      afficherErreur(res.data?.detail || 'Impossible de renvoyer le code.');
    }
  } catch (err) {
    afficherErreur('Erreur réseau.');
  }
}

/* ============================================================
   COUNTDOWN RENVOI (60s)
   ============================================================ */
function demarrerCountdown() {
  if (_countdownTimer) clearInterval(_countdownTimer);

  const btn     = document.getElementById('btn-renvoyer');
  const timer   = document.getElementById('timer-renvoyer');
  const cdEl    = document.getElementById('countdown');

  if (btn)   btn.disabled = true;
  if (timer) timer.style.display = 'inline';

  let sec = 60;
  if (cdEl) cdEl.textContent = sec;

  _countdownTimer = setInterval(() => {
    sec--;
    if (cdEl) cdEl.textContent = sec;
    if (sec <= 0) {
      clearInterval(_countdownTimer);
      if (btn)   btn.disabled = false;
      if (timer) timer.style.display = 'none';
    }
  }, 1000);
}

/* ============================================================
   DEV HELPER — auto-remplissage OTP (DEBUG=True seulement)
   ============================================================ */
function _devAutoFillOtp(code) {
  if (!code) return;
  const digits = document.querySelectorAll('.cf-otp-digit');
  digits.forEach((d, i) => { d.value = code[i] || ''; });
  const hint = document.getElementById('otp-dev-hint');
  if (hint) {
    hint.innerHTML = `<i class="bi bi-bug-fill me-1"></i>Mode dev — code : <strong style="letter-spacing:2px">${code}</strong> (auto-rempli)`;
    hint.style.display = 'block';
  }
}

/* ============================================================
   NAVIGATION OTP — saisie chiffre par chiffre
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  /* Toggle oeil mot de passe */
  const toggleBtn = document.getElementById('toggle-password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => togglePassword('password', 'eye-icon'));
  }

  /* Navigation entre cases OTP */
  document.querySelectorAll('.cf-otp-digit').forEach((input, idx, all) => {
    input.addEventListener('input', function () {
      /* N'accepter que les chiffres */
      this.value = this.value.replace(/\D/g, '').slice(-1);
      this.style.borderColor = '';
      if (this.value && idx < all.length - 1) all[idx + 1].focus();

      /* Auto-submit si toutes les cases remplies */
      if (Array.from(all).every(d => d.value)) verifierOTP();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !this.value && idx > 0) all[idx - 1].focus();
    });

    /* Coller un code complet */
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
      all.forEach((d, i) => { d.value = pasted[i] || ''; });
      all[Math.min(pasted.length, all.length - 1)].focus();
      if (pasted.length === 6) verifierOTP();
    });
  });
});

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

  if (document.getElementById('alerte-inscription'))
    document.getElementById('alerte-inscription').classList.remove('show');

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
      username, email, telephone, region, password, role: 'client',
    }, false);

    if (!repInscription.ok) {
      const erreurs = repInscription.data;
      let msgErreur = 'Erreur lors de l\'inscription.';
      const premiereClef = Object.keys(erreurs)[0];
      if (premiereClef && Array.isArray(erreurs[premiereClef])) {
        msgErreur = erreurs[premiereClef][0];
      }
      afficherAlerteInscription(msgErreur, 'error');
      UI.btnLoading(btn, false);
      return;
    }

    const { access, refresh } = repInscription.data;
    Session.save(access, refresh, repInscription.data.user);

    afficherAlerteInscription('Compte créé avec succès ! Redirection...', 'success');
    setTimeout(() => Session.redirectToDashboard(), 1200);

  } catch (err) {
    afficherAlerteInscription('Une erreur est survenue. Réessayez.', 'error');
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
