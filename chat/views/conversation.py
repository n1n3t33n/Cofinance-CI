from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from chat.models import Conversation, Message
from chat.serializers import ConversationSerializer, MessageSerializer
from credits.permissions import EstClient, EstAgentOuAdmin


@api_view(['POST'])
@permission_classes([EstClient])
def ouvrir_conversation(request):
    """
    Un client ouvre une nouvelle conversation de support.
    S'il en a déjà une ouverte, on la retourne directement.
    """
    conv_existante = Conversation.objects.filter(
        client=request.user,
        statut__in=['ouverte', 'en_attente']
    ).first()

    if conv_existante:
        return Response(
            ConversationSerializer(conv_existante, context={'request': request}).data
        )

    conversation = Conversation.objects.create(client=request.user)

    # Notification aux agents disponibles
    from notifications.services import creer_notification
    from accounts.models import User
    agents = User.objects.filter(role__in=['agent', 'administrateur'])
    for agent in agents:
        creer_notification(
            destinataire=agent,
            type_notif='message_chat',
            titre="Nouvelle conversation de support",
            message=f"Le client {request.user.username} a ouvert une conversation.",
            objet_id=conversation.pk,
        )

    return Response(
        ConversationSerializer(conversation, context={'request': request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([EstClient])
def ma_conversation(request):
    """Un client consulte son historique de conversations."""
    conversations = Conversation.objects.filter(
        client=request.user
    )
    return Response(
        ConversationSerializer(conversations, many=True, context={'request': request}).data
    )


@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def toutes_conversations(request):
    """Un agent consulte toutes les conversations, avec filtre optionnel."""
    statut = request.query_params.get('statut')
    qs = Conversation.objects.all().select_related('client', 'agent')
    if statut:
        qs = qs.filter(statut=statut)
    return Response(
        ConversationSerializer(qs, many=True, context={'request': request}).data
    )


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def rejoindre_conversation(request, pk):
    """Un agent s'assigne à une conversation en attente."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if conv.statut == 'fermee':
        return Response(
            {'detail': 'Cette conversation est fermée.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    conv.agent  = request.user
    conv.statut = 'ouverte'
    conv.save(update_fields=['agent', 'statut'])

    # Notifier le client
    from notifications.services import creer_notification
    creer_notification(
        destinataire=conv.client,
        type_notif='message_chat',
        titre="Un agent a rejoint votre conversation",
        message=f"{request.user.username} prend en charge votre demande de support.",
        objet_id=conv.pk,
    )

    return Response(
        ConversationSerializer(conv, context={'request': request}).data
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fermer_conversation(request, pk):
    """Ferme une conversation — client ou agent."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if request.user.is_client and conv.client != request.user:
        return Response({'detail': 'Accès refusé.'}, status=403)

    conv.statut = 'fermee'
    conv.save(update_fields=['statut'])
    return Response(ConversationSerializer(conv, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historique_messages(request, pk):
    """Retourne tous les messages d'une conversation."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if request.user.is_client and conv.client != request.user:
        return Response({'detail': 'Accès refusé.'}, status=403)

    # Marquer les messages reçus comme lus
    conv.messages.exclude(auteur=request.user).update(est_lu=True)

    messages = conv.messages.all()
    return Response(MessageSerializer(messages, many=True).data)