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

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
    )
    telephone = models.CharField(max_length=20, blank=True)
    region    = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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