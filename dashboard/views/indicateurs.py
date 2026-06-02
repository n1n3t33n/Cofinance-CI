from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from credits.permissions import EstAgentOuAdmin
from dashboard.services import (
    get_indicateurs_credits,
    get_indicateurs_remboursements,
    get_indicateurs_assurance,
    get_indicateurs_support,
    get_indicateurs_clients,
    get_activite_recente,
    get_demandes_par_agent,
    get_demandes_par_region,
)


@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def tableau_de_bord(request):
    """
    Endpoint principal du dashboard.
    Retourne tous les indicateurs agrégés en une seule requête.

    Filtres optionnels (query params) :
    - date_debut : YYYY-MM-DD
    - date_fin   : YYYY-MM-DD
    - jours      : int (activité récente, défaut 7)
    """
    date_debut = request.query_params.get('date_debut')
    date_fin   = request.query_params.get('date_fin')
    jours      = int(request.query_params.get('jours', 7))

    data = {
        'credits':            get_indicateurs_credits(),
        'remboursements':     get_indicateurs_remboursements(date_debut, date_fin),
        'assurance':          get_indicateurs_assurance(),
        'support':            get_indicateurs_support(),
        'clients':            get_indicateurs_clients(),
        'activite_recente':   get_activite_recente(jours),
    }
    return Response(data)


@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def performance_agents(request):
    """Dossiers traités par agent — pour le filtre par agent du CDC."""
    return Response(list(get_demandes_par_agent()))


@api_view(['GET'])
@permission_classes([EstAgentOuAdmin])
def repartition_regions(request):
    """Répartition des demandes par région — pour le filtre par région du CDC."""
    return Response(list(get_demandes_par_region()))