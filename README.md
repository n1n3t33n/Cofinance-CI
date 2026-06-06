# COFINANCE CI — Plateforme de Microfinance

Plateforme digitale de gestion de microcrédits, d'assurance mobile et de support client en temps réel, conçue pour les populations ivoiriennes à revenus modestes.

Développée avec **Python / Django / Django REST Framework** côté serveur et **Bootstrap 5 / Vanilla JS** côté client.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Backend | Python 3.11+, Django 6.x |
| API REST | Django REST Framework + drf-spectacular |
| Authentification | JWT (SimpleJWT) + 2FA OTP email |
| Temps réel (chat) | Django Channels (WebSocket) + Daphne (ASGI) |
| Base de données | PostgreSQL |
| Frontend | Bootstrap 5.3.8 (local) + Vanilla JS ES6+ |
| Stockage avatar | `localStorage` (par compte utilisateur) |
| Thème | Dark / Light mode (préférence par compte) |

---

## Fonctionnalités

### Backend
- **3 rôles** : Client, Agent de terrain, Administrateur
- **Microcrédits** : workflow complet (soumise → en_analyse → approuvée → décaissée)
- **Remboursements** : échéancier, pénalités, alertes J-3 / J+1
- **Assurance mobile** : catalogue produits, souscription, expiration J-15
- **Notifications** : alertes in-app centralisées par utilisateur
- **Chat** : support client en temps réel via WebSocket
- **Dashboard** : indicateurs globaux, performance par agent, répartition régionale
- **2FA par email** : code OTP à 6 chiffres, expiration 10 minutes

### Frontend
- Pages publiques : Accueil, Services, Blog, Éligibilité, À propos
- Dashboards : Client, Agent, Administrateur (navigation JS sans rechargement)
- Connexion en deux étapes avec indicateur d'étapes visuels
- Inscription avec badge 2FA et indicateur force du mot de passe
- Page paramètres avec statut 2FA, email masqué, gestion avatar
- Animations au scroll (cards entrant dans le viewport)
- Compteurs animés sur les statistiques hero
- Système de toasts (notifications coin bas-droit)
- Mode sombre / clair par compte utilisateur
- Carousel témoignages auto-rotatif (4s)
- Indicateur de connexion WebSocket dans la sidebar agent
- Progress bar de statut sur les crédits

---

## Structure du projet

```
cofinance_ci/
├── cofinance_ci/          ← configuration principale (settings, urls, asgi)
├── accounts/              ← utilisateurs, rôles, JWT, 2FA OTP
├── credits/               ← demandes de microcrédit, workflow, échéancier
├── repayments/            ← paiements, pénalités, alertes
├── insurance/             ← produits d'assurance, souscriptions
├── notifications/         ← alertes in-app
├── chat/                  ← support client WebSocket
├── dashboard/             ← tableau de bord global
├── templates/             ← templates Django (base, pages, dashboards)
│   ├── base/              ← base.html, navbar.html, footer.html, base_dashboard.html
│   ├── pages/             ← accueil, services, blog, connexion, inscription...
│   └── accounts/          ← sidebars client/agent/admin
└── static/
    ├── css/cofinance.css  ← feuille de style principale
    ├── js/                ← cofinance.js, auth.js, dashboard_*.js, parametres.js, blog.js
    └── vendor/bootstrap/  ← Bootstrap 5.3.8 (local, bundle avec Popper)
```

Chaque application backend suit la même structure :
```
<app>/
├── models/        ← modèles Django
├── views/         ← vues DRF
├── serializers/   ← sérialiseurs
├── admin/         ← interface admin
├── urls.py
└── services.py    ← logique métier
```

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/n1n3t33n/Cofinance-CI.git
cd Cofinance-CI/cofinance_ci
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

### 4. Configurer le fichier `.env`

Créer un fichier `.env` à la racine de `cofinance_ci/` :

```env
SECRET_KEY=votre_cle_secrete
DEBUG=True

DB_NAME=cofinance_ci
DB_USER=postgres
DB_PASSWORD=votre_mdp
DB_HOST=localhost
DB_PORT=5432
```

> En développement (`DEBUG=True`), l'email est géré par le **console backend** :
> le code OTP s'affiche dans le terminal et est **auto-rempli dans le formulaire** — aucune configuration email requise.

### 5. Créer la base de données PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE cofinance_ci;"
```

### 6. Appliquer les migrations

```bash
python manage.py migrate
```

### 7. Peupler la base de données

```bash
python manage.py seed_db
```

Comptes créés automatiquement :

| Rôle | Identifiant | Mot de passe | Email seed |
|---|---|---|---|
| Administrateur | `admin` | `admin1234` | admin@cofinanceci.com |
| Agent 1 | `agent_kouame` | `agent1234` | kouame@cofinanceci.com |
| Agent 2 | `agent_bamba` | `agent1234` | bamba@cofinanceci.com |
| Client 1 | `client_aya` | `client1234` | aya@email.com |
| Client 2 | `client_kone` | `client1234` | kone@email.com |
| Client 3 | `client_tra` | `client1234` | tra@email.com |
| Client 4 | `client_yao` | `client1234` | yao@email.com |
| Client 5 | `client_soro` | `client1234` | soro@email.com |

### 8. Lancer le serveur

```bash
daphne -p 8000 cofinance_ci.asgi:application
```

> **Important** : utiliser Daphne (ASGI), pas `runserver` — nécessaire pour les WebSockets du chat.

L'application est accessible sur `http://127.0.0.1:8000/`

---

## Accès rapide

| URL | Description |
|---|---|
| `http://127.0.0.1:8000/` | Page d'accueil |
| `http://127.0.0.1:8000/connexion/` | Connexion (2FA) |
| `http://127.0.0.1:8000/inscription/` | Créer un compte |
| `http://127.0.0.1:8000/parametres/` | Paramètres du compte |
| `http://127.0.0.1:8000/dashboard/client/` | Dashboard client |
| `http://127.0.0.1:8000/dashboard/agent/` | Dashboard agent |
| `http://127.0.0.1:8000/dashboard/admin/` | Dashboard administrateur |
| `http://127.0.0.1:8000/api/docs/` | Documentation Swagger |
| `http://127.0.0.1:8000/api/redoc/` | Documentation Redoc |
| `http://127.0.0.1:8000/admin/` | Interface d'administration Django |

---

## Endpoints API

### Authentification

| Méthode | URL | Description |
|---|---|---|
| POST | `/api/auth/register/` | Créer un compte |
| POST | `/api/auth/login/` | Connexion JWT directe (accès API) |
| POST | `/api/auth/token/refresh/` | Renouveler le token |
| GET / PATCH | `/api/auth/profile/` | Consulter / modifier son profil |
| POST | `/api/auth/request-otp/` | Valider credentials + envoyer OTP (2FA) |
| POST | `/api/auth/save-email-otp/` | Sauvegarder email + envoyer OTP (utilisateurs sans email) |
| POST | `/api/auth/verify-otp/` | Vérifier le code OTP → retourne tokens JWT |
| POST | `/api/auth/toggle-disponibilite/` | Basculer statut disponible/indisponible (agent) |
| GET | `/api/auth/agents-disponibles/` | Agents actuellement disponibles |

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

```
ws://localhost:8000/ws/chat/<conversation_id>/?token=<access_token>
```

Messages supportés :
```json
{ "type": "message", "contenu": "Bonjour !" }
{ "type": "typing",  "est_en_train_d_ecrire": true }
```

### Dashboard

| Méthode | URL | Description |
|---|---|---|
| GET | `/api/dashboard/` | Indicateurs globaux |
| GET | `/api/dashboard/agents/` | Performance par agent |
| GET | `/api/dashboard/regions/` | Répartition par région |

---

## Double authentification (2FA)

Le flux de connexion utilise deux étapes :

```
Identifiants → [Serveur valide] → OTP envoyé par email → Code vérifié → Tokens JWT
```

### Comportement selon l'environnement

| Environnement | `DEBUG` | Email | Code OTP |
|---|---|---|---|
| Développement | `True` | Console (terminal) | **Auto-rempli dans le formulaire** |
| Production | `False` | SMTP configuré dans `.env` | Reçu par email uniquement |

### Configurer l'email en production

Ajouter dans `.env` (Gmail avec App Password) :

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=votre@gmail.com
EMAIL_HOST_PASSWORD=abcd efgh ijkl mnop
DEFAULT_FROM_EMAIL=noreply@cofinanceci.com
```

> L'App Password Gmail se génère depuis : **Google Account → Sécurité → Validation en deux étapes → Mots de passe des applications**. Ce n'est pas le mot de passe habituel.

### Utilisateurs sans email (comptes existants)

Au moment de la connexion, si le compte n'a pas d'email enregistré, le formulaire affiche une étape supplémentaire pour en ajouter un. L'email peut aussi être modifié à tout moment depuis `/parametres/`.

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

## Configuration production

Modifier le fichier `.env` :

```env
DEBUG=False
SECRET_KEY=une_cle_longue_et_aleatoire

DB_NAME=cofinance_ci
DB_USER=postgres
DB_PASSWORD=mot_de_passe_securise
DB_HOST=localhost
DB_PORT=5432

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=votre@gmail.com
EMAIL_HOST_PASSWORD=app_password_16_chars
DEFAULT_FROM_EMAIL=noreply@cofinanceci.com
```

Puis collecter les fichiers statiques :

```bash
python manage.py collectstatic
```

---

## Démonstration du chat

1. Lancer : `daphne -p 8000 cofinance_ci.asgi:application`
2. Ouvrir `http://127.0.0.1:8000/` dans **deux onglets**
3. Onglet 1 : se connecter avec `client_kone / client1234` → dashboard client → Support chat
4. Onglet 2 : se connecter avec `agent_kouame / agent1234` → dashboard agent → Conversations
5. Envoyer des messages — ils apparaissent instantanément dans les deux onglets

---

## Auteur

**Moussa Ben Youssouf TRAORE**
- Projet réalisé dans le cadre de fin du module **Programmation Python DJANGO FRAMEWORK**
Institut Ivoirien de Technologie (IIT) — Abidjan, juin 2026

## Instructeur

**M Sedrick KOUAGNI**