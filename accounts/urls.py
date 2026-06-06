from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from accounts.views import (
    register, profile, toggle_disponibilite, agents_disponibles,
    request_otp, save_email_request_otp, verify_otp,
)

urlpatterns = [
    path('register/',              register,                       name='auth-register'),
    path('login/',                 TokenObtainPairView.as_view(),  name='auth-login'),
    path('token/refresh/',         TokenRefreshView.as_view(),     name='auth-token-refresh'),
    path('profile/',               profile,                        name='auth-profile'),
    path('toggle-disponibilite/',  toggle_disponibilite,           name='auth-toggle-disponibilite'),
    path('agents-disponibles/',    agents_disponibles,             name='auth-agents-disponibles'),

    # 2FA — OTP par email
    path('request-otp/',           request_otp,                    name='auth-request-otp'),
    path('save-email-otp/',        save_email_request_otp,         name='auth-save-email-otp'),
    path('verify-otp/',            verify_otp,                     name='auth-verify-otp'),
]