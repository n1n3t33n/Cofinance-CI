from django.db import models
from django.conf import settings


class Conversation(models.Model):
    """
    Ticket de support entre un client et un agent.

    Cycle de vie : En attente → En cours → Résolue → Fermée.
    Indépendant du workflow d'une demande (« séparé »), mais « liable » à
    une demande de crédit via le champ optionnel demande_credit.
    """

    class Statut(models.TextChoices):
        EN_ATTENTE = 'en_attente', 'En attente'
        EN_COURS   = 'en_cours',   'En cours'
        RESOLUE    = 'resolue',    'Résolue'
        FERMEE     = 'fermee',     'Fermée'

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
    statut = models.CharField(
        max_length=15,
        choices=Statut.choices,
        default=Statut.EN_ATTENTE,
    )
    sujet = models.CharField(max_length=200, blank=True)
    categories = models.ManyToManyField(
        'Categorie',
        blank=True,
        related_name='conversations',
    )
    # Liens optionnels (« séparé mais liable ») vers une demande de crédit
    # ou une souscription d'assurance.
    demande_credit = models.ForeignKey(
        'credits.DemandeCrédit',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='conversations',
    )
    souscription = models.ForeignKey(
        'insurance.Souscription',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='conversations',
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
