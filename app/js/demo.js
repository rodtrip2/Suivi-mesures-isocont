/*
 * Données fictives de démonstration. Aucun nom réel : patients, soignants et
 * psychiatres sont inventés et marqués comme tels.
 */
(function (root) {
  'use strict';
  var SIC = root.SIC = root.SIC || {};
  var H = 3600 * 1000, J = 24 * H;

  SIC.chargerDemo = async function (session) {
    var now = Date.now();
    var arrondi = function (ms) { return Math.round(ms / (15 * 60000)) * 15 * 60000; };
    var t = function (h) { return arrondi(now + h * H); };
    var seq = 0;
    var file = [];
    function ajouter(at, type, data) { file.push({ at: at, type: type, data: data, n: seq++ }); }

    var cfg = function (cle, valeur) { ajouter(t(-24 * 300), 'CONFIG', { cle: cle, valeur: valeur }); };
    cfg('services', [{ code: 'U1', libelle: 'Unité 1 (fictive)' }, { code: 'U2', libelle: 'Unité 2 (fictive)' }]);
    cfg('lieuxCSI', { U1: ['CSI 1', 'CSI 2'], U2: ['CSI A'] });
    cfg('psychiatres', ['Dr Arnaud (fictif)', 'Dr Benoît (fictif)', 'Dr Chen (fictif)', 'Dr Diallo (fictif)']);

    var patients = [
      ['P01', '900101', 'ALPHA', 'Camille', 'SDT', 'U1'],
      ['P02', '900102', 'BRAVO', 'Dominique', 'SPI', 'U1'],
      ['P03', '900103', 'CHARLIE', 'Sacha', 'SL', 'U1'],
      ['P04', '900104', 'DELTA', 'Alix', 'SDRE', 'U2'],
      ['P05', '900105', 'ECHO', 'Noa', 'SDTU', 'U1'],
      ['P06', '900106', 'FOXTROT', 'Eden', 'SDT', 'U2']
    ];
    patients.forEach(function (p, i) {
      ajouter(t(-24 * 280 + i), 'PATIENT', { patientId: p[0], ipp: p[1], nom: p[2] + ' (fictif)', prenom: p[3], protection: i === 3 ? 'Curatelle' : '', service: p[5] });
      ajouter(t(-24 * 280 + i), 'MODE_HOSPI', { patientId: p[0], mode: p[4], date: t(-24 * 400) });
    });

    var nMes = 0;
    function mesure(patientId, service, type, debutH, finH, lieu, psy, opts) {
      opts = opts || {};
      var id = 'M' + String(++nMes).padStart(3, '0');
      var csi = lieu.indexOf('CSI') === 0;
      ajouter(t(debutH), 'MESURE_DEBUT', { mesureId: id, patientId: patientId, service: service, typeMesure: type, debut: t(debutH), lieu: csi ? lieu : 'Chambre ' + lieu, csi: csi, psychiatre: psy, exception: !!opts.exception, modeHospi: '' });
      if (opts.tiers) ajouter(t(debutH + 1), 'TIERS', { mesureId: id, cycle: 1, statut: opts.tiers, personne: opts.personne || '', informateur: opts.informateur || 'PSYCHIATRE', nomInformateur: opts.informateur === 'IDE' ? '' : psy, date: t(debutH + 1) });
      (opts.jld || []).forEach(function (j) { ajouter(t(j[2]), 'JLD', { mesureId: id, cycle: j[0], nature: j[1], date: t(j[2]), decision: j[3] || null }); });
      if (finH !== null) ajouter(t(finH), 'MESURE_FIN', { mesureId: id, fin: t(finH), psychiatre: psy });
      return id;
    }

    // Historique de l'année (registre) — Unité 1
    var debutAnnee = (new Date(new Date(now).getFullYear(), 0, 1).getTime() - now) / H;
    var hist = Math.min(-24 * 20, debutAnnee + 24 * 20);
    mesure('P03', 'U1', 'Isolement', hist, hist + 18, 'CSI 1', 'Dr Arnaud (fictif)', { tiers: 'INFORME', personne: 'Mère' });
    mesure('P02', 'U1', 'Isolement', hist + 24 * 30, hist + 24 * 31 + 6, 'CSI 2', 'Dr Benoît (fictif)', { tiers: 'TENTATIVE', informateur: 'IDE' });
    mesure('P02', 'U1', 'Contention', hist + 24 * 30 + 4, hist + 24 * 30 + 10, 'CSI 2', 'Dr Benoît (fictif)', { tiers: 'INFORME', personne: 'Frère' });
    mesure('P05', 'U1', 'Contention', hist + 24 * 60, hist + 24 * 60 + 3, '12', 'Dr Chen (fictif)', { exception: true, tiers: 'PAS_DE_TIERS' });
    mesure('P01', 'U1', 'Isolement', hist + 24 * 90, hist + 24 * 90 + 9, '8', 'Dr Arnaud (fictif)', { tiers: 'REFUS_PATIENT' });

    // Mesures récentes
    // ALPHA : isolement terminé il y a 10 jours (20 h), puis isolement en cours depuis 60 h
    mesure('P01', 'U1', 'Isolement', -24 * 10 - 20, -24 * 10, 'CSI 1', 'Dr Arnaud (fictif)', { tiers: 'INFORME', personne: 'Sœur' });
    mesure('P01', 'U1', 'Isolement', -60, null, 'CSI 1', 'Dr Arnaud (fictif)', {
      tiers: 'INFORME', personne: 'Sœur',
      jld: [[1, 'INFO', -33], [1, 'SAISINE', -10]]
    });
    // BRAVO : isolement depuis 26 h, contention en CSI depuis 20 h
    mesure('P02', 'U1', 'Isolement', -26, null, 'CSI 2', 'Dr Benoît (fictif)', { tiers: 'INFORME', personne: 'Frère' });
    mesure('P02', 'U1', 'Contention', -20, null, 'CSI 2', 'Dr Benoît (fictif)');
    // CHARLIE : isolement hors CSI terminé il y a 3 jours
    mesure('P03', 'U1', 'Isolement', -24 * 3 - 10, -24 * 3, '14', 'Dr Chen (fictif)', { tiers: 'PAS_DE_TIERS' });
    // DELTA (Unité 2) : isolement long, maintien du JLD au cycle 1
    mesure('P04', 'U2', 'Isolement', -110, null, 'CSI A', 'Dr Diallo (fictif)', {
      tiers: 'INFORME', personne: 'Curateur',
      jld: [[1, 'INFO', -64], [1, 'SAISINE', -40], [1, 'DECISION', -16, 'MAINTIEN']]
    });

    // Professionnels en CSI — Unité 1, derniers postes (certains incomplets)
    var noms = [['Agent A (fictif)', 'IDE'], ['Agent B (fictif)', 'AS'], ['Agent C (fictif)', 'IDE'], ['Agent D (fictif)', 'AS'], ['Agent E (fictif)', 'IDE']];
    var periodes = [['M', 7], ['AM', 14], ['N', 21]];
    for (var jour = 2; jour >= 0; jour--) {
      var d = new Date(now - jour * J);
      var dateISO = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      periodes.forEach(function (p, i) {
        var debutPoste = new Date(d.getFullYear(), d.getMonth(), d.getDate(), p[1]).getTime();
        if (debutPoste > now - 2 * H) return;
        var nb = (jour === 0 && i > 0) ? 1 : 2;
        for (var k = 0; k < nb; k++) {
          var a = noms[(jour * 3 + i + k) % noms.length];
          ajouter(debutPoste + H + k * 60000, 'PROFESSIONNEL', { service: 'U1', date: dateISO, periode: p[0], nom: a[0], fonction: a[1] });
        }
      });
    }

    file.sort(function (a, b) { return a.at - b.at || a.n - b.n; });
    for (var i = 0; i < file.length; i++) {
      var at = new Date(Math.min(file[i].at, now) + i).toISOString();
      await session.enregistrer(file[i].type, file[i].data, undefined, { at: at, by: 'demo', sansControle: true });
    }
  };
})(typeof self !== 'undefined' ? self : this);
