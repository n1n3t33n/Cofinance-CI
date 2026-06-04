from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema


from accounts.models import User
from accounts.serializers import RegisterSerializer, UserSerializer, ProfileUpdateSerializer


@extend_schema(request=RegisterSerializer, responses=UserSerializer)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Création d'un nouveau compte utilisateur."""
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user':    UserSerializer(user).data,
            'refresh': str(refresh),
            'access':  str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(request=ProfileUpdateSerializer, responses=UserSerializer)
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Consultation (GET) et mise à jour (PATCH) du profil connecté."""
    if request.method == 'GET':
        return Response(UserSerializer(request.user).data)

    serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(UserSerializer(request.user).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(responses=UserSerializer)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_disponibilite(request):
    """Un agent bascule sa disponibilité on/off."""
    if not (request.user.is_agent or request.user.is_admin_cofinance):
        return Response(
            {'detail': 'Réservé aux agents.'},
            status=status.HTTP_403_FORBIDDEN
        )
    request.user.est_disponible = not request.user.est_disponible
    request.user.save(update_fields=['est_disponible'])
    return Response({
        'est_disponible': request.user.est_disponible,
        'message': (
            "Vous êtes maintenant disponible."
            if request.user.est_disponible
            else "Vous êtes maintenant indisponible."
        )
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agents_disponibles(request):
    """Liste des agents actuellement disponibles."""
    from accounts.models import User
    agents = User.objects.filter(
        role__in=['agent', 'administrateur'],
        est_disponible=True
    )
    return Response(UserSerializer(agents, many=True).data)