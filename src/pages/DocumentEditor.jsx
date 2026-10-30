import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { computeDocumentTotals, computeLineTotal, formatMoney } from '../utils/calculations.js';
import { WARRANTY_TITLE, WARRANTY_TEXT } from '../utils/constants.js';
import SignaturePad from '../components/SignaturePad.jsx';
import Toggle from '../components/Toggle.jsx';
import HelpBubble from '../components/HelpBubble.jsx';

const STATUS_DEVIS = [
  ['draft', 'Brouillon'],
  ['sent', 'Envoyé'],
  ['signed', 'Signé / Accepté'],
  ['refused', 'Refusé'],
  ['expired', 'Expiré'],
];
const STATUS_FACTURE = [
  ['unpaid', 'Non payée'],
  ['partial', 'Partiellement payée'],
  ['paid', 'Payée'],
];

const LOGISTICS_FIELDS = [
  ['produit', 'Produit'],
  ['annee', 'Année'],
  ['etat', 'État'],
  ['km', 'Km'],
  ['transport', 'Transport'],
  ['destination', 'Destination'],
  ['delai', 'Délai'],
];

// Wrapper : choisit le document à éditer, ou propose d'en créer un.
// (La création est déclenchée par un clic, jamais par un effet, pour éviter
// les doubles numéros en React StrictMode.)
export default function DocumentEditor() {
  const { documents, editingDocId, setEditingDocId, createNewDocument } = useApp();
  const existing = documents.find((d) => d.id === editingDocId);

  if (!existing) {
    return (
      <section className="view active">
        <div className="pagehead">
          <div>
            <h1>Nouveau document</h1>
            <p>Que souhaitez-vous créer ?</p>
          </div>
        </div>
        <div className="card pad" style={{ maxWidth: 420 }}>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => setEditingDocId((await createNewDocument('devis')).id)}
          >
            Nouveau devis
          </button>
          <button
            className="btn ghost"
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
            onClick={async () => setEditingDocId((await createNewDocument('facture')).id)}
          >
            Nouvelle facture directe
          </button>
        </div>
      </section>
    );
  }

  // key => remonte l'éditeur (état local réinitialisé) quand on change de doc.
  return <Editor key={existing.id} initialDoc={existing} />;
}

function Editor({ initialDoc }) {
  const {
    clients, articles, settings,
    saveDocument, saveArticle, convertToInvoice,
    setView, setPreviewDocId, helpMode, setHelpMode,
  } = useApp();

  const [doc, setDoc] = useState({ logistics: {}, ...initialDoc });
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');

  const totals = computeDocumentTotals(doc);
  const update = (patch) => setDoc((prev) => ({ ...prev, ...patch }));
  const updateLine = (id, patch) =>
    setDoc((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const updateLogistics = (key, val) =>
    setDoc((prev) => ({ ...prev, logistics: { ...prev.logistics, [key]: val } }));

  function addFreeLine() {
    update({
      lines: [
        ...doc.lines,
        { id: crypto.randomUUID(), description: '', note: '', quantity: 1, unitCost: 0, discountType: 'none', discountValue: 0, taxable: true },
      ],
    });
  }

  function addFromCatalog(articleId) {
    const a = articles.find((x) => x.id === articleId);
    if (!a) return;
    update({
      lines: [
        ...doc.lines,
        {
          id: crypto.randomUUID(),
          articleId: a.id,
          description: a.description,
          note: '',
          quantity: a.quantity || 1,
          unitCost: a.unitCost,
          discountType: a.discountType,
          discountValue: a.discountValue,
          taxable: a.taxable,
        },
      ],
    });
  }

  function handleNumberChange(e) {
    update({ number: e.target.value });
  }

  // Enregistre le doc + ajoute au catalogue les lignes libres (si activé).
  async function persist(current) {
    let next = current;
    if (saveToCatalog) {
      const lines = [];
      for (const l of current.lines) {
        if (!l.articleId && l.description.trim()) {
          const saved = await saveArticle({
            description: l.description,
            unitCost: l.unitCost,
            unit: 'unite',
            quantity: l.quantity,
            discountType: l.discountType,
            discountValue: l.discountValue,
            taxable: l.taxable !== false,
            notes: '',
          });
          lines.push({ ...l, articleId: saved.id });
        } else {
          lines.push(l);
        }
      }
      next = { ...current, lines };
    }
    const saved = await saveDocument(next);
    setDoc(saved);
    return saved;
  }

  async function handleSave() {
    await persist(doc);
    setSavedMsg('Enregistré ✓');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  async function handlePreview() {
    const saved = await persist(doc);
    setPreviewDocId(saved.id);
    setView('preview');
  }

  async function handleConvert() {
    const saved = await persist(doc);
    const invoice = await convertToInvoice(saved.id);
    if (invoice) {
      setPreviewDocId(invoice.id);
      setView('preview');
    }
  }

  async function addPayment(amount, date) {
    if (!Number(amount)) return;
    const payments = [...(doc.payments || []), { id: crypto.randomUUID(), amount: Number(amount), date }];
    const balance = computeDocumentTotals({ ...doc, payments }).balanceDue;
    const saved = await saveDocument({ ...doc, payments, status: balance <= 0 ? 'paid' : 'partial' });
    setDoc(saved);
  }

  async function removePayment(id) {
    const payments = doc.payments.filter((p) => p.id !== id);
    const paid = computeDocumentTotals({ ...doc, payments }).paid;
    const balance = computeDocumentTotals({ ...doc, payments }).balanceDue;
    const status = paid === 0 ? 'unpaid' : balance <= 0 ? 'paid' : 'partial';
    setDoc(await saveDocument({ ...doc, payments, status }));
  }

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ photos: [...(doc.photos || []), reader.result] });
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const isDevis = doc.type === 'devis';
  const currency = doc.currency;

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <h1>{isDevis ? 'Devis' : 'Facture'} {doc.number}</h1>
          <p>{isDevis ? 'Créez un devis, convertissez-le en facture plus tard' : 'Facture'}</p>
        </div>
        <button className={`btn ghost help-toggle ${helpMode ? 'active' : ''}`} onClick={() => setHelpMode(!helpMode)}>？ Aide</button>
      </div>

      <div className="two-col">
        <div className="card pad relative">
          <HelpBubble side="right">
            Numéro, client, articles, détails et conditions : tout ce que vous saisissez dans
            cette colonne apparaît directement dans le PDF, à l'identique de votre modèle
            papier. Cliquez sur « Aperçu PDF » à droite pour vérifier le rendu à tout moment.
          </HelpBubble>

          <div className="grid2">
            <div className="field">
              <label>Numéro {isDevis ? 'du devis' : 'de la facture'}</label>
              <input value={doc.number} onChange={handleNumberChange} />
              <div className="hint">Modifiable librement — gardez un numéro unique par document.</div>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={doc.date} onChange={(e) => update({ date: e.target.value })} />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 240 }}>
            <label>Échéance</label>
            <input type="date" value={doc.dueDate || ''} onChange={(e) => update({ dueDate: e.target.value })} />
          </div>

          <div className="grid2">
            <div className="field">
              <label>Client</label>
              <select value={doc.clientId || ''} onChange={(e) => update({ clientId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
              {clients.length === 0 && <div className="hint">Ajoutez d'abord un client dans l'onglet Clients.</div>}
            </div>
            <div className="field">
              <label>Devise</label>
              <select value={doc.currency} onChange={(e) => update({ currency: e.target.value })}>
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — Dollar US</option>
                <option value="OTHER">Autre (taux manuel)</option>
              </select>
            </div>
          </div>
          {doc.currency !== 'EUR' && (
            <div className="field" style={{ maxWidth: 240 }}>
              <label>Taux de conversion (saisi manuellement)</label>
              <input type="number" step="0.0001" value={doc.exchangeRate} onChange={(e) => update({ exchangeRate: e.target.value })} />
            </div>
          )}

          <div className="section-title">Détails &amp; logistique <span className="mini">(optionnel)</span></div>
          <div className="grid2">
            {LOGISTICS_FIELDS.map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input value={doc.logistics?.[key] || ''} onChange={(e) => updateLogistics(key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="hint" style={{ marginTop: -6, marginBottom: 14 }}>
            Ces champs s'affichent dans la colonne « Détails &amp; logistique » du PDF, à côté
            des informations du client. Laissez vide ce qui ne s'applique pas.
          </div>

          <div className="section-title" style={{ justifyContent: 'space-between' }}>
            <span>Articles</span>
            <select
              defaultValue=""
              style={{ maxWidth: 220, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)' }}
              onChange={(e) => {
                if (e.target.value) addFromCatalog(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">+ Depuis mes articles</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>{a.description}</option>
              ))}
            </select>
          </div>

          <div className="li-row li-head">
            <div>Désignation</div><div>Qté</div><div>Prix</div><div>Montant</div><div></div>
          </div>
          {doc.lines.map((line) => (
            <div key={line.id}>
              <div className="li-row">
                <input value={line.description} placeholder="Désignation" onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                <input type="number" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                <input type="number" step="0.01" value={line.unitCost} onChange={(e) => updateLine(line.id, { unitCost: e.target.value })} />
                <div className="li-total">{formatMoney(computeLineTotal(line), currency)}</div>
                <button className="li-del" onClick={() => update({ lines: doc.lines.filter((l) => l.id !== line.id) })}>✕</button>
              </div>
              <input
                value={line.note || ''}
                placeholder="Sous-ligne facultative (ex. Hyundai i20 1.1 CRDi 75 ch de 2017)"
                style={{ width: '100%', fontSize: 12, padding: '5px 9px', marginTop: 2, marginBottom: 6, border: '1px dashed var(--line)', borderRadius: 6 }}
                onChange={(e) => updateLine(line.id, { note: e.target.value })}
              />
            </div>
          ))}
          <button className="btn ghost" style={{ marginTop: 4 }} onClick={addFreeLine}>+ Nouvel article libre</button>

          <div style={{ marginTop: 12 }}>
            <Toggle label="Enregistrer les nouveaux articles dans « Mes articles »" checked={saveToCatalog} onChange={setSaveToCatalog} />
          </div>

          <div className="totals-box">
            <div className="trow"><span>Total HT</span><span>{formatMoney(totals.subtotal, currency)}</span></div>
            <div className="grid2">
              <div className="field">
                <label>Remise globale (montant)</label>
                <input type="number" step="0.01" value={doc.discount} onChange={(e) => update({ discount: e.target.value })} />
              </div>
              <div className="field">
                <label>Taxe (%)</label>
                <input type="number" step="0.01" value={doc.taxRate} onChange={(e) => update({ taxRate: e.target.value })} />
              </div>
            </div>
            <div className="trow"><span>Taxe</span><span>{formatMoney(totals.taxAmount, currency)}</span></div>
            <div className="trow grand"><span>Total TTC</span><span>{formatMoney(totals.total, currency)}</span></div>
            {!isDevis && (
              <>
                <div className="trow"><span>Payé</span><span>-{formatMoney(totals.paid, currency)}</span></div>
                <div className="trow grand"><span>Solde dû</span><span>{formatMoney(totals.balanceDue, currency)}</span></div>
              </>
            )}
          </div>

          <div className="section-title">Statut</div>
          <div className="field" style={{ maxWidth: 280 }}>
            <select value={doc.status} onChange={(e) => update({ status: e.target.value })}>
              {(isDevis ? STATUS_DEVIS : STATUS_FACTURE).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <div className="hint">Mise à jour manuelle (pas de suivi automatique des emails).</div>
          </div>

          <div className="field">
            <label>Ajouter une photo</label>
            <input type="file" accept="image/*" onChange={handlePhoto} />
            {(doc.photos || []).length > 0 && (
              <div className="photo-row">
                {doc.photos.map((src, i) => (
                  <div key={i} className="photo-thumb">
                    <img src={src} alt="" />
                    <button onClick={() => update({ photos: doc.photos.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-title" style={{ justifyContent: 'space-between' }}>
            <span>Conditions {isDevis ? 'du devis' : 'de la facture'}</span>
          </div>
          <div className="field">
            <textarea
              value={doc.conditionsText || ''}
              onChange={(e) => update({ conditionsText: e.target.value })}
              style={{ minHeight: 90 }}
            />
            <div className="hint">Une ligne par point (affiché avec un tiret devant, comme sur votre modèle). Entièrement modifiable.</div>
          </div>

          <div className="section-title">{WARRANTY_TITLE}</div>
          <div className="fixed-note">
            {WARRANTY_TEXT.map((line, i) => (<div key={i}>- {line}</div>))}
            <div style={{ marginTop: 8 }}><b>Texte fixe, non modifiable</b> ici volontairement (comme demandé) —
            il est copié à l'identique sur chaque document. Pour le changer, un développeur doit
            éditer <code>src/utils/constants.js</code> (voir MAINTENANCE.md).</div>
          </div>
        </div>

        <div className="card pad relative">
          <HelpBubble>
            Le RIB affiché ici vient de vos paramètres Entreprise et n'est jamais figé sur un
            document : vous pouvez le changer à tout moment, même pour une facture déjà envoyée.
          </HelpBubble>

          {!isDevis && (
            <>
              <div className="section-title" style={{ marginTop: 0 }}>Paiements</div>
              <PaymentForm onAdd={addPayment} />
              {(doc.payments || []).map((p) => (
                <div className="trow" key={p.id}>
                  <span>{p.date}</span>
                  <span>
                    {formatMoney(p.amount, currency)}{' '}
                    <button className="li-del" onClick={() => removePayment(p.id)}>✕</button>
                  </span>
                </div>
              ))}
            </>
          )}

          <div className="section-title" style={{ marginTop: isDevis ? 0 : 24 }}>Signature</div>
          <SignaturePad
            value={doc.signature}
            onChange={(sig) => update({ signature: sig, signedAt: sig ? new Date().toISOString().slice(0, 10) : null })}
          />

          <div className="section-title">Mode de paiement — RIB</div>
          <div className="rib-box">
            <div className="row">
              <b style={{ fontSize: 13 }}>{settings.ribIban || 'Aucun RIB renseigné'}</b>
              <button className="btn ghost" onClick={() => setView('settings')}>Modifier</button>
            </div>
            <div className="mini" style={{ marginTop: 4 }}>
              {settings.ribBeneficiary} {settings.ribBic ? `— ${settings.ribBic}` : ''}
            </div>
          </div>
          <div className="note">✎ Le RIB est repris depuis vos paramètres entreprise et n'est jamais figé sur un document : modifiable à tout moment.</div>

          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 22 }} onClick={handlePreview}>
            Aperçu PDF
          </button>
          {isDevis && (
            <button className="btn ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={handleConvert}>
              Convertir en facture
            </button>
          )}
          <button className="btn ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={handleSave}>
            Enregistrer {savedMsg && <span style={{ color: 'var(--green)' }}>{savedMsg}</span>}
          </button>
        </div>
      </div>
    </section>
  );
}

function PaymentForm({ onAdd }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div>
      <div className="grid2">
        <div className="field">
          <label>Montant reçu</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <button
        className="btn ghost"
        onClick={() => {
          onAdd(amount, date);
          setAmount('');
        }}
      >
        + Enregistrer un paiement (virement)
      </button>
    </div>
  );
}
