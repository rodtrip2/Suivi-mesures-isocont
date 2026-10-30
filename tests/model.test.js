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
