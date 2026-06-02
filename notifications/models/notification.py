from django.db import models
from django.conf import settings


class Notification(models.Model):

    class TypeNotif(models.TextChoices):
        STATUT_CREDIT       = 'statut_credit',       'Changement de statut crédit'
        RAPPEL_ECHEANCE     = 'rappel_echeance',     'Rappel d\'échéance'
        RETARD_ECHEANCE     = 'retard_echeance',     'Échéance en retard'
        PAIEMENT_RECU       = 'paiement_recu',       'Paiement reçu'
        EXPIRATION_ASSURANCE = 'expiration_assurance', 'Expiration assurance'
        SOUSCRIPTION_CONFIRMEE = 'souscription_confirmee', 'Souscription confirmée'
        MESSAGE_CHAT        = 'message_chat',        'Nouveau message'
        GENERAL             = 'general',             'Général'

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    type_notif  = models.CharField(
        max_length=30,
        choices=TypeNotif.choices,
        default=TypeNotif.GENERAL,
    )
    titre       = models.CharField(max_length=200)
    message     = models.TextField()

    # Référence optionnelle vers l'objet concerné
    # (pk de l'échéance, de la demande, de la souscription…)
    objet_id    = models.PositiveIntegerField(null=True, blank=True)

    est_lue     = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        statut = "lue" if self.est_lue else "non lue"
        return f"[{statut}] {self.titre} → {self.destinataire.username}"