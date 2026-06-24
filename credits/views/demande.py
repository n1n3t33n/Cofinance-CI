from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from credits.models import DemandeCrédit, Echeance
from credits.serializers import (
    DemandeCréditSerializer,
    SoumettreDemandSerializer,
    TraiterDemandSerializer,
)
from credits.permissions import EstClient, EstAgentOuAdmin
from credits.services import (
    calculer_score,
    generer_echeancier,
    generer_reference_credit,
    notifier_nouvelle_demande,
    notifier_changement_statut,
)


# ── CLIENT ────────────────────────────────────────────────────

@extend_schema(request=SoumettreDemandSerializer, responses=DemandeCréditSerializer)
@api_view(['POST'])
@permission_classes([EstClient])
def soumettre_demande(request):
    """Un client soumet une nouvelle demande de crédit."""
    serializer = SoumettreDemandSerializer(data=request.data)
    if serializer.is_valid():
        demande = serializer.save(client=request.user)
        # Temps réel : prévenir agents + admins (notification + rafraîchissement)
        notifier_nouvelle_demande(demande)
        return Response(
            DemandeCréditSerializer(demande).data,
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([EstClient])
def mes_demandes(request):
    """Un client consulte ses propres demandes."""
    demandes = DemandeCrédit.objects.filter(client=request.user)
    return Response(DemandeCréditSerializer(demandes, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detail_demande(request, pk):
    """Détail d'une demande — client (la sienne) ou agent/admin."""
    try:
        demande = DemandeCrédit.objects.get(pk=pk)
    except DemandeCrédit.DoesNotExist:
        return Response({'detail': 'Demande introuvable.'}, status=404)

    # Un client ne peut voir que ses propres demandes
    if request.user.is_client and demande.client != request.user:
        return Response({'detail': 'Accès refusé.'}, status=403)

    return Response(DemandeCréditSerializer(demande).data)


# ── AGENT / ADMIN ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def liste_demandes(request):
    """Un agent/admin consulte toutes les demandes, avec filtre optionnel par statut."""
    statut = request.query_params.get('statut')
    qs = DemandeCrédit.objects.all()
    if statut:
        qs = qs.filter(statut=statut)
    return Response(DemandeCréditSerializer(qs, many=True).data)


@extend_schema(request=TraiterDemandSerializer, responses=DemandeCréditSerializer)
@api_view(['PATCH'])
@permission_classes([EstAgentOuAdmin])
def traiter_demande(request, pk):
    """
    Un agent fait avancer le workflow d'une demande.
    Si statut → approuvee : calcule le score et génère l'échéancier.
    """
    try:
        demande = DemandeCrédit.objects.get(pk=pk)
    except DemandeCrédit.DoesNotExist:
        return Response({'detail': 'Demande introuvable.'}, status=404)

    ancien_statut = demande.statut

    serializer = TraiterDemandSerializer(demande, data=request.data, partial=True)
    if serializer.is_valid():
        demande = serializer.save(agent_traitant=request.user)

        # Uniquement lors du PASSAGE à « approuvee » → score + échéancier.
        # (évite de régénérer l'échéancier à chaque modification ultérieure)
        if ancien_statut != 'approuvee' and demande.statut == 'approuvee':
            demande.score_eligibilite = calculer_score(demande)
            # Référence de paiement unique pré-enregistrée (une seule fois).
            if not demande.reference_paiement:
                demande.reference_paiement = generer_reference_credit(demande)
            demande.save(update_fields=['score_eligibilite', 'reference_paiement'])

            # Supprimer un éventuel échéancier existant et en régénérer un
            demande.echeances.all().delete()
            echeances_data = generer_echeancier(demande)
            Echeance.objects.bulk_create([
                Echeance(demande=demande, **e) for e in echeances_data
            ])

        # Temps réel : prévenir le client si le statut a changé.
        if ancien_statut != demande.statut:
            notifier_changement_statut(demande)

        return Response(DemandeCréditSerializer(demande).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)