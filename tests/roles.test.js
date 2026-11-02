// SPDX-License-Identifier: EUPL-1.2
// Rôles configurables : rôles fournis modifiables, rôles propres à l'établissement, administrateur fixe : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');
const comptes = require('../app/js/comptes.js');

const TYPES = ['PATIENT', 'MODE_HOSPI', 'MESURE_DEBUT', 'MESURE_FIN', 'PAUSE', 'REPRISE', 'TIERS', 'PROFESSIONNEL', 'JLD', 'INFORMATION', 'TRANSFERT', 'SOMATIQUE', 'SOMATIQUE_RETOUR', 'RECOURS', 'PROPOSITION', 'ENTRETIEN', 'CORRECTION', 'REFUS_PROPOSITION', 'ANNULATION', 'STATS', 'FUSION', 'CONFIG', 'COMPTE', 'LOT', 'INTEGRITE'];

test('Sans réglage, les rôles fournis gardent exactement leurs droits historiques', () => {
  ['IDE', 'AS', 'SECRETAIRE', 'CADRE', 'ADMIN'].forEach((r) => {
    TYPES.forEach((t) => assert.equal(M.peut([r], t, {}), M.DROITS[r].indexOf(t) >= 0, r + ' ' + t));
  });
  assert.ok(M.peut(['CADRE'], 'EDITION_CADA', {}) && M.peut(['CADRE'], 'EXPORT_PATIENT', {}) && !M.peut(['IDE'], 'EXPORT_PATIENT', {}));
  assert.deepEqual(M.rolesConfig({}).map((r) => r.code), ['IDE', 'AS', 'SECRETAIRE', 'CADRE', 'ADMIN']);
});

test('Rôle fourni modifié, rôle créé, accès à tous les services, administrateur fixe', () => {
  const config = { services: [{ code: 'U1' }, { code: 'U2' }], roles: {
    SECRETAIRE: { libelle: 'Secrétariat médical', acces: ['jld', 'recours', 'tiers'], services: true },
    R_DIRECTION: { libelle: 'Direction des soins', acces: ['stats'], services: false },
    R_LECTURE: { libelle: 'Consultation (fictif)', acces: [] },
    ADMIN: { libelle: 'Pirate', acces: [] }                                  // ignoré : l'administrateur est fixe
  } };
  assert.ok(M.peut(['SECRETAIRE'], 'TIERS', config) && !M.peut(['SECRETAIRE'], 'TIERS', {}));
  assert.equal(M.libRole(config, 'SECRETAIRE'), 'Secrétariat médical');
  assert.ok(M.peut(['R_DIRECTION'], 'STATS', config) && !M.peut(['R_DIRECTION'], 'MESURE_DEBUT', config));
  assert.ok(!TYPES.some((t) => M.peut(['R_LECTURE'], t, config)));       // consultation seule
  assert.deepEqual(M.servicesDe({ roles: ['R_DIRECTION'], services: [] }, config), ['U1', 'U2']);
  assert.deepEqual(M.servicesDe({ roles: ['SECRETAIRE'], services: ['U2'] }, config), ['U2']);
  assert.ok(M.exigeService(['SECRETAIRE'], config) && !M.exigeService(['R_DIRECTION'], config) && !M.exigeService(['ADMIN'], config));
  assert.ok(M.peut(['ADMIN'], 'CONFIG', config) && M.libRole(config, 'ADMIN') === 'Administrateur');
  // Rôle supprimé : plus aucun droit, code affiché
  assert.ok(!M.peut(['R_ANCIEN'], 'JLD', config));
  assert.equal(M.libRole(config, 'R_ANCIEN'), 'R_ANCIEN');
  // Accès inconnu ignoré
  assert.deepEqual(M.rolesConfig({ roles: { R_X: { libelle: 'X', acces: ['inexistant', 'jld'] } } }).find((r) => r.code === 'R_X').acces, ['jld']);
});

test('Création de comptes en lot : rôles de l’établissement reconnus par leur libellé', () => {
  const config = { roles: { R_DIRECTION: { libelle: 'Direction des soins', acces: ['stats'], services: false } } };
  const ctx = { services: [{ code: 'U1', libelle: 'Unité 1' }], roles: M.rolesConfig(config).map((r) => ({ code: r.code, libelle: r.libelle })), exigeService: (r) => M.exigeService(r, config) };
  const res = comptes.analyser('Anne TEST (fictif) ; ; Direction des soins ;\nBob TEST (fictif) ; ; infirmier ; U1\nCarl TEST (fictif) ; ; Inconnu ; U1', ctx);
  assert.deepEqual(res[0].roles, ['R_DIRECTION']);
  assert.deepEqual(res[0].erreurs, []);                                     // pas de service exigé
  assert.deepEqual(res[1].roles, ['IDE']);
  assert.match(res[2].erreurs.join(), /rôle inconnu/);
});
