import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour le chat en temps réel.

    URL de connexion : ws://localhost:8000/ws/chat/<conversation_id>/
    Authentification : le token JWT est passé en query param
                       ws://.../?token=<access_token>
    """

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f"chat_{self.conversation_id}"

        # Vérifier que l'utilisateur a accès à cette conversation
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        a_acces = await self.verifier_acces(user, self.conversation_id)
        if not a_acces:
            await self.close(code=4003)
            return

        # Rejoindre le groupe de la conversation
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Informer les autres participants de la connexion
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type':     'presence_event',
                'event':    'connecte',
                'username': user.username,
            }
        )

    async def disconnect(self, close_code):
        user = self.scope.get('user')

        if hasattr(self, 'room_group_name'):
            if user and user.is_authenticated:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type':     'presence_event',
                        'event':    'deconnecte',
                        'username': user.username,
                    }
                )
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Reçoit un message du WebSocket et le diffuse au groupe."""
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        type_event = data.get('type', 'message')

        # ── Indicateur de frappe ──────────────────────────────
        if type_event == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type':     'typing_event',
                    'username': user.username,
                    'est_en_train_d_ecrire': data.get('est_en_train_d_ecrire', False),
                }
            )
            return

        # ── Message texte ─────────────────────────────────────
        contenu = data.get('contenu', '').strip()
        if not contenu:
            return

        # Sauvegarder en base de données
        message = await self.sauvegarder_message(
            conversation_id=self.conversation_id,
            auteur=user,
            contenu=contenu,
        )

        # Diffuser à tous les participants de la conversation
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type':          'chat_message',
                'message_id':    message.pk,
                'contenu':       contenu,
                'auteur':        user.username,
                'auteur_role':   user.role,
                'created_at':    message.created_at.isoformat(),
            }
        )

    # ── Handlers des événements du groupe ─────────────────────

    async def chat_message(self, event):
        """Envoie un message reçu du groupe vers le WebSocket client."""
        await self.send(text_data=json.dumps({
            'type':       'message',
            'message_id': event['message_id'],
            'contenu':    event['contenu'],
            'auteur':     event['auteur'],
            'auteur_role': event['auteur_role'],
            'created_at': event['created_at'],
        }))

    async def presence_event(self, event):
        """Notifie les participants d'une connexion/déconnexion."""
        await self.send(text_data=json.dumps({
            'type':     'presence',
            'event':    event['event'],
            'username': event['username'],
        }))

    async def typing_event(self, event):
        """Diffuse l'indicateur de frappe."""
        await self.send(text_data=json.dumps({
            'type':     'typing',
            'username': event['username'],
            'est_en_train_d_ecrire': event['est_en_train_d_ecrire'],
        }))

    # ── Méthodes base de données (async) ──────────────────────

    @database_sync_to_async
    def verifier_acces(self, user, conversation_id):
        """Vérifie que l'utilisateur a le droit d'accéder à la conversation."""
        from chat.models import Conversation
        try:
            conv = Conversation.objects.get(pk=conversation_id)
            if user.is_client:
                return conv.client == user
            return True  # agents et admins voient tout
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def sauvegarder_message(self, conversation_id, auteur, contenu):
        """Sauvegarde le message en base et met à jour updated_at de la conversation."""
        from chat.models import Conversation, Message
        conv = Conversation.objects.get(pk=conversation_id)
        message = Message.objects.create(
            conversation=conv,
            auteur=auteur,
            contenu=contenu,
        )
        # Mettre à jour la date de la conversation pour le tri
        conv.save(update_fields=['updated_at'])
        return message