"""
Commande Django : notifier_expirations_assurance
Usage : python manage.py notifier_expirations_assurance

À planifier quotidiennement.
- Notifie les clients dont la souscription expire dans 15 jours
- Marque les souscriptions expirées
"""

from django.core.management.base import BaseCommand
from insurance.services import get_souscriptions_a_notifier, marquer_souscriptions_expirees


class Command(BaseCommand):
    help = "Notifie les expirations d'assurance à J-15 et met à jour les statuts."

    def handle(self, *args, **options):
        from notifications.services import creer_notification

        # ── Notifications J-15 ────────────────────────────────
        souscriptions = get_souscriptions_a_notifier()
        count_notif = 0

        for sous in souscriptions:
            creer_notification(
                destinataire=sous.client,
                type_notif='expiration_assurance',
                titre="Expiration de votre assurance",
                message=(
                    f"Votre souscription à '{sous.produit.nom}' expire le "
                    f"{sous.date_fin.strftime('%d/%m/%Y')}. "
                    f"Pensez à la renouveler pour maintenir votre couverture."
                ),
                objet_id=sous.pk,
            )
            count_notif += 1

        # ── Mise à jour des statuts expirés ───────────────────
        count_expire = marquer_souscriptions_expirees()

        self.stdout.write(self.style.SUCCESS(
            f"Notifications J-15 : {count_notif} | "
            f"Souscriptions expirées mises à jour : {count_expire}"
        ))