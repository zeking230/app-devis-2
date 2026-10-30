import React from 'react';
import { useApp } from '../context/AppContext.jsx';

// Petite bulle d'aide avec flèche, affichée uniquement quand le mode Aide
// est activé (bouton "？ Aide" dans l'en-tête de page). `side` place la
// flèche : 'left' (par défaut, pointe vers la gauche/le haut du champ) ou
// 'right'.
export default function HelpBubble({ children, side = 'left' }) {
  const { helpMode } = useApp();
  if (!helpMode) return null;
  return (
    <div className={`help-bubble help-${side}`}>
      <span className="help-arrow" aria-hidden="true">↳</span>
      {children}
    </div>
  );
}
