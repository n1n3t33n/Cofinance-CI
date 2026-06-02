from django.urls import path
from insurance.views import (
    liste_produits,
    creer_produit,
    modifier_produit,
    souscrire,
    mes_souscriptions,
    detail_souscription,
    resilier,
    toutes_souscriptions,
)

urlpatterns = [
    # Produits
    path('produits/',               liste_produits,       name='insurance-produits-liste'),
    path('produits/creer/',         creer_produit,        name='insurance-produits-creer'),
    path('produits/<int:pk>/',      modifier_produit,     name='insurance-produits-modifier'),

    # Souscriptions
    path('souscrire/',              souscrire,            name='insurance-souscrire'),
    path('mes-souscriptions/',      mes_souscriptions,    name='insurance-mes-souscriptions'),
    path('<int:pk>/',               detail_souscription,  name='insurance-detail'),
    path('<int:pk>/resilier/',      resilier,             name='insurance-resilier'),
    path('toutes/',                 toutes_souscriptions, name='insurance-toutes'),
]