import os
from rest_framework import serializers
from chat.models import Conversation, Message, Categorie, EvaluationConversation


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Categorie
        fields = ('id', 'nom', 'couleur')


class EvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EvaluationConversation
        fields = ('id', 'note', 'commentaire', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_note(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("La note doit être comprise entre 1 et 5.")
        return value


class MessageSerializer(serializers.ModelSerializer):
    auteur_username  = serializers.CharField(source='auteur.username', read_only=True)
    auteur_role      = serializers.CharField(source='auteur.role', read_only=True)
    piece_jointe_url = serializers.SerializerMethodField()
    piece_jointe_nom = serializers.SerializerMethodField()

    class Meta:
        model  = Message
        fields = ('id', 'auteur', 'auteur_username', 'auteur_role', 'contenu',
                  'piece_jointe', 'piece_jointe_url', 'piece_jointe_nom',
                  'est_recu', 'est_lu', 'created_at')
        read_only_fields = ('auteur', 'piece_jointe', 'est_recu', 'est_lu', 'created_at')

    def get_piece_jointe_url(self, obj):
        if not obj.piece_jointe:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.piece_jointe.url) if request else obj.piece_jointe.url

    def get_piece_jointe_nom(self, obj):
        return os.path.basename(obj.piece_jointe.name) if obj.piece_jointe else None


class ConversationSerializer(serializers.ModelSerializer):
    client_username  = serializers.CharField(source='client.username', read_only=True)
    agent_username   = serializers.CharField(source='agent.username', read_only=True)
    agent_specialite = serializers.CharField(source='agent.get_specialite_display', read_only=True)
    statut_display   = serializers.CharField(source='get_statut_display', read_only=True)
    messages         = MessageSerializer(many=True, read_only=True)
    categories       = CategorieSerializer(many=True, read_only=True)
    evaluation       = EvaluationSerializer(read_only=True)
    nb_messages_non_lus = serializers.SerializerMethodField()

    class Meta:
        model  = Conversation
        fields = (
            'id', 'client', 'client_username', 'agent', 'agent_username',
            'agent_specialite', 'statut', 'statut_display', 'sujet',
            'categories', 'demande_credit', 'souscription', 'evaluation', 'messages',
            'nb_messages_non_lus', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'client', 'agent', 'statut', 'categories', 'evaluation',
            'created_at', 'updated_at',
        )

    def get_nb_messages_non_lus(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        return obj.messages.filter(est_lu=False).exclude(
            auteur=request.user
        ).count()
