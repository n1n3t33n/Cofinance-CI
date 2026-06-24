from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from credits.models import Echeance
from repayments.models import Paiement, Penalite
from repayments.serializers import (
    PaiementSerializer,
    EnregistrerPaiementSerializer,
    DeclarerPaiementSerializer,
    PenaliteSerializer,
)
from credits.permissions import EstClient, EstAgentOuAdmin
from repayments.services import calculer_penalite, valider_paiement


# ── AGENT : enregistrement d'un paiement ─────────────────────

@extend_schema(request=EnregistrerPaiementSerializer, responses=PaiementSerializer)
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
        # Enregistrement direct par l'agent → validé immédiatement.
        paiement = serializer.save(agent=request.user, statut='valide')
        valider_paiement(paiement, request.user)
        return Response(PaiementSerializer(paiement).data, status=status.HTTP_201_CREATED)
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


@extend_schema(request=DeclarerPaiementSerializer, responses=PaiementSerializer)
@api_view(['POST'])
@permission_classes([EstClient])
def declarer_paiement(request):
    """
    Un client déclare avoir réglé une échéance (avec la référence pré-enregistrée
    de son crédit). Le paiement reste « en attente » jusqu'à validation par un
    agent. Le client est invité à joindre son justificatif dans le chat du dossier.
    """
    serializer = DeclarerPaiementSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    echeance = serializer.validated_data['echeance']
    demande  = echeance.demande

    # Le client ne déclare que sur ses propres crédits décaissés.
    if demande.client_id != request.user.id:
        return Response({'detail': 'Accès refusé.'}, status=403)
    if demande.statut != 'decaissee':
        return Response(
            {'detail': "Le crédit doit être décaissé pour régler une échéance."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Référence par défaut = référence unique du crédit.
    reference = (serializer.validated_data.get('reference_transaction')
                 or demande.reference_paiement or '')
    paiement = serializer.save(
        montant_paye=echeance.montant_du,
        reference_transaction=reference,
        statut='en_attente',
    )

    # Notifier l'agent responsable (ou, à défaut, les agents/admins).
    from notifications.services import creer_notification
    cible = demande.agent_traitant
    if cible:
        creer_notification(
            destinataire=cible,
            type_notif='paiement_recu',
            titre="Paiement à valider",
            message=(
                f"{request.user.username} a déclaré le paiement de l'échéance "
                f"n°{echeance.numero} (crédit #{demande.pk}). Vérifiez le justificatif "
                "dans le chat puis validez."
            ),
            objet_id=paiement.pk,
        )
    else:
        from accounts.models import User
        for agent in User.objects.filter(
            role__in=['agent', 'administrateur'], is_active=True,
        ):
            creer_notification(
                destinataire=agent,
                type_notif='paiement_recu',
                titre="Paiement à valider",
                message=(
                    f"{request.user.username} a déclaré un paiement (crédit "
                    f"#{demande.pk}, échéance n°{echeance.numero})."
                ),
                objet_id=paiement.pk,
            )

    return Response(PaiementSerializer(paiement).data, status=status.HTTP_201_CREATED)


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


# ── AGENT : échéances à encaisser (pré-remplissage du paiement) ──

@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def echeances_a_venir(request):
    """
    Échéances impayées à encaisser prochainement (dues sous 7 jours ou en
    retard), pour préparer le formulaire de paiement (item #5).
    Agent : celles des crédits qu'il traite. Admin : toutes.
    Chaque entrée fournit une référence de transaction suggérée et un drapeau
    `payable` (faux si une échéance antérieure reste impayée).
    """
    from datetime import date, timedelta
    from repayments.services import generer_reference_paiement

    limite = date.today() + timedelta(days=7)
    qs = Echeance.objects.filter(
        est_payee=False,
        date_echeance__lte=limite,
        demande__statut='decaissee',
    ).select_related(
        'demande', 'demande__client', 'demande__agent_traitant',
    ).order_by('date_echeance')

    if request.user.is_agent:
        qs = qs.filter(demande__agent_traitant=request.user)

    resultats = []
    for e in qs:
        payable = not e.demande.echeances.filter(
            numero__lt=e.numero, est_payee=False,
        ).exists()
        resultats.append({
            'echeance_id':        e.id,
            'numero':             e.numero,
            'montant_du':         str(e.montant_du),
            'date_echeance':      e.date_echeance.isoformat(),
            'demande_id':         e.demande_id,
            'client':             e.demande.client.username,
            'reference_suggeree': generer_reference_paiement(e),
            'payable':            payable,
            'en_retard':          e.date_echeance < date.today(),
        })
    return Response(resultats)


# ── AGENT : paiements déclarés à valider ─────────────────────

@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def paiements_a_valider(request):
    """
    Paiements déclarés par les clients et en attente de validation.
    Agent : ceux des crédits qu'il traite. Admin : tous.
    """
    qs = Paiement.objects.filter(statut='en_attente').select_related(
        'echeance__demande__client',
    ).order_by('date_paiement')
    if request.user.is_agent:
        qs = qs.filter(echeance__demande__agent_traitant=request.user)
    return Response(PaiementSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def valider_paiement_view(request, pk):
    """Un agent valide un paiement déclaré : l'échéance passe « payée »."""
    try:
        paiement = Paiement.objects.select_related('echeance__demande').get(pk=pk)
    except Paiement.DoesNotExist:
        return Response({'detail': 'Paiement introuvable.'}, status=404)

    if paiement.statut != 'en_attente':
        return Response(
            {'detail': 'Ce paiement est déjà validé.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    valider_paiement(paiement, request.user)
    return Response(PaiementSerializer(paiement).data)