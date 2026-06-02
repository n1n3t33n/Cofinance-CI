from django.db import models
from django.conf import settings
from datetime import date
from dateutil.relativedelta import relativedelta
from .produit import ProduitAssurance


class Souscription(models.Model):
    """
    Souscription d'un client à un produit d'assurance.
    La date de fin est calculée automatiquement à la sauvegarde.
    """

    class Statut(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        EXPIREE  = 'expiree',  'Expirée'
        RESILIEE = 'resiliee', 'Résiliée'

    client  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='souscriptions',
        limit_choices_to={'role': 'client'},
    )
    produit = models.ForeignKey(
        ProduitAssurance,
        on_delete=models.PROTECT,
        related_name='souscriptions',
    )

    statut      = models.CharField(
        max_length=15,
        choices=Statut.choices,
        default=Statut.ACTIVE,
    )
    date_debut  = models.DateField(default=date.today)
    date_fin    = models.DateField(blank=True, null=True)

    # Référence de paiement Mobile Money
    reference_paiement = models.CharField(max_length=100, blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Souscription'
        verbose_name_plural = 'Souscriptions'

    def save(self, *args, **kwargs):
        # Calcul automatique de la date de fin
        if not self.date_fin:
            self.date_fin = self.date_debut + relativedelta(
                months=self.produit.duree_mois
            )
        super().save(*args, **kwargs)

    @property
    def est_expiree(self):
        return date.today() > self.date_fin

    @property
    def jours_restants(self):
        delta = (self.date_fin - date.today()).days
        return max(delta, 0)

    def __str__(self):
        return f"{self.client.username} — {self.produit.nom} ({self.statut})"