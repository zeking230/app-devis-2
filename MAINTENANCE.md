# MAINTENANCE.md — Comprendre et modifier le code

Document destiné à toute personne (ou IA) qui reprend le projet.

## 1. Vue d'ensemble

- **Stack** : React 18 + Vite, JavaScript (pas de TypeScript), CSS simple.
- **Stockage** : IndexedDB via la lib `idb`. Aucun backend.
- **PDF** : `html2canvas` (capture du DOM) + `jsPDF`, dans le navigateur.
- **Email** : `mailto:` en V1 (voir §8).
- **Navigation** : pas de react-router, un simple état `view` dans le contexte.

## 2. Arborescence

```
index.html                 point d'entrée HTML
vite.config.js             config Vite
package.json               dépendances et scripts
src/
  main.jsx                 monte React + <AppProvider>
  App.jsx                  choisit la page à afficher selon `view`
  App.css                  TOUS les styles (variables de thème en haut)
  db.js                    accès IndexedDB (CRUD, compteurs, export/import)
  context/AppContext.jsx   état global + actions (useApp)
  components/
    Sidebar.jsx            menu de navigation
    StatusBadge.jsx        pastille de statut (libellés + couleurs)
    Toggle.jsx             interrupteur on/off
    SignaturePad.jsx       canvas de signature -> image PNG
    HelpBubble.jsx         bulle d'aide avec flèche (affichée si helpMode = true)
  pages/
    Dashboard.jsx          stats + liste des documents + rappel du parcours (mode Aide)
    Clients.jsx            liste + formulaire client
    Articles.jsx           catalogue + formulaire article
    DocumentEditor.jsx     création/édition devis ou facture (numéro éditable,
                           logistique, conditions, bloc garanties en lecture seule)
    DocumentPreview.jsx    aperçu = ce qui est exporté en PDF + email
                           (mise en page calquée sur le modèle du client)
    Settings.jsx           profil entreprise (incl. SIRET/SIREN/TVA/NAF,
                           représentant légal, couleur du document), RIB, export/import
  utils/
    calculations.js        TOUS les calculs de montants + formatMoney
    constants.js            textes FIXES non éditables (garanties) + conditions par défaut
    color.js                éclaircit la couleur d'accent pour le fond du PDF
    pdfExport.js            export PDF
    email.js                envoi email (point d'extension)
```

## 3. Flux de données

```
Page (React)  ->  useApp() action  ->  db.js (IndexedDB)
      ^                 |
      +---- state React mis à jour en même temps -----+
```

- Les pages **n'appellent jamais `db.js` directement** (sauf export/import
  dans `Settings.jsx`). Elles utilisent les actions de `AppContext.jsx`.
- Chaque action écrit d'abord dans IndexedDB, puis met à jour le state React.
  => tout ce qui est saisi (client, article, document, RIB) est persisté.
- Au démarrage, `reloadAll()` charge tout en mémoire.

## 4. Modèle de données (stores IndexedDB)

| Store       | Clé      | Contenu |
|-------------|----------|---------|
| `settings`  | `id='company'` | name, logo, address, phone, email, siret, siren, tva, naf, legalMention, repName, repTitle, brandColor, ribBeneficiary, ribIban, ribBic, paymentTerms, accountNote |
| `clients`   | `id` (UUID) | firstName, lastName, email, mobilePhone, landline, addresses[3] |
| `articles`  | `id` (UUID) | description, unitCost, unit, quantity, discountType (`none`/`percent`/`fixed`), discountValue, taxable, notes |
| `documents` | `id` (UUID) | voir ci-dessous |
| `counters`  | `name` (`estimate` / `invoice`) | value (dernier numéro proposé — le numéro réel du document peut être modifié ensuite, voir §5.2) |

Document :

```
{ id, type: 'devis'|'facture', number: 'EST0001'|'INV0001' (modifiable), date, dueDate,
  clientId, currency: 'EUR'|'USD'|'OTHER', exchangeRate,
  lines: [{ id, articleId?, description, note? (sous-ligne facultative),
            quantity, unitCost, discountType, discountValue, taxable }],
  discount (montant global), taxRate (%),
  status,
  logistics: { produit, annee, etat, km, transport, destination, delai } (tous facultatifs),
  conditionsText (éditable, une ligne par point),
  photos[] (data URL),
  signature (data URL PNG | null), signedAt,
  payments: [{ id, amount, date }],
  convertedFromDevisId?, createdAt, updatedAt }
```

Le texte des **garanties pièces d'occasion** n'est PAS stocké dans le
document : il est lu en dur depuis `utils/constants.js` (`WARRANTY_TITLE`,
`WARRANTY_TEXT`) à l'affichage, pour qu'il reste identique sur tous les
documents, passés et futurs, et non modifiable depuis l'interface.

Statuts devis : `draft, sent, signed, refused, expired`.
Statuts facture : `unpaid, partial, paid`.
Les libellés/couleurs sont dans `components/StatusBadge.jsx` et les listes
déroulantes dans `pages/DocumentEditor.jsx`.

## 5. Règles importantes (à ne pas casser)

1. **Calculs** : uniquement dans `utils/calculations.js`. La taxe ne
   s'applique qu'aux lignes `taxable !== false`; la remise globale est
   répartie au prorata. Le solde = total − somme des paiements.
2. **Numérotation** : `db.nextNumber()` incrémente dans une transaction et
   propose un numéro par défaut jamais réutilisé. **Le champ `number` du
   document reste volontairement modifiable** dans `DocumentEditor.jsx`
   (demande explicite) : le compteur ne garantit donc l'unicité qu'à la
   création, pas après une modification manuelle. Si une contrainte stricte
   de numérotation séquentielle devient nécessaire, ajouter une vérification
   d'unicité avant `saveDocument`.
3. **RIB jamais figé** : l'aperçu/PDF lit toujours `settings` au moment de
   l'affichage. Ne pas copier le RIB dans le document.
4. **Garanties jamais figées côté utilisateur** : `WARRANTY_TITLE` /
   `WARRANTY_TEXT` dans `utils/constants.js` sont lus en dur par
   `DocumentPreview.jsx` (et affichés en lecture seule dans
   `DocumentEditor.jsx`). Aucun champ de formulaire ne doit les rendre
   modifiables — c'est une exigence explicite du projet.
5. **Création de document** : déclenchée par un clic (DocumentEditor), pas
   par un `useEffect`, sinon React StrictMode crée des doublons/numéros
   sautés.
6. **Aperçu = PDF** : le PDF est la capture du `<div className="docprev">`.
   Modifier l'apparence du PDF = modifier `DocumentPreview.jsx` + les
   règles `.docprev` dans `App.css`. La couleur d'accent vient de
   `settings.brandColor`, injectée en variable CSS inline (`--accent`,
   `--accent-bg` via `utils/color.js`).

## 6. Recettes de modification

- **Changer les couleurs / la police** : variables `:root` en haut de `App.css`.
- **Changer les préfixes de numéros (EST/INV)** : `createNewDocument` et
  `convertToInvoice` dans `AppContext.jsx`. Format du compteur (4 chiffres) :
  `nextNumber` dans `db.js`.
- **Ajouter un champ client** : `EMPTY` + formulaire dans `pages/Clients.jsx`
  (aucune migration IndexedDB nécessaire, les stores stockent des objets libres).
- **Ajouter un champ document** : valeur par défaut dans `createNewDocument`,
  champ dans `DocumentEditor.jsx`, affichage dans `DocumentPreview.jsx`.
- **Ajouter une devise** : `<select>` dans `DocumentEditor.jsx` et table
  `SYMBOLS` dans `calculations.js`.
- **Ajouter une page** : créer `pages/X.jsx`, l'ajouter dans `App.jsx`
  (bloc `view === 'x'`) et dans `NAV_ITEMS` de `Sidebar.jsx`.
- **Ajouter un store IndexedDB** : incrémenter `DB_VERSION` et ajouter la
  création dans `upgrade()` de `db.js`, ainsi que dans export/import.
- **Autre template de PDF** : dupliquer la mise en page de
  `DocumentPreview.jsx`, ajouter un champ `template` au document.
- **Changer le texte des garanties (fixe)** : éditer `WARRANTY_TITLE` /
  `WARRANTY_TEXT` dans `utils/constants.js`. C'est le seul endroit à
  modifier ; aucune UI n'est prévue exprès.
- **Ajouter/retirer un champ du bloc « Détails & logistique »** :
  `LOGISTICS_FIELDS` est dupliqué dans `DocumentEditor.jsx` et
  `DocumentPreview.jsx` (tableau `[clé, libellé]`) — modifier les deux, et
  `logistics: {...}` par défaut dans `createNewDocument` (`AppContext.jsx`).
- **Ajouter une bulle d'aide sur un nouveau champ** : importer
  `HelpBubble` et l'ajouter dans un conteneur `className="card pad relative"`
  (la classe `relative` est nécessaire pour le positionnement de la bulle).

## 7. Sauvegarde / perte de données

IndexedDB est lié au navigateur + appareil + domaine (`localhost:5173` en dev
et l'URL de production sont deux bases DIFFÉRENTES). Vider les données du
site les supprime. Le seul filet de sécurité est l'export JSON
(Entreprise > Sauvegarde). L'import fusionne/écrase par `id`.

## 8. Envoi d'email — état actuel et évolution

**V1 (actuel)** : `pages/DocumentPreview.jsx` ouvre `mailto:` via
`utils/email.js`. Limite : impossible d'attacher le PDF automatiquement.

**Passer à l'envoi automatique (V2)** : un navigateur ne peut pas envoyer un
email authentifié seul (clé API exposée, CORS). Il faut :

1. Un service transactionnel (Resend, Postmark, SendGrid, Amazon SES).
2. Une fonction serverless (Vercel/Netlify/Cloudflare) qui reçoit
   `{ to, subject, body, pdfBase64 }` et appelle l'API du service avec la
   clé secrète stockée côté serveur.
3. Côté front : générer le PDF en base64 (adapter `pdfExport.js` pour
   retourner `pdf.output('datauristring')`), puis faire un `fetch` vers la
   fonction depuis `utils/email.js`. Seul ce fichier + le bouton dans
   `DocumentPreview.jsx` changent.

**Délivrabilité (éviter le spam)** : configurer SPF, DKIM, DMARC sur le
domaine d'envoi ; utiliser un service transactionnel réputé ; domaine
d'envoi cohérent avec le nom de l'entreprise ; objet clair, peu de liens.

## 9. Limites connues / pistes d'amélioration

- PDF = image du DOM (texte non sélectionnable, poids plus élevé). Pour du
  PDF texte natif, migrer vers `@react-pdf/renderer` ou `pdf-lib`.
- Multi-pages : le découpage coupe l'image sans tenir compte du contenu.
- Les statuts « Expiré » ne passent pas automatiquement : à faire à la main
  (piste : calculer à l'affichage à partir de `date` + durée de validité).
- Verrouillage après envoi (exigence légale française de non-modification
  d'une facture émise) non implémenté : piste = champ `locked` mis à `true`
  à l'envoi, en gardant le RIB et les paiements éditables. **Attention** :
  ce projet a fait le choix explicite de garder le numéro de document
  toujours modifiable (demande client) ; un futur verrouillage légal
  devrait donc cibler les montants et lignes, pas forcément le numéro.
- Photos et logo stockés en data URL : rester sur des images légères.
- Pas de tests automatisés.
