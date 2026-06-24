from django.db import models
from django.conf import settings


class DemandeCrédit(models.Model):

    class Statut(models.TextChoices):
        SOUMISE    = 'soumise',     'Soumise'
        EN_ANALYSE = 'en_analyse',  'En analyse'
        APPROUVEE  = 'approuvee',   'Approuvée'
        DECAISSEE  = 'decaissee',   'Décaissée'
        REJETEE    = 'rejetee',     'Rejetée'

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='demandes_credit',
        limit_choices_to={'role': 'client'},
    )
    agent_traitant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='dossiers_traites',
        limit_choices_to={'role': 'agent'},
    )

    montant_demande  = models.DecimalField(max_digits=12, decimal_places=2)
    duree_mois       = models.PositiveIntegerField(help_text="Durée du crédit en mois")
    motif            = models.TextField()
    piece_justif     = models.FileField(upload_to='credits/pieces/', blank=True, null=True)

    statut           = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.SOUMISE,
    )

    # Résultats du traitement
    score_eligibilite = models.FloatField(null=True, blank=True)
    montant_approuve  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    taux_interet      = models.DecimalField(max_digits=5, decimal_places=2, default=12.00,
                                             help_text="Taux annuel en %")
    commentaire_agent = models.TextField(blank=True)

    # Référence de paiement unique, pré-enregistrée à l'approbation et
    # communiquée au client pour régler ses échéances.
    reference_paiement = models.CharField(
        max_length=40, unique=True, null=True, blank=True,
    )

    # Crédit entièrement remboursé (toutes les échéances payées).
    est_soldee        = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Demande de crédit'
        verbose_name_plural = 'Demandes de crédit'

    def __str__(self):
        return f"Demande #{self.pk} — {self.client.username} — {self.get_statut_display()}"