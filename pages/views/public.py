from django.shortcuts import render


def accueil(request):
    return render(request, 'pages/accueil.html')


def services(request):
    return render(request, 'pages/services.html')


def a_propos(request):
    return render(request, 'pages/a_propos.html')


def connexion(request):
    return render(request, 'pages/connexion.html')


def inscription(request):
    return render(request, 'pages/inscription.html')