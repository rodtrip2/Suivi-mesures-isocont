// SPDX-License-Identifier: EUPL-1.2
/*
 * Moteur de règles légales — Suivi-mesures-isocont
 * Reprise fidèle des calculs de la V1.3 (Module_Actualisation_V1_3) :
 *  - cumul glissant 15 jours par patient et par type, périodes fusionnées,
 *    jamais avant la fin de la dernière mesure levée par le JLD ;
 *  - échéances JLD ancrées sur le DÉBUT de la mesure (jamais sur les décisions du juge) ;
 *  - rythme des mesures longues (isolement, à partir du cycle 3).
 * Option : les plages `exclusions` d'une mesure (pauses retranchées) sont
 * soustraites de toutes les durées, et les échéances sont reportées d'autant.
 * Toutes les dates sont des nombres (millisecondes depuis l'époque).
 * Utilisable dans le navigateur (window.SIC.rules) et dans Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SIC = root.SIC || {}).rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var H = 3600 * 1000;
  var J = 24 * H;

  // Valeurs de la feuille PARAMETRES de la V1.3 (modifiables par service).
  var PARAMETRES_DEFAUT = {
    Isolement: {
      seuilInfo15j: 48, seuilSaisine15j: 72, seuilDecision15j: 96,
      intervalleCycle: 96, rythmeLongCycle: 3,
      rythmeLongInfoSaisine: 144, rythmeLongDecision: 168,
      seuilJaune: 12
    },
    Contention: {
      seuilInfo15j: 24, seuilSaisine15j: 48, seuilDecision15j: 72,
      intervalleCycle: 72, rythmeLongCycle: 0,
      rythmeLongInfoSaisine: 144, rythmeLongDecision: 168,
      seuilJaune: 12
    }
  };

  function params(type, surcharge) {
    var base = PARAMETRES_DEFAUT[type];
    if (!base) throw new Error('Type de mesure inconnu : ' + type);
    var p = {};
    for (var k in base) p[k] = base[k];
    if (surcharge && surcharge[type]) for (var k2 in surcharge[type]) p[k2] = surcharge[type][k2];
    return p;
  }

  /** Somme des heures d'intervalles [debut, fin], chevauchements fusionnés. */
  function heuresFusionnees(intervalles) {
    var iv = intervalles
      .filter(function (x) { return x[1] > x[0]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var total = 0, cd = null, cf = null;
    for (var i = 0; i < iv.length; i++) {
      if (cd === null) { cd = iv[i][0]; cf = iv[i][1]; continue; }
      if (iv[i][0] <= cf) { if (iv[i][1] > cf) cf = iv[i][1]; }
      else { total += cf - cd; cd = iv[i][0]; cf = iv[i][1]; }
    }
    if (cd !== null) total += cf - cd;
    return total / H;
  }

  /** Morceaux de [debut, fin] restant après retrait des plages `exclusions`. */
  function retrancher(debut, fin, exclusions) {
    var morceaux = [[debut, fin]];
    (exclusions || []).forEach(function (x) {
      var res = [];
      morceaux.forEach(function (m) {
        if (x[1] <= m[0] || x[0] >= m[1]) { res.push(m); return; }
        if (x[0] > m[0]) res.push([m[0], x[0]]);
        if (x[1] < m[1]) res.push([x[1], m[1]]);
      });
      morceaux = res;
    });
    return morceaux.filter(function (m) { return m[1] > m[0]; });
  }

  /** Heures décomptées d'une mesure entre `debut` et `fin` (pauses retranchées le cas échéant). */
  function heuresEffectives(mesure, debut, fin) {
    return heuresFusionnees(retrancher(debut, fin, mesure.exclusions));
  }

  /** Instant où `heures` décomptées sont atteintes depuis `debut`, les plages exclues ne comptant pas. */
  function instantEffectif(debut, heures, exclusions) {
    var t = debut, reste = heures * H;
    var ex = (exclusions || []).filter(function (x) { return x[1] > debut; }).sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < ex.length; i++) {
      var d = Math.max(ex[i][0], t);
      if (d > t) {
        if (d - t >= reste) return t + reste;
        reste -= d - t; t = d;
      }
      if (ex[i][1] > t) t = ex[i][1];
    }
    return t + reste;
  }

  function memePatientType(m, patientId, type) {
    return m.patientId === patientId && m.type === type && typeof m.debut === 'number';
  }

  /** Fin de la plus récente mesure levée par le JLD (même patient, même type), terminée avant `avant`. 0 si aucune. */
  function derniereLeveeJLD(mesures, patientId, type, avant) {
    var d = 0;
    mesures.forEach(function (m) {
      if (memePatientType(m, patientId, type) && m.leveeJLD && typeof m.fin === 'number' && m.fin < avant && m.fin > d) d = m.fin;
    });
    return d;
  }

  /** Cumul (heures) des mesures du même type commencées avant `mesure`, sur `jours` glissants avant son début. */
  function cumulAvantMesure(mesures, mesure, jours) {
    jours = jours || 15;
    var borne = Math.max(mesure.debut - jours * J, derniereLeveeJLD(mesures, mesure.patientId, mesure.type, mesure.debut));
    var iv = [];
    mesures.forEach(function (m) {
      if (m.id === mesure.id || !memePatientType(m, mesure.patientId, mesure.type)) return;
      if (m.debut >= mesure.debut) return;
      var fin = typeof m.fin === 'number' ? m.fin : mesure.debut;
      iv = iv.concat(retrancher(Math.max(m.debut, borne), Math.min(fin, mesure.debut), m.exclusions));
    });
    return heuresFusionnees(iv);
  }

  /** Cumul (heures) d'un patient pour un type, sur `jours` glissants avant `reference`. */
  function cumulHeures(mesures, patientId, type, reference, jours) {
    var borne = Math.max(reference - jours * J, derniereLeveeJLD(mesures, patientId, type, reference));
    var iv = [];
    mesures.forEach(function (m) {
      if (!memePatientType(m, patientId, type) || m.debut > reference) return;
      var fin = typeof m.fin === 'number' ? m.fin : reference;
      iv = iv.concat(retrancher(Math.max(m.debut, borne), Math.min(fin, reference), m.exclusions));
    });
    return heuresFusionnees(iv);
  }

  function seuil(p, nature) {
    if (nature === 'INFO') return p.seuilInfo15j;
    if (nature === 'SAISINE') return p.seuilSaisine15j;
    if (nature === 'DECISION') return p.seuilDecision15j;
    throw new Error('Nature JLD inconnue : ' + nature);
  }

  /**
   * Échéances Information / Saisine / Décision d'une mesure pour un cycle donné.
   * Cycle 1 : début + (seuil cumul 15 j − cumul déjà réalisé avant la mesure).
   * Cycles suivants : cycle 1 + (n − 1) × intervalle, puis rythme long éventuel.
   */
  function echeances(mesures, mesure, cycle, surcharge) {
    var e = echeancesBrutes(mesures, mesure, cycle, surcharge);
    if (!mesure.exclusions || !mesure.exclusions.length) return e;
    // Pauses retranchées : chaque échéance est reportée de la durée des pauses qui la précèdent.
    var conv = function (t) { return instantEffectif(mesure.debut, (t - mesure.debut) / H, mesure.exclusions); };
    return { cycle: e.cycle, info: conv(e.info), saisine: conv(e.saisine), decision: conv(e.decision), rythmeLong: e.rythmeLong };
  }

  function echeancesBrutes(mesures, mesure, cycle, surcharge) {
    var p = params(mesure.type, surcharge);
    cycle = Math.max(1, cycle || 1);
    var cumul = cumulAvantMesure(mesures, mesure, 15);
    function e1(nature) { return mesure.debut + Math.max(0, seuil(p, nature) - cumul) * H; }
    var i1 = e1('INFO'), s1 = e1('SAISINE'), d1 = e1('DECISION');
    if (p.rythmeLongCycle >= 2 && cycle >= p.rythmeLongCycle) {
      var base = d1 + (p.rythmeLongCycle - 2) * p.intervalleCycle * H + (cycle - p.rythmeLongCycle) * p.rythmeLongDecision * H;
      var info = base + p.rythmeLongInfoSaisine * H;
      return { cycle: cycle, info: info, saisine: info, decision: base + p.rythmeLongDecision * H, rythmeLong: true };
    }
    var dec = (cycle - 1) * p.intervalleCycle * H;
    return { cycle: cycle, info: i1 + dec, saisine: s1 + dec, decision: d1 + dec, rythmeLong: false };
  }

  /** Statut d'affichage d'une échéance : fait | fait-retard | depasse | proche | ok. */
  function statutEcheance(echeance, effective, maintenant, seuilJauneHeures) {
    if (typeof effective === 'number') return effective > echeance ? 'fait-retard' : 'fait';
    if (maintenant > echeance) return 'depasse';
    if (maintenant >= echeance - (seuilJauneHeures || 12) * H) return 'proche';
    return 'ok';
  }

  /** Une mesure terminée depuis 15 jours ou moins compte encore dans les cumuls. */
  function etatAffichage(mesure, maintenant) {
    if (typeof mesure.fin !== 'number') return 'en-cours';
    return maintenant - mesure.fin <= 15 * J ? 'recente' : 'ancienne';
  }

  return {
    H: H, J: J,
    PARAMETRES_DEFAUT: PARAMETRES_DEFAUT,
    params: params,
    heuresFusionnees: heuresFusionnees,
    retrancher: retrancher,
    heuresEffectives: heuresEffectives,
    instantEffectif: instantEffectif,
    derniereLeveeJLD: derniereLeveeJLD,
    cumulAvantMesure: cumulAvantMesure,
    cumulHeures: cumulHeures,
    echeances: echeances,
    statutEcheance: statutEcheance,
    etatAffichage: etatAffichage
  };
});
