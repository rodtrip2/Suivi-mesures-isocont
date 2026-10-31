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
    IDE: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD'],
    AS: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD'],   // mêmes droits que l'IDE
    SECRETAIRE: ['JLD'],
    CADRE: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD', 'CORRECTION', 'ANNULATION', 'STATS'],
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
    pauses: { active: true, retrancher: false, portee: 'jld', contentionSeule: 'isolement', verrouContention: false, colonneRegistre: true, repriseAuto: false, alerteHeures: 12, refusHeures: 48 }
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
      config: cloner(CONFIG_DEFAUT),
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

  function appliquer(st, e) {
    var d = e.data || {}, m;
    switch (e.type) {
      case 'CONFIG':
        st.config[d.cle] = cloner(d.valeur);
        break;

      case 'PATIENT':
        var p = st.patients[d.patientId] || { id: d.patientId, modes: [] };
        ['ipp', 'nom', 'prenom', 'naissance', 'protection', 'service'].forEach(function (k) { if (d[k] !== undefined) p[k] = d[k]; });
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
          psychiatreDebut: d.psychiatre || '', psychiatreFin: '', modeHospi: d.modeHospi || '',
          cycle: 1, jld: {}, leveeJLD: false, tiers: [], pauses: [], creePar: e.by, creeLe: e.at,
          origine: d.origine || '', numeroOrigine: d.numeroOrigine || '', correctionImport: d.correctionImport || '', suite: d.suiteDe || '',
          // Import d'un registre : entrées d'origine (numéro, catégorie, période, soignants) et soignants cités
          entreesOrigine: d.entreesOrigine || null, professionnelsOrigine: d.professionnelsOrigine || '',
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
      case 'CORRECTION':
        var ch = d.champs || {};
        ['debut', 'fin', 'lieu', 'csi', 'psychiatreDebut', 'psychiatreFin', 'modeHospi', 'exception', 'type'].forEach(function (k) {
          if (ch[k] !== undefined) m[k] = ch[k];
        });
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
    return {
      cycle: cycle, rythmeLong: e.rythmeLong,
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
  function mesuresCalcul(st, maintenant) {
    var ms = listeMesures(st);
    if (!optionsPauses(st.config).retrancher) return ms;
    return ms.map(function (m) { return Object.assign({}, m, { exclusions: exclusions(m, maintenant, st.config) }); });
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
    return rules.heuresEffectives({ exclusions: exclusions(m, maintenant, config) }, m.debut, fin);
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
    var csi = listeMesures(st).filter(function (m) {
      return m.service === service && m.csi && (typeof m.fin !== 'number' || m.fin >= depuis) && m.debut <= maintenant;
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
    var ms = listeMesures(st).filter(function (m) { return m.service === service && typeof m.debut === 'number'; });
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
    var pros = (x.cat === 'A' || x.cat === 'C') ? professionnelsDetailSur(st, service, x.debut, finRef) : [];
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
    return { colonnes: cols, parPatient: res };
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
      tiers: tiers, jld: jld, mois: mois
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
      lignes.push({ type: 'pause', mesure: noMesure, debut: d, fin: f, duree: (f - d) / H, cumul: rules.heuresFusionnees(intervalles), statut: 'PAUSE',
        commentaire: 'Pause : ' + libPause(q.pause) + '. Durée déduite, non ajoutée au cumul.' + (q.nonConfirmee ? ' Reprise non saisie : la durée est de nouveau comptée à partir de l’heure de reprise prévue.' : '') });
    }
    /** Découpe [d, f] d'une mesure aux bornes `grille` et aux pauses déduites ; appelle `ligne(d, f, apresPause, premiere)`. */
    function parcourir(x, d, f, grille, ligne) {
      var plages = deduire ? plagesPauses(x, reference).filter(function (q) { return q.debut < f && q.fin > d; }) : [];
      var t = d, apresPause = false, premiere = true, k = 0;
      while (t < f || (premiere && t === f)) {
        var q = plages.filter(function (z) { return z.debut <= t && z.fin > t; })[0];
        if (q) { var fp = Math.min(q.fin, f); lignePause(q, t, fp); t = fp; apresPause = true; premiere = false; continue; }
        while (grille && grille(k) <= t) k++;
        var suivante = Math.min(f, grille ? grille(k) : f);
        plages.forEach(function (z) { if (z.debut > t && z.debut < suivante) suivante = z.debut; });
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
      ligneMesure(m, a, b, premiere ? 'Début de la mesure' : apres ? 'Reprise de la mesure après levée temporaire' + (pas ? ' (tranche ' + nTranche + ')' : '') : 'Suite de la même mesure (tranche ' + nTranche + ')', mesureFinie ? 'TERMINÉE' : 'EN COURS');
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
    if (dernier && dernier.type === 'pause' && !mesureFinie) dernier.statut = 'PAUSE EN COURS';
    return {
      lignes: lignes, cumulAvant: cumulAvant, total: rules.heuresFusionnees(intervalles), enCours: !mesureFinie, reference: fin, fenetreDebut: borne,
      tranches: lignes.some(function (l) { return /\./.test(l.n); }), tranche: tranche,
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
    COLONNES_DECOMPTE: COLONNES_DECOMPTE, IDENTITE_DECOMPTE: IDENTITE_DECOMPTE, SECTIONS_DECOMPTE: SECTIONS_DECOMPTE, MASQUE_DEFAUT: MASQUE_DEFAUT, FORMATS_DUREE: FORMATS_DUREE, masqueDecompte: masqueDecompte
  };
});
