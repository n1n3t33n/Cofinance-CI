from django.urls import path
from notifications.views import mes_notifications, marquer_lue, marquer_toutes

urlpatterns = [
    path('',                  mes_notifications, name='notifications-liste'),
    path('<int:pk>/lire/',    marquer_lue,       name='notifications-lire'),
    path('tout-lire/',        marquer_toutes,    name='notifications-tout-lire'),
]