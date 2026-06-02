from django.db import models
from credits.models import Echeance


class Penalite(models.Model):
    """
    Pénalité de retard calculée automatiquement
    pour une échéance non payée après sa date d'échéance.
    """
    echeance       = models.OneToOneField(
        Echeance,
        on_delete=models.CASCADE,
        related_name='penalite',
    )
    montant        = models.DecimalField(max_digits=12, decimal_places=2)
    taux_penalite  = models.DecimalField(
        max_digits=5, decimal_places=2, default=2.00,
        help_text="Taux mensuel de pénalité en %"
    )
    jours_retard   = models.PositiveIntegerField(default=0)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Pénalité'
        verbose_name_plural = 'Pénalités'

    def __str__(self):
        return f"Pénalité {self.montant} FCFA — Échéance #{self.echeance.pk}"