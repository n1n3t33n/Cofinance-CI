from rest_framework import serializers
from repayments.models import Paiement, Penalite
from credits.serializers import EcheanceSerializer


class PaiementSerializer(serializers.ModelSerializer):
    agent_username   = serializers.CharField(source='agent.username', read_only=True)
    echeance_detail  = EcheanceSerializer(source='echeance', read_only=True)

    class Meta:
        model  = Paiement
        fields = (
            'id', 'echeance', 'echeance_detail', 'agent', 'agent_username',
            'montant_paye', 'mode_paiement', 'reference_transaction',
            'note', 'date_paiement',
        )
        read_only_fields = ('agent', 'date_paiement')


class EnregistrerPaiementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Paiement
        fields = ('echeance', 'montant_paye', 'mode_paiement',
                  'reference_transaction', 'note')

    def validate(self, attrs):
        echeance = attrs.get('echeance')
        if echeance.est_payee:
            raise serializers.ValidationError(
                {"echeance": "Cette échéance est déjà marquée comme payée."}
            )
        return attrs


class PenaliteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Penalite
        fields = ('id', 'echeance', 'montant', 'taux_penalite',
                  'jours_retard', 'created_at')