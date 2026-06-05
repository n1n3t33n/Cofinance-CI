/* ============================================================
   COFINANCE CI - eligibilite.js
   Simulateur de score d'eligibilite cote client
   (reproduit la logique du back-end sans appel API)
   ============================================================ */

'use strict';

function calculerScore() {
  const montant    = parseInt(document.getElementById('sim-montant').value);
  const duree      = parseInt(document.getElementById('sim-duree').value);
  const historique = parseInt(document.getElementById('sim-historique').value);

  let score = 0;

  /* Critere montant */
  if (montant <= 500000)       score += 40;
  else if (montant <= 1000000) score += 20;
  else                         score += 10;

  /* Critere duree */
  if (duree <= 12)      score += 30;
  else if (duree <= 24) score += 20;
  else                  score += 10;

  /* Critere historique */
  if (historique === 0)      score += 0;
  else if (historique === 1) score += 15;
  else                       score += 30;

  /* Mensualite estimee */
  const taux       = 0.12 / 12;
  const capital    = montant / duree;
  const interets   = (montant * taux);
  const mensualite = Math.round(capital + interets);

  /* Afficher les resultats */
  document.getElementById('resultat-score').style.display = 'block';
  document.getElementById('score-valeur').textContent     = score;

  /* Animation jauge SVG */
  setTimeout(() => {
    const arc = document.getElementById('svg-score-arc');
    arc.setAttribute('stroke-dasharray', `${score} 100`);
    arc.setAttribute('stroke',
      score >= 70 ? 'var(--cf-green)' :
      score >= 40 ? 'var(--cf-orange)' : '#EF4444');
  }, 100);

  document.getElementById('res-mensualite').textContent =
    new Intl.NumberFormat('fr-FR').format(mensualite) + ' FCFA';

  const avis = document.getElementById('res-avis');
  const msg  = document.getElementById('res-message');

  if (score >= 70) {
    avis.textContent = 'Favorable';
    avis.style.color = 'var(--cf-green)';
    msg.className    = 'cf-alert cf-alert-success mt-3 show';
    msg.textContent  = 'Votre profil est eligible. Creez votre compte pour soumettre votre demande.';
  } else if (score >= 40) {
    avis.textContent = 'Possible';
    avis.style.color = 'var(--cf-orange)';
    msg.className    = 'cf-alert cf-alert-warning mt-3 show';
    msg.textContent  = 'Votre demande sera examinee par nos agents. Un bon historique ameliore vos chances.';
  } else {
    avis.textContent = 'Difficile';
    avis.style.color = '#EF4444';
    msg.className    = 'cf-alert cf-alert-error mt-3 show';
    msg.textContent  = 'Le montant ou la duree demandes reduisent vos chances. Essayez un montant plus faible.';
  }

  document.getElementById('resultat-score').scrollIntoView({ behavior: 'smooth' });
}