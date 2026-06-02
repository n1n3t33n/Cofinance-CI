"""
Services métier du module repayments.
- Calcul des pénalités de retard
- Détection des échéances à alerter (J-3 et J+1)
"""

from datetime import date
from decimal import Decimal


def calculer_penalite(echeance) -> Decimal:
    """
    Calcule le montant de la pénalité de retard.

    Formule : montant_dû × (taux_pénalité / 100) × (jours_retard / 30)
    Le taux par défaut est 2 % mensuel.
    """
    today = date.today()
    if today <= echeance.date_echeance:
        return Decimal('0.00')

    jours_retard = (today - echeance.date_echeance).days
    taux         = Decimal('2.00')  # 2 % mensuel par défaut
    montant      = echeance.montant_du * (taux / 100) * (Decimal(jours_retard) / 30)
    return montant.quantize(Decimal('0.01'))


def get_echeances_a_alerter():
    """
    Retourne deux querysets :
    - j_moins_3 : échéances dont la date est dans exactement 3 jours (rappel)
    - j_plus_1  : échéances dont la date était hier (retard)
    """
    from credits.models import Echeance
    from datetime import timedelta

    today       = date.today()
    dans_3_jours = today + timedelta(days=3)
    hier         = today - timedelta(days=1)

    j_moins_3 = Echeance.objects.filter(
        date_echeance=dans_3_jours,
        est_payee=False,
    ).select_related('demande__client')

    j_plus_1 = Echeance.objects.filter(
        date_echeance=hier,
        est_payee=False,
    ).select_related('demande__client')

    return j_moins_3, j_plus_1