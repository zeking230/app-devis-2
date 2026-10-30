// Textes fixes de l'application.
//
// Le texte de garantie ci-dessous est volontairement codé en dur et
// n'est exposé dans AUCUN formulaire : c'est la seule façon de garantir
// qu'il reste non modifiable par l'utilisateur, conformément à la
// demande métier. Pour le changer, un développeur doit éditer ce
// fichier directement (voir MAINTENANCE.md).
export const WARRANTY_TITLE = "Pièces d'occasion & garanties";
export const WARRANTY_TEXT = [
  "Les pièces d'occasion sont contrôlées avant leur mise en vente.",
  "La référence et le kilométrage sont précisés lorsqu'ils sont disponibles.",
  "La garantie commerciale s'applique sous réserve des conditions applicables.",
];

// Conditions par défaut proposées à la création d'un document — ces
// textes restent entièrement modifiables document par document.
export const DEFAULT_CONDITIONS = {
  devis:
    "- Validité : 3 jours à compter de la date d'émission.\n" +
    "- Paiement : 100% par virement bancaire avant expédition.\n" +
    "- La pièce est réservée après réception du paiement.",
  facture:
    "- Paiement : 100% par virement bancaire avant expédition ou livraison.",
};
