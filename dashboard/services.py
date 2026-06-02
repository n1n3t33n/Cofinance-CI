"""
Service d'agrégation du tableau de bord administrateur.
Toutes les requêtes sont optimisées pour éviter le chargement
inutile d'objets en mémoire.
"""

from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta


def get_indicateurs_credits():
    """Agrégats sur les demandes de crédit."""
    from credits.models import DemandeCrédit

    total = DemandeCrédit.objects.aggregate(
        total=Count('id'),
        soumises=Count('id', filter=Q(statut='soumise')),
        en_analyse=Count('id', filter=Q(statut='en_analyse')),
        approuvees=Count('id', filter=Q(statut='approuvee')),
        decaissees=Count('id', filter=Q(statut='decaissee')),
        rejetees=Count('id', filter=Q(statut='rejetee')),
        montant_total_approuve=Sum(
            'montant_approuve',
            filter=Q(statut__in=['approuvee', 'decaissee'])
        ),
    )
    return total


def get_indicateurs_remboursements(date_debut=None, date_fin=None):
    """Taux de recouvrement et montants remboursés sur une période."""
    from credits.models import Echeance
    from repayments.models import Paiement

    qs_echeances = Echeance.objects.all()
    qs_paiements = Paiement.objects.all()

    if date_debut:
        qs_echeances = qs_echeances.filter(date_echeance__gte=date_debut)
        qs_paiements = qs_paiements.filter(date_paiement__date__gte=date_debut)
    if date_fin:
        qs_echeances = qs_echeances.filter(date_echeance__lte=date_fin)
        qs_paiements = qs_paiements.filter(date_paiement__date__lte=date_fin)

    stats_echeances = qs_echeances.aggregate(
        total_echeances=Count('id'),
        payees=Count('id', filter=Q(est_payee=True)),
        montant_total_du=Sum('montant_du'),
    )

    stats_paiements = qs_paiements.aggregate(
        montant_total_recu=Sum('montant_paye'),
        nb_paiements=Count('id'),
    )

    total_echeances = stats_echeances['total_echeances'] or 1
    payees          = stats_echeances['payees'] or 0
    taux_recouvrement = round((payees / total_echeances) * 100, 2)

    return {
        **stats_echeances,
        **stats_paiements,
        'taux_recouvrement': taux_recouvrement,
    }


def get_indicateurs_assurance():
    """Statistiques sur les souscriptions d'assurance."""
    from insurance.models import Souscription

    return Souscription.objects.aggregate(
        total=Count('id'),
        actives=Count('id', filter=Q(statut='active')),
        expirees=Count('id', filter=Q(statut='expiree')),
        resiliees=Count('id', filter=Q(statut='resiliee')),
        revenus_primes=Sum(
            'produit__prime_mensuelle',
            filter=Q(statut='active')
        ),
    )


def get_indicateurs_support():
    """Statistiques sur les conversations de support."""
    from chat.models import Conversation, Message

    stats_conv = Conversation.objects.aggregate(
        total=Count('id'),
        ouvertes=Count('id', filter=Q(statut='ouverte')),
        en_attente=Count('id', filter=Q(statut='en_attente')),
        fermees=Count('id', filter=Q(statut='fermee')),
    )

    stats_msg = Message.objects.aggregate(
        total_messages=Count('id'),
        non_lus=Count('id', filter=Q(est_lu=False)),
    )

    return {**stats_conv, **stats_msg}


def get_indicateurs_clients():
    """Statistiques sur la base clients."""
    from accounts.models import User

    return User.objects.aggregate(
        total_clients=Count('id', filter=Q(role='client')),
        total_agents=Count('id', filter=Q(role='agent')),
        total_admins=Count('id', filter=Q(role='administrateur')),
    )


def get_activite_recente(jours=7):
    """
    Activité des N derniers jours :
    nouvelles demandes, paiements, souscriptions.
    """
    from credits.models import DemandeCrédit
    from repayments.models import Paiement
    from insurance.models import Souscription

    depuis = timezone.now() - timedelta(days=jours)

    return {
        'nouvelles_demandes': DemandeCrédit.objects.filter(
            created_at__gte=depuis
        ).count(),
        'paiements_enregistres': Paiement.objects.filter(
            date_paiement__gte=depuis
        ).count(),
        'nouvelles_souscriptions': Souscription.objects.filter(
            created_at__gte=depuis
        ).count(),
    }


def get_demandes_par_agent():
    """Nombre de dossiers traités par agent."""
    from credits.models import DemandeCrédit

    return (
        DemandeCrédit.objects
        .filter(agent_traitant__isnull=False)
        .values('agent_traitant__username')
        .annotate(nb_dossiers=Count('id'))
        .order_by('-nb_dossiers')
    )


def get_demandes_par_region():
    """Répartition des demandes par région du client."""
    from credits.models import DemandeCrédit

    return (
        DemandeCrédit.objects
        .values('client__region')
        .annotate(nb_demandes=Count('id'))
        .order_by('-nb_demandes')
    )