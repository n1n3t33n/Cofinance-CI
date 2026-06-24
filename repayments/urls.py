from django.urls import path
from repayments.views import (
    enregistrer_paiement,
    declarer_paiement,
    paiements_a_valider,
    valider_paiement_view,
    mon_historique,
    detail_echeance,
    liste_penalites,
    echeances_a_venir,
)

urlpatterns = [
    path('payer/',              enregistrer_paiement, name='repayment-payer'),
    path('declarer/',           declarer_paiement,    name='repayment-declarer'),
    path('a-valider/',          paiements_a_valider,  name='repayment-a-valider'),
    path('<int:pk>/valider/',   valider_paiement_view, name='repayment-valider'),
    path('mon-historique/',     mon_historique,       name='repayment-historique'),
    path('a-venir/',            echeances_a_venir,    name='repayment-a-venir'),
    path('echeance/<int:pk>/',  detail_echeance,      name='repayment-echeance-detail'),
    path('penalites/',          liste_penalites,      name='repayment-penalites'),
]