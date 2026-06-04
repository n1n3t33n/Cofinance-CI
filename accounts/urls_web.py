from django.urls import path
from accounts.views.dashboard import dashboard_client, dashboard_agent, dashboard_admin

urlpatterns = [
    path('dashboard/client/', dashboard_client, name='dashboard-client'),
    path('dashboard/agent/',  dashboard_agent,  name='dashboard-agent'),
    path('dashboard/admin/',  dashboard_admin,  name='dashboard-admin'),
]