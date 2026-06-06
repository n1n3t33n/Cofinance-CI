import random
import string
from django.db import models
from django.utils import timezone
from datetime import timedelta


class OtpToken(models.Model):
    user       = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='otp_tokens',
    )
    code       = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    @classmethod
    def generate_for(cls, user):
        cls.objects.filter(user=user, used=False).update(used=True)
        code = ''.join(random.choices(string.digits, k=6))
        return cls.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
