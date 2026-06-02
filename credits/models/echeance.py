from django.db import models
from .demande import DemandeCrédit


class Echeance(models.Model):
    """
    Une ligne d'échéancier générée automatiquement
    lors de l'approbation d'une demande de crédit.
    """

    demande        = models.ForeignKey(
        DemandeCrédit,
        on_delete=models.CASCADE,
        related_name='echeances',
    )
    numero         = models.PositiveIntegerField(help_text="Numéro de l'échéance (1, 2, 3…)")
    date_echeance  = models.DateField()
    montant_du     = models.DecimalField(max_digits=12, decimal_places=2)
    montant_capital = models.DecimalField(max_digits=12, decimal_places=2)
    montant_interet = models.DecimalField(max_digits=12, decimal_places=2)
    est_payee       = models.BooleanField(default=False)

    class Meta:
        ordering = ['numero']
        verbose_name = 'Échéance'
        verbose_name_plural = 'Échéances'

    def __str__(self):
        return f"Échéance {self.numero} — Demande #{self.demande.pk}"