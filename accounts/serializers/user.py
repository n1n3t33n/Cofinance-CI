from rest_framework import serializers
from accounts.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ('id', 'username', 'email', 'role', 'telephone',
                  'region', 'est_disponible', 'date_joined')
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer pour la création de compte."""
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ('username', 'email', 'password', 'role', 'telephone', 'region')

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)   # hashage du mot de passe
        user.save()
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour la mise à jour du profil."""
    class Meta:
        model  = User
        fields = ('email', 'telephone', 'region')