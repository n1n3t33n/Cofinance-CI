# COFINANCE CI — Plateforme de Microfinance

Plateforme digitale de gestion de microcrédits, d'assurance mobile et de support client en temps réel.

Développée avec **Python / Django / Django REST Framework**.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Backend | Python 3.11+, Django 5.x |
| API REST | Django REST Framework |
| Authentification | JWT (SimpleJWT) |
| Documentation API | drf-spectacular (Swagger / Redoc) |
| Temps réel (chat) | Django Channels (WebSocket) |
| Base de données | SQLite (dev) → PostgreSQL (prod) |
| Versioning | Git / GitHub |

---

## Structure du projet

cofinance_ci/           ← configuration principale + commande seed_db
accounts/               ← utilisateurs, rôles, authentification JWT
credits/                ← demandes de microcrédit, workflow, échéancier
repayments/             ← paiements, pénalités, alertes J-3/J+1
insurance/              ← produits d'assurance, souscriptions, expirations
notifications/          ← alertes in-app centralisées
chat/                   ← support client en temps réel (WebSocket)
dashboard/              ← tableau de bord administrateur


Chaque application suit la même structure interne :
<app>/
├── models/
│   ├── init.py
│   └── <modele>.py
├── views/
│   ├── init.py
│   └── <vue>.py
├── serializers/
│   ├── init.py
│   └── <serializer>.py
├── admin/
│   ├── init.py
│   └── <admin>.py
├── urls.py
└── services.py

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/n1n3t33n/Cofinance-CI.git
cd Cofinance-CI
```

### 2. Créer et activer l'environnement virtuel

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Appliquer les migrations

```bash
python manage.py migrate
```

### 5. Peupler la base de données

```bash
python manage.py seed_db
```

Comptes créés automatiquement :

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Administrateur | `admin` | `admin1234` |
| Agent 1 | `agent_kouame` | `agent1234` |
| Agent 2 | `agent_bamba` | `agent1234` |
| Client 1 | `client_aya` | `client1234` |
| Client 2 | `client_kone` | `client1234` |
| Client 3 | `client_tra` | `client1234` |
| Client 4 | `client_yao` | `client1234` |
| Client 5 | `client_soro` | `client1234` |

### 6. Lancer le serveur

```bash
python manage.py runserver
```

---

## Accès rapide

| URL | Description |
|---|---|
| `http://127.0.0.1:8000/api/docs/` | Documentation Swagger |
| `http://127.0.0.1:8000/api/redoc/` | Documentation Redoc |
| `http://127.0.0.1:8000/admin/` | Interface d'administration |
| `http://127.0.0.1:8000/api/chat/demo/` | Page de démonstration du chat |

---

## Endpoints principaux

### Authentification
| Méthode | URL | Description |
|---|---|---|
| POST | `/api/auth/register/` | Créer un compte |
| POST | `/api/auth/login/` | Connexion → access + refresh token |
| POST | `/api/auth/token/refresh/` | Renouveler le token |
| GET / PATCH | `/api/auth/profile/` | Consulter / modifier son profil |

### Microcrédits
| Méthode | URL | Description |
|---|---|---|
| POST | `/api/credits/soumettre/` | Soumettre une demande (client) |
| GET | `/api/credits/mes-demandes/` | Mes demandes (client) |
| GET | `/api/credits/` | Toutes les demandes (agent/admin) |
| GET | `/api/credits/{id}/` | Détail d'une demande |
| PATCH | `/api/credits/{id}/traiter/` | Faire avancer le workflow (agent) |

### Remboursements
| Méthode | URL | Description |
|---|---|---|
| POST | `/api/repayments/payer/` | Enregistrer un paiement (agent) |
| GET | `/api/repayments/mon-historique/` | Historique des paiements (client) |
| GET | `/api/repayments/echeance/{id}/` | Détail échéance + pénalité |
| GET | `/api/repayments/penalites/` | Liste des pénalités (agent) |

### Assurance
| Méthode | URL | Description |
|---|---|---|
| GET | `/api/insurance/produits/` | Catalogue des produits |
| POST | `/api/insurance/souscrire/` | Souscrire (client) |
| GET | `/api/insurance/mes-souscriptions/` | Mes souscriptions (client) |
| POST | `/api/insurance/{id}/resilier/` | Résilier (client) |
| GET | `/api/insurance/toutes/` | Toutes les souscriptions (agent) |

### Notifications
| Méthode | URL | Description |
|---|---|---|
| GET | `/api/notifications/` | Mes notifications |
| PATCH | `/api/notifications/{id}/lire/` | Marquer comme lue |
| POST | `/api/notifications/tout-lire/` | Tout marquer comme lu |

### Chat
| Méthode | URL | Description |
|---|---|---|
| POST | `/api/chat/ouvrir/` | Ouvrir une conversation (client) |
| GET | `/api/chat/ma-conversation/` | Mes conversations (client) |
| GET | `/api/chat/toutes/` | Toutes les conversations (agent) |
| POST | `/api/chat/{id}/rejoindre/` | Rejoindre une conversation (agent) |
| GET | `/api/chat/{id}/messages/` | Historique des messages |
| POST | `/api/chat/{id}/fermer/` | Fermer la conversation |



### WebSocket — chat temps réel
ws://localhost:8000/ws/chat/<conversation_id>/?token=<access_token>

Format des messages envoyés :
```json
{ "type": "message", "contenu": "Bonjour !" }
{ "type": "typing",  "est_en_train_d_ecrire": true }
```

### Dashboard
| Méthode | URL | Description |
|---|---|---|
| GET | `/api/dashboard/` | Tous les indicateurs |
| GET | `/api/dashboard/agents/` | Performance par agent |
| GET | `/api/dashboard/regions/` | Répartition par région |

---

## Commandes utiles

```bash
# Peupler la base
python manage.py seed_db

# Repartir de zéro
python manage.py seed_db --reset

# Alertes échéances J-3 / J+1 (à planifier quotidiennement)
python manage.py envoyer_alertes_echeances

# Notifications expiration assurance J-15 (à planifier quotidiennement)
python manage.py notifier_expirations_assurance
```

---

## Configuration PostgreSQL (production)

Dans `settings.py`, remplacer le bloc `DATABASES` par :

```python
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     'cofinance_ci',
        'USER':     'postgres',
        'PASSWORD': 'votre_mot_de_passe',
        'HOST':     'localhost',
        'PORT':     '5432',
    }
}
```

Puis installer le driver :

```bash
pip install psycopg2-binary
```

---

## Démonstration du chat en temps réel

1. Lancer le serveur : `python manage.py runserver`
2. Ouvrir `http://127.0.0.1:8000/api/chat/demo/` dans **deux onglets**
3. Onglet 1 : se connecter avec `client_aya / client1234`
4. Onglet 2 : se connecter avec `agent_kouame / agent1234`
5. Envoyer des messages — ils apparaissent instantanément dans les deux onglets

---

## Auteur

Projet réalisé dans le cadre du module **Programmation Python**
Institut Ivoirien de Technologie (IIT) — Abidjan, juin 2026