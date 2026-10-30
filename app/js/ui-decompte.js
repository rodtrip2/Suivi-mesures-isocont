// SPDX-License-Identifier: EUPL-1.2
/* Décompte JLD : pièce jointe à l'information ou à la saisine du juge (impression ou PDF). */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  var COLONNES = [['N', 'N°'], ['Debut', 'Début'], ['Fin', 'Fin ou référence'], ['Duree', 'Durée'], ['Cumul', 'Cumul'], ['Statut', 'Statut'], ['Commentaire', 'Commentaire']];

  function document_(m, reference) {
    var etat = U.st(), p = U.patient(m.patientId), d = M.decompte(etat, m, reference);
    var cfg = (U.config().decompte || {})[m.service] || {};
    var masquer = cfg.masquer || [];
    var cols = COLONNES.filter(function (c) { return masquer.indexOf(c[0]) < 0; });
    var titre = m.type === 'Isolement' ? (cfg.titreIsolement || 'Cumul des mesures d’isolement') : (cfg.titreContention || 'Cumul des mesures de contention');
    var j = M.suiviJLD(etat, m, reference);
    function cellule(l, c) {
      switch (c) {
        case 'N': return String(l.n);
        case 'Debut': return U.date(l.debut);
        case 'Fin': return U.date(l.fin);
        case 'Duree': return U.duree(l.duree);
        case 'Cumul': return U.duree(l.cumul);
        case 'Statut': return l.statut;
        default: return l.commentaire;
      }
    }
    return h('article', { class: 'document-jld' },
      h('header', {},
        h('div', { class: 'doc-etab', text: [U.etablissement(), U.libService(m.service)].filter(Boolean).join(' — ') }),
        h('h1', { text: titre }),
        cfg.sousTitre ? h('div', { class: 'doc-sous-titre', text: cfg.sousTitre }) : null),
      h('table', { class: 'doc-identite' }, h('tbody', {},
        h('tr', {}, h('th', { text: 'Patient' }), h('td', { text: (p.nom || '') + ' ' + (p.prenom || '') + (p.naissance ? ', né(e) le ' + p.naissance.split('-').reverse().join('/') : '') })),
        h('tr', {}, h('th', { text: 'IPP' }), h('td', { text: p.ipp || '—' })),
        h('tr', {}, h('th', { text: 'Mesure' }), h('td', { text: m.type + ' — ' + (m.lieu || '') + ' — décidée par ' + (m.psychiatreDebut || '?') })),
        h('tr', {}, h('th', { text: 'Période analysée' }), h('td', { text: 'du ' + U.date(d.fenetreDebut) + ' au ' + U.date(d.reference) + ' (15 jours glissants avant le début de la mesure, puis la mesure)' })),
        h('tr', {}, h('th', { text: 'Situation' }), h('td', {}, h('b', { text: 'Dernière mesure initiée le ' + U.date(m.debut) + (d.enCours ? ' — EN COURS au ' + U.date(d.reference) : ' — TERMINÉE le ' + U.date(m.fin)) }))))),
      h('table', { class: 'doc-tableau' },
        h('thead', {}, h('tr', {}, cols.map(function (c) { return h('th', { text: c[1] }); }))),
        h('tbody', {}, d.lignes.map(function (l) { return h('tr', {}, cols.map(function (c) { return h('td', { text: cellule(l, c[0]) }); })); }))),
      h('p', { class: 'doc-total' },
        'Cumul des mesures antérieures sur 15 jours : ', h('b', { text: U.duree(d.cumulAvant) }),
        ' — Durée totale décomptée : ', h('b', { text: U.duree(d.total) }), '.'),
      h('p', {}, 'Cycle de contrôle n° ' + j.cycle + ' — information avant le ' + U.date(j.info.echeance) + ', saisine avant le ' + U.date(j.saisine.echeance) + ', décision avant le ' + U.date(j.decision.echeance) + '.'),
      h('footer', { text: 'Édité le ' + U.date(Date.now()) + ' par ' + U.App.session.utilisateur.nom + ' — décompte calculé selon l’article L. 3222-5-1 du code de la santé publique (périodes qui se chevauchent comptées une seule fois).' }));
  }

  U.actions.decompte = function (m) {
    var ref = h('input', { type: 'datetime-local', value: U.versSaisie(typeof m.fin === 'number' ? Math.min(m.fin, Date.now()) : Date.now()) });
    var apercu = h('div', { class: 'apercu-document' });
    function maj() { U.vider(apercu); try { apercu.appendChild(document_(m, U.depuisSaisie(ref.value))); } catch (e) { apercu.appendChild(h('div', { class: 'erreur', text: e.message })); } }
    ref.addEventListener('change', maj); maj();
    U.modale('Décompte JLD', h('div', { class: 'pile' },
      h('label', {}, 'Date et heure de référence (en général : maintenant)', ref), apercu,
      h('small', { class: 'muted', text: 'Pour un PDF, choisissez « Enregistrer au format PDF » comme imprimante.' })), [
      { texte: 'Fermer' },
      { texte: 'Imprimer / PDF', classe: 'primaire', action: function () {
        var doc = document_(m, U.depuisSaisie(ref.value));
        setTimeout(function () { U.imprimer(doc); }, 50);
        return true;
      } }]);
  };
})();
