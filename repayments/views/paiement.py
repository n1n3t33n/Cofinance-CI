from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from credits.models import Echeance
from repayments.models import Paiement, Penalite
from repayments.serializers import (
    PaiementSerializer,
    EnregistrerPaiementSerializer,
    PenaliteSerializer,
)
from credits.permissions import EstClient, EstAgentOuAdmin
from repayments.services import calculer_penalite


# ── AGENT : enregistrement d'un paiement ─────────────────────

@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def enregistrer_paiement(request):
    """
    Un agent enregistre un paiement sur une échéance.
    Marque automatiquement l'échéance comme payée si
    le montant couvre intégralement le montant dû.
    """
    serializer = EnregistrerPaiementSerializer(data=request.data)
    if serializer.is_valid():
        echeance = serializer.validated_data['echeance']
        paiement = serializer.save(agent=request.user)

        if paiement.montant_paye >= echeance.montant_du:
            echeance.est_payee = True
            echeance.save(update_fields=['est_payee'])

        # Notification au client
        from notifications.services import creer_notification
        creer_notification(
            destinataire=echeance.demande.client,
            type_notif='paiement_recu',
            titre="Paiement enregistré",
            message=(
                f"Votre paiement de {paiement.montant_paye} FCFA "
                f"pour l'échéance n°{echeance.numero} a bien été enregistré."
            ),
            objet_id=paiement.pk,
        )

        return Response(
            PaiementSerializer(paiement).data,
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── CLIENT : historique de ses remboursements ────────────────

@api_view(['GET'])
@permission_classes([EstClient])
def mon_historique(request):
    """
    Un client consulte tous ses paiements passés,
    groupés par demande de crédit.
    """
    paiements = Paiement.objects.filter(
        echeance__demande__client=request.user
    ).select_related('echeance__demande')
    return Response(PaiementSerializer(paiements, many=True).data)


# ── COMMUN : détail d'une échéance avec pénalité ─────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detail_echeance(request, pk):
    """
    Détail d'une échéance avec calcul en temps réel
    de la pénalité de retard éventuelle.
    """
    try:
        echeance = Echeance.objects.get(pk=pk)
    except Echeance.DoesNotExist:
        return Response({'detail': 'Échéance introuvable.'}, status=404)

    # Contrôle d'accès : client ne voit que ses échéances
    if request.user.is_client and echeance.demande.client != request.user:
        return Response({'detail': 'Accès refusé.'}, status=403)

    penalite = calculer_penalite(echeance)

    return Response({
        'echeance':        EcheanceData(echeance),
        'penalite_retard': str(penalite),
    })


def EcheanceData(echeance):
    from credits.serializers import EcheanceSerializer
    return EcheanceSerializer(echeance).data


# ── AGENT : liste des pénalités ───────────────────────────────

@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def liste_penalites(request):
    """Liste toutes les pénalités enregistrées."""
    penalites = Penalite.objects.all().select_related('echeance__demande__client')
    return Response(PenaliteSerializer(penalites, many=True).data)