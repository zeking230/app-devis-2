# Devis & Factures — app locale

Web app de création de devis et factures. **100% locale** : toutes les
données restent dans le navigateur (IndexedDB). Aucun serveur, aucune base
de données externe, un seul utilisateur.

## Fonctionnalités

- Profil entreprise complet : nom, logo, adresse, téléphone, email, **SIRET,
  SIREN, TVA, code NAF/APE**, représentant légal, couleur du document + **RIB
  modifiable à tout moment**
- Clients réutilisables (nom, prénom, 3 adresses, email, mobile avec indicatif, fixe)
- Catalogue d'articles réutilisables (unité, remise, taxe, détails…)
- Devis/factures avec **numéro entièrement modifiable** (pré-rempli
  automatiquement `EST0001`/`INV0001`, mais éditable à la main)
- Conversion devis → facture
- Bloc optionnel « Détails & logistique » (produit, année, état, km, transport,
  destination, délai)
- **Conditions** du devis/facture : éditables, une ligne par point
- **Garanties pièces d'occasion** : texte fixe, identique sur tous les
  documents, non modifiable depuis l'interface (voir MAINTENANCE.md)
- Paiements partiels (virement), solde dû, statut payée / partielle / non payée
- Multi-devise (taux saisi manuellement)
- Signature dessinée, ajout de photos
- Export PDF fidèle au modèle fourni par le client (en-tête teinté avec
  logo + identité légale, colonnes Client/Logistique, tableau coloré,
  totaux HT/TTC, bloc paiement, signature, mentions légales en pied de page)
- **Mode Aide** (bouton « ？ Aide » en haut de chaque page) : affiche des
  bulles d'explication avec flèche à côté des champs, pour guider pas à pas
  un utilisateur qui découvre l'app
- Sauvegarde : export / import JSON

## Installation

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
npm run dev      # développement -> http://localhost:5173
npm run build    # version de production dans /dist
npm run preview  # tester la version de production
```

## Première utilisation

1. Onglet **Entreprise** : nom, logo, adresse, téléphone, email, SIRET,
   SIREN, TVA, NAF, représentant légal, RIB -> Enregistrer.
2. Onglet **Clients** : ajoutez un client.
3. Onglet **Nouveau document** : créez un devis, ajoutez des articles,
   complétez éventuellement « Détails & logistique » et « Conditions »,
   « Aperçu PDF ».
4. « Télécharger PDF », puis « Envoyer par email » (ouvre votre messagerie : joignez le PDF).

Cliquez sur « ？ Aide » en haut de n'importe quelle page pour afficher des
explications contextuelles (une bulle avec flèche apparaît à côté des
champs concernés).

Un **guide utilisateur complet au format PDF** (destiné à la personne qui
utilisera l'app, pas au développeur) est fourni séparément :
`guide-utilisateur.pdf`.

## Limites connues (V1)

- Les données sont liées à **ce navigateur sur cet appareil**. Exportez
  régulièrement une sauvegarde JSON (onglet Entreprise).
- L'envoi d'email utilise `mailto:` : il n'attache pas le PDF automatiquement.
  L'envoi automatique avec pièce jointe nécessite un petit relai serverless :
  voir `MAINTENANCE.md`, section « Passer à l'envoi automatique ».
- Pas de suivi automatique : les statuts se changent à la main.
- La signature du client se fait hors app (il signe le PDF reçu et le renvoie).

## Documentation technique

Voir **MAINTENANCE.md** pour comprendre l'architecture et modifier le code.
