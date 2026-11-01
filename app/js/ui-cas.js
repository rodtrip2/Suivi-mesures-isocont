// SPDX-License-Identifier: EUPL-1.2
/*
 * Cas particuliers (Administration → Cas particuliers) et fonctions associées :
 *  - nouvelle mesure dans les 48 h suivant une mainlevée du JLD (art. L. 3222-5-1, II) ;
 *  - mesure débutée avant l'arrivée dans le service (urgences, autre établissement) ;
 *  - fusion de deux fiches désignant le même patient.
 * Les règles sont dans model.js (optionsCas, mainleveeRecente, apresMainlevee, doublonsPossibles, FUSION).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var H = 3600 * 1000;

  // ------------------------------------------------------------ Administration
  function panneauAdmin() {
    var o = M.optionsCas(U.config());
    var nom = 'ml-' + Math.random().toString(36).slice(2, 7);
    var rTout = h('input', { type: 'radio', name: nom, checked: o.mainleveeType === 'tout' });
    var rMeme = h('input', { type: 'radio', name: nom, checked: o.mainleveeType === 'meme' });
    var cbInfo = h('input', { type: 'checkbox', checked: o.mainleveeInfoSansDelai });
    var cbAilleurs = h('input', { type: 'checkbox', checked: o.debutAilleurs });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Cas particuliers' }),
      h('p', { class: 'muted', text: 'Situations moins fréquentes, à arbitrer par l’établissement. Chaque choix est tracé au journal.' }),
      h('h3', { text: 'Nouvelle mesure après une mainlevée du JLD' }),
      h('p', { class: 'muted', text: 'Article L. 3222-5-1, II : lorsque le juge ordonne la mainlevée, aucune nouvelle mesure ne peut être prise avant 48 heures, sauf survenance d’éléments nouveaux (décrits par le psychiatre dans son certificat) ; le directeur en informe le juge sans délai. L’outil affiche une alerte rouge à la saisie et un point de vigilance au tableau de bord.' }),
      h('div', { class: 'pile serre' },
        h('label', { class: 'case' }, rTout, h('span', { text: 'Alerter pour toute nouvelle mesure (isolement ou contention) dans les 48 h (recommandé)' })),
        h('label', { class: 'case' }, rMeme, h('span', { text: 'Alerter seulement pour une mesure du même type que celle levée' }))),
      h('label', { class: 'case' }, cbInfo, h('span', { text: 'Information du JLD due sans délai pour cette nouvelle mesure (échéance « Info avant » ramenée à son début)' })),
      h('h3', { text: 'Mesure débutée avant l’arrivée dans le service' }),
      h('label', { class: 'case' }, cbAilleurs, h('span', { text: 'Proposer, dans la nouvelle mesure, la saisie d’une mesure débutée ailleurs (urgences, autre établissement, unité pour malades difficiles…)' })),
      h('p', { class: 'muted', text: 'On saisit l’heure de la décision initiale et le lieu d’origine. Les délais JLD et les cumuls partent de la décision initiale (durée totale de la mesure) ; le registre et les statistiques du service partent de l’arrivée. Le décompte JLD présente la partie antérieure sur une ligne distincte. Les étapes JLD déjà faites se saisissent ensuite avec le bouton JLD, à leur date.' }),
      h('h3', { text: 'Fiches patient en double' }),
      h('p', { class: 'muted', text: 'Le cadre de santé peut fusionner deux fiches (onglet Patients, bouton « Fusionner »), après avoir vu l’effet sur les cumuls et les échéances JLD. La fusion est tracée et annulable. À la création d’un patient, une alerte signale les fiches proches (même IPP, même nom et prénom, ou même date de naissance et même nom ou prénom).' }),
      U.boutonEnregistrer(async function () {
        await U.enregistrerConfig([['casParticuliers', Object.assign({}, U.config().casParticuliers || {}, {
          mainleveeType: rMeme.checked ? 'meme' : 'tout', mainleveeInfoSansDelai: cbInfo.checked, debutAilleurs: cbAilleurs.checked
        })]]);
      }));
  }

  function resumeConfig(v) {
    var o = M.optionsCas({ casParticuliers: v });
    return 'alerte après mainlevée : ' + (o.mainleveeType === 'tout' ? 'toute nouvelle mesure' : 'même type') + ', information du JLD ' + (o.mainleveeInfoSansDelai ? 'sans délai' : 'selon les délais habituels') +
      ', mesure débutée ailleurs ' + (o.debutAilleurs ? 'proposée' : 'non proposée');
  }

  // ------------------------------------------------------------ Saisie
  /** Texte de l'alerte « mainlevée récente » (ou null). */
  function alerteMainlevee(patientId, type, instant) {
    if (!patientId) return null;
    var ml = M.mainleveeRecente(U.st(), patientId, type, instant);
    if (!ml) return null;
    return 'Mainlevée ' + (ml.type === 'Isolement' ? 'de l’isolement' : 'de la contention') + ' ordonnée par le JLD le ' + U.date(ml.date) +
      ' : aucune nouvelle mesure avant le ' + U.date(ml.date + 48 * H) + ', sauf éléments nouveaux (à décrire par le psychiatre dans le certificat). Le JLD doit être informé sans délai.';
  }

  /** Alerte « patient peut-être déjà connu » pour un nouveau patient. */
  function alerteDoublons(fiche) {
    if (!fiche.nom && !fiche.ipp) return [];
    return M.doublonsPossibles(U.st(), fiche).slice(0, 3).map(function (x) {
      var p = x.patient;
      return 'Patient peut-être déjà connu : ' + (p.nom || '?') + ' ' + (p.prenom || '') + (p.ipp ? ', IPP ' + p.ipp : '') + (p.naissance ? ', né(e) le ' + p.naissance.split('-').reverse().join('/') : '') +
        ' (' + x.raisons.join(', ') + '). S’il s’agit de lui, choisissez sa fiche dans la liste des patients.';
    });
  }

  // ------------------------------------------------------------ Fusion de fiches
  function libFiche(p) {
    return (p.nom || '?') + ' ' + (p.prenom || '') + (p.ipp ? ' — IPP ' + p.ipp : '') + (p.naissance ? ' — né(e) le ' + p.naissance.split('-').reverse().join('/') : '');
  }

  /** État simulé après la fusion (le journal n'est pas modifié). */
  function simuler(garde, absorbe) {
    var faux = { id: 'zzzzzzzz-simulation', at: new Date().toISOString(), by: 'simulation', type: 'FUSION', data: { garde: garde, absorbe: absorbe } };
    return M.reduire(U.App.session.evts.concat([faux]));
  }

  function impact(garde, absorbe) {
    var avant = U.st(), apres = simuler(garde, absorbe), maintenant = Date.now();
    var mesures = M.listeMesures(avant).filter(function (m) { return m.patientId === garde || m.patientId === absorbe; }).sort(function (a, b) { return a.debut - b.debut; });
    var lignes = [], chevauchements = [];
    mesures.forEach(function (m) {
      mesures.forEach(function (x) {
        if (x.id <= m.id || x.type !== m.type || x.patientId === m.patientId) return;
        var fm = typeof m.fin === 'number' ? m.fin : maintenant, fx = typeof x.fin === 'number' ? x.fin : maintenant;
        if (m.debut < fx && x.debut < fm) chevauchements.push(m.type + ' du ' + U.date(m.debut) + ' et ' + m.type.toLowerCase() + ' du ' + U.date(x.debut));
      });
      if (typeof m.fin === 'number') return;
      var a = M.suiviJLD(avant, m, maintenant), b = M.suiviJLD(apres, apres.mesures[m.id], maintenant);
      var diff = [['info', 'Info avant'], ['saisine', 'Saisine avant'], ['decision', 'Décision avant']].filter(function (k) { return a[k[0]].echeance !== b[k[0]].echeance; })
        .map(function (k) { return k[1] + ' : ' + U.date(a[k[0]].echeance) + ' → ' + U.date(b[k[0]].echeance); });
      lignes.push(h('li', {}, h('b', { text: m.type + ' en cours depuis le ' + U.date(m.debut) }), ' — cumul des 15 jours avant la mesure : ' + U.duree(a.cumulAvant) + ' → ' + U.duree(b.cumulAvant) +
        (diff.length ? ' ; échéances avancées : ' + diff.join(', ') : ' ; échéances inchangées')));
    });
    var cA = M.cumulsPatient(avant, garde, maintenant), cB = M.cumulsPatient(apres, garde, maintenant);
    return h('div', { class: 'pile' },
      h('div', { class: 'recap' },
        h('div', { text: mesures.filter(function (m) { return m.patientId === absorbe; }).length + ' mesure(s) rattachée(s) à la fiche conservée, ' + mesures.length + ' au total.' }),
        h('div', { text: 'Cumuls sur 15 jours de la fiche conservée : isolement ' + U.duree(cA.iso15) + ' → ' + U.duree(cB.iso15) + ', contention ' + U.duree(cA.cont15) + ' → ' + U.duree(cB.cont15) + '.' })),
      lignes.length ? h('ul', { class: 'vigilance' }, lignes) : h('small', { class: 'muted', text: 'Aucune mesure en cours : pas d’effet sur les échéances JLD en cours. Le registre et les statistiques sont recalculés avec la fiche conservée.' }),
      chevauchements.length ? h('div', { class: 'texte-bad', text: 'Mesures du même type qui se chevauchent : ' + chevauchements.join(' ; ') + '. Vérifiez qu’il ne s’agit pas de doublons de saisie (à annuler depuis le détail de la mesure).' }) : null);
  }

  function modaleFusion(p) {
    var etat = U.st();
    var proches = M.doublonsPossibles(etat, p, p.id);
    var idsProches = proches.map(function (x) { return x.patient.id; });
    var autres = Object.keys(etat.patients).map(function (k) { return etat.patients[k]; }).filter(function (x) { return x.id !== p.id && idsProches.indexOf(x.id) < 0; })
      .sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || ''); });
    var sel = h('select', {}, h('option', { value: '', text: '— Choisir l’autre fiche —' }),
      proches.length ? h('optgroup', { label: 'Fiches proches' }, proches.map(function (x) { return h('option', { value: x.patient.id, text: libFiche(x.patient) + ' (' + x.raisons.join(', ') + ')' }); })) : null,
      h('optgroup', { label: 'Autres fiches' }, autres.map(function (x) { return h('option', { value: x.id, text: libFiche(x) }); })));
    if (proches.length === 1) sel.value = proches[0].patient.id;
    var nom = 'garde-' + Math.random().toString(36).slice(2, 7);
    var rCelle = h('input', { type: 'radio', name: nom, checked: true }), rAutre = h('input', { type: 'radio', name: nom });
    var lblCelle = h('span'), lblAutre = h('span');
    var zone = h('div');
    var motif = h('input', { type: 'text', placeholder: 'Ex. : fiche créée sans IPP aux urgences', value: '' });
    function choix() { var autre = sel.value; return autre ? (rCelle.checked ? { garde: p.id, absorbe: autre } : { garde: autre, absorbe: p.id }) : null; }
    function maj() {
      U.vider(zone);
      var autre = etat.patients[sel.value];
      lblCelle.textContent = 'Garder cette fiche : ' + libFiche(p);
      lblAutre.textContent = autre ? 'Garder l’autre fiche : ' + libFiche(autre) : 'Garder l’autre fiche';
      var c = choix();
      if (!c) return;
      var g = etat.patients[c.garde], ab = etat.patients[c.absorbe];
      var ecarts = [['ipp', 'IPP'], ['naissance', 'date de naissance'], ['nom', 'nom'], ['prenom', 'prénom'], ['protection', 'protection juridique']].filter(function (k) {
        return g[k[0]] && ab[k[0]] && M.normaliserNom(g[k[0]]) !== M.normaliserNom(ab[k[0]]) && String(g[k[0]]) !== String(ab[k[0]]);
      }).map(function (k) { return k[1] + ' (' + g[k[0]] + ' gardé, ' + ab[k[0]] + ' abandonné)'; });
      zone.appendChild(h('div', { class: 'pile' }, h('h3', { text: 'Effet de la fusion' }),
        ecarts.length ? h('div', { class: 'texte-bad', text: 'Informations différentes entre les deux fiches : ' + ecarts.join(' ; ') + '. Les valeurs de la fiche conservée sont gardées ; vérifiez qu’il s’agit bien du même patient, puis corrigez la fiche si besoin.' }) : null,
        impact(c.garde, c.absorbe)));
    }
    [sel, rCelle, rAutre].forEach(function (x) { x.addEventListener('change', maj); });
    maj();
    U.modale('Fusionner deux fiches patient', h('div', { class: 'pile' },
      h('p', { class: 'muted', text: 'À utiliser quand deux fiches désignent le même patient. Les mesures, les modes d’hospitalisation et les informations manquantes de la fiche fusionnée sont rattachés à la fiche conservée ; les cumuls, les échéances JLD, le registre et les statistiques sont recalculés. La fusion est tracée au journal et peut être annulée.' }),
      h('label', {}, 'Autre fiche', sel),
      h('div', { class: 'pile serre' }, h('label', { class: 'case' }, rCelle, lblCelle), h('label', { class: 'case' }, rAutre, lblAutre)),
      zone, h('label', {}, 'Motif (obligatoire)', motif)), [
      { texte: 'Annuler' },
      { texte: 'Fusionner', classe: 'primaire', action: async function () {
        var c = choix();
        if (!c) throw new Error('Choisissez l’autre fiche.');
        if (!motif.value.trim()) { motif.focus(); throw new Error('Indiquez le motif de la fusion.'); }
        await U.App.session.enregistrer('FUSION', { garde: c.garde, absorbe: c.absorbe, motif: motif.value.trim() });
        U.toast('Fiches fusionnées.');
      } }], { large: true });
  }

  /** Paires de fiches proches parmi les patients donnés (pour l'onglet Patients). */
  function pairesProches(patients) {
    var etat = U.st(), vues = {}, res = [];
    patients.forEach(function (p) {
      M.doublonsPossibles(etat, p, p.id).forEach(function (x) {
        var k = [p.id, x.patient.id].sort().join('|');
        if (vues[k]) return; vues[k] = 1;
        res.push({ a: p, b: x.patient, raisons: x.raisons });
      });
    });
    return res;
  }

  U.cas = { panneauAdmin: panneauAdmin, resumeConfig: resumeConfig, alerteMainlevee: alerteMainlevee, alerteDoublons: alerteDoublons, modaleFusion: modaleFusion, pairesProches: pairesProches, libFiche: libFiche };
})();
