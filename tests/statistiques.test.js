// SPDX-License-Identifier: EUPL-1.2
// Séquences, unités de compte et traçabilité des règles de calcul : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');
const H = 3600 * 1000;
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
let n = 0;
const evt = (type, data, at) => ({ id: 'e' + String(++n).padStart(5, '0'), at: at || new Date(local(2026, 1, 1) + n * 1000).toISOString(), by: 'u1', type, data });

function base() {
  return [evt('PATIENT', { patientId: 'P1' }), evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2026, 1, 1) }),
    // Isolement 8 h → 20 h, contention en CSI 10 h → 14 h (entrées A, C, A), puis isolement 22 h → 23 h (écart de 2 h)
    evt('MESURE_DEBUT', { mesureId: 'I1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('MESURE_DEBUT', { mesureId: 'C1', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: local(2026, 3, 1, 10), csi: true }),
    evt('MESURE_FIN', { mesureId: 'C1', fin: local(2026, 3, 1, 14) }),
    evt('MESURE_FIN', { mesureId: 'I1', fin: local(2026, 3, 1, 20) }),
    evt('MESURE_DEBUT', { mesureId: 'I2', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 22), csi: true }),
    evt('MESURE_FIN', { mesureId: 'I2', fin: local(2026, 3, 1, 23) })];
}

test('Séquences : A-C-A = une séquence ; tolérance réglable de continu à 48 h', () => {
  let st = M.reduire(base());
  let s = M.statistiquesAnnee(st, ['U1'], 2026, local(2026, 6, 1));
  assert.equal(s.mesures, 4);                                    // entrées du registre : A, C, A, A
  assert.equal(s.sequences.n, 2);                                // écart de 2 h : deux séquences
  assert.equal(s.sequences.duree.max, 12);
  assert.equal(s.sequences.entreesParSequence, 2);
  assert.equal(s.sequences.composition['Isolement avec contention'], 1);
  assert.equal(s.sequences.composition['Isolement seul'], 1);
  st = M.reduire(base().concat([evt('CONFIG', { cle: 'statsMethode', valeur: { toleranceMinutes: 180 } })]));
  s = M.statistiquesAnnee(st, ['U1'], 2026, local(2026, 6, 1));
  assert.equal(s.sequences.n, 1);
  assert.equal(s.sequences.duree.total, 13);                     // l'écart toléré n'est pas compté
  assert.equal(M.optionsStats({ statsMethode: { toleranceMinutes: 9999 } }).toleranceMinutes, 2880);
});

test('Changements de méthode relus au journal, avec comparaison', () => {
  const b = base();
  b.splice(5, 0, evt('PAUSE', { mesureId: 'I1', debut: local(2026, 3, 1, 15), reprisePrevue: local(2026, 3, 1, 17) }, b[4].at.replace('Z', '1Z')));
  const ch = evt('CONFIG', { cle: 'pauses', valeur: { retrancher: true, portee: 'partout' } }, new Date(local(2026, 4, 10)).toISOString());
  const st = M.reduire(b.concat([ch]));
  const c = M.changementsMethode(st, local(2025, 1, 1), local(2027, 1, 1));
  assert.equal(c.length, 1);
  assert.match(c[0].textes[0], /comptées → déduites \(partout\)/);
  const apres = M.statistiquesAnnee(st, ['U1'], 2026, local(2026, 6, 1));
  const avant = M.statistiquesAvec(st, { pauses: c[0].avant }, ['U1'], 2026, local(2026, 6, 1));
  assert.equal(Math.round(avant.duree.total - apres.duree.total), 2);  // 2 h de pause
  assert.ok(M.reglesCalcul(st.config).some((r) => /déduites des durées du registre/.test(r)));
  assert.equal(M.changementsMethode(st, local(2026, 5, 1), local(2027, 1, 1)).length, 0);
});

test('Colonne Séquences de l’onglet Patients (option)', () => {
  const st = M.reduire(base().concat([evt('CONFIG', { cle: 'statsMethode', valeur: { colonneSequences: true } })]));
  const sp = M.statistiquesPatients(st, ['U1'], 2026, local(2026, 6, 1));
  assert.equal(sp.parPatient.P1.sequences, 2);
});
