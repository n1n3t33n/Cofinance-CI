from django.urls import path
from chat.views import (
    ouvrir_conversation,
    ma_conversation,
    toutes_conversations,
    rejoindre_conversation,
    fermer_conversation,
    historique_messages,
)

urlpatterns = [
    # Client
    path('ouvrir/',                    ouvrir_conversation,   name='chat-ouvrir'),
    path('ma-conversation/',           ma_conversation,       name='chat-ma-conversation'),

    # Agent / Admin
    path('toutes/',                    toutes_conversations,  name='chat-toutes'),
    path('<int:pk>/rejoindre/',        rejoindre_conversation, name='chat-rejoindre'),

    # Commun
    path('<int:pk>/fermer/',           fermer_conversation,   name='chat-fermer'),
    path('<int:pk>/messages/',         historique_messages,   name='chat-messages'),
]