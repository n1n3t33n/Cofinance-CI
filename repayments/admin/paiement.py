from django.contrib import admin
from repayments.models import Paiement, Penalite


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display  = ('id', 'echeance', 'agent', 'montant_paye',
                     'mode_paiement', 'date_paiement')
    list_filter   = ('mode_paiement',)
    search_fields = ('echeance__demande__client__username', 'reference_transaction')


@admin.register(Penalite)
class PenaliteAdmin(admin.ModelAdmin):
    list_display = ('id', 'echeance', 'montant', 'jours_retard', 'created_at')