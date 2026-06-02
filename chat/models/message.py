from django.db import models
from django.conf import settings
from .conversation import Conversation


class Message(models.Model):
    """Message envoyé dans une conversation."""

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
    contenu    = models.TextField()
    est_lu     = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'

    def __str__(self):
        return f"Message #{self.pk} par {self.auteur.username}"