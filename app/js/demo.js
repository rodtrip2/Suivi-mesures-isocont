// SPDX-License-Identifier: EUPL-1.2
/*
 * Données fictives de démonstration. Aucun nom réel : patients, soignants et
 * psychiatres sont inventés et marqués comme tels.
 */
(function (root) {
  'use strict';
  var SIC = root.SIC = root.SIC || {};
  var H = 3600 * 1000, J = 24 * H;

  /**
   * Saisies fictives, relatives à l'instant présent.
   * options.config : paramétrage réel à reprendre (jeu de formation) ; sinon, paramétrage de démonstration.
   */
  SIC.donneesFictives = function (options) {
    options = options || {};
    var reel = options.config || null;
    var now = Date.now();
    var arrondi = function (ms) { return Math.round(ms / (15 * 60000)) * 15 * 60000; };
    var t = function (h) { return arrondi(now + h * H); };
    var seq = 0;
    var file = [];
    function ajouter(at, type, data) { file.push({ at: at, type: type, data: data, n: seq++ }); }

    var cfg = function (cle, valeur) { ajouter(t(-24 * 300), 'CONFIG', { cle: cle, valeur: valeur }); };
    var U1 = 'U1', U2 = 'U2', CSI1 = 'CSI 1', CSI2 = 'CSI 2', CSIA = 'CSI A';
    var periodes = [['M', 7], ['AM', 14], ['N', 21]];
    if (reel) {
      // Jeu de formation : mêmes services, CSI et postes que les données réelles, contenu fictif.
      ['services', 'lieuxCSI', 'periodes', 'periodesService', 'modesHospitalisation', 'parametres', 'delaiModeHospiHeures', 'decompte', 'inactiviteMinutes', 'pauses', 'imagesDecompte', 'colonnesPatients', 'casParticuliers', 'qualite', 'statsMethode', 'informateursTiers'].forEach(function (k) {
        if (reel[k] !== undefined) cfg(k, reel[k]);
      });
      // Alertes : seules les mesures saisies pendant la formation les déclenchent.
      if (reel.alertes !== undefined) cfg('alertes', reel.alertes.map(function (r) { return Object.assign({}, r, { depuis: r.active ? now : 0 }); }));
      cfg('etablissement', ((reel.etablissement || '') + ' — FORMATION').replace(/^ — /, ''));
      var svs = (reel.services || []).map(function (x) { return x.code; });
      if (!svs.length) { svs = ['U1']; cfg('services', [{ code: 'U1', libelle: 'Unité 1 (fictive)' }]); }
      U1 = svs[0]; U2 = svs[1] || svs[0];
      var l1 = ((reel.lieuxCSI || {})[U1] || []), l2 = ((reel.lieuxCSI || {})[U2] || []);
      CSI1 = l1[0] || 'CSI 1'; CSI2 = l1[1] || l1[0] || 'CSI 2'; CSIA = l2[0] || 'CSI A';
      var lieux = JSON.parse(JSON.stringify(reel.lieuxCSI || {}));
      [[U1, CSI1], [U1, CSI2], [U2, CSIA]].forEach(function (x) { lieux[x[0]] = lieux[x[0]] || []; if (lieux[x[0]].indexOf(x[1]) < 0) lieux[x[0]].push(x[1]); });
      cfg('lieuxCSI', lieux);
      periodes = SIC.model.periodesDe(reel, U1).map(function (p) { return [p.code, +p.debut.split(':')[0]]; });
    } else {
      cfg('services', [{ code: 'U1', libelle: 'Unité 1 (fictive)' }, { code: 'U2', libelle: 'Unité 2 (fictive)' }]);
      cfg('etablissement', 'Établissement fictif de démonstration');
      cfg('lieuxCSI', { U1: ['CSI 1', 'CSI 2'], U2: ['CSI A'] });
      // Démonstration : information du cadre ou de l'administrateur de garde pour un patient en soins libres (Unité 1)
      cfg('alertes', SIC.model.CONFIG_DEFAUT.alertes.map(function (r) {
        return r.declencheur === 'soins-libres' ? Object.assign({}, r, { active: true, services: ['U1'], depuis: now }) : Object.assign({}, r, { depuis: r.active ? now : 0 });
      }));
    }
    cfg('psychiatres', ['Dr Arnaud (fictif)', 'Dr Benoît (fictif)', 'Dr Chen (fictif)', 'Dr Diallo (fictif)']);

    var patients = [
      ['P01', '900101', 'ALPHA', 'Camille', 'SDT', U1, 41],
      ['P02', '900102', 'BRAVO', 'Dominique', 'SPI', U1, 33],
      ['P03', '900103', 'CHARLIE', 'Sacha', 'SL', U1, 48],
      ['P04', '900104', 'DELTA', 'Alix', 'SDRE', U2, 66],
      ['P05', '900105', 'ECHO', 'Noa', 'SDTU', U1, 16],
      ['P06', '900106', 'FOXTROT', 'Eden', 'SDT', U2, 27]
    ];
    patients.forEach(function (p, i) {
      var dn = new Date(now); dn.setFullYear(dn.getFullYear() - p[6]); dn.setMonth((i * 5) % 12, 3 + i * 4);
      if (dn.getTime() > now - p[6] * 365.25 * J) dn.setFullYear(dn.getFullYear() - 1);   // âge révolu = p[6]
      ajouter(t(-24 * 280 + i), 'PATIENT', { patientId: p[0], ipp: p[1], nom: p[2] + ' (fictif)', prenom: p[3], naissance: SIC.model.dateLocaleISO(dn.getTime()), protection: i === 3 ? 'Curatelle' : '', service: p[5] });
      ajouter(t(-24 * 280 + i), 'MODE_HOSPI', { patientId: p[0], mode: p[4], date: t(-24 * 400) });
    });

    var nMes = 0;
    function mesure(patientId, service, type, debutH, finH, lieu, psy, opts) {
      opts = opts || {};
      var id = 'M' + String(++nMes).padStart(3, '0');
      var csi = lieu.indexOf('Chambre ') !== 0;   // les lieux hors CSI sont écrits « Chambre n »
      ajouter(t(debutH), 'MESURE_DEBUT', { mesureId: id, patientId: patientId, service: service, typeMesure: type, debut: t(debutH), lieu: csi ? lieu : 'Chambre ' + lieu.replace(/^Chambre /, ''), csi: csi, psychiatre: psy, exception: !!opts.exception, modeHospi: '' });
      if (opts.tiers) ajouter(t(debutH + 1), 'TIERS', { mesureId: id, cycle: 1, statut: opts.tiers, personne: opts.personne || '', informateur: opts.informateur || 'PSYCHIATRE', nomInformateur: opts.informateur === 'IDE' ? '' : psy, date: t(debutH + 1) });
      (opts.jld || []).forEach(function (j) { ajouter(t(j[2]), 'JLD', { mesureId: id, cycle: j[0], nature: j[1], date: t(j[2]), decision: j[3] || null }); });
      (opts.pauses || []).forEach(function (pz) {
        ajouter(t(pz[0]), 'PAUSE', { mesureId: id, debut: t(pz[0]), reprisePrevue: t(pz[1]), psychiatre: psy, motif: pz[3] || '' });
        if (pz[2] !== null) ajouter(t(pz[2]), 'REPRISE', { mesureId: id, date: t(pz[2]) });
      });
      if (finH !== null) ajouter(t(finH), 'MESURE_FIN', { mesureId: id, fin: t(finH), psychiatre: psy });
      return id;
    }

    // Historique de l'année (registre) — Unité 1
    var debutAnnee = (new Date(new Date(now).getFullYear(), 0, 1).getTime() - now) / H;
    var hist = Math.min(-24 * 20, debutAnnee + 24 * 20);
    mesure('P03', U1, 'Isolement', hist, hist + 18, CSI1, 'Dr Arnaud (fictif)', { tiers: 'INFORME', personne: 'Mère' });
    mesure('P02', U1, 'Isolement', hist + 24 * 30, hist + 24 * 31 + 6, CSI2, 'Dr Benoît (fictif)', { tiers: 'TENTATIVE', informateur: 'IDE' });
    mesure('P02', U1, 'Contention', hist + 24 * 30 + 4, hist + 24 * 30 + 10, CSI2, 'Dr Benoît (fictif)', { tiers: 'INFORME', personne: 'Frère' });
    mesure('P05', U1, 'Contention', hist + 24 * 60, hist + 24 * 60 + 3, 'Chambre 12', 'Dr Chen (fictif)', { exception: true, tiers: 'PAS_DE_TIERS' });
    mesure('P01', U1, 'Isolement', hist + 24 * 90, hist + 24 * 90 + 9, 'Chambre 8', 'Dr Arnaud (fictif)', { tiers: 'REFUS_PATIENT' });

    // Mesures récentes
    // ALPHA : isolement terminé il y a 10 jours (20 h), puis isolement en cours depuis 60 h
    mesure('P01', U1, 'Isolement', -24 * 10 - 20, -24 * 10, CSI1, 'Dr Arnaud (fictif)', { tiers: 'INFORME', personne: 'Sœur' });
    mesure('P01', U1, 'Isolement', -60, null, CSI1, 'Dr Arnaud (fictif)', {
      tiers: 'INFORME', personne: 'Sœur',
      jld: [[1, 'INFO', -33], [1, 'SAISINE', -10]],
      pauses: [[-28, -27, -27, 'Repas'], [-8, -7.5, -7.25, 'Hygiène, douche']]
    });
    // BRAVO : isolement depuis 26 h, contention en CSI depuis 20 h
    mesure('P02', U1, 'Isolement', -26, null, CSI2, 'Dr Benoît (fictif)', { tiers: 'INFORME', personne: 'Frère' });
    mesure('P02', U1, 'Contention', -20, null, CSI2, 'Dr Benoît (fictif)');
    // CHARLIE : isolement hors CSI terminé il y a 3 jours
    mesure('P03', U1, 'Isolement', -24 * 3 - 10, -24 * 3, 'Chambre 14', 'Dr Chen (fictif)', { tiers: 'PAS_DE_TIERS' });
    // DELTA (Unité 2) : isolement long, maintien du JLD au cycle 1
    mesure('P04', U2, 'Isolement', -110, null, CSIA, 'Dr Diallo (fictif)', {
      tiers: 'INFORME', personne: 'Curateur',
      jld: [[1, 'INFO', -64], [1, 'SAISINE', -40], [1, 'DECISION', -16, 'MAINTIEN']],
      pauses: [[-0.75, 1.25, null, 'Visite']]
    });

    // Professionnels en CSI — Unité 1, derniers postes (certains incomplets)
    var noms = [['Agent A (fictif)', 'IDE'], ['Agent B (fictif)', 'AS'], ['Agent C (fictif)', 'IDE'], ['Agent D (fictif)', 'AS'], ['Agent E (fictif)', 'IDE']];
    for (var jour = 2; jour >= 0; jour--) {
      var d = new Date(now - jour * J);
      var dateISO = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      periodes.forEach(function (p, i) {
        var debutPoste = new Date(d.getFullYear(), d.getMonth(), d.getDate(), p[1]).getTime();
        if (debutPoste > now - 2 * H) return;
        var nb = (jour === 0 && i > 0) ? 1 : 2;
        for (var k = 0; k < nb; k++) {
          var a = noms[(jour * 3 + i + k) % noms.length];
          ajouter(debutPoste + H + k * 60000, 'PROFESSIONNEL', { service: U1, date: dateISO, periode: p[0], nom: a[0], fonction: a[1] });
        }
      });
    }

    file.sort(function (a, b) { return a.at - b.at || a.n - b.n; });
    return file.map(function (x, i) { return { at: new Date(Math.min(x.at, now) + i).toISOString(), by: 'demo', type: x.type, data: x.data }; });
  };

  SIC.chargerDemo = async function (session) {
    await session.enregistrerLot(SIC.donneesFictives(), { libelle: 'Données fictives de démonstration', by: 'demo', sansControle: true });
  };
})(typeof self !== 'undefined' ? self : this);
