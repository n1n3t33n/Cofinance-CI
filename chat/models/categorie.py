from django.db import models


class Categorie(models.Model):
    """Étiquette/catégorie applicable à un ticket de support (M2M conversation)."""

    nom     = models.CharField(max_length=80, unique=True)
    couleur = models.CharField(
        max_length=20, default='#F2640D',
        help_text="Couleur du badge (hex).",
    )

    class Meta:
        ordering = ['nom']
        verbose_name = 'Catégorie'
        verbose_name_plural = 'Catégories'

    def __str__(self):
        return self.nom
