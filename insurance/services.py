"""
Services métier du module insurance.
- Détection des souscriptions expirant dans 15 jours
- Mise à jour automatique des statuts expirés
"""

from datetime import date, timedelta


def get_souscriptions_a_notifier():
    """
    Retourne les souscriptions actives dont la date de fin
    est exactement dans 15 jours.
    """
    from insurance.models import Souscription

    dans_15_jours = date.today() + timedelta(days=15)
    return Souscription.objects.filter(
        statut='active',
        date_fin=dans_15_jours,
    ).select_related('client', 'produit')


def marquer_souscriptions_expirees():
    """
    Passe automatiquement au statut 'expiree' toutes
    les souscriptions actives dont la date de fin est dépassée.
    Retourne le nombre de souscriptions mises à jour.
    """
    from insurance.models import Souscription

    expirees = Souscription.objects.filter(
        statut='active',
        date_fin__lt=date.today(),
    )
    count = expirees.update(statut='expiree')
    return count