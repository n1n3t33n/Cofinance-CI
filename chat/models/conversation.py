from django.db import models
from django.conf import settings


class Conversation(models.Model):
    """
    Canal de support entre un client et un agent.
    Un client ne peut avoir qu'une conversation ouverte à la fois.
    """

    class Statut(models.TextChoices):
        OUVERTE  = 'ouverte',  'Ouverte'
        FERMEE   = 'fermee',   'Fermée'
        EN_ATTENTE = 'en_attente', 'En attente d\'agent'

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_client',
        limit_choices_to={'role': 'client'},
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='conversations_agent',
    )
    statut     = models.CharField(
        max_length=15,
        choices=Statut.choices,
        default=Statut.EN_ATTENTE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Conversation'
        verbose_name_plural = 'Conversations'

    def __str__(self):
        agent_name = self.agent.username if self.agent else "non assigné"
        return f"Conv #{self.pk} — {self.client.username} ↔ {agent_name}"