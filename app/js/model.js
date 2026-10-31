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
    decompte: {},              // { U1: { titreIsolement, titreContention, sousTitre, masquer: ['N','Cumul'] } }
    inactiviteMinutes: 10
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
          origine: d.origine || '', numeroOrigine: d.numeroOrigine || '', suite: d.suiteDe || '',
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
    var toutes = listeMesures(st);
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
  // Une pause (levée temporaire décidée par le psychiatre, avec reprise prévue) ne met pas fin à la mesure :
  // la durée et les échéances JLD continuent de courir. Au-delà de 48 h, il s'agit d'une fin de mesure.
  var PAUSE_MAX_HEURES = 48, PAUSE_LONGUE_HEURES = 12;

  /** Pause en cours (ou null) ; `depassee` : l'heure de reprise prévue est passée sans reprise saisie. */
  function pauseEnCours(m, maintenant) {
    if (typeof m.fin === 'number' || !m.pauses) return null;
    var p = m.pauses.filter(function (x) { return x.reprise == null && x.debut <= maintenant; }).pop();
    if (!p) return null;
    return Object.assign({}, p, { depassee: maintenant > p.reprisePrevue });
  }

  /** Fin effective d'une pause : reprise saisie, sinon fin de la mesure, sinon maintenant. */
  function finPause(m, p, maintenant) {
    if (p.reprise != null) return p.reprise;
    return typeof m.fin === 'number' ? m.fin : maintenant;
  }

  /** Durée cumulée des pauses d'une mesure (heures), à titre d'information : elle reste comptée dans la durée légale. */
  function dureePausesHeures(m, maintenant) {
    return (m.pauses || []).reduce(function (s, p) { return s + Math.max(0, finPause(m, p, maintenant) - p.debut); }, 0) / H;
  }

  function dureeHeures(m, maintenant) {
    return ((typeof m.fin === 'number' ? m.fin : maintenant) - m.debut) / H;
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
    var toutes = listeMesures(st);
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

  /** Entrées brutes (catégorisées) d'un service, toutes années. */
  function entreesRegistre(st, service, maintenant) {
    var ms = listeMesures(st).filter(function (m) { return m.service === service && typeof m.debut === 'number'; });
    var entrees = [];
    ms.forEach(function (m) {
      var fin = typeof m.fin === 'number' ? m.fin : null;
      if (m.type === 'Contention') {
        entrees.push({ cat: m.csi ? 'C' : (m.exception ? 'E' : 'D'), mesure: m, debut: m.debut, fin: fin });
      } else if (!m.csi) {
        entrees.push({ cat: 'B', mesure: m, debut: m.debut, fin: fin });
      } else {
        var finCalc = fin === null ? maintenant : fin;
        var contentions = ms.filter(function (c) {
          return c.type === 'Contention' && c.csi && c.patientId === m.patientId;
        }).map(function (c) { return [c.debut, typeof c.fin === 'number' ? c.fin : maintenant]; });
        soustraire(m.debut, finCalc, contentions).forEach(function (x) {
          entrees.push({ cat: 'A', mesure: m, debut: x[0], fin: (fin === null && x[1] === finCalc) ? null : x[1] });
        });
      }
    });
    return entrees;
  }

  function professionnelsSur(st, service, debut, fin) {
    var pros = [], periodes = periodesDe(st.config, service);
    st.professionnels.forEach(function (p) {
      if (p.service !== service) return;
      var per = periodes.filter(function (q) { return q.code === p.periode; })[0];
      if (!per) return;
      var b = bornesPeriode(p.date, per);
      if (b[0] < fin && b[1] > debut) {
        var lib = p.nom + (p.fonction ? ' (' + p.fonction + ')' : '');
        if (pros.indexOf(lib) < 0) pros.push(lib);
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
    return terminees.concat(enCours).map(function (x, i) {
      var mode = modeRetenu(st, x.mesure);
      var finRef = x.fin === null ? maintenant : x.fin;
      return {
        numero: x.fin === null ? '' : x.cat + (depart + i + 1),
        categorie: x.cat, debut: x.debut, fin: x.fin,
        dureeHeures: (finRef - x.debut) / H, type: x.mesure.type, lieu: x.mesure.lieu,
        psychiatre: x.mesure.psychiatreDebut, modeHospi: mode.mode, basculeMode: mode.bascule,
        professionnels: (x.cat === 'A' || x.cat === 'C') ? professionnelsSur(st, service, x.debut, finRef) : [],
        mesureId: x.mesure.id, patientId: x.mesure.patientId, service: service
      };
    });
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
    mesures.forEach(function (m) {
      var t = m.tiers.length ? m.tiers[m.tiers.length - 1] : null;
      if (!t) tiers.A_RENSEIGNER++;
      else if (t.statut === 'INFORME') tiers.INFORME++;
      else if (t.statut === 'TENTATIVE') tiers.TENTATIVE++;
      else tiers.NON++;
      if (m.leveeJLD) jld.levee++;
      Object.keys(m.jld).forEach(function (c) {
        var x = m.jld[c], e = rules.echeances(listeMesures(st), m, +c, st.config.parametres), hors = false;
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
  function decompte(st, m, reference) {
    var toutes = listeMesures(st);
    var fin = typeof m.fin === 'number' && m.fin < reference ? m.fin : reference;
    var pas = (m.type === 'Isolement' ? 24 : 12) * H;
    var borne = Math.max(m.debut - 15 * J, rules.derniereLeveeJLD(toutes, m.patientId, m.type, m.debut));
    var intervalles = [], lignes = [];
    toutes.filter(function (x) {
      return x.id !== m.id && x.patientId === m.patientId && x.type === m.type && x.debut < m.debut &&
        (typeof x.fin !== 'number' || x.fin > borne);
    }).sort(function (a, b) { return a.debut - b.debut; }).forEach(function (x) {
      var d = Math.max(x.debut, borne), f = Math.min(typeof x.fin === 'number' ? x.fin : m.debut, m.debut);
      if (f <= d) return;
      intervalles.push([d, f]);
      lignes.push({ debut: d, fin: f, duree: (f - d) / H, cumul: rules.heuresFusionnees(intervalles), statut: 'TERMINÉE', commentaire: 'Mesure antérieure comptée dans les 15 jours glissants' + (x.debut < borne ? ' (partiellement)' : '') });
    });
    var cumulAvant = rules.heuresFusionnees(intervalles);
    for (var t = m.debut, i = 0; t < fin || i === 0; t += pas, i++) {
      var f2 = Math.min(t + pas, fin);
      intervalles.push([t, f2]);
      var dernier = f2 >= fin;
      lignes.push({
        debut: t, fin: f2, duree: (f2 - t) / H, cumul: rules.heuresFusionnees(intervalles),
        statut: dernier && typeof m.fin !== 'number' ? 'EN COURS' : 'TERMINÉE',
        commentaire: i === 0 ? 'Début de la mesure' : 'Prolongation de la mesure'
      });
      if (dernier) break;
    }
    lignes.forEach(function (l, k) { l.n = k + 1; });
    return { lignes: lignes, cumulAvant: cumulAvant, total: rules.heuresFusionnees(intervalles), enCours: typeof m.fin !== 'number', reference: fin, fenetreDebut: borne };
  }

  return {
    ROLES: ROLES, DROITS: DROITS, ROLES_DE_SERVICE: ROLES_DE_SERVICE, accesFormation: accesFormation, CONFIG_DEFAUT: CONFIG_DEFAUT, LIB_CATEGORIES: LIB_CATEGORIES,
    peut: peut, servicesDe: servicesDe, periodesDe: periodesDe, estContrainte: estContrainte,
    reduire: reduire, trierEvenements: trierEvenements, deplier: deplier,
    listeMesures: listeMesures, suiviJLD: suiviJLD, dureeHeures: dureeHeures,
    tiersCycle: tiersCycle, modeA: modeA, modeRetenu: modeRetenu, estMineur: estMineur, cumulsPatient: cumulsPatient,
    postesSurveillance: postesSurveillance, bornesPeriode: bornesPeriode, dateLocaleISO: dateLocaleISO,
    registre: registre, soustraire: soustraire, statistiquesAnnee: statistiquesAnnee, decompte: decompte,
    PAUSE_MAX_HEURES: PAUSE_MAX_HEURES, PAUSE_LONGUE_HEURES: PAUSE_LONGUE_HEURES, pauseEnCours: pauseEnCours, finPause: finPause, dureePausesHeures: dureePausesHeures
  };
});
