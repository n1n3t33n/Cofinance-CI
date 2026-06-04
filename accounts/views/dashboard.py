from django.shortcuts import render, redirect


def dashboard_client(request):
    """Dashboard client - acces protege cote JS."""
    return render(request, 'accounts/client/dashboard.html')


def dashboard_agent(request):
    """Dashboard agent - acces protege cote JS."""
    return render(request, 'accounts/agent/dashboard.html')


def dashboard_admin(request):
    """Dashboard admin - acces protege cote JS."""
    return render(request, 'accounts/admin/dashboard.html')