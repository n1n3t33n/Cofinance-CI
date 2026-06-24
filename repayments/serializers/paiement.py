from rest_framework import serializers
from repayments.models import Paiement, Penalite
from credits.serializers import EcheanceSerializer


class PaiementSerializer(serializers.ModelSerializer):
    agent_username   = serializers.CharField(source='agent.username', read_only=True)
    client_username  = serializers.CharField(source='echeance.demande.client.username', read_only=True)
    demande_id       = serializers.IntegerField(source='echeance.demande_id', read_only=True)
    echeance_detail  = EcheanceSerializer(source='echeance', read_only=True)
    statut_display   = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model  = Paiement
        fields = (
            'id', 'echeance', 'echeance_detail', 'agent', 'agent_username',
            'valide_par', 'statut', 'statut_display',
            'client_username', 'demande_id',
            'montant_paye', 'mode_paiement', 'reference_transaction',
            'note', 'date_paiement',
        )
        read_only_fields = ('agent', 'valide_par', 'statut', 'date_paiement')


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

        # Paiement strictement séquentiel : aucune échéance antérieure ne doit
        # rester impayée (on ne peut pas payer le mois N sans avoir payé N-1).
        anterieure_impayee = echeance.demande.echeances.filter(
            numero__lt=echeance.numero,
            est_payee=False,
        ).order_by('numero').first()
        if anterieure_impayee:
            raise serializers.ValidationError({
                "echeance": (
                    f"Paiement impossible : l'échéance n°{anterieure_impayee.numero} "
                    "doit être réglée avant celle-ci."
                )
            })
        return attrs


class DeclarerPaiementSerializer(serializers.ModelSerializer):
    """Écriture — le client déclare un paiement (en attente de validation)."""
    class Meta:
        model  = Paiement
        fields = ('echeance', 'mode_paiement', 'reference_transaction', 'note')

    def validate_echeance(self, echeance):
        if echeance.est_payee:
            raise serializers.ValidationError("Cette échéance est déjà payée.")

        # Une seule déclaration en attente à la fois pour une échéance.
        if echeance.paiements.filter(statut='en_attente').exists():
            raise serializers.ValidationError(
                "Un paiement est déjà en attente de validation pour cette échéance."
            )

        # Paiement séquentiel : régler les échéances dans l'ordre.
        anterieure = echeance.demande.echeances.filter(
            numero__lt=echeance.numero, est_payee=False,
        ).order_by('numero').first()
        if anterieure:
            raise serializers.ValidationError(
                f"Réglez d'abord l'échéance n°{anterieure.numero}."
            )
        return echeance


class PenaliteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Penalite
        fields = ('id', 'echeance', 'montant', 'taux_penalite',
                  'jours_retard', 'created_at')