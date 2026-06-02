from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from insurance.models import ProduitAssurance
from insurance.serializers import ProduitAssuranceSerializer
from credits.permissions import EstAgentOuAdmin


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def liste_produits(request):
    """Catalogue des produits actifs — accessible à tous les utilisateurs."""
    produits = ProduitAssurance.objects.filter(est_actif=True)
    return Response(ProduitAssuranceSerializer(produits, many=True).data)


@api_view(['POST'])
@permission_classes([EstAgentOuAdmin])
def creer_produit(request):
    """Création d'un nouveau produit — réservé aux admins/agents."""
    serializer = ProduitAssuranceSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([EstAgentOuAdmin])
def modifier_produit(request, pk):
    """Modification ou désactivation d'un produit."""
    try:
        produit = ProduitAssurance.objects.get(pk=pk)
    except ProduitAssurance.DoesNotExist:
        return Response({'detail': 'Produit introuvable.'}, status=404)

    if request.method == 'DELETE':
        # On désactive plutôt que supprimer (soft delete)
        produit.est_actif = False
        produit.save(update_fields=['est_actif'])
        return Response({'detail': 'Produit désactivé.'})

    serializer = ProduitAssuranceSerializer(produit, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)