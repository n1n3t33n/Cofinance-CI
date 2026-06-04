/* ============================================================
   COFINANCE CI - dashboard_admin.js
   Logique du tableau de bord administrateur
   ============================================================ */

'use strict';

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  Session.redirectIfNotLoggedIn();
  const user = Session.getUser();
  if (user && user.role !== 'administrateur') {
    Session.redirectToDashboard();
    return;
  }
  chargerDashboard();
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
    accueil:       chargerDashboard,
    credits:       () => chargerCreditsAdmin(''),
    produits:      chargerProduits,
    souscriptions: () => chargerSouscriptions(''),
    agents:        chargerAgents,
    regions:       chargerRegions,
  };
  if (chargeurs[nom]) chargeurs[nom]();
}

/* ============================================================
   TABLEAU DE BORD PRINCIPAL
   ============================================================ */
async function chargerDashboard() {
  const dateFin   = document.getElementById('filtre-date-fin')?.value   || '';
  const dateDebut = document.getElementById('filtre-date-debut')?.value || '';
  const jours     = document.getElementById('filtre-jours')?.value      || 7;

  let url = `/dashboard/?jours=${jours}`;
  if (dateDebut) url += `&date_debut=${dateDebut}`;
  if (dateFin)   url += `&date_fin=${dateFin}`;

  try {
    const res = await API.get(url);
    if (!res.ok) return;

    const d = res.data;

    /* Credits */
    document.getElementById('kpi-total').textContent       = d.credits.total          || 0;
    document.getElementById('kpi-soumises').textContent    = d.credits.soumises        || 0;
    document.getElementById('kpi-analyse').textContent     = d.credits.en_analyse      || 0;
    document.getElementById('kpi-approuvees').textContent  = d.credits.approuvees      || 0;
    document.getElementById('kpi-decaissees').textContent  = d.credits.decaissees      || 0;
    document.getElementById('kpi-rejetees').textContent    = d.credits.rejetees        || 0;

    /* Remboursements */
    const r = d.remboursements;
    document.getElementById('kpi-total-echeances').textContent  = r.total_echeances   || 0;
    document.getElementById('kpi-echeances-payees').textContent = r.payees            || 0;
    document.getElementById('kpi-montant-recu').textContent     =
      UI.montant(r.montant_total_recu || 0);

    const taux = r.taux_recouvrement || 0;
    document.getElementById('kpi-taux').textContent     = `${taux}%`;
    document.getElementById('barre-taux').style.width   = `${taux}%`;

    /* Assurance */
    const a = d.assurance;
    document.getElementById('kpi-total-assurances').textContent    = a.total    || 0;
    document.getElementById('kpi-assurances-actives').textContent  = a.actives  || 0;
    document.getElementById('kpi-assurances-expirees').textContent = a.expirees || 0;
    document.getElementById('kpi-revenus-primes').textContent      =
      UI.montant(a.revenus_primes || 0);

    /* Utilisateurs + Support */
    document.getElementById('kpi-total-clients').textContent  = d.clients.total_clients  || 0;
    document.getElementById('kpi-total-agents').textContent   = d.clients.total_agents   || 0;
    document.getElementById('kpi-convs-ouvertes').textContent = d.support.ouvertes       || 0;
    document.getElementById('kpi-msgs-non-lus').textContent   = d.support.non_lus        || 0;

    /* Activite recente */
    const act = d.activite_recente;
    document.getElementById('activite-recente').innerHTML = `
      <div class="col-md-4">
        <div class="cf-card-stat">
          <div class="stat-icon stat-icon-orange">
            <i class="bi bi-plus-circle"></i>
          </div>
          <div>
            <div class="stat-value">${act.nouvelles_demandes || 0}</div>
            <div class="stat-label">Nouvelles demandes</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="cf-card-stat">
          <div class="stat-icon stat-icon-green">
            <i class="bi bi-cash-coin"></i>
          </div>
          <div>
            <div class="stat-value">${act.paiements_enregistres || 0}</div>
            <div class="stat-label">Paiements enregistres</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="cf-card-stat">
          <div class="stat-icon stat-icon-blue">
            <i class="bi bi-shield-plus"></i>
          </div>
          <div>
            <div class="stat-value">${act.nouvelles_souscriptions || 0}</div>
            <div class="stat-label">Nouvelles souscriptions</div>
          </div>
        </div>
      </div>`;

  } catch (err) {
    console.error('Erreur dashboard:', err);
  }
}

/* ============================================================
   CREDITS
   ============================================================ */
async function chargerCreditsAdmin(filtre) {
  const conteneur = document.getElementById('table-credits-admin');
  conteneur.innerHTML = '<div class="text-center py-4"><div class="cf-spinner mx-auto"></div></div>';

  try {
    const url = filtre ? `/credits/?statut=${filtre}` : '/credits/';
    const res = await API.get(url);
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    const credits = res.data;

    if (credits.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-inbox" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">Aucun credit.</p>
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
              <th>Agent</th>
              <th>Montant demande</th>
              <th>Montant approuve</th>
              <th>Statut</th>
              <th>Score</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${credits.map(c => `
              <tr>
                <td style="font-weight:700">#${c.id}</td>
                <td>${c.client_username}</td>
                <td style="color:var(--cf-text-muted)">
                  ${c.agent_traitant ? '#' + c.agent_traitant : '--'}
                </td>
                <td>${UI.montant(c.montant_demande)}</td>
                <td>${c.montant_approuve ? UI.montant(c.montant_approuve) : '--'}</td>
                <td>${UI.statutBadge(c.statut)}</td>
                <td>${c.score_eligibilite
                  ? `<span style="font-weight:700;color:var(--cf-green)">${c.score_eligibilite}/100</span>`
                  : '--'}</td>
                <td style="font-size:0.82rem;color:var(--cf-text-muted)">
                  ${UI.date(c.created_at)}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

function filtrerCreditsAdmin(statut, btn) {
  document.querySelectorAll('.filtre-credit').forEach(b => {
    b.style.background = 'var(--cf-surface-2)';
    b.style.color      = 'var(--cf-text-muted)';
    b.style.border     = '1px solid var(--cf-border)';
  });
  btn.style.background = 'var(--cf-orange)';
  btn.style.color      = '#fff';
  btn.style.border     = 'none';
  chargerCreditsAdmin(statut);
}

/* ============================================================
   PRODUITS ASSURANCE
   ============================================================ */
let produitEditId = null;

async function chargerProduits() {
  const conteneur = document.getElementById('table-produits');
  try {
    const res = await API.get('/insurance/produits/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    if (res.data.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-grid" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">Aucun produit.</p>
        </div>`;
      return;
    }

    conteneur.innerHTML = `
      <div style="overflow-x:auto">
        <table class="cf-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Prime mensuelle</th>
              <th>Couverture</th>
              <th>Duree</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${res.data.map(p => `
              <tr>
                <td style="font-weight:700">${p.nom}</td>
                <td>${p.type_produit_display}</td>
                <td style="color:var(--cf-orange);font-weight:700">
                  ${UI.montant(p.prime_mensuelle)}
                </td>
                <td>${UI.montant(p.montant_couverture)}</td>
                <td>${p.duree_mois} mois</td>
                <td>
                  ${p.est_actif
                    ? '<span class="cf-badge cf-badge-green">Actif</span>'
                    : '<span class="cf-badge cf-badge-gray">Inactif</span>'}
                </td>
                <td>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm"
                            style="background:rgba(255,107,0,0.1);color:var(--cf-orange);border:none;border-radius:var(--cf-radius-sm);font-size:0.8rem;font-weight:600"
                            onclick="afficherFormProduit(${p.id})">
                      Modifier
                    </button>
                    ${p.est_actif
                      ? `<button class="btn btn-sm"
                                 style="background:rgba(239,68,68,0.1);color:#EF4444;border:none;border-radius:var(--cf-radius-sm);font-size:0.8rem;font-weight:600"
                                 onclick="desactiverProduit(${p.id})">
                           Desactiver
                         </button>`
                      : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

async function afficherFormProduit(id) {
  produitEditId = id;
  document.getElementById('form-produit-titre').textContent =
    id ? 'Modifier le produit' : 'Nouveau produit';
  document.getElementById('alerte-produit').classList.remove('show');

  if (id) {
    const res = await API.get(`/insurance/produits/`);
    if (res.ok) {
      const produit = res.data.find(p => p.id === id);
      if (produit) {
        document.getElementById('produit-nom').value         = produit.nom;
        document.getElementById('produit-type').value        = produit.type_produit;
        document.getElementById('produit-duree').value       = produit.duree_mois;
        document.getElementById('produit-prime').value       = produit.prime_mensuelle;
        document.getElementById('produit-couverture').value  = produit.montant_couverture;
        document.getElementById('produit-description').value = produit.description;
      }
    }
  } else {
    document.getElementById('produit-nom').value         = '';
    document.getElementById('produit-type').value        = 'vie';
    document.getElementById('produit-duree').value       = '';
    document.getElementById('produit-prime').value       = '';
    document.getElementById('produit-couverture').value  = '';
    document.getElementById('produit-description').value = '';
  }

  document.getElementById('form-produit').style.display = 'block';
  document.getElementById('form-produit').scrollIntoView({ behavior: 'smooth' });
}

async function sauverProduit() {
  const payload = {
    nom:               document.getElementById('produit-nom').value.trim(),
    type_produit:      document.getElementById('produit-type').value,
    duree_mois:        parseInt(document.getElementById('produit-duree').value),
    prime_mensuelle:   document.getElementById('produit-prime').value,
    montant_couverture: document.getElementById('produit-couverture').value,
    description:       document.getElementById('produit-description').value.trim(),
  };

  const btn = document.getElementById('btn-sauver-produit');
  UI.btnLoading(btn, true);

  let res;
  if (produitEditId) {
    res = await API.patch(`/insurance/produits/${produitEditId}/`, payload);
  } else {
    res = await API.post('/insurance/produits/creer/', payload);
  }

  if (res.ok) {
    afficherAlerteProduit('Produit enregistre avec succes.', 'success');
    setTimeout(() => {
      document.getElementById('form-produit').style.display = 'none';
      chargerProduits();
    }, 1200);
  } else {
    const erreur = Object.values(res.data)[0];
    afficherAlerteProduit(Array.isArray(erreur) ? erreur[0] : erreur, 'error');
    UI.btnLoading(btn, false);
  }
}

async function desactiverProduit(id) {
  if (!confirm('Confirmer la desactivation de ce produit ?')) return;
  const res = await API.delete(`/insurance/produits/${id}/`);
  if (res.ok) chargerProduits();
}

function afficherAlerteProduit(msg, type) {
  const alerte = document.getElementById('alerte-produit');
  const icon   = document.getElementById('alerte-produit-icon');
  const msgEl  = document.getElementById('alerte-produit-msg');
  const icones = { success: 'bi bi-check-circle', error: 'bi bi-exclamation-circle' };
  alerte.className  = `cf-alert cf-alert-${type} mb-3 show`;
  icon.className    = icones[type];
  msgEl.textContent = msg;
}

/* ============================================================
   SOUSCRIPTIONS
   ============================================================ */
async function chargerSouscriptions(filtre) {
  const conteneur = document.getElementById('table-souscriptions');
  conteneur.innerHTML = '<div class="text-center py-4"><div class="cf-spinner mx-auto"></div></div>';

  try {
    const url = filtre ? `/insurance/toutes/?statut=${filtre}` : '/insurance/toutes/';
    const res = await API.get(url);
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    if (res.data.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-shield" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">Aucune souscription.</p>
        </div>`;
      return;
    }

    conteneur.innerHTML = `
      <div style="overflow-x:auto">
        <table class="cf-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Produit</th>
              <th>Statut</th>
              <th>Date debut</th>
              <th>Date fin</th>
              <th>Jours restants</th>
            </tr>
          </thead>
          <tbody>
            ${res.data.map(s => `
              <tr>
                <td style="font-weight:700">${s.client_username}</td>
                <td>${s.produit_detail.nom}</td>
                <td>${UI.statutBadge(s.statut)}</td>
                <td style="font-size:0.82rem">${UI.date(s.date_debut)}</td>
                <td style="font-size:0.82rem">${UI.date(s.date_fin)}</td>
                <td>
                  ${s.statut === 'active'
                    ? `<span style="font-weight:700;color:var(--cf-green)">${s.jours_restants}j</span>`
                    : '--'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

function filtrerSouscriptions(statut, btn) {
  document.querySelectorAll('.filtre-sous').forEach(b => {
    b.style.background = 'var(--cf-surface-2)';
    b.style.color      = 'var(--cf-text-muted)';
    b.style.border     = '1px solid var(--cf-border)';
  });
  btn.style.background = 'var(--cf-orange)';
  btn.style.color      = '#fff';
  btn.style.border     = 'none';
  chargerSouscriptions(statut);
}

/* ============================================================
   PERFORMANCE AGENTS
   ============================================================ */
async function chargerAgents() {
  const conteneur = document.getElementById('table-agents');
  try {
    const res = await API.get('/dashboard/agents/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    if (res.data.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-people" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">Aucune donnee.</p>
        </div>`;
      return;
    }

    const max = Math.max(...res.data.map(a => a.nb_dossiers));

    conteneur.innerHTML = res.data.map((a, i) => `
      <div style="
        padding:16px;border-radius:var(--cf-radius);
        background:var(--cf-surface-2);margin-bottom:12px">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="d-flex align-items-center gap-3">
            <div style="
              width:40px;height:40px;border-radius:50%;
              background:linear-gradient(135deg,var(--cf-green),var(--cf-green-dark));
              color:#fff;font-weight:800;font-size:0.9rem;
              display:flex;align-items:center;justify-content:center">
              ${a.agent_traitant__username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:700">${a.agent_traitant__username}</div>
              <div style="font-size:0.78rem;color:var(--cf-text-muted)">Agent</div>
            </div>
          </div>
          <span style="font-size:1.2rem;font-weight:800;color:var(--cf-orange)">
            ${a.nb_dossiers}
          </span>
        </div>
        <div style="height:6px;background:var(--cf-border);border-radius:6px">
          <div style="
            height:6px;border-radius:6px;
            background:linear-gradient(90deg,var(--cf-orange),var(--cf-green));
            width:${Math.round((a.nb_dossiers / max) * 100)}%;
            transition:width 1s ease">
          </div>
        </div>
      </div>`).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}

/* ============================================================
   REPARTITION REGIONS
   ============================================================ */
async function chargerRegions() {
  const conteneur = document.getElementById('table-regions');
  try {
    const res = await API.get('/dashboard/regions/');
    if (!res.ok) { conteneur.innerHTML = '<p class="text-muted">Erreur.</p>'; return; }

    if (res.data.length === 0) {
      conteneur.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-geo-alt" style="font-size:3rem;color:var(--cf-text-muted)"></i>
          <p style="color:var(--cf-text-muted);margin-top:12px">Aucune donnee.</p>
        </div>`;
      return;
    }

    const total = res.data.reduce((sum, r) => sum + r.nb_demandes, 0);

    conteneur.innerHTML = res.data.map(r => {
      const pct = Math.round((r.nb_demandes / total) * 100);
      return `
        <div style="
          padding:16px;border-radius:var(--cf-radius);
          background:var(--cf-surface-2);margin-bottom:12px">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div style="font-weight:700">
              <i class="bi bi-geo-alt-fill me-2" style="color:var(--cf-orange)"></i>
              ${r.client__region || 'Non renseigne'}
            </div>
            <div class="d-flex align-items-center gap-3">
              <span style="font-weight:800;color:var(--cf-orange)">${r.nb_demandes}</span>
              <span class="cf-badge cf-badge-gray">${pct}%</span>
            </div>
          </div>
          <div style="height:6px;background:var(--cf-border);border-radius:6px">
            <div style="
              height:6px;border-radius:6px;
              background:linear-gradient(90deg,var(--cf-orange),var(--cf-green));
              width:${pct}%;transition:width 1s ease">
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    conteneur.innerHTML = '<p class="text-muted">Erreur.</p>';
  }
}