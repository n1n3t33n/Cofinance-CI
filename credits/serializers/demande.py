from rest_framework import serializers
from credits.models import DemandeCrédit, Echeance


class EcheanceSerializer(serializers.ModelSerializer):
    a_paiement_en_attente = serializers.SerializerMethodField()

    class Meta:
        model  = Echeance
        fields = ('id', 'numero', 'date_echeance', 'montant_du',
                  'montant_capital', 'montant_interet', 'est_payee',
                  'a_paiement_en_attente')

    def get_a_paiement_en_attente(self, obj):
        """Un paiement déclaré par le client attend la validation d'un agent."""
        return obj.paiements.filter(statut='en_attente').exists()


class DemandeCréditSerializer(serializers.ModelSerializer):
    """Lecture — liste et détail."""
    echeances        = EcheanceSerializer(many=True, read_only=True)
    client_username  = serializers.CharField(source='client.username', read_only=True)
    statut_display   = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model  = DemandeCrédit
        fields = (
            'id', 'client', 'client_username', 'agent_traitant',
            'montant_demande', 'duree_mois', 'motif', 'piece_justif',
            'statut', 'statut_display', 'score_eligibilite',
            'montant_approuve', 'taux_interet', 'commentaire_agent',
            'reference_paiement', 'est_soldee', 'echeances',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'client', 'statut', 'score_eligibilite', 'est_soldee',
            'montant_approuve', 'agent_traitant', 'reference_paiement',
            'created_at', 'updated_at',
        )


class SoumettreDemandSerializer(serializers.ModelSerializer):
    """Écriture — utilisé par le client pour soumettre une demande."""
    class Meta:
        model  = DemandeCrédit
        fields = ('montant_demande', 'duree_mois', 'motif', 'piece_justif')


class TraiterDemandSerializer(serializers.ModelSerializer):
    """Écriture — utilisé par l'agent pour faire avancer le workflow."""

    # Machine à états : pour chaque statut, la liste des statuts atteignables.
    # On avance étape par étape (pas de saut), et on ne peut plus rien faire
    # une fois le crédit décaissé ou rejeté (états terminaux).
    TRANSITIONS = {
        'soumise':    ['en_analyse', 'rejetee'],
        'en_analyse': ['approuvee', 'rejetee'],
        'approuvee':  ['decaissee', 'rejetee'],
        'decaissee':  [],
        'rejetee':    [],
    }

    class Meta:
        model  = DemandeCrédit
        fields = ('statut', 'montant_approuve', 'taux_interet', 'commentaire_agent')

    def validate_statut(self, value):
        """N'autorise que les transitions prévues par la machine à états."""
        actuel = self.instance.statut

        # Renvoyer le même statut (mise à jour d'autres champs sans changement
        # d'étape) reste permis.
        if value == actuel:
            return value

        autorises = self.TRANSITIONS.get(actuel, [])
        if value not in autorises:
            raise serializers.ValidationError(
                f"Transition non autorisée : « {self.instance.get_statut_display()} » "
                f"→ « {dict(self.fields['statut'].choices).get(value, value)} ». "
                "Le workflow doit être suivi étape par étape."
            )
        return value

    def validate(self, attrs):
        """montant_approuve obligatoire si statut = approuvee."""
        statut = attrs.get('statut')
        if statut == 'approuvee':
            montant = attrs.get('montant_approuve') or getattr(self.instance, 'montant_approuve', None)
            if not montant:
                raise serializers.ValidationError(
                    {"montant_approuve": "Ce champ est obligatoire pour approuver un crédit."}
                )
            # Un taux est nécessaire pour générer l'échéancier.
            taux = attrs.get('taux_interet') or getattr(self.instance, 'taux_interet', None)
            if not taux:
                raise serializers.ValidationError(
                    {"taux_interet": "Le taux d'intérêt est obligatoire pour approuver un crédit."}
                )
        return attrs