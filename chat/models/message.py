from django.db import models
from django.conf import settings
from .conversation import Conversation


class Message(models.Model):
    """
    Message d'une conversation. Peut porter une pièce jointe (image / PDF).

    États du message :
      - envoyé : dès la création (implicite)
      - reçu   : est_recu = True (délivré au destinataire connecté)
      - lu     : est_lu  = True (ouvert/consulté par le destinataire)
    """

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='messages_envoyes',
    )
    contenu      = models.TextField(blank=True)
    piece_jointe = models.FileField(
        upload_to='chat/pieces/%Y/%m/',
        null=True, blank=True,
    )
    est_recu   = models.BooleanField(default=False)
    est_lu     = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'

    def __str__(self):
        return f"Message #{self.pk} par {self.auteur.username}"
