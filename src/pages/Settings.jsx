import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { exportAllData, importAllData } from '../db.js';
import HelpBubble from '../components/HelpBubble.jsx';

export default function Settings() {
  const { settings, saveSettings, reloadAll, helpMode, setHelpMode } = useApp();
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { setForm(settings); }, [settings]);

  function handleLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    await saveSettings(form);
    setMsg('Enregistré ✓');
    setTimeout(() => setMsg(''), 2000);
  }

  async function handleExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-devis-facture-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importAllData(data);
      await reloadAll();
      alert('Import terminé.');
    } catch {
      alert('Fichier de sauvegarde invalide.');
    }
    e.target.value = '';
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <h1>Profil entreprise</h1>
          <p>Apparaît sur tous vos devis et factures</p>
        </div>
        <button className={`btn ghost help-toggle ${helpMode ? 'active' : ''}`} onClick={() => setHelpMode(!helpMode)}>
          ？ Aide
        </button>
      </div>

      <div className="card pad relative" style={{ maxWidth: 560, marginBottom: 18 }}>
        <HelpBubble side="right">
          Toutes ces informations (nom, SIRET, SIREN, TVA…) sont imprimées automatiquement
          dans l'en-tête et le pied de page de chaque devis/facture, exactement comme sur
          votre modèle papier. Remplissez-les une seule fois ici.
        </HelpBubble>

        <div className="field">
          <label>Logo</label>
          <input type="file" accept="image/*" onChange={handleLogo} />
          {form.logo && <img src={form.logo} alt="logo" className="doc-logo" style={{ marginTop: 8 }} />}
        </div>
        <div className="field"><label>Nom de l'entreprise</label><input value={form.name} onChange={set('name')} /></div>
        <div className="field"><label>Adresse</label><input value={form.address} onChange={set('address')} placeholder="Numéro, rue, code postal, ville, pays" /></div>
        <div className="grid2">
          <div className="field"><label>Téléphone</label><input value={form.phone} onChange={set('phone')} /></div>
          <div className="field"><label>Email d'envoi</label><input type="email" value={form.email} onChange={set('email')} /></div>
        </div>

        <div className="section-title">Identité légale</div>
        <div className="grid2">
          <div className="field"><label>SIRET</label><input value={form.siret} onChange={set('siret')} placeholder="523 990 620 00016" /></div>
          <div className="field"><label>SIREN</label><input value={form.siren} onChange={set('siren')} placeholder="523 990 620" /></div>
        </div>
        <div className="grid2">
          <div className="field"><label>N° TVA intracommunautaire</label><input value={form.tva} onChange={set('tva')} placeholder="FR57 523 990 620" /></div>
          <div className="field"><label>Code NAF / APE</label><input value={form.naf} onChange={set('naf')} placeholder="45.11Z" /></div>
        </div>
        <div className="field">
          <label>Mention d'immatriculation (pied de page)</label>
          <input value={form.legalMention} onChange={set('legalMention')} placeholder="Immatriculée au RNE (INPI)" />
        </div>
        <div className="grid2">
          <div className="field"><label>Représentant légal</label><input value={form.repName} onChange={set('repName')} placeholder="Ethan Nolan" /></div>
          <div className="field"><label>Fonction</label><input value={form.repTitle} onChange={set('repTitle')} placeholder="Chef commercial" /></div>
        </div>
        <div className="hint" style={{ marginBottom: 14 }}>
          Ces informations servent à générer automatiquement la ligne légale en pied de PDF
          (immatriculation, SIREN/SIRET/TVA, NAF/APE, représentant légal) et le nom affiché
          dans le bloc signature.
        </div>

        <div className="field" style={{ maxWidth: 220 }}>
          <label>Couleur du document (PDF)</label>
          <input type="color" value={form.brandColor} onChange={set('brandColor')} style={{ height: 40, padding: 4 }} />
        </div>

        <div className="section-title">Mode de paiement (RIB)</div>
        <div className="field"><label>Bénéficiaire</label><input value={form.ribBeneficiary} onChange={set('ribBeneficiary')} /></div>
        <div className="field"><label>IBAN</label><input value={form.ribIban} onChange={set('ribIban')} /></div>
        <div className="field"><label>BIC</label><input value={form.ribBic} onChange={set('ribBic')} /></div>
        <div className="field"><label>Conditions de paiement (ligne affichée en premier)</label><input value={form.paymentTerms} onChange={set('paymentTerms')} /></div>
        <div className="field"><label>Note complémentaire (facultatif, en italique sur le PDF)</label><textarea value={form.accountNote} onChange={set('accountNote')} placeholder="Ex. Compte professionnel en cours de mise à jour…" /></div>
        <div className="note">
          ✎ Ce RIB peut être modifié à tout moment. Il n'est jamais verrouillé : chaque aperçu / PDF généré reprend la version actuelle.
        </div>
        <button className="btn" style={{ marginTop: 18 }} onClick={handleSave}>
          Enregistrer {msg && <span>{msg}</span>}
        </button>
      </div>

      <div className="card pad" style={{ maxWidth: 560 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Sauvegarde des données</div>
        <p className="mini" style={{ marginBottom: 12 }}>
          Toutes les données sont stockées uniquement dans ce navigateur. Vider le cache ou changer d'appareil les efface :
          exportez régulièrement une copie.
        </p>
        <button className="btn ghost" onClick={handleExport}>Exporter (JSON)</button>{' '}
        <button className="btn ghost" onClick={() => fileRef.current.click()}>Importer une sauvegarde</button>
        <input type="file" accept="application/json" ref={fileRef} style={{ display: 'none' }} onChange={handleImport} />
      </div>
    </section>
  );
}
