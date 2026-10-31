// SPDX-License-Identifier: EUPL-1.2
/*
 * Reprise de données (administrateur). Deux sources : le registre du service, quel que soit l'outil
 * d'origine (modèle générique, colonnes à faire correspondre), ou le classeur Excel V1.3.
 * Le fichier est lu dans le navigateur.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var I = function () { return SIC.importV13; };

  var LIB_ACTION = { creer: 'Créer ce service', rattacher: 'Rattacher à un service existant', ignorer: 'Ignorer' };

  U.actions.importerRegistre = function () { U.actions.importer('registre'); };

  U.actions.importer = function (source) {
    var registre = source === 'registre', IR = function () { return SIC.importRegistre; };
    var fichier = h('input', { type: 'file', accept: registre ? '.csv,.txt,.xlsx,.xlsm' : '.xlsx,.xlsm' });
    var zone = h('div', { class: 'pile' });
    // Registre : feuille, ligne d'en-tête et correspondance des colonnes
    var table = null, classeurReg = null, zoneColonnes = h('div', { class: 'pile' });
    var prep = null, cases = [], classeur = null, choixServices = {}, champsCompteurs = [], dernierControle = null, modeNum = 'conserver';
    var decisions = {}, corrections = {};   // par référence du classeur (M0003…) : décision de numérotation, correction des données
    var anneeCourante = new Date().getFullYear();
    function figeChoisi() { return prep ? I().figeSelon(prep, modeNum, anneeCourante) : {}; }
    function estFigeLigne(c) { var f = figeChoisi(); return !!(f[c.service] && f[c.service][c.annee]); }
    var svDefaut = h('select', {}, h('option', { value: '', text: registre ? 'Premier service de l’outil' : 'Service actif du classeur (recommandé)' }), U.tousServices().map(function (x) { return h('option', { value: x.code, text: x.libelle }); }));

    async function lire() {
      classeur = null; table = null; classeurReg = null; choixServices = {}; decisions = {}; corrections = {};
      U.vider(zone); U.vider(zoneColonnes);
      if (!fichier.files[0]) return;
      zone.appendChild(h('div', { class: 'info', text: 'Lecture du fichier…' }));
      try {
        var f = fichier.files[0];
        if (!registre) classeur = await SIC.xlsx.lire(await f.arrayBuffer());
        else if (/\.(csv|txt)$/i.test(f.name)) {
          var octets = new Uint8Array(await f.arrayBuffer()), texte;
          try { texte = new TextDecoder('utf-8', { fatal: true }).decode(octets); } catch (e) { texte = new TextDecoder('windows-1252').decode(octets); }
          choisirTable(IR().lireCSV(texte));
        } else {
          classeurReg = await SIC.xlsx.lire(await f.arrayBuffer());
          choisirTable(classeurReg.feuilles[Object.keys(classeurReg.feuilles)[0]] || [], Object.keys(classeurReg.feuilles)[0]);
        }
      } catch (e) { U.vider(zone); zone.appendChild(h('div', { class: 'erreur', text: e.message })); return; }
      analyser();
    }

    /** Registre : table lue, correspondances proposées, et écran de correspondance des colonnes. */
    function choisirTable(lignes, feuille) {
      var g = IR().deviner(lignes);
      table = { lignes: lignes, ligneEntete: g.ligneEntete, correspondance: g.correspondance, feuille: feuille };
      dessinerColonnes();
    }
    function dessinerColonnes() {
      U.vider(zoneColonnes);
      if (!table) return;
      var entetes = (table.lignes[table.ligneEntete] || []).map(function (x) { return x == null ? '' : String(x).trim(); });
      var exemple = table.lignes[table.ligneEntete + 1] || [];
      if (classeurReg && Object.keys(classeurReg.feuilles).length > 1) {
        var selF = h('select', {}, Object.keys(classeurReg.feuilles).map(function (n) { return h('option', { value: n, text: n, selected: n === table.feuille }); }));
        selF.addEventListener('change', function () { choisirTable(classeurReg.feuilles[selF.value] || [], selF.value); analyser(); });
        zoneColonnes.appendChild(h('label', {}, 'Feuille du classeur contenant le registre', selF));
      }
      var ligneEnt = h('input', { type: 'number', min: 1, max: Math.max(1, table.lignes.length), value: table.ligneEntete + 1, class: 'champ-court' });
      ligneEnt.addEventListener('change', function () { var g = IR().deviner(table.lignes.slice(Math.max(0, +ligneEnt.value - 1))); table.ligneEntete = Math.max(0, +ligneEnt.value - 1); table.correspondance = g.correspondance; dessinerColonnes(); analyser(); });
      zoneColonnes.appendChild(h('h3', { text: 'Colonnes du registre' }));
      zoneColonnes.appendChild(h('p', { class: 'muted' }, h('small', { text: 'Indiquez quelle colonne de votre fichier correspond à chaque donnée du registre (les correspondances évidentes sont proposées). Les champs marqués * sont indispensables ; le type de mesure peut être déduit de la catégorie ou du numéro (A12…). Les colonnes inutiles sont ignorées.' })));
      zoneColonnes.appendChild(h('label', { class: 'en-ligne' }, 'Ligne des en-têtes', ligneEnt));
      zoneColonnes.appendChild(h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Donnée', 'Colonne de votre fichier', 'Exemple (1re ligne)'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, IR().CHAMPS.map(function (c) {
          var sel = h('select', { 'aria-label': 'Colonne pour ' + c.libelle }, h('option', { value: '', text: '— non utilisée —' }),
            entetes.map(function (e, j) { return h('option', { value: String(j), text: (e || 'colonne ' + (j + 1)), selected: table.correspondance[c.cle] === j }); }));
          var ex = h('small', { class: 'muted', text: table.correspondance[c.cle] != null ? String(exemple[table.correspondance[c.cle]] == null ? '' : exemple[table.correspondance[c.cle]]) : '' });
          sel.addEventListener('change', function () { if (sel.value === '') delete table.correspondance[c.cle]; else table.correspondance[c.cle] = +sel.value; ex.textContent = sel.value === '' ? '' : String(exemple[+sel.value] == null ? '' : exemple[+sel.value]); analyser(); });
          return h('tr', {}, h('td', {}, h('b', { text: c.libelle + (c.obligatoire ? ' *' : '') }), c.aide ? h('div', {}, h('small', { class: 'muted', text: c.aide })) : null), h('td', {}, sel), h('td', {}, ex));
        })))));
    }

    function compteursChoisis() {
      var r = {};
      champsCompteurs.forEach(function (x) { r[x.c.service] = r[x.c.service] || {}; r[x.c.service][x.c.annee] = Math.max(0, +x.champ.value || 0); });
      return r;
    }

    function analyser() {
      prep = null; cases = []; champsCompteurs = [];
      U.vider(zone);
      if (!classeur && !table) return;
      var opts = { serviceParDefaut: svDefaut.value || undefined, services: choixServices, corrections: corrections };
      try { prep = registre ? IR().preparer(table, U.st(), opts) : I().preparer(classeur, U.st(), opts); }
      catch (e) { zone.appendChild(h('div', { class: 'erreur', text: e.message })); return; }
      prep.evtsExistants = U.App.session.evts;   // simulations complètes : mesures déjà présentes dans l'outil comprises
      var r = prep.rapport;
      zone.appendChild(h('div', { class: 'recap' },
        registre ? h('div', { text: r.entrees + ' ligne(s) du registre lue(s) ; les mesures sont reconstituées à partir des entrées (une contention en CSI implique l’isolement qui l’accompagne, les portions d’isolement contiguës forment une seule mesure).' }) : null,
        h('div', {}, h('b', { text: r.mesures + ' mesure(s)' }), ' à importer' + (r.dejaPresentes ? ', ' + r.dejaPresentes + ' déjà présente(s) (ignorées)' : '') + '.'),
        h('div', { text: r.patients + ' nouveau(x) patient(s), ' + r.modes + " mode(s) d'hospitalisation, " + r.tiers + ' information(s) de tiers, ' + r.cycles + ' décision(s) de maintien du JLD, ' + r.professionnels + ' professionnel(s) en CSI.' })));

      // -- Services absents de l'outil
      if (r.services.length) {
        var existants = U.tousServices();
        zone.appendChild(h('h3', { text: 'Services du classeur absents de l’outil' }));
        zone.appendChild(h('p', { class: 'muted' }, h('small', { text: 'Créez-les, ou rattachez-les à un service existant : leurs patients, mesures, chambres, postes, masques et compteurs y seront alors repris. Un service qui porte des données ne peut pas être ignoré.' })));
        zone.appendChild(h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Code', 'Libellé', 'Cité dans', 'Choix'].map(function (t) { return h('th', { text: t }); }))),
          h('tbody', {}, r.services.map(function (s) {
            var lib = h('input', { type: 'text', value: s.libelle, disabled: s.action !== 'creer', onchange: function () { choixServices[s.code] = Object.assign({}, choixServices[s.code], { action: 'creer', libelle: lib.value.trim() }); analyser(); } });
            var action = h('select', {}, Object.keys(LIB_ACTION).filter(function (a) { return (a !== 'ignorer' || !s.total) && (a !== 'rattacher' || existants.length); }).map(function (a) { return h('option', { value: a, text: LIB_ACTION[a], selected: a === s.action }); }));
            var vers = h('select', { hidden: s.action !== 'rattacher' }, existants.map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: x.code === s.vers }); }));
            function maj() { choixServices[s.code] = { action: action.value, vers: vers.value, libelle: lib.value.trim() }; analyser(); }
            action.addEventListener('change', maj); vers.addEventListener('change', maj);
            return h('tr', {},
              h('td', {}, h('b', { text: s.code }), s.actif ? null : h('div', {}, h('small', { class: 'muted', text: 'inactif dans le classeur' }))),
              h('td', {}, lib),
              h('td', {}, h('small', { text: Object.keys(s.references).map(function (k) { return k + (k === 'paramétrage des services' ? '' : ' (' + s.references[k] + ')'); }).join(', ') })),
              h('td', {}, h('div', { class: 'pile' }, action, vers)));
          })))));
      }

      // -- Paramétrage
      if (prep.config.length) {
        zone.appendChild(h('h3', { text: 'Paramétrage trouvé dans le classeur' }));
        prep.config.forEach(function (c) {
          var cb = h('input', { type: 'checkbox', checked: true });
          cases.push({ cb: cb, c: c });
          zone.appendChild(h('label', { class: 'case' }, cb, h('span', { text: c.libelle })));
        });
      }

      // -- Compteurs du registre et contrôle de la numérotation
      var controle = h('div', { class: 'pile' }), impact = h('div', { class: 'pile' });
      if (prep.anneesNumerotees.length) {
        var annees = prep.anneesNumerotees.map(function (x) { return U.libService(x.service) + ' ' + x.annee + ' (' + x.mesures + ' mesure(s) numérotée(s))'; }).join(', ');
        var radio = function (v, titre, texte) {
          var r = h('input', { type: 'radio', name: 'mode-numerotation', value: v, checked: modeNum === v, onchange: function () { modeNum = v; majCompteurs(); majControle(); majImpact(); avertTout.hidden = v !== 'tout'; } });
          return h('label', { class: 'case' }, r, h('span', {}, h('b', { text: titre }), ' — ', texte));
        };
        var avertTout = h('div', { class: 'alerte', hidden: modeNum !== 'tout', text: 'Attention : toutes les années importées seront renumérotées selon les règles de l’outil. Les numéros, les catégories et le nombre d’entrées du registre des années passées peuvent changer, et avec eux les statistiques et rapports déjà produits (rapports annuels, réponses aux instances). Ne choisissez cette option qu’après accord de la direction.' });
        zone.appendChild(h('h3', { text: 'Numérotation du registre : mesures déjà numérotées dans le classeur' }));
        zone.appendChild(h('p', { class: 'muted' }, h('small', { text: 'Années concernées : ' + annees + '. En cas d’écart entre les mesures et les entrées du registre du classeur, choisissez :' })));
        zone.appendChild(h('div', { class: 'choix-portee' },
          radio('conserver', 'Laisser tel quel', 'les mesures importées gardent la catégorie et le numéro du classeur (une entrée par mesure) ; les règles de l’outil s’appliquent aux mesures suivantes, numérotées à la suite.'),
          radio('annee', 'Recalculer l’année en cours (' + anneeCourante + ')', 'les années antérieures gardent la numérotation du classeur ; les entrées de ' + anneeCourante + ' sont recalculées selon les règles de l’outil.'),
          radio('tout', 'Recalculer toutes les années', 'toutes les entrées importées sont recalculées selon les règles de l’outil.'),
          avertTout,
          h('small', { class: 'muted', text: 'Ce choix reste modifiable ensuite, année par année, dans Administration → Registre.' })));
      }
      function majCompteurs() {
        champsCompteurs.forEach(function (x) { x.champ.value = estFigeLigne(x.c) ? x.c.dernier : x.c.propose; x.note.textContent = estFigeLigne(x.c) ? 'numérotation du classeur conservée : l’outil reprendra après ' + x.c.dernier : ''; });
      }
      if (prep.compteurs.length) {
        zone.appendChild(h('h3', { text: 'Numérotation du registre' }));
        zone.appendChild(h('p', { class: 'muted' }, h('small', { text: 'Compteur : dernier numéro utilisé avant l’outil. L’outil numérote ensuite lui-même les entrées des mesures importées, dans l’ordre de leur fin. Proposition : dernier numéro du classeur moins les entrées numérotées que l’outil attribuera aux mesures importées (une mesure peut former plusieurs entrées : A, C, A). Modifiez-la si besoin : le contrôle ci-dessous se met à jour.' })));
        zone.appendChild(h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Service', 'Année', 'Dernier n° du classeur', 'Mesures numérotées importées', 'Entrées numérotées par l’outil', 'Compteur'].map(function (t) { return h('th', { text: t }); }))),
          h('tbody', {}, prep.compteurs.map(function (c) {
            var champ = h('input', { type: 'number', min: 0, step: 1, value: estFigeLigne(c) ? c.dernier : c.propose, class: 'champ-court', 'aria-label': 'Compteur ' + c.service + ' ' + c.annee });
            var note = h('small', { class: 'muted', text: estFigeLigne(c) ? 'numérotation du classeur conservée : l’outil reprendra après ' + c.dernier : '' });
            champ.addEventListener('input', function () { majControle(); majImpact(); });
            champsCompteurs.push({ c: c, champ: champ, note: note });
            return h('tr', {},
              h('td', { text: U.libService(c.service) }), h('td', { text: String(c.annee) }), h('td', { text: String(c.dernier) }),
              h('td', { text: String(c.mesuresNumerotees) }), h('td', { text: String(c.entreesNumerotees) }),
              h('td', {}, champ, h('div', {}, note), c.existantes ? h('div', {}, h('small', { class: 'alerte-champ', text: 'L’outil contient déjà des mesures de cette année pour ce service : la numérotation importée s’intercalera avec elles.' })) : null));
          })))));
        zone.appendChild(controle);
      }
      if (prep.anneesNumerotees.length) zone.appendChild(impact);

      /** Compteurs retenus pour un choix : ceux saisis pour le choix en cours, la proposition pour les autres. */
      function compteursPar(mo) {
        var saisis = compteursChoisis(), f = I().figeSelon(prep, mo, anneeCourante), r = {};
        champsCompteurs.forEach(function (x) {
          var c = x.c, fige = !!(f[c.service] && f[c.service][c.annee]);
          r[c.service] = r[c.service] || {};
          r[c.service][c.annee] = mo === modeNum ? saisis[c.service][c.annee] : (fige ? c.dernier : c.propose);
        });
        return r;
      }
      var LIB_MODES = { conserver: 'Laisser tel quel', annee: 'Recalculer ' + anneeCourante, tout: 'Recalculer tout' };
      function majImpact() {
        setTimeout(adapterLibelles, 0);
        U.vider(impact);
        if (!prep.anneesNumerotees.length) return;
        var res;
        try { res = I().impactNumerotation(prep, compteursPar, anneeCourante, decisions); } catch (e) { impact.appendChild(h('div', { class: 'erreur', text: 'Simulation impossible : ' + e.message })); return; }
        var modes = ['conserver', 'annee', 'tout'];
        var det = h('details', { open: true, class: 'impact-import' }, h('summary', {}, h('b', { text: 'Impact sur le registre et les statistiques, avant import' })),
          h('p', { class: 'muted' }, h('small', { text: 'Simulation de l’import selon chaque choix, mesures déjà présentes dans l’outil comprises. Les valeurs qui diffèrent de « Laisser tel quel » sont surlignées ; la colonne du choix retenu est encadrée. Les durées sont celles des entrées terminées.' })));
        res.forEach(function (r) {
          var lignes = [
            ['Entrées du registre terminées', function (x) { return x.entrees; }, String],
            ['Entrées en cours', function (x) { return x.enCours; }, String]
          ].concat(['A', 'B', 'C', 'D', 'E'].map(function (k) { return ['Catégorie ' + k + ' — ' + M.LIB_CATEGORIES[k] + ' : entrées', function (x) { return x.categories[k]; }, String]; }),
            ['A', 'B', 'C', 'D', 'E'].map(function (k) { return ['Catégorie ' + k + ' : durée cumulée', function (x) { return Math.round(x.dureeCategories[k] * 60); }, function (v) { return U.duree(v / 60); }]; }), [
            ['Durée cumulée', function (x) { return Math.round(x.dureeTotale * 60); }, function (v) { return U.duree(v / 60); }],
            ['Durée moyenne d’une entrée', function (x) { return x.dureeMoyenne == null ? null : Math.round(x.dureeMoyenne * 60); }, function (v) { return v == null ? '—' : U.duree(v / 60); }],
            ['Heures d’utilisation de la CSI', function (x) { return Math.round(x.heuresCSI * 60); }, function (v) { return U.duree(v / 60); }],
            ['Patients distincts', function (x) { return x.patients; }, String],
            ['Numéros attribués', function (x) { return x.numeros.join(', '); }, function (v) { return v || '—'; }]
          ]);
          det.appendChild(h('h4', { text: U.libService(r.service) + ' — ' + r.annee }));
          det.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table-impact' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Indicateur' }), modes.map(function (mo) { return h('th', { class: mo === modeNum ? 'choisi' : null, text: LIB_MODES[mo] }); }))),
            h('tbody', {}, lignes.map(function (l) {
              var ref = l[1](r.modes.conserver);
              return h('tr', {}, h('td', { text: l[0] }), modes.map(function (mo) {
                var v = l[1](r.modes[mo]);
                return h('td', { class: [mo === modeNum ? 'choisi' : '', v !== ref ? 'diff' : ''].join(' ').trim() || null, text: l[2](v) });
              }));
            })))));
        });
        /** Décision de numérotation et correction des données, pour une mesure importée du classeur. */
        function celluleDecision(d) {
          if (!d.ref) return h('small', { class: 'muted', text: 'Mesure déjà présente : sa numérotation suit celle des autres.' });
          var bloc = h('div', { class: 'pile decision-mesure' });
          if (d.numeroOrigine) {
            var sel = h('select', { 'aria-label': 'Décision ' + d.ref },
              h('option', { value: '', text: 'Suivre le choix général', selected: !decisions[d.ref] }),
              h('option', { value: 'classeur', text: 'Garder le n° du classeur (' + d.numeroOrigine + ')', selected: decisions[d.ref] === 'classeur' }),
              h('option', { value: 'outil', text: 'Appliquer la règle de l’outil', selected: decisions[d.ref] === 'outil' }));
            sel.addEventListener('change', function () { if (sel.value) decisions[d.ref] = sel.value; else delete decisions[d.ref]; majControle(); majImpact(); });
            bloc.appendChild(sel);
          }
          // Correction des données qui déterminent la catégorie (lieu CSI ou non, exception)
          var c = corrections[d.ref] || {};
          var lieu = h('select', { 'aria-label': 'Lieu ' + d.ref }, h('option', { value: 'csi', text: 'En CSI', selected: d.csi }), h('option', { value: 'hors', text: 'Hors CSI', selected: !d.csi }));
          var exc = h('input', { type: 'checkbox', checked: !!d.exception, 'aria-label': 'Exception ' + d.ref });
          var excLbl = d.type === 'Contention' ? h('label', { class: 'case', hidden: d.csi }, exc, h('span', { text: 'Exception prévue (contention hors espace d’isolement)' })) : null;
          lieu.addEventListener('change', function () { if (excLbl) excLbl.hidden = lieu.value === 'csi'; });
          var appliquer = h('button', { type: 'button', class: 'btn petit', onclick: function () {
            corrections[d.ref] = { csi: lieu.value === 'csi' };
            if (d.type === 'Contention') corrections[d.ref].exception = lieu.value === 'csi' ? false : exc.checked;
            analyser();
          } }, 'Appliquer la correction');
          var annuler = Object.keys(c).length ? h('button', { type: 'button', class: 'btn petit', onclick: function () { delete corrections[d.ref]; analyser(); } }, 'Annuler la correction') : null;
          bloc.appendChild(h('details', { open: !!Object.keys(c).length }, h('summary', { text: 'Corriger les données de la mesure' }),
            h('div', { class: 'pile' }, h('label', {}, 'Lieu', lieu), excLbl, h('div', { class: 'actions' }, appliquer, annuler),
              h('small', { class: 'muted', text: 'La correction est enregistrée avec la mesure importée et tracée au journal ; le classeur n’est pas modifié.' }))));
          return bloc;
        }

        // Détail des mesures modifiées : entrées du registre de chaque mesure selon chaque choix
        var court = function (t) { return t == null ? 'en cours' : U.date(t); };
        var texteEntrees = function (l) { return (l || []).map(function (e) { return (e.numero || 'en cours') + ' (' + e.categorie + ') · ' + court(e.debut) + ' → ' + court(e.fin) + ' · ' + U.duree(e.duree); }); };
        res.forEach(function (r) {
          det.appendChild(h('h4', { text: 'Mesures modifiées — ' + U.libService(r.service) + ' ' + r.annee + ' (' + r.mesures.length + ')' }));
          if (!r.mesures.length) { det.appendChild(h('p', { class: 'muted', text: 'Aucune : les trois choix donnent les mêmes entrées.' })); return; }
          det.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table-impact' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Mesure' }), modes.map(function (mo) { return h('th', { class: mo === modeNum ? 'choisi' : null, text: LIB_MODES[mo] }); }), h('th', { text: 'Décision pour cette mesure' }))),
            h('tbody', {}, r.mesures.map(function (d) {
              var ref = JSON.stringify(texteEntrees(d.modes.conserver));
              return h('tr', {},
                h('td', {}, h('b', { text: d.patient || '—' }), h('br'), h('small', { text: d.type + ' du ' + U.date(d.debut) + (d.fin ? ' au ' + U.date(d.fin) : ' (en cours)') + ' — ' + (d.lieu || (d.csi ? 'CSI' : 'hors CSI')) }), h('br'),
                  h('small', { class: 'muted', text: d.importee ? 'importée' + (d.origine ? ' (' + d.origine + ')' : '') + (d.numeroOrigine ? ', n° ' + d.numeroOrigine + ' dans le classeur' : '') : 'déjà présente dans l’outil' }),
                  d.correction ? h('div', {}, h('small', { class: 'badge warn', text: d.correction })) : null),
                modes.map(function (mo) {
                  var t = texteEntrees(d.modes[mo]), pq = d.pourquoi[mo] || [];
                  return h('td', { class: [mo === modeNum ? 'choisi' : '', JSON.stringify(t) !== ref ? 'diff' : ''].join(' ').trim() || null },
                    t.length ? t.map(function (x, i) { return h('div', { class: 'entree-impact' }, h('div', { text: x }), pq[i] ? h('small', { class: 'pourquoi', text: pq[i] }) : null); }) : '—');
                }),
                h('td', {}, celluleDecision(d)));
            })))));
        });
        impact.appendChild(det);
      }
      function majControle() {
        setTimeout(adapterLibelles, 0);
        U.vider(controle);
        dernierControle = I().controleNumeros(prep, compteursChoisis(), figeChoisi(), decisions);
        var c = dernierControle;
        if (!c.verifiees && !c.ecarts.length) { controle.appendChild(h('div', { class: 'info', text: 'Aucune mesure numérotée dans le classeur : pas de contrôle possible.' })); return; }
        if (!c.ecarts.length) { controle.appendChild(h('div', { class: 'info', text: 'Contrôle de la numérotation : les ' + c.verifiees + ' numéro(s) du classeur sont retrouvés à l’identique.' })); return; }
        controle.appendChild(h('div', { class: 'alerte', text: 'Contrôle de la numérotation : ' + c.verifiees + ' numéro(s) retrouvé(s), ' + c.ecarts.length + ' écart(s). Vérifiez le compteur, ou acceptez la numérotation de l’outil (elle suit les règles du registre : catégories A à E, une contention en CSI et son isolement formant une entrée C).' }));
        controle.appendChild(h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Mesure du classeur', 'N° du classeur', 'N° dans l’outil', 'Écart'].map(function (t) { return h('th', { text: t }); }))),
          h('tbody', {}, c.ecarts.map(function (e) { return h('tr', {}, h('td', { text: e.ref }), h('td', { text: e.classeur }), h('td', { text: e.outil }), h('td', { text: e.motif })); })))));
      }
      majControle();
      majImpact();

      if (r.ignorees.length) zone.appendChild(h('details', {}, h('summary', { text: r.ignorees.length + ' ligne(s) ignorée(s)' }), h('ul', {}, r.ignorees.map(function (x) { return h('li', { text: x }); }))));
      if (r.avertissements.length) zone.appendChild(h('details', {}, h('summary', { text: r.avertissements.length + ' point(s) à vérifier' }), h('ul', {}, r.avertissements.map(function (x) { return h('li', { text: x }); }))));
      if (!r.mesures && !prep.config.length && !r.professionnels && !prep.servicesACreer.length && !prep.compteurs.length) zone.appendChild(h('div', { class: 'info', text: 'Rien de nouveau à importer.' }));
      adapterLibelles();
    }

    /** Registre : « classeur » devient « registre importé » dans les libellés de l'analyse. */
    function adapterLibelles() {
      if (!registre) return;
      var w = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) if (/classeur/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/du classeur/g, 'du registre importé').replace(/le classeur/g, 'le registre importé').replace(/Le classeur/g, 'Le registre importé').replace(/au classeur/g, 'au registre importé').replace(/classeur/g, 'registre importé');
    }
    fichier.addEventListener('change', lire);
    svDefaut.addEventListener('change', analyser);

    U.modale(registre ? 'Importer un registre' : 'Importer le classeur V1.3', h('div', { class: 'pile' },
      h('p', { class: 'muted', text: (registre ? 'Le registre du service (fichier CSV ou classeur Excel exporté de votre outil actuel) ' : 'Le classeur ') + 'est lu dans ce navigateur : rien n’est envoyé sur Internet. Les saisies importées sont enregistrées en un seul lot, annulable depuis le journal.' }),
      h('div', { class: 'grille-2' }, h('label', {}, registre ? 'Registre (.csv, .xlsx ou .xlsm)' : 'Classeur (.xlsx ou .xlsm)', fichier), h('label', {}, registre ? 'Service par défaut (lignes sans service)' : 'Service par défaut (patients sans service)', svDefaut)),
      registre ? zoneColonnes : null,
      zone), [
      { texte: 'Annuler' },
      { texte: 'Importer', classe: 'primaire', action: async function () {
        if (!prep) throw new Error('Choisissez d’abord un classeur.');
        var s = U.App.session;
        if (prep.servicesACreer.length) {
          var actuels = U.config().services || [];
          var codes = actuels.map(function (x) { return x.code; });
          await s.enregistrer('CONFIG', { cle: 'services', valeur: actuels.concat(prep.servicesACreer.filter(function (x) { return codes.indexOf(x.code) < 0; })) });
        }
        var choisis = cases.filter(function (x) { return x.cb.checked; }).map(function (x) { return x.c; });
        for (var i = 0; i < choisis.length; i++) await s.enregistrer('CONFIG', { cle: choisis[i].cle, valeur: choisis[i].valeur });
        if (champsCompteurs.length) await s.enregistrer('CONFIG', { cle: 'compteursRegistre', valeur: I().fusionCompteurs(U.st(), compteursChoisis()) });
        if (prep.anneesNumerotees.length) {
          if (modeNum === 'tout' && !confirm('Recalculer toutes les années : les numéros et les statistiques des années passées peuvent changer. Confirmer ?')) return false;
          var fige = I().fusionFige(U.st(), prep, figeChoisi());
          if (JSON.stringify(fige) !== JSON.stringify(U.config().registreFige || {})) await s.enregistrer('CONFIG', { cle: 'registreFige', valeur: fige });
          if (Object.keys(decisions).length) await s.enregistrer('CONFIG', { cle: 'registreFigeMesures', valeur: I().fusionFigeMesures(U.st(), prep, decisions) });
        }
        if (prep.compteurs.length) {
          var derniers = JSON.parse(JSON.stringify(U.config().derniersClasseur || {}));
          prep.compteurs.forEach(function (c) { derniers[c.service] = derniers[c.service] || {}; derniers[c.service][c.annee] = c.dernier; });
          await s.enregistrer('CONFIG', { cle: 'derniersClasseur', valeur: derniers });
        }
        if (prep.evenements.length) await s.enregistrerLot(prep.evenements, { libelle: (registre ? 'Import du registre ' : 'Import du classeur ') + fichier.files[0].name });
        var ecarts = I().comparer(s.etat, prep.attendus), controle = dernierControle, crees = prep.servicesACreer.slice();
        setTimeout(function () { compteRendu(prep.rapport, ecarts, controle, crees, registre); }, 0);
        return true;
      } }], { large: true });
  };

  function compteRendu(r, ecarts, controle, crees, registre) {
    var noms = { info: 'information', saisine: 'saisine', decision: 'décision' };
    U.modale('Import terminé', h('div', { class: 'pile' },
      h('div', { class: 'info', text: r.mesures + ' mesure(s) et ' + r.patients + ' patient(s) importés' + (crees.length ? ', ' + crees.length + ' service(s) créé(s) : ' + crees.map(function (x) { return x.libelle + ' (' + x.code + ')'; }).join(', ') : '') + '. Complétez dans l’onglet Patients les fiches des nouveaux patients (nom, date de naissance)' + (crees.length ? ', et affectez les services créés aux comptes concernés (Administration → Comptes)' : '') + '.' }),
      registre ? h('div', { class: 'info', text: 'Les cycles JLD et l’information des tiers ne figurent pas au registre : vérifiez les mesures en cours dans l’onglet JLD.' })
        : ecarts.length ? h('div', { class: 'alerte', text: ecarts.length + ' échéance(s) JLD recalculée(s) diffèrent du classeur pour des mesures en cours : vérifiez-les avant de vous y fier.' }) : h('div', { class: 'info', text: 'Les échéances JLD recalculées des mesures en cours sont identiques à celles du classeur.' }),
      ecarts.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Mesure', 'Échéance', 'Classeur', 'Recalculée'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, ecarts.map(function (e) { return h('tr', {}, h('td', { text: e.ref }), h('td', { text: noms[e.nature] }), h('td', { text: U.date(e.classeur) }), h('td', { text: U.date(e.calcule) })); })))) : null,
      controle && (controle.verifiees || controle.ecarts.length) ? h('div', { class: controle.ecarts.length ? 'alerte' : 'info', text: 'Numérotation du registre : ' + controle.verifiees + ' numéro(s) retrouvé(s) à l’identique' + (controle.ecarts.length ? ', ' + controle.ecarts.length + ' écart(s) : ' + controle.ecarts.map(function (e) { return e.ref + ' ' + e.classeur + ' → ' + e.outil; }).join(' ; ') : '') + '.' }) : null), [
      { texte: 'Fermer', classe: 'primaire' }]);
  }
})();
