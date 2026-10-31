// SPDX-License-Identifier: EUPL-1.2
/*
 * Registre pour communication à un tiers (demande CADA, art. L. 311-1 et suivants du CRPA).
 * Le registre légal (art. L. 3222-5-1 CSP) est réservé à la CDSP, au CGLPL et aux parlementaires.
 * Pour toute autre demande, il n'est communicable qu'après occultation des données permettant
 * d'identifier les patients ou les soignants (CE, 8 février 2023, n° 455887).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  var fmtJour = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  var fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  var FMT = { date: U.date, jour: function (t) { return fmtJour.format(t); }, mois: function (t) { return fmtMois.format(t); }, duree: U.duree };

  var CHOIX = [
    ['patient', 'Identifiant des patients', [['masquer', 'Occulter (recommandé)'], ['numero', 'Remplacer par un numéro propre au document (Patient 1, Patient 2…)']],
      { numero: 'Le Conseil d’État juge qu’un identifiant, même pseudonymisé, reste identifiant. Un numéro propre au document permet en outre de relier les mesures d’un même patient : à réserver aux cas où ce lien est indispensable, et à éviter dans un petit service.' }],
    ['age', 'Âge', [['mineur', 'Mineur / majeur (recommandé)'], ['tranche', 'Tranche d’âge'], ['exact', 'Âge exact'], ['masquer', 'Occulter']],
      { exact: 'Associé aux dates et au mode d’hospitalisation, l’âge exact peut permettre de reconnaître un patient.' }],
    ['dates', 'Dates', [['jour', 'Date sans l’heure (recommandé)'], ['mois', 'Mois seulement'], ['complete', 'Date et heure']],
      { complete: 'Les heures exactes facilitent le rapprochement avec d’autres informations (visites, audiences) et donc la réidentification.' }],
    ['psychiatre', 'Psychiatre', [['masquer', 'Masquer la colonne (recommandé)'], ['generique', 'Mention « Psychiatre »'], ['numero', 'Nom générique numéroté (Psychiatre 1, Psychiatre 2…)']],
      { numero: 'Dans une équipe réduite, un numéro constant d’une ligne à l’autre peut permettre de reconnaître un psychiatre (gardes, plannings).' }],
    ['professionnels', 'Soignants chargés de la surveillance', [['masquer', 'Masquer la colonne (recommandé)'], ['fonction', 'Fonction et nombre (2 IDE, 1 AS…)'], ['numero', 'Fonction et numéro (IDE 1, AS 2…)']],
      { numero: 'Dans une équipe réduite, un numéro constant d’une ligne à l’autre peut permettre de reconnaître un soignant (plannings).' }],
    ['lieu', 'Lieu', [['masquer', 'Occulter (la catégorie indique déjà CSI ou non)'], ['categorie', 'CSI / hors CSI'], ['afficher', 'Lieu exact (n° de CSI ou de chambre)']], {}],
    ['mode', 'Mode d’hospitalisation', [['afficher', 'Afficher (SDT, SDRE, SL…)'], ['contrainte', 'Soins sans consentement : oui / non'], ['masquer', 'Occulter']], {}],
    ['pauses', 'Levées temporaires', [['afficher', 'Afficher le nombre et la durée'], ['masquer', 'Occulter']], {}]
  ];

  function documentRegistre(service, annee, r, reference) {
    return h('article', { class: 'document-registre' },
      h('div', { class: 'doc-etab', text: [U.etablissement(), U.libService(service)].filter(Boolean).join(' — ') }),
      h('h1', { text: 'Registre des mesures d’isolement et de contention — ' + annee }),
      h('p', { class: 'doc-sous-titre', text: 'Version occultée, établie pour communication en application des articles L. 311-1 et suivants du code des relations entre le public et l’administration.' }),
      h('p', { class: 'doc-occultations', text: 'Occultations : ' + r.occultations.join(' ; ') + '. Les numéros de remplacement éventuels sont propres à ce document.' }),
      reference ? h('p', { text: 'Demande : ' + reference }) : null,
      h('table', {}, h('thead', {}, h('tr', {}, r.colonnes.map(function (c) { return h('th', { text: c }); }))),
        h('tbody', {}, r.lignes.map(function (l) { return h('tr', {}, l.map(function (v) { return h('td', { text: v }); })); }))),
      h('p', { class: 'doc-note', text: 'Catégories : ' + Object.keys(M.LIB_CATEGORIES).map(function (k) { return k + ' = ' + M.LIB_CATEGORIES[k]; }).join(' ; ') + '. Édité le ' + U.date(Date.now()) + '.' }));
  }

  function csv(service, annee, r, reference) {
    var lignes = [['Registre des mesures d’isolement et de contention — ' + U.libService(service) + ' — ' + annee + ' — version occultée pour communication (CRPA)'],
      ['Occultations : ' + r.occultations.join(' ; ')]];
    if (reference) lignes.push(['Demande : ' + reference]);
    lignes.push([]); lignes.push(r.colonnes);
    r.lignes.forEach(function (l) { lignes.push(l); });
    return '﻿' + lignes.map(function (l) { return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
  }

  U.actions.registreCADA = function (service, annee) {
    var etat = U.st(), maintenant = Date.now(), selects = {}, avertissements = {};
    var grille = h('div', { class: 'grille-occultation' }, CHOIX.map(function (c) {
      var sel = h('select', {}, c[2].map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === M.OCCULTATION_DEFAUT[c[0]] }); }));
      selects[c[0]] = sel; avertissements[c[0]] = U.alerteChamp ? U.alerteChamp() : h('div');
      return h('label', {}, c[1], sel, avertissements[c[0]]);
    }));
    var reference = h('input', { type: 'text', placeholder: 'ex. demande de M. X du 12/10/2026, avis CADA n°… (facultatif)' });
    var apercu = h('div', { class: 'apercu-registre' });
    var resume = h('p', { class: 'muted' });
    function options() { var o = {}; Object.keys(selects).forEach(function (k) { o[k] = selects[k].value; }); return o; }
    function calculer() { return M.registreCommunicable(etat, service, annee, maintenant, options(), FMT); }
    function maj() {
      CHOIX.forEach(function (c) { var t = c[3][selects[c[0]].value]; avertissements[c[0]].afficher ? avertissements[c[0]].afficher(t ? [t] : []) : null; });
      var r = calculer();
      resume.textContent = r.entrees + ' entrée(s). Occultations : ' + r.occultations.join(' ; ') + '.';
      U.vider(apercu).appendChild(h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, r.colonnes.map(function (c) { return h('th', { text: c }); }))),
        h('tbody', {}, r.lignes.slice(0, 12).map(function (l) { return h('tr', {}, l.map(function (v) { return h('td', { text: v }); })); })))));
      if (r.lignes.length > 12) apercu.appendChild(h('small', { class: 'muted', text: '… ' + (r.lignes.length - 12) + ' autre(s) entrée(s) dans le document.' }));
    }
    Object.keys(selects).forEach(function (k) { selects[k].addEventListener('change', maj); });
    maj();
    function tracer(format) {
      return U.App.session.tracer('EDITION_CADA', { libelle: U.libService(service) + ' ' + annee + ' — ' + format + (reference.value.trim() ? ' — ' + reference.value.trim() : '') + ' — ' + calculer().occultations.join(' ; ') });
    }
    U.modale('Registre pour communication (CADA) — ' + U.libService(service) + ' ' + annee, h('div', { class: 'pile' },
      h('div', { class: 'alerte', text: 'Le registre légal n’est présenté de droit qu’à la commission départementale des soins psychiatriques, au Contrôleur général des lieux de privation de liberté et aux parlementaires. Pour toute autre demande (accès aux documents administratifs), il ne peut être communiqué qu’après occultation de toute donnée permettant d’identifier les patients ou les soignants (Conseil d’État, 8 février 2023, n° 455887). Les choix recommandés sont présélectionnés ; faites valider la version communiquée par la direction ou le service juridique.' }),
      grille,
      h('label', {}, 'Référence de la demande (figure sur le document et dans le journal)', reference),
      resume, apercu,
      h('small', { class: 'muted', text: 'Chaque impression ou export est tracé dans le journal, avec les occultations appliquées.' })), [
      { texte: 'Fermer' },
      { texte: 'Exporter (CSV)', action: async function () {
        var r = calculer();
        await tracer('CSV');
        var a = h('a', { href: URL.createObjectURL(new Blob([csv(service, annee, r, reference.value.trim())], { type: 'text/csv;charset=utf-8' })), download: 'registre_communication_' + service + '_' + annee + '.csv' });
        document.body.appendChild(a); a.click(); a.remove();
        return false;
      } },
      { texte: 'Imprimer / PDF', classe: 'primaire', action: async function () {
        var r = calculer();
        await tracer('impression');
        var doc = documentRegistre(service, annee, r, reference.value.trim());
        setTimeout(function () { U.imprimer(doc); }, 50);
        return true;
      } }]);
  };

  U.actions.documentRegistreCADA = documentRegistre;
})();
