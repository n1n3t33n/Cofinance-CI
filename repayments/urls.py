from django.urls import path
from repayments.views import (
    enregistrer_paiement,
    mon_historique,
    detail_echeance,
    liste_penalites,
)

urlpatterns = [
    path('payer/',              enregistrer_paiement, name='repayment-payer'),
    path('mon-historique/',     mon_historique,       name='repayment-historique'),
    path('echeance/<int:pk>/',  detail_echeance,      name='repayment-echeance-detail'),
    path('penalites/',          liste_penalites,      name='repayment-penalites'),
]