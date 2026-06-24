from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Modèle utilisateur personnalisé pour COFINANCE CI.
    Trois rôles possibles : Client, Agent de terrain, Administrateur.
    """

    class Role(models.TextChoices):
        CLIENT        = 'client',        'Client'
        AGENT         = 'agent',         'Agent de terrain'
        ADMINISTRATEUR = 'administrateur', 'Administrateur'

    class Specialite(models.TextChoices):
        GENERAL      = 'general',      'Généraliste'
        CREDIT       = 'credit',       'Crédit'
        ASSURANCE    = 'assurance',    'Assurance'
        RECOUVREMENT = 'recouvrement', 'Recouvrement'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
    )
    telephone = models.CharField(max_length=20, blank=True)
    region    = models.CharField(max_length=100, blank=True)
    # Spécialité de l'agent — utilisée pour le routage / transfert des tickets.
    specialite = models.CharField(
        max_length=20,
        choices=Specialite.choices,
        blank=True,
        help_text="Spécialité de l'agent (support client).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    est_disponible = models.BooleanField(
        default=False,
        help_text="Disponibilité de l'agent pour le support client",
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    # Propriétés utiles pour vérifier le rôle en un coup
    @property
    def is_client(self):
        return self.role == self.Role.CLIENT

    @property
    def is_agent(self):
        return self.role == self.Role.AGENT

    @property
    def is_admin_cofinance(self):
        return self.role == self.Role.ADMINISTRATEUR