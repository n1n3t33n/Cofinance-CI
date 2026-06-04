from django.shortcuts import render
from credits.permissions import EstClient, EstAgentOuAdmin
from rest_framework.decorators import api_view, permission_classes


def dashboard_client(request):
    return render(request, 'accounts/dashboard_client.html')


def dashboard_agent(request):
    return render(request, 'accounts/dashboard_agent.html')


def dashboard_admin(request):
    return render(request, 'accounts/dashboard_admin.html')