// SPDX-License-Identifier: EUPL-1.2
// Cas particuliers : 48 h après une mainlevée, fusion de fiches, mesure débutée ailleurs : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

const H = 3600 * 1000;
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
let n = 0;
const evt = (type, data) => ({ id: 'e' + String(++n).padStart(5, '0'), at: new Date(local(2026, 3, 1, 12) + n * 1000).toISOString(), by: 'u1', type, data });

function patient(id, mode, extra) {
  return [evt('PATIENT', Object.assign({ patientId: id, nom: 'NOM' + id }, extra || {})), evt('MODE_HOSPI', { patientId: id, mode: mode || 'SDT', date: local(2026, 1, 1) })];
}

test('Mainlevée : nouvelle mesure dans les 48 h signalée, information du JLD due sans délai', () => {
  const evts = patient('P1').concat([
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('JLD', { mesureId: 'M1', cycle: 1, nature: 'DECISION', decision: 'LEVEE', date: local(2026, 3, 3, 14) }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 3, 15) }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 4, 10), csi: true }),
    evt('MESURE_DEBUT', { mesureId: 'M3', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: local(2026, 3, 4, 11), csi: true })
  ]);
  let st = M.reduire(evts);
  assert.equal(M.mainleveeRecente(st, 'P1', 'Isolement', local(2026, 3, 5, 13)).date, local(2026, 3, 3, 14));
  assert.equal(M.mainleveeRecente(st, 'P1', 'Isolement', local(2026, 3, 5, 15)), null);   // 48 h écoulées
  const j = M.suiviJLD(st, st.mesures.M2, local(2026, 3, 4, 12));
  assert.ok(j.apresMainlevee);
  assert.equal(j.info.echeance, local(2026, 3, 4, 10));
  assert.equal(j.info.statut, 'depasse');
  assert.ok(M.apresMainlevee(st, st.mesures.M3));                       // par défaut : toute nouvelle mesure
  // Réglages : même type seulement ; échéance non avancée
  st = M.reduire(evts.concat([evt('CONFIG', { cle: 'casParticuliers', valeur: { mainleveeType: 'meme', mainleveeInfoSansDelai: false } })]));
  assert.equal(M.apresMainlevee(st, st.mesures.M3), null);
  assert.notEqual(M.suiviJLD(st, st.mesures.M2, local(2026, 3, 4, 12)).info.echeance, local(2026, 3, 4, 10));
});

test('Fusion de fiches : mesures, modes et identité rattachés ; cumul recalculé ; annulable', () => {
  const evts = patient('P1', 'SDT', { ipp: '900', naissance: '1990-05-01' }).concat(patient('P2', 'SDT', { nom: 'NOMP1', naissance: '1990-05-01' }), [
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 2, 8) }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 5, 8), csi: true })
  ]);
  let st = M.reduire(evts);
  assert.equal(M.suiviJLD(st, st.mesures.M2, local(2026, 3, 5, 9)).cumulAvant, 0);
  assert.deepEqual(M.doublonsPossibles(st, st.patients.P2, 'P2').map((x) => x.patient.id), ['P1']);
  const f = evt('FUSION', { garde: 'P1', absorbe: 'P2', motif: 'doublon' });
  st = M.reduire(evts.concat([f, evt('MODE_HOSPI', { patientId: 'P2', mode: 'SDRE', date: local(2026, 3, 6) })]));
  assert.equal(st.patients.P2, undefined);
  assert.equal(st.mesures.M2.patientId, 'P1');
  assert.equal(M.suiviJLD(st, st.mesures.M2, local(2026, 3, 5, 9)).cumulAvant, 24);   // la mesure de P1 compte désormais
  assert.equal(st.patients.P1.fusionnes[0].id, 'P2');
  assert.equal(M.modeA(st, 'P1', local(2026, 3, 7)), 'SDRE');                          // saisie ultérieure sur l'ancienne fiche redirigée
  st = M.reduire(evts.concat([f, evt('ANNULATION', { cible: f.id })]));
  assert.equal(st.mesures.M2.patientId, 'P2');
  assert.ok(M.peut(['CADRE'], 'FUSION'));
  assert.ok(!M.peut(['IDE'], 'FUSION'));
});

test('Mesure débutée ailleurs : délais JLD depuis la décision initiale, registre depuis l’arrivée', () => {
  const evts = patient('P1').concat([
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 2, 8), debutInitial: local(2026, 3, 1, 20), lieuInitial: 'Urgences (fictif)', csi: true }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 3, 8) })
  ]);
  const st = M.reduire(evts);
  const j = M.suiviJLD(st, st.mesures.M1, local(2026, 3, 2, 9));
  assert.equal(j.info.echeance, local(2026, 3, 1, 20) + 48 * H);
  assert.equal(j.debutService, local(2026, 3, 2, 8));
  const reg = M.registre(st, 'U1', 2026, local(2026, 4, 1));
  assert.equal(reg.length, 1);
  assert.equal(Math.round(reg[0].dureeHeures), 24);                                    // partie du service seulement
  const d = M.decompte(st, st.mesures.M1, local(2026, 3, 4), { tranche: 0 });
  const lignes = d.lignes.filter((l) => l.type === 'mesure');
  assert.equal(lignes.length, 2);
  assert.match(lignes[0].commentaire, /Urgences \(fictif\)/);
  assert.match(lignes[1].commentaire, /Arrivée dans le service/);
  assert.equal(Math.round(lignes[1].cumul), 36);
});
