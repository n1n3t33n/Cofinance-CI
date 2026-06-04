from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from accounts.views import register, profile, toggle_disponibilite, agents_disponibles

urlpatterns = [
    path('register/',              register,                       name='auth-register'),
    path('login/',                 TokenObtainPairView.as_view(),  name='auth-login'),
    path('token/refresh/',         TokenRefreshView.as_view(),     name='auth-token-refresh'),
    path('profile/',               profile,                        name='auth-profile'),
    path('toggle-disponibilite/',  toggle_disponibilite,           name='auth-toggle-disponibilite'),
    path('agents-disponibles/',    agents_disponibles,             name='auth-agents-disponibles'),
]