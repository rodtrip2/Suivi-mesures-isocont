// SPDX-License-Identifier: EUPL-1.2
/* Onglet Patients : fiche, cumuls glissants, mode d'hospitalisation et son historique. */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var recherche = '';
  var annee = new Date().getFullYear();
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // Format des durées de l'onglet (préférence de l'agent sur ce poste) : jours et heures, heures, ou les deux
  var FORMATS = [['jh', 'jours et heures'], ['h', 'heures'], ['deux', 'jours et heures (heures)']];
  var format = 'jh';
  try { format = localStorage.getItem('sic-format-duree-patients') || 'jh'; } catch (e) { /* stockage indisponible */ }
  if (!FORMATS.some(function (f) { return f[0] === format; })) format = 'jh';
  function enHeures(heures) {
    if (!isFinite(heures)) return '—';
    var tot = Math.round(Math.abs(heures) * 60), hh = Math.floor(tot / 60), mm = tot % 60;
    return hh + ' h' + (mm ? ' ' + String(mm).padStart(2, '0') : '');
  }
  /** Durée selon le format choisi. */
  function insecable(t) { return String(t).replace(/ /g, '\u00a0'); }
  function fd(heures) {
    if (format === 'h') return insecable(enHeures(heures));
    if (format === 'deux' && heures >= 24) return insecable(U.duree(heures)) + ' ' + insecable('(' + enHeures(heures) + ')');
    return insecable(U.duree(heures));
  }

  function servicesAffiches() {
    return U.App.service === '*' ? U.services().map(function (x) { return x.code; }) : [U.App.service];
  }

  function celluleAnnuelle(c, x) {
    if (!x || !x.n) return h('td', { class: 'col-annuelle muted', text: '0' });
    var nb = c.alerte ? h('span', { class: 'badge bad', title: 'Cette colonne devrait rester à 0.', text: String(x.n) }) : h('b', { text: String(x.n) });
    return h('td', { class: 'col-annuelle' }, nb, h('br'), h('small', { text: fd(x.heures) }), x.enCours ? h('div', {}, h('small', { text: 'dont ' + x.enCours + ' en cours' })) : null);
  }

  function patientsVisibles() {
    var etat = U.st(), miens = U.App.session.mesServices();
    var avecMesure = {};
    M.listeMesures(etat).forEach(function (m) { if (U.dansService(m)) avecMesure[m.patientId] = true; });
    return Object.keys(etat.patients).map(function (k) { return etat.patients[k]; }).filter(function (p) {
      if (avecMesure[p.id]) return true;
      return U.App.service === '*' ? miens.indexOf(p.service) >= 0 : p.service === U.App.service;
    });
  }

  U.vues.patients = function (maintenant) {
    var etat = U.st(), peutModifier = U.App.session.peut('PATIENT');
    var champ = h('input', { type: 'search', placeholder: 'Rechercher (nom, IPP)', value: recherche, class: 'champ-moyen' });
    champ.addEventListener('input', function () { recherche = champ.value; var pos = champ.selectionStart; U.rendreContenu(); var c = document.querySelector('main input[type=search]'); if (c) { c.focus(); c.setSelectionRange(pos, pos); } });
    var q = recherche.trim().toLowerCase();
    var liste = patientsVisibles().filter(function (p) { return !q || ((p.nom || '') + ' ' + (p.prenom || '') + ' ' + (p.ipp || '')).toLowerCase().indexOf(q) >= 0; })
      .map(function (p) {
        var ms = M.listeMesures(etat).filter(function (m) { return m.patientId === p.id; });
        return { p: p, c: M.cumulsPatient(etat, p.id, maintenant), enCours: ms.filter(function (m) { return typeof m.fin !== 'number'; }).length, total: ms.length };
      })
      .sort(function (a, b) { return b.enCours - a.enCours || ({ rouge: 0, jaune: 1, vert: 2 }[a.c.niveau] - { rouge: 0, jaune: 1, vert: 2 }[b.c.niveau]) || (a.p.nom || '').localeCompare(b.p.nom || ''); });

    var niveaux = { rouge: 'bad', jaune: 'warn', vert: 'ok' };
    var stats = M.statistiquesPatients(etat, servicesAffiches(), annee, maintenant);
    var champAn = h('input', { type: 'number', min: 2000, max: 2100, value: annee, class: 'champ-court', 'aria-label': 'Année des statistiques', onchange: function () { annee = +champAn.value || annee; U.rendreContenu(); } });
    var selFormat = h('select', { 'aria-label': 'Format des durées', onchange: function () { format = selFormat.value; try { localStorage.setItem('sic-format-duree-patients', format); } catch (e) { /* */ } U.rendreContenu(); } },
      FORMATS.map(function (f) { return h('option', { value: f[0], text: f[1], selected: f[0] === format }); }));
    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Patients' }), h('div', { class: 'espace' }), h('label', { class: 'en-ligne nowrap' }, 'Statistiques de l’année', champAn), h('label', { class: 'en-ligne nowrap' }, 'Durées en', selFormat), champ),
      (function () {
        var paires = U.cas.pairesProches(patientsVisibles());
        if (!paires.length) return null;
        return h('section', { class: 'panneau' }, h('h2', { text: 'Fiches peut-être en double' }),
          h('ul', { class: 'vigilance' }, paires.map(function (x) {
            return h('li', {}, h('b', { text: U.cas.libFiche(x.a) }), ' et ', h('b', { text: U.cas.libFiche(x.b) }), ' (' + x.raisons.join(', ') + ') ',
              U.App.session.peut('FUSION') ? h('button', { class: 'btn petit', onclick: function () { U.cas.modaleFusion(x.a); } }, 'Fusionner…') : null);
          })),
          h('small', { class: 'muted', text: 'Deux fiches pour un même patient faussent les cumuls des 15 jours et les échéances JLD. La fusion est réservée au cadre de santé.' }));
      })(),
      liste.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'entetes-souples' },
        h('thead', {}, h('tr', {}, ['Patient', 'Service', "Mode d'hospitalisation", 'Isolement 48 h / 15 j', 'Contention 48 h / 15 j', 'Vigilance', 'Mesures'].map(function (t) { return h('th', { text: t }); }),
           h('th', { class: 'col-annuelle', title: 'Toutes les entrées du registre débutées en ' + annee + ' : nombre et durée totale (sans double compte : une contention en chambre de soins intensifs couvre l’isolement qui l’accompagne)' }, 'Total', h('br'), h('small', { text: annee + ' · entrées, durée' })),
           stats.colonnes.map(function (c) { return h('th', { class: 'col-annuelle', title: 'Entrées du registre ' + annee + ' en catégorie ' + c.categories.join(', ') + ' : nombre et durée cumulée' }, c.libelle, h('br'), h('small', { text: annee + ' · ' + c.categories.join(', ') })); }),
           h('th', { class: 'col-annuelle', title: 'Mesures débutées en ' + annee + ', comptées séparément comme le fait le juge' }, 'Mesures (JLD)', h('br'), h('small', { text: annee + ' · isolement / contention' })),
           stats.sequences ? h('th', { class: 'col-annuelle', title: 'Séquences débutées en ' + annee + ' : entrées du registre qui se suivent (' + U.methode.libTol(M.optionsStats(U.config()).toleranceMinutes) + ')' }, 'Séquences', h('br'), h('small', { text: annee })) : null, h('th'))),
        h('tbody', {}, liste.map(function (x) {
          var p = x.p, mode = U.modeActuel(p), depuis = p.modes.length ? p.modes[p.modes.length - 1].date : null;
          return h('tr', { class: x.enCours ? 'en-cours' : '' },
            h('td', { class: 'patient' }, h('b', { text: (p.nom || '?') + ' ' + (p.prenom || '') }), h('br'),
              h('small', { text: 'IPP ' + (p.ipp || '—') + (p.naissance ? ' · né(e) le ' + p.naissance.split('-').reverse().join('/') : '') + (p.protection ? ' · ' + p.protection : '') }), p.detenu ? h('div', {}, h('span', { class: 'badge', text: 'détenu' })) : null),
            h('td', { text: U.libService(p.service) }),
            h('td', {}, mode ? h('span', { class: 'badge ' + (M.estContrainte(U.config(), mode) ? '' : 'warn'), text: mode }) : '—', depuis ? h('div', {}, h('small', { title: 'depuis le ' + U.date(depuis), text: 'depuis le ' + U.date(depuis).slice(0, 10) })) : null),
            h('td', { text: fd(x.c.iso48) + ' / ' + fd(x.c.iso15) }),
            h('td', { text: fd(x.c.cont48) + ' / ' + fd(x.c.cont15) }),
            h('td', {}, h('span', { class: 'badge ' + niveaux[x.c.niveau], title: (function (v) { return 'Rouge : isolement ≥ ' + v.isolementRouge + ' h ou contention ≥ ' + v.contentionRouge + ' h sur 15 jours. Jaune : isolement ≥ ' + v.isolementJaune + ' h ou contention ≥ ' + v.contentionJaune + ' h.'; })(M.optionsVigilance(U.config())), text: x.c.niveau })),
            h('td', { text: x.enCours ? x.enCours + ' en cours / ' + x.total : String(x.total) }),
            (function () { var s = stats.parPatient[p.id]; return s && s.entrees ? h('td', { class: 'col-annuelle' }, h('b', { text: String(s.entrees) }), h('br'), h('b', { text: fd(s.heuresTotal) }), s.enCours ? h('div', {}, h('small', { text: 'dont ' + s.enCours + ' en cours' })) : null) : h('td', { class: 'col-annuelle muted', text: '0' }); })(),
            stats.colonnes.map(function (c, i) { var s = stats.parPatient[p.id]; return celluleAnnuelle(c, s && s.colonnes[i]); }),
            (function () { var s = stats.parPatient[p.id]; return h('td', { class: 'nowrap col-annuelle' }, s ? s.isolements + ' / ' + s.contentions : '0 / 0'); })(),
            stats.sequences ? (function () { var s = stats.parPatient[p.id]; return s && s.sequences ? h('td', { class: 'col-annuelle' }, h('b', { text: String(s.sequences) }), h('br'), h('small', { text: fd(s.heuresSequences) })) : h('td', { class: 'col-annuelle muted', text: '0' }); })() : null,
            h('td', { class: 'actions-ligne' },
              x.total ? h('button', { class: 'btn petit', onclick: function () { modaleMesures(p); } }, 'Mesures') : null, ' ',
              peutModifier ? h('button', { class: 'btn petit', onclick: function () { modaleMode(p); } }, 'Mode') : null, ' ',
              peutModifier ? h('button', { class: 'btn petit', onclick: function () { modaleFiche(p); } }, 'Fiche') : null, ' ',
              U.App.session.peut('FUSION') ? h('button', { class: 'btn petit', title: 'Fusionner avec une autre fiche du même patient', onclick: function () { U.cas.modaleFusion(p); } }, 'Fusionner') : null));
        })))) : h('div', { class: 'panneau vide', text: 'Aucun patient.' }),
      h('p', { class: 'muted' }, h('small', { text: U.lieu('Colonnes de l’année : entrées du registre (une contention en CSI et l’isolement qui l’accompagne forment une seule entrée en catégorie C), comptées l’année de leur début, avec leur durée cumulée ; la dernière colonne compte les mesures comme le juge, l’isolement et la contention séparément. Colonnes paramétrables par l’administrateur.') })),
      h('p', { class: 'muted' }, h('small', { text: 'Cumuls glissants calculés à l’instant, périodes qui se chevauchent comptées une seule fois, remis à zéro après une mainlevée du JLD. Indicateur de charge, non clinique.' })));
  };

  // ------------------------------------------------------------ Fiche : année en graphiques
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, texte) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (texte != null) e.textContent = texte; return e; }
  function courtJour(t) { var d = new Date(t); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /** Heures réparties sur les mois réellement couverts, empilées : isolement seul (A, B) et contention (C, D, E). */
  function graphiqueMois(pr) {
    var brut = Math.max(1, Math.max.apply(null, pr.mois.map(function (m) { return m.iso + m.cont; })));
    var pas = [1, 2, 4, 6, 12, 24, 48, 72, 96, 120, 168, 240, 336, 480, 720].filter(function (x) { return x * 4 >= brut; })[0] || Math.ceil(brut / 4);
    var max = pas * 4, W = 720, Hh = 210, g = 52, bas = 176, larg = (W - g - 10) / 12;
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Heures de mesure par mois en ' + pr.annee, class: 'graphique' });
    for (var k = 0; k <= 4; k++) {
      var y = bas - (bas - 20) * k / 4;
      svg.appendChild(s('line', { x1: g, x2: W - 10, y1: y, y2: y, class: 'grille' }));
      svg.appendChild(s('text', { x: g - 6, y: y + 4, 'text-anchor': 'end', class: 'axe' }, format === 'h' || pas < 24 ? (pas * k) + ' h' : U.duree(pas * k).replace(' 0 h', '')));
    }
    pr.mois.forEach(function (m, i) {
      var x = g + i * larg + larg * 0.18, w = larg * 0.64, hIso = (bas - 20) * m.iso / max, hCont = (bas - 20) * m.cont / max;
      var titre = MOIS[i] + ' ' + pr.annee + ' : ' + fd(m.iso + m.cont) + ' (isolement seul ' + fd(m.iso) + ', contention ' + fd(m.cont) + ')' + (m.n ? ', ' + m.n + ' entrée(s) débutée(s) ce mois-ci' : '');
      if (m.iso) { var r1 = s('rect', { x: x, y: bas - hIso, width: w, height: hIso, class: 'barre-iso', rx: 2 }); r1.appendChild(s('title', {}, titre)); svg.appendChild(r1); }
      if (m.cont) { var r2 = s('rect', { x: x, y: bas - hIso - hCont, width: w, height: hCont, class: 'barre-cont', rx: 2 }); r2.appendChild(s('title', {}, titre)); svg.appendChild(r2); }
      svg.appendChild(s('text', { x: g + i * larg + larg / 2, y: bas + 16, 'text-anchor': 'middle', class: 'axe' }, MOIS[i]));
    });
    return h('figure', { class: 'figure' }, svg,
      h('figcaption', {}, h('span', { class: 'puce iso' }), ' Isolement seul (A, B)  ', h('span', { class: 'puce cont' }), ' Contention (C, D, E) — heures réparties sur les mois réellement couverts'));
  }

  /** Frise de l'année : chaque entrée du registre à sa place dans le temps. */
  function frise(pr) {
    var W = 720, Hh = 70, g = 10, d0 = new Date(pr.annee, 0, 1).getTime(), d1 = new Date(pr.annee + 1, 0, 1).getTime();
    function x(t) { return g + (W - 2 * g) * (Math.min(Math.max(t, d0), d1) - d0) / (d1 - d0); }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Frise des mesures de l’année ' + pr.annee, class: 'graphique frise' });
    svg.appendChild(s('rect', { x: g, y: 14, width: W - 2 * g, height: 26, class: 'frise-fond', rx: 3 }));
    for (var i = 0; i < 12; i++) {
      var xm = x(new Date(pr.annee, i, 1).getTime()), xs = x(new Date(pr.annee, i + 1, 1).getTime());
      svg.appendChild(s('line', { x1: xm, x2: xm, y1: 10, y2: 44, class: 'grille' }));
      svg.appendChild(s('text', { x: (xm + xs) / 2, y: 60, 'text-anchor': 'middle', class: 'axe' }, MOIS[i]));
    }
    pr.entrees.forEach(function (e) {
      var xa = x(e.debut), xb = Math.max(x(e.finAffichee), xa + 2);
      var r = s('rect', { x: xa, y: 16, width: xb - xa, height: 22, class: /[CDE]/.test(e.categorie) ? 'barre-cont' : 'barre-iso', rx: 1 });
      r.appendChild(s('title', {}, (e.numero ? 'N° ' + e.numero + ' — ' : '') + e.categorie + ' — ' + U.lieu(M.LIB_CATEGORIES[e.categorie]) + ' — ' + courtJour(e.debut) + ' → ' + (e.fin === null ? 'en cours' : courtJour(e.fin)) + ' (' + fd(e.dureeHeures) + ')'));
      svg.appendChild(r);
    });
    return h('figure', { class: 'figure' }, svg, h('figcaption', {}, 'Frise de l’année : chaque entrée du registre à sa date (survoler pour le détail).'));
  }

  /** Bloc « Année » de la fiche : totaux, histogramme mensuel et frise, avec choix de l'année. */
  function blocAnnuel(p, maintenant) {
    var an = annee, zone = h('div', { class: 'pile' });
    var svs = U.App.service === '*' ? U.services().map(function (x) { return x.code; }) : [U.App.service];
    function dessiner() {
      var pr = M.profilAnnuelPatient(U.st(), p.id, svs, an, maintenant);
      U.vider(zone);
      zone.appendChild(h('div', { class: 'barre' }, h('h3', { text: 'Année ' + an }), h('div', { class: 'espace' }),
        h('button', { class: 'btn petit', type: 'button', onclick: function () { an--; dessiner(); } }, '◀ ' + (an - 1)),
        h('button', { class: 'btn petit', type: 'button', disabled: an >= new Date(maintenant).getFullYear(), onclick: function () { an++; dessiner(); } }, (an + 1) + ' ▶')));
      if (!pr.entrees.length) { zone.appendChild(h('p', { class: 'muted', text: 'Aucune entrée du registre en ' + an + '.' })); return; }
      // Durée totale en jours et heures et en heures dans la même case (l'unité principale suit le menu « Durées en »)
      var principal = format === 'h' ? enHeures(pr.total) : U.duree(pr.total), autre = format === 'h' ? U.duree(pr.total) : enHeures(pr.total);
      zone.appendChild(h('div', { class: 'grille-3' },
        h('div', { class: 'indicateur' }, h('div', { class: 'valeur' }, insecable(principal), ' ', h('span', { class: 'valeur-sec', text: '(' + insecable(autre) + ')' })), h('div', { class: 'libelle', text: 'Durée totale (' + pr.entrees.filter(function (e) { return e.anneeDebut === an; }).length + ' entrée(s))' })),
        h('div', { class: 'indicateur' }, h('div', { class: 'valeur', text: fd(pr.iso) }), h('div', { class: 'libelle', text: 'Isolement seul (A, B)' })),
        h('div', { class: 'indicateur' }, h('div', { class: 'valeur', text: fd(pr.cont) }), h('div', { class: 'libelle', text: 'Contention (C, D, E)' }))));
      zone.appendChild(graphiqueMois(pr));
      zone.appendChild(frise(pr));
      zone.appendChild(h('small', { class: 'muted', text: 'Entrées du registre des services affichés. Les totaux comptent les entrées débutées dans l’année, comme les statistiques ; l’histogramme et la frise montrent les heures à leur date réelle'
        + (Math.abs(pr.heuresAnnee - pr.total) > 0.02 ? ' (' + fd(pr.heuresAnnee) + ' dans l’année civile ' + an + ', les entrées à cheval sur deux années comptant pour chacune leur part)' : '') + (M.optionsPauses(U.config()).deduireRegistre ? ' ; durées hors pauses.' : ' ; durées réelles, levées temporaires comprises.') }));
    }
    dessiner();
    return zone;
  }

  /** Liste détaillée des mesures d'un patient, et ses entrées du registre. */
  function modaleMesures(p) {
    var etat = U.st(), maintenant = Date.now(), cfg = U.config(), op = M.optionsPauses(cfg);
    var ms = M.listeMesures(etat).filter(function (m) { return m.patientId === p.id && U.dansService(m); }).sort(function (a, b) { return b.debut - a.debut; });
    function ouvrir(fn) { var dlg = document.querySelector('dialog'); if (dlg) dlg.dispatchEvent(new Event('cancel')); setTimeout(fn, 0); }
    var tableMesures = h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Type', 'Service', 'Lieu', 'Début', 'Fin', op.retrancher ? 'Durée (délais JLD)' : 'Durée', 'Pauses', 'Cycle JLD', 'Tiers', ''].map(function (t) { return h('th', { text: t }); }))),
      h('tbody', {}, ms.map(function (m) {
        var enCours = typeof m.fin !== 'number', hp = M.dureePausesHeures(m, maintenant, cfg);
        return h('tr', { class: enCours ? 'en-cours' : '' },
          h('td', {}, U.badgeType(m.type), m.leveeJLD ? h('div', {}, h('span', { class: 'badge bad', text: 'Levée JLD' })) : null, U.badgePause(m, maintenant) ? h('div', {}, U.badgePause(m, maintenant)) : null),
          h('td', { text: U.libService(m.service) }),
          h('td', { text: m.lieu || (m.csi ? U.lieu('CSI') : U.lieu('Hors CSI')) }),
          h('td', { class: 'nowrap' }, U.date(m.debut), h('br'), h('small', { text: m.psychiatreDebut || '' })),
          h('td', { class: 'nowrap' }, enCours ? h('b', { text: 'en cours' }) : U.date(m.fin), enCours ? null : h('br'), enCours ? null : h('small', { text: (m.psychiatreFin || '') + (m.motifFin ? ' — ' + m.motifFin : '') })),
          h('td', { class: 'nowrap', text: fd(M.dureeHeures(m, maintenant, cfg)) }),
          h('td', { class: 'nowrap', text: (m.pauses || []).length ? m.pauses.length + ' — ' + fd(hp) + (op.retrancher ? ' (déduites)' : '') : '—' }),
          h('td', { text: String(m.cycle) }),
          h('td', {}, U.tiersBadge(m)),
          h('td', { class: 'actions-ligne' },
            h('button', { class: 'btn petit', onclick: function () { ouvrir(function () { U.detailMesure(m); }); } }, 'Détail'), ' ',
            U.actions.decompte && U.App.session.peut('JLD') ? h('button', { class: 'btn petit', onclick: function () { ouvrir(function () { U.actions.decompte(m); }); } }, 'Décompte') : null));
      }))));
    // Entrées du registre (toutes années, services visibles)
    var entrees = [], vus = {};
    ms.forEach(function (m) { var an = new Date(m.debut).getFullYear(), cle = m.service + '|' + an; if (!vus[cle]) { vus[cle] = 1; entrees = entrees.concat(M.registre(etat, m.service, an, maintenant).filter(function (e) { return e.patientId === p.id; })); } });
    entrees.sort(function (a, b) { return a.debut - b.debut; });
    var tableRegistre = entrees.length ? h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['N° registre', 'Catégorie', 'Début', 'Fin', op.deduireRegistre ? 'Durée hors pauses' : 'Durée'].map(function (t) { return h('th', { text: t }); }))),
      h('tbody', {}, entrees.map(function (e) {
        return h('tr', { class: e.fin === null ? 'en-cours' : '' },
          h('td', {}, e.numero ? h('b', { text: e.numero }) : h('small', { text: 'en cours' })),
          h('td', { title: U.lieu(M.LIB_CATEGORIES[e.categorie]), text: e.categorie + ' — ' + U.lieu(M.LIB_CATEGORIES[e.categorie]) }),
          h('td', { class: 'nowrap', text: U.date(e.debut) }),
          h('td', { class: 'nowrap', text: e.fin ? U.date(e.fin) : 'en cours' }),
          h('td', { class: 'nowrap', text: fd(e.dureeHeures) }));
      })))) : h('p', { class: 'muted', text: 'Aucune entrée.' });
    var c = M.cumulsPatient(etat, p.id, maintenant);
    U.modale('Mesures — ' + (p.nom || '') + ' ' + (p.prenom || ''), h('div', { class: 'pile' },
      h('div', { class: 'recap' },
        h('div', { text: 'IPP ' + (p.ipp || '—') + (p.naissance ? ' · né(e) le ' + p.naissance.split('-').reverse().join('/') : '') + ' · ' + (U.modeActuel(p) || 'mode non renseigné') }),
        h('div', { text: 'Cumuls glissants : isolement ' + fd(c.iso48) + ' sur 48 h, ' + fd(c.iso15) + ' sur 15 jours ; contention ' + fd(c.cont48) + ' sur 48 h, ' + fd(c.cont15) + ' sur 15 jours.' })),
      blocAnnuel(p, maintenant),
      h('h3', { text: ms.length + ' mesure(s) — comptées comme le juge, isolement et contention séparément' }),
      tableMesures,
      h('h3', { text: 'Entrées du registre' }),
      h('p', { class: 'muted' }, h('small', { text: U.lieu('Une contention en CSI et l’isolement qui l’accompagne forment une seule entrée C ; les portions d’isolement avant et après la contention forment des entrées A.') + (op.deduireRegistre ? (op.contentionSeule === 'isolement' ? ' Pauses déduites : une pause de la contention pendant laquelle l’isolement continue forme une entrée A.' : ' Pauses déduites : une pause de la contention seule reste dans l’entrée C.') : '') })),
      tableRegistre), [{ texte: 'Fermer' },
      U.App.session.peut('EXPORT_PATIENT') || U.App.session.peut('CONFIG') ? { texte: 'Exporter ses données (droit d’accès)', action: function () { U.qualite.exporterPatient(p); return false; } } : null].filter(Boolean), { large: true });
  }

  function modaleFiche(p) {
    var ipp = h('input', { type: 'text', value: p.ipp || '' });
    var nom = h('input', { type: 'text', value: p.nom || '' }), prenom = h('input', { type: 'text', value: p.prenom || '' });
    var naissance = h('input', { type: 'date', value: p.naissance || '' });
    var protection = h('input', { type: 'text', value: p.protection || '', placeholder: 'ex. Curatelle renforcée' });
    var detenu = h('input', { type: 'checkbox', checked: !!p.detenu });
    var sv = h('select', {}, U.services().map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: x.code === p.service }); }));
    U.modale('Fiche patient', h('div', { class: 'pile' },
      h('div', { class: 'grille-2' }, h('label', {}, 'IPP', ipp), h('label', {}, 'Service', sv)),
      h('div', { class: 'grille-2' }, h('label', {}, 'Nom', nom), h('label', {}, 'Prénom', prenom)),
      h('div', { class: 'grille-2' }, h('label', {}, 'Date de naissance', naissance), h('label', {}, 'Mesure de protection juridique', protection)),
      h('label', { class: 'case' }, detenu, h('span', { text: 'Patient détenu' })),
      h('small', { class: 'muted', text: 'Une mesure garde le nom affiché au moment de sa création dans le journal ; les écrans utilisent la fiche à jour.' })), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        if (!nom.value.trim()) throw new Error('Le nom est obligatoire.');
        var d = { patientId: p.id }, ch = 0;
        [['ipp', ipp.value.trim()], ['nom', nom.value.trim().toUpperCase()], ['prenom', prenom.value.trim()], ['naissance', naissance.value], ['protection', protection.value.trim()], ['service', sv.value]].forEach(function (x) {
          if ((p[x[0]] || '') !== x[1]) { d[x[0]] = x[1]; ch++; }
        });
        if (!!p.detenu !== detenu.checked) { d.detenu = detenu.checked; ch++; }
        if (!ch) return true;
        await U.App.session.enregistrer('PATIENT', d);
        U.toast('Fiche mise à jour.');
      } }]);
  }

  function modaleMode(p) {
    var etat = U.st();
    var sel = h('select', {}, (U.config().modesHospitalisation || []).map(function (x) { return h('option', { value: x.code, text: x.code + ' — ' + x.libelle, selected: x.code === U.modeActuel(p) }); }));
    var quand = h('input', { type: 'datetime-local', value: U.versSaisie(Date.now()) });
    var peutAnnuler = U.App.session.peut('ANNULATION');
    var hist = p.modes.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, p.modes.slice().reverse().map(function (x) {
      return h('tr', {}, h('td', { class: 'nowrap', text: U.date(x.date) }), h('td', {}, h('b', { text: x.mode })), h('td', { text: U.App.session.nomAuteur(x.by) }),
        h('td', { class: 'actions-ligne' }, peutAnnuler && p.modes.length > 1 ? h('button', { class: 'btn petit', onclick: async function () {
          var motif = prompt('Motif de la suppression de ce changement :');
          if (!motif) return;
          await U.App.session.enregistrer('ANNULATION', { cible: x.evt, motif: motif });
          U.toast('Changement annulé.');
          var dlg = document.querySelector('dialog'); if (dlg) dlg.dispatchEvent(new Event('cancel'));
        } }, 'Supprimer') : null));
    })))) : h('p', { class: 'muted', text: 'Aucun mode enregistré.' });
    U.modale("Mode d'hospitalisation — " + (p.nom || '') + ' ' + (p.prenom || ''), h('div', { class: 'pile' },
      h('h3', { text: 'Historique' }), hist,
      h('h3', { text: 'Enregistrer un changement' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Nouveau mode', sel), h('label', {}, 'À compter du', quand)),
      h('small', { class: 'muted', text: 'Un changement rétroactif est possible : le registre retient le mode en vigueur au début de chaque mesure (ou le nouveau mode s’il intervient dans les ' + (U.config().delaiModeHospiHeures || 12) + ' h suivant un début en soins libres).' })), [
      { texte: 'Fermer' },
      { texte: 'Enregistrer le changement', classe: 'primaire', action: async function () {
        var t = U.depuisSaisie(quand.value);
        if (t > Date.now() + 10 * 60000) throw new Error('La date ne peut pas être dans le futur.');
        if (M.modeA(etat, p.id, t) === sel.value) throw new Error('Le patient est déjà en ' + sel.value + ' à cette date.');
        await U.App.session.enregistrer('MODE_HOSPI', { patientId: p.id, mode: sel.value, date: t });
        U.toast("Mode d'hospitalisation enregistré.");
      } }]);
  }
})();
