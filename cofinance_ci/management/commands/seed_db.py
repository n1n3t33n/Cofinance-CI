"""
Commande Django : seed_db
Usage : python manage.py seed_db
        python manage.py seed_db --reset  (vide la base avant)

Crée un jeu de données de démonstration complet et cohérent :
- 1 administrateur
- 2 agents de terrain
- 5 clients
- Produits d'assurance
- Demandes de crédit à différents stades du workflow
- Remboursements
- Souscriptions d'assurance
- Notifications
- Conversations de support avec messages
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from datetime import date
from dateutil.relativedelta import relativedelta
from decimal import Decimal


class Command(BaseCommand):
    help = "Peuple la base de données avec des données de démonstration."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Vide toutes les tables avant de créer les données.',
        )

    def handle(self, *args, **options):
        if options['reset']:
            self.stdout.write(self.style.WARNING("Suppression des données existantes..."))
            self._reset()

        self.stdout.write("Création des données de démonstration...")

        with transaction.atomic():
            admin     = self._creer_admin()
            agents    = self._creer_agents()
            clients   = self._creer_clients()
            produits  = self._creer_produits()
            demandes  = self._creer_demandes(clients, agents)
            self._creer_souscriptions(clients, produits)
            self._creer_conversations(clients, agents)

        self.stdout.write(self.style.SUCCESS(
            "\n✅ Base de données peuplée avec succès !\n"
            "─────────────────────────────────────────\n"
            "  Administrateur : admin / admin1234\n"
            "  Agent 1        : agent_kouame / agent1234\n"
            "  Agent 2        : agent_bamba / agent1234\n"
            "  Clients        : client_aya, client_kone,\n"
            "                   client_tra, client_yao,\n"
            "                   client_soro / client1234\n"
            "─────────────────────────────────────────\n"
            "  Swagger : http://127.0.0.1:8000/api/docs/\n"
        ))

    # ──────────────────────────────────────────────────────────
    # RESET
    # ──────────────────────────────────────────────────────────

    def _reset(self):
        from chat.models import Message, Conversation
        from notifications.models import Notification
        from repayments.models import Paiement, Penalite
        from insurance.models import Souscription
        from credits.models import Echeance, DemandeCrédit
        from accounts.models import User

        Message.objects.all().delete()
        Conversation.objects.all().delete()
        Notification.objects.all().delete()
        Paiement.objects.all().delete()
        Penalite.objects.all().delete()
        Echeance.objects.all().delete()
        DemandeCrédit.objects.all().delete()
        Souscription.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write(self.style.SUCCESS("Tables vidées."))

    # ──────────────────────────────────────────────────────────
    # UTILISATEURS
    # ──────────────────────────────────────────────────────────

    def _creer_admin(self):
        from accounts.models import User
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email':      'admin@cofinance-ci.com',
                'role':       'administrateur',
                'telephone':  '+225 07 00 00 00',
                'region':     'Abidjan-Plateau',
                'is_staff':   True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('admin1234')
            admin.save()
            self.stdout.write(f"  ✔ Admin créé : {admin.username}")
        return admin

    def _creer_agents(self):
        from accounts.models import User
        agents_data = [
            {
                'username':  'agent_kouame',
                'email':     'kouame@cofinance-ci.com',
                'role':      'agent',
                'telephone': '+225 05 11 22 33',
                'region':    'Abidjan-Yopougon',
            },
            {
                'username':  'agent_bamba',
                'email':     'bamba@cofinance-ci.com',
                'role':      'agent',
                'telephone': '+225 07 44 55 66',
                'region':    'Bouaké',
            },
        ]
        agents = []
        for data in agents_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults=data
            )
            if created:
                user.set_password('agent1234')
                user.save()
                self.stdout.write(f"  ✔ Agent créé : {user.username}")
            agents.append(user)
        return agents

    def _creer_clients(self):
        from accounts.models import User
        clients_data = [
            {
                'username':  'client_aya',
                'email':     'aya@email.com',
                'role':      'client',
                'telephone': '+225 01 23 45 67',
                'region':    'Abidjan-Abobo',
            },
            {
                'username':  'client_kone',
                'email':     'kone@email.com',
                'role':      'client',
                'telephone': '+225 05 98 76 54',
                'region':    'Abidjan-Cocody',
            },
            {
                'username':  'client_tra',
                'email':     'tra@email.com',
                'role':      'client',
                'telephone': '+225 07 11 22 33',
                'region':    'San-Pédro',
            },
            {
                'username':  'client_yao',
                'email':     'yao@email.com',
                'role':      'client',
                'telephone': '+225 01 44 55 66',
                'region':    'Bouaké',
            },
            {
                'username':  'client_soro',
                'email':     'soro@email.com',
                'role':      'client',
                'telephone': '+225 05 77 88 99',
                'region':    'Korhogo',
            },
        ]
        clients = []
        for data in clients_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults=data
            )
            if created:
                user.set_password('client1234')
                user.save()
                self.stdout.write(f"  ✔ Client créé : {user.username}")
            clients.append(user)
        return clients

    # ──────────────────────────────────────────────────────────
    # PRODUITS D'ASSURANCE
    # ──────────────────────────────────────────────────────────

    def _creer_produits(self):
        from insurance.models import ProduitAssurance
        produits_data = [
            {
                'nom':               'Assurance Vie Essentielle',
                'type_produit':      'vie',
                'description':       'Couverture vie de base pour micro-entrepreneurs. '
                                     'Capital versé aux bénéficiaires en cas de décès.',
                'prime_mensuelle':   Decimal('2500.00'),
                'duree_mois':        12,
                'montant_couverture': Decimal('1000000.00'),
            },
            {
                'nom':               'Assurance Décès-Invalidité',
                'type_produit':      'deces',
                'description':       'Protection décès et invalidité totale ou partielle. '
                                     'Accessible depuis un téléphone mobile.',
                'prime_mensuelle':   Decimal('3500.00'),
                'duree_mois':        12,
                'montant_couverture': Decimal('2000000.00'),
            },
            {
                'nom':               'Assurance Crédit Protégé',
                'type_produit':      'credit',
                'description':       'Couvre le remboursement du crédit en cas d\'incapacité '
                                     'de travail ou de décès de l\'emprunteur.',
                'prime_mensuelle':   Decimal('1500.00'),
                'duree_mois':        6,
                'montant_couverture': Decimal('500000.00'),
            },
        ]
        produits = []
        for data in produits_data:
            p, created = ProduitAssurance.objects.get_or_create(
                nom=data['nom'],
                defaults=data
            )
            if created:
                self.stdout.write(f"  ✔ Produit créé : {p.nom}")
            produits.append(p)
        return produits

    # ──────────────────────────────────────────────────────────
    # DEMANDES DE CRÉDIT
    # ──────────────────────────────────────────────────────────

    def _creer_demandes(self, clients, agents):
        from credits.models import DemandeCrédit, Echeance
        from credits.services import calculer_score, generer_echeancier
        from repayments.models import Paiement

        demandes = []

        scenarios = [
            # (client, statut, montant_demande, duree, montant_approuve, agent)
            (clients[0], 'decaissee',  400000,  12, 400000,  agents[0]),
            (clients[1], 'approuvee',  750000,  18, 700000,  agents[0]),
            (clients[2], 'en_analyse', 1200000, 24, None,    agents[1]),
            (clients[3], 'soumise',    300000,  6,  None,    None),
            (clients[4], 'rejetee',    5000000, 36, None,    agents[1]),
            (clients[0], 'soumise',    200000,  6,  None,    None),
        ]

        for client, statut, montant, duree, montant_appr, agent in scenarios:
            demande, created = DemandeCrédit.objects.get_or_create(
                client=client,
                montant_demande=Decimal(str(montant)),
                duree_mois=duree,
                defaults={
                    'motif':           f"Fonds de roulement pour activité commerciale — {client.username}",
                    'statut':          statut,
                    'agent_traitant':  agent,
                    'taux_interet':    Decimal('12.00'),
                    'montant_approuve': Decimal(str(montant_appr)) if montant_appr else None,
                    'commentaire_agent': "Dossier conforme." if statut in ['approuvee', 'decaissee'] else "",
                }
            )

            if created:
                # Score et échéancier pour les demandes approuvées/décaissées
                if statut in ['approuvee', 'decaissee']:
                    demande.score_eligibilite = calculer_score(demande)
                    demande.save(update_fields=['score_eligibilite'])

                    echeances_data = generer_echeancier(demande)
                    echeances = Echeance.objects.bulk_create([
                        Echeance(demande=demande, **e) for e in echeances_data
                    ])

                    # Pour la demande décaissée : simuler 2 paiements effectués
                    if statut == 'decaissee' and echeances:
                        from accounts.models import User
                        agent_obj = agents[0]
                        for ech in echeances[:2]:
                            Paiement.objects.get_or_create(
                                echeance=ech,
                                defaults={
                                    'agent':                agent_obj,
                                    'montant_paye':         ech.montant_du,
                                    'mode_paiement':        'orange_money',
                                    'reference_transaction': f"OM{ech.pk}2024",
                                }
                            )
                            ech.est_payee = True
                            ech.save(update_fields=['est_payee'])

                self.stdout.write(
                    f"  ✔ Demande créée : {client.username} — "
                    f"{montant} FCFA — {statut}"
                )
                demandes.append(demande)

        return demandes

    # ──────────────────────────────────────────────────────────
    # SOUSCRIPTIONS
    # ──────────────────────────────────────────────────────────

    def _creer_souscriptions(self, clients, produits):
        from insurance.models import Souscription

        souscriptions_data = [
            (clients[0], produits[0], 'active'),
            (clients[1], produits[1], 'active'),
            (clients[2], produits[2], 'active'),
            (clients[3], produits[0], 'expiree'),
            (clients[4], produits[1], 'resiliee'),
        ]

        for client, produit, statut in souscriptions_data:
            sous, created = Souscription.objects.get_or_create(
                client=client,
                produit=produit,
                defaults={
                    'statut':             statut,
                    'reference_paiement': f"WAVE{client.pk}{produit.pk}",
                }
            )
            if created:
                # Pour les expirées, forcer une date passée
                if statut == 'expiree':
                    sous.date_debut = date.today() - relativedelta(months=13)
                    sous.date_fin   = date.today() - relativedelta(months=1)
                    sous.save(update_fields=['date_debut', 'date_fin'])

                self.stdout.write(
                    f"  ✔ Souscription créée : {client.username} — "
                    f"{produit.nom} — {statut}"
                )

    # ──────────────────────────────────────────────────────────
    # CONVERSATIONS ET MESSAGES
    # ──────────────────────────────────────────────────────────

    def _creer_conversations(self, clients, agents):
        from chat.models import Conversation, Message

        conversations_data = [
            # (client, agent, statut, messages)
            (
                clients[0], agents[0], 'ouverte',
                [
                    (clients[0], "Bonjour, je voudrais avoir des informations sur mon crédit."),
                    (agents[0],  "Bonjour ! Je suis là pour vous aider. Quel est votre numéro de dossier ?"),
                    (clients[0], "C'est le dossier n°1, le crédit de 400 000 FCFA."),
                    (agents[0],  "Je vois votre dossier. Tout est en ordre, les 2 premières échéances sont payées."),
                    (clients[0], "Merci beaucoup !"),
                ]
            ),
            (
                clients[1], agents[0], 'ouverte',
                [
                    (clients[1], "Bonjour, quand est-ce que mon crédit sera décaissé ?"),
                    (agents[0],  "Votre dossier est approuvé. Le décaissement se fera sous 48h."),
                ]
            ),
            (
                clients[2], None, 'en_attente',
                [
                    (clients[2], "Bonjour, j'ai soumis une demande de crédit il y a 3 jours."),
                ]
            ),
        ]

        for client, agent, statut, messages in conversations_data:
            conv, created = Conversation.objects.get_or_create(
                client=client,
                statut=statut,
                defaults={'agent': agent}
            )
            if created:
                for auteur, contenu in messages:
                    Message.objects.create(
                        conversation=conv,
                        auteur=auteur,
                        contenu=contenu,
                        est_lu=True,
                    )
                self.stdout.write(
                    f"  ✔ Conversation créée : {client.username} "
                    f"↔ {agent.username if agent else 'en attente'} "
                    f"({len(messages)} messages)"
                )