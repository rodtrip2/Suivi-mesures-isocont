// SPDX-License-Identifier: EUPL-1.2
// Changement d'heure (Europe/Paris) : durées et échéances en heures réelles : npm test
'use strict';
process.env.TZ = 'Europe/Paris';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');
const H = 3600 * 1000;
let n = 0;
const evt = (type, data) => ({ id: 'e' + String(++n).padStart(5, '0'), at: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString(), by: 'u1', type, data });
const local = (a, mo, j, h) => new Date(a, mo - 1, j, h).getTime();

function journal(debut, fin, type) {
  return [evt('PATIENT', { patientId: 'P1' }), evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2026, 1, 1, 0) }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: type || 'Isolement', debut: debut, csi: true }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: fin })];
}

test('Passage à l’heure d’hiver (25/10/2026) : 49 h réelles entre samedi 20 h et lundi 20 h', () => {
  const debut = local(2026, 10, 24, 20), fin = local(2026, 10, 26, 20);
  assert.equal((fin - debut) / H, 49);
  const st = M.reduire(journal(debut, fin));
  assert.equal(M.dureeHeures(st.mesures.M1, fin, st.config), 49);
  const d = M.decompte(st, st.mesures.M1, fin + H, { tranche: 24 });
  assert.deepEqual(d.lignes.map((l) => Math.round(l.duree)), [24, 24, 1]);
  assert.equal(Math.round(d.total), 49);
  // Information du JLD : 48 h réelles après le début, soit lundi 19 h (heure d'hiver)
  const j = M.suiviJLD(st, st.mesures.M1, debut + H);
  assert.equal(j.info.echeance, debut + 48 * H);
  assert.equal(new Date(j.info.echeance).getHours(), 19);
  assert.equal(Math.round(M.registre(st, 'U1', 2026, fin + H)[0].dureeHeures), 49);
});

test('Passage à l’heure d’été (28/03/2027) : 23 h réelles entre samedi 20 h et dimanche 20 h', () => {
  const debut = local(2027, 3, 27, 20), fin = local(2027, 3, 28, 20);
  const st = M.reduire(journal(debut, fin, 'Contention'));
  assert.equal(M.dureeHeures(st.mesures.M1, fin, st.config), 23);
  const d = M.decompte(st, st.mesures.M1, fin + H, { tranche: 12 });
  assert.deepEqual(d.lignes.map((l) => Math.round(l.duree)), [12, 11]);
  const j = M.suiviJLD(st, st.mesures.M1, debut + H);
  assert.equal(new Date(j.info.echeance).getHours(), 21);                  // 24 h réelles : dimanche 21 h (heure d'été)
});
