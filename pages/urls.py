from django.urls import path
from pages.views import (
    accueil, services, a_propos,
    connexion, inscription,
    eligibilite, blog, parametres,
    aide,
)

urlpatterns = [
    path('',              accueil,      name='accueil'),
    path('services/',     services,     name='services'),
    path('a-propos/',     a_propos,     name='a-propos'),
    path('connexion/',    connexion,    name='connexion'),
    path('inscription/',  inscription,  name='inscription'),
    path('eligibilite/',  eligibilite,  name='eligibilite'),
    path('blog/',         blog,         name='blog'),
    path('aide/',         aide,         name='aide'),
    path('parametres/',   parametres,   name='parametres'),
]