// SPDX-License-Identifier: EUPL-1.2
// Réduction du journal : ordre des saisies enregistrées dans la même milliseconde : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');
const N = M;   // trierEvenements et deplier sont exportés par le modèle

const AT = '2026-11-07T08:46:30.591Z';
const debut = Date.UTC(2026, 10, 7, 3, 0);
// Identifiants dont la partie aléatoire classerait la fin avant le début (cas observé le 7 novembre 2026)
const e1 = { id: '20261107T084630Z_u1_7955e4a0', at: AT, by: 'u1', type: 'MESURE_DEBUT', prec: 'x0', data: { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut, csi: true } };
const e2 = { id: '20261107T084630Z_u1_5e39028d', at: AT, by: 'u1', type: 'PAUSE', prec: e1.id, data: { mesureId: 'M1', debut: debut + 3600e3, reprisePrevue: debut + 7200e3 } };
const e3 = { id: '20261107T084630Z_u1_2049dcf0', at: AT, by: 'u1', type: 'MESURE_FIN', prec: e2.id, data: { mesureId: 'M1', fin: debut + 4 * 3600e3 } };

test('Même milliseconde : les saisies d’un agent suivent leur chaînage, pas leur identifiant', () => {
  for (const ordre of [[e3, e2, e1], [e1, e2, e3], [e2, e3, e1]]) {
    assert.deepEqual(N.trierEvenements(ordre).map((e) => e.type), ['MESURE_DEBUT', 'PAUSE', 'MESURE_FIN']);
    const st = M.reduire(ordre);
    assert.equal(st.mesures.M1.fin, debut + 4 * 3600e3);
    assert.equal(st.mesures.M1.pauses.length, 1);
  }
});

test('Même milliseconde : horodatages différents et autres agents inchangés, lots dans l’ordre', () => {
  const a = { id: 'b_autre', at: AT, by: 'u2', type: 'PATIENT', data: {} };
  const avant = { id: 'z_avant', at: '2026-11-07T08:46:30.590Z', by: 'u1', type: 'PATIENT', data: {} };
  const tri = N.trierEvenements([e3, a, e1, avant, e2]).map((e) => e.id);
  assert.equal(tri[0], 'z_avant');
  assert.ok(tri.indexOf(e1.id) < tri.indexOf(e2.id) && tri.indexOf(e2.id) < tri.indexOf(e3.id));
  const lot = { id: 'L1', at: AT, by: 'u1', type: 'LOT', prec: e3.id, data: { evenements: [{ type: 'PATIENT', data: { n: 0 } }, { type: 'PATIENT', data: { n: 1 } }] } };
  const d = N.trierEvenements(N.deplier([lot, e3, e1, e2])).map((e) => e.id);
  assert.deepEqual(d.slice(-3), ['L1', 'L1.00000', 'L1.00001']);
  // Chaînage circulaire (fichiers altérés) : pas de blocage
  const c1 = { id: 'c1', at: AT, by: 'u3', type: 'PATIENT', prec: 'c2', data: {} };
  const c2 = { id: 'c2', at: AT, by: 'u3', type: 'PATIENT', prec: 'c1', data: {} };
  assert.equal(N.trierEvenements([c1, c2]).length, 2);
});
