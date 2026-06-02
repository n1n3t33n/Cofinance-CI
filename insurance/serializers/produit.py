from rest_framework import serializers
from insurance.models import ProduitAssurance


class ProduitAssuranceSerializer(serializers.ModelSerializer):
    type_produit_display = serializers.CharField(
        source='get_type_produit_display', read_only=True
    )

    class Meta:
        model  = ProduitAssurance
        fields = (
            'id', 'nom', 'type_produit', 'type_produit_display',
            'description', 'prime_mensuelle', 'duree_mois',
            'montant_couverture', 'est_actif', 'created_at',
        )
        read_only_fields = ('created_at',)