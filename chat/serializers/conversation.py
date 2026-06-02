from rest_framework import serializers
from chat.models import Conversation, Message
from accounts.serializers import UserSerializer


class MessageSerializer(serializers.ModelSerializer):
    auteur_username = serializers.CharField(source='auteur.username', read_only=True)
    auteur_role     = serializers.CharField(source='auteur.role', read_only=True)

    class Meta:
        model  = Message
        fields = ('id', 'auteur', 'auteur_username', 'auteur_role',
                  'contenu', 'est_lu', 'created_at')
        read_only_fields = ('auteur', 'est_lu', 'created_at')


class ConversationSerializer(serializers.ModelSerializer):
    client_username = serializers.CharField(source='client.username', read_only=True)
    agent_username  = serializers.CharField(source='agent.username',  read_only=True)
    statut_display  = serializers.CharField(source='get_statut_display', read_only=True)
    messages        = MessageSerializer(many=True, read_only=True)
    nb_messages_non_lus = serializers.SerializerMethodField()

    class Meta:
        model  = Conversation
        fields = (
            'id', 'client', 'client_username', 'agent', 'agent_username',
            'statut', 'statut_display', 'messages',
            'nb_messages_non_lus', 'created_at', 'updated_at',
        )
        read_only_fields = ('client', 'agent', 'statut', 'created_at', 'updated_at')

    def get_nb_messages_non_lus(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        return obj.messages.filter(est_lu=False).exclude(
            auteur=request.user
        ).count()