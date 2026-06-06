from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.models.otp import OtpToken



@api_view(['POST'])
@permission_classes([AllowAny])
def request_otp(request):
    """Valide les credentials, envoie un OTP par email."""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response(
            {'detail': 'Identifiants incorrects.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.email:
        return Response(
            {'needs_email': True, 'username': username},
            status=status.HTTP_200_OK,
        )

    try:
        otp = OtpToken.generate_for(user)
    except Exception as e:
        return Response(
            {'detail': f'Erreur base de donnees : migration manquante ? (detail: {e})'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        send_mail(
            subject='Votre code de connexion COFINANCE CI',
            message=(
                f'Bonjour {user.username},\n\n'
                f'Votre code de verification est : {otp.code}\n\n'
                f'Il expire dans 10 minutes.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception:
        return Response(
            {'detail': 'OTP genere mais email non envoye. Verifiez EMAIL_BACKEND dans .env'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = {'otp_sent': True}
    if settings.DEBUG:
        data['_dev_code'] = otp.code
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def save_email_request_otp(request):
    """Sauvegarde l'email (utilisateurs sans email) puis envoie un OTP."""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    email    = request.data.get('email', '').strip().lower()

    if not email:
        return Response(
            {'detail': 'Adresse email requise.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response(
            {'detail': 'Session expirée. Veuillez recommencer.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if User.objects.filter(email=email).exclude(pk=user.pk).exists():
        return Response(
            {'detail': 'Cette adresse email est déjà utilisée par un autre compte.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.email = email
    user.save(update_fields=['email'])

    try:
        otp = OtpToken.generate_for(user)
    except Exception as e:
        return Response(
            {'detail': f'Erreur base de donnees : migration manquante ? (detail: {e})'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        send_mail(
            subject='Votre code de connexion COFINANCE CI',
            message=(
                f'Bonjour {user.username},\n\n'
                f'Votre code de verification est : {otp.code}\n\n'
                f'Il expire dans 10 minutes.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception:
        return Response(
            {'detail': 'OTP genere mais email non envoye. Verifiez EMAIL_BACKEND dans .env'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = {'otp_sent': True}
    if settings.DEBUG:
        data['_dev_code'] = otp.code
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """Vérifie le code OTP et retourne les JWT tokens."""
    username = request.data.get('username', '').strip()
    code     = request.data.get('code', '').strip()

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'detail': 'Utilisateur introuvable.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        otp = OtpToken.objects.filter(user=user, code=code, used=False).latest('created_at')
    except OtpToken.DoesNotExist:
        return Response(
            {'detail': 'Code incorrect ou déjà utilisé.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not otp.is_valid():
        return Response(
            {'detail': 'Code expiré. Cliquez sur "Renvoyer le code".'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    otp.used = True
    otp.save(update_fields=['used'])

    refresh = RefreshToken.for_user(user)
    return Response({
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
    }, status=status.HTTP_200_OK)
