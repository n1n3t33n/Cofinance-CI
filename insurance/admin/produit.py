from django.contrib import admin
from insurance.models import ProduitAssurance, Souscription


@admin.register(ProduitAssurance)
class ProduitAssuranceAdmin(admin.ModelAdmin):
    list_display  = ('nom', 'type_produit', 'prime_mensuelle',
                     'duree_mois', 'montant_couverture', 'est_actif')
    list_filter   = ('type_produit', 'est_actif')
    search_fields = ('nom',)


@admin.register(Souscription)
class SouscriptionAdmin(admin.ModelAdmin):
    list_display  = ('client', 'produit', 'statut', 'date_debut', 'date_fin')
    list_filter   = ('statut', 'produit')
    search_fields = ('client__username',)