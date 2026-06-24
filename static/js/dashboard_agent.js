/* ============================================================
   COFINANCE CI - dashboard_agent.js
   Logique du tableau de bord agent
   ============================================================ */

'use strict';

/* ============================================================
   ETAT GLOBAL
   ============================================================ */
let dossierEnCours      = null;
let chatAgentSocket     = null;
let chatAgentConvId     = null;
let chatAgentTypingTimeout = null;
let chatAgentEstEnTrain = false;
let conversationsAgent  = [];      // cache des conversations chargées
let convAgentCourante   = null;    // conversation actuellement ouverte
let categoriesCacheAgent = [];     // cache des catégories disponibles
let filtreConvAgent     = 'actives'; // segment d'inbox support sélectionné

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  Session.redirectIfNotLoggedIn();
  const user = Session.getUser();
  if (user && !['agent', 'administrateur'].includes(user.role)) {
    Session.redirectToDashboard();
    return;
  }
  chargerVueEnsemble();
  chargerStatutDisponibilite();
});

/* ============================================================
   NAVIGATION
   ============================================================ */
function afficherSection(nom) {
  document.querySelectorAll('[id^="section-"]').forEach(el => {
    el.style.display = 'none';
  });
  const section = document.getElementById('section-' + nom);
  if (section) section.style.display = 'block';

  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.remove('active');
  });
  const lien = document.getElementById('nav-' + nom);
  if (lien) lien.classList.add('active');

  const chargeurs = {
    accueil:       chargerVueEnsemble,
    dossiers:      () => chargerDossiers(''),
    paiements:     () => { chargerPaiementsAValider(); chargerEcheancesAVenir(); },
    penalites:     chargerPenalites,
    conversations: chargerConversations,
    profil:        chargerProfil,
  };
  if (chargeurs[nom]) chargeurs[nom]();
}

/* ============================================================
   DISPONIBILITE
   ============================================================ */
async function chargerStatutDisponibilite() {
  try {
    const res = await API.get('/auth/profile/');
    if (res.ok) mettreAJourBoutonDispo(res.data.est_disponible);
  } catch (err) {}
}

function mettreAJourBoutonDispo(estDispo) {
  const btn    = document.getElementById('btn-toggle-dispo');
  const label  = document.getElementById('label-dispo');
  const icon   = document.getElementById('icon-dispo');
  const badge  = document.getElementById('badge-disponibilite');

  if (estDispo) {
    btn.style.background   = 'rgba(0,168,107,0.1)';
    btn.style.borderColor  = 'var(--cf-green)';
    btn.style.color        = 'var(--cf-green)';
    label.textContent      = 'Disponible';
    icon.className         = 'bi bi-circle-fill me-2';
    badge.className        = 'cf-badge cf-badge-green';
    badge.textContent      = 'Disponible';
  } else {
    btn.style.background   = 'var(--cf-surface)';
    btn.style.borderColor  = 'var(--cf-border)';
    btn.style.color        = 'var(--cf-text-muted)';
    label.textContent      = 'Se rendre disponible';
    icon.className         = 'bi bi-circle me-2';
    badge.className        = 'cf-badge cf-badge-gray';
    badge.textContent      = 'Indisponible';
  }
}

async function toggleDisponibilite() {
  const btn = document.getElementById('btn-toggle-dispo');
  UI.btnLoading(btn, true);
  try {
    const res = await API.post('/auth/toggle-disponibilite/');
    if (res.ok) mettreAJourBoutonDispo(res.data.est_disponible);
  } catch (err) {}
  UI.btnLoading(btn, false);
}

/* ============================================================
   VUE D'ENSEMBLE
   ============================================================ */
async function chargerVueEnsemble() {
  document.querySelectorAll('[id^="section-"]').forEach(el => {
    el.style.display = 'none';
  });
  document.getElementById('section-accueil').style.display = 'block';

  await Promise.all([
    chargerStatsAgent(),
    chargerDossiersRecents(),
    chargerConvsRecentes(),
  ]);
}

async function chargerStatsAgent() {
  try {
    const [resDossiers, resConvs] = await Promise.all([
      API.get('/credits/'),
      API.get('/chat/toutes/'),
    ]);

    if (resDossiers.ok) {
      const d = resDossiers.data;
      document.getElementById('stat-dossiers-total').textContent = d.length;
      document.getElementById('stat-dossiers-attente').textContent =
        d.filter(x => x.statut === 'soumise').length;
      document.getElementById('stat-dossiers-approuves').textContent =
        d.filter(x => x.statut === 'approuvee').length;
      renderChartDossiersAgent(d);
    }

    if (resConvs.ok) {
      const enAttente = resConvs.data.filter(c =>
        ['en_attente', 'en_cours'].includes(c.statut)
      ).length;
      document.getElementById('stat-convs-attente').textContent = enAttente;

      const badge = document.getElementById('badge-convs-attente');
      if (enAttente > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent   = enAttente;
      }
    }
  } catch (err) {}
}

async function chargerDossiersRecents() {
  const conteneur = document.getElementById('liste-dossiers-recents');
  try {
    const res = await API.get('/credits/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const dossiers = res.data.slice(0, 4);

    if (dossiers.length === 0) {
      conteneur.innerHTML = `
        <p style="color:var(--cf-text-muted);text-align:center;padding:20px 0">
          Aucun dossier.
        </p>`;
      return;
    }

    conteneur.innerHTML = dossiers.map(d => `
      <div style="
        padding:12px;border-radius:var(--cf-radius);
        background:var(--cf-surface-2);margin-bottom:8px;
        cursor:pointer;transition:var(--cf-transition)"
        onclick="ouvrirTraitement(${d.id})"
        onmouseover="this.style.background='var(--cf-surface)'"
        onmouseout="this.style.background='var(--cf-surface-2)'">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div style="font-weight:700;font-size:0.88rem">
              #${d.id} — ${d.client_username}
            </div>
            <div style="font-size:0.78rem;color:var(--cf-text-muted)">
              ${UI.montant(d.montant_demande)} — ${d.duree_mois} mois
            </div>
          </div>
          ${UI.statutBadge(d.statut)}
        </div>
      </div>`).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

async function chargerConvsRecentes() {
  const conteneur = document.getElementById('liste-convs-recentes');
  try {
    const res = await API.get('/chat/toutes/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const convs = res.data
      .filter(c => ['en_attente', 'en_cours'].includes(c.statut))
      .slice(0, 4);

    if (convs.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-chat-dots" style="font-size:2rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);font-size:0.88rem;margin-top:8px">
            Aucune conversation active
          </p>
        </div>`;
      return;
    }

    conteneur.innerHTML = convs.map(c => `
      <div style="
        padding:12px;border-radius:var(--cf-radius);
        background:var(--cf-surface-2);margin-bottom:8px;
        cursor:pointer;transition:var(--cf-transition)"
        onclick="afficherSection('conversations')"
        onmouseover="this.style.background='var(--cf-surface)'"
        onmouseout="this.style.background='var(--cf-surface-2)'">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${c.client_username}</div>
            <div style="font-size:0.78rem;color:var(--cf-text-muted)">
              Conv. #${c.id}
            </div>
          </div>
          ${UI.statutBadge(c.statut)}
        </div>
      </div>`).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

/* ============================================================
   DOSSIERS CREDITS
   ============================================================ */
async function chargerDossiers(filtre) {
  const conteneur = document.getElementById('table-dossiers');
  conteneur.innerHTML = '<div class="text-center py-4"><div class="cf-spinner mx-auto"></div></div>';
  try {
    const url = filtre ? `/credits/?statut=${filtre}` : '/credits/';
    const res = await API.get(url);
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const dossiers = res.data;

    if (dossiers.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-folder" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">Aucun dossier.</p>
        </div>`;
      return;
    }

    conteneur.innerHTML = `
      <div style="overflow-x:auto">
        <table class="cf-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Client</th>
              <th>Montant</th>
              <th>Duree</th>
              <th>Statut</th>
              <th>Score</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${dossiers.map(d => `
              <tr>
                <td style="font-weight:700">#${d.id}</td>
                <td>${d.client_username}</td>
                <td>${UI.montant(d.montant_demande)}</td>
                <td>${d.duree_mois} mois</td>
                <td>${UI.statutBadge(d.statut)}</td>
                <td>${d.score_eligibilite
                  ? `<span style="font-weight:700;color:var(--cf-green)">${d.score_eligibilite}/100</span>`
                  : '--'}</td>
                <td style="font-size:0.82rem;color:var(--cf-text-muted)">
                  ${UI.date(d.created_at)}
                </td>
                <td>
                  ${!['decaissee','rejetee'].includes(d.statut)
                    ? `<button class="btn btn-sm"
                               style="background:rgba(255,107,0,0.1);color:var(--cf-orange);border:none;border-radius:var(--cf-radius-sm);font-size:0.8rem;font-weight:600"
                               onclick="ouvrirTraitement(${d.id}, '${d.statut}')">
                         Traiter
                       </button>`
                    : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

function filtrerDossiers(statut, btn) {
  document.querySelectorAll('.filtre-btn').forEach(b => {
    b.style.background = 'var(--cf-surface-2)';
    b.style.color      = 'var(--cf-text-muted)';
    b.style.border     = '1px solid var(--cf-border)';
  });
  btn.style.background = 'var(--cf-orange)';
  btn.style.color      = '#fff';
  btn.style.border     = 'none';
  chargerDossiers(statut);
}

// Transitions autorisees par la machine a etats du credit (miroir du backend :
// credits/serializers/demande.py). On n'expose que l'etape suivante possible
// pour ne pas proposer un saut qui serait refuse cote serveur.
const TRANSITIONS_CREDIT = {
  soumise:    [['en_analyse', 'Passer en analyse'], ['rejetee', 'Rejeter']],
  en_analyse: [['approuvee', 'Approuver'],          ['rejetee', 'Rejeter']],
  approuvee:  [['decaissee', 'Marquer decaisse'],   ['rejetee', 'Rejeter']],
};

function remplirOptionsStatut(statut) {
  const options = TRANSITIONS_CREDIT[statut] || [];
  document.getElementById('select-statut').innerHTML = options
    .map(([val, label]) => `<option value="${val}">${label}</option>`)
    .join('');
  onStatutChange();
  return options.length > 0;   // false => statut terminal (decaissee / rejetee)
}

function ouvrirTraitement(id, statutActuel) {
  dossierEnCours = id;
  document.getElementById('montant-approuve').value  = '';
  document.getElementById('commentaire-agent').value = '';
  remplirOptionsStatut(statutActuel);

  document.getElementById('modal-dossier-id').textContent = `#${id}`;
  document.getElementById('alerte-traitement').classList.remove('show');
  document.getElementById('modal-traitement').style.display = 'block';
  document.getElementById('modal-traitement').scrollIntoView({ behavior: 'smooth' });
  afficherSection_agent('dossiers');
}

function afficherSection_agent(nom) {
  document.querySelectorAll('[id^="section-"]').forEach(el => {
    el.style.display = 'none';
  });
  document.getElementById('section-' + nom).style.display = 'block';
}

function onStatutChange() {
  const statut = document.getElementById('select-statut').value;
  document.getElementById('champ-montant').style.display =
    statut === 'approuvee' ? 'block' : 'none';
}

async function validerTraitement() {
  const statut     = document.getElementById('select-statut').value;
  const montant    = document.getElementById('montant-approuve').value;
  const commentaire = document.getElementById('commentaire-agent').value.trim();
  const btn        = document.getElementById('btn-valider-traitement');

  if (statut === 'approuvee' && !montant) {
    afficherAlerteTraitement('Le montant approuve est obligatoire.', 'error');
    return;
  }

  UI.btnLoading(btn, true);

  const payload = { statut, commentaire_agent: commentaire };
  if (statut === 'approuvee') payload.montant_approuve = montant;

  const res = await API.patch(`/credits/${dossierEnCours}/traiter/`, payload);

  if (res.ok) {
    chargerDossiers('');
    chargerStatsAgent();

    const nouveau = res.data.statut;
    document.getElementById('montant-approuve').value  = '';
    document.getElementById('commentaire-agent').value = '';

    // On garde la modale ouverte et on propose l'etape suivante (workflow fluide).
    const peutContinuer = remplirOptionsStatut(nouveau);
    UI.btnLoading(btn, false);

    if (peutContinuer) {
      afficherAlerteTraitement(
        `Etape validee (${nouveau.replace('_', ' ')}). Vous pouvez poursuivre.`, 'success');
    } else {
      afficherAlerteTraitement('Dossier finalise.', 'success');
      setTimeout(() => {
        document.getElementById('modal-traitement').style.display = 'none';
      }, 1200);
    }
  } else {
    const erreur = Object.values(res.data)[0];
    afficherAlerteTraitement(Array.isArray(erreur) ? erreur[0] : erreur, 'error');
    UI.btnLoading(btn, false);
  }
}

function afficherAlerteTraitement(msg, type) {
  const alerte = document.getElementById('alerte-traitement');
  const icon   = document.getElementById('alerte-traitement-icon');
  const msgEl  = document.getElementById('alerte-traitement-msg');
  const icones = { success: 'bi bi-check-circle', error: 'bi bi-exclamation-circle' };
  alerte.className  = `cf-alert cf-alert-${type} mb-3 show`;
  icon.className    = icones[type];
  msgEl.textContent = msg;
}

/* ============================================================
   ENREGISTRER PAIEMENT
   ============================================================ */
async function enregistrerPaiement() {
  const echeance  = document.getElementById('paiement-echeance-id').value;
  const montant   = document.getElementById('paiement-montant').value;
  const mode      = document.getElementById('paiement-mode').value;
  const reference = document.getElementById('paiement-reference').value.trim();
  const btn       = document.getElementById('btn-enregistrer-paiement');

  if (!echeance || !montant) {
    afficherAlertePaiement('Remplissez l\'ID de l\'echeance et le montant.', 'error');
    return;
  }

  UI.btnLoading(btn, true);

  const res = await API.post('/repayments/payer/', {
    echeance:             parseInt(echeance),
    montant_paye:         montant,
    mode_paiement:        mode,
    reference_transaction: reference,
  });

  if (res.ok) {
    afficherAlertePaiement('Paiement enregistre avec succes !', 'success');
    document.getElementById('paiement-echeance-id').value = '';
    document.getElementById('paiement-montant').value     = '';
    document.getElementById('paiement-reference').value   = '';
    chargerEcheancesAVenir();   // rafraichir la liste des echeances a encaisser
  } else {
    const erreur = Object.values(res.data)[0];
    afficherAlertePaiement(Array.isArray(erreur) ? erreur[0] : erreur, 'error');
  }

  UI.btnLoading(btn, false);
}

function afficherAlertePaiement(msg, type) {
  const alerte = document.getElementById('alerte-paiement');
  const icon   = document.getElementById('alerte-paiement-icon');
  const msgEl  = document.getElementById('alerte-paiement-msg');
  const icones = { success: 'bi bi-check-circle', error: 'bi bi-exclamation-circle' };
  alerte.className  = `cf-alert cf-alert-${type} mb-4 show`;
  icon.className    = icones[type];
  msgEl.textContent = msg;
}

/* ============================================================
   PENALITES
   ============================================================ */
async function chargerPenalites() {
  const conteneur = document.getElementById('table-penalites');
  try {
    const res = await API.get('/repayments/penalites/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const penalites = res.data;

    if (penalites.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-check-circle" style="font-size:3rem;color:var(--cf-green)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">
            Aucune penalite enregistree.
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
              <th>Montant penalite</th>
              <th>Jours de retard</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${penalites.map(p => `
              <tr>
                <td>Echeance #${p.echeance}</td>
                <td style="font-weight:700;color:#EF4444">
                  ${UI.montant(p.montant)}
                </td>
                <td>
                  <span class="cf-badge cf-badge-red">${p.jours_retard} jours</span>
                </td>
                <td style="font-size:0.82rem;color:var(--cf-text-muted)">
                  ${UI.date(p.created_at)}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

/* ============================================================
   CONVERSATIONS ET CHAT
   ============================================================ */
/* Segments de l'inbox support. 'toutes' => pas de filtre. */
const SEGMENTS_CONV = {
  actives:    ['en_attente', 'en_cours'],
  en_attente: ['en_attente'],
  terminees:  ['resolue', 'fermee'],
  toutes:     null,
};
/* Ordre d'affichage : les conversations a traiter d'abord (urgence). */
const PRIORITE_CONV = { en_attente: 0, en_cours: 1, resolue: 2, fermee: 3 };

async function chargerConversations() {
  const conteneur = document.getElementById('liste-conversations');
  try {
    const res = await API.get('/chat/toutes/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }
    conversationsAgent = res.data;
    majComptesConversations();
    rendreListeConversations();
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

function filtrerConversations(filtre, btn) {
  filtreConvAgent = filtre;
  document.querySelectorAll('.cf-conv-filtre').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  rendreListeConversations();
}

function majComptesConversations() {
  const compter = (statuts) =>
    conversationsAgent.filter(c => statuts.includes(c.statut)).length;
  const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
  set('compte-actives',    compter(['en_attente', 'en_cours']));
  set('compte-en_attente', compter(['en_attente']));
  set('compte-terminees',  compter(['resolue', 'fermee']));
}

function rendreListeConversations() {
  const conteneur = document.getElementById('liste-conversations');
  if (!conteneur) return;

  const statuts = SEGMENTS_CONV[filtreConvAgent];   // null => toutes
  const liste = (statuts
    ? conversationsAgent.filter(c => statuts.includes(c.statut))
    : conversationsAgent.slice());

  // Urgence d'abord (en_attente), puis les plus recentes.
  liste.sort((a, b) =>
    (PRIORITE_CONV[a.statut] - PRIORITE_CONV[b.statut]) || (b.id - a.id));

  if (liste.length === 0) {
    conteneur.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-chat-dots" style="font-size:2rem;color:var(--cf-text-muted)"></i>
        <p style="color:var(--cf-text-muted);font-size:0.85rem;margin-top:8px">
          Aucune conversation ici.
        </p>
      </div>`;
    return;
  }

  conteneur.innerHTML = liste.map(c => {
    const actif     = chatAgentConvId === c.id;
    const enAttente = c.statut === 'en_attente';
    const nonLus    = c.nb_messages_non_lus || 0;
    return `
      <div class="cf-conv-item${actif ? ' actif' : ''}${enAttente ? ' attente' : ''}"
           onclick="ouvrirConversationAgent(${c.id})">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div style="min-width:0;flex:1">
            <div class="cf-conv-nom">${escapeChat(c.client_username || '')}</div>
            <div class="cf-conv-sujet">${escapeChat(c.sujet ? c.sujet : 'Conv. #' + c.id)}</div>
            ${renderTagsAgent(c.categories)}
          </div>
          <div class="d-flex flex-column align-items-end gap-1" style="flex-shrink:0">
            ${UI.statutBadge(c.statut)}
            ${nonLus > 0 ? `<span class="cf-conv-nonlus">${nonLus}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

async function ouvrirConversationAgent(convId) {
  chatAgentConvId = convId;
  let conv = conversationsAgent.find(c => c.id === convId);

  /* Rejoindre si en attente */
  if (conv && conv.statut === 'en_attente') {
    const r = await API.post(`/chat/${convId}/rejoindre/`);
    if (r.ok) conv = r.data;
  }
  convAgentCourante = conv || { id: convId };

  /* Afficher la zone chat */
  document.getElementById('chat-agent-placeholder').style.display = 'none';
  document.getElementById('chat-agent-actif').style.display = 'flex';

  document.getElementById('chat-agent-client-nom').textContent =
    convAgentCourante.client_username || 'Client';
  document.getElementById('chat-agent-conv-info').textContent =
    convAgentCourante.sujet || `Conversation #${convId}`;

  majBarreStatutAgent(convAgentCourante);

  /* Charger historique */
  const user   = Session.getUser();
  const resMsg = await API.get(`/chat/${convId}/messages/`);
  const zone   = document.getElementById('chat-agent-messages');
  zone.innerHTML = '';
  if (resMsg.ok) resMsg.data.forEach(msg => ajouterMsgAgent(msg, msg.auteur === user.id));

  /* Connecter WS */
  if (chatAgentSocket) chatAgentSocket.close();
  connecterChatAgentWS(convId);

  /* Rafraichir la liste */
  chargerConversations();
}

function connecterChatAgentWS(convId) {
  chatAgentSocket = new WebSocket(wsChatUrl(convId));
  const dot       = document.getElementById('chat-agent-ws-dot');

  chatAgentSocket.onopen  = () => { if (dot) dot.style.background = '#00A86B'; };
  chatAgentSocket.onclose = () => { if (dot) dot.style.background = '#EF4444'; };

  chatAgentSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const user = Session.getUser();

    if (data.type === 'message') {
      ajouterMsgAgent({
        message_id: data.message_id, contenu: data.contenu,
        auteur_username: data.auteur, created_at: data.created_at,
        piece_jointe_url: data.piece_jointe_url, piece_jointe_nom: data.piece_jointe_nom,
        est_recu: false, est_lu: false,
      }, data.auteur === user.username);
    }

    else if (data.type === 'typing') {
      const ind = document.getElementById('chat-agent-typing');
      if (data.username !== user.username) {
        ind.textContent = data.est_en_train_d_ecrire
          ? `${data.username} est en train d'ecrire...` : '';
      }
    }

    else if (data.type === 'statut') {
      if (convAgentCourante) {
        convAgentCourante.statut = data.statut;
        majBarreStatutAgent(convAgentCourante);
      }
      chargerConversations();
    }

    else if (data.type === 'receipt') {
      majRecusAgent(data.message_ids, data.etat);
    }
  };
}

function ajouterMsgAgent(msg, estMoi) {
  const zone = document.getElementById('chat-agent-messages');
  const div  = document.createElement('div');
  const mid  = msg.message_id != null ? msg.message_id : msg.id;  // WS=message_id, historique=id
  if (mid != null) div.dataset.msgId = mid;
  div.style.cssText = `
    max-width:75%;
    padding:10px 14px;
    border-radius:${estMoi ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
    background:${estMoi ? 'var(--cf-green)' : 'var(--cf-surface)'};
    color:${estMoi ? '#fff' : 'var(--cf-text)'};
    align-self:${estMoi ? 'flex-end' : 'flex-start'};
    word-break:break-word;
    overflow-wrap:anywhere;
    border:1px solid ${estMoi ? 'transparent' : 'var(--cf-border)'}`;

  const heure = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})
    : '';
  const recu = estMoi
    ? `<span class="cf-receipt ${msg.est_lu ? 'lu' : ''}" data-receipt="${mid}">${rendreRecu(msg.est_recu, msg.est_lu)}</span>`
    : '';

  div.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;margin-bottom:4px;
         color:${estMoi ? 'rgba(255,255,255,0.8)' : 'var(--cf-green)'}">
      ${escapeChat(msg.auteur_username || '')}
    </div>
    ${escapeChat(msg.contenu || '')}
    ${rendrePieceJointe(msg)}
    <div style="font-size:0.65rem;margin-top:4px;
         color:${estMoi ? 'rgba(255,255,255,0.6)' : 'var(--cf-text-muted)'}">
      ${heure}${recu}
    </div>`;

  zone.appendChild(div);
  zone.scrollTop = zone.scrollHeight;
}

function chatAgentEnvoyer() {
  const input   = document.getElementById('chat-agent-input');
  const contenu = input.value.trim();
  if (!contenu || !chatAgentSocket ||
      chatAgentSocket.readyState !== WebSocket.OPEN) return;
  chatAgentSocket.send(JSON.stringify({ type: 'message', contenu }));
  input.value = '';
  if (chatAgentEstEnTrain) {
    chatAgentSocket.send(JSON.stringify({
      type: 'typing', est_en_train_d_ecrire: false
    }));
    chatAgentEstEnTrain = false;
  }
}

function chatAgentGererTouche(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatAgentEnvoyer();
  }
}

function chatAgentSignalerFrappe() {
  if (!chatAgentSocket || chatAgentSocket.readyState !== WebSocket.OPEN) return;
  if (!chatAgentEstEnTrain) {
    chatAgentEstEnTrain = true;
    chatAgentSocket.send(JSON.stringify({
      type: 'typing', est_en_train_d_ecrire: true
    }));
  }
  clearTimeout(chatAgentTypingTimeout);
  chatAgentTypingTimeout = setTimeout(() => {
    chatAgentEstEnTrain = false;
    chatAgentSocket.send(JSON.stringify({
      type: 'typing', est_en_train_d_ecrire: false
    }));
  }, 2000);
}

/* ============================================================
   PROFIL
   ============================================================ */
async function chargerProfil() {
  try {
    const res = await API.get('/auth/profile/');
    if (res.ok) {
      document.getElementById('profil-email').value     = res.data.email || '';
      document.getElementById('profil-telephone').value = res.data.telephone || '';
      document.getElementById('profil-region').value    = res.data.region || '';
      document.getElementById('profil-specialite').value = res.data.specialite || '';
      document.getElementById('profil-disponible').checked = !!res.data.est_disponible;
    }
  } catch (err) {}
}

async function sauverProfil() {
  const btn = document.getElementById('btn-sauver-profil');
  UI.btnLoading(btn, true);

  const res = await API.patch('/auth/profile/', {
    email:          document.getElementById('profil-email').value,
    telephone:      document.getElementById('profil-telephone').value,
    region:         document.getElementById('profil-region').value,
    specialite:     document.getElementById('profil-specialite').value,
    est_disponible: document.getElementById('profil-disponible').checked,
  });

  const alerte = document.getElementById('alerte-profil');
  const icon   = document.getElementById('alerte-profil-icon');
  const msgEl  = document.getElementById('alerte-profil-msg');

  if (res.ok) {
    alerte.className  = 'cf-alert cf-alert-success mb-4 show';
    icon.className    = 'bi bi-check-circle';
    msgEl.textContent = 'Profil mis a jour avec succes.';
  } else {
    alerte.className  = 'cf-alert cf-alert-error mb-4 show';
    icon.className    = 'bi bi-exclamation-circle';
    msgEl.textContent = 'Erreur lors de la mise a jour.';
  }

  UI.btnLoading(btn, false);
}

/* ============================================================
   TEMPS REEL — rafraichissement live a l'arrivee d'une demande
   (evenement emis par realtime.js a la reception WebSocket)
   ============================================================ */
window.addEventListener('cf:dossier-nouveau', () => {
  if (typeof chargerDossiers === 'function')   chargerDossiers('');
  if (typeof chargerStatsAgent === 'function') chargerStatsAgent();
});

/* Toute nouvelle notification (detectee par WS ou polling) rafraichit les
   listes pertinentes — garantit le live meme sans WebSocket fiable. */
window.addEventListener('cf:notification', () => {
  if (typeof chargerStatsAgent === 'function')        chargerStatsAgent();
  if (typeof chargerDossiers === 'function')          chargerDossiers('');
  if (typeof chargerConversations === 'function')     chargerConversations();
  if (typeof chargerPaiementsAValider === 'function') chargerPaiementsAValider();
});

/* ============================================================
   TICKETS — helpers communs (agent)
   ============================================================ */
function wsChatUrl(convId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws/chat/${convId}/?token=${Session.getToken()}`;
}

function escapeChat(txt) {
  const d = document.createElement('div');
  d.textContent = txt;
  return d.innerHTML.replace(/\n/g, '<br>');
}

function rendreRecu(estRecu, estLu) {
  if (estLu)   return '&#10003;&#10003;';   // ✓✓ (lu → classe .lu pour la couleur)
  if (estRecu) return '&#10003;&#10003;';   // ✓✓
  return '&#10003;';                          // ✓ (envoyé)
}

function rendrePieceJointe(msg) {
  if (!msg.piece_jointe_url) return '';
  const nom = msg.piece_jointe_nom || 'fichier';
  if (/\.(jpe?g|png|gif|webp)$/i.test(nom)) {
    return `<a href="${msg.piece_jointe_url}" target="_blank" rel="noopener">
      <img src="${msg.piece_jointe_url}" alt="piece jointe"
           style="display:block;margin-top:6px;max-width:200px;max-height:160px;border-radius:8px"/></a>`;
  }
  return `<a class="cf-chat-attach" href="${msg.piece_jointe_url}" target="_blank" rel="noopener">
    <i class="bi bi-file-earmark-text"></i> ${escapeChat(nom)}</a>`;
}

function renderTagsAgent(categories) {
  if (!categories || !categories.length) return '';
  return `<div class="d-flex flex-wrap gap-1 mt-1">` +
    categories.map(c => `<span class="cf-chat-tag" style="background:${c.couleur}">${escapeChat(c.nom)}</span>`).join('') +
    `</div>`;
}

function majBarreStatutAgent(conv) {
  const s = document.getElementById('chat-agent-statut');
  if (s) s.innerHTML = UI.statutBadge(conv.statut);
  const t = document.getElementById('chat-agent-tags');
  if (t) t.innerHTML = (conv.categories || [])
    .map(c => `<span class="cf-chat-tag" style="background:${c.couleur}">${escapeChat(c.nom)}</span>`).join('');
}

function majRecusAgent(ids, etat) {
  (ids || []).forEach(id => {
    const el = document.querySelector(`#chat-agent-messages [data-receipt="${id}"]`);
    if (!el) return;
    if (etat === 'lu') { el.innerHTML = '&#10003;&#10003;'; el.classList.add('lu'); }
    else if (!el.classList.contains('lu')) { el.innerHTML = '&#10003;&#10003;'; }
  });
}

/* ============================================================
   TICKETS — actions agent (statut, transfert, tags, fichier)
   ============================================================ */
async function changerStatutConv(statut) {
  if (!chatAgentConvId) return;
  const res = await API.patch(`/chat/${chatAgentConvId}/statut/`, { statut });
  if (res.ok) {
    convAgentCourante = res.data;
    majBarreStatutAgent(res.data);
    Toast.show('Statut mis a jour.', 'success');
    chargerConversations();
  } else {
    Toast.show((res.data && res.data.detail) || 'Erreur.', 'error');
  }
}

async function ouvrirTransfert() {
  if (!chatAgentConvId) return;
  const res = await API.get('/chat/agents-transfert/');
  const sel = document.getElementById('transfert-agent');
  sel.innerHTML = (res.ok && res.data.length
    ? res.data.map(a => `<option value="${a.id}">${escapeChat(a.username)}`
        + `${a.specialite ? ' — ' + escapeChat(a.specialite) : ''}`
        + `${a.est_disponible ? ' (dispo)' : ''}</option>`).join('')
    : '<option value="">Aucun agent disponible</option>');
  document.getElementById('transfert-note').value = '';
  document.getElementById('modal-transfert').style.display = 'flex';
}

async function validerTransfert() {
  const agentId = document.getElementById('transfert-agent').value;
  const note    = document.getElementById('transfert-note').value.trim();
  if (!agentId) return;
  const res = await API.post(`/chat/${chatAgentConvId}/transferer/`, { agent_id: agentId, note });
  if (res.ok) {
    fermerModale('modal-transfert');
    Toast.show('Conversation transferee.', 'success');
    chargerConversations();
  } else {
    Toast.show((res.data && res.data.detail) || 'Erreur.', 'error');
  }
}

async function ouvrirTags() {
  if (!chatAgentConvId) return;
  if (!categoriesCacheAgent.length) {
    const res = await API.get('/chat/categories/');
    categoriesCacheAgent = res.ok ? res.data : [];
  }
  const actuelles = ((convAgentCourante && convAgentCourante.categories) || []).map(c => c.id);
  document.getElementById('tags-liste').innerHTML = categoriesCacheAgent.map(c => `
    <label class="d-flex align-items-center gap-2" style="cursor:pointer">
      <input type="checkbox" value="${c.id}" ${actuelles.includes(c.id) ? 'checked' : ''}/>
      <span class="cf-chat-tag" style="background:${c.couleur}">${escapeChat(c.nom)}</span>
    </label>`).join('');
  document.getElementById('modal-tags').style.display = 'flex';
}

async function validerTags() {
  const ids = Array.from(document.querySelectorAll('#tags-liste input:checked'))
    .map(i => parseInt(i.value, 10));
  const res = await API.post(`/chat/${chatAgentConvId}/categories/`, { categorie_ids: ids });
  if (res.ok) {
    convAgentCourante = res.data;
    majBarreStatutAgent(res.data);
    fermerModale('modal-tags');
    Toast.show('Categories mises a jour.', 'success');
    chargerConversations();
  } else {
    Toast.show('Erreur.', 'error');
  }
}

function fermerModale(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

async function envoyerPieceJointeAgent() {
  const input = document.getElementById('chat-agent-fichier');
  const fichier = input.files[0];
  if (!fichier || !chatAgentConvId) return;
  const form = new FormData();
  form.append('piece_jointe', fichier);
  const res = await API.upload(`/chat/${chatAgentConvId}/piece-jointe/`, form);
  input.value = '';
  if (!res || !res.ok) {
    Toast.show((res && res.data && res.data.detail) || "Echec de l'envoi.", 'error');
  }
  // Le message s'affiche via le WebSocket (diffusion au groupe).
}

/* ============================================================
   ECHEANCES A ENCAISSER — pre-remplissage du paiement (item #5)
   ============================================================ */
async function chargerEcheancesAVenir() {
  const conteneur = document.getElementById('liste-echeances-venir');
  if (!conteneur) return;
  try {
    const res = await API.get('/repayments/a-venir/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    if (res.data.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-3" style="color:var(--cf-text-muted);font-size:0.86rem">
          <i class="bi bi-check2-circle me-1"></i>Aucune echeance a encaisser pour le moment.
        </div>`;
      return;
    }

    conteneur.innerHTML = res.data.map(e => `
      <div class="d-flex align-items-center justify-content-between gap-2"
           style="padding:10px 12px;border:1px solid var(--cf-border);
                  border-radius:var(--cf-radius-sm);margin-bottom:8px;background:var(--cf-surface-2)">
        <div style="min-width:0">
          <div style="font-weight:700;font-size:0.85rem">
            ${escapeAttr(e.client)} — echeance n&deg;${e.numero}
            ${e.en_retard ? '<span class="cf-badge cf-badge-red ms-1">En retard</span>' : ''}
          </div>
          <div style="font-size:0.75rem;color:var(--cf-text-muted)">
            ${UI.montant(e.montant_du)} — du ${UI.date(e.date_echeance)} — credit #${e.demande_id}
          </div>
        </div>
        <button class="btn btn-sm ${e.payable ? 'btn-cf-primary' : ''}"
                ${e.payable ? '' : 'disabled title="Echeance precedente impayee"'}
                style="white-space:nowrap;${e.payable ? '' : 'opacity:0.5'}"
                onclick="preparerPaiement(${e.echeance_id}, '${e.montant_du}', '${escapeAttr(e.reference_suggeree)}')">
          Preparer
        </button>
      </div>`).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

function preparerPaiement(echeanceId, montant, reference) {
  document.getElementById('paiement-echeance-id').value  = echeanceId;
  document.getElementById('paiement-montant').value      = montant;
  document.getElementById('paiement-reference').value    = reference;
  afficherAlertePaiement('Formulaire pre-rempli. Verifiez puis enregistrez.', 'success');
  document.getElementById('paiement-montant').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============================================================
   PAIEMENTS DECLARES PAR LES CLIENTS — a valider
   ============================================================ */
async function chargerPaiementsAValider() {
  const conteneur = document.getElementById('liste-paiements-valider');
  if (!conteneur) return;
  try {
    const res = await API.get('/repayments/a-valider/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    if (res.data.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-3" style="color:var(--cf-text-muted);font-size:0.86rem">
          <i class="bi bi-check2-circle me-1"></i>Aucun paiement en attente de validation.
        </div>`;
      return;
    }

    conteneur.innerHTML = res.data.map(p => {
      const e = p.echeance_detail || {};
      return `
      <div class="d-flex align-items-center justify-content-between gap-2"
           style="padding:10px 12px;border:1px solid var(--cf-border);
                  border-radius:var(--cf-radius-sm);margin-bottom:8px;background:var(--cf-surface-2)">
        <div style="min-width:0">
          <div style="font-weight:700;font-size:0.85rem">
            ${escapeAttr(p.client_username)} — echeance n&deg;${e.numero || '?'}
            <span class="cf-badge cf-badge-blue ms-1">${(p.mode_paiement || '').replace('_', ' ').toUpperCase()}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--cf-text-muted)">
            ${UI.montant(p.montant_paye)} — credit #${p.demande_id} — ref. ${escapeAttr(p.reference_transaction || '--')}
          </div>
        </div>
        <button class="btn btn-sm btn-cf-primary" style="white-space:nowrap"
                onclick="validerPaiement(${p.id})">
          <i class="bi bi-check2 me-1"></i>Valider
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

async function validerPaiement(id) {
  if (!confirm('Confirmer la validation de ce paiement ?')) return;
  const res = await API.post(`/repayments/${id}/valider/`);
  if (res.ok) {
    Toast.show('Paiement valide.', 'success');
    chargerPaiementsAValider();
    chargerEcheancesAVenir();
    chargerStatsAgent();
  } else {
    Toast.show((res.data && res.data.detail) || 'Erreur.', 'error');
  }
}

function escapeAttr(txt) {
  return String(txt == null ? '' : txt)
    .replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================================
   DIAGRAMME — repartition des dossiers par statut (item 7)
   ============================================================ */
let chartDossiersAgent = null;

function cfTextColor() {
  return (getComputedStyle(document.body).getPropertyValue('--cf-text') || '#555').trim();
}

function doughnutCf(canvasId, labels, valeurs, couleurs, existant) {
  const el = document.getElementById(canvasId);
  if (!el || typeof Chart === 'undefined') return existant;
  if (existant) existant.destroy();
  return new Chart(el, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valeurs, backgroundColor: couleurs, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'bottom',
        labels: { padding: 14, color: cfTextColor(), font: { size: 12 } } } },
    },
  });
}

function renderChartDossiersAgent(dossiers) {
  const n = (s) => dossiers.filter(x => x.statut === s).length;
  chartDossiersAgent = doughnutCf('chart-dossiers-agent',
    ['Soumis', 'En analyse', 'Approuves', 'Decaisses', 'Rejetes'],
    [n('soumise'), n('en_analyse'), n('approuvee'), n('decaissee'), n('rejetee')],
    ['#F2640D', '#3B82F6', '#0B9C66', '#8B5CF6', '#EF4444'],
    chartDossiersAgent);
}