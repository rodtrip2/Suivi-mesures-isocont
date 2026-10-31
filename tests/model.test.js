// SPDX-License-Identifier: EUPL-1.2
// Services par compte, lots, registre, statistiques, décompte JLD : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

const H = 3600 * 1000;
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
let n = 0;
const evt = (type, data, extra) => Object.assign({ id: 'e' + String(++n).padStart(5, '0'), at: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString(), by: 'u1', type, data }, extra || {});

test('Services visibles : affectés pour un agent, tous pour un administrateur', () => {
  const config = { services: [{ code: 'A' }, { code: 'B' }, { code: 'C' }] };
  assert.deepEqual(M.servicesDe({ roles: ['IDE'], services: ['B', 'Z'] }, config), ['B']);
  assert.deepEqual(M.servicesDe({ roles: ['CADRE'], services: [] }, config), []);
  assert.deepEqual(M.servicesDe({ roles: ['CADRE', 'ADMIN'], services: ['A'] }, config), ['A', 'B', 'C']);
});

test('Lot : ses saisies sont appliquées, annulables une à une ou en bloc', () => {
  const l = evt('LOT', { evenements: [
    { type: 'PATIENT', data: { patientId: 'P1', nom: 'X' } },
    { type: 'MESURE_DEBUT', data: { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 2, 1, 8), csi: true } },
    { type: 'MESURE_FIN', data: { mesureId: 'M1', fin: local(2026, 2, 1, 20) } }
  ] });
  let st = M.reduire([l]);
  assert.equal(st.mesures.M1.fin, local(2026, 2, 1, 20));
  assert.equal(st.journal.length, 1);
  st = M.reduire([l, evt('ANNULATION', { cible: l.id + '.00002' })]);
  assert.equal(st.mesures.M1.fin, null);
  st = M.reduire([l, evt('ANNULATION', { cible: l.id })]);
  assert.equal(Object.keys(st.mesures).length, 0);
});

function base() {
  return [
    evt('PATIENT', { patientId: 'P1', naissance: '2010-06-01' }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2025, 1, 1) }),
    evt('PATIENT', { patientId: 'P2' }),
    evt('MODE_HOSPI', { patientId: 'P2', mode: 'SL', date: local(2025, 1, 1) }),
    evt('MESURE_DEBUT', { mesureId: 'I1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('MESURE_FIN', { mesureId: 'I1', fin: local(2026, 3, 2, 8) }),
    evt('MESURE_DEBUT', { mesureId: 'C1', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: local(2026, 3, 1, 10), csi: true }),
    evt('MESURE_FIN', { mesureId: 'C1', fin: local(2026, 3, 1, 14) }),
    evt('MESURE_DEBUT', { mesureId: 'B1', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 2, 10, 9), csi: false }),
    evt('MESURE_FIN', { mesureId: 'B1', fin: local(2026, 2, 10, 15) }),
    evt('TIERS', { mesureId: 'I1', cycle: 1, statut: 'INFORME', informateur: 'PSYCHIATRE', date: local(2026, 3, 1, 9) }),
    evt('MESURE_DEBUT', { mesureId: 'I2', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 5, 1, 8), csi: true })
  ];
}

test('Registre : numérotation dans l\'ordre des fins, à la suite du registre antérieur ; entrées en cours sans numéro', () => {
  const st = M.reduire(base().concat([evt('CONFIG', { cle: 'compteursRegistre', valeur: { U1: { 2026: 40 } } })]));
  const reg = M.registre(st, 'U1', 2026, local(2026, 5, 2));
  assert.deepEqual(reg.map(e => e.numero), ['B41', 'A42', 'C43', 'A44', '']);
});

test('Statistiques annuelles : mesures, patients, durées, CSI, soins libres, mineurs, tiers', () => {
  const st = M.reduire(base().concat([evt('STATS', { service: 'U1', annee: 2026, hc: 100, ssc: 40 })]));
  const s = M.statistiquesAnnee(st, ['U1'], 2026, local(2026, 5, 2));
  assert.equal(s.mesures, 4);
  assert.equal(s.enCours, 1);
  assert.equal(s.patients, 2);
  assert.equal(s.patientsIsolement, 2);
  assert.equal(s.patientsContention, 1);
  assert.equal(s.duree.total, 6 + 2 + 4 + 18);
  assert.equal(s.heuresCSI, 24);
  assert.equal(s.soinsLibres, 1);
  assert.equal(s.patientsMineurs, 1);
  assert.equal(s.partPatientsHC, 0.02);
  assert.deepEqual(s.categories, { A: 2, B: 1, C: 1, D: 0, E: 0 });
  assert.equal(s.tiers.INFORME, 1);
  assert.equal(s.mois[2].mesures, 3);
});

test('Décompte JLD : mesure antérieure sur 15 jours puis segments de 24 h avec cumul', () => {
  const evts = [
    evt('MESURE_DEBUT', { mesureId: 'A', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 9, 25, 8), csi: true }),
    evt('MESURE_FIN', { mesureId: 'A', fin: local(2026, 9, 26, 2) }),
    evt('MESURE_DEBUT', { mesureId: 'B', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 10, 1, 8), csi: true })
  ];
  const st = M.reduire(evts);
  const d = M.decompte(st, st.mesures.B, local(2026, 10, 3, 20));
  assert.equal(d.cumulAvant, 18);
  assert.deepEqual(d.lignes.map(l => Math.round(l.duree)), [18, 24, 24, 12]);
  assert.deepEqual(d.lignes.map(l => Math.round(l.cumul)), [18, 42, 66, 78]);
  assert.equal(d.lignes[3].statut, 'EN COURS');
  assert.equal(d.total, 78);
});

test('Cumuls patient et niveau de vigilance', () => {
  const st = M.reduire(base());
  const c = M.cumulsPatient(st, 'P2', local(2026, 5, 3, 8));
  assert.equal(c.iso48, 48);
  assert.equal(c.niveau, 'rouge');
});

test('Postes de surveillance propres à un service', () => {
  const st = M.reduire(base().concat([evt('CONFIG', { cle: 'periodesService', valeur: { U1: [{ code: 'J', libelle: 'Jour', debut: '07:00', fin: '19:00' }, { code: 'N', libelle: 'Nuit', debut: '19:00', fin: '07:00' }] } })]));
  const postes = M.postesSurveillance(st, 'U1', local(2026, 5, 2, 12), 2);
  assert.ok(postes.length >= 3);
  assert.ok(postes.every(p => p.periode === 'J' || p.periode === 'N'));
});

test('Chaînage : une saisie supprimée du dossier est signalée', () => {
  const a = evt('PATIENT', { patientId: 'P1' });
  const b = evt('PATIENT', { patientId: 'P2' }, { prec: a.id });
  const c = evt('PATIENT', { patientId: 'P3' }, { prec: b.id });
  assert.equal(M.reduire([a, b, c]).manquants.length, 0);
  const st = M.reduire([a, c]);
  assert.deepEqual(st.manquants.map(x => x.manque), [b.id]);
});

test('Pause (levée temporaire) : ne termine pas la mesure, ne décale pas les échéances, reprise tracée', () => {
  const d0 = local(2026, 3, 1, 8);
  const debut = evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0, csi: true });
  const sans = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut]);
  const echSans = M.suiviJLD(sans, sans.mesures.M1, d0 + 30 * H);

  const pause = evt('PAUSE', { mesureId: 'M1', debut: d0 + 4 * H, reprisePrevue: d0 + 5 * H, psychiatre: 'Dr X (fictif)', motif: 'Repas' }, { base: 1 });
  let st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause]);
  const m = st.mesures.M1;
  assert.equal(m.fin, null);
  assert.ok(M.pauseEnCours(m, d0 + 4.5 * H));
  assert.equal(M.pauseEnCours(m, d0 + 4.5 * H).depassee, false);
  assert.equal(M.pauseEnCours(m, d0 + 6 * H).depassee, true);          // reprise prévue passée, non confirmée
  assert.equal(M.pauseEnCours(m, d0 + 3 * H), null);                    // avant la pause
  assert.equal(M.dureeHeures(m, d0 + 6 * H), 6);                        // la durée continue de courir
  const echAvec = M.suiviJLD(st, m, d0 + 30 * H);
  assert.equal(echAvec.info.echeance, echSans.info.echeance);
  assert.equal(echAvec.saisine.echeance, echSans.saisine.echeance);

  // Reprise : clôt la pause désignée
  const reprise = evt('REPRISE', { mesureId: 'M1', pause: pause.id, date: d0 + 5.25 * H }, { base: 2 });
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, reprise]);
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 6 * H), null);
  assert.equal(M.dureePausesHeures(st.mesures.M1, d0 + 10 * H), 1.25);
  assert.equal(st.conflits.length, 0);

  // Fin pendant la pause : la pause s'arrête à la fin de la mesure
  const fin = evt('MESURE_FIN', { mesureId: 'M1', fin: d0 + 4 * H }, { base: 2 });
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, fin]);
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 6 * H), null);
  assert.equal(M.dureePausesHeures(st.mesures.M1, d0 + 10 * H), 0);

  // Annulation de la pause
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, evt('ANNULATION', { cible: pause.id })]);
  assert.equal(st.mesures.M1.pauses.length, 0);

  // Deux pauses saisies en même temps par deux agents : conflit à arbitrer
  const concurrente = evt('PAUSE', { mesureId: 'M1', debut: d0 + 4 * H, reprisePrevue: d0 + 6 * H }, { base: 1, by: 'u2' });
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, concurrente]);
  assert.equal(st.conflits.length, 1);
  assert.equal(st.mesures.M1.pauses.length, 1);

  // Droits : IDE, AS et cadre ; pas la secrétaire
  assert.ok(M.peut(['AS'], 'PAUSE') && M.peut(['IDE'], 'REPRISE') && M.peut(['CADRE'], 'PAUSE'));
  assert.ok(!M.peut(['SECRETAIRE'], 'PAUSE'));
});

test('Option : pauses retranchées des décomptes et échéances reportées d’autant', () => {
  const d0 = local(2026, 4, 1, 8);
  const evts = (cfg) => [
    evt('CONFIG', { cle: 'pauses', valeur: cfg }),
    evt('CONFIG', { cle: 'services', valeur: [{ code: 'U1', libelle: 'U1' }] }),
    evt('PATIENT', { patientId: 'P1' }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2026, 1, 1) }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0, csi: true, lieu: 'CSI 1' }),
    evt('PAUSE', { mesureId: 'M1', debut: d0 + 4 * H, reprisePrevue: d0 + 6 * H }, { base: 1 }),
    evt('REPRISE', { mesureId: 'M1', date: d0 + 6 * H }, { base: 2 })
  ];
  const sans = M.reduire(evts({ retrancher: false }));
  const avec = M.reduire(evts({ retrancher: true }));
  const t = d0 + 20 * H;
  assert.equal(M.dureeHeures(sans.mesures.M1, t, sans.config), 20);
  assert.equal(M.dureeHeures(avec.mesures.M1, t, avec.config), 18);
  assert.equal(M.cumulsPatient(avec, 'P1', t).iso15, 18);
  const eSans = M.suiviJLD(sans, sans.mesures.M1, t), eAvec = M.suiviJLD(avec, avec.mesures.M1, t);
  assert.equal(eAvec.info.echeance - eSans.info.echeance, 2 * H);           // 48 h décomptées = début + 50 h
  assert.equal(eAvec.saisine.echeance - eSans.saisine.echeance, 2 * H);
  // Décompte et registre
  const dc = M.decompte(avec, avec.mesures.M1, t);
  assert.equal(dc.total, 18);
  assert.match(dc.lignes[0].commentaire, /pause retranchée : 2 h 00/);
  assert.equal(M.registre(avec, 'U1', 2026, t)[0].dureeHeures, 18);
  // Mesure suivante : le cumul des 15 jours tient compte de la pause retranchée
  const suite = evts({ retrancher: true }).concat([
    evt('MESURE_FIN', { mesureId: 'M1', fin: d0 + 20 * H }, { base: 3 }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0 + 30 * H, csi: true })
  ]);
  const st2 = M.reduire(suite);
  assert.equal(M.suiviJLD(st2, st2.mesures.M2, d0 + 31 * H).cumulAvant, 18);
});

test('Option : pause non reprise retranchée jusqu’à la reprise prévue seulement ; reprise automatique', () => {
  const d0 = local(2026, 5, 1, 8);
  const evts = (cfg) => [
    evt('CONFIG', { cle: 'pauses', valeur: cfg }),
    evt('PATIENT', { patientId: 'P1' }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: d0, csi: true }),
    evt('PAUSE', { mesureId: 'M1', debut: d0 + 2 * H, reprisePrevue: d0 + 3 * H }, { base: 1 })
  ];
  let st = M.reduire(evts({ retrancher: true }));
  const m = st.mesures.M1;
  assert.deepEqual(M.exclusions(m, d0 + 2.5 * H, st.config), [[d0 + 2 * H, d0 + 2.5 * H]]);   // pause en cours : jusqu'à maintenant
  assert.deepEqual(M.exclusions(m, d0 + 10 * H, st.config), [[d0 + 2 * H, d0 + 3 * H]]);    // reprise non saisie : plafonnée à l'heure prévue
  assert.ok(M.pauseEnCours(m, d0 + 10 * H, st.config).depassee);                                 // sans reprise automatique : à confirmer

  st = M.reduire(evts({ repriseAuto: true }));
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 2.5 * H, st.config).depassee, false);
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 3 * H, st.config), null);                     // reprise automatique
  assert.ok(M.repriseAutomatique(st.mesures.M1, st.mesures.M1.pauses[0], d0 + 4 * H, st.config));
  assert.equal(M.dureePausesHeures(st.mesures.M1, d0 + 10 * H, st.config), 1);
  assert.equal(M.dureeHeures(st.mesures.M1, d0 + 10 * H, st.config), 10);                          // non retranchée par défaut

  // Seuils réglables, plafonnés à 48 h ; l'alerte reste sous le refus
  assert.deepEqual([M.optionsPauses({}).alerteHeures, M.optionsPauses({}).refusHeures], [12, 48]);
  assert.equal(M.optionsPauses({ pauses: { refusHeures: 72 } }).refusHeures, 48);
  assert.equal(M.optionsPauses({ pauses: { alerteHeures: 30, refusHeures: 24 } }).alerteHeures, 24);
});

test('Masque du décompte JLD : défaut, établissement, service, anciens réglages', () => {
  const d = M.masqueDecompte({}, 'U1');
  assert.deepEqual(d.colonnes, M.COLONNES_DECOMPTE);
  assert.equal(d.propre, false);
  assert.equal(d.sections.total, true);
  const config = { decompte: {
    '*': { entete: 'CH (fictif)', identite: ['patient', 'ipp'], sections: { jld: true } },
    U1: { titreIsolement: 'Isolement — U1', colonnes: ['Cumul', 'Debut', 'Inconnue'], sections: { cycle: false } },
    U2: { titreIsolement: '', masquer: ['N', 'Commentaire'] }        // ancien format (import V1.3)
  } };
  const u1 = M.masqueDecompte(config, 'U1');
  assert.equal(u1.propre, true);
  assert.equal(u1.titreIsolement, 'Isolement — U1');
  assert.equal(u1.entete, 'CH (fictif)');                              // hérité de l'établissement
  assert.deepEqual(u1.identite, ['patient', 'ipp']);
  assert.deepEqual(u1.colonnes, ['Cumul', 'Debut']);                   // ordre conservé, colonne inconnue écartée
  assert.equal(u1.sections.jld, true);
  assert.equal(u1.sections.cycle, false);
  assert.equal(u1.sections.total, true);
  const u2 = M.masqueDecompte(config, 'U2');
  assert.equal(u2.titreIsolement, M.MASQUE_DEFAUT.titreIsolement);     // titre vide : titre par défaut
  assert.deepEqual(u2.colonnes, ['Debut', 'Fin', 'Duree', 'Cumul', 'Statut']);
  assert.equal(M.masqueDecompte(config, 'U3').propre, false);
});
