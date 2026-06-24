import os
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from chat.models import Conversation, Message, Categorie, EvaluationConversation
from chat.serializers import (
    ConversationSerializer,
    MessageSerializer,
    CategorieSerializer,
    EvaluationSerializer,
)
from chat.services import diffuser_chat, agent_le_moins_charge
from credits.permissions import EstClient, EstAgentOuAdmin
from notifications.services import creer_notification


PIECE_JOINTE_EXT_AUTORISEES = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'}
PIECE_JOINTE_TAILLE_MAX = 5 * 1024 * 1024  # 5 Mo

# Transitions autorisées du cycle de vie d'un ticket.
TRANSITIONS_STATUT = {
    'en_attente': ['en_cours', 'fermee'],
    'en_cours':   ['resolue', 'fermee'],
    'resolue':    ['en_cours', 'fermee'],
    'fermee':     [],
}


def _a_acces(user, conv):
    """Le client propriétaire — ou tout agent/admin — a accès à la conversation."""
    if user.is_client:
        return conv.client_id == user.id
    return True


def _serialiser(conv, request):
    return ConversationSerializer(conv, context={'request': request}).data


def _payload_message(msg, request):
    """Construit le payload WebSocket d'un message (avec pièce jointe)."""
    data = MessageSerializer(msg, context={'request': request}).data
    return {
        'type':             'chat_message',
        'message_id':       msg.pk,
        'contenu':          msg.contenu,
        'auteur':           msg.auteur.username,
        'auteur_role':      msg.auteur.role,
        'created_at':       msg.created_at.isoformat(),
        'piece_jointe_url': data['piece_jointe_url'],
        'piece_jointe_nom': data['piece_jointe_nom'],
    }


# ── CLIENT ────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([EstClient])
def ouvrir_conversation(request):
    """
    Un client ouvre un ticket de support.

    - réutilise une conversation active existante (en_attente / en_cours) ;
    - sinon en crée une, l'assigne à l'agent disponible le moins chargé,
      avec sujet, catégorie et lien de demande de crédit optionnels.
    """
    conv_existante = Conversation.objects.filter(
        client=request.user,
        statut__in=['en_attente', 'en_cours'],
    ).first()
    if conv_existante:
        return Response(_serialiser(conv_existante, request))

    sujet           = (request.data.get('sujet') or '').strip()[:200]
    categorie_id    = request.data.get('categorie_id')
    demande_id      = request.data.get('demande_credit')
    souscription_id = request.data.get('souscription')

    # Liens optionnels vers une demande/souscription du client (« séparé mais liable »).
    demande = None
    if demande_id:
        from credits.models import DemandeCrédit
        demande = DemandeCrédit.objects.filter(pk=demande_id, client=request.user).first()

    souscription = None
    if souscription_id:
        from insurance.models import Souscription
        souscription = Souscription.objects.filter(pk=souscription_id, client=request.user).first()

    agent_assigne = agent_le_moins_charge()

    conv = Conversation.objects.create(
        client=request.user,
        agent=agent_assigne,
        statut='en_cours' if agent_assigne else 'en_attente',
        sujet=sujet,
        demande_credit=demande,
        souscription=souscription,
    )

    # Catégorie choisie + auto-tags selon le lien.
    if categorie_id:
        cat = Categorie.objects.filter(pk=categorie_id).first()
        if cat:
            conv.categories.add(cat)
    if demande:
        cat_credit = Categorie.objects.filter(nom='Demande de crédit').first()
        if cat_credit:
            conv.categories.add(cat_credit)
    if souscription:
        cat_assurance = Categorie.objects.filter(nom='Assurance').first()
        if cat_assurance:
            conv.categories.add(cat_assurance)

    # Notifications
    if agent_assigne:
        creer_notification(
            destinataire=agent_assigne,
            type_notif='message_chat',
            titre="Nouvelle conversation assignée",
            message=f"Le client {request.user.username} a ouvert un ticket"
                    + (f" : {sujet}" if sujet else "") + ".",
            objet_id=conv.pk,
        )
    else:
        from accounts.models import User
        for agent in User.objects.filter(role__in=['agent', 'administrateur']):
            creer_notification(
                destinataire=agent,
                type_notif='message_chat',
                titre="Nouvelle conversation en attente",
                message=f"Le client {request.user.username} attend un agent disponible.",
                objet_id=conv.pk,
            )

    return Response(_serialiser(conv, request), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([EstClient])
def ma_conversation(request):
    """Un client consulte son historique de conversations."""
    conversations = Conversation.objects.filter(client=request.user)
    return Response(
        ConversationSerializer(conversations, many=True, context={'request': request}).data
    )


@api_view(['POST'])
@permission_classes([EstClient])
def evaluer_conversation(request, pk):
    """Le client évalue (1 à 5 + commentaire) une conversation résolue/fermée."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if conv.client_id != request.user.id:
        return Response({'detail': 'Accès refusé.'}, status=403)
    if conv.statut not in ('resolue', 'fermee'):
        return Response(
            {'detail': "On ne peut évaluer qu'une conversation résolue ou fermée."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = EvaluationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    EvaluationConversation.objects.update_or_create(
        conversation=conv,
        defaults={
            'note':        serializer.validated_data['note'],
            'commentaire': serializer.validated_data.get('commentaire', ''),
        },
    )

    if conv.agent:
        creer_notification(
            destinataire=conv.agent,
            type_notif='message_chat',
            titre="Conversation évaluée",
            message=f"{conv.client.username} a évalué votre support : "
                    f"{serializer.validated_data['note']}/5.",
            objet_id=conv.pk,
        )

    return Response(_serialiser(conv, request))


# ── AGENT / ADMIN ─────────────────────────────────────────────

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
            status=status.HTTP_400_BAD_REQUEST,
        )

    conv.agent  = request.user
    conv.statut = 'en_cours'
    conv.save(update_fields=['agent', 'statut'])

    creer_notification(
        destinataire=conv.client,
        type_notif='message_chat',
        titre="Un agent a rejoint votre conversation",
        message=f"{request.user.username} prend en charge votre demande de support.",
        objet_id=conv.pk,
    )
    diffuser_chat(conv.pk, {
        'type':           'statut_event',
        'statut':         conv.statut,
        'statut_display': conv.get_statut_display(),
        'agent':          request.user.username,
    })

    return Response(_serialiser(conv, request))


@api_view(['PATCH'])
@permission_classes([EstAgentOuAdmin])
def changer_statut_conversation(request, pk):
    """Un agent fait évoluer le statut du ticket (en_cours / resolue / fermee)."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    nouveau = request.data.get('statut')
    note    = (request.data.get('message') or '').strip()

    if nouveau not in dict(Conversation.Statut.choices):
        return Response({'detail': 'Statut invalide.'}, status=400)
    if nouveau != conv.statut and nouveau not in TRANSITIONS_STATUT.get(conv.statut, []):
        return Response(
            {'detail': f"Transition non autorisée : {conv.get_statut_display()} → {nouveau}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    conv.statut = nouveau
    conv.save(update_fields=['statut'])

    messages_map = {
        'en_cours': "Votre conversation est de nouveau en cours de traitement.",
        'resolue':  "Votre demande a été marquée comme résolue.",
        'fermee':   "Votre conversation a été fermée.",
    }
    msg = messages_map.get(nouveau, "Le statut de votre conversation a changé.")
    if note:
        msg += f" {note}"
    creer_notification(
        destinataire=conv.client,
        type_notif='message_chat',
        titre="Mise à jour de votre conversation",
        message=msg,
        objet_id=conv.pk,
    )
    diffuser_chat(conv.pk, {
        'type':           'statut_event',
        'statut':         conv.statut,
        'statut_display': conv.get_statut_display(),
    })

    return Response(_serialiser(conv, request))


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def transferer_conversation(request, pk):
    """Un agent transfère la conversation à un autre agent (historique conservé)."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    from accounts.models import User
    cible = User.objects.filter(
        pk=request.data.get('agent_id'),
        role__in=['agent', 'administrateur'],
    ).first()
    note = (request.data.get('note') or '').strip()

    if not cible:
        return Response({'detail': 'Agent cible introuvable.'}, status=400)
    if cible.id == conv.agent_id:
        return Response({'detail': 'Conversation déjà assignée à cet agent.'}, status=400)

    conv.agent = cible
    if conv.statut == 'en_attente':
        conv.statut = 'en_cours'
    conv.save(update_fields=['agent', 'statut'])

    # Trace du transfert dans l'historique (visible par tous).
    contenu_sys = f"[Transfert] Conversation transférée à {cible.username}."
    if note:
        contenu_sys += f" Note : {note}"
    msg = Message.objects.create(conversation=conv, auteur=request.user, contenu=contenu_sys)
    conv.save(update_fields=['updated_at'])

    creer_notification(
        destinataire=cible,
        type_notif='message_chat',
        titre="Conversation transférée",
        message=f"{request.user.username} vous a transféré la conversation de "
                f"{conv.client.username}." + (f" Note : {note}" if note else ""),
        objet_id=conv.pk,
    )
    diffuser_chat(conv.pk, _payload_message(msg, request))
    diffuser_chat(conv.pk, {
        'type':           'statut_event',
        'statut':         conv.statut,
        'statut_display': conv.get_statut_display(),
        'agent':          cible.username,
    })

    return Response(_serialiser(conv, request))


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def gerer_categories(request, pk):
    """Définit l'ensemble des catégories (tags) d'une conversation."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    ids = request.data.get('categorie_ids', [])
    if not isinstance(ids, list):
        return Response({'detail': 'categorie_ids doit être une liste.'}, status=400)

    conv.categories.set(Categorie.objects.filter(pk__in=ids))
    return Response(_serialiser(conv, request))


# ── COMMUN (client + agent) ───────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fermer_conversation(request, pk):
    """Ferme une conversation — client (la sienne) ou agent."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if not _a_acces(request.user, conv):
        return Response({'detail': 'Accès refusé.'}, status=403)

    conv.statut = 'fermee'
    conv.save(update_fields=['statut'])
    diffuser_chat(conv.pk, {
        'type':           'statut_event',
        'statut':         conv.statut,
        'statut_display': conv.get_statut_display(),
    })
    return Response(_serialiser(conv, request))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historique_messages(request, pk):
    """Retourne tous les messages — et marque les reçus comme reçus + lus."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if not _a_acces(request.user, conv):
        return Response({'detail': 'Accès refusé.'}, status=403)

    # Accusés de réception + lecture pour les messages de l'autre partie.
    recus = conv.messages.exclude(auteur=request.user)
    ids_lus = list(recus.filter(est_lu=False).values_list('id', flat=True))
    recus.update(est_recu=True, est_lu=True)
    if ids_lus:
        diffuser_chat(conv.pk, {
            'type':        'receipt_event',
            'etat':        'lu',
            'message_ids': ids_lus,
            'par':         request.user.username,
        })

    messages = conv.messages.all()
    return Response(
        MessageSerializer(messages, many=True, context={'request': request}).data
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def envoyer_piece_jointe(request, pk):
    """Envoie un message avec pièce jointe (image / PDF) dans une conversation."""
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return Response({'detail': 'Conversation introuvable.'}, status=404)

    if not _a_acces(request.user, conv):
        return Response({'detail': 'Accès refusé.'}, status=403)

    fichier = request.FILES.get('piece_jointe')
    if not fichier:
        return Response({'detail': 'Aucun fichier fourni.'}, status=400)

    ext = os.path.splitext(fichier.name)[1].lower()
    if ext not in PIECE_JOINTE_EXT_AUTORISEES:
        return Response(
            {'detail': 'Type de fichier non autorisé (images ou PDF uniquement).'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if fichier.size > PIECE_JOINTE_TAILLE_MAX:
        return Response({'detail': 'Fichier trop volumineux (max 5 Mo).'}, status=400)

    contenu = (request.data.get('contenu') or '').strip()
    msg = Message.objects.create(
        conversation=conv, auteur=request.user, contenu=contenu, piece_jointe=fichier,
    )
    conv.save(update_fields=['updated_at'])

    data = MessageSerializer(msg, context={'request': request}).data
    diffuser_chat(conv.pk, _payload_message(msg, request))

    autre = conv.agent if request.user.id == conv.client_id else conv.client
    if autre:
        creer_notification(
            destinataire=autre,
            type_notif='message_chat',
            titre="Nouvelle pièce jointe",
            message=f"{request.user.username} a envoyé un fichier.",
            objet_id=conv.pk,
        )

    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def liste_categories(request):
    """Liste des catégories disponibles (pour les menus de tags)."""
    return Response(CategorieSerializer(Categorie.objects.all(), many=True).data)


@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def agents_pour_transfert(request):
    """Liste des agents/admins (hors soi-même) pour le menu de transfert."""
    from accounts.models import User
    qs = User.objects.filter(
        role__in=['agent', 'administrateur'],
    ).exclude(pk=request.user.pk).order_by('username')
    return Response([
        {
            'id':            a.id,
            'username':      a.username,
            'specialite':    a.get_specialite_display(),
            'est_disponible': a.est_disponible,
        }
        for a in qs
    ])
