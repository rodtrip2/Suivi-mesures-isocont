// SPDX-License-Identifier: EUPL-1.2
/*
 * Alertes de l'établissement (Administration → Alertes) :
 *  - rappel affiché lors de la saisie d'une mesure (ex. exceptions prévues pour une contention hors CSI) ;
 *  - personne à informer dans un délai (ex. cadre ou administrateur de garde, sans délai, pour un patient
 *    en soins libres), avec traçabilité de l'information (qui, comment, quand) dans le journal.
 * Les règles sont dans config.alertes (voir M.alertesConfig) ; l'évaluation est dans model.js.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var MOYENS = ['Téléphone', 'En personne', 'Messagerie sécurisée', 'Bip', 'Autre'];

  function delaiTexte(min) {
    if (!min) return 'sans délai';
    if (min < 60) return 'dans les ' + min + ' min';
    return 'dans les ' + (min / 60) + ' h';
  }

  function servicesTexte(r) {
    return r.services.length ? r.services.map(U.libService).join(', ') : 'tous les services';
  }

  // ------------------------------------------------------------ Saisie d'une mesure
  /** Encadrés des alertes déclenchées par la saisie en cours (faits : type, csi, service, libre, mineur, protection). */
  function encadres(faits) {
    return M.reglesDeclenchees(U.config(), faits).map(function (r) {
      if (r.nature === 'rappel') return h('div', { class: 'alerte-etab rappel', role: 'note' }, h('b', { text: r.libelle }), r.message ? h('p', { text: r.message }) : null);
      return h('div', { class: 'alerte-etab information', role: 'alert' },
        h('b', { text: 'À informer ' + delaiTexte(r.delaiMinutes) + ' : ' + (r.destinataires || '—') }),
        h('div', { text: r.libelle }),
        r.message ? h('p', { text: r.message }) : null,
        h('small', { text: 'L’information vous sera demandée à l’enregistrement, pour la tracer.' }));
    });
  }

  // ------------------------------------------------------------ Traçabilité de l'information
  /**
   * Formulaire de traçabilité pour des informations à tracer ([{ mesure, regle }]).
   * Une seule saisie par règle et par patient (l'isolement et la contention créés ensemble).
   */
  function modaleInformations(liste) {
    if (!liste.length) return;
    var groupes = [], index = {};
    liste.forEach(function (x) {
      var k = x.regle.id + '|' + x.mesure.patientId;
      if (!index[k]) { index[k] = { regle: x.regle, patientId: x.mesure.patientId, mesures: [] }; groupes.push(index[k]); }
      index[k].mesures.push(x.mesure);
    });
    var formulaires = groupes.map(function (g) {
      var personne = h('input', { type: 'text', placeholder: 'Nom et fonction (ex. : Mme Martin, administrateur de garde)' });
      var moyen = h('select', {}, MOYENS.map(function (x) { return h('option', { value: x, text: x }); }));
      var quand = h('input', { type: 'datetime-local', value: U.versSaisie(Date.now()) });
      var commentaire = h('input', { type: 'text', placeholder: 'Facultatif' });
      var retard = Date.now() > g.mesures[0].debut + g.regle.delaiMinutes * 60000;
      var bloc = h('fieldset', { class: 'carte-information' },
        h('legend', { text: g.regle.libelle + ' — ' + U.nomPatient(g.patientId) }),
        h('div', { class: 'alerte-etab information' }, h('b', { text: 'À informer ' + delaiTexte(g.regle.delaiMinutes) + ' : ' + (g.regle.destinataires || '—') }),
          h('div', { text: g.mesures.map(function (m) { return m.type + ' du ' + U.date(m.debut); }).join(' · ') + (retard && g.regle.delaiMinutes ? ' — délai dépassé' : '') })),
        h('div', { class: 'grille-2' }, h('label', {}, 'Personne informée', personne), h('label', {}, 'Moyen', moyen)),
        h('div', { class: 'grille-2' }, h('label', {}, 'Date et heure de l’information', quand), h('label', {}, 'Commentaire', commentaire)));
      return { g: g, bloc: bloc, personne: personne, moyen: moyen, quand: quand, commentaire: commentaire };
    });
    U.modale(groupes.length > 1 ? 'Informations à tracer' : 'Information à tracer', h('div', { class: 'pile' },
      h('p', { class: 'muted', text: 'Règle de l’établissement. Indiquez qui a été informé, comment et quand : la saisie est tracée au journal. Si l’information n’est pas encore faite, choisissez « Plus tard » : elle reste dans les points de vigilance du tableau de bord.' }),
      formulaires.map(function (f) { return f.bloc; })), [
      { texte: 'Plus tard' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var remplis = formulaires.filter(function (f) { return f.personne.value.trim(); });
        if (!remplis.length) { formulaires[0].personne.focus(); throw new Error('Indiquez la personne informée.'); }
        for (var i = 0; i < remplis.length; i++) {
          var f = remplis[i], t = U.depuisSaisie(f.quand.value);
          if (!isFinite(t)) throw new Error('Date de l’information invalide.');
          if (t > Date.now() + 10 * 60000) throw new Error('La date de l’information ne peut pas être dans le futur.');
          for (var j = 0; j < f.g.mesures.length; j++) {
            var m = f.g.mesures[j];
            await U.App.session.enregistrer('INFORMATION', { mesureId: m.id, regle: f.g.regle.id, libelle: f.g.regle.libelle, destinataires: f.g.regle.destinataires,
              personne: f.personne.value.trim(), moyen: f.moyen.value, date: t, commentaire: f.commentaire.value.trim() }, m.version);
          }
        }
        U.toast(remplis.length === formulaires.length ? 'Information tracée.' : 'Information tracée ; les autres restent à tracer.');
      } }], { focus: formulaires[0].personne });
  }

  /** Informations à tracer pour les mesures visibles (ou celles dont l'identifiant est donné). */
  function aTracer(ids) {
    return M.informationsATracer(U.st(), Date.now(), function (m) { return ids ? ids.indexOf(m.id) >= 0 : U.dansService(m); });
  }

  /** Lignes du détail d'une mesure : informations tracées et à tracer. */
  function detailMesure(m) {
    var regles = M.alertesMesure(U.st(), m).filter(function (r) { return r.nature === 'information'; });
    var tracees = Object.keys(m.informations || {}).map(function (k) { return m.informations[k]; });
    var connues = {};
    var lignes = tracees.map(function (x) {
      connues[x.regle] = 1;
      return h('div', { text: (x.libelle || x.regle) + ' : ' + x.personne + ' informé(e) le ' + U.date(x.date) + ' (' + x.moyen.toLowerCase() + ')' + (x.commentaire ? ' — ' + x.commentaire : '') + ' — tracé par ' + U.App.session.nomAuteur(x.by) });
    });
    var manquantes = regles.filter(function (r) { return !connues[r.id]; });
    manquantes.forEach(function (r) { lignes.push(h('div', { class: 'texte-bad', text: r.libelle + ' : informer ' + (r.destinataires || '—') + ' ' + delaiTexte(r.delaiMinutes) + ' — information non tracée.' })); });
    if (!lignes.length) return null;
    return h('div', { class: 'recap' }, h('b', { text: 'Informations (alertes de l’établissement)' }), lignes,
      manquantes.length && U.App.session.peut('INFORMATION') ? h('div', {}, h('button', { class: 'btn petit', onclick: function () {
        var l = aTracer([m.id]); var dlg = document.querySelector('dialog'); if (dlg) dlg.dispatchEvent(new Event('cancel'));
        setTimeout(function () { modaleInformations(l); }, 30);
      } }, 'Tracer l’information')) : null);
  }

  // ------------------------------------------------------------ Administration
  function panneauAdmin() {
    var cfg = U.config();
    var avant = {};
    M.alertesConfig(cfg).forEach(function (r) { avant[r.id] = r; });
    var regles = M.alertesConfig(cfg).map(function (r) { return Object.assign({}, r, { message: r.messagePropre ? r.message : '' }); });
    var liste = h('div', { class: 'pile' });

    function dessiner() {
      U.vider(liste);
      if (!regles.length) liste.appendChild(h('div', { class: 'vide', text: 'Aucune alerte paramétrée.' }));
      regles.forEach(function (r, i) { liste.appendChild(carte(r, i)); });
    }

    function carte(r, i) {
      var nom = h('input', { type: 'text', value: r.libelle, oninput: function () { r.libelle = nom.value; } });
      var active = h('input', { type: 'checkbox', checked: r.active, onchange: function () { r.active = active.checked; } });
      var decl = h('select', { onchange: function () { r.declencheur = decl.value; majTexte(); } }, Object.keys(M.DECLENCHEURS_ALERTE).map(function (k) { return h('option', { value: k, text: M.DECLENCHEURS_ALERTE[k], selected: k === r.declencheur }); }));
      var cases = U.tousServices().map(function (sv) {
        var cb = h('input', { type: 'checkbox', checked: r.services.indexOf(sv.code) >= 0, onchange: function () {
          r.services = cases.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.code; });
        } });
        return { code: sv.code, cb: cb, el: h('label', { class: 'case' }, cb, h('span', { text: sv.libelle })) };
      });
      var nomRadio = 'nature-' + i + '-' + Math.random().toString(36).slice(2, 7);
      var rRappel = h('input', { type: 'radio', name: nomRadio, checked: r.nature === 'rappel', onchange: maj });
      var rInfo = h('input', { type: 'radio', name: nomRadio, checked: r.nature === 'information', onchange: maj });
      var dest = h('input', { type: 'text', value: r.destinataires, placeholder: 'Ex. : cadre de santé ou administrateur de garde', oninput: function () { r.destinataires = dest.value; } });
      var delai = h('select', { onchange: function () { r.delaiMinutes = +delai.value; } }, M.DELAIS_ALERTE.map(function (d) { return h('option', { value: d, text: delaiTexte(d).replace(/^dans les /, ''), selected: d === r.delaiMinutes }); }));
      var blocInfo = h('div', { class: 'grille-2' }, h('label', {}, 'Personne(s) à informer', dest), h('label', {}, 'Délai (depuis le début de la mesure)', delai));
      var msg = h('textarea', { rows: 5, oninput: function () { r.message = msg.value; } }, r.message);
      var aideTexte = h('small', { class: 'muted' });
      function majTexte() {
        var defaut = M.TEXTES_ALERTE[r.declencheur] || '';
        msg.placeholder = defaut || 'Message affiché (facultatif)';
        aideTexte.textContent = defaut ? 'Champ laissé vide : le texte proposé (en grisé) s’affiche et suit les mises à jour de l’outil.' : '';
      }
      function maj() { r.nature = rInfo.checked ? 'information' : 'rappel'; blocInfo.hidden = !rInfo.checked; }
      maj(); majTexte();
      return h('fieldset', { class: 'carte-alerte' + (r.active ? '' : ' inactive') },
        h('legend', {}, h('label', { class: 'case' }, active, h('span', { text: 'Alerte active' }))),
        h('div', { class: 'grille-2' }, h('label', {}, 'Nom de l’alerte', nom), h('label', {}, 'Se déclenche pour', decl)),
        h('div', {}, h('div', { class: 'etiquette', text: 'Services concernés (aucun coché = tous les services)' }), h('div', { class: 'cases-ligne' }, cases.map(function (c) { return c.el; }))),
        h('div', { class: 'pile serre' },
          h('label', { class: 'case' }, rRappel, h('span', { text: 'Rappel affiché lors de la saisie de la mesure' })),
          h('label', { class: 'case' }, rInfo, h('span', { text: 'Personne à informer : l’information est demandée à l’enregistrement et tracée au journal ; tant qu’elle ne l’est pas, elle reste dans les points de vigilance' }))),
        blocInfo,
        h('label', {}, 'Message', msg, aideTexte),
        h('div', { class: 'actions' },
          M.TEXTES_ALERTE[r.declencheur] ? h('button', { class: 'btn petit', type: 'button', onclick: function () { r.message = M.TEXTES_ALERTE[r.declencheur]; msg.value = r.message; } }, 'Modifier le texte proposé') : null,
          h('button', { class: 'btn petit danger', type: 'button', onclick: function () { regles.splice(i, 1); dessiner(); } }, 'Supprimer cette alerte')));
    }

    dessiner();
    return h('section', { class: 'panneau' }, h('h2', { text: 'Alertes de l’établissement' }),
      h('p', { class: 'muted', text: 'Ces alertes s’ajoutent aux alertes réglementaires affichées sous les champs de la saisie (mineur, soins libres, cumul…). Un rappel s’affiche dans le formulaire de la nouvelle mesure ; une information à tracer est demandée à l’enregistrement, puis suivie au tableau de bord jusqu’à ce qu’elle soit tracée. Une alerte ne concerne que les mesures saisies après son activation, jamais l’historique importé.' }),
      liste,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: function () {
          regles.push({ id: 'alerte-' + Math.random().toString(36).slice(2, 9), libelle: '', active: true, declencheur: 'toute-mesure', services: [], nature: 'information', destinataires: '', delaiMinutes: 0, message: '', depuis: 0 });
          dessiner();
        } }, '+ Ajouter une alerte'),
        h('button', { class: 'btn', type: 'button', onclick: function () {
          if (!confirm('Revenir aux deux alertes proposées par défaut ? Les alertes actuelles seront remplacées à l’enregistrement.')) return;
          regles = M.alertesConfig(M.CONFIG_DEFAUT).map(function (r) { return Object.assign({}, r, { message: '' }); });
          dessiner();
        } }, 'Alertes par défaut')),
      U.boutonEnregistrer(async function () {
        var maintenant = Date.now();
        var v = regles.map(function (r, i) {
          var libelle = String(r.libelle || '').trim() || M.DECLENCHEURS_ALERTE[r.declencheur];
          if (r.nature === 'information' && !String(r.destinataires || '').trim()) throw new Error('Alerte ' + (i + 1) + ' (« ' + libelle + ' ») : indiquez la ou les personnes à informer.');
          var message = String(r.message || '').trim();
          if (message === (M.TEXTES_ALERTE[r.declencheur] || '')) message = '';
          var a = avant[r.id];
          // Date d'activation : seules les mesures saisies ensuite déclenchent l'alerte.
          var depuis = r.active ? (a && a.active && a.declencheur === r.declencheur ? a.depuis : maintenant) : 0;
          return { id: r.id, libelle: libelle, active: !!r.active, declencheur: r.declencheur, services: r.services.slice(), nature: r.nature,
            destinataires: String(r.destinataires || '').trim(), delaiMinutes: r.delaiMinutes, message: message, depuis: depuis };
        });
        await U.enregistrerConfig([['alertes', v]]);
        v.forEach(function (r) { avant[r.id] = r; });
      }));
  }

  U.alertes = { delaiTexte: delaiTexte, servicesTexte: servicesTexte, encadres: encadres, modaleInformations: modaleInformations, aTracer: aTracer, detailMesure: detailMesure, panneauAdmin: panneauAdmin };
})();
