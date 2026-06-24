import json
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Flux temps réel des notifications de l'utilisateur connecté.

    URL : ws://<host>/ws/notifications/?token=<access_token>
    (le token JWT est résolu par chat.middleware.JWTAuthMiddleware)

    Groupes rejoints :
      - notif_<user_id>  → notifications personnelles (badge + toast)
      - role_<role>      → diffusions à tous les agents / tous les admins
                           (ex : arrivée d'une nouvelle demande de crédit)

    C'est un flux descendant : le serveur pousse, le client n'envoie rien.
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_group = f'notif_{user.id}'
        self.role_group = f'role_{user.role}'

        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.channel_layer.group_add(self.role_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        if hasattr(self, 'role_group'):
            await self.channel_layer.group_discard(self.role_group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # Flux purement descendant : on ignore tout ce que le client enverrait.
        return

    # ── Handlers des événements de groupe ─────────────────────────

    async def notif_message(self, event):
        """Notification personnelle → navigateur."""
        await self.send(text_data=json.dumps({
            'type':         'notification',
            'notification': event['notification'],
        }))

    async def dossier_nouveau(self, event):
        """Nouvelle demande de crédit → rafraîchir les tableaux agent/admin."""
        await self.send(text_data=json.dumps({
            'type':    'dossier_nouveau',
            'dossier': event['dossier'],
        }))
