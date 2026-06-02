from django.contrib import admin
from chat.models import Conversation, Message


class MessageInline(admin.TabularInline):
    model         = Message
    extra         = 0
    readonly_fields = ('auteur', 'contenu', 'est_lu', 'created_at')


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display  = ('id', 'client', 'agent', 'statut', 'created_at', 'updated_at')
    list_filter   = ('statut',)
    search_fields = ('client__username', 'agent__username')
    inlines       = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display  = ('id', 'conversation', 'auteur', 'est_lu', 'created_at')
    list_filter   = ('est_lu',)
    search_fields = ('auteur__username', 'contenu')