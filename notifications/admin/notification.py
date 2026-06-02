from django.contrib import admin
from notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ('titre', 'destinataire', 'type_notif', 'est_lue', 'created_at')
    list_filter   = ('type_notif', 'est_lue')
    search_fields = ('destinataire__username', 'titre')
    readonly_fields = ('created_at',)