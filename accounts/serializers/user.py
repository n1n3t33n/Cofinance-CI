from rest_framework import serializers
from accounts.models import User


class UserSerializer(serializers.ModelSerializer):
    specialite_display = serializers.CharField(source='get_specialite_display', read_only=True)

    class Meta:
        model  = User
        fields = ('id', 'username', 'email', 'role', 'telephone',
                  'region', 'specialite', 'specialite_display',
                  'est_disponible', 'date_joined')
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer pour la création de compte public.

    SÉCURITÉ : le champ `role` n'est volontairement PAS exposé ici.
    Toute inscription publique crée un compte « client ». Les comptes
    agent/administrateur se créent uniquement via l'admin Django ou un
    endpoint réservé à l'administrateur — sinon n'importe qui pourrait
    s'auto-attribuer un rôle privilégié (escalade de privilèges).
    """
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ('username', 'email', 'password', 'telephone', 'region')

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.role = User.Role.CLIENT   # rôle forcé côté serveur
        user.set_password(password)    # hashage du mot de passe
        user.save()
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour la mise à jour du profil (champs agent inclus)."""
    class Meta:
        model  = User
        fields = ('email', 'telephone', 'region', 'specialite', 'est_disponible')