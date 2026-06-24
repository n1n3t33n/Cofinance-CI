from django.urls import path
from chat.views import (
    ouvrir_conversation,
    ma_conversation,
    toutes_conversations,
    rejoindre_conversation,
    fermer_conversation,
    historique_messages,
    changer_statut_conversation,
    transferer_conversation,
    gerer_categories,
    evaluer_conversation,
    envoyer_piece_jointe,
    liste_categories,
    agents_pour_transfert,
    demo_chat,
)

urlpatterns = [
    # Client
    path('ouvrir/',              ouvrir_conversation,    name='chat-ouvrir'),
    path('ma-conversation/',     ma_conversation,        name='chat-ma-conversation'),
    path('<int:pk>/evaluer/',    evaluer_conversation,   name='chat-evaluer'),

    # Agent / Admin
    path('toutes/',              toutes_conversations,   name='chat-toutes'),
    path('<int:pk>/rejoindre/',  rejoindre_conversation, name='chat-rejoindre'),
    path('<int:pk>/statut/',     changer_statut_conversation, name='chat-statut'),
    path('<int:pk>/transferer/', transferer_conversation, name='chat-transferer'),
    path('<int:pk>/categories/', gerer_categories,       name='chat-categories'),
    path('agents-transfert/',    agents_pour_transfert,  name='chat-agents-transfert'),

    # Commun
    path('categories/',          liste_categories,       name='chat-liste-categories'),
    path('<int:pk>/fermer/',     fermer_conversation,    name='chat-fermer'),
    path('<int:pk>/messages/',   historique_messages,    name='chat-messages'),
    path('<int:pk>/piece-jointe/', envoyer_piece_jointe, name='chat-piece-jointe'),

    # Démo
    path('demo/',                demo_chat,              name='chat-demo'),
]
