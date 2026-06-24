"""
Django settings for cofinance_ci project.

Configuration unique et dédupliquée.
Les valeurs sensibles (SECRET_KEY, base de données, e-mail) proviennent du
fichier .env (non versionné). Voir .env.example pour la liste des variables.
"""

from pathlib import Path
from datetime import timedelta
import os

from dotenv import load_dotenv

# ─── BASE & ENVIRONNEMENT ─────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# ─── SÉCURITÉ ─────────────────────────────────────────────────
# SECURITY WARNING: la clé secrète vient EXCLUSIVEMENT du .env (jamais en dur).
SECRET_KEY = os.getenv('SECRET_KEY')

# SECURITY WARNING: ne jamais lancer DEBUG=True en production.
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# Hôtes autorisés pilotés par l'env (ex: "cofinanceci.com,www.cofinanceci.com").
ALLOWED_HOSTS = [
    h.strip() for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]


# ─── APPLICATIONS ─────────────────────────────────────────────
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Packages tiers
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_spectacular',
    'channels',

    # Applications du projet
    'accounts',
    'credits',
    'repayments',
    'insurance',
    'notifications',
    'chat',
    'dashboard',
    'cofinance_ci',
    'pages',
]

# Modèle utilisateur personnalisé
AUTH_USER_MODEL = 'accounts.User'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'cofinance_ci.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# WSGI (serveurs classiques) + ASGI (Channels / Daphne pour les WebSockets)
WSGI_APPLICATION = 'cofinance_ci.wsgi.application'
ASGI_APPLICATION = 'cofinance_ci.asgi.application'


# ─── BASE DE DONNÉES (PostgreSQL via .env) ────────────────────
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     os.getenv('DB_NAME'),
        'USER':     os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST':     os.getenv('DB_HOST', 'localhost'),
        'PORT':     os.getenv('DB_PORT', '5432'),
    }
}


# ─── VALIDATION DES MOTS DE PASSE ─────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ─── REST FRAMEWORK ───────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# ─── DRF SPECTACULAR (Swagger / Redoc) ────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'COFINANCE CI API',
    'DESCRIPTION': 'Plateforme digitale de gestion de microcrédits, assurance mobile et support client.',
    'VERSION': '1.0.0',
    'SECURITY': [{'bearerAuth': []}],
    'COMPONENTS': {
        'securitySchemes': {
            'bearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
}


# ─── CHANNELS (WebSocket) ─────────────────────────────────────
# InMemoryChannelLayer : suffisant en développement (mono-process Daphne).
# En production multi-process, basculer sur channels-redis.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}


# ─── INTERNATIONALISATION ─────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Abidjan'
USE_I18N = True
USE_TZ = True


# ─── FICHIERS STATIQUES (CSS, JS, images du thème) ────────────
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# ─── FICHIERS MÉDIAS (uploads : pièces jointes, justificatifs) ─
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# ─── EMAIL — OTP 2FA ──────────────────────────────────────────
# En DEBUG : console backend (code OTP visible dans le terminal).
# En production (DEBUG=False) : SMTP via .env.
if DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND       = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
    EMAIL_HOST          = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT          = int(os.getenv('EMAIL_PORT', '587'))
    EMAIL_USE_TLS       = True
    EMAIL_HOST_USER     = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')

DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@cofinanceci.com')
