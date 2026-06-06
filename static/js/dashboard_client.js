/* ============================================================
   COFINANCE CI - dashboard_client.js
   Logique du tableau de bord client
   ============================================================ */

'use strict';

/* ============================================================
   ETAT GLOBAL
   ============================================================ */
let produitSelectionne = null;
let chatSocket         = null;
let chatConversationId = null;
let chatTypingTimeout  = null;
let chatEstEnTrain     = false;

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  /* Verifier que l'utilisateur est connecte et est un client */
  Session.redirectIfNotLoggedIn();
  const user = Session.getUser();
  if (user && user.role !== 'client') {
    Session.redirectToDashboard();
    return;
  }

  /* Charger les donnees de la vue d'ensemble */
  chargerVueEnsemble();
});

/* ============================================================
   NAVIGATION ENTRE SECTIONS
   ============================================================ */
function afficherSection(nom) {
  /* Masquer toutes les sections */
  document.querySelectorAll('[id^="section-"]').forEach(el => {
    el.style.display = 'none';
  });

  /* Afficher la section demandee */
  const section = document.getElementById('section-' + nom);
  if (section) section.style.display = 'block';

  /* Mettre a jour la sidebar */
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.remove('active');
  });
  const lienActif = document.getElementById('nav-' + nom);
  if (lienActif) lienActif.classList.add('active');

  /* Charger les donnees selon la section */
  const chargeurs = {
    'accueil':         chargerVueEnsemble,
    'credits':         chargerCredits,
    'remboursements':  chargerRemboursements,
    'assurances':      chargerAssurances,
    'souscrire':       chargerProduits,
    'notifications':   chargerNotifications,
    'chat':            initialiserChat,
  };

  if (chargeurs[nom]) chargeurs[nom]();
}

/* ============================================================
   VUE D'ENSEMBLE
   ============================================================ */
async function chargerVueEnsemble() {
  afficherSection_sans_nav('accueil');
  await Promise.all([
    chargerStatsRapides(),
    chargerDerniersCredits(),
    chargerDernieresNotifications(),
  ]);
}

function afficherSection_sans_nav(nom) {
  document.querySelectorAll('[id^="section-"]').forEach(el => {
    el.style.display = 'none';
  });
  const section = document.getElementById('section-' + nom);
  if (section) section.style.display = 'block';
}

async function chargerStatsRapides() {
  try {
    const [resCredits, resAssurances, resNotifs] = await Promise.all([
      API.get('/credits/mes-demandes/'),
      API.get('/insurance/mes-souscriptions/'),
      API.get('/notifications/'),
    ]);

    if (resCredits.ok) {
      const credits = resCredits.data;
      document.getElementById('stat-total-credits').textContent = credits.length;
      const actifs = credits.filter(c =>
        ['approuvee', 'decaissee'].includes(c.statut)
      ).length;
      document.getElementById('stat-credits-actifs').textContent = actifs;
    }

    if (resAssurances.ok) {
      const actives = resAssurances.data.filter(s => s.statut === 'active').length;
      document.getElementById('stat-assurances').textContent = actives;
    }

    if (resNotifs.ok) {
      document.getElementById('stat-notifications').textContent =
        resNotifs.data.non_lues || 0;
    }

  } catch (err) {
    console.error('Erreur chargement stats:', err);
  }
}

async function chargerDerniersCredits() {
  const conteneur = document.getElementById('liste-derniers-credits');
  try {
    const res = await API.get('/credits/mes-demandes/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur de chargement.</p>'; return; }

    const credits = res.data.slice(0, 3);

    if (credits.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-inbox" style="font-size:2rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:8px;font-size:0.9rem">
            Aucune demande de credit
          </p>
          <button class="btn-cf-primary btn mt-2"
                  onclick="afficherSection('nouvelle-demande')">
            Faire une demande
          </button>
        </div>`;
      return;
    }

    conteneur.innerHTML = credits.map(c => {
      const prog = progressCredit(c.statut);
      return `
      <div style="
        padding:14px;border-radius:var(--cf-radius);
        background:var(--cf-surface-2);margin-bottom:10px">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <div style="font-weight:700;font-size:0.9rem">
              ${UI.montant(c.montant_demande)}
            </div>
            <div style="font-size:0.78rem;color:var(--cf-text-muted)">
              ${c.duree_mois} mois — ${UI.date(c.created_at)}
            </div>
          </div>
          ${UI.statutBadge(c.statut)}
        </div>
        <div class="cf-credit-progress">
          <div class="cf-credit-progress-fill"
               style="width:${prog.pct}%;background:${prog.color}"></div>
        </div>
        <div class="cf-progress-label">${prog.label}</div>
      </div>`;
    }).join('');

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
  }
}

async function chargerDernieresNotifications() {
  const conteneur = document.getElementById('liste-notifs-accueil');
  try {
    const res = await API.get('/notifications/?non_lues=true');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const notifs = res.data.resultats.slice(0, 4);

    if (notifs.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-bell-slash" style="font-size:2rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:8px;font-size:0.9rem">
            Aucune notification
          </p>
        </div>`;
      return;
    }

    conteneur.innerHTML = notifs.map(n => `
      <div style="
        padding:12px;border-radius:var(--cf-radius);
        background:var(--cf-surface-2);margin-bottom:8px;
        border-left:3px solid var(--cf-orange)">
        <div style="font-weight:700;font-size:0.85rem">${n.titre}</div>
        <div style="font-size:0.78rem;color:var(--cf-text-muted);margin-top:2px">
          ${n.message.substring(0, 80)}...
        </div>
      </div>`).join('');

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

/* ============================================================
   B — PROGRESSION STATUT CRÉDIT
   ============================================================ */
function progressCredit(statut) {
  const map = {
    soumise:    { pct: 25,  color: '#3B82F6', label: 'Dossier soumis'       },
    en_analyse: { pct: 55,  color: 'var(--cf-orange)', label: 'En cours d\'analyse' },
    approuvee:  { pct: 80,  color: 'var(--cf-green)',  label: 'Approuvé — en attente de décaissement' },
    decaissee:  { pct: 100, color: 'var(--cf-green)',  label: 'Fonds décaissés ✓' },
    rejetee:    { pct: 100, color: '#EF4444', label: 'Dossier rejeté' },
  };
  return map[statut] || { pct: 0, color: 'var(--cf-border)', label: '' };
}

/* ============================================================
   MES CREDITS
   ============================================================ */
async function chargerCredits() {
  const conteneur = document.getElementById('table-credits');
  try {
    const res = await API.get('/credits/mes-demandes/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const credits = res.data;

    if (credits.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-cash-stack" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">
            Vous n'avez pas encore de demande de credit.
          </p>
          <button class="btn-cf-primary btn mt-2"
                  onclick="afficherSection('nouvelle-demande')">
            Faire ma premiere demande
          </button>
        </div>`;
      return;
    }

    conteneur.innerHTML = `
      <div style="overflow-x:auto">
        <table class="cf-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Montant demande</th>
              <th>Montant approuve</th>
              <th>Duree</th>
              <th>Statut</th>
              <th>Score</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${credits.map(c => `
              <tr>
                <td style="font-weight:700">#${c.id}</td>
                <td>${UI.montant(c.montant_demande)}</td>
                <td>${c.montant_approuve ? UI.montant(c.montant_approuve) : '--'}</td>
                <td>${c.duree_mois} mois</td>
                <td>${UI.statutBadge(c.statut)}</td>
                <td>
                  ${c.score_eligibilite
                    ? `<span style="font-weight:700;color:var(--cf-green)">${c.score_eligibilite}/100</span>`
                    : '--'}
                </td>
                <td style="color:var(--cf-text-muted);font-size:0.82rem">
                  ${UI.date(c.created_at)}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
  }
}

/* ============================================================
   NOUVELLE DEMANDE DE CREDIT
   ============================================================ */
async function soumettreDemandeCredit() {
  const montant = document.getElementById('montant-demande').value;
  const duree   = document.getElementById('duree-demande').value;
  const motif   = document.getElementById('motif-demande').value.trim();
  const btn     = document.getElementById('btn-soumettre-demande');

  if (!montant || !duree || !motif) {
    afficherAlerteDemande('Veuillez remplir tous les champs.', 'error');
    return;
  }

  if (parseInt(montant) < 50000) {
    afficherAlerteDemande('Le montant minimum est de 50 000 FCFA.', 'error');
    return;
  }

  UI.btnLoading(btn, true);

  try {
    const res = await API.post('/credits/soumettre/', {
      montant_demande: montant,
      duree_mois: parseInt(duree),
      motif,
    });

    if (!res.ok) {
      const erreur = Object.values(res.data)[0];
      afficherAlerteDemande(Array.isArray(erreur) ? erreur[0] : erreur, 'error');
      UI.btnLoading(btn, false);
      return;
    }

    afficherAlerteDemande(
      'Votre demande a ete soumise avec succes ! Un agent va l\'examiner.',
      'success'
    );

    /* Reinitialiser le formulaire */
    document.getElementById('montant-demande').value = '';
    document.getElementById('duree-demande').value   = '';
    document.getElementById('motif-demande').value   = '';

    /* Recharger les stats */
    chargerStatsRapides();

    setTimeout(() => afficherSection('credits'), 2000);

  } catch (err) {
    afficherAlerteDemande('Une erreur est survenue.', 'error');
  }

  UI.btnLoading(btn, false);
}

function afficherAlerteDemande(msg, type) {
  const alerte = document.getElementById('alerte-demande');
  const icon   = document.getElementById('alerte-demande-icon');
  const msgEl  = document.getElementById('alerte-demande-msg');
  const icones = {
    success: 'bi bi-check-circle',
    error:   'bi bi-exclamation-circle',
    info:    'bi bi-info-circle',
  };
  alerte.className = `cf-alert cf-alert-${type} mb-4 show`;
  icon.className   = icones[type] || 'bi bi-info-circle';
  msgEl.textContent = msg;
}

/* ============================================================
   REMBOURSEMENTS
   ============================================================ */
async function chargerRemboursements() {
  const conteneur = document.getElementById('table-remboursements');
  try {
    const res = await API.get('/repayments/mon-historique/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const paiements = res.data;

    if (paiements.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-arrow-repeat" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">
            Aucun remboursement enregistre.
          </p>
        </div>`;
      return;
    }

    conteneur.innerHTML = `
      <div style="overflow-x:auto">
        <table class="cf-table">
          <thead>
            <tr>
              <th>Echeance</th>
              <th>Montant paye</th>
              <th>Mode</th>
              <th>Reference</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${paiements.map(p => `
              <tr>
                <td>Echeance #${p.echeance}</td>
                <td style="font-weight:700;color:var(--cf-green)">
                  ${UI.montant(p.montant_paye)}
                </td>
                <td>
                  <span class="cf-badge cf-badge-blue">
                    ${p.mode_paiement.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td style="font-size:0.82rem;color:var(--cf-text-muted)">
                  ${p.reference_transaction || '--'}
                </td>
                <td style="font-size:0.82rem;color:var(--cf-text-muted)">
                  ${UI.date(p.date_paiement)}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
  }
}

/* ============================================================
   ASSURANCES
   ============================================================ */
async function chargerAssurances() {
  const conteneur = document.getElementById('table-assurances');
  try {
    const res = await API.get('/insurance/mes-souscriptions/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const souscriptions = res.data;

    if (souscriptions.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-shield" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">
            Aucune souscription d'assurance.
          </p>
          <button class="btn-cf-secondary btn mt-2"
                  onclick="afficherSection('souscrire')">
            Decouvrir nos produits
          </button>
        </div>`;
      return;
    }

    conteneur.innerHTML = `
      <div style="overflow-x:auto">
        <table class="cf-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Statut</th>
              <th>Date debut</th>
              <th>Date fin</th>
              <th>Jours restants</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${souscriptions.map(s => `
              <tr>
                <td style="font-weight:700">${s.produit_detail.nom}</td>
                <td>${UI.statutBadge(s.statut)}</td>
                <td style="font-size:0.82rem">${UI.date(s.date_debut)}</td>
                <td style="font-size:0.82rem">${UI.date(s.date_fin)}</td>
                <td>
                  ${s.statut === 'active'
                    ? `<span style="font-weight:700;color:var(--cf-green)">${s.jours_restants}j</span>`
                    : '--'}
                </td>
                <td>
                  ${s.statut === 'active'
                    ? `<button class="btn btn-sm"
                               style="background:rgba(239,68,68,0.1);color:#EF4444;border-radius:var(--cf-radius-sm);border:none;font-size:0.8rem;font-weight:600"
                               onclick="resilierAssurance(${s.id})">
                         Resilier
                       </button>`
                    : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
  }
}

async function resilierAssurance(id) {
  if (!confirm('Confirmer la resiliation de cette assurance ?')) return;

  const res = await API.post(`/insurance/${id}/resilier/`);
  if (res.ok) {
    chargerAssurances();
    chargerStatsRapides();
  }
}

/* ============================================================
   SOUSCRIRE A UNE ASSURANCE
   ============================================================ */
async function chargerProduits() {
  const conteneur = document.getElementById('liste-produits-assurance');
  document.getElementById('form-souscription').style.display = 'none';

  try {
    const res = await API.get('/insurance/produits/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    conteneur.innerHTML = res.data.map(p => `
      <div class="col-lg-4 col-md-6">
        <div class="cf-card h-100">
          <div style="
            width:52px;height:52px;border-radius:var(--cf-radius);
            background:rgba(0,168,107,0.1);
            display:flex;align-items:center;justify-content:center;
            margin-bottom:16px">
            <i class="bi bi-shield-check fs-4" style="color:var(--cf-green)"></i>
          </div>
          <h6 style="font-weight:700">${p.nom}</h6>
          <p style="font-size:0.82rem;color:var(--cf-text-muted);line-height:1.6">
            ${p.description}
          </p>
          <div style="
            background:var(--cf-surface-2);
            border-radius:var(--cf-radius-sm);
            padding:12px;margin:12px 0">
            <div class="d-flex justify-content-between" style="font-size:0.82rem">
              <span style="color:var(--cf-text-muted)">Prime mensuelle</span>
              <span style="font-weight:700;color:var(--cf-orange)">
                ${UI.montant(p.prime_mensuelle)}
              </span>
            </div>
            <div class="d-flex justify-content-between mt-1" style="font-size:0.82rem">
              <span style="color:var(--cf-text-muted)">Couverture</span>
              <span style="font-weight:700;color:var(--cf-green)">
                ${UI.montant(p.montant_couverture)}
              </span>
            </div>
            <div class="d-flex justify-content-between mt-1" style="font-size:0.82rem">
              <span style="color:var(--cf-text-muted)">Duree</span>
              <span style="font-weight:600">${p.duree_mois} mois</span>
            </div>
          </div>
          <button class="btn-cf-secondary btn w-100"
                  onclick="preparerSouscription(${p.id}, '${p.nom}', '${p.prime_mensuelle}')">
            Souscrire
          </button>
        </div>
      </div>`).join('');

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted col-12">Erreur de chargement.</p>';
  }
}

function preparerSouscription(produitId, nom, prime) {
  produitSelectionne = produitId;

  document.getElementById('resume-produit').innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">${nom}</div>
    <div style="font-size:0.85rem;color:var(--cf-text-muted)">
      Prime mensuelle : <strong style="color:var(--cf-orange)">${UI.montant(prime)}</strong>
    </div>`;

  document.getElementById('form-souscription').style.display = 'block';
  document.getElementById('form-souscription').scrollIntoView({ behavior: 'smooth' });
}

async function confirmerSouscription() {
  const ref = document.getElementById('ref-paiement').value.trim();
  const btn = document.getElementById('btn-confirmer-souscription');

  if (!ref) {
    afficherAlerteSouscription('Veuillez entrer la reference de paiement.', 'error');
    return;
  }

  UI.btnLoading(btn, true);

  const res = await API.post('/insurance/souscrire/', {
    produit: produitSelectionne,
    reference_paiement: ref,
  });

  if (res.ok) {
    afficherAlerteSouscription('Souscription confirmee avec succes !', 'success');
    setTimeout(() => {
      document.getElementById('form-souscription').style.display = 'none';
      afficherSection('assurances');
    }, 1500);
  } else {
    const erreur = Object.values(res.data)[0];
    afficherAlerteSouscription(Array.isArray(erreur) ? erreur[0] : erreur, 'error');
    UI.btnLoading(btn, false);
  }
}

function afficherAlerteSouscription(msg, type) {
  const alerte = document.getElementById('alerte-souscription');
  const icon   = document.getElementById('alerte-souscription-icon');
  const msgEl  = document.getElementById('alerte-souscription-msg');
  const icones = { success: 'bi bi-check-circle', error: 'bi bi-exclamation-circle' };
  alerte.className  = `cf-alert cf-alert-${type} mb-3 show`;
  icon.className    = icones[type];
  msgEl.textContent = msg;
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
async function chargerNotifications() {
  const conteneur = document.getElementById('liste-notifications');
  try {
    const res = await API.get('/notifications/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const notifs = res.data.resultats;

    if (notifs.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-bell-slash" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">
            Aucune notification.
          </p>
        </div>`;
      return;
    }

    conteneur.innerHTML = notifs.map(n => `
      <div style="
        padding:16px;border-radius:var(--cf-radius);
        background:${n.est_lue ? 'var(--cf-surface-2)' : 'var(--cf-surface)'};
        border:1px solid ${n.est_lue ? 'var(--cf-border)' : 'var(--cf-orange)'};
        margin-bottom:10px;
        border-left:4px solid ${n.est_lue ? 'var(--cf-border)' : 'var(--cf-orange)'};
        transition:var(--cf-transition)"
        id="notif-${n.id}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${n.titre}</div>
            <div style="font-size:0.82rem;color:var(--cf-text-muted);margin-top:4px;line-height:1.5">
              ${n.message}
            </div>
            <div style="font-size:0.72rem;color:var(--cf-text-muted);margin-top:6px">
              ${UI.date(n.created_at)}
            </div>
          </div>
          ${!n.est_lue
            ? `<button class="btn btn-sm ms-3"
                       style="background:rgba(255,107,0,0.1);color:var(--cf-orange);border:none;border-radius:var(--cf-radius-sm);font-size:0.75rem;white-space:nowrap"
                       onclick="marquerLue(${n.id})">
                 Marquer lu
               </button>`
            : ''}
        </div>
      </div>`).join('');

  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

async function marquerLue(id) {
  const res = await API.patch(`/notifications/${id}/lire/`);
  if (res.ok) {
    const el = document.getElementById('notif-' + id);
    if (el) {
      el.style.borderColor      = 'var(--cf-border)';
      el.style.borderLeftColor  = 'var(--cf-border)';
      el.style.background       = 'var(--cf-surface-2)';
      const btn = el.querySelector('button');
      if (btn) btn.remove();
    }
    chargerStatsRapides();
    UI.updateNotifBadge();
  }
}

async function toutMarquerLu() {
  const res = await API.post('/notifications/tout-lire/');
  if (res.ok) {
    chargerNotifications();
    chargerStatsRapides();
    UI.updateNotifBadge();
  }
}

/* ============================================================
   CHAT SUPPORT
   ============================================================ */
async function initialiserChat() {
  const user = Session.getUser();

  try {
    /* Ouvrir ou recuperer la conversation */
    const res = await API.post('/chat/ouvrir/');
    if (!res.ok) {
      document.getElementById('chat-statut-label').textContent =
        'Impossible d\'ouvrir une conversation.';
      return;
    }

    chatConversationId = res.data.id;

    /* Charger l'historique */
    const resMsg = await API.get(`/chat/${chatConversationId}/messages/`);
    if (resMsg.ok) {
      afficherHistoriqueChat(resMsg.data, user);
    }

    document.getElementById('chat-statut-label').textContent =
      `Conversation #${chatConversationId} — ${res.data.statut_display}`;

    /* Connecter le WebSocket */
    connecterChatWS();

  } catch (err) {
    document.getElementById('chat-statut-label').textContent = 'Erreur de connexion.';
  }
}

function afficherHistoriqueChat(messages, user) {
  const zone = document.getElementById('chat-messages');
  if (messages.length === 0) {
    zone.innerHTML = `
      <div style="text-align:center;font-size:0.82rem;color:var(--cf-text-muted);font-style:italic">
        Demarrez la conversation en envoyant un message.
      </div>`;
    return;
  }
  zone.innerHTML = '';
  messages.forEach(msg => {
    ajouterMessageChat(msg.contenu, msg.auteur_username, msg.auteur_role,
      msg.created_at, msg.auteur === user.id);
  });
}

function connecterChatWS() {
  const token = Session.getToken();
  const url   = `ws://127.0.0.1:8000/ws/chat/${chatConversationId}/?token=${token}`;
  chatSocket  = new WebSocket(url);
  const dot   = document.getElementById('chat-ws-dot');

  chatSocket.onopen = () => {
    if (dot) dot.style.background = '#00A86B';
    document.getElementById('chat-statut-label').textContent += ' — Connecte';
  };

  chatSocket.onclose = () => {
    if (dot) dot.style.background = '#EF4444';
  };

  chatSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const user = Session.getUser();

    if (data.type === 'message') {
      const estMoi = data.auteur === user.username;
      ajouterMessageChat(data.contenu, data.auteur, data.auteur_role,
        data.created_at, estMoi);
    }

    if (data.type === 'typing') {
      const ind = document.getElementById('chat-typing');
      if (data.username !== user.username) {
        ind.textContent = data.est_en_train_d_ecrire
          ? `${data.username} est en train d'ecrire...`
          : '';
      }
    }

    if (data.type === 'presence') {
      const verbe = data.event === 'connecte' ? 'a rejoint' : 'a quitte';
      ajouterSystemeChat(`${data.username} ${verbe} la conversation.`);
    }
  };
}

function ajouterMessageChat(contenu, auteur, role, createdAt, estMoi) {
  const zone = document.getElementById('chat-messages');
  const vide = zone.querySelector('div[style*="font-style:italic"]');
  if (vide) vide.remove();

  const div = document.createElement('div');
  div.style.cssText = `
    max-width:75%;
    padding:10px 14px;
    border-radius:${estMoi ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
    background:${estMoi ? 'var(--cf-orange)' : 'var(--cf-surface)'};
    color:${estMoi ? '#fff' : 'var(--cf-text)'};
    align-self:${estMoi ? 'flex-end' : 'flex-start'};
    border:1px solid ${estMoi ? 'transparent' : 'var(--cf-border)'}`;

  div.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;margin-bottom:4px;
         color:${estMoi ? 'rgba(255,255,255,0.8)' : 'var(--cf-orange)'}">
      ${auteur}
    </div>
    ${contenu}
    <div style="font-size:0.65rem;margin-top:4px;
         color:${estMoi ? 'rgba(255,255,255,0.6)' : 'var(--cf-text-muted)'}">
      ${createdAt ? new Date(createdAt).toLocaleTimeString('fr-FR',
        {hour:'2-digit', minute:'2-digit'}) : ''}
    </div>`;

  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function ajouterSystemeChat(texte) {
  const zone = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  div.style.cssText = 'text-align:center;font-size:0.75rem;color:var(--cf-text-muted);font-style:italic;padding:4px 0';
  div.textContent = texte;
  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function chatEnvoyerMessage() {
  const input   = document.getElementById('chat-input');
  const contenu = input.value.trim();
  if (!contenu || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
  chatSocket.send(JSON.stringify({ type: 'message', contenu }));
  input.value = '';
  if (chatEstEnTrain) {
    chatSocket.send(JSON.stringify({ type: 'typing', est_en_train_d_ecrire: false }));
    chatEstEnTrain = false;
  }
}

function chatGererTouche(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatEnvoyerMessage();
  }
}

function chatSignalerFrappe() {
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
  if (!chatEstEnTrain) {
    chatEstEnTrain = true;
    chatSocket.send(JSON.stringify({ type: 'typing', est_en_train_d_ecrire: true }));
  }
  clearTimeout(chatTypingTimeout);
  chatTypingTimeout = setTimeout(() => {
    chatEstEnTrain = false;
    chatSocket.send(JSON.stringify({ type: 'typing', est_en_train_d_ecrire: false }));
  }, 2000);
}