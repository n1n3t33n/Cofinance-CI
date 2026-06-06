/* ============================================================
   COFINANCE CI - blog.js
   Temoignages en localStorage — sans appel back-end
   ============================================================ */

'use strict';

const STORAGE_KEY    = 'cf_temoignages';
let   noteSelectionnee = 5;

const temoignagesDefaut = [
  {
    prenom: 'Aya Kone',    ville: 'Abidjan Abobo',
    texte:  'Grace a COFINANCE CI j\'ai pu obtenir un microcredit de 300 000 FCFA pour developper ma boutique. Le processus etait simple et tres rapide.',
    note: 5, date: '2026-05-15',
  },
  {
    prenom: 'Kouame Tra',  ville: 'San-Pedro',
    texte:  'L\'assurance mobile m\'a sauve lors d\'un accident. En quelques jours j\'ai recu mon indemnisation. Je recommande a tous.',
    note: 5, date: '2026-04-20',
  },
  {
    prenom: 'Marie Soro',  ville: 'Korhogo',
    texte:  'Le support client via le chat est exceptionnel. Mon agent a repondu en moins de 5 minutes et a resolu mon probleme immediatement.',
    note: 5, date: '2026-03-10',
  },
  {
    prenom: 'Ibrahim Bamba', ville: 'Bouake',
    texte:  'Tres bonne experience. J\'ai soumis ma demande un lundi et j\'ai ete contacte le mercredi. Service efficace et professionnel.',
    note: 4, date: '2026-02-28',
  },
  {
    prenom: 'Fatou Diallo', ville: 'Abidjan Cocody',
    texte:  'L\'application est facile a utiliser et les agents sont tres sympas. Je renouvelle mon credit pour la troisieme fois.',
    note: 5, date: '2026-01-14',
  },
];

/* ── Affichage ─────────────────────────────────────────────── */
function chargerTemoignages() {
  const conteneur = document.getElementById('liste-temoignages');
  if (!conteneur) return;

  /* Visibilite du bouton selon connexion */
  const btn = document.getElementById('btn-temoignage');
  if (btn) {
    btn.style.display = (typeof Session !== 'undefined' && Session.isLoggedIn())
      ? 'inline-flex' : 'none';
  }

  const sauvegardes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const tous        = [...temoignagesDefaut, ...sauvegardes];

  conteneur.innerHTML = tous.map(t => `
    <div class="col-lg-4 col-md-6">
      <div class="cf-card h-100">
        <div class="d-flex justify-content-center mb-3">${genEtoiles(t.note)}</div>
        <p style="font-size:0.9rem;line-height:1.8;color:var(--cf-text-muted);
             font-style:italic;margin-bottom:20px">"${t.texte}"</p>
        <div class="d-flex align-items-center gap-3">
          <div style="width:44px;height:44px;border-radius:50%;
               background:linear-gradient(135deg,var(--cf-orange),var(--cf-green));
               color:#fff;font-weight:800;font-size:1rem;
               display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${t.prenom.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:700;font-size:0.88rem">${t.prenom}</div>
            <div style="font-size:0.75rem;color:var(--cf-text-muted)">${t.ville}</div>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function genEtoiles(note) {
  return Array.from({ length: 5 }, (_, i) =>
    `<i class="bi bi-star-fill mx-1"
        style="color:${i < note ? 'var(--cf-orange)' : 'var(--cf-border)'}"></i>`
  ).join('');
}

/* ── Etoiles ───────────────────────────────────────────────── */
function noterEtoile(val) {
  noteSelectionnee = val;
  document.querySelectorAll('.etoile-btn').forEach((btn, i) => {
    btn.style.color = i < val ? 'var(--cf-orange)' : 'var(--cf-border)';
  });
}

/* ── Soumission ────────────────────────────────────────────── */
function soumettreTemoin() {
  const prenom = (document.getElementById('tem-prenom')?.value || '').trim();
  const ville  = (document.getElementById('tem-ville')?.value  || '').trim();
  const texte  = (document.getElementById('tem-texte')?.value  || '').trim();

  if (!prenom || !texte) {
    afficherAlerteBlog('Veuillez remplir au moins votre prenom et votre temoignage.', 'error');
    return;
  }

  /* Sauvegarder */
  const existants = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  existants.push({
    prenom, ville: ville || 'Cote d\'Ivoire',
    texte, note: noteSelectionnee,
    date: new Date().toISOString().split('T')[0],
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existants));

  afficherAlerteBlog('Merci ! Votre temoignage est maintenant visible.', 'success');

  /* Fermer le modal via l'attribut data-bs-dismiss — on clique le bouton de fermeture */
  setTimeout(() => {
    /* Methode 1 : cliquer le bouton de fermeture natif Bootstrap */
    const closeBtn = document.querySelector('#modalTemoignage [data-bs-dismiss="modal"]');
    if (closeBtn) closeBtn.click();

    /* Methode 2 : fallback via l'API Bootstrap si disponible */
    try {
      const modalEl = document.getElementById('modalTemoignage');
      if (modalEl && bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
    } catch (e) {}

    /* Reinitialiser le formulaire */
    document.getElementById('tem-prenom').value = '';
    document.getElementById('tem-ville').value  = '';
    document.getElementById('tem-texte').value  = '';
    noterEtoile(5);

    chargerTemoignages();
  }, 1200);
}

function afficherAlerteBlog(msg, type) {
  const alerte = document.getElementById('alerte-temoignage');
  const icon   = document.getElementById('alerte-tem-icon');
  const msgEl  = document.getElementById('alerte-tem-msg');
  if (!alerte) return;
  alerte.className = `cf-alert cf-alert-${type} mb-3 show`;
  if (icon)  icon.className    = type === 'success' ? 'bi bi-check-circle' : 'bi bi-exclamation-circle';
  if (msgEl) msgEl.textContent = msg;
}

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  chargerTemoignages();

  /* Initialiser visuellement les etoiles quand le modal s'ouvre */
  const modal = document.getElementById('modalTemoignage');
  if (modal) {
    modal.addEventListener('show.bs.modal', function () {
      noterEtoile(noteSelectionnee);
    });
  }
});