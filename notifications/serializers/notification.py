from rest_framework import serializers
from notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type_notif_display = serializers.CharField(
        source='get_type_notif_display', read_only=True
    )

    class Meta:
        model  = Notification
        fields = (
            'id', 'type_notif', 'type_notif_display',
            'titre', 'message', 'objet_id',
            'est_lue', 'created_at',
        )
        read_only_fields = fields