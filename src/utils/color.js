// Éclaircit une couleur hex vers le blanc (pour générer automatiquement
// la teinte de fond --accent-bg à partir de la couleur choisie dans
// Entreprise > Couleur du document, sans avoir à la saisir séparément).
export function tint(hex, amount = 0.92) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '#EAF6EF';
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
