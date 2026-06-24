"""
URL configuration for cofinance_ci project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Documentation API
    path('api/schema/', SpectacularAPIView.as_view(),                       name='schema'),
    path('api/docs/',   SpectacularSwaggerView.as_view(url_name='schema'),  name='swagger-ui'),
    path('api/redoc/',  SpectacularRedocView.as_view(url_name='schema'),    name='redoc'),

    # API Applications
    path('api/auth/',          include('accounts.urls')),
    path('api/credits/',       include('credits.urls')),
    path('api/repayments/',    include('repayments.urls')),
    path('api/insurance/',     include('insurance.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/chat/',          include('chat.urls')),
    path('api/dashboard/',     include('dashboard.urls')),

    # Pages web
    path('', include('accounts.urls_web')),
    path('', include('pages.urls')),
]

# Fichiers statiques en developpement (admin + notre CSS/JS)
urlpatterns += staticfiles_urlpatterns()

# Fichiers médias uploadés (pièces jointes, justificatifs) — servis en DEBUG.
# En production, c'est le serveur web (nginx/apache) qui sert MEDIA_ROOT.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)