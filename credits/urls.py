from django.urls import path
from credits.views import (
    soumettre_demande,
    mes_demandes,
    detail_demande,
    liste_demandes,
    traiter_demande,
)

urlpatterns = [
    # Client
    path('soumettre/',        soumettre_demande, name='credit-soumettre'),
    path('mes-demandes/',     mes_demandes,      name='credit-mes-demandes'),
    path('<int:pk>/',         detail_demande,    name='credit-detail'),

    # Agent / Admin
    path('',                  liste_demandes,    name='credit-liste'),
    path('<int:pk>/traiter/', traiter_demande,   name='credit-traiter'),
]