from django.urls import path
from insurance.views import (
    liste_produits,
    creer_produit,
    modifier_produit,
    souscrire,
    mes_souscriptions,
    detail_souscription,
    demander_resiliation,
    resilier,
    toutes_souscriptions,
    approuver_souscription,
    rejeter_souscription,
)

urlpatterns = [
    # Produits
    path('produits/',               liste_produits,       name='insurance-produits-liste'),
    path('produits/creer/',         creer_produit,        name='insurance-produits-creer'),
    path('produits/<int:pk>/',      modifier_produit,     name='insurance-produits-modifier'),

    # Souscriptions
    path('souscrire/',              souscrire,            name='insurance-souscrire'),
    path('mes-souscriptions/',      mes_souscriptions,    name='insurance-mes-souscriptions'),
    path('toutes/',                 toutes_souscriptions, name='insurance-toutes'),
    path('<int:pk>/approuver/',     approuver_souscription, name='insurance-approuver'),
    path('<int:pk>/rejeter/',       rejeter_souscription, name='insurance-rejeter'),
    path('<int:pk>/demander-resiliation/', demander_resiliation, name='insurance-demander-resiliation'),
    path('<int:pk>/resilier/',      resilier,             name='insurance-resilier'),
    path('<int:pk>/',               detail_souscription,  name='insurance-detail'),
]