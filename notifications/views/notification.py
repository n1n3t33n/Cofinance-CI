from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from notifications.models import Notification
from notifications.serializers import NotificationSerializer
from notifications.services import marquer_toutes_lues, compter_non_lues


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mes_notifications(request):
    """
    Retourne toutes les notifications de l'utilisateur connecté.
    Paramètre optionnel : ?non_lues=true pour filtrer.
    """
    qs = Notification.objects.filter(destinataire=request.user)

    if request.query_params.get('non_lues') == 'true':
        qs = qs.filter(est_lue=False)

    return Response({
        'non_lues': compter_non_lues(request.user),
        'resultats': NotificationSerializer(qs, many=True).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def marquer_lue(request, pk):
    """Marque une notification spécifique comme lue."""
    try:
        notif = Notification.objects.get(pk=pk, destinataire=request.user)
    except Notification.DoesNotExist:
        return Response({'detail': 'Notification introuvable.'}, status=404)

    notif.est_lue = True
    notif.save(update_fields=['est_lue'])
    return Response(NotificationSerializer(notif).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def marquer_toutes(request):
    """Marque toutes les notifications de l'utilisateur comme lues."""
    count = marquer_toutes_lues(request.user)
    return Response({
        'detail': f'{count} notification(s) marquée(s) comme lues.'
    })