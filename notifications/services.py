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

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from notifications.models import Notification


def _push(group, payload):
    """
    Pousse un événement vers un groupe de channels (diffusion temps réel).
    Tolérant aux pannes : ne casse JAMAIS la requête HTTP appelante si la
    couche WebSocket est indisponible ou si on est dans une boucle async.
    """
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(group, payload)
    except Exception:
        pass


def diffuser_aux_roles(roles, type_handler, donnees):
    """
    Diffuse un événement à tous les utilisateurs connectés d'un ou plusieurs
    rôles (ex : ['agent', 'administrateur']). `type_handler` doit correspondre
    à une méthode du NotificationConsumer (ex : 'dossier_nouveau').
    """
    for role in roles:
        _push(f'role_{role}', {'type': type_handler, **donnees})


def creer_notification(destinataire, type_notif, titre, message, objet_id=None):
    """
    Crée et sauvegarde une notification en base, PUIS la pousse en temps réel
    vers le navigateur du destinataire (groupe notif_<id>).
    Retourne l'objet Notification créé.
    """
    from notifications.serializers import NotificationSerializer

    notif = Notification.objects.create(
        destinataire=destinataire,
        type_notif=type_notif,
        titre=titre,
        message=message,
        objet_id=objet_id,
    )

    # Diffusion temps réel (badge + toast côté client).
    _push(f'notif_{destinataire.id}', {
        'type':         'notif_message',
        'notification': NotificationSerializer(notif).data,
    })

    return notif


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