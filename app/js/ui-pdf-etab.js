// SPDX-License-Identifier: EUPL-1.2
/*
 * Documents PDF de l'établissement (registre, statistiques), demande du porteur : ils reprennent le papier à en-tête,
 * les marges, l'en-tête, le pied de page et le bloc signature du masque du décompte JLD du service (ou de
 * l'établissement pour plusieurs services). Générateur : app/js/pdf.js.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model;

  /**
   * Nouveau document : `service` (code, ou null pour plusieurs services), `titre`, `options` { sousTitre, confidentiel }.
   * Retourne { doc, finir(options) → octets } ; `finir` ajoute le pied de page, la signature et la date d'édition.
   */
  function creer(service, titre, options) {
    options = options || {};
    var cfg = U.config(), masque = M.masqueDecompte(cfg, service || '*');
    var images = cfg.imagesDecompte || {}, fond = masque.fond && images[masque.fond];
    var auteur = U.App.session ? U.App.session.utilisateur.nom : '';
    var doc = new SIC.pdf.Document({ titre: titre, auteur: auteur, marges: masque.marges, fond: fond ? fond.donnees : null, fondPages: masque.fondPages,
      piedDePage: function (n, total) { return 'Page ' + n + ' / ' + total; } });
    var G = doc.mg.g, L = doc.largeurUtile;
    if (options.confidentiel) doc.paragraphe('DOCUMENT CONFIDENTIEL — DONNÉES PERSONNELLES DE SANTÉ', { taille: 8.5, style: 'gras', aligne: 'centre', cadre: true, apres: 8 });
    if (masque.entete) doc.paragraphe(masque.entete, { taille: 9, largeur: L * 0.55, apres: 8 });
    var etab = [U.etablissement(), service ? U.libService(service) : 'Ensemble des services'].filter(Boolean).join(' — ');
    if (etab) doc.paragraphe(etab, { taille: 8.5, rgb: [0.35, 0.35, 0.35], apres: 2 });
    doc.paragraphe(titre, { taille: 14, style: 'gras', apres: options.sousTitre ? 2 : 8 });
    if (options.sousTitre) doc.paragraphe(options.sousTitre, { taille: 9.5, rgb: [0.3, 0.3, 0.3], apres: 8 });
    function finir(fin) {
      fin = fin || {};
      if (masque.piedPage) doc.paragraphe(masque.piedPage, { taille: 8.5, avant: 4 });
      if (fin.signature !== false && masque.signature) {
        doc.y -= 8;
        doc.paragraphe('Fait le ' + U.date(Date.now()).split(' ')[0], { taille: 9, x: G + L * 0.55, largeur: L * 0.45, apres: 2 });
        doc.paragraphe(masque.signature, { taille: 9, x: G + L * 0.55, largeur: L * 0.45, apres: 8 });
      }
      var mentions = ['Édité le ' + U.date(Date.now()) + (auteur ? ' par ' + auteur : '') + '.'].concat(fin.mentions || []);
      doc.y -= 4; doc.filet(G, doc.y, G + L, doc.y); doc.y -= 3;
      doc.paragraphe(mentions.join(' '), { taille: 7, rgb: [0.35, 0.35, 0.35] });
      return doc.octets();
    }
    return { doc: doc, finir: finir, masque: masque };
  }

  /** Intertitre et tableau simple. */
  function section(doc, titre, entetes, lignes, poids, taille) {
    doc.paragraphe(titre, { taille: 10, style: 'gras', avant: 6, apres: 4 });
    if (!lignes.length) { doc.paragraphe('Aucune donnée.', { taille: 8.5, apres: 4 }); return; }
    doc.tableau({ entetes: entetes, lignes: lignes.map(function (l) { return l.map(function (c) { return c == null ? '' : String(c); }); }), poids: poids, taille: taille || 8 });
    doc.y -= 4;
  }

  U.pdfEtab = { creer: creer, section: section };
})();
