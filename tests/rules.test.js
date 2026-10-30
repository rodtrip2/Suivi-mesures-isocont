// Tests des règles légales : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../app/js/rules.js');
const M = require('../app/js/model.js');

const H = R.H, J = R.J;
// Dates en UTC pour des tests indépendants du fuseau et de l'heure d'été.
const d = (s) => Date.parse(s + 'Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 16);

function mesure(id, type, debut, fin, extra) {
  return Object.assign({ id, patientId: 'P1', type, debut: d(debut), fin: fin ? d(fin) : null, leveeJLD: false }, extra || {});
}

test('Exemple de référence V1.3 : isolement du 01/10 08:45 sans cumul antérieur', () => {
  const m = mesure('M1', 'Isolement', '2026-10-01T08:45');
  const all = [m];
  const c1 = R.echeances(all, m, 1);
  assert.equal(iso(c1.info), '2026-10-03T08:45');
  assert.equal(iso(c1.saisine), '2026-10-04T08:45');
  assert.equal(iso(c1.decision), '2026-10-05T08:45');
  const c2 = R.echeances(all, m, 2);
  assert.equal(iso(c2.info), '2026-10-07T08:45');
  assert.equal(iso(c2.saisine), '2026-10-08T08:45');
  assert.equal(iso(c2.decision), '2026-10-09T08:45');
  const c3 = R.echeances(all, m, 3);
  assert.equal(c3.rythmeLong, true);
  assert.equal(iso(c3.info), '2026-10-15T08:45');
  assert.equal(iso(c3.saisine), '2026-10-15T08:45');
  assert.equal(iso(c3.decision), '2026-10-16T08:45');
  const c4 = R.echeances(all, m, 4);
  assert.equal(iso(c4.info), '2026-10-22T08:45');
  assert.equal(iso(c4.decision), '2026-10-23T08:45');
});

test('Contention : seuils 24/48/72 h, intervalle 72 h, pas de rythme long', () => {
  const m = mesure('M1', 'Contention', '2026-10-01T10:00');
  const c1 = R.echeances([m], m, 1);
  assert.equal(iso(c1.info), '2026-10-02T10:00');
  assert.equal(iso(c1.saisine), '2026-10-03T10:00');
  assert.equal(iso(c1.decision), '2026-10-04T10:00');
  const c5 = R.echeances([m], m, 5);
  assert.equal(c5.rythmeLong, false);
  assert.equal(iso(c5.info), '2026-10-14T10:00');
});

test('Les échéances ne dépendent jamais de la date des décisions du JLD', () => {
  const m = mesure('M1', 'Isolement', '2026-10-01T08:45');
  const a = R.echeances([m], m, 2);
  const m2 = Object.assign({}, m, { jld: { 1: { DECISION: { date: d('2026-10-04T15:00') } } } });
  const b = R.echeances([m2], m2, 2);
  assert.deepEqual(a, b);
});

test('Le cumul des 15 jours antérieurs avance les échéances du cycle 1', () => {
  const avant = mesure('M0', 'Isolement', '2026-09-28T08:00', '2026-09-29T08:00'); // 24 h
  const m = mesure('M1', 'Isolement', '2026-10-01T08:00');
  assert.equal(R.cumulAvantMesure([avant, m], m), 24);
  const c1 = R.echeances([avant, m], m, 1);
  assert.equal(iso(c1.info), '2026-10-02T08:00');      // 48 - 24 = 24 h
  assert.equal(iso(c1.saisine), '2026-10-03T08:00');   // 72 - 24
  assert.equal(iso(c1.decision), '2026-10-04T08:00');  // 96 - 24
});

test('Une mesure de plus de 15 jours ne compte pas, une mesure à cheval compte partiellement', () => {
  const vieille = mesure('M0', 'Isolement', '2026-09-01T00:00', '2026-09-02T00:00');
  const cheval = mesure('M2', 'Isolement', '2026-09-15T00:00', '2026-09-17T12:00'); // borne = 16/09 00:00
  const m = mesure('M1', 'Isolement', '2026-10-01T00:00');
  assert.equal(R.cumulAvantMesure([vieille, cheval, m], m), 36);
});

test('Les chevauchements sont fusionnés et un autre type ne compte pas', () => {
  const a = mesure('A', 'Isolement', '2026-09-28T00:00', '2026-09-28T12:00');
  const b = mesure('B', 'Isolement', '2026-09-28T06:00', '2026-09-28T18:00');
  const c = mesure('C', 'Contention', '2026-09-29T00:00', '2026-09-29T10:00');
  const m = mesure('M', 'Isolement', '2026-10-01T00:00');
  assert.equal(R.cumulAvantMesure([a, b, c, m], m), 18);
});

test('Après une levée JLD, le cumul repart de la fin de la mesure levée', () => {
  const levee = mesure('L', 'Isolement', '2026-09-28T00:00', '2026-09-29T00:00', { leveeJLD: true });
  const apres = mesure('A', 'Isolement', '2026-09-29T06:00', '2026-09-29T10:00');
  const m = mesure('M', 'Isolement', '2026-10-01T00:00');
  assert.equal(R.cumulAvantMesure([levee, apres, m], m), 4);
});

test('Statuts d\'échéance : fait, fait en retard, dépassé, proche, dans les temps', () => {
  const e = d('2026-10-03T08:00');
  assert.equal(R.statutEcheance(e, d('2026-10-03T07:00'), 0, 12), 'fait');
  assert.equal(R.statutEcheance(e, d('2026-10-03T09:00'), 0, 12), 'fait-retard');
  assert.equal(R.statutEcheance(e, undefined, d('2026-10-03T09:00'), 12), 'depasse');
  assert.equal(R.statutEcheance(e, undefined, d('2026-10-03T00:00'), 12), 'proche');
  assert.equal(R.statutEcheance(e, undefined, d('2026-10-02T00:00'), 12), 'ok');
});

// ------------------------------------------------------------------ Modèle
let n = 0;
function evt(type, data, extra) {
  n += 1;
  return Object.assign({ id: 'e' + String(n).padStart(4, '0'), at: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(), by: 'u1', type, data }, extra || {});
}

function base() {
  return [
    evt('PATIENT', { patientId: 'P1', ipp: '0001', nom: 'Démo', prenom: 'Un' }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d('2026-10-01T08:45'), csi: true, lieu: 'CSI 1', psychiatre: 'Dr A' })
  ];
}

test('Une décision de maintien fait passer au cycle suivant, une levée ne clôt pas la mesure', () => {
  const evts = base().concat([
    evt('JLD', { mesureId: 'M1', cycle: 1, nature: 'DECISION', date: d('2026-10-04T10:00'), decision: 'MAINTIEN' }, { base: 1 }),
  ]);
  let st = M.reduire(evts);
  assert.equal(st.mesures.M1.cycle, 2);
  evts.push(evt('JLD', { mesureId: 'M1', cycle: 2, nature: 'DECISION', date: d('2026-10-08T10:00'), decision: 'LEVEE' }, { base: 2 }));
  st = M.reduire(evts);
  assert.equal(st.mesures.M1.leveeJLD, true);
  assert.equal(st.mesures.M1.fin, null);
  assert.equal(st.mesures.M1.cycle, 2);
});

test('Deux fins saisies en parallèle : conflit détecté, la première est retenue, aucune n\'est perdue', () => {
  const evts = base().concat([
    evt('MESURE_FIN', { mesureId: 'M1', fin: d('2026-10-02T10:00') }, { base: 1, by: 'u1' }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: d('2026-10-02T11:00') }, { base: 1, by: 'u2' })
  ]);
  const st = M.reduire(evts);
  assert.equal(st.conflits.length, 1);
  assert.equal(st.mesures.M1.fin, d('2026-10-02T10:00'));
  assert.equal(st.journal.length, 4);
  // Arbitrage : annuler la saisie retenue applique la saisie concurrente.
  evts.push(evt('ANNULATION', { cible: st.conflits[0].retenu, motif: 'arbitrage' }, { by: 'cadre' }));
  const st2 = M.reduire(evts);
  assert.equal(st2.conflits.length, 0);
  assert.equal(st2.mesures.M1.fin, d('2026-10-02T11:00'));
});

test('Des saisies différentes sur la même mesure ne créent pas de conflit', () => {
  const evts = base().concat([
    evt('TIERS', { mesureId: 'M1', statut: 'INFORME', informateur: 'PSYCHIATRE', date: d('2026-10-01T10:00') }, { base: 1, by: 'u1' }),
    evt('JLD', { mesureId: 'M1', cycle: 1, nature: 'INFO', date: d('2026-10-03T08:00') }, { base: 1, by: 'u2' })
  ]);
  const st = M.reduire(evts);
  assert.equal(st.conflits.length, 0);
  assert.equal(st.mesures.M1.tiers.length, 1);
  assert.ok(st.mesures.M1.jld[1].INFO);
});

test('Droits : la secrétaire ne fait que le JLD, l\'IDE garde le JLD en permanence', () => {
  assert.ok(M.peut(['SECRETAIRE'], 'JLD'));
  assert.ok(!M.peut(['SECRETAIRE'], 'MESURE_DEBUT'));
  assert.ok(M.peut(['IDE'], 'JLD'));
  assert.ok(!M.peut(['IDE'], 'CONFIG'));
  assert.ok(M.peut(['CADRE', 'ADMIN'], 'CONFIG'));
});

test('Registre : contention en CSI couvre l\'isolement, les portions restantes deviennent A (A1, C2, A3)', () => {
  const evts = [
    evt('PATIENT', { patientId: 'P1' }),
    evt('MESURE_DEBUT', { mesureId: 'I', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d('2026-03-01T08:00'), csi: true }),
    evt('MESURE_DEBUT', { mesureId: 'C', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: d('2026-03-01T12:00'), csi: true }),
    evt('MESURE_FIN', { mesureId: 'C', fin: d('2026-03-01T18:00') }),
    evt('MESURE_FIN', { mesureId: 'I', fin: d('2026-03-02T08:00') })
  ];
  const st = M.reduire(evts);
  const reg = M.registre(st, 'U1', 2026, d('2026-10-30T00:00'));
  assert.deepEqual(reg.map(x => x.numero), ['A1', 'C2', 'A3']);
  assert.deepEqual(reg.map(x => x.dureeHeures), [4, 6, 14]);
});

test('Registre : catégories B, D et E', () => {
  const evts = [
    evt('MESURE_DEBUT', { mesureId: 'B', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d('2026-04-01T08:00'), csi: false }),
    evt('MESURE_DEBUT', { mesureId: 'D', patientId: 'P2', service: 'U1', typeMesure: 'Contention', debut: d('2026-04-02T08:00'), csi: false }),
    evt('MESURE_DEBUT', { mesureId: 'E', patientId: 'P3', service: 'U1', typeMesure: 'Contention', debut: d('2026-04-03T08:00'), csi: false, exception: true })
  ];
  const reg = M.registre(M.reduire(evts), 'U1', 2026, d('2026-10-30T00:00'));
  assert.deepEqual(reg.map(x => x.categorie), ['B', 'D', 'E']);
});

test('Registre : un passage de SL à SDT dans les 12 h est retenu', () => {
  const evts = [
    evt('PATIENT', { patientId: 'P1' }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SL', date: d('2026-05-01T00:00') }),
    evt('MESURE_DEBUT', { mesureId: 'I', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d('2026-05-02T08:00'), csi: true }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: d('2026-05-02T14:00') })
  ];
  const st = M.reduire(evts);
  const r = M.modeRetenu(st, st.mesures.I);
  assert.equal(r.mode, 'SDT');
  assert.equal(r.bascule, true);
});
