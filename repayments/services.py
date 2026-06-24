"""
Services métier du module repayments.
- Calcul des pénalités de retard
- Détection des échéances à alerter (J-3 et J+1)
"""

from datetime import date
from decimal import Decimal


def calculer_penalite(echeance) -> Decimal:
    """
    Calcule le montant de la pénalité de retard.

    Formule : montant_dû × (taux_pénalité / 100) × (jours_retard / 30)
    Le taux par défaut est 2 % mensuel.
    """
    today = date.today()
    if today <= echeance.date_echeance:
        return Decimal('0.00')

    jours_retard = (today - echeance.date_echeance).days
    taux         = Decimal('2.00')  # 2 % mensuel par défaut
    montant      = echeance.montant_du * (taux / 100) * (Decimal(jours_retard) / 30)
    return montant.quantize(Decimal('0.01'))


def _fmt(valeur) -> str:
    return f"{int(valeur):,}".replace(',', ' ')


def valider_paiement(paiement, valideur):
    """
    Valide un paiement (déclaré par le client ou enregistré par l'agent) :
      - passe le paiement à « validé » ;
      - marque l'échéance « payée » si le montant couvre le dû ;
      - notifie le client ;
      - solde le crédit et notifie client + agent si tout est réglé.
    """
    from notifications.services import creer_notification

    paiement.statut     = 'valide'
    paiement.valide_par = valideur
    if paiement.agent_id is None:
        paiement.agent = valideur
    paiement.save(update_fields=['statut', 'valide_par', 'agent'])

    echeance = paiement.echeance
    creer_notification(
        destinataire=echeance.demande.client,
        type_notif='paiement_recu',
        titre="Paiement validé",
        message=(
            f"Votre paiement de {_fmt(paiement.montant_paye)} FCFA pour l'échéance "
            f"n°{echeance.numero} a été validé."
        ),
        objet_id=paiement.pk,
    )

    if paiement.montant_paye >= echeance.montant_du and not echeance.est_payee:
        echeance.est_payee = True
        echeance.save(update_fields=['est_payee'])

        demande = echeance.demande
        if not demande.est_soldee and not demande.echeances.filter(est_payee=False).exists():
            demande.est_soldee = True
            demande.save(update_fields=['est_soldee'])
            creer_notification(
                destinataire=demande.client,
                type_notif='paiement_recu',
                titre="Crédit entièrement remboursé",
                message=f"Félicitations ! Votre crédit #{demande.pk} est intégralement remboursé.",
                objet_id=demande.pk,
            )
            if demande.agent_traitant:
                creer_notification(
                    destinataire=demande.agent_traitant,
                    type_notif='paiement_recu',
                    titre="Crédit soldé",
                    message=f"Le crédit #{demande.pk} de {demande.client.username} est soldé.",
                    objet_id=demande.pk,
                )
    return paiement


def generer_reference_paiement(echeance) -> str:
    """
    Référence de transaction suggérée, renseignée par défaut dans le
    formulaire de paiement préparé par l'agent.
    Format : PAY-<demande>-<numero>-<AAAAMMJJ>.
    """
    return f"PAY-{echeance.demande_id}-{echeance.numero}-{date.today().strftime('%Y%m%d')}"


def get_echeances_a_alerter():
    """
    Retourne trois querysets d'échéances impayées :
    - j_moins_7 : date dans exactement 7 jours (1er rappel)
    - j_moins_3 : date dans exactement 3 jours (2e rappel)
    - j_plus_1  : date d'hier (passage en retard)
    """
    from credits.models import Echeance
    from datetime import timedelta

    today        = date.today()
    dans_7_jours = today + timedelta(days=7)
    dans_3_jours = today + timedelta(days=3)
    hier         = today - timedelta(days=1)

    base = Echeance.objects.filter(est_payee=False).select_related(
        'demande__client', 'demande__agent_traitant',
    )

    j_moins_7 = base.filter(date_echeance=dans_7_jours)
    j_moins_3 = base.filter(date_echeance=dans_3_jours)
    j_plus_1  = base.filter(date_echeance=hier)

    return j_moins_7, j_moins_3, j_plus_1