from django.db import models


class ProduitAssurance(models.Model):
    """
    Catalogue des formules d'assurance proposées par COFINANCE CI.
    Géré uniquement par les administrateurs.
    """

    class TypeProduit(models.TextChoices):
        VIE         = 'vie',        'Assurance Vie'
        DECES       = 'deces',      'Assurance Décès-Invalidité'
        CREDIT      = 'credit',     'Assurance Crédit'

    nom             = models.CharField(max_length=150)
    type_produit    = models.CharField(max_length=20, choices=TypeProduit.choices)
    description     = models.TextField()
    prime_mensuelle = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Montant de la prime mensuelle en FCFA"
    )
    duree_mois      = models.PositiveIntegerField(
        help_text="Durée de couverture en mois"
    )
    montant_couverture = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Capital assuré en FCFA"
    )
    est_actif       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nom']
        verbose_name = 'Produit d\'assurance'
        verbose_name_plural = 'Produits d\'assurance'

    def __str__(self):
        return f"{self.nom} ({self.get_type_produit_display()})"