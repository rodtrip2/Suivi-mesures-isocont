// SPDX-License-Identifier: EUPL-1.2
// Alertes de l'établissement : rappels à la saisie, informations à tracer : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

const H = 3600 * 1000;
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
let n = 0;
const evt = (type, data, at) => ({ id: 'e' + String(++n).padStart(5, '0'), at: at || new Date(local(2026, 3, 1, 12) + n * 1000).toISOString(), by: 'u1', type, data });

const regles = [
  { id: 'sl', libelle: 'Soins libres', active: true, declencheur: 'soins-libres', services: ['U1'], nature: 'information', destinataires: 'Cadre de garde', delaiMinutes: 0, depuis: local(2026, 1, 1) },
  { id: 'hors', active: true, declencheur: 'contention-hors-csi', services: [], nature: 'rappel' },
  { id: 'off', active: false, declencheur: 'toute-mesure', nature: 'information' }
];

function journal() {
  return [
    evt('CONFIG', { cle: 'alertes', valeur: regles }),
    evt('PATIENT', { patientId: 'P1' }), evt('MODE_HOSPI', { patientId: 'P1', mode: 'SL', date: local(2026, 1, 1) }),
    evt('PATIENT', { patientId: 'P2' }), evt('MODE_HOSPI', { patientId: 'P2', mode: 'SDT', date: local(2026, 1, 1) }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 10), csi: true }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P1', service: 'U2', typeMesure: 'Isolement', debut: local(2026, 3, 1, 10), csi: true }),
    evt('MESURE_DEBUT', { mesureId: 'M3', patientId: 'P2', service: 'U1', typeMesure: 'Contention', debut: local(2026, 3, 1, 10), csi: false }),
    evt('MESURE_DEBUT', { mesureId: 'M4', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 10), csi: true, origine: 'Registre importé — x' })
  ];
}

test('Règles : textes par défaut, valeurs validées, règle par défaut des soins libres désactivée', () => {
  const r = M.alertesConfig({ alertes: [{ declencheur: 'contention-hors-csi', nature: 'rappel', delaiMinutes: -5 }, { declencheur: 'inconnu' }] });
  assert.equal(r.length, 1);
  assert.match(r[0].message, /L\. 3222-5-1/);
  assert.match(r[0].message, /vêtement de contention/);
  assert.equal(r[0].delaiMinutes, 0);
  const def = M.alertesConfig(M.CONFIG_DEFAUT);
  assert.equal(def.find((x) => x.declencheur === 'soins-libres').active, false);
  assert.equal(def.find((x) => x.declencheur === 'contention-hors-csi').active, true);
});

test('Déclenchement : service, déclencheur, règle inactive, mesure importée', () => {
  const st = M.reduire(journal());
  assert.deepEqual(M.alertesMesure(st, st.mesures.M1).map((r) => r.id), ['sl']);
  assert.deepEqual(M.alertesMesure(st, st.mesures.M2).map((r) => r.id), []);       // autre service
  assert.deepEqual(M.alertesMesure(st, st.mesures.M3).map((r) => r.id), ['hors']); // patient en SDT, contention hors CSI
  assert.deepEqual(M.alertesMesure(st, st.mesures.M4), []);                         // historique importé
  // Faits d'une saisie en cours (formulaire)
  assert.deepEqual(M.reglesDeclenchees(st.config, { type: 'Contention', csi: false, service: 'U1', libre: true }).map((r) => r.id), ['sl', 'hors']);
});

test('Information à tracer sans délai, puis tracée ; annulation de la trace', () => {
  const evts = journal();
  let st = M.reduire(evts);
  let a = M.informationsATracer(st, local(2026, 3, 1, 10, 5));
  assert.equal(a.length, 1);
  assert.equal(a[0].mesure.id, 'M1');
  assert.equal(a[0].retard, true);                     // sans délai : en retard dès le début
  const info = evt('INFORMATION', { mesureId: 'M1', regle: 'sl', personne: 'Mme X (fictif), administrateur de garde', moyen: 'Téléphone', date: local(2026, 3, 1, 10, 3) });
  st = M.reduire(evts.concat([info]));
  assert.equal(M.informationsATracer(st, local(2026, 3, 1, 11)).length, 0);
  assert.equal(st.mesures.M1.informations.sl.moyen, 'Téléphone');
  st = M.reduire(evts.concat([info, evt('ANNULATION', { cible: info.id, motif: 'erreur' })]));
  assert.equal(M.informationsATracer(st, local(2026, 3, 1, 11)).length, 1);
});

test('Délai : pas de retard avant l’échéance ; mesure saisie avant l’activation ignorée', () => {
  const r2 = regles.map((r) => (r.id === 'sl' ? Object.assign({}, r, { delaiMinutes: 60 }) : r));
  let st = M.reduire(journal().concat([evt('CONFIG', { cle: 'alertes', valeur: r2 })]));
  const a = M.informationsATracer(st, local(2026, 3, 1, 10, 30));
  assert.equal(a[0].retard, false);
  assert.equal(a[0].echeance, local(2026, 3, 1, 11));
  const r3 = regles.map((r) => (r.id === 'sl' ? Object.assign({}, r, { depuis: local(2026, 6, 1) }) : r));
  st = M.reduire(journal().concat([evt('CONFIG', { cle: 'alertes', valeur: r3 })]));
  assert.equal(M.informationsATracer(st, local(2026, 3, 1, 11)).length, 0);
});

test('Droit de tracer une information : IDE, AS, cadre ; pas la secrétaire', () => {
  assert.ok(M.peut(['IDE'], 'INFORMATION'));
  assert.ok(M.peut(['AS'], 'INFORMATION'));
  assert.ok(M.peut(['CADRE'], 'INFORMATION'));
  assert.ok(!M.peut(['SECRETAIRE'], 'INFORMATION'));
});
