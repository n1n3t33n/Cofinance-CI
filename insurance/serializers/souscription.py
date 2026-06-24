from rest_framework import serializers
from insurance.models import Souscription
from .produit import ProduitAssuranceSerializer


class SouscriptionSerializer(serializers.ModelSerializer):
    """Lecture — détail complet d'une souscription."""
    produit_detail   = ProduitAssuranceSerializer(source='produit', read_only=True)
    client_username  = serializers.CharField(source='client.username', read_only=True)
    agent_username   = serializers.CharField(source='agent_traitant.username', read_only=True)
    statut_display   = serializers.CharField(source='get_statut_display', read_only=True)
    jours_restants   = serializers.IntegerField(read_only=True)
    est_expiree      = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Souscription
        fields = (
            'id', 'client', 'client_username', 'agent_traitant', 'agent_username',
            'produit', 'produit_detail', 'statut', 'statut_display',
            'resiliation_demandee', 'motif_rejet', 'date_debut', 'date_fin',
            'jours_restants', 'est_expiree', 'reference_paiement', 'created_at',
        )
        read_only_fields = (
            'client', 'agent_traitant', 'statut', 'resiliation_demandee',
            'motif_rejet', 'date_fin', 'created_at',
        )


class SouscrireSerializer(serializers.ModelSerializer):
    """Écriture — utilisé par le client pour souscrire."""
    class Meta:
        model  = Souscription
        fields = ('produit', 'date_debut', 'reference_paiement')

    def validate_produit(self, produit):
        if not produit.est_actif:
            raise serializers.ValidationError(
                "Ce produit n'est plus disponible à la souscription."
            )
        return produit