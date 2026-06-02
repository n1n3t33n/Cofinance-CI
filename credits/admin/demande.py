from django.contrib import admin
from credits.models import DemandeCrédit, Echeance


class EcheanceInline(admin.TabularInline):
    model  = Echeance
    extra  = 0
    readonly_fields = ('numero', 'date_echeance', 'montant_du',
                       'montant_capital', 'montant_interet', 'est_payee')


@admin.register(DemandeCrédit)
class DemandeCréditAdmin(admin.ModelAdmin):
    list_display  = ('id', 'client', 'montant_demande', 'duree_mois', 'statut', 'created_at')
    list_filter   = ('statut',)
    search_fields = ('client__username',)
    inlines       = [EcheanceInline]