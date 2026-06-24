from django.contrib import admin
from chat.models import Conversation, Message, Categorie, EvaluationConversation


class MessageInline(admin.TabularInline):
    model         = Message
    extra         = 0
    readonly_fields = ('auteur', 'contenu', 'piece_jointe', 'est_recu', 'est_lu', 'created_at')


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display    = ('id', 'client', 'agent', 'statut', 'sujet', 'created_at', 'updated_at')
    list_filter     = ('statut', 'categories')
    search_fields   = ('client__username', 'agent__username', 'sujet')
    filter_horizontal = ('categories',)
    raw_id_fields   = ('demande_credit',)
    inlines         = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display  = ('id', 'conversation', 'auteur', 'est_recu', 'est_lu', 'created_at')
    list_filter   = ('est_recu', 'est_lu')
    search_fields = ('auteur__username', 'contenu')


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display  = ('id', 'nom', 'couleur')
    search_fields = ('nom',)


@admin.register(EvaluationConversation)
class EvaluationConversationAdmin(admin.ModelAdmin):
    list_display  = ('id', 'conversation', 'note', 'created_at')
    list_filter   = ('note',)
