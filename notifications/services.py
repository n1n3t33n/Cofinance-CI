"""
Service central de notifications.
Importé par : repayments, insurance, credits, chat.

Usage :
    from notifications.services import creer_notification

    creer_notification(
        destinataire = user,
        type_notif   = 'statut_credit',
        titre        = "Votre dossier a évolué",
        message      = "Votre demande est maintenant en analyse.",
        objet_id     = demande.pk,   # optionnel
    )
"""

from notifications.models import Notification


def creer_notification(destinataire, type_notif, titre, message, objet_id=None):
    """
    Crée et sauvegarde une notification en base.
    Retourne l'objet Notification créé.
    """
    return Notification.objects.create(
        destinataire=destinataire,
        type_notif=type_notif,
        titre=titre,
        message=message,
        objet_id=objet_id,
    )


def marquer_toutes_lues(user):
    """Marque toutes les notifications d'un utilisateur comme lues."""
    return Notification.objects.filter(
        destinataire=user,
        est_lue=False,
    ).update(est_lue=True)


def compter_non_lues(user) -> int:
    """Retourne le nombre de notifications non lues d'un utilisateur."""
    return Notification.objects.filter(
        destinataire=user,
        est_lue=False,
    ).count()