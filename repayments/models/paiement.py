from django.db import models
from django.conf import settings
from credits.models import Echeance


class Paiement(models.Model):
    """
    Enregistrement d'un paiement sur une échéance.

    Deux origines possibles :
      - déclaré par le client (statut « en attente »), puis validé par un agent ;
      - enregistré directement par un agent (statut « validé »).
    L'échéance ne passe « payée » qu'à la validation.
    """

    class ModePaiement(models.TextChoices):
        ORANGE_MONEY = 'orange_money', 'Orange Money'
        WAVE         = 'wave',         'Wave'
        MTN_MOMO     = 'mtn_momo',     'MTN MoMo'
        ESPECES      = 'especes',      'Espèces'

    class Statut(models.TextChoices):
        EN_ATTENTE = 'en_attente', 'En attente de validation'
        VALIDE     = 'valide',     'Validé'

    echeance = models.ForeignKey(
        Echeance,
        on_delete=models.CASCADE,
        related_name='paiements',
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='paiements_enregistres',
    )
    valide_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='paiements_valides',
    )

    statut        = models.CharField(
        max_length=12,
        choices=Statut.choices,
        default=Statut.VALIDE,
    )
    montant_paye  = models.DecimalField(max_digits=12, decimal_places=2)
    mode_paiement = models.CharField(
        max_length=20,
        choices=ModePaiement.choices,
        default=ModePaiement.ESPECES,
    )
    reference_transaction = models.CharField(max_length=100, blank=True)
    note                  = models.TextField(blank=True)
    date_paiement         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_paiement']
        verbose_name = 'Paiement'
        verbose_name_plural = 'Paiements'

    def __str__(self):
        return f"Paiement {self.montant_paye} FCFA — Échéance #{self.echeance.pk}"