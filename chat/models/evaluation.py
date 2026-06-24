from django.db import models
from .conversation import Conversation


class EvaluationConversation(models.Model):
    """Évaluation d'un ticket par le client après résolution (note de 1 à 5)."""

    conversation = models.OneToOneField(
        Conversation,
        on_delete=models.CASCADE,
        related_name='evaluation',
    )
    note        = models.PositiveSmallIntegerField()  # 1 à 5
    commentaire = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Évaluation de conversation'
        verbose_name_plural = 'Évaluations de conversation'

    def __str__(self):
        return f"Éval conv #{self.conversation_id} — {self.note}/5"
