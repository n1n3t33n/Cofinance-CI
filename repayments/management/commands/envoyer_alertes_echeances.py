"""
Commande Django : envoyer_alertes_echeances
Usage : python manage.py envoyer_alertes_echeances

À planifier quotidiennement (cron ou Celery beat).
Crée des notifications in-app :
  - J-7 et J-3 : rappels d'échéance au client ;
  - J+1       : passage en retard (client + agent traitant) + pénalité.
"""

from django.core.management.base import BaseCommand
from repayments.services import get_echeances_a_alerter, calculer_penalite
from repayments.models import Penalite
from decimal import Decimal


def _fmt(valeur) -> str:
    return f"{int(valeur):,}".replace(',', ' ')


class Command(BaseCommand):
    help = "Envoie les alertes d'échéances (J-7, J-3) et les retards (J+1)."

    def handle(self, *args, **options):
        from notifications.services import creer_notification

        j_moins_7, j_moins_3, j_plus_1 = get_echeances_a_alerter()

        # ── Rappels J-7 et J-3 (client) ──────────────────────
        count_rappels = 0
        for libelle, qs in (('7 jours', j_moins_7), ('3 jours', j_moins_3)):
            for echeance in qs:
                demande = echeance.demande
                ref = demande.reference_paiement or f"crédit #{demande.pk}"
                creer_notification(
                    destinataire=demande.client,
                    type_notif='rappel_echeance',
                    titre="Rappel de remboursement",
                    message=(
                        f"Nous vous rappelons que votre prochaine échéance de "
                        f"remboursement d'un montant de {_fmt(echeance.montant_du)} FCFA "
                        f"est prévue pour le {echeance.date_echeance.strftime('%d/%m/%Y')} "
                        f"(dans {libelle}). Veuillez effectuer votre paiement avant cette "
                        f"date afin d'éviter tout retard. Référence : {ref}."
                    ),
                    objet_id=echeance.pk,
                )
                count_rappels += 1

        # ── Passage en retard J+1 (client + agent) + pénalité ─
        count_retard = 0
        for echeance in j_plus_1:
            demande = echeance.demande
            client  = demande.client

            montant_pen = calculer_penalite(echeance)
            if montant_pen > Decimal('0.00'):
                Penalite.objects.update_or_create(
                    echeance=echeance,
                    defaults={'montant': montant_pen, 'jours_retard': 1},
                )

            creer_notification(
                destinataire=client,
                type_notif='retard_echeance',
                titre="Échéance en retard",
                message=(
                    f"Votre échéance n°{echeance.numero} de "
                    f"{_fmt(echeance.montant_du)} FCFA était due le "
                    f"{echeance.date_echeance.strftime('%d/%m/%Y')}. "
                    f"Une pénalité de {_fmt(montant_pen)} FCFA a été appliquée. "
                    "Régularisez votre paiement dès que possible."
                ),
                objet_id=echeance.pk,
            )

            # Le scénario impose d'informer aussi l'agent responsable du dossier.
            if demande.agent_traitant:
                creer_notification(
                    destinataire=demande.agent_traitant,
                    type_notif='retard_echeance',
                    titre="Échéance client en retard",
                    message=(
                        f"L'échéance n°{echeance.numero} ({_fmt(echeance.montant_du)} FCFA) "
                        f"de {client.username} (crédit #{demande.pk}) est en retard depuis "
                        f"le {echeance.date_echeance.strftime('%d/%m/%Y')}. "
                        "Contactez le client via le chat pour l'accompagner."
                    ),
                    objet_id=echeance.pk,
                )
            count_retard += 1

        self.stdout.write(self.style.SUCCESS(
            f"Alertes envoyées — rappels J-7/J-3 : {count_rappels} | retards J+1 : {count_retard}"
        ))
