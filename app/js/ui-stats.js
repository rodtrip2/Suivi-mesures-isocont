// SPDX-License-Identifier: EUPL-1.2
/* Onglet Statistiques : rapport annuel « L'isolement et la contention en chiffres » (année N et N-1). */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var annee = new Date().getFullYear() - (new Date().getMonth() < 2 ? 1 : 0);
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function n(v) { return v == null ? 'n.d.' : nf.format(v); }
  function heures(v) { return v == null ? 'n.d.' : nf.format(Math.round(v * 10) / 10) + ' h'; }
  function pct(v) { return v == null ? 'n.d.' : nf.format(Math.round(v * 1000) / 10) + ' %'; }
  function evolution(a, b) {
    if (a == null || b == null) return '';
    if (a === 0) return b === 0 ? '=' : 'nouveau';
    var e = (b - a) / a * 100;
    return (e > 0 ? '+' : '') + nf.format(Math.round(e * 10) / 10) + ' %';
  }

  function servicesChoisis() {
    return U.App.service === '*' ? U.services().map(function (x) { return x.code; }) : [U.App.service];
  }

  function lignesRapport(a, b) {
    return [
      ['Patients hospitalisés en hospitalisation complète (HC) — à saisir', a.patientsHC, b.patientsHC, n],
      ['Patients hospitalisés sous contrainte (SSC) — à saisir', a.patientsSSC, b.patientsSSC, n],
      ['Nombre de mesures (entrées du registre terminées)', a.mesures, b.mesures, n],
      ['Patients distincts ayant fait l’objet d’un isolement', a.patientsIsolement, b.patientsIsolement, n],
      ['Patients distincts ayant fait l’objet d’une contention', a.patientsContention, b.patientsContention, n],
      ['Patients distincts — isolement ou contention', a.patients, b.patients, n],
      ['Patients en soins sans consentement ayant fait l’objet d’une mesure', a.patientsSSCAvecMesure, b.patientsSSCAvecMesure, n],
      ['Nombre moyen de mesures par patient', a.mesuresParPatient, b.mesuresParPatient, n],
      ['Durée moyenne d’une mesure', a.duree.moyenne, b.duree.moyenne, heures],
      ['Durée médiane d’une mesure', a.duree.mediane, b.duree.mediane, heures],
      ['Durée minimale', a.duree.min, b.duree.min, heures],
      ['Durée maximale', a.duree.max, b.duree.max, heures],
      ['Durée cumulée des mesures', a.duree.total, b.duree.total, heures],
      ['Heures d’utilisation de la CSI (isolement et contention en CSI)', a.heuresCSI, b.heuresCSI, heures],
      ['Part des patients HC ayant fait l’objet d’une mesure', a.partPatientsHC, b.partPatientsHC, pct],
      ['Part des patients SSC ayant fait l’objet d’une mesure', a.partPatientsSSC, b.partPatientsSSC, pct]
    ];
  }

  function lignesConformite(a, b) {
    return [
      ['Entrées concernant un patient en soins libres', a.soinsLibres, b.soinsLibres],
      ['Patients mineurs distincts', a.patientsMineurs, b.patientsMineurs],
      ['Tiers informé', a.tiers.INFORME, b.tiers.INFORME],
      ['Tiers non informé (refus, absence de tiers, autre motif)', a.tiers.NON, b.tiers.NON],
      ['Tiers impossible à joindre', a.tiers.TENTATIVE, b.tiers.TENTATIVE],
      ['Information du tiers non renseignée', a.tiers.A_RENSEIGNER, b.tiers.A_RENSEIGNER],
      ['Informations du JLD réalisées', a.jld.info, b.jld.info],
      ['Saisines du JLD réalisées', a.jld.saisine, b.jld.saisine],
      ['Décisions du JLD reçues', a.jld.decision, b.jld.decision],
      ['Mainlevées décidées par le JLD', a.jld.levee, b.jld.levee],
      ['Cycles de contrôle avec au moins une communication hors délai', a.jld.cyclesHorsDelai, b.jld.cyclesHorsDelai]
    ];
  }

  function tableau(entetes, lignes) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
      h('thead', {}, h('tr', {}, entetes.map(function (t, i) { return h('th', { class: i ? 'num' : '', text: t }); }))),
      h('tbody', {}, lignes.map(function (l) { return h('tr', {}, l.map(function (c, i) { return h('td', { class: i ? 'num' : '', text: c }); })); }))));
  }

  function graphique(a, b) {
    var NS = 'http://www.w3.org/2000/svg';
    function s(tag, attrs, texte) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (texte != null) e.textContent = texte; return e; }
    var brut = Math.max(1, Math.max.apply(null, a.mois.concat(b.mois).map(function (x) { return x.mesures; })));
    var pas = Math.max(1, Math.ceil(brut / 4)), max = pas * 4;
    var W = 720, Hh = 200, g = 44, bas = 170, larg = (W - g - 10) / 12;
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Mesures par mois, ' + b.annee + ' comparé à ' + a.annee, class: 'graphique' });
    for (var k = 0; k <= 4; k++) {
      var v = pas * k, y = bas - (bas - 20) * k / 4;
      svg.appendChild(s('line', { x1: g, x2: W - 10, y1: y, y2: y, class: 'grille' }));
      svg.appendChild(s('text', { x: g - 6, y: y + 4, 'text-anchor': 'end', class: 'axe' }, String(v)));
    }
    for (var i = 0; i < 12; i++) {
      var x = g + i * larg;
      [[a, 'n1', 0.15], [b, 'n', 0.5]].forEach(function (q) {
        var hgt = (bas - 20) * q[0].mois[i].mesures / max;
        var r = s('rect', { x: x + larg * q[2], y: bas - hgt, width: larg * 0.32, height: Math.max(hgt, 0), class: 'barre-' + q[1], rx: 2 });
        r.appendChild(s('title', {}, MOIS[i] + ' ' + q[0].annee + ' : ' + q[0].mois[i].mesures + ' mesure(s), ' + heures(q[0].mois[i].heures)));
        svg.appendChild(r);
      });
      svg.appendChild(s('text', { x: x + larg / 2, y: bas + 16, 'text-anchor': 'middle', class: 'axe' }, MOIS[i]));
    }
    return h('figure', { class: 'figure' }, svg,
      h('figcaption', {}, h('span', { class: 'puce n1' }), String(a.annee), '  ', h('span', { class: 'puce n' }), String(b.annee), ' — nombre de mesures par mois de début'));
  }

  function exporterCSV(a, b, svs) {
    var lignes = [['Indicateur', String(a.annee), String(b.annee), 'Évolution']];
    lignesRapport(a, b).forEach(function (l) { lignes.push([l[0], l[3](l[1]), l[3](l[2]), evolution(l[1], l[2])]); });
    Object.keys(b.categories).forEach(function (k) { lignes.push(['Catégorie ' + k + ' — ' + M.LIB_CATEGORIES[k], a.categories[k], b.categories[k], evolution(a.categories[k], b.categories[k])]); });
    lignesConformite(a, b).forEach(function (l) { lignes.push([l[0], l[1], l[2], evolution(l[1], l[2])]); });
    U.methode.lignesSequences(a, b).forEach(function (l) { lignes.push(['Séquences — ' + l[0], l[3](l[1]), l[3](l[2]), evolution(l[1], l[2])]); });
    b.mois.forEach(function (m, i) { lignes.push(['Mesures — ' + MOIS[i], a.mois[i].mesures, m.mesures, '']); });
    U.methode.lignesCSV(b.annee).forEach(function (l) { lignes.push(l); });
    // Détail pseudonymisé
    lignes.push([]); lignes.push(['Détail des entrées ' + b.annee + ' (pseudonymisé)']);
 lignes.push(['N°', 'Catégorie', 'Service', 'Début', 'Fin', M.optionsPauses(U.config()).deduireRegistre ? 'Durée hors pauses (h)' : 'Durée (h)', "Mode d'hospitalisation", 'Patient', 'Mineur']);
    var pseudo = {}, k = 0, etat = U.st(), maintenant = Date.now();
    svs.forEach(function (sv) {
      M.registre(etat, sv, b.annee, maintenant).forEach(function (e) {
        if (!pseudo[e.patientId]) pseudo[e.patientId] = 'P' + String(++k).padStart(3, '0');
        lignes.push([e.numero || 'en cours', e.categorie, sv, U.date(e.debut), e.fin ? U.date(e.fin) : 'en cours', e.dureeHeures.toFixed(2).replace('.', ','), e.modeHospi, pseudo[e.patientId], M.estMineur(etat, e.patientId, e.debut) ? 'oui' : 'non']);
      });
    });
    var csv = '﻿' + lignes.map(function (l) { return l.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var lien = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'statistiques_' + (svs.length === 1 ? svs[0] : 'services') + '_' + b.annee + '.csv' });
    document.body.appendChild(lien); lien.click(); lien.remove();
  }

  function modaleSaisie(svs) {
    var etat = U.st(), champs = [];
    var corps = h('div', { class: 'pile' }, h('p', { class: 'muted', text: 'Ces chiffres ne figurent pas dans l’outil : ils sont généralement fournis par le DIM ou le bureau des entrées.' }));
    svs.forEach(function (sv) {
      [annee - 1, annee].forEach(function (an) {
        var x = (etat.saisiesStats[sv] || {})[an] || {};
        var hc = h('input', { type: 'number', min: 0, value: x.hc == null ? '' : x.hc }), ssc = h('input', { type: 'number', min: 0, value: x.ssc == null ? '' : x.ssc });
        var com = h('input', { type: 'text', value: x.commentaire || '', placeholder: 'Commentaire (facultatif)' });
        champs.push({ sv: sv, an: an, hc: hc, ssc: ssc, com: com, avant: x });
        corps.appendChild(h('fieldset', {}, h('legend', { text: U.libService(sv) + ' — ' + an }),
          h('div', { class: 'grille-2' }, h('label', {}, 'Patients en hospitalisation complète', hc), h('label', {}, 'Patients sous contrainte', ssc)), com));
      });
    });
    U.modale('Données annuelles à saisir', corps, [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        for (var i = 0; i < champs.length; i++) {
          var c = champs[i], hc = c.hc.value === '' ? null : +c.hc.value, ssc = c.ssc.value === '' ? null : +c.ssc.value;
          if (hc !== (c.avant.hc == null ? null : c.avant.hc) || ssc !== (c.avant.ssc == null ? null : c.avant.ssc) || c.com.value.trim() !== (c.avant.commentaire || '')) {
            await U.App.session.enregistrer('STATS', { service: c.sv, annee: c.an, hc: hc, ssc: ssc, commentaire: c.com.value.trim() });
          }
        }
        U.toast('Données enregistrées.');
      } }]);
  }

  U.vues.stats = function (maintenant) {
    var svs = servicesChoisis(), etat = U.st();
    var a = M.statistiquesAnnee(etat, svs, annee - 1, maintenant), b = M.statistiquesAnnee(etat, svs, annee, maintenant);
    var champAn = h('input', { type: 'number', min: 2000, max: 2100, value: annee, class: 'champ-court', onchange: function () { annee = +champAn.value || annee; U.rendreContenu(); } });
    var titreSv = svs.length === 1 ? U.libService(svs[0]) : (U.App.service === '*' ? 'Ensemble des services' : '');
    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Statistiques' }), h('div', { class: 'espace' }),
        h('label', {}, 'Année du rapport', champAn),
        U.App.session.peut('STATS') ? h('button', { class: 'btn', onclick: function () { modaleSaisie(svs); } }, 'Saisir patients HC / SSC') : null,
        h('button', { class: 'btn', onclick: function () { U.qualite.modaleRapport(svs, annee); } }, 'Rapport annuel (trame)…'),
        h('button', { class: 'btn', onclick: function () { exporterCSV(a, b, svs); } }, 'Exporter (CSV)'),
        h('button', { class: 'btn', onclick: function () { window.print(); } }, 'Imprimer')),
      h('div', { class: 'seulement-impression' }, h('h2', { text: (U.etablissement() ? U.etablissement() + ' — ' : '') + 'L’isolement et la contention en chiffres — ' + titreSv + ' — ' + annee })),
      h('p', { class: 'muted', text: titreSv + '. Une mesure = une entrée du registre anonymisé terminée, comptée l’année de son début ; une contention en CSI couvre l’isolement qui l’accompagne.' + (b.enCours ? ' ' + b.enCours + ' entrée(s) encore en cours ne sont pas comptées.' : '') + (function () {
        var op = M.optionsPauses(etat.config);
        return op.deduireRegistre ? ' Durées hors levées temporaires (pauses déduites, règle de l’établissement).' : op.active ? ' Durées réelles, levées temporaires comprises.' : '';
      })() }),
      h('section', { class: 'panneau' }, h('h2', { text: 'L’isolement et la contention en chiffres' }),
        tableau(['Indicateur', String(a.annee), String(b.annee), 'Évolution'], lignesRapport(a, b).map(function (l) { return [l[0], l[3](l[1]), l[3](l[2]), evolution(l[1], l[2])]; })),
        b.commentaires.length ? h('p', { class: 'muted', text: 'Commentaire : ' + b.commentaires.join(' ; ') }) : null),
      h('div', { class: 'deux-colonnes' },
        h('section', { class: 'panneau' }, h('h2', { text: 'Répartition par catégorie du registre' }),
          tableau(['Catégorie', String(a.annee), String(b.annee)], Object.keys(b.categories).map(function (k) { return [k + ' — ' + M.LIB_CATEGORIES[k], String(a.categories[k]), String(b.categories[k])]; }))),
        h('section', { class: 'panneau' }, h('h2', { text: 'Suivi réglementaire' }),
          tableau(['', String(a.annee), String(b.annee)], lignesConformite(a, b).map(function (l) { return [l[0], String(l[1]), String(l[2])]; })))),
      U.methode.sectionSequences(a, b),
      U.qualite.sectionsStats(a, b),
      U.methode.sectionMethode(svs, annee, b, false),
      h('section', { class: 'panneau' }, h('h2', { text: 'Répartition mensuelle' }), graphique(a, b)));
  };
})();
