from rest_framework.permissions import BasePermission


class EstClient(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_client


class EstAgentOuAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_agent or request.user.is_admin_cofinance
        )