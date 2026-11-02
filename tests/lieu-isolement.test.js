// SPDX-License-Identifier: EUPL-1.2
// Appellation des lieux dédiés à l'isolement (« CSI » par défaut, réglable) : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

test('Appellation par défaut : textes inchangés', () => {
  assert.deepEqual(M.libLieu({}), { court: 'CSI', long: 'chambre de soins intensifs', longs: 'chambres de soins intensifs' });
  assert.equal(M.txtLieu(M.CONFIG_DEFAUT, 'Contention hors CSI'), 'Contention hors CSI');
});

test('Appellation de l’établissement : sigle, singulier, pluriel, majuscule ; noms composés intacts', () => {
  const cfg = { lieuIsolement: { court: 'CI', long: 'chambre d’isolement', longs: 'chambres d’isolement' } };
  assert.equal(M.txtLieu(cfg, 'Surveillance CSI — Chambres de soins intensifs du service, une chambre de soins intensifs'), 'Surveillance CI — Chambres d’isolement du service, une chambre d’isolement');
  assert.equal(M.txtLieu(cfg, 'heuresCSI lieuxCSI CSIP'), 'heuresCSI lieuxCSI CSIP');   // mots plus longs non touchés
  assert.equal(M.txtLieu(cfg, null), null);
  // Valeurs incomplètes : retour à la valeur par défaut ; pluriel absent : singulier
  assert.equal(M.libLieu({ lieuIsolement: { court: '', long: 'x' } }).court, 'CSI');
  assert.equal(M.libLieu({ lieuIsolement: { court: 'EI', long: 'espace d’isolement' } }).longs, 'espace d’isolement');
});

test('Alertes : libellés et textes proposés suivent l’appellation, pas les textes saisis par l’établissement', () => {
  const cfg = Object.assign({}, M.CONFIG_DEFAUT, { lieuIsolement: { court: 'CI', long: 'chambre d’isolement', longs: 'chambres d’isolement' } });
  const a = M.alertesConfig(cfg).find((r) => r.declencheur === 'contention-hors-csi');
  assert.equal(a.libelle, 'Contention hors CI : exceptions prévues');
  const perso = M.alertesConfig(Object.assign({}, cfg, { alertes: [{ id: 'x', libelle: 'Ma règle CSI', declencheur: 'isolement-hors-csi', active: true, message: 'Texte CSI saisi' }] }))[0];
  assert.equal(perso.libelle, 'Ma règle CSI');
  assert.equal(perso.message, 'Texte CSI saisi');
});
