from django.urls import path
from dashboard.views import tableau_de_bord, performance_agents, repartition_regions

urlpatterns = [
    path('',          tableau_de_bord,    name='dashboard-principal'),
    path('agents/',   performance_agents, name='dashboard-agents'),
    path('regions/',  repartition_regions, name='dashboard-regions'),
]