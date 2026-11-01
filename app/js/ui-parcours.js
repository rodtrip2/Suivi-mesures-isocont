// SPDX-License-Identifier: EUPL-1.2
/*
 * Parcours du patient pendant une mesure :
 *  - transfert vers un autre service (mesure unique pour le JLD, répartie au registre) ;
 *  - passage en soins somatiques ou aux urgences, puis retour (règle de l'établissement : Cas particuliers) ;
 *  - recours au JLD à l'initiative du patient, de ses proches ou de son avocat, et appel.
 * Règles : model.js (TRANSFERT, SOMATIQUE, SOMATIQUE_RETOUR, RECOURS, morceaux, suspensions).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  var LIB_RECOURS = { SAISINE: 'Saisine du JLD (recours)', DECISION: 'Décision du JLD sur ce recours', APPEL: 'Appel devant le premier président de la cour d’appel', DECISION_APPEL: 'Décision du premier président' };
  var AUTEURS = ['Patient', 'Famille ou proche', 'Avocat', 'Tuteur ou curateur', 'Personne de confiance', 'Procureur de la République', 'Directeur de l’établissement', 'Autre'];

  /** Mesures en cours du patient (pour les traiter ensemble). */
  function enCoursPatient(m) {
    return M.listeMesures(U.st()).filter(function (x) { return x.patientId === m.patientId && typeof x.fin !== 'number'; }).sort(function (a, b) { return a.type < b.type ? 1 : -1; });
  }

  function casesMesures(m) {
    var liste = enCoursPatient(m);
    var cases = liste.map(function (x) { return { m: x, cb: h('input', { type: 'checkbox', checked: true }) }; });
    var bloc = h('div', { class: 'pile serre' }, cases.map(function (c) {
      return h('label', { class: 'case' }, c.cb, h('span', { text: c.m.type + ' depuis le ' + U.date(c.m.debut) + ' — ' + (c.m.lieu || '') }));
    }));
    bloc.choisies = function () { var l = cases.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.m; }); if (!l.length) throw new Error('Cochez au moins une mesure.'); return l; };
    return bloc;
  }

  /** Choix d'un lieu dans un service : CSI paramétrées ou chambre hors CSI. */
  function choixLieu(service, valeur) {
    var sel = h('select'), chambre = h('input', { type: 'text', placeholder: 'N° de chambre', hidden: true });
    function remplir(sv) {
      U.vider(sel);
      ((U.config().lieuxCSI || {})[sv] || []).forEach(function (l) { sel.appendChild(h('option', { value: l, text: l, selected: l === valeur })); });
      sel.appendChild(h('option', { value: '__hors', text: 'Hors CSI (chambre)' }));
      chambre.hidden = sel.value !== '__hors';
    }
    sel.addEventListener('change', function () { chambre.hidden = sel.value !== '__hors'; });
    remplir(service);
    var bloc = h('div', { class: 'pile serre' }, sel, chambre);
    bloc.remplir = remplir;
    bloc.valeur = function () {
      if (sel.value === '__hors') { if (!chambre.value.trim()) throw new Error('Indiquez la chambre.'); return { lieu: 'Chambre ' + chambre.value.trim(), csi: false }; }
      return { lieu: sel.value, csi: true };
    };
    return bloc;
  }

  function verifierDate(t, mesures) {
    if (!isFinite(t)) throw new Error('Date invalide.');
    if (t > Date.now() + 10 * 60000) throw new Error('La date ne peut pas être dans le futur.');
    mesures.forEach(function (x) {
      if (t <= x.debut) throw new Error('La date doit suivre le début de la mesure (' + U.date(x.debut) + ').');
      var der = (x.segments || []).reduce(function (a, s) { return Math.max(a, s.debut); }, 0);
      if (der && t <= der) throw new Error('La date doit suivre le dernier changement de lieu (' + U.date(der) + ').');
    });
  }

  // ------------------------------------------------------------ Transfert
  function modaleTransfert(m) {
    var autres = U.tousServices().filter(function (x) { return x.code !== m.service; });
    if (!autres.length) { U.toast('Aucun autre service n’est paramétré.'); return; }
    var sv = h('select', {}, autres.map(function (x) { return h('option', { value: x.code, text: x.libelle }); }));
    var quand = h('input', { type: 'datetime-local', value: U.versSaisie(Date.now()) });
    var lieu = choixLieu(sv.value);
    sv.addEventListener('change', function () { lieu.remplir(sv.value); });
    var mesures = casesMesures(m);
    U.modale('Transfert vers un autre service', h('div', { class: 'pile' }, U.recapMesure(m),
      h('p', { class: 'muted', text: 'La mesure continue : délais JLD, cycle et tiers inchangés. Au registre, la période passée dans chaque service est inscrite dans le registre de ce service (le premier service clôt son entrée à l’heure du transfert).' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Service d’accueil', sv), h('label', {}, 'Date et heure du transfert', quand)),
      h('label', {}, 'Lieu dans le service d’accueil', lieu),
      h('div', {}, h('div', { class: 'etiquette', text: 'Mesures transférées' }), mesures)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer le transfert', classe: 'primaire', action: async function () {
        var t = U.depuisSaisie(quand.value), l = lieu.valeur(), liste = mesures.choisies();
        verifierDate(t, liste);
        for (var i = 0; i < liste.length; i++) await U.App.session.enregistrer('TRANSFERT', { mesureId: liste[i].id, date: t, service: sv.value, lieu: l.lieu, csi: l.csi, exception: !!liste[i].exception && !l.csi }, liste[i].version);
        var p = U.st().patients[m.patientId];
        if (p && p.service !== sv.value) await U.App.session.enregistrer('PATIENT', { patientId: m.patientId, service: sv.value });
        U.toast('Transfert enregistré.');
      } }]);
  }

  // ------------------------------------------------------------ Soins somatiques ou urgences
  function modaleSomatique(m) {
    var o = M.optionsCas(U.config());
    var quand = h('input', { type: 'datetime-local', value: U.versSaisie(Date.now()) });
    var lieu = h('input', { type: 'text', placeholder: 'Ex. : urgences, service de médecine, imagerie…' });
    var mesures = casesMesures(m);
    var psy = o.somatique === 'arret' ? U.selectPsychiatre(m.psychiatreDebut) : null;
    var explication = {
      'poursuite-service': 'Règle de l’établissement : la mesure continue pendant le passage en soins somatiques ; cette période reste comptée au registre du service, avec le lieu indiqué (isolement en B, contention en D).',
      'poursuite-registre': 'Règle de l’établissement : la mesure continue ; cette période est comptée au registre « ' + U.libService(o.serviceSomatique) + ' ». Les délais JLD continuent de courir.',
      suspension: 'Règle de l’établissement : la mesure est suspendue jusqu’au retour dans le service. Cette période n’est comptée ni dans les délais JLD (reportés d’autant), ni au registre.',
      arret: 'Règle de l’établissement : la mesure prend fin au départ du patient. Si le psychiatre décide une nouvelle mesure au retour, saisissez-la alors (elle s’ajoutera au cumul si elle débute moins de 48 h après).'
    }[o.somatique];
    U.modale('Passage en soins somatiques ou aux urgences', h('div', { class: 'pile' }, U.recapMesure(m),
      h('div', { class: 'info', text: explication }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Date et heure du départ', quand), h('label', {}, 'Lieu', lieu)),
      psy ? h('label', {}, 'Psychiatre', psy) : null,
      h('div', {}, h('div', { class: 'etiquette', text: 'Mesures concernées' }), mesures)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var t = U.depuisSaisie(quand.value), liste = mesures.choisies();
        if (!lieu.value.trim()) { lieu.focus(); throw new Error('Indiquez le lieu (urgences, service…).'); }
        verifierDate(t, liste);
        for (var i = 0; i < liste.length; i++) {
          if (o.somatique === 'arret') await U.App.session.enregistrer('MESURE_FIN', { mesureId: liste[i].id, fin: t, psychiatre: psy.valeur(), motif: 'Passage en soins somatiques ou aux urgences' + ' (' + lieu.value.trim() + ')' }, liste[i].version);
          else await U.App.session.enregistrer('SOMATIQUE', { mesureId: liste[i].id, date: t, lieu: lieu.value.trim(), mode: o.somatique, serviceRegistre: o.somatique === 'poursuite-registre' ? o.serviceSomatique : '' }, liste[i].version);
        }
        U.toast(o.somatique === 'arret' ? 'Fin de mesure enregistrée.' : 'Départ enregistré. Saisissez le retour dans le service avec le bouton « Retour ».');
      } }]);
  }

  function modaleRetour(m) {
    var quand = h('input', { type: 'datetime-local', value: U.versSaisie(Date.now()) });
    var lieu = choixLieu(m.service, m.somatique && m.somatique.csiAvant ? m.somatique.lieuAvant : '');
    var liste = enCoursPatient(m).filter(function (x) { return x.somatique; });
    U.modale('Retour dans le service', h('div', { class: 'pile' }, U.recapMesure(m),
      h('div', { class: 'info', text: 'Départ le ' + U.date(m.somatique.debut) + ' (' + m.somatique.lieu + ') — ' + (U.cas.LIB_SOMA[m.somatique.mode] || '') + '.' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Date et heure du retour', quand), h('label', {}, 'Lieu au retour', lieu)),
      liste.length > 1 ? h('small', { class: 'muted', text: 'Le retour est enregistré pour les ' + liste.length + ' mesures du patient passées en soins somatiques.' }) : null), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer le retour', classe: 'primaire', action: async function () {
        var t = U.depuisSaisie(quand.value), l = lieu.valeur();
        verifierDate(t, liste);
        for (var i = 0; i < liste.length; i++) await U.App.session.enregistrer('SOMATIQUE_RETOUR', { mesureId: liste[i].id, date: t, lieu: l.lieu, csi: l.csi }, liste[i].version);
        U.toast('Retour enregistré.');
      } }]);
  }

  // ------------------------------------------------------------ Recours et appel
  function modaleRecours(m) {
    var nature = h('select', {}, Object.keys(LIB_RECOURS).map(function (k) { return h('option', { value: k, text: LIB_RECOURS[k] }); }));
    var auteur = h('select', {}, AUTEURS.map(function (a) { return h('option', { value: a, text: a }); }));
    var decision = h('select', {}, h('option', { value: 'MAINTIEN', text: 'Maintien de la mesure' }), h('option', { value: 'LEVEE', text: 'Mainlevée de la mesure' }));
    var quand = h('input', { type: 'datetime-local', value: U.versSaisie(Date.now()) });
    var commentaire = h('input', { type: 'text', placeholder: 'Facultatif (ex. : audience, référence)' });
    var blocAuteur = h('label', {}, 'À l’initiative de', auteur), blocDecision = h('label', {}, 'Décision', decision);
    var infoLevee = h('div', { class: 'info', text: 'La mainlevée est un indicateur légal : la fin de la mesure reste une décision médicale à reporter. Aucune nouvelle mesure ne pourra être prise pendant 48 h, sauf éléments nouveaux.' });
    function maj() {
      var dec = nature.value === 'DECISION' || nature.value === 'DECISION_APPEL';
      blocAuteur.hidden = dec; blocDecision.hidden = !dec; infoLevee.hidden = !dec || decision.value !== 'LEVEE';
    }
    nature.addEventListener('change', maj); decision.addEventListener('change', maj); maj();
    var hist = (m.recours || []).map(function (r) { return h('div', { text: libRecours(r) }); });
    U.modale('Recours au JLD ou appel', h('div', { class: 'pile' }, U.recapMesure(m),
      h('p', { class: 'muted', text: 'En dehors du contrôle systématique (cycles JLD), le juge peut être saisi à tout moment par le patient, ses proches, son avocat ou toute personne agissant dans son intérêt ; ses décisions peuvent faire l’objet d’un appel devant le premier président de la cour d’appel.' }),
      hist.length ? h('div', { class: 'recap' }, h('b', { text: 'Déjà saisi' }), hist) : null,
      h('div', { class: 'grille-2' }, h('label', {}, 'Étape', nature), h('label', {}, 'Date et heure', quand)),
      h('div', { class: 'grille-2' }, blocAuteur, blocDecision), infoLevee,
      h('label', {}, 'Commentaire', commentaire)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var t = U.depuisSaisie(quand.value), dec = nature.value === 'DECISION' || nature.value === 'DECISION_APPEL';
        if (!isFinite(t) || t > Date.now() + 10 * 60000) throw new Error('Date invalide ou dans le futur.');
        await U.App.session.enregistrer('RECOURS', { mesureId: m.id, nature: nature.value, auteur: dec ? '' : auteur.value, decision: dec ? decision.value : null, date: t, commentaire: commentaire.value.trim() }, m.version);
        U.toast('Enregistré.');
      } }]);
  }

  function libRecours(r) {
    return LIB_RECOURS[r.nature] + ' le ' + U.date(r.date) + (r.auteur ? ', à l’initiative de : ' + r.auteur.toLowerCase() : '') +
      (r.decision ? ' — ' + (r.decision === 'LEVEE' ? 'mainlevée' : 'maintien') : '') + (r.commentaire ? ' — ' + r.commentaire : '');
  }

  /** Lignes du détail : lieux successifs et recours. */
  function detailMesure(m) {
    var blocs = [];
    if (m.segments && m.segments.length > 1) {
      blocs.push(h('div', { class: 'recap' }, h('b', { text: 'Lieux successifs' }), m.segments.map(function (sg, i) {
        var quoi = i === 0 ? 'Début' : sg.transfert ? 'Transfert' : sg.nature === 'somatique' ? 'Soins somatiques ou urgences (' + (U.cas.LIB_SOMA[sg.mode] || '') + ')' : sg.retour ? 'Retour dans le service' : 'Changement';
        return h('div', { text: U.date(i === 0 ? m.debut : sg.debut) + ' — ' + quoi + ' : ' + U.libService(sg.service) + ', ' + (sg.lieu || '—') });
      })));
    }
    if ((m.recours || []).length) blocs.push(h('div', { class: 'recap' }, h('b', { text: 'Recours et appel' }), m.recours.map(function (r) { return h('div', { text: libRecours(r) }); })));
    return blocs;
  }

  /** Badge « soins somatiques » d'une mesure (ou null). */
  function badge(m) {
    if (!m.somatique) return null;
    return h('span', { class: 'badge ' + (m.somatique.mode === 'suspension' ? 'warn' : 'pause'), title: 'Depuis le ' + U.date(m.somatique.debut) + ' — ' + (U.cas.LIB_SOMA[m.somatique.mode] || ''), text: (m.somatique.mode === 'suspension' ? 'Suspendue — ' : '') + m.somatique.lieu });
  }

  U.parcours = { modaleTransfert: modaleTransfert, modaleSomatique: modaleSomatique, modaleRetour: modaleRetour, modaleRecours: modaleRecours, libRecours: libRecours, detailMesure: detailMesure, badge: badge, LIB_RECOURS: LIB_RECOURS };
})();
