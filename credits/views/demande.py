from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from credits.models import DemandeCrédit, Echeance
from credits.serializers import (
    DemandeCréditSerializer,
    SoumettreDemandSerializer,
    TraiterDemandSerializer,
)
from credits.permissions import EstClient, EstAgentOuAdmin
from credits.services import calculer_score, generer_echeancier


# ── CLIENT ────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([EstClient])
def soumettre_demande(request):
    """Un client soumet une nouvelle demande de crédit."""
    serializer = SoumettreDemandSerializer(data=request.data)
    if serializer.is_valid():
        ancien_statut = demande.statut
        demande = serializer.save(agent_traitant=request.user)

        # Si la demande vient d'être approuvée → score + échéancier
        if demande.statut == 'approuvee':
            demande.score_eligibilite = calculer_score(demande)
            demande.save(update_fields=['score_eligibilite'])

            demande.echeances.all().delete()
            echeances_data = generer_echeancier(demande)
            Echeance.objects.bulk_create([
                Echeance(demande=demande, **e) for e in echeances_data
            ])

        # Notification automatique au client si statut a changé
        if ancien_statut != demande.statut:
            from notifications.services import creer_notification
            messages_statut = {
                'en_analyse': "Votre dossier est en cours d'analyse par notre équipe.",
                'approuvee':  f"Félicitations ! Votre crédit de {demande.montant_approuve} FCFA a été approuvé.",
                'decaissee':  "Votre crédit a été décaissé. Consultez votre échéancier.",
                'rejetee':    "Votre demande de crédit n'a pas pu être approuvée. Contactez le support.",
            }
            if demande.statut in messages_statut:
                creer_notification(
                    destinataire=demande.client,
                    type_notif='statut_credit',
                    titre=f"Dossier crédit — {demande.get_statut_display()}",
                    message=messages_statut[demande.statut],
                    objet_id=demande.pk,
                )

        return Response(DemandeCréditSerializer(demande).data)
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

    serializer = TraiterDemandSerializer(demande, data=request.data, partial=True)
    if serializer.is_valid():
        demande = serializer.save(agent_traitant=request.user)

        # Si la demande vient d'être approuvée → score + échéancier
        if demande.statut == 'approuvee':
            demande.score_eligibilite = calculer_score(demande)
            demande.save(update_fields=['score_eligibilite'])

            # Supprimer un éventuel échéancier existant et en régénérer un
            demande.echeances.all().delete()
            echeances_data = generer_echeancier(demande)
            Echeance.objects.bulk_create([
                Echeance(demande=demande, **e) for e in echeances_data
            ])

        return Response(DemandeCréditSerializer(demande).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)