"""
Services métier du module credits.
- Calcul du score d'éligibilité
- Génération de l'échéancier de remboursement
"""

from datetime import date
from dateutil.relativedelta import relativedelta
from decimal import Decimal


def calculer_score(demande) -> float:
    """
    Score d'éligibilité simplifié sur 100 points.

    Critères :
    - Montant demandé         : <= 500 000 FCFA  → +40 pts
                                <= 1 000 000 FCFA → +20 pts
                                >  1 000 000 FCFA → +10 pts
    - Durée                   : <= 12 mois → +30 pts
                                <= 24 mois → +20 pts
                                >  24 mois → +10 pts
    - Historique (nb crédits
      précédents remboursés)  : 0 → +0 pt | 1-2 → +15 pts | 3+ → +30 pts
    """
    score = 0

    # Critère montant
    if demande.montant_demande <= 500_000:
        score += 40
    elif demande.montant_demande <= 1_000_000:
        score += 20
    else:
        score += 10

    # Critère durée
    if demande.duree_mois <= 12:
        score += 30
    elif demande.duree_mois <= 24:
        score += 20
    else:
        score += 10

    # Critère historique : crédits précédents décaissés pour ce client
    credits_precedents = demande.client.demandes_credit.filter(
        statut='decaissee'
    ).exclude(pk=demande.pk).count()

    if credits_precedents == 0:
        score += 0
    elif credits_precedents <= 2:
        score += 15
    else:
        score += 30

    return round(score, 2)


def generer_echeancier(demande) -> list:
    """
    Génère les échéances mensuelles pour une demande approuvée.
    Utilise la méthode d'amortissement constant (capital fixe).

    Retourne une liste de dicts prêts à être sauvegardés.
    """
    montant    = demande.montant_approuve
    duree      = demande.duree_mois
    taux_mens  = Decimal(str(demande.taux_interet)) / Decimal('100') / Decimal('12')
    capital_mens = (montant / duree).quantize(Decimal('0.01'))

    echeances = []
    date_debut = date.today()

    for i in range(1, duree + 1):
        capital_restant = montant - capital_mens * (i - 1)
        interet         = (capital_restant * taux_mens).quantize(Decimal('0.01'))
        mensualite      = capital_mens + interet

        echeances.append({
            'numero':          i,
            'date_echeance':   date_debut + relativedelta(months=i),
            'montant_du':      mensualite,
            'montant_capital': capital_mens,
            'montant_interet': interet,
        })

    return echeances