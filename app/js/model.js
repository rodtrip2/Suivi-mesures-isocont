// SPDX-License-Identifier: EUPL-1.2
/*
 * Modèle — reconstitution de l'état à partir du journal d'événements.
 * Aucun événement n'est jamais modifié : les corrections et annulations
 * sont elles-mêmes des événements. Les conflits (deux saisies concurrentes
 * sur la même donnée d'une même mesure) sont détectés et listés pour arbitrage.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.SIC = root.SIC || {}).model = factory(root.SIC.rules);
})(typeof self !== 'undefined' ? self : this, function (rules) {
  'use strict';

  var H = rules.H, J = rules.J;

  // ---------------------------------------------------------------- Rôles
  var ROLES = {
    IDE: 'IDE',
    AS: 'Aide-soignant(e)',
    SECRETAIRE: 'Secrétaire',
    CADRE: 'Cadre de santé',
    ADMIN: 'Administrateur'
  };

  /** Accès au mode formation : accordé à tous les comptes, sauf désactivation par l'administrateur. */
  function accesFormation(compte) { return !!compte && compte.id !== 'secours' && compte.formation !== false; }

  // Rôles qui exigent au moins un service affecté.
  var ROLES_DE_SERVICE = ['IDE', 'AS', 'SECRETAIRE', 'CADRE'];

  // Types d'événements autorisés par rôle. L'IDE dispose en permanence des
  // actions JLD (usage prévu le week-end et en l'absence de la secrétaire).
  var DROITS = {
    IDE: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD', 'INFORMATION', 'TRANSFERT', 'SOMATIQUE', 'SOMATIQUE_RETOUR', 'RECOURS', 'PROPOSITION', 'ENTRETIEN'],
    AS: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD', 'INFORMATION', 'TRANSFERT', 'SOMATIQUE', 'SOMATIQUE_RETOUR', 'RECOURS', 'PROPOSITION', 'ENTRETIEN'],   // mêmes droits que l'IDE
    SECRETAIRE: ['JLD', 'RECOURS'],
    CADRE: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD', 'INFORMATION', 'TRANSFERT', 'SOMATIQUE', 'SOMATIQUE_RETOUR', 'RECOURS', 'ENTRETIEN', 'CORRECTION', 'REFUS_PROPOSITION', 'ANNULATION', 'STATS', 'FUSION'],
    ADMIN: ['CONFIG', 'ANNULATION', 'COMPTE', 'LOT']
  };

  function peut(roles, typeEvenement) {
    return (roles || []).some(function (r) { return (DROITS[r] || []).indexOf(typeEvenement) >= 0; });
  }

  /** Services visibles par un compte : tous pour un administrateur, sinon ceux qui lui sont affectés. */
  function servicesDe(compte, config) {
    var tous = (config.services || []).map(function (s) { return s.code; });
    if (!compte) return [];
    if ((compte.roles || []).indexOf('ADMIN') >= 0) return tous;
    var affectes = compte.services || [];
    return tous.filter(function (c) { return affectes.indexOf(c) >= 0; });
  }

  // --------------------------------------------------------- Configuration
  var CONFIG_DEFAUT = {
    etablissement: '',
    services: [{ code: 'U1', libelle: 'Unité 1' }],
    lieuxCSI: { U1: ['CSI 1', 'CSI 2'] },
    psychiatres: [],
    periodes: [
      { code: 'M', libelle: 'Matin', debut: '07:00', fin: '14:00' },
      { code: 'AM', libelle: 'Après-midi', debut: '14:00', fin: '21:00' },
      { code: 'N', libelle: 'Nuit', debut: '21:00', fin: '07:00' }
    ],
    periodesService: {},       // surcharge par service : { U1: [ ...périodes ] }
    modesHospitalisation: [
      { code: 'SDT', libelle: "Soins à la demande d'un tiers", contrainte: true },
      { code: 'SDTU', libelle: "Soins à la demande d'un tiers en urgence", contrainte: true },
      { code: 'SPI', libelle: 'Soins pour péril imminent', contrainte: true },
      { code: 'SDRE', libelle: "Soins sur décision du représentant de l'État", contrainte: true },
      { code: 'SL', libelle: 'Soins libres', contrainte: false },
      { code: 'SL mineur', libelle: 'Soins libres - mineur', contrainte: false }
    ],
    parametres: {},            // surcharges des PARAMETRES_DEFAUT par type
    delaiModeHospiHeures: 12,  // registre : bascule SL -> contrainte retenue si < 12 h
    compteursRegistre: {},     // { U1: { 2026: 37 } } : dernier numéro déjà utilisé (registre papier antérieur)
    registreFige: {},          // { U1: { 2025: true } } : années dont les mesures importées gardent la numérotation du classeur
    derniersClasseur: {},      // { U1: { 2025: 37 } } : dernier numéro du registre du classeur importé (pour recalculer le compteur)
    registreFigeMesures: {},   // { mesureId: true|false } : décision mesure par mesure, prioritaire sur le choix de l'année
    decompte: {},              // masques du décompte JLD : { '*': masque de l'établissement, U1: masque du service } (voir masqueDecompte)
    inactiviteMinutes: 10,
    // Levées temporaires : retrancher les pauses des décomptes, reprise automatique à l'heure prévue, seuils (h).
    // Onglet Patients : colonnes annuelles, chacune regroupant des catégories du registre (A à E) ;
    // `alerte` : la colonne devrait rester à 0 (affichée en rouge sinon).
    colonnesPatients: [
      { libelle: 'Isolement seul', categories: ['A', 'B'], alerte: false },
      { libelle: 'Contention seule', categories: ['D', 'E'], alerte: true },
      { libelle: 'Isolement + contention', categories: ['C'], alerte: false }
    ],
    // active : bouton Pause disponible (toujours vrai si les pauses sont déduites) ;
    // portee : 'jld' (déduction pour les délais JLD seulement) ou 'partout' (aussi registre et statistiques) ;
    // colonneRegistre : colonne des levées temporaires dans le registre.
    // contentionSeule (pauses déduites partout) : pause de la contention seule, l'isolement continuant —
    // 'isolement' : ce temps devient de l'isolement seul (entrée A) ; 'contention' : il reste dans l'entrée C, non déduit.
    // verrouContention : interdit la pause de l'isolement seul pendant une contention (pause commune ou fin de la contention).
    pauses: { active: true, retrancher: false, portee: 'jld', contentionSeule: 'isolement', verrouContention: false, colonneRegistre: true, repriseAuto: false, alerteHeures: 12, refusHeures: 48 },
    // Cas particuliers (Administration → Cas particuliers), voir optionsCas :
    // mainleveeType : 'tout' (toute nouvelle mesure) ou 'meme' (même type) dans les 48 h suivant une mainlevée du JLD ;
    // mainleveeInfoSansDelai : l'information du JLD de cette nouvelle mesure est due sans délai (art. L. 3222-5-1, II) ;
    // debutAilleurs : saisie d'une mesure débutée avant l'arrivée dans le service (urgences, autre établissement).
    // somatique : passage en soins somatiques ou aux urgences pendant une mesure — 'poursuite-service' (la mesure continue,
    // lieu changé, comptée au registre du service), 'poursuite-registre' (comptée au registre du service `serviceSomatique`,
    // ex. « Hébergement somatique » ou « Urgences »), 'suspension' (mesure suspendue jusqu'au retour, période non comptée),
    // 'arret' (la mesure prend fin ; une nouvelle mesure est saisie au retour si besoin).
    casParticuliers: { mainleveeType: 'tout', mainleveeInfoSansDelai: true, debutAilleurs: true, somatique: 'poursuite-service', serviceSomatique: '' },
    // Qualité (Administration → Registre et statistiques), voir optionsQualite : motif du recours et entretien après
    // la mesure, facultatifs ; traces de surveillance aussi pour les mesures hors CSI ; durée de conservation (années).
    qualite: { motifRecours: false, motifsRecours: ['Prévention d’une violence imminente envers autrui', 'Prévention d’un passage à l’acte auto-agressif imminent', 'Agitation avec mise en danger', 'Risque de fugue avec mise en danger', 'Autre'],
      entretien: false, nomEntretien: 'Entretien après la mesure', surveillanceHorsCSI: false, conservationAns: 0 },
    rapportsAnnuels: {},
    sauvegarde: { rappelJours: 7 },   // rappel au tableau de bord (administrateur) d'une copie de sauvegarde complète
    // Méthode des statistiques (voir optionsStats) : tolérance de regroupement des entrées en séquences (minutes,
    // 0 = entrées qui se touchent, jusqu'à 48 h), unité principale du rapport, mentions affichées, méthode antérieure par année.
    statsMethode: { toleranceMinutes: 0, unitePrincipale: 'entrees', colonneSequences: false,
      mentions: { regles: true, changements: true, comparaison: false, methodeAnterieure: true }, methodesAnterieures: {} },      // { 2026: { politique, evaluation, actions, avisCDU, avisCS } } : textes de la trame du rapport annuel
    // Alertes de l'établissement (voir alertesConfig) : 'rappel' affiché à la saisie, ou 'information' d'une personne
    // à tracer dans un délai (0 = sans délai). services [] = tous. depuis : mesures saisies à partir de cette date.
    alertes: [
      { id: 'soins-libres', libelle: 'Patient en soins libres', active: false, declencheur: 'soins-libres', services: [], nature: 'information',
        destinataires: 'Cadre de santé ou administrateur de garde', delaiMinutes: 0, message: '', depuis: 0 },
      { id: 'contention-hors-csi', libelle: 'Contention hors CSI : exceptions prévues', active: true, declencheur: 'contention-hors-csi', services: [], nature: 'rappel',
        destinataires: '', delaiMinutes: 0, message: '', depuis: 0 }
    ]
  };

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  function periodesDe(config, service) {
    var ps = config.periodesService || {};
    return ps[service] && ps[service].length ? ps[service] : (config.periodes || []);
  }

  function estContrainte(config, code) {
    var def = (config.modesHospitalisation || []).filter(function (x) { return x.code === code; })[0];
    return def ? !!def.contrainte : true;
  }

  // ------------------------------------------------------------- Réduction
  function trierEvenements(evts) {
    return evts.slice().sort(function (a, b) {
      return a.at < b.at ? -1 : a.at > b.at ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }

  /** Un lot (import, données de démonstration) est un fichier unique contenant plusieurs saisies. */
  function deplier(evts) {
    var res = [];
    evts.forEach(function (e) {
      if (e.type !== 'LOT') { res.push(e); return; }
      res.push(e);
      (e.data.evenements || []).forEach(function (s, i) {
        res.push({ id: e.id + '.' + String(i).padStart(5, '0'), at: s.at || e.at, by: s.by || e.by, type: s.type, data: s.data, lot: e.id });
      });
    });
    return res;
  }

  /** Champ logique modifié par un événement sur une mesure (pour la détection de conflits). */
  function champ(e) {
    switch (e.type) {
      case 'MESURE_FIN': return 'fin';
      case 'PAUSE': case 'REPRISE': return 'pause';
      case 'JLD': return 'jld:' + e.data.cycle + ':' + e.data.nature;
      case 'CORRECTION': return 'corr:' + Object.keys(e.data.champs || {}).sort().join(',');
      default: return null;
    }
  }

  /**
   * Reconstitue l'état. `evts` : liste d'événements déchiffrés.
   * Retourne { config, patients, mesures, professionnels, saisiesStats, conflits, annules, journal, parId }.
   */
  function reduire(evts) {
    var st = {
      config: cloner(CONFIG_DEFAUT), fusions: {}, propositions: {},
      patients: {}, mesures: {}, professionnels: [], saisiesStats: {},
      conflits: [], annules: {}, journal: [], parId: {}, manquants: []
    };
    var tries = trierEvenements(deplier(evts));

    // 1) Annulations d'abord (elles neutralisent leur cible, quelle que soit leur date).
    tries.forEach(function (e) {
      st.parId[e.id] = e;
      if (e.type === 'ANNULATION' && e.data && e.data.cible) st.annules[e.data.cible] = e;
    });

    // Chaînage : chaque saisie cite la précédente du même agent ; un maillon absent signale un fichier supprimé.
    tries.forEach(function (e) {
      if (!e.lot && e.prec && !st.parId[e.prec]) st.manquants.push({ evt: e.id, manque: e.prec, by: e.by });
    });

        // 2) Application dans l'ordre chronologique de saisie.
    tries.forEach(function (e) {
      if (!e.lot) st.journal.push(e);
      if (e.type === 'ANNULATION' || e.type === 'LOT' || st.annules[e.id] || (e.lot && st.annules[e.lot])) return;
      appliquer(st, e);
    });
    return st;
  }

  /** Fiche qui porte aujourd'hui un patient (après fusions éventuelles). */
  function ciblePatient(st, id) {
    var n = 0;
    while (id && st.fusions[id] && n++ < 50) id = st.fusions[id];
    return id;
  }

  function appliquer(st, e) {
    var d = e.data || {}, m;
    if (d.patientId && st.fusions[d.patientId]) d = Object.assign({}, d, { patientId: ciblePatient(st, d.patientId) });
    switch (e.type) {
      case 'FUSION':
        var g = ciblePatient(st, d.garde), a = ciblePatient(st, d.absorbe);
        var pg = st.patients[g], pa = st.patients[a];
        if (!pg || !pa || g === a) break;
        ['ipp', 'nom', 'prenom', 'naissance', 'protection', 'service'].forEach(function (k) { if (!pg[k] && pa[k]) pg[k] = pa[k]; });
        pg.modes = pg.modes.concat(pa.modes).sort(function (x, y) { return x.date - y.date; });
        pg.fusionnes = (pg.fusionnes || []).concat([{ id: a, ipp: pa.ipp || '', nom: pa.nom || '', prenom: pa.prenom || '', naissance: pa.naissance || '', evt: e.id, motif: d.motif || '' }], pa.fusionnes || []);
        Object.keys(st.mesures).forEach(function (k) { if (st.mesures[k].patientId === a) st.mesures[k].patientId = g; });
        delete st.patients[a];
        st.fusions[a] = g;
        break;

      case 'CONFIG':
        st.config[d.cle] = cloner(d.valeur);
        break;

      case 'PATIENT':
        var p = st.patients[d.patientId] || { id: d.patientId, modes: [] };
        ['ipp', 'nom', 'prenom', 'naissance', 'protection', 'service', 'detenu'].forEach(function (k) { if (d[k] !== undefined) p[k] = d[k]; });
        st.patients[d.patientId] = p;
        break;

      case 'MODE_HOSPI':
        var pt = st.patients[d.patientId];
        if (pt) { pt.modes.push({ date: d.date, mode: d.mode, evt: e.id, by: e.by }); pt.modes.sort(function (a, b) { return a.date - b.date; }); }
        break;

      case 'STATS':
        var s = st.saisiesStats[d.service] = st.saisiesStats[d.service] || {};
        s[d.annee] = { hc: d.hc, ssc: d.ssc, commentaire: d.commentaire || '' };
        break;

      case 'MESURE_DEBUT':
        st.mesures[d.mesureId] = {
          id: d.mesureId, patientId: d.patientId, service: d.service, type: d.typeMesure,
          debut: d.debut, fin: null, lieu: d.lieu || '', csi: !!d.csi, exception: !!d.exception,
          // Mesure débutée avant l'arrivée dans le service : début de la décision initiale et lieu d'origine
          debutInitial: typeof d.debutInitial === 'number' && d.debutInitial < d.debut ? d.debutInitial : null, lieuInitial: d.lieuInitial || '',
          psychiatreDebut: d.psychiatre || '', psychiatreFin: '', modeHospi: d.modeHospi || '',
          cycle: 1, jld: {}, leveeJLD: false, tiers: [], pauses: [], creePar: e.by, creeLe: e.at,
          origine: d.origine || '', numeroOrigine: d.numeroOrigine || '', correctionImport: d.correctionImport || '', suite: d.suiteDe || '',
          // Import d'un registre : entrées d'origine (numéro, catégorie, période, soignants) et soignants cités
          entreesOrigine: d.entreesOrigine || null, professionnelsOrigine: d.professionnelsOrigine || '',
          informations: {}, segments: null, somatique: null, recours: [], motifRecours: d.motifRecours || '', entretien: null,
          version: 1, champs: {}, evts: [e.id]
        };
        break;

      default:
        if (!d.mesureId) { if (e.type === 'PROFESSIONNEL') appliquerProfessionnel(st, e); return; }
        m = st.mesures[d.mesureId];
        if (!m) return;
        if (!detecterConflit(st, m, e)) appliquerSurMesure(st, m, e);
        m.version += 1;
        m.evts.push(e.id);
    }
  }

  /** Vrai si `e` entre en conflit avec une saisie que son auteur n'avait pas vue : elle n'est alors pas appliquée. */
  function detecterConflit(st, m, e) {
    var c = champ(e);
    if (!c) return false;
    var precedent = m.champs[c];
    if (precedent && typeof e.base === 'number' && e.base < precedent.version && precedent.by !== e.by) {
      st.conflits.push({ mesureId: m.id, champ: c, retenu: precedent.id, concurrent: e.id });
      return true;
    }
    m.champs[c] = { id: e.id, by: e.by, version: m.version + 1 };
    return false;
  }

  function appliquerSurMesure(st, m, e) {
    var d = e.data;
    switch (e.type) {
      case 'MESURE_FIN':
        m.fin = d.fin; m.psychiatreFin = d.psychiatre || ''; m.motifFin = d.motif || '';
        break;
      case 'PAUSE':
        if (typeof m.fin === 'number') break;
        m.pauses.forEach(function (x) { if (x.reprise == null) x.reprise = d.debut; });   // une nouvelle pause clôt la précédente
        m.pauses.push({ debut: d.debut, reprisePrevue: d.reprisePrevue, reprise: null, psychiatre: d.psychiatre || '', motif: d.motif || '', evt: e.id, by: e.by });
        break;
      case 'REPRISE':
        var ouverte = m.pauses.filter(function (x) { return x.reprise == null && (!d.pause || x.evt === d.pause); }).pop();
        if (ouverte) { ouverte.reprise = d.date; ouverte.evtReprise = e.id; }
        break;
      case 'TRANSFERT':
      case 'SOMATIQUE':
      case 'SOMATIQUE_RETOUR':
        if (typeof m.fin === 'number' || typeof d.date !== 'number' || d.date <= m.debut) break;
        m.segments = m.segments || [{ debut: m.debut, service: m.service, lieu: m.lieu, csi: m.csi, exception: m.exception, nature: 'service' }];
        if (e.type === 'TRANSFERT') {
          m.segments.push({ debut: d.date, service: d.service, lieu: d.lieu || '', csi: !!d.csi, exception: !!d.exception, nature: 'service', transfert: true, evt: e.id });
          m.service = d.service; m.lieu = d.lieu || ''; m.csi = !!d.csi; m.exception = !!d.exception; m.somatique = null;
        } else if (e.type === 'SOMATIQUE') {
          var mode = d.mode === 'suspension' || d.mode === 'poursuite-registre' ? d.mode : 'poursuite-service';
          var seg = { debut: d.date, service: mode === 'poursuite-registre' && d.serviceRegistre ? d.serviceRegistre : m.service, lieu: d.lieu || 'Soins somatiques', csi: false, exception: false, nature: 'somatique', mode: mode, evt: e.id };
          m.segments.push(seg);
          m.somatique = { debut: d.date, lieu: seg.lieu, mode: mode, lieuAvant: m.lieu, csiAvant: m.csi };
        } else {
          var av = m.somatique || {};
          m.segments.push({ debut: d.date, service: m.service, lieu: d.lieu || av.lieuAvant || m.lieu, csi: d.csi != null ? !!d.csi : !!av.csiAvant, exception: !!d.exception, nature: 'service', retour: true, evt: e.id });
          m.lieu = d.lieu || av.lieuAvant || m.lieu; m.csi = d.csi != null ? !!d.csi : !!av.csiAvant; m.somatique = null;
        }
        m.segments.sort(function (a, b) { return a.debut - b.debut; });
        break;
      case 'ENTRETIEN':
        m.entretien = { realise: d.realise !== false, date: d.date, motif: d.motif || '', commentaire: d.commentaire || '', evt: e.id, by: e.by };
        break;
      case 'RECOURS':
        m.recours = m.recours || [];
        m.recours.push({ nature: d.nature, auteur: d.auteur || '', date: d.date, decision: d.decision || null, commentaire: d.commentaire || '', evt: e.id, by: e.by });
        if ((d.nature === 'DECISION' || d.nature === 'DECISION_APPEL') && d.decision === 'LEVEE') m.leveeJLD = true;
        break;
      case 'INFORMATION':
        m.informations = m.informations || {};
        m.informations[d.regle] = { regle: d.regle, libelle: d.libelle || '', personne: d.personne || '', moyen: d.moyen || '', date: d.date, commentaire: d.commentaire || '', evt: e.id, by: e.by };
        break;
      case 'TIERS':
        m.tiers.push({ cycle: d.cycle || m.cycle, statut: d.statut, personne: d.personne || '', informateur: d.informateur, nomInformateur: d.nomInformateur || '', date: d.date, motif: d.motif || '', evt: e.id, by: e.by });
        break;
      case 'JLD':
        var c = m.jld[d.cycle] = m.jld[d.cycle] || {};
        c[d.nature] = { date: d.date, by: e.by, evt: e.id, decision: d.decision || null };
        if (d.nature === 'DECISION') {
          if (d.decision === 'LEVEE') m.leveeJLD = true;          // indicateur légal : ne clôt pas la mesure
          else if (d.decision === 'MAINTIEN' && d.cycle === m.cycle) m.cycle += 1;
        }
        break;
      case 'PROPOSITION':
        st.propositions[e.id] = { id: e.id, mesureId: m.id, champs: d.champs || {}, motif: d.motif || '', by: e.by, at: e.at, statut: 'attente' };
        break;
      case 'REFUS_PROPOSITION':
        var pr = st.propositions[d.proposition];
        if (pr && pr.statut === 'attente') { pr.statut = 'refusee'; pr.decision = { by: e.by, at: e.at, motif: d.motif || '', evt: e.id }; }
        break;
      case 'CORRECTION':
        var ch = d.champs || {};
        var prop = d.proposition && st.propositions[d.proposition];
        if (prop && prop.statut === 'attente') { prop.statut = 'acceptee'; prop.decision = { by: e.by, at: e.at, motif: d.motif || '', evt: e.id }; }
        ['debut', 'fin', 'lieu', 'csi', 'psychiatreDebut', 'psychiatreFin', 'modeHospi', 'exception', 'type', 'debutInitial', 'lieuInitial', 'motifRecours'].forEach(function (k) {
          if (ch[k] !== undefined) m[k] = ch[k];
        });
        // Mesure découpée (transfert, soins somatiques) : le lieu corrigé est celui de la période en cours.
        if (m.segments) ['lieu', 'csi', 'exception'].forEach(function (k) { if (ch[k] !== undefined) m.segments[m.segments.length - 1][k] = ch[k]; });
        break;
    }
  }

  function appliquerProfessionnel(st, e) {
    var d = e.data;
    st.professionnels.push({ service: d.service, date: d.date, periode: d.periode, nom: d.nom, fonction: d.fonction || '', evt: e.id, by: e.by });
  }

  // ------------------------------------------------------- Vues calculées
  function listeMesures(st) {
    return Object.keys(st.mesures).map(function (k) { return st.mesures[k]; });
  }

  /** Échéances et statuts JLD d'une mesure pour un cycle (par défaut le cycle courant). */
  function suiviJLD(st, m, maintenant, cycle) {
    cycle = cycle || m.cycle;
    var toutes = mesuresCalcul(st, maintenant);
    m = toutes.filter(function (x) { return x.id === m.id; })[0] || m;
    var e = rules.echeances(toutes, m, cycle, st.config.parametres);
    var p = rules.params(m.type, st.config.parametres);
    var c = m.jld[cycle] || {};
    var eff = function (n) { return c[n] && typeof c[n].date === 'number' ? c[n].date : undefined; };
    var termine = typeof m.fin === 'number';
    function statut(ech, n) {
      var s = rules.statutEcheance(ech, eff(n), maintenant, p.seuilJaune);
      if (termine && (s === 'depasse' || s === 'proche' || s === 'ok')) return ech > m.fin ? 'na' : s;
      return s;
    }
    // Nouvelle mesure dans les 48 h suivant une mainlevée : information du juge sans délai.
    var ml = apresMainlevee(st, m);
    if (ml && cycle === 1 && optionsCas(st.config).mainleveeInfoSansDelai) e.info = Math.min(e.info, m.debut);
    return {
      cycle: cycle, rythmeLong: e.rythmeLong, apresMainlevee: ml, debutService: m.debutService || null,
      info: { echeance: e.info, effective: eff('INFO'), statut: statut(e.info, 'INFO') },
      saisine: { echeance: e.saisine, effective: eff('SAISINE'), statut: statut(e.saisine, 'SAISINE') },
      decision: { echeance: e.decision, effective: eff('DECISION'), statut: statut(e.decision, 'DECISION') },
      cumulAvant: rules.cumulAvantMesure(toutes, m, 15)
    };
  }

  // ------------------------------------------------- Levées temporaires
  // Une pause (levée temporaire décidée par le psychiatre, avec reprise prévue) ne met pas fin à la mesure.
  // Par défaut, la durée et les échéances JLD continuent de courir ; l'option `retrancher` soustrait les
  // pauses des durées et reporte les échéances d'autant. Au-delà de `refusHeures`, c'est une fin de mesure.
  var PAUSE_MAX_HEURES = 48;   // plafond légal : une interruption de 48 h ou plus n'est pas une levée temporaire

  function optionsPauses(config) {
    var o = Object.assign({}, CONFIG_DEFAUT.pauses, (config && config.pauses) || {});
    o.refusHeures = Math.min(PAUSE_MAX_HEURES, Math.max(1, +o.refusHeures || PAUSE_MAX_HEURES));
    o.alerteHeures = Math.max(0, Math.min(o.refusHeures, +o.alerteHeures || 0));
    o.retrancher = !!o.retrancher;
    o.active = o.retrancher || o.active !== false;
    if (o.portee !== 'partout') o.portee = 'jld';
    o.deduireRegistre = o.retrancher && o.portee === 'partout';
    if (o.contentionSeule !== 'contention') o.contentionSeule = 'isolement';
    o.verrouContention = o.verrouContention === true;
    o.colonneRegistre = o.active && o.colonneRegistre !== false;
    return o;
  }

  /**
   * Pause en cours (ou null). `depassee` : l'heure de reprise prévue est passée sans reprise saisie.
   * Avec la reprise automatique, la mesure reprend d'elle-même à l'heure prévue.
   */
  function pauseEnCours(m, maintenant, config) {
    if (typeof m.fin === 'number' || !m.pauses) return null;
    var p = m.pauses.filter(function (x) { return x.reprise == null && x.debut <= maintenant; }).pop();
    if (!p) return null;
    if (optionsPauses(config).repriseAuto && maintenant >= p.reprisePrevue) return null;
    return Object.assign({}, p, { depassee: maintenant > p.reprisePrevue });
  }

  /** Vrai si la pause a repris automatiquement (option activée, aucune reprise saisie, heure prévue atteinte). */
  function repriseAutomatique(m, p, maintenant, config) {
    return p.reprise == null && optionsPauses(config).repriseAuto && p.reprisePrevue <= Math.min(maintenant, typeof m.fin === 'number' ? m.fin : Infinity);
  }

  /** Fin effective d'une pause : reprise saisie, sinon reprise automatique, sinon fin de la mesure, sinon maintenant. */
  function finPause(m, p, maintenant, config) {
    if (p.reprise != null) return p.reprise;
    var limite = typeof m.fin === 'number' ? Math.min(m.fin, maintenant) : maintenant;
    if (optionsPauses(config).repriseAuto) return Math.min(p.reprisePrevue, limite);
    return limite;
  }

  /**
   * Plages retranchées des décomptes (option `retrancher`), sinon aucune.
   * Une pause non reprise n'est retranchée que jusqu'à l'heure de reprise prévue (calcul prudent).
   */
  function exclusions(m, maintenant, config) {
    if (!optionsPauses(config).retrancher) return [];
    return plagesPauses(m, maintenant).map(function (x) { return [x.debut, x.fin]; });
  }

  /** Plages de pause d'une mesure telles qu'elles seraient déduites : jusqu'à la reprise, ou au plus jusqu'à l'heure prévue. */
  function plagesPauses(m, maintenant) {
    var limite = typeof m.fin === 'number' ? Math.min(m.fin, maintenant) : maintenant;
    return (m.pauses || []).map(function (p) {
      var f = p.reprise != null ? p.reprise : p.reprisePrevue;
      return { debut: p.debut, fin: Math.min(f, limite), pause: p, nonConfirmee: p.reprise == null && f < limite };
    }).filter(function (x) { return x.fin > x.debut; }).sort(function (a, b) { return a.debut - b.debut; });
  }

  /** Mesures prêtes pour le moteur de règles : copies portant leurs plages retranchées si l'option est active. */
  /**
   * Mesures telles que comptées pour les délais légaux (JLD, cumuls, décompte) : pauses retranchées si l'option
   * est active, et début ramené à la décision initiale pour une mesure débutée avant l'arrivée dans le service
   * (`debutService` garde l'heure d'arrivée ; le registre du service, lui, part de l'arrivée).
   */
  function mesuresCalcul(st, maintenant) {
    var ms = listeMesures(st), retr = optionsPauses(st.config).retrancher;
    return ms.map(function (m) {
      var ailleurs = typeof m.debutInitial === 'number' && m.debutInitial < m.debut;
      var susp = suspensions(m, maintenant);
      if (!retr && !ailleurs && !susp.length) return m;
      var x = Object.assign({}, m);
      if (ailleurs) { x.debutService = m.debut; x.debut = m.debutInitial; }
      if (retr || susp.length) x.exclusions = (retr ? exclusions(m, maintenant, st.config) : []).concat(susp).sort(function (a, b) { return a[0] - b[0]; });
      return x;
    });
  }

  // ------------------------------------------------- Cas particuliers
  function optionsCas(config) {
    var o = Object.assign({}, CONFIG_DEFAUT.casParticuliers, (config && config.casParticuliers) || {});
    o.mainleveeType = o.mainleveeType === 'meme' ? 'meme' : 'tout';
    o.mainleveeInfoSansDelai = o.mainleveeInfoSansDelai !== false;
    o.debutAilleurs = o.debutAilleurs !== false;
    if (['poursuite-service', 'poursuite-registre', 'suspension', 'arret'].indexOf(o.somatique) < 0) o.somatique = 'poursuite-service';
    o.serviceSomatique = String(o.serviceSomatique || '');
    if (o.somatique === 'poursuite-registre' && !o.serviceSomatique) o.somatique = 'poursuite-service';
    return o;
  }

  /**
   * Morceaux d'une mesure pour le registre : une mesure transférée ou passée en soins somatiques est répartie
   * entre les services (et lieux) successifs ; une période de suspension n'est comptée nulle part.
   * Sans découpage, la mesure elle-même.
   */
  function morceaux(m) {
    if (!m.segments || m.segments.length < 2) return [m];
    var segs = m.segments.slice().sort(function (a, b) { return a.debut - b.debut; }), res = [];
    segs.forEach(function (sg, i) {
      var d = i === 0 ? m.debut : Math.max(sg.debut, m.debut);
      var f = i + 1 < segs.length ? segs[i + 1].debut : (typeof m.fin === 'number' ? m.fin : null);
      if (typeof m.fin === 'number') { if (d >= m.fin) return; if (f !== null && f > m.fin) f = m.fin; }
      if (f !== null && f <= d) return;
      if (sg.mode === 'suspension') return;
      res.push(Object.assign({}, m, { debut: d, fin: f, service: sg.service, lieu: sg.lieu, csi: sg.csi, exception: sg.exception, morceau: i, nature: sg.nature, debutMesure: m.debut }));
    });
    return res;
  }

  /** Périodes de suspension d'une mesure (soins somatiques, réglage « suspension ») : non comptées dans les durées. */
  function suspensions(m, maintenant) {
    if (!m.segments) return [];
    var segs = m.segments.slice().sort(function (a, b) { return a.debut - b.debut; }), res = [];
    var limite = typeof m.fin === 'number' ? m.fin : maintenant;
    segs.forEach(function (sg, i) {
      if (sg.mode !== 'suspension') return;
      var f = i + 1 < segs.length ? segs[i + 1].debut : limite;
      f = Math.min(f, limite);
      if (f > sg.debut) res.push([sg.debut, f]);
    });
    return res;
  }

  /** Mainlevées ordonnées par le JLD : [{ date, mesure, type, patientId }]. */
  function mainlevees(st, patientId) {
    var res = [];
    listeMesures(st).forEach(function (m) {
      if (m.patientId !== patientId) return;
      Object.keys(m.jld || {}).forEach(function (c) {
        var dec = m.jld[c].DECISION;
        if (dec && dec.decision === 'LEVEE' && typeof dec.date === 'number') res.push({ date: dec.date, mesure: m, type: m.type, patientId: patientId });
      });
      (m.recours || []).forEach(function (r) {
        if ((r.nature === 'DECISION' || r.nature === 'DECISION_APPEL') && r.decision === 'LEVEE' && typeof r.date === 'number') res.push({ date: r.date, mesure: m, type: m.type, patientId: patientId, recours: r.nature });
      });
    });
    return res.sort(function (a, b) { return a.date - b.date; });
  }

  /**
   * Mainlevée intervenue dans les 48 h précédant `instant` (art. L. 3222-5-1, II : aucune nouvelle mesure avant 48 h,
   * sauf éléments nouveaux ; le directeur en informe le juge sans délai). `exclure` : identifiant de la mesure étudiée.
   */
  function mainleveeRecente(st, patientId, type, instant, exclure) {
    var o = optionsCas(st.config);
    return mainlevees(st, patientId).filter(function (x) {
      return x.mesure.id !== exclure && x.date <= instant && instant < x.date + 48 * H && (o.mainleveeType === 'tout' || x.type === type);
    }).pop() || null;
  }

  /** Mainlevée précédant une mesure enregistrée (début initial si la mesure a débuté ailleurs). */
  function apresMainlevee(st, m) {
    var debut = typeof m.debutInitial === 'number' && m.debutInitial < m.debut ? m.debutInitial : m.debut;
    return mainleveeRecente(st, m.patientId, m.type, debut, m.id);
  }

  /** Plages de pause d'une mesure entre `d` et `f`, telles que comptées par l'établissement (déduites ou réelles). */
  function pausesSur(m, d, f, maintenant, config) {
    var plages = optionsPauses(config).retrancher ? plagesPauses(m, maintenant)
      : (m.pauses || []).map(function (p) { return { debut: p.debut, fin: finPause(m, p, maintenant, config), pause: p }; });
    return plages.map(function (q) { return { debut: Math.max(q.debut, d), fin: Math.min(q.fin, f), pause: q.pause }; })
      .filter(function (q) { return q.fin > q.debut; });
  }

  /** Durée cumulée des pauses d'une mesure (heures). */
  function dureePausesHeures(m, maintenant, config) {
    return (m.pauses || []).reduce(function (s, p) { return s + Math.max(0, finPause(m, p, maintenant, config) - p.debut); }, 0) / H;
  }

  /** Durée décomptée d'une mesure (heures) ; avec `config`, les pauses sont retranchées si l'option est active. */
  function dureeHeures(m, maintenant, config) {
    var fin = typeof m.fin === 'number' ? m.fin : maintenant;
    return rules.heuresEffectives({ exclusions: exclusions(m, maintenant, config).concat(suspensions(m, maintenant)) }, m.debut, fin);
  }

  /** Dernière information du tiers pour le cycle courant (ou null). */
  function tiersCycle(m, cycle) {
    cycle = cycle || m.cycle;
    var t = m.tiers.filter(function (x) { return x.cycle === cycle; });
    return t.length ? t[t.length - 1] : null;
  }

  function modeA(st, patientId, date) {
    var p = st.patients[patientId], mode = '';
    (p ? p.modes : []).forEach(function (x) { if (x.date <= date) mode = x.mode; });
    return mode;
  }

  /** Mode d'hospitalisation retenu pour une mesure (règle du registre V1.3). */
  function modeRetenu(st, m) {
    var p = st.patients[m.patientId];
    var modes = p ? p.modes : [];
    var auDebut = modeA(st, m.patientId, m.debut) || m.modeHospi, i;
    if (!estContrainte(st.config, auDebut)) {
      var limite = m.debut + (st.config.delaiModeHospiHeures || 12) * H;
      for (i = 0; i < modes.length; i++) {
        if (modes[i].date > m.debut && modes[i].date <= limite && estContrainte(st.config, modes[i].mode)) return { mode: modes[i].mode, bascule: true };
      }
    }
    return { mode: auDebut, bascule: false };
  }

  /** Âge révolu d'un patient à une date (null si la date de naissance est inconnue). */
  function ageAu(st, patientId, date) {
    var p = st.patients[patientId];
    if (!p || !p.naissance) return null;
    var n = new Date(p.naissance + 'T00:00:00'), d = new Date(date);
    if (isNaN(n.getTime())) return null;
    return d.getFullYear() - n.getFullYear() - ((d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) ? 1 : 0);
  }

  function estMineur(st, patientId, date) {
    var p = st.patients[patientId];
    if (!p) return false;
    if (modeA(st, patientId, date) === 'SL mineur') return true;
    if (!p.naissance) return false;
    var n = new Date(p.naissance + 'T00:00:00'), d = new Date(date);
    var age = d.getFullYear() - n.getFullYear() - ((d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) ? 1 : 0);
    return age < 18;
  }

  // ------------------------------------------------------- Qualité, droit d'accès, conservation
  function optionsQualite(config) {
    var o = Object.assign({}, CONFIG_DEFAUT.qualite, (config && config.qualite) || {});
    o.motifRecours = !!o.motifRecours; o.entretien = !!o.entretien; o.surveillanceHorsCSI = !!o.surveillanceHorsCSI;
    o.motifsRecours = (Array.isArray(o.motifsRecours) ? o.motifsRecours : CONFIG_DEFAUT.qualite.motifsRecours).map(function (x) { return String(x).trim(); }).filter(Boolean);
    o.nomEntretien = String(o.nomEntretien || '').trim() || CONFIG_DEFAUT.qualite.nomEntretien;
    o.conservationAns = Math.max(0, Math.round(+o.conservationAns || 0));
    return o;
  }

  /**
   * Toutes les données d'un patient (droit d'accès, art. 15 du RGPD) : fiche, modes d'hospitalisation, mesures
   * (lieux, pauses, JLD, tiers, recours, informations, entretien, motifs) et entrées du registre.
   */
  function donneesPatient(st, patientId, maintenant) {
    var p = st.patients[ciblePatient(st, patientId)];
    if (!p) return null;
    var mesures = listeMesures(st).filter(function (m) { return m.patientId === p.id; }).sort(function (a, b) { return a.debut - b.debut; });
    var services = {};
    mesures.forEach(function (m) { morceaux(m).forEach(function (x) { services[x.service] = 1; }); });
    var entrees = [];
    Object.keys(services).forEach(function (sv) {
      var ans = {};
      mesures.forEach(function (m) { ans[new Date(m.debut).getFullYear()] = 1; if (typeof m.fin === 'number') ans[new Date(m.fin).getFullYear()] = 1; });
      Object.keys(ans).forEach(function (an) { registre(st, sv, +an, maintenant).forEach(function (e) { if (e.patientId === p.id) entrees.push(e); }); });
    });
    return { patient: p, mesures: mesures, registre: entrees.sort(function (a, b) { return a.debut - b.debut; }) };
  }

  /** Patients dont la dernière mesure s'est terminée il y a plus de `ans` années (durée de conservation dépassée). */
  function auDelaConservation(st, ans, maintenant) {
    if (!ans) return [];
    var limite = new Date(maintenant); limite.setFullYear(limite.getFullYear() - ans);
    var derniere = {};
    listeMesures(st).forEach(function (m) {
      var f = typeof m.fin === 'number' ? m.fin : Infinity;
      if (!(m.patientId in derniere) || f > derniere[m.patientId]) derniere[m.patientId] = f;
    });
    return Object.keys(derniere).filter(function (id) { return derniere[id] < limite.getTime() && st.patients[id]; })
      .map(function (id) { return { patient: st.patients[id], derniereFin: derniere[id] }; });
  }

  /** Corrections proposées (par un IDE ou un AS) en attente de la décision du cadre. */
  function propositionsEnAttente(st, filtre) {
    return Object.keys(st.propositions || {}).map(function (k) { return st.propositions[k]; })
      .filter(function (p) { return p.statut === 'attente' && st.mesures[p.mesureId] && (!filtre || filtre(st.mesures[p.mesureId])); })
      .sort(function (a, b) { return a.at < b.at ? -1 : 1; });
  }

  // Motifs de fin de mesure (le premier est la décision médicale ordinaire).
  var MOTIFS_FIN = ['Décision médicale', 'Suite à la mainlevée du JLD', 'Sortie du patient', 'Transfert hors de l’établissement',
    'Passage en soins somatiques ou aux urgences', 'Fugue', 'Décès', 'Autre'];

  // ------------------------------------------------------- Fiches en double
  function normaliserNom(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(fictif\)/gi, '').replace(/[^a-z]/gi, '').toLowerCase();
  }

  /**
   * Fiches qui pourraient désigner le même patient que `fiche` ({ nom, prenom, naissance, ipp }) :
   * même IPP, même nom et prénom, ou même nom (ou prénom) et même date de naissance. `exclure` : id de la fiche elle-même.
   */
  function doublonsPossibles(st, fiche, exclure) {
    var n = normaliserNom(fiche.nom), pr = normaliserNom(fiche.prenom), ipp = String(fiche.ipp || '').trim();
    return Object.keys(st.patients).map(function (k) { return st.patients[k]; }).filter(function (p) { return p.id !== exclure; }).map(function (p) {
      var raisons = [];
      if (ipp && p.ipp && String(p.ipp).trim() === ipp) raisons.push('même IPP');
      var pn = normaliserNom(p.nom), pp = normaliserNom(p.prenom);
      if (n && pn === n && pr && pp === pr) raisons.push('même nom et prénom');
      else if (fiche.naissance && p.naissance === fiche.naissance && ((n && pn === n) || (pr && pp === pr))) raisons.push('même date de naissance et même ' + (n && pn === n ? 'nom' : 'prénom'));
      return raisons.length ? { patient: p, raisons: raisons } : null;
    }).filter(Boolean);
  }

  // ------------------------------------------------------- Alertes de l'établissement
  var DECLENCHEURS_ALERTE = {
    'soins-libres': 'Patient en soins libres au début de la mesure',
    'mineur': 'Patient mineur',
    'protection': 'Patient sous protection juridique',
    'detenu': 'Patient détenu',
    'contention-hors-csi': 'Contention hors chambre de soins intensifs',
    'isolement-hors-csi': 'Isolement hors chambre de soins intensifs',
    'contention': 'Toute contention',
    'toute-mesure': 'Toute nouvelle mesure'
  };
  // Textes proposés par défaut (modifiables par l'établissement).
  var TEXTES_ALERTE = {
    'soins-libres': 'L’isolement et la contention ne peuvent concerner que des patients en hospitalisation complète sans consentement (art. L. 3222-5-1 CSP). ' +
      'À titre exceptionnel et en urgence, l’isolement d’un patient en soins libres doit être le plus court possible, 12 heures au maximum, ' +
      'le temps de résoudre la situation ou d’engager la transformation du mode d’hospitalisation (recommandations HAS, 2017).',
    'contention-hors-csi': 'La contention mécanique est une pratique de dernier recours, « prise dans le cadre d’une mesure d’isolement » (art. L. 3222-5-1 CSP), ' +
      'dans un espace dédié et équipé. Seule exception prévue (recommandations HAS, 2017) : la contention mécanique ambulatoire (vêtement de contention par exemple) ' +
      'pour des troubles psychiatriques gravissimes de longue évolution avec conduites auto-agressives ou mutilations répétées, afin de préserver l’intégrité physique du patient. ' +
      'Elle s’inscrit dans un plan de soins spécifique établi par le psychiatre traitant, en dehors de l’urgence, et fait l’objet d’une évaluation clinique régulière : ' +
      'cochez alors « exception prévue » (catégorie E). Toute autre contention hors espace d’isolement doit rester très exceptionnelle et être motivée dans le dossier du patient (catégorie D).',
    'mineur': 'Patient mineur : vigilance renforcée ; informer les titulaires de l’autorité parentale.',
    'protection': 'Patient sous mesure de protection juridique : informer la personne chargée de la mesure de protection.',
    'isolement-hors-csi': 'Isolement hors chambre de soins intensifs : situation qui doit rester très exceptionnelle, à motiver dans le dossier du patient.',
    'detenu': 'Patient détenu (soins psychiatriques des personnes détenues, art. L. 3214-1 et suivants du code de la santé publique) : appliquer la procédure de l’établissement (information de l’établissement pénitentiaire, mesures de sécurité).',
    'contention': '', 'toute-mesure': ''
  };
  var DELAIS_ALERTE = [0, 15, 30, 60, 120, 240, 720, 1440];

  /** Règles d'alerte validées (texte par défaut si le message est vide). */
  function alertesConfig(config) {
    var liste = Array.isArray(config && config.alertes) ? config.alertes : CONFIG_DEFAUT.alertes;
    return liste.filter(function (r) { return r && DECLENCHEURS_ALERTE[r.declencheur]; }).map(function (r, i) {
      return {
        id: String(r.id || 'alerte-' + i), libelle: String(r.libelle || DECLENCHEURS_ALERTE[r.declencheur]), active: !!r.active, declencheur: r.declencheur,
        services: Array.isArray(r.services) ? r.services.filter(Boolean) : [], nature: r.nature === 'information' ? 'information' : 'rappel',
        destinataires: String(r.destinataires || ''), delaiMinutes: Math.max(0, Math.round(+r.delaiMinutes || 0)),
        message: String(r.message || '').trim() || TEXTES_ALERTE[r.declencheur] || '', messagePropre: !!String(r.message || '').trim(), depuis: +r.depuis || 0
      };
    });
  }

  /** Faits qui déclenchent les alertes, pour une mesure enregistrée. */
  function faitsMesure(st, m) {
    var p = st.patients[m.patientId] || {};
    return {
      type: m.type, csi: !!m.csi, service: m.service,
      libre: !estContrainte(st.config, modeA(st, m.patientId, m.debut) || m.modeHospi),
      mineur: estMineur(st, m.patientId, m.debut), protection: !!p.protection, detenu: !!p.detenu
    };
  }

  function declenche(regle, f) {
    switch (regle.declencheur) {
      case 'soins-libres': return f.libre;
      case 'mineur': return f.mineur;
      case 'protection': return f.protection;
      case 'detenu': return f.detenu;
      case 'contention-hors-csi': return f.type === 'Contention' && !f.csi;
      case 'isolement-hors-csi': return f.type === 'Isolement' && !f.csi;
      case 'contention': return f.type === 'Contention';
      case 'toute-mesure': return true;
      default: return false;
    }
  }

  /** Règles actives déclenchées par des faits (saisie en cours ou mesure enregistrée). */
  function reglesDeclenchees(config, f) {
    return alertesConfig(config).filter(function (r) {
      return r.active && (!r.services.length || r.services.indexOf(f.service) >= 0) && declenche(r, f);
    });
  }

  /**
   * Alertes d'une mesure enregistrée. Les mesures importées et celles saisies avant l'activation
   * de la règle ne déclenchent rien (l'information n'a pas pu être tracée dans l'outil).
   */
  function alertesMesure(st, m) {
    if (m.origine) return [];
    var saisie = Date.parse(m.creeLe) || m.debut;
    return reglesDeclenchees(st.config, faitsMesure(st, m)).filter(function (r) { return saisie >= r.depuis; });
  }

  /** Informations à tracer : [{ mesure, regle, echeance, retard }], les plus urgentes d'abord. */
  function informationsATracer(st, maintenant, filtre) {
    var res = [];
    listeMesures(st).forEach(function (m) {
      if (filtre && !filtre(m)) return;
      alertesMesure(st, m).forEach(function (r) {
        if (r.nature !== 'information' || (m.informations && m.informations[r.id])) return;
        var ech = m.debut + r.delaiMinutes * 60000;
        res.push({ mesure: m, regle: r, echeance: ech, retard: maintenant > ech });
      });
    });
    return res.sort(function (a, b) { return a.echeance - b.echeance; });
  }

  /** Cumuls glissants d'un patient (heures) et niveau d'alerte V1.3 (vert / jaune / rouge). */
  function cumulsPatient(st, patientId, maintenant) {
    var toutes = mesuresCalcul(st, maintenant);
    var c = {
      iso48: rules.cumulHeures(toutes, patientId, 'Isolement', maintenant, 2),
      cont48: rules.cumulHeures(toutes, patientId, 'Contention', maintenant, 2),
      iso15: rules.cumulHeures(toutes, patientId, 'Isolement', maintenant, 15),
      cont15: rules.cumulHeures(toutes, patientId, 'Contention', maintenant, 15)
    };
    c.niveau = (c.iso15 >= 48 || c.cont15 >= 24) ? 'rouge' : (c.iso15 >= 24 || c.cont15 >= 12) ? 'jaune' : 'vert';
    return c;
  }

  // ------------------------------------------------ Postes de surveillance
  function minutes(hhmm) { var x = hhmm.split(':'); return (+x[0]) * 60 + (+x[1]); }

  /** Instance de période [debut, fin] pour une date locale AAAA-MM-JJ. */
  function bornesPeriode(dateISO, periode) {
    // Constructeur en heure locale : correct aussi les jours de changement d'heure.
    var j = dateISO.split('-');
    var a = minutes(periode.debut), b = minutes(periode.fin);
    var debut = new Date(+j[0], +j[1] - 1, +j[2], 0, a).getTime();
    var fin = new Date(+j[0], +j[1] - 1, +j[2], 0, b <= a ? b + 1440 : b).getTime();
    return [debut, fin];
  }

  function dateLocaleISO(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /**
   * Postes (date × période) couverts par une mesure en CSI d'un service sur
   * les `jours` derniers jours, avec les professionnels saisis.
   * Deux emplacements par poste, comme en V1.3.
   */
  function postesSurveillance(st, service, maintenant, jours) {
    jours = jours || 7;
    var depuis = maintenant - jours * J;
    var horsCSI = optionsQualite(st.config).surveillanceHorsCSI;
    var csi = listeMesures(st).filter(function (m) {
      return m.service === service && (m.csi || horsCSI) && (typeof m.fin !== 'number' || m.fin >= depuis) && m.debut <= maintenant;
    });
    var postes = {};
    var periodes = periodesDe(st.config, service);
    var d = new Date(depuis - J); d.setHours(12, 0, 0, 0);
    for (; d.getTime() <= maintenant + J; d.setDate(d.getDate() + 1)) {
      var dateISO = dateLocaleISO(d.getTime());
      periodes.forEach(function (p) {
        var b = bornesPeriode(dateISO, p);
        if (b[0] > maintenant || b[1] < depuis) return;
        var couvert = csi.some(function (m) { var f = typeof m.fin === 'number' ? m.fin : maintenant; return m.debut < b[1] && f > b[0]; });
        if (!couvert) return;
        postes[dateISO + '|' + p.code] = { date: dateISO, periode: p.code, libelle: p.libelle, debut: b[0], fin: b[1], professionnels: [] };
      });
    }
    st.professionnels.forEach(function (x) {
      var cle = x.date + '|' + x.periode;
      if (x.service === service && postes[cle]) postes[cle].professionnels.push(x);
    });
    return Object.keys(postes).map(function (k) { return postes[k]; })
      .sort(function (a, b) { return b.debut - a.debut; });
  }

  // ---------------------------------------------------- Registre anonymisé
  /** Soustrait des intervalles [a,b] à un intervalle [d,f]. */
  function soustraire(d, f, trous) {
    var morceaux = [[d, f]];
    trous.forEach(function (t) {
      var res = [];
      morceaux.forEach(function (x) {
        if (t[1] <= x[0] || t[0] >= x[1]) { res.push(x); return; }
        if (t[0] > x[0]) res.push([x[0], t[0]]);
        if (t[1] < x[1]) res.push([t[1], x[1]]);
      });
      morceaux = res;
    });
    return morceaux.filter(function (x) { return x[1] > x[0]; });
  }

  var LIB_CATEGORIES = {
    A: 'Isolement en espace dédié (CSI)',
    B: 'Isolement hors espace dédié',
    C: 'Contention en espace dédié (CSI)',
    D: "Contention hors espace d'isolement",
    E: "Contention hors espace d'isolement (exception prévue)"
  };

  /** Intersection de deux listes de plages. */
  function intersection(a, b) {
    var r = [];
    a.forEach(function (x) { b.forEach(function (y) { var d = Math.max(x[0], y[0]), f = Math.min(x[1], y[1]); if (f > d) r.push([d, f]); }); });
    return r;
  }

  /**
   * Plages déduites de la durée d'une entrée du registre (pauses déduites partout). Entrée C avec le réglage
   * contentionSeule = 'contention' : seules les pauses où l'isolement est lui aussi suspendu sont déduites.
   */
  function exclusionsRegistre(st, x, maintenant) {
    var op = optionsPauses(st.config);
    if (!op.deduireRegistre) return [];
    var ex = exclusions(x.mesure, maintenant, st.config);
    if (x.cat !== 'C' || op.contentionSeule !== 'contention' || !ex.length) return ex;
    var iso = [];
    listeMesures(st).forEach(function (i) { if (i.type === 'Isolement' && i.csi && i.patientId === x.mesure.patientId) iso = iso.concat(exclusions(i, maintenant, st.config)); });
    return intersection(ex, iso);
  }

  /** Entrées brutes (catégorisées) d'un service, toutes années. */
  /** Vrai si la mesure (importée, numérotée dans le classeur) garde la numérotation du classeur pour son année. */
  function estFigee(st, m) {
    if (!m.numeroOrigine) return false;
    var parMesure = (st.config.registreFigeMesures || {})[m.id];
    if (parMesure === true || parMesure === false) return parMesure;
    var f = (st.config.registreFige || {})[m.service] || {};
    return !!f[new Date(m.debut).getFullYear()];
  }

  /**
   * Compteur cohérent avec la numérotation choisie pour une année importée : le dernier numéro du classeur si la
   * numérotation du classeur est conservée, sinon ce numéro diminué des entrées que l'outil numérotera lui-même
   * à partir des mesures importées. null si le dernier numéro du classeur n'est pas connu.
   */
  function compteurPour(st, service, annee, figer, maintenant) {
    var dernier = ((st.config.derniersClasseur || {})[service] || {})[annee];
    if (dernier == null) return null;
    if (figer) return +dernier;
    var fige = JSON.parse(JSON.stringify(st.config.registreFige || {}));
    if (fige[service]) delete fige[service][annee];
    var tmp = Object.assign({}, st, { config: Object.assign({}, st.config, { registreFige: fige }) });
    var n = registre(tmp, service, annee, maintenant).filter(function (e) { return e.fin !== null && (st.mesures[e.mesureId] || {}).numeroOrigine; }).length;
    return Math.max(0, +dernier - n);
  }

  var REGLES_CATEGORIES = {
    A: 'isolement en chambre de soins intensifs',
    B: 'isolement hors chambre de soins intensifs',
    C: 'contention en chambre de soins intensifs (elle couvre l’isolement qui l’accompagne)',
    D: 'contention hors espace d’isolement, sans exception prévue',
    E: 'contention hors espace d’isolement, exception prévue'
  };

  /**
   * Pourquoi une entrée du registre a sa catégorie : règle appliquée et données de la mesure,
   * et, pour une mesure importée, comparaison avec la catégorie inscrite dans le classeur.
   */
  function explicationEntree(st, e) {
    var m = st.mesures[e.mesureId] || {}, lieu = m.lieu || (m.csi ? 'CSI' : 'hors CSI');
    if (e.fige) return 'Catégorie et numéro repris du document importé (' + e.numero + ').';
    var t = 'Catégorie ' + e.categorie + ' : ' + REGLES_CATEGORIES[e.categorie] + ' — lieu « ' + lieu + ' »';
    if (m.type === 'Contention' && !m.csi) t += ', case « exception » ' + (m.exception ? 'cochée' : 'non cochée');
    if (e.categorie === 'A' && (e.debut !== m.debut || (e.fin !== null && e.fin !== m.fin))) t += ', portion de l’isolement en dehors de la contention en CSI';
    t += '.';
    var no = String(m.numeroOrigine || '').trim().toUpperCase(), mo = /^([A-E])/.exec(no);
    if (mo && mo[1] !== e.categorie) {
      var piste = (mo[1] === 'D' && e.categorie === 'E') || (mo[1] === 'E' && e.categorie === 'D') ? 'vérifier la case « exception » de la mesure'
        : /[AB]/.test(mo[1] + e.categorie) && /[CDE]/.test(mo[1] + e.categorie) ? 'vérifier le type de mesure ou la contention concomitante'
        : 'vérifier le lieu (CSI ou non)';
      t += ' Le document importé indiquait ' + mo[1] + ' (' + no + ') : ' + piste + '.';
    }
    return t;
  }

  function entreesRegistre(st, service, maintenant) {
    var ms = [];
    listeMesures(st).forEach(function (m) { if (typeof m.debut === 'number') morceaux(m).forEach(function (x) { if (x.service === service) ms.push(x); }); });
    var entrees = [];
    ms.forEach(function (m) {
      var fin = typeof m.fin === 'number' ? m.fin : null;
      if (estFigee(st, m) && m.entreesOrigine && m.entreesOrigine.length) {
        // Registre importé, numérotation conservée : ses lignes sont reprises à l'identique.
        m.entreesOrigine.forEach(function (o) {
          var no = String(o.numero || '').trim().toUpperCase(), mo = /^([A-E])\s*-?\s*(\d+)$/.exec(no);
          entrees.push({ cat: o.categorie || (mo ? mo[1] : 'A'), mesure: m, debut: o.debut, fin: o.fin == null ? null : o.fin, fige: true, numero: mo ? mo[1] + mo[2] : no, rang: mo ? +mo[2] : 0, professionnelsOrigine: o.professionnels || '' });
        });
        return;
      }
      if (estFigee(st, m)) {
        // Numérotation du classeur conservée : une entrée par mesure, catégorie et numéro du classeur.
        var no = String(m.numeroOrigine).trim().toUpperCase(), mo = /^([A-E])\s*-?\s*(\d+)$/.exec(no);
        var calc = m.type === 'Contention' ? (m.csi ? 'C' : (m.exception ? 'E' : 'D')) : (m.csi ? 'A' : 'B');
        entrees.push({ cat: mo ? mo[1] : calc, mesure: m, debut: m.debut, fin: fin, fige: true, numero: mo ? mo[1] + mo[2] : no, rang: mo ? +mo[2] : 0 });
        return;
      }
      if (m.type === 'Contention') {
        entrees.push({ cat: m.csi ? 'C' : (m.exception ? 'E' : 'D'), mesure: m, debut: m.debut, fin: fin });
      } else if (!m.csi) {
        entrees.push({ cat: 'B', mesure: m, debut: m.debut, fin: fin });
      } else {
        var finCalc = fin === null ? maintenant : fin;
        // Les portions couvertes par une contention en CSI deviennent l'entrée C. Si les pauses sont déduites
        // partout, une pause de la contention pendant laquelle l'isolement continue redevient de l'isolement seul (A).
        var opR = optionsPauses(st.config), deduire = opR.deduireRegistre && opR.contentionSeule === 'isolement', contentions = [];
        ms.filter(function (c) {
          return c.type === 'Contention' && c.csi && c.patientId === m.patientId;
        }).forEach(function (c) {
          var cf = typeof c.fin === 'number' ? c.fin : maintenant;
          contentions = contentions.concat(deduire ? rules.retrancher(c.debut, cf, exclusions(c, maintenant, st.config)) : [[c.debut, cf]]);
        });
        soustraire(m.debut, finCalc, contentions).forEach(function (x) {
          entrees.push({ cat: 'A', mesure: m, debut: x[0], fin: (fin === null && x[1] === finCalc) ? null : x[1] });
        });
      }
    });
    return entrees;
  }

  function professionnelsSur(st, service, debut, fin) {
    return professionnelsDetailSur(st, service, debut, fin).map(function (p) { return p.nom + (p.fonction ? ' (' + p.fonction + ')' : ''); });
  }

  /**
   * Professionnels d'une entrée du registre : traces de surveillance en CSI (catégories A et C) ; à défaut,
   * soignants cités par le registre importé (« Nom (fonction) ; … »).
   */
  function professionnelsEntree(st, service, x, finRef) {
    var pros = (x.cat === 'A' || x.cat === 'C' || optionsQualite(st.config).surveillanceHorsCSI) ? professionnelsDetailSur(st, service, x.debut, finRef) : [];
    if (pros.length) return pros;
    var cites = x.professionnelsOrigine || (x.fige ? '' : x.mesure.professionnelsOrigine) || '';
    return String(cites).split(/[;\n]+/).map(function (t) { t = t.trim(); var mo = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(t); return t ? { nom: mo ? mo[1] : t, fonction: mo ? mo[2] : '' } : null; }).filter(Boolean);
  }

  /** Professionnels (nom, fonction) ayant surveillé une CSI d'un service entre `debut` et `fin`, sans doublon. */
  function professionnelsDetailSur(st, service, debut, fin) {
    var pros = [], vus = {}, periodes = periodesDe(st.config, service);
    st.professionnels.forEach(function (p) {
      if (p.service !== service) return;
      var per = periodes.filter(function (q) { return q.code === p.periode; })[0];
      if (!per) return;
      var b = bornesPeriode(p.date, per);
      if (b[0] < fin && b[1] > debut) {
        var cle = p.nom + '|' + (p.fonction || '');
        if (!vus[cle]) { vus[cle] = 1; pros.push({ nom: p.nom, fonction: p.fonction || '' }); }
      }
    });
    return pros;
  }

  /**
   * Registre d'un service pour une année (année du début de l'entrée).
   * A : isolement en CSI · B : isolement hors CSI · C : contention en CSI
   * D : contention hors espace d'isolement · E : idem, exception prévue.
   * Une contention en CSI couvre l'isolement qui l'accompagne : seules les
   * portions d'isolement non couvertes deviennent des entrées A.
   * Numérotation commune aux catégories, attribuée aux entrées terminées
   * dans l'ordre de leur fin (comme en V1.3), à la suite du dernier numéro
   * du registre antérieur s'il a été paramétré. Les entrées en cours n'ont
   * pas encore de numéro.
   */
  function registre(st, service, annee, maintenant) {
    var debutAn = new Date(annee, 0, 1).getTime(), finAn = new Date(annee + 1, 0, 1).getTime();
    var entrees = entreesRegistre(st, service, maintenant)
      .filter(function (x) { return x.debut >= debutAn && x.debut < finAn; });
    var terminees = entrees.filter(function (x) { return x.fin !== null; })
      .sort(function (a, b) { return a.fin - b.fin || a.debut - b.debut || (a.mesure.id < b.mesure.id ? -1 : 1); });
    var enCours = entrees.filter(function (x) { return x.fin === null; }).sort(function (a, b) { return a.debut - b.debut; });
    var depart = +(((st.config.compteursRegistre || {})[service] || {})[annee] || 0);
    // Numéros conservés du classeur : la numérotation de l'outil part du compteur et saute les numéros déjà pris.
    var pris = {};
    entrees.forEach(function (x) { if (x.fige && x.rang) pris[x.rang] = true; });
    var rang = depart;
    function suivant() { do { rang++; } while (pris[rang]); return rang; }
    return terminees.concat(enCours).map(function (x) {
      var mode = modeRetenu(st, x.mesure);
      var finRef = x.fin === null ? maintenant : x.fin;
      return {
        numero: x.fige ? x.numero : x.fin === null ? '' : x.cat + suivant(), fige: !!x.fige,
        categorie: x.cat, debut: x.debut, fin: x.fin,
        dureeHeures: rules.heuresEffectives({ exclusions: exclusionsRegistre(st, x, maintenant) }, x.debut, finRef),
        dureeReelleHeures: (finRef - x.debut) / H,
        pauses: pausesSur(x.mesure, x.debut, finRef, maintenant, st.config).map(function (q) { return [q.debut, q.fin]; }),
        type: x.mesure.type, lieu: x.mesure.lieu,
        psychiatre: x.mesure.psychiatreDebut, modeHospi: mode.mode, basculeMode: mode.bascule,
        professionnelsDetail: (x._pd = professionnelsEntree(st, service, x, finRef)),
        professionnels: x._pd.map(function (p) { return p.nom + (p.fonction ? ' (' + p.fonction + ')' : ''); }),
        ipp: (st.patients[x.mesure.patientId] || {}).ipp || '', age: ageAu(st, x.mesure.patientId, x.debut),
        mesureId: x.mesure.id, patientId: x.mesure.patientId, service: service
      };
    });
  }

  // ------------------------------------------ Statistiques annuelles par patient
  /** Colonnes annuelles de l'onglet Patients (paramétrage validé : catégories A à E connues, libellé non vide). */
  function colonnesPatients(config) {
    var c = (config && config.colonnesPatients) || CONFIG_DEFAUT.colonnesPatients;
    return c.map(function (x) {
      return { libelle: String(x.libelle || '').trim(), categories: (x.categories || []).filter(function (k) { return LIB_CATEGORIES[k]; }), alerte: !!x.alerte };
    }).filter(function (x) { return x.libelle && x.categories.length; });
  }

  /**
   * Pour une année (année du début de l'entrée) et des services : par patient, nombre d'entrées du registre
   * et durée cumulée pour chaque colonne paramétrée, et nombre de mesures d'isolement et de contention
   * (décompte du juge, qui les compte séparément).
   * Retourne { colonnes, parPatient: { id: { colonnes: [{ n, heures }], isolements, contentions } } }.
   */
  function statistiquesPatients(st, services, annee, maintenant) {
    var cols = colonnesPatients(st.config), res = {};
    var debutAn = new Date(annee, 0, 1).getTime(), finAn = new Date(annee + 1, 0, 1).getTime();
    function ligne(id) {
      if (!res[id]) res[id] = { colonnes: cols.map(function () { return { n: 0, heures: 0, enCours: 0 }; }), isolements: 0, contentions: 0 };
      return res[id];
    }
    services.forEach(function (sv) {
      registre(st, sv, annee, maintenant).forEach(function (e) {
        var l = ligne(e.patientId);
        cols.forEach(function (c, i) {
          if (c.categories.indexOf(e.categorie) < 0) return;
          l.colonnes[i].n++; l.colonnes[i].heures += e.dureeHeures;
          if (e.fin === null) l.colonnes[i].enCours++;
        });
      });
    });
    listeMesures(st).forEach(function (m) {
      if (services.indexOf(m.service) < 0 || m.debut < debutAn || m.debut >= finAn) return;
      var l = ligne(m.patientId);
      if (m.type === 'Isolement') l.isolements++; else l.contentions++;
    });
    if (optionsStats(st.config).colonneSequences) {
      sequences(st, services, annee, maintenant).forEach(function (q) { var l = ligne(q.patientId); l.sequences = (l.sequences || 0) + 1; l.heuresSequences = (l.heuresSequences || 0) + q.dureeHeures; });
    }
    return { colonnes: cols, parPatient: res, sequences: optionsStats(st.config).colonneSequences };
  }

  // ------------------------------------------ Registre pour communication (CADA)
  /**
   * Options d'occultation du registre communiqué à un tiers (demande CADA, art. L. 311-6 CRPA).
   * Par défaut, les options les plus protectrices (CE, 8 février 2023, n° 455887).
   */
  var OCCULTATION_DEFAUT = { patient: 'masquer', age: 'mineur', dates: 'jour', psychiatre: 'masquer', professionnels: 'masquer', lieu: 'masquer', mode: 'afficher', pauses: 'afficher' };
  var OCCULTATION_CHOIX = {
    patient: ['masquer', 'numero'], age: ['exact', 'tranche', 'mineur', 'masquer'], dates: ['complete', 'jour', 'mois'],
    psychiatre: ['masquer', 'numero', 'generique'], professionnels: ['masquer', 'numero', 'fonction'],
    lieu: ['afficher', 'categorie', 'masquer'], mode: ['afficher', 'contrainte', 'masquer'], pauses: ['afficher', 'masquer']
  };

  function trancheAge(a) {
    if (a == null) return 'non renseigné';
    if (a < 18) return 'moins de 18 ans';
    if (a < 26) return '18 à 25 ans';
    if (a < 41) return '26 à 40 ans';
    if (a < 61) return '41 à 60 ans';
    return 'plus de 60 ans';
  }

  /**
   * Registre occulté : { colonnes, lignes (tableaux de textes), occultations (libellés des choix appliqués) }.
   * `fmt` : { date(ms), jour(ms), mois(ms), duree(h) } pour la mise en forme (fournis par l'interface).
   * Les numéros de remplacement (patients, psychiatres, soignants) sont propres à chaque édition, attribués
   * dans l'ordre d'apparition, et ne sont conservés nulle part.
   */
  function registreCommunicable(st, service, annee, maintenant, options, fmt) {
    var o = Object.assign({}, OCCULTATION_DEFAUT, options || {});
    Object.keys(OCCULTATION_CHOIX).forEach(function (k) { if (OCCULTATION_CHOIX[k].indexOf(o[k]) < 0) o[k] = OCCULTATION_DEFAUT[k]; });
    var op = optionsPauses(st.config);
    var entrees = registre(st, service, annee, maintenant);
    var numPatient = {}, nP = 0, numPsy = {}, nPsy = 0, numPro = {}, nParFonction = {};
    function patient(e) { if (!numPatient[e.patientId]) numPatient[e.patientId] = 'Patient ' + (++nP); return numPatient[e.patientId]; }
    function psychiatre(nom) {
      if (!nom) return '—';
      if (o.psychiatre === 'generique') return 'Psychiatre';
      if (!numPsy[nom]) numPsy[nom] = 'Psychiatre ' + (++nPsy);
      return numPsy[nom];
    }
    function pro(p) {
      var f = p.fonction || 'Soignant';
      if (o.professionnels === 'fonction') return f;
      var cle = p.nom + '|' + f;
      if (!numPro[cle]) { nParFonction[f] = (nParFonction[f] || 0) + 1; numPro[cle] = f + ' ' + nParFonction[f]; }
      return numPro[cle];
    }
    function quand(t) { return t == null ? 'en cours' : o.dates === 'complete' ? fmt.date(t) : o.dates === 'jour' ? fmt.jour(t) : fmt.mois(t); }
    var colonnes = ['N°', 'Catégorie'];
    if (o.patient === 'numero') colonnes.push('Patient');
    if (o.age !== 'masquer') colonnes.push(o.age === 'exact' ? 'Âge' : o.age === 'tranche' ? 'Tranche d’âge' : 'Mineur');
    if (o.mode !== 'masquer') colonnes.push(o.mode === 'contrainte' ? 'Soins sans consentement' : "Mode d'hospitalisation");
    colonnes.push('Début', 'Fin', op.deduireRegistre ? 'Durée hors pauses' : 'Durée');
    var avecPauses = o.pauses === 'afficher' && op.active;
    if (avecPauses) colonnes.push('Levées temporaires');
    if (o.lieu !== 'masquer') colonnes.push('Lieu');
    if (o.psychiatre !== 'masquer') colonnes.push('Psychiatre');
    if (o.professionnels !== 'masquer') colonnes.push('Professionnels chargés de la surveillance');
    var lignes = entrees.map(function (e) {
      var l = [e.numero || 'en cours', e.categorie];
      if (o.patient === 'numero') l.push(patient(e));
      if (o.age === 'exact') l.push(e.age == null ? 'non renseigné' : String(e.age));
      else if (o.age === 'tranche') l.push(trancheAge(e.age));
      else if (o.age === 'mineur') l.push(e.age == null ? (estMineur(st, e.patientId, e.debut) ? 'oui' : 'non renseigné') : (e.age < 18 ? 'oui' : 'non'));
      if (o.mode === 'afficher') l.push(e.modeHospi || '—');
      else if (o.mode === 'contrainte') l.push(estContrainte(st.config, e.modeHospi) ? 'oui' : 'non');
      l.push(quand(e.debut), quand(e.fin), fmt.duree(e.dureeHeures));
      if (avecPauses) l.push(e.pauses.length ? e.pauses.length + ' — ' + fmt.duree(e.pauses.reduce(function (s, p) { return s + (p[1] - p[0]); }, 0) / H) : '—');
      if (o.lieu === 'afficher') l.push(e.lieu || '—');
      else if (o.lieu === 'categorie') l.push(e.categorie === 'A' || e.categorie === 'C' ? 'Espace d’isolement (CSI)' : 'Hors espace d’isolement');
      if (o.psychiatre !== 'masquer') l.push(psychiatre(e.psychiatre));
      if (o.professionnels === 'fonction') {
        var parF = {}, ordreF = [];
        e.professionnelsDetail.forEach(function (p) { var f = p.fonction || 'Soignant'; if (!parF[f]) { parF[f] = 0; ordreF.push(f); } parF[f]++; });
        l.push(ordreF.length ? ordreF.map(function (f) { return parF[f] + ' ' + f; }).join(', ') : '—');
      } else if (o.professionnels !== 'masquer') l.push(e.professionnelsDetail.length ? e.professionnelsDetail.map(pro).join(', ') : '—');
      return l;
    });
    var occ = [];
    occ.push(o.patient === 'masquer' ? 'identifiant des patients occulté' : 'identifiant des patients remplacé par un numéro propre à ce document');
    occ.push({ exact: 'âge affiché', tranche: 'âge remplacé par une tranche d’âge', mineur: 'âge remplacé par la mention mineur / majeur', masquer: 'âge occulté' }[o.age]);
    occ.push({ complete: 'dates et heures complètes', jour: 'dates sans les heures', mois: 'dates réduites au mois' }[o.dates]);
    occ.push({ masquer: 'nom des psychiatres occulté', numero: 'nom des psychiatres remplacé par un numéro (Psychiatre 1…)', generique: 'nom des psychiatres remplacé par la mention « Psychiatre »' }[o.psychiatre]);
    occ.push({ masquer: 'nom des professionnels occulté', numero: 'nom des professionnels remplacé par leur fonction et un numéro (IDE 1…)', fonction: 'nom des professionnels remplacé par leur fonction et leur nombre' }[o.professionnels]);
    occ.push({ afficher: 'lieu affiché', categorie: 'lieu réduit à « CSI / hors CSI »', masquer: 'lieu occulté' }[o.lieu]);
    occ.push({ afficher: 'mode d’hospitalisation affiché', contrainte: 'mode d’hospitalisation réduit à « sous contrainte : oui / non »', masquer: 'mode d’hospitalisation occulté' }[o.mode]);
    return { colonnes: colonnes, lignes: lignes, occultations: occ, options: o, entrees: entrees.length };
  }

  // ---------------------------------------------------------- Statistiques
  function stat(valeurs) {
    if (!valeurs.length) return { n: 0, total: 0, moyenne: null, min: null, max: null, mediane: null };
    var v = valeurs.slice().sort(function (a, b) { return a - b; });
    var total = v.reduce(function (s, x) { return s + x; }, 0);
    var mid = Math.floor(v.length / 2);
    return { n: v.length, total: total, moyenne: total / v.length, min: v[0], max: v[v.length - 1], mediane: v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2 };
  }

  // ------------------------------------------------ Méthode des statistiques
  var UNITES_STATS = { entrees: 'Entrées du registre', sequences: 'Séquences', mesures: 'Mesures au sens du juge (isolement et contention séparés)' };
  var TOLERANCES_SEQUENCE = [0, 15, 60, 360, 720, 1440, 2880];

  function optionsStats(config) {
    var d = CONFIG_DEFAUT.statsMethode, o = Object.assign({}, d, (config && config.statsMethode) || {});
    o.toleranceMinutes = Math.max(0, Math.min(2880, Math.round(+o.toleranceMinutes || 0)));
    if (!UNITES_STATS[o.unitePrincipale]) o.unitePrincipale = 'entrees';
    o.colonneSequences = !!o.colonneSequences;
    o.mentions = Object.assign({}, d.mentions, o.mentions || {});
    o.methodesAnterieures = o.methodesAnterieures && typeof o.methodesAnterieures === 'object' ? o.methodesAnterieures : {};
    return o;
  }

  /**
   * Séquences : entrées du registre d'un même patient (tous services confondus) qui se suivent avec un écart
   * au plus égal à la tolérance réglée (0 = elles se touchent). Une séquence est comptée l'année de son début ;
   * sa durée est la somme des durées de ses entrées (les écarts tolérés ne sont pas comptés).
   */
  function sequences(st, services, annee, maintenant, filtrePatient) {
    var tol = optionsStats(st.config).toleranceMinutes * 60000, entrees = [];
    services.forEach(function (sv) { [annee - 1, annee].forEach(function (an) { entrees = entrees.concat(registre(st, sv, an, maintenant)); }); });
    if (filtrePatient) entrees = entrees.filter(function (e) { return e.patientId === filtrePatient; });
    var parPatient = {};
    entrees.forEach(function (e) { (parPatient[e.patientId] = parPatient[e.patientId] || []).push(e); });
    var res = [];
    Object.keys(parPatient).forEach(function (pid) {
      var l = parPatient[pid].sort(function (a, b) { return a.debut - b.debut; }), cour = null;
      l.forEach(function (e) {
        var fin = e.fin === null ? maintenant : e.fin;
        if (cour && e.debut - cour.finMax <= tol) {
          cour.entrees.push(e); cour.finMax = Math.max(cour.finMax, fin); cour.enCours = cour.enCours || e.fin === null;
        } else {
          cour = { patientId: pid, debut: e.debut, finMax: fin, entrees: [e], enCours: e.fin === null };
          res.push(cour);
        }
      });
    });
    var debutAn = new Date(annee, 0, 1).getTime(), finAn = new Date(annee + 1, 0, 1).getTime();
    return res.filter(function (q) { return q.debut >= debutAn && q.debut < finAn; }).map(function (q) {
      var cats = {}; q.entrees.forEach(function (e) { cats[e.categorie] = 1; });
      var iso = cats.A || cats.B, cont = cats.C || cats.D || cats.E;
      return { patientId: q.patientId, debut: q.debut, fin: q.enCours ? null : q.finMax, enCours: q.enCours, entrees: q.entrees.length,
        dureeHeures: q.entrees.reduce(function (s, e) { return s + e.dureeHeures; }, 0),
        composition: cats.C || (iso && cont) ? 'Isolement avec contention' : iso ? 'Isolement seul' : 'Contention seule hors espace d’isolement' };
    });
  }

  function indicateursSequences(liste) {
    var term = liste.filter(function (q) { return !q.enCours; }), patients = {}, comp = {};
    term.forEach(function (q) { patients[q.patientId] = 1; comp[q.composition] = (comp[q.composition] || 0) + 1; });
    return {
      n: term.length, enCours: liste.length - term.length, patients: Object.keys(patients).length,
      duree: stat(term.map(function (q) { return q.dureeHeures; })),
      entreesParSequence: term.length ? term.reduce(function (s, q) { return s + q.entrees; }, 0) / term.length : null,
      composition: comp
    };
  }

  /** Réglages en vigueur qui influencent les statistiques, en phrases. */
  function reglesCalcul(config) {
    var op = optionsPauses(config), oc = optionsCas(config), os = optionsStats(config);
    var r = [];
    r.push(op.retrancher ? 'Levées temporaires (pauses) déduites ' + (op.portee === 'partout' ? 'des durées du registre et des statistiques' : 'des seuls délais JLD (registre et statistiques en durée réelle)') : 'Levées temporaires (pauses) comptées dans les durées');
    if (op.deduireRegistre) r.push(op.contentionSeule === 'contention' ? 'Pause de la contention seule pendant un isolement : laissée dans l’entrée C' : 'Pause de la contention seule pendant un isolement : comptée en isolement seul (entrée A)');
    r.push('Passage en soins somatiques ou aux urgences : ' + { 'poursuite-service': 'mesure poursuivie, comptée au registre du service', 'poursuite-registre': 'mesure poursuivie, comptée au registre dédié', suspension: 'mesure suspendue, période non comptée', arret: 'fin de la mesure' }[oc.somatique] + ' (règle enregistrée à chaque départ)');
    r.push('Mode d’hospitalisation retenu : le nouveau mode s’il passe des soins libres à la contrainte dans les ' + (config.delaiModeHospiHeures || 12) + ' h suivant le début');
    r.push('Séquences : entrées regroupées si l’écart ' + (os.toleranceMinutes ? 'ne dépasse pas ' + libDuree(os.toleranceMinutes) : 'est nul (entrées qui se touchent)'));
    var fige = config.registreFige || {}, ans = [];
    Object.keys(fige).forEach(function (sv) { Object.keys(fige[sv]).forEach(function (an) { if (fige[sv][an]) ans.push(an + ' (' + sv + ')'); }); });
    if (ans.length) r.push('Années importées gardant les entrées du document d’origine : ' + ans.join(', '));
    return r;
  }
  function libDuree(min) { return !min ? 'continu' : min < 60 ? min + ' min' : (min / 60) + ' h'; }

  var CLES_METHODE = ['pauses', 'casParticuliers', 'delaiModeHospiHeures', 'registreFige', 'registreFigeMesures', 'statsMethode'];

  /** Ce qui change entre deux valeurs d'un réglage de méthode (phrases), ou []. */
  function diffMethode(cle, avant, apres) {
    function cfg(v) { var c = {}; c[cle] = v; return c; }
    var a = cfg(avant), b = cfg(apres), res = [];
    if (cle === 'pauses') {
      var pa = optionsPauses(a), pb = optionsPauses(b);
      if (pa.retrancher !== pb.retrancher || (pb.retrancher && pa.portee !== pb.portee)) res.push('pauses ' + (pa.retrancher ? 'déduites (' + (pa.portee === 'partout' ? 'partout' : 'délais JLD') + ')' : 'comptées') + ' → ' + (pb.retrancher ? 'déduites (' + (pb.portee === 'partout' ? 'partout' : 'délais JLD') + ')' : 'comptées'));
      if (pb.deduireRegistre && pa.contentionSeule !== pb.contentionSeule) res.push('pause de la contention seule : ' + (pb.contentionSeule === 'contention' ? 'laissée dans l’entrée C' : 'comptée en isolement seul (A)'));
    } else if (cle === 'casParticuliers') {
      var ca = optionsCas(a), cb = optionsCas(b);
      if (ca.somatique !== cb.somatique || ca.serviceSomatique !== cb.serviceSomatique) res.push('règle des soins somatiques : ' + ca.somatique + ' → ' + cb.somatique + ' (départs suivants seulement)');
    } else if (cle === 'delaiModeHospiHeures') {
      if ((avant || 12) !== (apres || 12)) res.push('délai de bascule du mode d’hospitalisation : ' + (avant || 12) + ' h → ' + (apres || 12) + ' h');
    } else if (cle === 'statsMethode') {
      var sa = optionsStats(a), sb = optionsStats(b);
      if (sa.toleranceMinutes !== sb.toleranceMinutes) res.push('tolérance des séquences : ' + libDuree(sa.toleranceMinutes) + ' → ' + libDuree(sb.toleranceMinutes));
    } else if (JSON.stringify(avant || {}) !== JSON.stringify(apres || {})) {
      res.push(cle === 'registreFige' ? 'numérotation conservée des années importées modifiée' : 'numérotation conservée de mesures importées modifiée');
    }
    return res;
  }

  /**
   * Changements des réglages de méthode, relus au journal : [{ date, by, cle, textes, avant }] entre `debut` et `fin`.
   * Toutes les années sont recalculées avec les réglages actuels (sauf la règle des soins somatiques, enregistrée
   * avec chaque départ) : ces changements rendent les chiffres non comparables à ceux publiés avant eux.
   */
  function changementsMethode(st, debut, fin) {
    var valeurs = {}, res = [];
    CLES_METHODE.forEach(function (k) { valeurs[k] = cloner(CONFIG_DEFAUT[k] === undefined ? null : CONFIG_DEFAUT[k]); });
    function voir(e, d, at) {
      if (CLES_METHODE.indexOf(d.cle) < 0) return;
      var avant = valeurs[d.cle], textes = diffMethode(d.cle, avant, d.valeur);
      valeurs[d.cle] = cloner(d.valeur);
      var t = Date.parse(at);
      if (textes.length && t >= debut && t < fin) res.push({ date: t, by: e.by, cle: d.cle, textes: textes, avant: avant });
    }
    st.journal.forEach(function (e) {
      if (st.annules[e.id]) return;
      if (e.type === 'CONFIG') voir(e, e.data, e.at);
      if (e.type === 'LOT') (e.data.evenements || []).forEach(function (x) { if (x.type === 'CONFIG') voir(e, x.data, x.at || e.at); });
    });
    return res;
  }

  /** Statistiques recalculées avec d'autres valeurs de réglages (comparaison avant / après un changement). */
  function statistiquesAvec(st, surcharge, services, annee, maintenant) {
    var config = Object.assign({}, st.config, surcharge);
    return statistiquesAnnee(Object.assign({}, st, { config: config }), services, annee, maintenant);
  }

  /**
   * Indicateurs annuels (rapport « L'isolement et la contention en chiffres »).
   * Une mesure = une entrée du registre terminée, comptée l'année de son début.
   */
  function statistiquesAnnee(st, services, annee, maintenant) {
    var entrees = [];
    services.forEach(function (sv) { entrees = entrees.concat(registre(st, sv, annee, maintenant)); });
    var term = entrees.filter(function (e) { return e.fin !== null; });
    var pIso = {}, pCont = {}, pTous = {}, pSSC = {}, pMineurs = {}, cat = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    var heuresCSI = 0, soinsLibres = 0, mois = [];
    for (var k = 0; k < 12; k++) mois.push({ mesures: 0, heures: 0 });
    term.forEach(function (e) {
      cat[e.categorie]++;
      pTous[e.patientId] = 1;
      if (e.categorie === 'A' || e.categorie === 'B') pIso[e.patientId] = 1; else pCont[e.patientId] = 1;
      if (estContrainte(st.config, e.modeHospi)) pSSC[e.patientId] = 1; else soinsLibres++;
      if (estMineur(st, e.patientId, e.debut)) pMineurs[e.patientId] = 1;
      if (e.categorie === 'A' || e.categorie === 'C') heuresCSI += e.dureeHeures;
      var mo = new Date(e.debut).getMonth();
      mois[mo].mesures++; mois[mo].heures += e.dureeHeures;
    });
    var durees = stat(term.map(function (e) { return e.dureeHeures; }));

    // Suivi réglementaire, par mesure (dont le début est dans l'année)
    var debutAn = new Date(annee, 0, 1).getTime(), finAn = new Date(annee + 1, 0, 1).getTime();
    var mesures = listeMesures(st).filter(function (m) { return services.indexOf(m.service) >= 0 && m.debut >= debutAn && m.debut < finAn; });
    var tiers = { INFORME: 0, NON: 0, TENTATIVE: 0, A_RENSEIGNER: 0 };
    var jld = { info: 0, saisine: 0, decision: 0, levee: 0, cyclesHorsDelai: 0 };
    var motifs = {}, entretiens = { realises: 0, nonRealises: 0, nonRenseignes: 0 }, motifsFin = {};
    mesures.forEach(function (m) {
      var mo = m.motifRecours || 'Non renseigné';
      motifs[mo] = (motifs[mo] || 0) + 1;
      if (typeof m.fin === 'number') {
        if (!m.entretien) entretiens.nonRenseignes++; else if (m.entretien.realise) entretiens.realises++; else entretiens.nonRealises++;
        var mf = String(m.motifFin || 'Décision médicale').replace(/\s*\(.*$/, '');
        motifsFin[mf] = (motifsFin[mf] || 0) + 1;
      }
    });
    var calc = mesuresCalcul(st, maintenant);
    mesures.forEach(function (m) {
      m = calc.filter(function (x) { return x.id === m.id; })[0] || m;
      var t = m.tiers.length ? m.tiers[m.tiers.length - 1] : null;
      if (!t) tiers.A_RENSEIGNER++;
      else if (t.statut === 'INFORME') tiers.INFORME++;
      else if (t.statut === 'TENTATIVE') tiers.TENTATIVE++;
      else tiers.NON++;
      if (m.leveeJLD) jld.levee++;
      Object.keys(m.jld).forEach(function (c) {
        var x = m.jld[c], e = rules.echeances(calc, m, +c, st.config.parametres), hors = false;
        if (x.INFO) { jld.info++; if (typeof x.INFO.date === 'number' && x.INFO.date > e.info) hors = true; }
        if (x.SAISINE) { jld.saisine++; if (typeof x.SAISINE.date === 'number' && x.SAISINE.date > e.saisine) hors = true; }
        if (x.DECISION) { jld.decision++; if (typeof x.DECISION.date === 'number' && x.DECISION.date > e.decision) hors = true; }
        if (hors) jld.cyclesHorsDelai++;
      });
    });

    // Données saisies par le cadre (patients HC et sous contrainte, fournies par le DIM)
    var hc = 0, ssc = 0, hcOk = true, sscOk = true, commentaires = [];
    services.forEach(function (sv) {
      var s = (st.saisiesStats[sv] || {})[annee];
      if (!s || typeof s.hc !== 'number') hcOk = false; else hc += s.hc;
      if (!s || typeof s.ssc !== 'number') sscOk = false; else ssc += s.ssc;
      if (s && s.commentaire) commentaires.push(s.commentaire);
    });
    var nPat = Object.keys(pTous).length;
    return {
      annee: annee,
      patientsHC: hcOk ? hc : null, patientsSSC: sscOk ? ssc : null, commentaires: commentaires,
      mesures: term.length, enCours: entrees.length - term.length,
      patientsIsolement: Object.keys(pIso).length, patientsContention: Object.keys(pCont).length,
      patients: nPat, patientsSSCAvecMesure: Object.keys(pSSC).length,
      mesuresParPatient: nPat ? term.length / nPat : null,
      duree: durees, heuresCSI: heuresCSI,
      partPatientsHC: hcOk && hc ? nPat / hc : null,
      partPatientsSSC: sscOk && ssc ? Object.keys(pSSC).length / ssc : null,
      categories: cat, soinsLibres: soinsLibres, patientsMineurs: Object.keys(pMineurs).length,
      sequences: indicateursSequences(sequences(st, services, annee, maintenant)),
      tiers: tiers, jld: jld, mois: mois, motifsRecours: motifs, entretiens: entretiens, motifsFin: motifsFin,
      mesuresIsolement: mesures.filter(function (m) { return m.type === 'Isolement'; }).length, mesuresContention: mesures.filter(function (m) { return m.type === 'Contention'; }).length
    };
  }

  // ----------------------------------------------------------- Décompte JLD
  /**
   * Décompte d'une mesure pour la saisine du juge : mesures antérieures du
   * même type comptant dans les 15 jours glissants, puis la mesure découpée en
   * segments de 24 h (isolement) ou 12 h (contention), avec cumul progressif.
   */
  // ------------------------------------------------ Masques du décompte JLD
  var COLONNES_DECOMPTE = ['N', 'Debut', 'Fin', 'Duree', 'Cumul', 'Statut', 'Commentaire'];
  var IDENTITE_DECOMPTE = ['patient', 'naissance', 'ipp', 'service', 'modeHospi', 'protection', 'mesure', 'lieu', 'psychiatre'];
  var SECTIONS_DECOMPTE = ['periode', 'situation', 'total', 'cycle', 'jld', 'tiers', 'pauses', 'mentionLegale', 'dateEdition', 'auteur'];
  var FORMATS_DUREE = ['h', 'j', 'hj'];
  var MASQUE_DEFAUT = {
    titreIsolement: 'Cumul des mesures d’isolement', titreContention: 'Cumul des mesures de contention', sousTitre: '',
    entete: '', destinataire: '', confidentiel: false,
    identite: ['patient', 'naissance', 'ipp', 'mesure', 'lieu', 'psychiatre'],
    colonnes: COLONNES_DECOMPTE.slice(),
    sections: { periode: true, situation: true, total: true, cycle: true, jld: false, tiers: false, pauses: true, mentionLegale: true, dateEdition: true, auteur: true },
    piedPage: '', signature: '',
    // Format des durées : 'h' (68 h 05), 'j' (2 j 20 h), 'hj' (68 h 05, soit 2 j 20 h 05)
    formatDuree: 'j', formatCumul: 'j',
    // Durée maximale d'une ligne du décompte (heures) ; 0 = la mesure sur une seule ligne.
    trancheIsolement: 24, trancheContention: 12,
    // Mise en évidence : 'aucune', 'actuelle' (surbrillance de la mesure actuelle), 'anterieures' (mesures antérieures grisées), 'les-deux'
    miseEnEvidence: 'aucune',
    // Papier à en-tête : image de fond (identifiant dans config.imagesDecompte), sur toutes les pages ou la première, marges (mm).
    fond: '', fondPages: 'toutes', marges: { haut: 15, droite: 15, bas: 15, gauche: 15 }
  };

  /**
   * Masque du décompte d'un service : masque par défaut, puis masque de l'établissement (`'*'`), puis
   * masque du service. Les anciens réglages (`masquer` : colonnes masquées) restent compris.
   */
  function masqueDecompte(config, service) {
    var r = cloner(MASQUE_DEFAUT), dec = (config && config.decompte) || {};
    [dec['*'], service && service !== '*' ? dec[service] : null].forEach(function (x) {
      if (!x) return;
      Object.keys(x).forEach(function (k) {
        if (k === 'masquer' || x[k] == null) return;
        if (k === 'sections') {
          Object.assign(r.sections, x.sections);
          if (x.sections.editeur !== undefined) {           // ancien réglage commun « date d'édition et auteur »
            if (x.sections.dateEdition === undefined) r.sections.dateEdition = !!x.sections.editeur;
            if (x.sections.auteur === undefined) r.sections.auteur = !!x.sections.editeur;
          }
          delete r.sections.editeur;
        }
        else if (k === 'marges') Object.assign(r.marges, x.marges);
        else if (k === 'titreIsolement' || k === 'titreContention') { if (x[k]) r[k] = x[k]; }
        else r[k] = cloner(x[k]);
      });
      if (x.masquer && !x.colonnes) r.colonnes = COLONNES_DECOMPTE.filter(function (c) { return x.masquer.indexOf(c) < 0; });
    });
    r.colonnes = r.colonnes.filter(function (c) { return COLONNES_DECOMPTE.indexOf(c) >= 0; });
    r.identite = r.identite.filter(function (c) { return IDENTITE_DECOMPTE.indexOf(c) >= 0; });
    Object.keys(r.marges).forEach(function (k) { var v = +r.marges[k]; r.marges[k] = isFinite(v) ? Math.max(0, Math.min(80, v)) : 15; });
    ['formatDuree', 'formatCumul'].forEach(function (k) { if (FORMATS_DUREE.indexOf(r[k]) < 0) r[k] = 'j'; });
    if (['aucune', 'actuelle', 'anterieures', 'les-deux'].indexOf(r.miseEnEvidence) < 0) r.miseEnEvidence = 'aucune';
    [['trancheIsolement', 24], ['trancheContention', 12]].forEach(function (x) { var v = +r[x[0]]; r[x[0]] = isFinite(v) && v >= 0 ? Math.min(168, v) : x[1]; });
    if (r.fond && !((config && config.imagesDecompte) || {})[r.fond]) r.fond = '';
    r.propre = !!(service && service !== '*' && dec[service]);
    return r;
  }

  /**
   * Décompte JLD d'une mesure à une date de référence : lignes des mesures antérieures (15 jours glissants),
   * puis de la mesure par tranches de 24 h (isolement) ou 12 h (contention).
   * Pauses déduites (option) : chaque pause interrompt le décompte par une ligne « pause » dont la durée est déduite du cumul,
   * et la ligne suivante reprend à l'heure de reprise. Sinon, les pauses sont signalées dans le commentaire.
   */
  function decompte(st, m, reference, options) {
    options = options || {};
    var toutes = mesuresCalcul(st, reference);
    m = toutes.filter(function (x) { return x.id === m.id; })[0] || m;
    var deduire = optionsPauses(st.config).retrancher;
    var fin = typeof m.fin === 'number' && m.fin < reference ? m.fin : reference;
    // Durée maximale d'une tranche (heures) : réglable par masque, 0 = mesure sur une seule ligne.
    var tranche = options.tranche != null ? +options.tranche : (m.type === 'Isolement' ? 24 : 12);
    var pas = tranche > 0 ? tranche * H : 0;
    var noMesure = 0, mesureFinie = typeof m.fin === 'number' && m.fin <= reference;
    var borne = Math.max(m.debut - 15 * J, rules.derniereLeveeJLD(toutes, m.patientId, m.type, m.debut));
    var intervalles = [], lignes = [];
    function hhmm(t) { var d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function libPause(p) { return 'levée temporaire' + (p.motif ? ' (' + p.motif + ')' : '') + (p.psychiatre ? ', décidée par ' + p.psychiatre : ''); }
    function notePausesComptees(x, d, f) {
      var notes = plagesPauses(x, reference).filter(function (q) { return q.debut < f && q.fin > d; }).map(function (q) {
        return 'levée temporaire de ' + hhmm(Math.max(q.debut, d)) + ' à ' + hhmm(Math.min(q.fin, f)) + (q.pause.motif ? ' (' + q.pause.motif + ')' : '');
      });
      return notes.length ? ' — dont ' + notes.join(', ') + ', non déduite (comptée dans le cumul)' : '';
    }
    function ligneMesure(x, d, f, commentaire, statut) {
      intervalles.push([d, f]);
      lignes.push({ type: 'mesure', mesure: noMesure, debut: d, fin: f, duree: (f - d) / H, cumul: rules.heuresFusionnees(intervalles), statut: statut, commentaire: commentaire + (deduire ? '' : notePausesComptees(x, d, f)) });
    }
    function lignePause(q, d, f) {
      if (q.suspension) {
        lignes.push({ type: 'pause', suspension: true, mesure: noMesure, debut: d, fin: f, duree: (f - d) / H, cumul: rules.heuresFusionnees(intervalles), statut: 'SUSPENDUE',
          commentaire: 'Mesure suspendue pendant les soins somatiques ou aux urgences (' + q.lieu + ') : durée non ajoutée au cumul, règle de l’établissement.' });
        return;
      }
      lignes.push({ type: 'pause', mesure: noMesure, debut: d, fin: f, duree: (f - d) / H, cumul: rules.heuresFusionnees(intervalles), statut: 'PAUSE',
        commentaire: 'Pause : ' + libPause(q.pause) + '. Durée déduite, non ajoutée au cumul.' + (q.nonConfirmee ? ' Reprise non saisie : la durée est de nouveau comptée à partir de l’heure de reprise prévue.' : '') });
    }
    /** Découpe [d, f] d'une mesure aux bornes `grille` et aux pauses déduites ; appelle `ligne(d, f, apresPause, premiere)`. */
    function parcourir(x, d, f, grille, ligne) {
      var plages = (deduire ? plagesPauses(x, reference) : []).concat(suspensions(x, reference).map(function (z) {
        var sg = (x.segments || []).filter(function (y) { return y.debut === z[0]; })[0] || {};
        return { debut: z[0], fin: z[1], suspension: true, lieu: sg.lieu || 'soins somatiques' };
      })).filter(function (q) { return q.debut < f && q.fin > d; }).sort(function (a, b) { return a.debut - b.debut; });
      var coupe = x.debutService && x.debutService > d && x.debutService < f ? x.debutService : null;   // arrivée dans le service
      var t = d, apresPause = false, premiere = true, k = 0;
      while (t < f || (premiere && t === f)) {
        var q = plages.filter(function (z) { return z.debut <= t && z.fin > t; })[0];
        if (q) { var fp = Math.min(q.fin, f); lignePause(q, t, fp); t = fp; apresPause = q.suspension ? 'suspension' : true; premiere = false; continue; }
        while (grille && grille(k) <= t) k++;
        var suivante = Math.min(f, grille ? grille(k) : f);
        plages.forEach(function (z) { if (z.debut > t && z.debut < suivante) suivante = z.debut; });
        if (coupe && coupe > t && coupe < suivante) suivante = coupe;
        ligne(t, suivante, apresPause, premiere);
        if (suivante === t) break;
        t = suivante; apresPause = false; premiere = false;
      }
    }
    toutes.filter(function (x) {
      return x.id !== m.id && x.patientId === m.patientId && x.type === m.type && x.debut < m.debut &&
        (typeof x.fin !== 'number' || x.fin > borne);
    }).sort(function (a, b) { return a.debut - b.debut; }).forEach(function (x) {
      var d = Math.max(x.debut, borne), f = Math.min(typeof x.fin === 'number' ? x.fin : m.debut, m.debut);
      if (f <= d) return;
      noMesure++;
      parcourir(x, d, f, null, function (a, b, apres) {
        ligneMesure(x, a, b, apres ? 'Mesure antérieure : reprise après levée temporaire' : 'Mesure antérieure comptée dans les 15 jours glissants' + (x.debut < borne ? ' (partiellement)' : ''), 'TERMINÉE');
      });
    });
    var cumulAvant = rules.heuresFusionnees(intervalles);
    var grille = pas ? function (k) { return m.debut + (k + 1) * pas; } : null;
    noMesure++;
    var nTranche = 0;
    parcourir(m, m.debut, fin, grille, function (a, b, apres, premiere) {
      nTranche++;
      // Le statut est celui de la mesure (et non de la tranche) : une mesure en cours l'est sur toutes ses lignes.
      var lieuAvant = m.debutService && a < m.debutService ? ' — ' + (m.lieuInitial || 'avant l’arrivée dans le service') + ' (avant l’arrivée dans le service)' : '';
      ligneMesure(m, a, b, (m.debutService && a === m.debutService ? 'Arrivée dans le service, suite de la même mesure' : premiere ? 'Début de la mesure' + lieuAvant : apres === 'suspension' ? 'Retour dans le service : reprise de la mesure' : apres ? 'Reprise de la mesure après levée temporaire' + (pas ? ' (tranche ' + nTranche + ')' : '') : 'Suite de la même mesure (tranche ' + nTranche + ')'), mesureFinie ? 'TERMINÉE' : 'EN COURS');
    });
    // N° : numéro de la mesure dans le décompte, suivi du numéro de tranche si elle occupe plusieurs lignes (2.1, 2.2…).
    var parMesure = {}, rang = {};
    lignes.forEach(function (l) { if (l.type === 'mesure') parMesure[l.mesure] = (parMesure[l.mesure] || 0) + 1; });
    lignes.forEach(function (l) {
      l.actuelle = l.mesure === noMesure;   // lignes de la mesure faisant l'objet du décompte (pauses comprises)
      if (l.type !== 'mesure') { l.n = ''; return; }
      rang[l.mesure] = (rang[l.mesure] || 0) + 1;
      l.n = parMesure[l.mesure] > 1 ? l.mesure + '.' + rang[l.mesure] : String(l.mesure);
    });
    var dernier = lignes[lignes.length - 1];
    if (dernier && dernier.type === 'pause' && !mesureFinie) dernier.statut = dernier.suspension ? 'SUSPENDUE (EN COURS)' : 'PAUSE EN COURS';
    return {
      lignes: lignes, cumulAvant: cumulAvant, total: rules.heuresFusionnees(intervalles), enCours: !mesureFinie, reference: fin, fenetreDebut: borne,
      tranches: lignes.some(function (l) { return /\./.test(l.n); }), tranche: tranche, debutService: m.debutService || null, lieuInitial: m.lieuInitial || '', apresMainlevee: apresMainlevee(st, m),
      pausesRetranchees: deduire, pauses: plagesPauses(m, fin)
    };
  }

  return {
    ROLES: ROLES, DROITS: DROITS, ROLES_DE_SERVICE: ROLES_DE_SERVICE, accesFormation: accesFormation, CONFIG_DEFAUT: CONFIG_DEFAUT, LIB_CATEGORIES: LIB_CATEGORIES,
    peut: peut, servicesDe: servicesDe, periodesDe: periodesDe, estContrainte: estContrainte,
    reduire: reduire, trierEvenements: trierEvenements, deplier: deplier,
    listeMesures: listeMesures, suiviJLD: suiviJLD, dureeHeures: dureeHeures,
    tiersCycle: tiersCycle, modeA: modeA, modeRetenu: modeRetenu, estMineur: estMineur, cumulsPatient: cumulsPatient,
    postesSurveillance: postesSurveillance, bornesPeriode: bornesPeriode, dateLocaleISO: dateLocaleISO,
    registre: registre, estFigee: estFigee, explicationEntree: explicationEntree, REGLES_CATEGORIES: REGLES_CATEGORIES, compteurPour: compteurPour, colonnesPatients: colonnesPatients, statistiquesPatients: statistiquesPatients, registreCommunicable: registreCommunicable, OCCULTATION_DEFAUT: OCCULTATION_DEFAUT, OCCULTATION_CHOIX: OCCULTATION_CHOIX, trancheAge: trancheAge, ageAu: ageAu, soustraire: soustraire, statistiquesAnnee: statistiquesAnnee, decompte: decompte,
    PAUSE_MAX_HEURES: PAUSE_MAX_HEURES, optionsPauses: optionsPauses, pauseEnCours: pauseEnCours, repriseAutomatique: repriseAutomatique, finPause: finPause,
    exclusions: exclusions, plagesPauses: plagesPauses, pausesSur: pausesSur, mesuresCalcul: mesuresCalcul, dureePausesHeures: dureePausesHeures,
    optionsCas: optionsCas, optionsStats: optionsStats, UNITES_STATS: UNITES_STATS, TOLERANCES_SEQUENCE: TOLERANCES_SEQUENCE, sequences: sequences, indicateursSequences: indicateursSequences,
    reglesCalcul: reglesCalcul, changementsMethode: changementsMethode, statistiquesAvec: statistiquesAvec, CLES_METHODE: CLES_METHODE, optionsQualite: optionsQualite, donneesPatient: donneesPatient, auDelaConservation: auDelaConservation, propositionsEnAttente: propositionsEnAttente, morceaux: morceaux, suspensions: suspensions, MOTIFS_FIN: MOTIFS_FIN, mainlevees: mainlevees, mainleveeRecente: mainleveeRecente, apresMainlevee: apresMainlevee, ciblePatient: ciblePatient, doublonsPossibles: doublonsPossibles, normaliserNom: normaliserNom,
    DECLENCHEURS_ALERTE: DECLENCHEURS_ALERTE, TEXTES_ALERTE: TEXTES_ALERTE, DELAIS_ALERTE: DELAIS_ALERTE, alertesConfig: alertesConfig, faitsMesure: faitsMesure,
    reglesDeclenchees: reglesDeclenchees, alertesMesure: alertesMesure, informationsATracer: informationsATracer,
    COLONNES_DECOMPTE: COLONNES_DECOMPTE, IDENTITE_DECOMPTE: IDENTITE_DECOMPTE, SECTIONS_DECOMPTE: SECTIONS_DECOMPTE, MASQUE_DEFAUT: MASQUE_DEFAUT, FORMATS_DUREE: FORMATS_DUREE, masqueDecompte: masqueDecompte
  };
});
