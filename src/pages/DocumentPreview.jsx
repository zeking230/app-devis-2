import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { computeDocumentTotals, computeLineTotal, formatMoney } from '../utils/calculations.js';
import { exportNodeToPdf } from '../utils/pdfExport.js';
import { buildMailtoLink } from '../utils/email.js';
import { WARRANTY_TITLE, WARRANTY_TEXT } from '../utils/constants.js';
import { tint } from '../utils/color.js';

const LOGISTICS_FIELDS = [
  ['produit', 'Produit'],
  ['annee', 'Année'],
  ['etat', 'État'],
  ['km', 'Km'],
  ['transport', 'Transport'],
  ['destination', 'Destination'],
  ['delai', 'Délai'],
];

// Aperçu = exactement ce qui sera capturé en PDF (le noeud `ref`).
// Mise en page calquée sur le modèle fourni par le client : en-tête
// teinté avec logo + identité légale, colonnes Client / Détails &
// logistique, tableau à en-tête coloré, totaux HT/TTC, Conditions
// (éditables) / Garanties (texte fixe), bloc paiement, signature,
// mentions légales. Le RIB affiché est TOUJOURS celui des paramètres
// actuels (jamais figé sur le document).
export default function DocumentPreview() {
  const { documents, clients, settings, previewDocId, setView, setEditingDocId } = useApp();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const doc = documents.find((d) => d.id === previewDocId);
  if (!doc) {
    return (
      <section className="view active">
        <div className="empty">Aucun document sélectionné.</div>
      </section>
    );
  }

  const client = clients.find((c) => c.id === doc.clientId);
  const totals = computeDocumentTotals(doc);
  const isDevis = doc.type === 'devis';
  const cur = doc.currency;
  const accent = settings.brandColor || '#1B7A47';
  const logisticsEntries = LOGISTICS_FIELDS.filter(([key]) => doc.logistics?.[key]);
  const conditionLines = (doc.conditionsText || '').split('\n').map((l) => l.trim()).filter(Boolean);

  async function handleExportPdf() {
    setBusy(true);
    try {
      await exportNodeToPdf(ref.current, `${doc.number}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  function handleEmail() {
    if (!client?.email) {
      alert("Ajoutez d'abord l'email du client sur sa fiche.");
      return;
    }
    const label = isDevis ? 'devis' : 'facture';
    const subject = `${isDevis ? 'Devis' : 'Facture'} ${doc.number} — ${settings.name || ''}`;
    const body =
      `Bonjour ${client.firstName},\n\nVeuillez trouver ci-joint votre ${label} ${doc.number}.\n` +
      (isDevis
        ? 'Merci de le signer (bon pour accord) et de nous le renvoyer par retour d\u2019email.\n'
        : `${settings.paymentTerms || ''}\nMerci de nous renvoyer une capture d'écran de la confirmation de virement à cette adresse email.\n`) +
      `\nCordialement,\n${settings.name || ''}`;
    window.location.href = buildMailtoLink({ to: client.email, subject, body });
  }

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <h1>Aperçu du document</h1>
          <p>Ce que le client recevra en pièce jointe</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => { setEditingDocId(doc.id); setView('editor'); }}>Modifier</button>
          <button className="btn ghost" onClick={handleExportPdf} disabled={busy}>
            {busy ? 'Génération…' : 'Télécharger PDF'}
          </button>
          <button className="btn" onClick={handleEmail}>Envoyer par email</button>
        </div>
      </div>
      <div className="note" style={{ marginBottom: 14 }}>
        ✎ « Envoyer par email » ouvre votre messagerie. Téléchargez d'abord le PDF et joignez-le au message.
      </div>

      <div className="docprev" ref={ref} style={{ '--accent': accent, '--accent-bg': tint(accent) }}>
        {/* En-tête : logo + identité entreprise | type de document + numéro/dates */}
        <div className="dhead">
          <div className="dhead-left">
            {settings.logo ? (
              <img src={settings.logo} alt="logo" className="doc-logo" />
            ) : (
              <div className="logo">{(settings.name || 'ME').slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <div className="company-name">{settings.name || 'Votre entreprise'}</div>
              <div className="company-meta">
                {settings.address && <>{settings.address}<br /></>}
                {settings.phone && <><b>Téléphone :</b> {settings.phone}<br /></>}
                {settings.siret && <><b>SIRET :</b> {settings.siret}<br /></>}
                {settings.email && <><b>E-mail :</b> {settings.email}<br /></>}
                {settings.siren && <><b>SIREN :</b> {settings.siren}<br /></>}
                {settings.tva && <><b>TVA :</b> {settings.tva}</>}
              </div>
            </div>
          </div>
          <div className="meta">
            <div className="doc-type">{isDevis ? 'DEVIS' : 'FACTURE'}</div>
            N° {doc.number}
            <br />Date : {doc.date}
            {doc.dueDate && <><br />Échéance : {doc.dueDate}</>}
          </div>
        </div>

        {/* Client / Facturation — Détails & logistique */}
        <div className="two-block">
          <div>
            <div className="block-title">Client / Facturation</div>
            <div className="kv">
              <div><b>Nom/Société :</b> {client ? `${client.firstName} ${client.lastName}` : '—'}</div>
              <div><b>Téléphone :</b> {client?.mobilePhone || '—'}</div>
              <div><b>E-mail :</b> {client?.email || '—'}</div>
              <div><b>Adresse :</b> {(client?.addresses || []).filter(Boolean)[0] || '—'}</div>
            </div>
          </div>
          <div>
            <div className="block-title">Détails &amp; logistique</div>
            <div className="kv">
              {logisticsEntries.length > 0 ? (
                logisticsEntries.map(([key, label]) => (
                  <div key={key}><b>{label} :</b> {doc.logistics[key]}</div>
                ))
              ) : (
                <span className="mini">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Tableau des articles */}
        <table>
          <thead>
            <tr><th>Description de l'article</th><th>Prix Unitaire</th><th>Quantité</th><th>Montant</th></tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.description}
                  {l.note && <span className="line-note">{l.note}</span>}
                </td>
                <td>{formatMoney(l.unitCost, cur)}</td>
                <td>{l.quantity}</td>
                <td>{formatMoney(computeLineTotal(l), cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-mini">
          <div className="r"><span>Total HT</span><span>{formatMoney(totals.subtotal, cur)}</span></div>
          {totals.discount > 0 && <div className="r"><span>Remise</span><span>-{formatMoney(totals.discount, cur)}</span></div>}
          <div className="r"><span>Total TTC</span><span>{formatMoney(totals.total, cur)}</span></div>
          <div className="r net"><span>TOTAL NET À PAYER TTC</span><span>{formatMoney(totals.total, cur)}</span></div>
          {!isDevis && (
            <>
              <div className="r"><span>Payé</span><span>-{formatMoney(totals.paid, cur)}</span></div>
              <div className="r net"><span>Solde dû</span><span>{formatMoney(totals.balanceDue, cur)}</span></div>
            </>
          )}
        </div>

        {/* Conditions (éditables) — Garanties (texte fixe, jamais modifiable) */}
        <div className="two-block">
          <div>
            <div className="block-title">Conditions {isDevis ? 'du devis' : 'de la facture'}</div>
            <div className="fixed-block">
              <ul>
                {conditionLines.map((line, i) => (<li key={i}>{line.replace(/^-\s*/, '')}</li>))}
              </ul>
            </div>
          </div>
          <div>
            <div className="block-title">{WARRANTY_TITLE}</div>
            <div className="fixed-block">
              <ul>
                {WARRANTY_TEXT.map((line, i) => (<li key={i}>{line}</li>))}
              </ul>
            </div>
          </div>
        </div>

        {/* Paiement & coordonnées bancaires — toujours la version actuelle des paramètres */}
        {(settings.ribIban || settings.ribBeneficiary) && (
          <div className="pay-box">
            <div className="pay-title">Paiement &amp; coordonnées bancaires</div>
            {settings.paymentTerms && <div>- Paiement : {settings.paymentTerms}</div>}
            {settings.ribBeneficiary && <div>- Bénéficiaire : {settings.ribBeneficiary}</div>}
            {settings.ribIban && <div>- IBAN : {settings.ribIban}</div>}
            {settings.ribBic && <div>- BIC : {settings.ribBic}</div>}
            {settings.accountNote && <div className="pay-note">{settings.accountNote}</div>}
          </div>
        )}

        {(doc.photos || []).length > 0 && (
          <div className="photo-row" style={{ marginBottom: 20 }}>
            {doc.photos.map((src, i) => (<img key={i} src={src} alt="" className="doc-photo" />))}
          </div>
        )}

        {/* Signature */}
        <div className="sign-row">
          <div>
            <div className="sign-label">Bon pour accord<br /><span style={{ fontWeight: 400 }}>Signature du Client</span></div>
            <div className="sign-box">
              {doc.signature ? <img src={doc.signature} alt="signature" /> : null}
            </div>
            {doc.signedAt && <div className="mini" style={{ marginTop: 4 }}>Signé le {doc.signedAt}</div>}
          </div>
          {(settings.repName || settings.repTitle) && (
            <div className="rep">
              <b>{settings.repName}</b>
              {settings.repTitle}
            </div>
          )}
        </div>

        {/* Mentions légales */}
        {(settings.siren || settings.siret || settings.tva || settings.naf || settings.repName) && (
          <div className="legal-foot">
            {settings.legalMention && <>{settings.legalMention} | </>}
            {settings.siren && <>SIREN : {settings.siren} | </>}
            {settings.siret && <>SIRET : {settings.siret} | </>}
            {settings.tva && <>TVA : {settings.tva}</>}
            <br />
            {settings.naf && <>Activité principale (NAF/APE) : {settings.naf} | </>}
            {settings.repName && <>Représentant légal : {settings.repName}{settings.repTitle ? ` (${settings.repTitle})` : ''}</>}
          </div>
        )}
      </div>
    </section>
  );
}
