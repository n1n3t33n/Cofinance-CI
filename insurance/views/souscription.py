from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from insurance.models import Souscription
from insurance.serializers import SouscriptionSerializer, SouscrireSerializer
from credits.permissions import EstClient, EstAgentOuAdmin


@extend_schema(request=SouscrireSerializer, responses=SouscriptionSerializer)
@api_view(['POST'])
@permission_classes([EstClient])
def souscrire(request):
    """Un client souscrit à un produit d'assurance."""
    serializer = SouscrireSerializer(data=request.data)
    if serializer.is_valid():
        souscription = serializer.save(client=request.user)

        # Notification de confirmation
        from notifications.services import creer_notification
        creer_notification(
            destinataire=request.user,
            type_notif='souscription_confirmee',
            titre="Souscription confirmée",
            message=(
                f"Votre souscription à '{souscription.produit.nom}' est active "
                f"jusqu'au {souscription.date_fin.strftime('%d/%m/%Y')}."
            ),
            objet_id=souscription.pk,
        )

        return Response(
            SouscriptionSerializer(souscription).data,
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([EstClient])
def mes_souscriptions(request):
    """Un client consulte ses polices actives et historiques."""
    souscriptions = Souscription.objects.filter(
        client=request.user
    ).select_related('produit')
    return Response(SouscriptionSerializer(souscriptions, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detail_souscription(request, pk):
    """Détail d'une souscription."""
    try:
        sous = Souscription.objects.get(pk=pk)
    except Souscription.DoesNotExist:
        return Response({'detail': 'Souscription introuvable.'}, status=404)

    if request.user.is_client and sous.client != request.user:
        return Response({'detail': 'Accès refusé.'}, status=403)

    return Response(SouscriptionSerializer(sous).data)


@api_view(['POST'])
@permission_classes([EstClient])
def resilier(request, pk):
    """Un client résilie sa souscription."""
    try:
        sous = Souscription.objects.get(pk=pk, client=request.user)
    except Souscription.DoesNotExist:
        return Response({'detail': 'Souscription introuvable.'}, status=404)

    if sous.statut != 'active':
        return Response(
            {'detail': 'Seule une souscription active peut être résiliée.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    sous.statut = 'resiliee'
    sous.save(update_fields=['statut'])
    return Response(SouscriptionSerializer(sous).data)


@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def toutes_souscriptions(request):
    """Un agent/admin consulte toutes les souscriptions avec filtre optionnel."""
    statut = request.query_params.get('statut')
    qs = Souscription.objects.all().select_related('client', 'produit')
    if statut:
        qs = qs.filter(statut=statut)
    return Response(SouscriptionSerializer(qs, many=True).data)