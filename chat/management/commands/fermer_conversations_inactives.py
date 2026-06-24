"""
Ferme automatiquement les conversations RÉSOLUES restées inactives depuis
N jours, et notifie le client.

Usage :
    python manage.py fermer_conversations_inactives
    python manage.py fermer_conversations_inactives --jours 5

À planifier (cron / tâche planifiée Windows) pour une exécution quotidienne.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from chat.models import Conversation
from chat.services import diffuser_chat
from notifications.services import creer_notification


class Command(BaseCommand):
    help = "Ferme les conversations résolues inactives depuis N jours (défaut : 3)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--jours', type=int, default=3,
            help="Jours d'inactivité avant fermeture automatique (défaut : 3).",
        )

    def handle(self, *args, **options):
        jours  = options['jours']
        limite = timezone.now() - timedelta(days=jours)
        a_fermer = Conversation.objects.filter(statut='resolue', updated_at__lt=limite)

        total = 0
        for conv in a_fermer:
            conv.statut = 'fermee'
            conv.save(update_fields=['statut'])
            creer_notification(
                destinataire=conv.client,
                type_notif='message_chat',
                titre="Conversation fermée automatiquement",
                message=(
                    f"Votre conversation a été fermée après {jours} jours sans "
                    "activité. N'hésitez pas à en ouvrir une nouvelle si besoin."
                ),
                objet_id=conv.pk,
            )
            diffuser_chat(conv.pk, {
                'type':           'statut_event',
                'statut':         conv.statut,
                'statut_display': conv.get_statut_display(),
            })
            total += 1

        self.stdout.write(self.style.SUCCESS(
            f"{total} conversation(s) fermée(s) (inactives depuis ≥ {jours} jours)."
        ))
