from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('username', 'email', 'role', 'telephone', 'region', 'is_active')
    list_filter   = ('role', 'is_active')
    search_fields = ('username', 'email', 'telephone')

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Informations COFINANCE CI', {
            'fields': ('role', 'telephone', 'region')
        }),
    )