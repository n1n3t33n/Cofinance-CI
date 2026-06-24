"""
Services du module chat :
  - diffusion temps réel vers le groupe WebSocket d'une conversation
  - assignation automatique d'un agent (par disponibilité / spécialité)
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Count, Q


def diffuser_chat(conversation_id, payload):
    """
    Diffuse un événement au groupe WebSocket 'chat_<id>'.
    Tolérant aux pannes : ne casse jamais la requête HTTP appelante.
    `payload['type']` doit correspondre à une méthode du ChatConsumer.
    """
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(f'chat_{conversation_id}', payload)
    except Exception:
        pass


def agent_le_moins_charge(specialite=None):
    """
    Retourne l'agent (ou admin) disponible ayant le moins de conversations
    « en cours ». Si une spécialité est demandée mais qu'aucun spécialiste
    n'est disponible, on retombe sur n'importe quel agent disponible.
    """
    from accounts.models import User

    base = User.objects.filter(
        role__in=['agent', 'administrateur'],
        est_disponible=True,
    )

    def moins_charge(qs):
        return (
            qs.annotate(nb=Count(
                'conversations_agent',
                filter=Q(conversations_agent__statut='en_cours'),
            ))
            .order_by('nb')
            .first()
        )

    if specialite:
        specialiste = moins_charge(base.filter(specialite=specialite))
        if specialiste:
            return specialiste

    return moins_charge(base)
