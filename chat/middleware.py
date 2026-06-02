"""
Middleware JWT pour les connexions WebSocket.
Lit le token depuis : ws://.../?token=<access_token>
"""

from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_token(token_str):
    """Décode le token JWT et retourne l'utilisateur correspondant."""
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from accounts.models import User

        token   = AccessToken(token_str)
        user_id = token['user_id']
        return User.objects.get(pk=user_id)
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Récupérer le token depuis les query params
        query_string = scope.get('query_string', b'').decode()
        params       = parse_qs(query_string)
        token_list   = params.get('token', [])

        if token_list:
            scope['user'] = await get_user_from_token(token_list[0])
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)