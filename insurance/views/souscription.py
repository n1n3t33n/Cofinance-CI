from datetime import date

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from insurance.models import Souscription
from insurance.serializers import SouscriptionSerializer, SouscrireSerializer
from credits.permissions import EstClient, EstAgentOuAdmin
from notifications.services import creer_notification


@extend_schema(request=SouscrireSerializer, responses=SouscriptionSerializer)
@api_view(['POST'])
@permission_classes([EstClient])
def souscrire(request):
    """
    Un client demande une souscription à un produit d'assurance.
    La souscription reste « En attente de validation » jusqu'à l'approbation
    d'un agent (item #8).
    """
    serializer = SouscrireSerializer(data=request.data)
    if serializer.is_valid():
        souscription = serializer.save(client=request.user)  # statut = en_attente (défaut)

        # Accusé au client
        creer_notification(
            destinataire=request.user,
            type_notif='souscription_confirmee',
            titre="Demande de souscription reçue",
            message=(
                f"Votre demande de souscription à '{souscription.produit.nom}' "
                "a bien été reçue. Elle sera étudiée par un agent."
            ),
            objet_id=souscription.pk,
        )

        # Alerte temps réel aux agents/admins (à valider).
        from accounts.models import User
        for agent in User.objects.filter(
            role__in=['agent', 'administrateur'], is_active=True,
        ):
            creer_notification(
                destinataire=agent,
                type_notif='souscription_confirmee',
                titre="Nouvelle souscription à valider",
                message=(
                    f"{request.user.username} demande une souscription à "
                    f"'{souscription.produit.nom}'."
                ),
                objet_id=souscription.pk,
            )

        return Response(SouscriptionSerializer(souscription).data,
                        status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([EstClient])
def mes_souscriptions(request):
    """Un client consulte ses polices (en attente, en cours, historiques)."""
    souscriptions = Souscription.objects.filter(
        client=request.user
    ).select_related('produit', 'agent_traitant')
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
def demander_resiliation(request, pk):
    """
    Un client *demande* la résiliation de sa souscription en cours.
    La résiliation n'est effective qu'après confirmation d'un agent/admin.
    """
    try:
        sous = Souscription.objects.get(pk=pk, client=request.user)
    except Souscription.DoesNotExist:
        return Response({'detail': 'Souscription introuvable.'}, status=404)

    if sous.statut != 'en_cours':
        return Response(
            {'detail': 'Seule une souscription en cours peut être résiliée.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if sous.resiliation_demandee:
        return Response(
            {'detail': 'Une demande de résiliation est déjà en cours.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    sous.resiliation_demandee = True
    sous.save(update_fields=['resiliation_demandee'])

    # Alerte aux agents/admins (à confirmer).
    from accounts.models import User
    for agent in User.objects.filter(
        role__in=['agent', 'administrateur'], is_active=True,
    ):
        creer_notification(
            destinataire=agent,
            type_notif='souscription_confirmee',
            titre="Demande de résiliation",
            message=(
                f"{request.user.username} demande la résiliation de sa "
                f"souscription à '{sous.produit.nom}'."
            ),
            objet_id=sous.pk,
        )

    return Response(SouscriptionSerializer(sous).data)


# ── AGENT / ADMIN ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def toutes_souscriptions(request):
    """Un agent/admin consulte toutes les souscriptions, filtre optionnel."""
    statut = request.query_params.get('statut')
    qs = Souscription.objects.all().select_related('client', 'produit', 'agent_traitant')
    if statut:
        qs = qs.filter(statut=statut)
    return Response(SouscriptionSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def approuver_souscription(request, pk):
    """
    Un agent approuve une souscription en attente : elle passe « En cours »
    (couverture active à partir d'aujourd'hui). Verrouillée ensuite (item #8).
    """
    try:
        sous = Souscription.objects.get(pk=pk)
    except Souscription.DoesNotExist:
        return Response({'detail': 'Souscription introuvable.'}, status=404)

    if sous.statut != 'en_attente':
        return Response(
            {'detail': "Seule une souscription en attente peut être approuvée."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    sous.statut         = 'en_cours'
    sous.agent_traitant = request.user
    sous.date_debut     = date.today()
    sous.date_fin       = None  # recalculée à partir d'aujourd'hui par save()
    sous.save()

    creer_notification(
        destinataire=sous.client,
        type_notif='souscription_confirmee',
        titre="Souscription approuvée",
        message=(
            f"Votre souscription à '{sous.produit.nom}' est désormais en cours, "
            f"jusqu'au {sous.date_fin.strftime('%d/%m/%Y')}."
        ),
        objet_id=sous.pk,
    )
    return Response(SouscriptionSerializer(sous).data)


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def rejeter_souscription(request, pk):
    """Un agent rejette une souscription en attente, avec motif."""
    try:
        sous = Souscription.objects.get(pk=pk)
    except Souscription.DoesNotExist:
        return Response({'detail': 'Souscription introuvable.'}, status=404)

    if sous.statut != 'en_attente':
        return Response(
            {'detail': "Seule une souscription en attente peut être rejetée."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    motif = (request.data.get('motif') or '').strip()
    if not motif:
        return Response({'motif': "Le motif de rejet est obligatoire."}, status=400)

    sous.statut         = 'rejetee'
    sous.motif_rejet    = motif
    sous.agent_traitant = request.user
    sous.save(update_fields=['statut', 'motif_rejet', 'agent_traitant'])

    creer_notification(
        destinataire=sous.client,
        type_notif='souscription_confirmee',
        titre="Souscription rejetée",
        message=(
            f"Votre souscription à '{sous.produit.nom}' a été rejetée. "
            f"Motif : {motif}"
        ),
        objet_id=sous.pk,
    )
    return Response(SouscriptionSerializer(sous).data)


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def resilier(request, pk):
    """
    Un agent/admin confirme la résiliation d'une souscription en cours
    (généralement suite à une demande du client).
    """
    try:
        sous = Souscription.objects.get(pk=pk)
    except Souscription.DoesNotExist:
        return Response({'detail': 'Souscription introuvable.'}, status=404)

    if sous.statut != 'en_cours':
        return Response(
            {'detail': 'Seule une souscription en cours peut être résiliée.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    sous.statut         = 'resiliee'
    sous.agent_traitant = request.user
    sous.save(update_fields=['statut', 'agent_traitant'])

    creer_notification(
        destinataire=sous.client,
        type_notif='souscription_confirmee',
        titre="Souscription résiliée",
        message=(
            f"Votre souscription à '{sous.produit.nom}' a été résiliée."
        ),
        objet_id=sous.pk,
    )
    return Response(SouscriptionSerializer(sous).data)
