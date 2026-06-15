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
    paiements:     () => {},
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
    }

    if (resConvs.ok) {
      const enAttente = resConvs.data.filter(c =>
        ['ouverte', 'en_attente'].includes(c.statut)
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
      .filter(c => ['ouverte', 'en_attente'].includes(c.statut))
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
                               onclick="ouvrirTraitement(${d.id})">
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

function ouvrirTraitement(id) {
  dossierEnCours = id;
  document.getElementById('modal-dossier-id').textContent = `#${id}`;
  document.getElementById('alerte-traitement').classList.remove('show');
  document.getElementById('champ-montant').style.display = 'none';
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
    afficherAlerteTraitement('Dossier mis a jour avec succes.', 'success');
    setTimeout(() => {
      document.getElementById('modal-traitement').style.display = 'none';
      chargerDossiers('');
      chargerStatsAgent();
    }, 1500);
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
async function chargerConversations() {
  const conteneur = document.getElementById('liste-conversations');
  try {
    const res = await API.get('/chat/toutes/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const convs = res.data;

    if (convs.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-chat-dots" style="font-size:2rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);font-size:0.85rem;margin-top:8px">
            Aucune conversation
          </p>
        </div>`;
      return;
    }

    conteneur.innerHTML = convs.map(c => `
      <div style="
        padding:12px;border-radius:var(--cf-radius);
        background:${chatAgentConvId === c.id ? 'rgba(255,107,0,0.08)' : 'var(--cf-surface-2)'};
        border:1px solid ${chatAgentConvId === c.id ? 'var(--cf-orange)' : 'var(--cf-border)'};
        margin-bottom:8px;cursor:pointer;transition:var(--cf-transition)"
        onclick="ouvrirConversationAgent(${c.id}, '${c.client_username}', '${c.statut}')">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div style="min-width:0;flex:1">
            <div style="font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.client_username}</div>
            <div style="font-size:0.72rem;color:var(--cf-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              Conv. #${c.id} — ${c.nb_messages_non_lus || 0} non lu(s)
            </div>
          </div>
          <span style="flex-shrink:0">${UI.statutBadge(c.statut)}</span>
        </div>
      </div>`).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

async function ouvrirConversationAgent(convId, clientNom, statut) {
  chatAgentConvId = convId;

  /* Rejoindre si en attente */
  if (statut === 'en_attente') {
    await API.post(`/chat/${convId}/rejoindre/`);
  }

  /* Afficher la zone chat */
  document.getElementById('chat-agent-placeholder').style.display = 'none';
  const actif = document.getElementById('chat-agent-actif');
  actif.style.display  = 'flex';

  document.getElementById('chat-agent-client-nom').textContent  = clientNom;
  document.getElementById('chat-agent-conv-info').textContent   = `Conversation #${convId}`;

  /* Charger historique */
  const user   = Session.getUser();
  const resMsg = await API.get(`/chat/${convId}/messages/`);
  const zone   = document.getElementById('chat-agent-messages');
  zone.innerHTML = '';

  if (resMsg.ok && resMsg.data.length > 0) {
    resMsg.data.forEach(msg => {
      ajouterMsgAgent(msg.contenu, msg.auteur_username, msg.created_at,
        msg.auteur === user.id);
    });
  }

  /* Connecter WS */
  if (chatAgentSocket) chatAgentSocket.close();
  connecterChatAgentWS(convId);

  /* Rafraichir la liste */
  chargerConversations();
}

function connecterChatAgentWS(convId) {
  const token = Session.getToken();
  const url   = `ws://127.0.0.1:8000/ws/chat/${convId}/?token=${token}`;
  chatAgentSocket = new WebSocket(url);
  const dot       = document.getElementById('chat-agent-ws-dot');

  chatAgentSocket.onopen  = () => { if (dot) dot.style.background = '#00A86B'; };
  chatAgentSocket.onclose = () => { if (dot) dot.style.background = '#EF4444'; };

  chatAgentSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const user = Session.getUser();

    if (data.type === 'message') {
      const estMoi = data.auteur === user.username;
      ajouterMsgAgent(data.contenu, data.auteur, data.created_at, estMoi);
    }

    if (data.type === 'typing') {
      const ind = document.getElementById('chat-agent-typing');
      if (data.username !== user.username) {
        ind.textContent = data.est_en_train_d_ecrire
          ? `${data.username} est en train d'ecrire...`
          : '';
      }
    }
  };
}

function ajouterMsgAgent(contenu, auteur, createdAt, estMoi) {
  const zone = document.getElementById('chat-agent-messages');
  const div  = document.createElement('div');
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

  div.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;margin-bottom:4px;
         color:${estMoi ? 'rgba(255,255,255,0.8)' : 'var(--cf-green)'}">
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
    }
  } catch (err) {}
}

async function sauverProfil() {
  const btn = document.getElementById('btn-sauver-profil');
  UI.btnLoading(btn, true);

  const res = await API.patch('/auth/profile/', {
    email:     document.getElementById('profil-email').value,
    telephone: document.getElementById('profil-telephone').value,
    region:    document.getElementById('profil-region').value,
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