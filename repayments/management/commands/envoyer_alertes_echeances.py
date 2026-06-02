"""
Commande Django : envoyer_alertes_echeances
Usage : python manage.py envoyer_alertes_echeances

À planifier quotidiennement (cron ou Celery beat).
Crée des notifications in-app pour les échéances J-3 et J+1.
"""

from django.core.management.base import BaseCommand
from repayments.services import get_echeances_a_alerter
from repayments.models import Penalite
from decimal import Decimal


class Command(BaseCommand):
    help = "Envoie les alertes d'échéances J-3 et J+1 et calcule les pénalités."

    def handle(self, *args, **options):
        from notifications.services import creer_notification

        j_moins_3, j_plus_1 = get_echeances_a_alerter()

        # ── Alertes J-3 ──────────────────────────────────────
        count_j3 = 0
        for echeance in j_moins_3:
            client = echeance.demande.client
            creer_notification(
                destinataire=client,
                type_notif='rappel_echeance',
                titre="Rappel de remboursement",
                message=(
                    f"Votre échéance n°{echeance.numero} de "
                    f"{echeance.montant_du} FCFA est prévue le "
                    f"{echeance.date_echeance.strftime('%d/%m/%Y')}."
                ),
                objet_id=echeance.pk,
            )
            count_j3 += 1

        # ── Alertes J+1 + pénalités ───────────────────────────
        count_j1 = 0
        for echeance in j_plus_1:
            client = echeance.demande.client

            # Calcul et sauvegarde de la pénalité
            from repayments.services import calculer_penalite
            montant_pen = calculer_penalite(echeance)

            if montant_pen > Decimal('0.00'):
                penalite, created = Penalite.objects.update_or_create(
                    echeance=echeance,
                    defaults={
                        'montant': montant_pen,
                        'jours_retard': 1,
                    }
                )

            creer_notification(
                destinataire=client,
                type_notif='retard_echeance',
                titre="Échéance en retard",
                message=(
                    f"Votre échéance n°{echeance.numero} de "
                    f"{echeance.montant_du} FCFA était due le "
                    f"{echeance.date_echeance.strftime('%d/%m/%Y')}. "
                    f"Une pénalité de {montant_pen} FCFA a été appliquée."
                ),
                objet_id=echeance.pk,
            )
            count_j1 += 1

        self.stdout.write(self.style.SUCCESS(
            f"Alertes envoyées — J-3 : {count_j3} | J+1 : {count_j1}"
        ))