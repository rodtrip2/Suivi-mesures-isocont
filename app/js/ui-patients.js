// SPDX-License-Identifier: EUPL-1.2
/* Onglet Patients : fiche, cumuls glissants, mode d'hospitalisation et son historique. */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var recherche = '';
  var annee = new Date().getFullYear();

  function servicesAffiches() {
    return U.App.service === '*' ? U.services().map(function (x) { return x.code; }) : [U.App.service];
  }

  function celluleAnnuelle(c, x) {
    if (!x || !x.n) return h('td', { class: 'col-annuelle muted', text: '0' });
    var nb = c.alerte ? h('span', { class: 'badge bad', title: 'Cette colonne devrait rester à 0.', text: String(x.n) }) : h('b', { text: String(x.n) });
    return h('td', { class: 'col-annuelle' }, nb, h('br'), h('small', { class: 'nowrap', text: U.duree(x.heures) + (x.enCours ? ', dont ' + x.enCours + ' en cours' : '') }));
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
    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Patients' }), h('div', { class: 'espace' }), h('label', { class: 'en-ligne' }, 'Statistiques de l’année', champAn), champ),
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
      liste.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Patient', 'Service', "Mode d'hospitalisation", 'Isolement 48 h / 15 j', 'Contention 48 h / 15 j', 'Vigilance', 'Mesures'].map(function (t) { return h('th', { text: t }); }),
           stats.colonnes.map(function (c) { return h('th', { class: 'col-annuelle', title: 'Entrées du registre ' + annee + ' en catégorie ' + c.categories.join(', ') + ' : nombre et durée cumulée' }, c.libelle, h('br'), h('small', { text: annee + ' · ' + c.categories.join(', ') })); }),
           h('th', { class: 'col-annuelle', title: 'Mesures débutées en ' + annee + ', comptées séparément comme le fait le juge' }, 'Mesures (JLD)', h('br'), h('small', { text: annee + ' · isolement / contention' })), h('th'))),
        h('tbody', {}, liste.map(function (x) {
          var p = x.p, mode = U.modeActuel(p), depuis = p.modes.length ? p.modes[p.modes.length - 1].date : null;
          return h('tr', { class: x.enCours ? 'en-cours' : '' },
            h('td', { class: 'patient' }, h('b', { text: (p.nom || '?') + ' ' + (p.prenom || '') }), h('br'),
              h('small', { text: 'IPP ' + (p.ipp || '—') + (p.naissance ? ' · né(e) le ' + p.naissance.split('-').reverse().join('/') : '') + (p.protection ? ' · ' + p.protection : '') })),
            h('td', { text: U.libService(p.service) }),
            h('td', {}, mode ? h('span', { class: 'badge ' + (M.estContrainte(U.config(), mode) ? '' : 'warn'), text: mode }) : '—', depuis ? h('div', {}, h('small', { text: 'depuis le ' + U.date(depuis) })) : null),
            h('td', { class: 'nowrap', text: U.duree(x.c.iso48) + ' / ' + U.duree(x.c.iso15) }),
            h('td', { class: 'nowrap', text: U.duree(x.c.cont48) + ' / ' + U.duree(x.c.cont15) }),
            h('td', {}, h('span', { class: 'badge ' + niveaux[x.c.niveau], title: 'Rouge : isolement ≥ 48 h ou contention ≥ 24 h sur 15 jours. Jaune : isolement ≥ 24 h ou contention ≥ 12 h.', text: x.c.niveau })),
            h('td', { text: x.enCours ? x.enCours + ' en cours / ' + x.total : String(x.total) }),
            stats.colonnes.map(function (c, i) { var s = stats.parPatient[p.id]; return celluleAnnuelle(c, s && s.colonnes[i]); }),
            (function () { var s = stats.parPatient[p.id]; return h('td', { class: 'nowrap col-annuelle' }, s ? s.isolements + ' / ' + s.contentions : '0 / 0'); })(),
            h('td', { class: 'actions-ligne' },
              x.total ? h('button', { class: 'btn petit', onclick: function () { modaleMesures(p); } }, 'Mesures') : null, ' ',
              peutModifier ? h('button', { class: 'btn petit', onclick: function () { modaleMode(p); } }, 'Mode') : null, ' ',
              peutModifier ? h('button', { class: 'btn petit', onclick: function () { modaleFiche(p); } }, 'Fiche') : null, ' ',
              U.App.session.peut('FUSION') ? h('button', { class: 'btn petit', title: 'Fusionner avec une autre fiche du même patient', onclick: function () { U.cas.modaleFusion(p); } }, 'Fusionner') : null));
        })))) : h('div', { class: 'panneau vide', text: 'Aucun patient.' }),
      h('p', { class: 'muted' }, h('small', { text: 'Colonnes de l’année : entrées du registre (une contention en CSI et l’isolement qui l’accompagne forment une seule entrée en catégorie C), comptées l’année de leur début, avec leur durée cumulée ; la dernière colonne compte les mesures comme le juge, l’isolement et la contention séparément. Colonnes paramétrables par l’administrateur.' })),
      h('p', { class: 'muted' }, h('small', { text: 'Cumuls glissants calculés à l’instant, périodes qui se chevauchent comptées une seule fois, remis à zéro après une mainlevée du JLD. Indicateur de charge, non clinique.' })));
  };

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
          h('td', { text: m.lieu || (m.csi ? 'CSI' : 'Hors CSI') }),
          h('td', { class: 'nowrap' }, U.date(m.debut), h('br'), h('small', { text: m.psychiatreDebut || '' })),
          h('td', { class: 'nowrap' }, enCours ? h('b', { text: 'en cours' }) : U.date(m.fin), enCours ? null : h('br'), enCours ? null : h('small', { text: (m.psychiatreFin || '') + (m.motifFin ? ' — ' + m.motifFin : '') })),
          h('td', { class: 'nowrap', text: U.duree(M.dureeHeures(m, maintenant, cfg)) }),
          h('td', { class: 'nowrap', text: (m.pauses || []).length ? m.pauses.length + ' — ' + U.duree(hp) + (op.retrancher ? ' (déduites)' : '') : '—' }),
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
          h('td', { title: M.LIB_CATEGORIES[e.categorie], text: e.categorie + ' — ' + M.LIB_CATEGORIES[e.categorie] }),
          h('td', { class: 'nowrap', text: U.date(e.debut) }),
          h('td', { class: 'nowrap', text: e.fin ? U.date(e.fin) : 'en cours' }),
          h('td', { class: 'nowrap', text: U.duree(e.dureeHeures) }));
      })))) : h('p', { class: 'muted', text: 'Aucune entrée.' });
    var c = M.cumulsPatient(etat, p.id, maintenant);
    U.modale('Mesures — ' + (p.nom || '') + ' ' + (p.prenom || ''), h('div', { class: 'pile' },
      h('div', { class: 'recap' },
        h('div', { text: 'IPP ' + (p.ipp || '—') + (p.naissance ? ' · né(e) le ' + p.naissance.split('-').reverse().join('/') : '') + ' · ' + (U.modeActuel(p) || 'mode non renseigné') }),
        h('div', { text: 'Cumuls glissants : isolement ' + U.duree(c.iso48) + ' sur 48 h, ' + U.duree(c.iso15) + ' sur 15 jours ; contention ' + U.duree(c.cont48) + ' sur 48 h, ' + U.duree(c.cont15) + ' sur 15 jours.' })),
      h('h3', { text: ms.length + ' mesure(s) — comptées comme le juge, isolement et contention séparément' }),
      tableMesures,
      h('h3', { text: 'Entrées du registre' }),
      h('p', { class: 'muted' }, h('small', { text: 'Une contention en CSI et l’isolement qui l’accompagne forment une seule entrée C ; les portions d’isolement avant et après la contention forment des entrées A.' + (op.deduireRegistre ? (op.contentionSeule === 'isolement' ? ' Pauses déduites : une pause de la contention pendant laquelle l’isolement continue forme une entrée A.' : ' Pauses déduites : une pause de la contention seule reste dans l’entrée C.') : '') })),
      tableRegistre), [{ texte: 'Fermer' }], { large: true });
  }

  function modaleFiche(p) {
    var ipp = h('input', { type: 'text', value: p.ipp || '' });
    var nom = h('input', { type: 'text', value: p.nom || '' }), prenom = h('input', { type: 'text', value: p.prenom || '' });
    var naissance = h('input', { type: 'date', value: p.naissance || '' });
    var protection = h('input', { type: 'text', value: p.protection || '', placeholder: 'ex. Curatelle renforcée' });
    var sv = h('select', {}, U.services().map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: x.code === p.service }); }));
    U.modale('Fiche patient', h('div', { class: 'pile' },
      h('div', { class: 'grille-2' }, h('label', {}, 'IPP', ipp), h('label', {}, 'Service', sv)),
      h('div', { class: 'grille-2' }, h('label', {}, 'Nom', nom), h('label', {}, 'Prénom', prenom)),
      h('div', { class: 'grille-2' }, h('label', {}, 'Date de naissance', naissance), h('label', {}, 'Mesure de protection juridique', protection)),
      h('small', { class: 'muted', text: 'Une mesure garde le nom affiché au moment de sa création dans le journal ; les écrans utilisent la fiche à jour.' })), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        if (!nom.value.trim()) throw new Error('Le nom est obligatoire.');
        var d = { patientId: p.id }, ch = 0;
        [['ipp', ipp.value.trim()], ['nom', nom.value.trim().toUpperCase()], ['prenom', prenom.value.trim()], ['naissance', naissance.value], ['protection', protection.value.trim()], ['service', sv.value]].forEach(function (x) {
          if ((p[x[0]] || '') !== x[1]) { d[x[0]] = x[1]; ch++; }
        });
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
