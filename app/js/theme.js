// SPDX-License-Identifier: EUPL-1.2
/*
 * Thème clair ou sombre appliqué dès le chargement (avant l'affichage), d'après le dernier choix fait sur ce
 * poste. Après la connexion, le choix enregistré pour l'agent (fichier chiffré preferences/<agent>.enc) le remplace.
 * Sans choix : le thème du système.
 */
(function () {
  'use strict';
  try {
    var t = localStorage.getItem('sic-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* stockage indisponible : thème du système */ }
})();
