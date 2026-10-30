// SPDX-License-Identifier: EUPL-1.2
/* Reprise des données du classeur Excel V1.3 (administrateur). Le fichier est lu dans le navigateur. */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  U.actions.importer = function () {
    var fichier = h('input', { type: 'file', accept: '.xlsx,.xlsm' });
    var zone = h('div', { class: 'pile' });
    var prep = null, cases = [];
    var svDefaut = h('select', {}, U.tousServices().map(function (x) { return h('option', { value: x.code, text: x.libelle }); }));

    async function analyser() {
      U.vider(zone); prep = null; cases = [];
      if (!fichier.files[0]) return;
      zone.appendChild(h('div', { class: 'info', text: 'Lecture du classeur…' }));
      try {
        var classeur = await SIC.xlsx.lire(await fichier.files[0].arrayBuffer());
        prep = SIC.importV13.preparer(classeur, U.st(), { serviceParDefaut: svDefaut.value });
      } catch (e) { U.vider(zone); zone.appendChild(h('div', { class: 'erreur', text: e.message })); return; }
      var r = prep.rapport;
      U.vider(zone);
      zone.appendChild(h('div', { class: 'recap' },
        h('div', {}, h('b', { text: r.mesures + ' mesure(s)' }), ' à importer' + (r.dejaPresentes ? ', ' + r.dejaPresentes + ' déjà présente(s) (ignorées)' : '') + '.'),
        h('div', { text: r.patients + ' nouveau(x) patient(s), ' + r.modes + " mode(s) d'hospitalisation, " + r.tiers + ' information(s) de tiers, ' + r.cycles + ' décision(s) de maintien du JLD, ' + r.professionnels + ' professionnel(s) en CSI.' })));
      if (prep.config.length) {
        zone.appendChild(h('h3', { text: 'Paramétrage trouvé dans le classeur' }));
        prep.config.forEach(function (c) {
          var cb = h('input', { type: 'checkbox', checked: true });
          cases.push({ cb: cb, c: c });
          zone.appendChild(h('label', { class: 'case' }, cb, h('span', { text: c.libelle })));
        });
      }
      if (r.ignorees.length) zone.appendChild(h('details', {}, h('summary', { text: r.ignorees.length + ' ligne(s) ignorée(s)' }), h('ul', {}, r.ignorees.map(function (x) { return h('li', { text: x }); }))));
      if (r.avertissements.length) zone.appendChild(h('details', {}, h('summary', { text: r.avertissements.length + ' point(s) à vérifier' }), h('ul', {}, r.avertissements.map(function (x) { return h('li', { text: x }); }))));
      if (!r.mesures && !prep.config.length && !r.professionnels) zone.appendChild(h('div', { class: 'info', text: 'Rien de nouveau à importer.' }));
    }
    fichier.addEventListener('change', analyser);
    svDefaut.addEventListener('change', analyser);

    U.modale('Importer le classeur V1.3', h('div', { class: 'pile' },
      h('p', { class: 'muted', text: 'Le classeur est lu dans ce navigateur : rien n’est envoyé sur Internet. Les saisies importées sont enregistrées en un seul lot, annulable depuis le journal.' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Classeur (.xlsx ou .xlsm)', fichier), h('label', {}, 'Service par défaut (patients sans service)', svDefaut)),
      zone), [
      { texte: 'Annuler' },
      { texte: 'Importer', classe: 'primaire', action: async function () {
        if (!prep) throw new Error('Choisissez d’abord un classeur.');
        var s = U.App.session;
        var choisis = cases.filter(function (x) { return x.cb.checked; }).map(function (x) { return x.c; });
        for (var i = 0; i < choisis.length; i++) await s.enregistrer('CONFIG', { cle: choisis[i].cle, valeur: choisis[i].valeur });
        if (prep.evenements.length) await s.enregistrerLot(prep.evenements, { libelle: 'Import du classeur ' + fichier.files[0].name });
        var ecarts = SIC.importV13.comparer(s.etat, prep.attendus);
        setTimeout(function () { compteRendu(prep.rapport, ecarts); }, 0);
        return true;
      } }]);
  };

  function compteRendu(r, ecarts) {
    var noms = { info: 'information', saisine: 'saisine', decision: 'décision' };
    U.modale('Import terminé', h('div', { class: 'pile' },
      h('div', { class: 'info', text: r.mesures + ' mesure(s) et ' + r.patients + ' patient(s) importés. Complétez les fiches marquées « IMPORT » dans l’onglet Patients.' }),
      ecarts.length ? h('div', { class: 'alerte', text: ecarts.length + ' échéance(s) JLD recalculée(s) diffèrent du classeur pour des mesures en cours : vérifiez-les avant de vous y fier.' }) : h('div', { class: 'info', text: 'Les échéances JLD recalculées des mesures en cours sont identiques à celles du classeur.' }),
      ecarts.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Mesure', 'Échéance', 'Classeur', 'Recalculée'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, ecarts.map(function (e) { return h('tr', {}, h('td', { text: e.ref }), h('td', { text: noms[e.nature] }), h('td', { text: U.date(e.classeur) }), h('td', { text: U.date(e.calcule) })); })))) : null), [
      { texte: 'Fermer', classe: 'primaire' }]);
  }
})();
