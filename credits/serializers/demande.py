from rest_framework import serializers
from credits.models import DemandeCrédit, Echeance


class EcheanceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Echeance
        fields = ('id', 'numero', 'date_echeance', 'montant_du',
                  'montant_capital', 'montant_interet', 'est_payee')


class DemandeCréditSerializer(serializers.ModelSerializer):
    """Lecture — liste et détail."""
    echeances        = EcheanceSerializer(many=True, read_only=True)
    client_username  = serializers.CharField(source='client.username', read_only=True)
    statut_display   = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model  = DemandeCrédit
        fields = (
            'id', 'client', 'client_username', 'agent_traitant',
            'montant_demande', 'duree_mois', 'motif', 'piece_justif',
            'statut', 'statut_display', 'score_eligibilite',
            'montant_approuve', 'taux_interet', 'commentaire_agent',
            'echeances', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'client', 'statut', 'score_eligibilite',
            'montant_approuve', 'agent_traitant', 'created_at', 'updated_at',
        )


class SoumettreDemandSerializer(serializers.ModelSerializer):
    """Écriture — utilisé par le client pour soumettre une demande."""
    class Meta:
        model  = DemandeCrédit
        fields = ('montant_demande', 'duree_mois', 'motif', 'piece_justif')


class TraiterDemandSerializer(serializers.ModelSerializer):
    """Écriture — utilisé par l'agent pour faire avancer le workflow."""
    class Meta:
        model  = DemandeCrédit
        fields = ('statut', 'montant_approuve', 'taux_interet', 'commentaire_agent')

    def validate_statut(self, value):
        """On ne peut qu'avancer dans le workflow, jamais reculer."""
        ordre = ['soumise', 'en_analyse', 'approuvee', 'decaissee', 'rejetee']
        actuel = self.instance.statut
        if value != 'rejetee' and ordre.index(value) <= ordre.index(actuel):
            raise serializers.ValidationError(
                "Impossible de revenir à un statut précédent."
            )
        return value

    def validate(self, attrs):
        """montant_approuve obligatoire si statut = approuvee."""
        if attrs.get('statut') == 'approuvee' and not attrs.get('montant_approuve'):
            raise serializers.ValidationError(
                {"montant_approuve": "Ce champ est obligatoire pour approuver un crédit."}
            )
        return attrs