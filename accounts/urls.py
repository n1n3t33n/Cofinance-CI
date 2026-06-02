from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from accounts.views import register, profile

urlpatterns = [
    path('register/',      register,                  name='auth-register'),
    path('login/',         TokenObtainPairView.as_view(),  name='auth-login'),
    path('token/refresh/', TokenRefreshView.as_view(),     name='auth-token-refresh'),
    path('profile/',       profile,                   name='auth-profile'),
]