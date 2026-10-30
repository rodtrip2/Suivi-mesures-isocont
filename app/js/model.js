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
    SECRETAIRE: 'Secrétaire',
    CADRE: 'Cadre de santé',
    ADMIN: 'Administrateur'
  };

  // Types d'événements autorisés par rôle. L'IDE dispose en permanence des
  // actions JLD (usage prévu le week-end et en l'absence de la secrétaire).
  var DROITS = {
    IDE: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'TIERS', 'PROFESSIONNEL', 'JLD'],
    SECRETAIRE: ['JLD'],
    CADRE: ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'TIERS', 'PROFESSIONNEL', 'JLD', 'CORRECTION', 'ANNULATION'],
    ADMIN: ['CONFIG', 'ANNULATION', 'COMPTE']
  };

  function peut(roles, typeEvenement) {
    return (roles || []).some(function (r) { return (DROITS[r] || []).indexOf(typeEvenement) >= 0; });
  }

  // --------------------------------------------------------- Configuration
  var CONFIG_DEFAUT = {
    services: [{ code: 'U1', libelle: 'Unité 1' }],
    lieuxCSI: { U1: ['CSI 1', 'CSI 2'] },
    psychiatres: [],
    periodes: [
      { code: 'M', libelle: 'Matin', debut: '07:00', fin: '14:00' },
      { code: 'AM', libelle: 'Après-midi', debut: '14:00', fin: '21:00' },
      { code: 'N', libelle: 'Nuit', debut: '21:00', fin: '07:00' }
    ],
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
    inactiviteMinutes: 10
  };

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  // ------------------------------------------------------------- Réduction
  function trierEvenements(evts) {
    return evts.slice().sort(function (a, b) {
      return a.at < b.at ? -1 : a.at > b.at ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }

  /** Champ logique modifié par un événement sur une mesure (pour la détection de conflits). */
  function champ(e) {
    switch (e.type) {
      case 'MESURE_FIN': return 'fin';
      case 'JLD': return 'jld:' + e.data.cycle + ':' + e.data.nature;
      case 'CORRECTION': return 'corr:' + Object.keys(e.data.champs || {}).sort().join(',');
      default: return null;
    }
  }

  /**
   * Reconstitue l'état. `evts` : liste d'événements déchiffrés.
   * Retourne { config, patients, mesures, professionnels, conflits, annules, journal }.
   */
  function reduire(evts) {
    var st = {
      config: cloner(CONFIG_DEFAUT),
      patients: {}, mesures: {}, professionnels: [],
      conflits: [], annules: {}, journal: [], parId: {}
    };
    var tries = trierEvenements(evts);

    // 1) Annulations d'abord (elles neutralisent leur cible, quelle que soit leur date).
    tries.forEach(function (e) {
      st.parId[e.id] = e;
      if (e.type === 'ANNULATION' && e.data && e.data.cible) st.annules[e.data.cible] = e;
    });

    // 2) Application dans l'ordre chronologique de saisie.
    tries.forEach(function (e) {
      st.journal.push(e);
      if (e.type === 'ANNULATION' || st.annules[e.id]) return;
      appliquer(st, e);
    });
    return st;
  }

  function mesure(st, id) { return st.mesures[id]; }

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
        if (pt) { pt.modes.push({ date: d.date, mode: d.mode, evt: e.id }); pt.modes.sort(function (a, b) { return a.date - b.date; }); }
        break;

      case 'MESURE_DEBUT':
        st.mesures[d.mesureId] = {
          id: d.mesureId, patientId: d.patientId, service: d.service, type: d.typeMesure,
          debut: d.debut, fin: null, lieu: d.lieu || '', csi: !!d.csi, exception: !!d.exception,
          psychiatreDebut: d.psychiatre || '', psychiatreFin: '', modeHospi: d.modeHospi || '',
          cycle: 1, jld: {}, leveeJLD: false, tiers: [], creePar: e.by, creeLe: e.at,
          version: 1, champs: {}, evts: [e.id]
        };
        break;

      default:
        if (!d.mesureId) { if (e.type === 'PROFESSIONNEL') appliquerProfessionnel(st, e); return; }
        m = mesure(st, d.mesureId);
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
        m.fin = d.fin; m.psychiatreFin = d.psychiatre || '';
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
        ['debut', 'fin', 'lieu', 'csi', 'psychiatreDebut', 'psychiatreFin', 'modeHospi', 'exception'].forEach(function (k) {
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

  /** Échéances et statuts JLD d'une mesure au cycle courant. */
  function suiviJLD(st, m, maintenant) {
    var toutes = listeMesures(st);
    var e = rules.echeances(toutes, m, m.cycle, st.config.parametres);
    var p = rules.params(m.type, st.config.parametres);
    var c = m.jld[m.cycle] || {};
    var eff = function (n) { return c[n] ? c[n].date : undefined; };
    var termine = typeof m.fin === 'number';
    function statut(ech, n) {
      var s = rules.statutEcheance(ech, eff(n), maintenant, p.seuilJaune);
      if (termine && (s === 'depasse' || s === 'proche' || s === 'ok')) return ech > m.fin ? 'na' : s;
      return s;
    }
    return {
      cycle: m.cycle, rythmeLong: e.rythmeLong,
      info: { echeance: e.info, effective: eff('INFO'), statut: statut(e.info, 'INFO') },
      saisine: { echeance: e.saisine, effective: eff('SAISINE'), statut: statut(e.saisine, 'SAISINE') },
      decision: { echeance: e.decision, effective: eff('DECISION'), statut: statut(e.decision, 'DECISION') },
      cumulAvant: rules.cumulAvantMesure(toutes, m, 15)
    };
  }

  function dureeHeures(m, maintenant) {
    return ((typeof m.fin === 'number' ? m.fin : maintenant) - m.debut) / H;
  }

  /** Dernière information du tiers pour le cycle courant (ou null). */
  function tiersCycle(m) {
    var t = m.tiers.filter(function (x) { return x.cycle === m.cycle; });
    return t.length ? t[t.length - 1] : null;
  }

  /** Mode d'hospitalisation retenu pour une mesure (règle du registre V1.3). */
  function modeRetenu(st, m) {
    var p = st.patients[m.patientId];
    var modes = p ? p.modes : [];
    var auDebut = m.modeHospi, i;
    for (i = 0; i < modes.length; i++) if (modes[i].date <= m.debut) auDebut = modes[i].mode;
    var estLibre = function (code) {
      var def = (st.config.modesHospitalisation || []).filter(function (x) { return x.code === code; })[0];
      return def ? !def.contrainte : false;
    };
    if (estLibre(auDebut)) {
      var limite = m.debut + (st.config.delaiModeHospiHeures || 12) * H;
      for (i = 0; i < modes.length; i++) {
        if (modes[i].date > m.debut && modes[i].date <= limite && !estLibre(modes[i].mode)) return { mode: modes[i].mode, bascule: true };
      }
    }
    return { mode: auDebut, bascule: false };
  }

  // ------------------------------------------------ Postes de surveillance
  function minutes(hhmm) { var x = hhmm.split(':'); return (+x[0]) * 60 + (+x[1]); }

  /** Instances de période [debut, fin] pour une date locale AAAA-MM-JJ. */
  function bornesPeriode(dateISO, periode) {
    var j = dateISO.split('-');
    var d0 = new Date(+j[0], +j[1] - 1, +j[2]).getTime();
    var a = minutes(periode.debut), b = minutes(periode.fin);
    var debut = d0 + a * 60000;
    var fin = d0 + (b <= a ? b + 1440 : b) * 60000;
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
    var periodes = st.config.periodes || [];
    for (var t = new Date(dateLocaleISO(depuis - J)).getTime(); t <= maintenant + J; t += J) {
      var dateISO = dateLocaleISO(t + 12 * H);
      periodes.forEach(function (p) {
        var b = bornesPeriode(dateISO, p);
        if (b[0] > maintenant || b[1] < depuis) return;
        var couvert = csi.some(function (m) { var f = typeof m.fin === 'number' ? m.fin : maintenant; return m.debut < b[1] && f > b[0]; });
        if (!couvert) return;
        var cle = dateISO + '|' + p.code;
        postes[cle] = { date: dateISO, periode: p.code, libelle: p.libelle, debut: b[0], fin: b[1], professionnels: [] };
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

  /**
   * Entrées du registre pour un service et une année.
   * A : isolement en CSI · B : isolement hors CSI · C : contention en CSI
   * D : contention hors espace d'isolement · E : idem, exception prévue.
   * Une contention en CSI couvre l'isolement qui l'accompagne : seules les
   * portions d'isolement non couvertes deviennent des entrées A.
   */
  function registre(st, service, annee, maintenant) {
    var debutAn = new Date(annee, 0, 1).getTime(), finAn = new Date(annee + 1, 0, 1).getTime();
    var ms = listeMesures(st).filter(function (m) { return m.service === service; });
    var entrees = [];
    ms.forEach(function (m) {
      var fin = typeof m.fin === 'number' ? m.fin : null;
      if (m.type === 'Contention') {
        var cat = m.csi ? 'C' : (m.exception ? 'E' : 'D');
        entrees.push({ cat: cat, mesure: m, debut: m.debut, fin: fin });
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
    entrees = entrees.filter(function (x) { return x.debut >= debutAn && x.debut < finAn; })
      .sort(function (a, b) { return a.debut - b.debut; });
    return entrees.map(function (x, i) {
      var mode = modeRetenu(st, x.mesure);
      var finRef = x.fin === null ? maintenant : x.fin;
      var pros = [];
      if (x.cat === 'A' || x.cat === 'C') {
        (st.config.periodes || []).length && st.professionnels.forEach(function (p) {
          if (p.service !== service) return;
          var per = (st.config.periodes || []).filter(function (q) { return q.code === p.periode; })[0];
          if (!per) return;
          var b = bornesPeriode(p.date, per);
          if (b[0] < finRef && b[1] > x.debut) {
            var lib = p.nom + (p.fonction ? ' (' + p.fonction + ')' : '');
            if (pros.indexOf(lib) < 0) pros.push(lib);
          }
        });
      }
      return {
        numero: x.cat + (i + 1), categorie: x.cat, debut: x.debut, fin: x.fin,
        dureeHeures: (finRef - x.debut) / H, type: x.mesure.type, lieu: x.mesure.lieu,
        psychiatre: x.mesure.psychiatreDebut, modeHospi: mode.mode, basculeMode: mode.bascule,
        professionnels: pros, mesureId: x.mesure.id
      };
    });
  }

  return {
    ROLES: ROLES, DROITS: DROITS, CONFIG_DEFAUT: CONFIG_DEFAUT,
    peut: peut, reduire: reduire, trierEvenements: trierEvenements,
    listeMesures: listeMesures, suiviJLD: suiviJLD, dureeHeures: dureeHeures,
    tiersCycle: tiersCycle, modeRetenu: modeRetenu,
    postesSurveillance: postesSurveillance, bornesPeriode: bornesPeriode, dateLocaleISO: dateLocaleISO,
    registre: registre, soustraire: soustraire
  };
});
