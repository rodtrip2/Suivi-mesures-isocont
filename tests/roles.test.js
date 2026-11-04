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

test('Surveillance : agents proposés selon les rôles réglés, le service et la validité du compte', () => {
  const comptes = [
    { id: 'a', nom: 'Zoé IDE (fictif)', roles: ['IDE'], services: ['U1'], actif: true },
    { id: 'b', nom: 'Bruno AS (fictif)', roles: ['AS'], services: ['U1'], actif: true },
    { id: 'c', nom: 'Chloé IDE U2 (fictif)', roles: ['IDE'], services: ['U2'], actif: true },
    { id: 'd', nom: 'Denis inactif (fictif)', roles: ['IDE'], services: ['U1'], actif: false },
    { id: 'e', nom: 'Emma intérim (fictif)', roles: ['IDE'], services: ['U1'], actif: true, finValidite: '2026-10-31' },
    { id: 'f', nom: 'Fanny secrétaire (fictif)', roles: ['SECRETAIRE'], services: ['U1'], actif: true },
    { id: 'g', nom: 'Gaël cadre (fictif)', roles: ['CADRE'], services: ['U1'], actif: true }
  ];
  const noms = (cfg) => M.agentsSurveillance(comptes, cfg, 'U1', '2026-11-03').map((c) => c.id);
  assert.deepEqual(noms({}), ['b', 'a']);
  assert.deepEqual(M.optionsSurveillance({}).rolesListe, ['IDE', 'AS']);
  assert.deepEqual(noms({ surveillance: { rolesListe: ['IDE', 'AS', 'CADRE', 'INCONNU', 'ADMIN'] } }), ['b', 'g', 'a']);
  assert.deepEqual(M.optionsSurveillance({ surveillance: { rolesListe: ['INCONNU'] } }).rolesListe, []);
  assert.deepEqual(M.agentsSurveillance(comptes, {}, 'U1', '2026-10-30').map((c) => c.id), ['b', 'e', 'a']);
});

test('Journal : niveau par rôle, le plus large l’emporte ; défauts du porteur', () => {
  const M2 = require('../app/js/model.js');
  assert.equal(M2.niveauJournal(['IDE'], {}), 'services');
  assert.equal(M2.niveauJournal(['AS'], {}), 'services');
  assert.equal(M2.niveauJournal(['SECRETAIRE'], {}), 'services');
  assert.equal(M2.niveauJournal(['CADRE'], {}), 'complet');
  assert.equal(M2.niveauJournal(['ADMIN'], {}), 'complet');
  assert.equal(M2.niveauJournal(['IDE', 'CADRE'], {}), 'complet');
  assert.equal(M2.niveauJournal([], {}), 'aucun');
  const cfg = { roles: { IDE: { journal: 'aucun' }, R_DIR: { libelle: 'Direction (fictif)', acces: [], services: false }, R_PSY: { libelle: 'Psychologue (fictif)', acces: [], journal: 'siennes' } } };
  assert.equal(M2.niveauJournal(['IDE'], cfg), 'aucun');
  assert.equal(M2.niveauJournal(['R_DIR'], cfg), 'complet');
  assert.equal(M2.niveauJournal(['R_PSY'], cfg), 'siennes');
  assert.equal(M2.niveauJournal(['IDE', 'R_PSY'], cfg), 'siennes');
  assert.equal(M2.niveauJournal(['IDE'], { roles: { IDE: { journal: 'n’importe quoi' } } }), 'services');
});

test('Journal : saisies visibles selon le niveau (services, siennes, aucun)', () => {
  const M2 = require('../app/js/model.js');
  let k = 0;
  const ev = (type, data, by) => ({ id: 'j' + String(++k).padStart(4, '0'), at: new Date(Date.UTC(2026, 0, 1, 0, k)).toISOString(), by: by || 'cadre', type, data });
  const config = { services: [{ code: 'A' }, { code: 'B' }] };
  const evts = [
    ev('CONFIG', { cle: 'services', valeur: config.services }, 'admin'),
    ev('PATIENT', { patientId: 'p1', nom: 'PATIENT A (fictif)', service: 'A' }),
    ev('MESURE_DEBUT', { mesureId: 'm1', patientId: 'p1', typeMesure: 'Isolement', debut: Date.UTC(2026, 0, 2), service: 'A', lieu: 'CSI 1', csi: true }),
    ev('PATIENT', { patientId: 'p2', nom: 'PATIENT B (fictif)', service: 'B' }),
    ev('MESURE_DEBUT', { mesureId: 'm2', patientId: 'p2', typeMesure: 'Isolement', debut: Date.UTC(2026, 0, 2), service: 'B', lieu: 'CSI 2', csi: true }),
    ev('PAUSE', { mesureId: 'm2', debut: Date.UTC(2026, 0, 2, 5), motif: 'Repas' }, 'ideB'),
    ev('COMPTE', { action: 'MDP_REINIT', login: 'ideB' }, 'admin'),
    ev('COMPTE', { action: 'MDP_CHANGE', login: 'ideA' }, 'ideA')
  ];
  evts.push(ev('ANNULATION', { cible: evts[5].id, motif: 'erreur' }, 'cadre'));
  const st = M2.reduire(evts);
  const ids = (l) => l.map((e) => e.type + (e.data.mesureId || e.data.patientId || e.data.action || e.data.cible || '')).join(',');
  const ideA = { id: 'ideA', roles: ['IDE'], services: ['A'] };
  assert.equal(ids(M2.journalVisible(st, ideA, config)), 'PATIENTp1,MESURE_DEBUTm1,COMPTEMDP_CHANGE');
  const ideB = { id: 'ideB', roles: ['IDE'], services: ['B'] };
  assert.equal(ids(M2.journalVisible(st, ideB, config)), 'PATIENTp2,MESURE_DEBUTm2,PAUSEm2,ANNULATION' + evts[5].id);
  assert.equal(M2.journalVisible(st, { id: 'cadre', roles: ['CADRE'], services: ['A'] }, config).length, st.journal.length);
  const cfgS = Object.assign({}, config, { roles: { IDE: { journal: 'siennes' } } });
  assert.equal(ids(M2.journalVisible(st, ideB, cfgS)), 'PAUSEm2');
  const cfgA = Object.assign({}, config, { roles: { IDE: { journal: 'aucun' } } });
  assert.equal(M2.journalVisible(st, ideA, cfgA).length, 0);
});

test('Rôle « registre seulement » : aucun accès ni journal, réservé aux rôles créés, cumul plus large l’emporte, ancien réglage repris', () => {
  const M2 = require('../app/js/model.js');
  const cfg = { roles: { R_INSTANCE: { libelle: 'Instance (fictif)', acces: ['mesures', 'jld'], registreSeul: true }, R_ANCIEN: { libelle: 'Ancien (fictif)', registreAnonyme: true }, IDE: { registreSeul: true } } };
  const r = M2.rolesConfig(cfg).find((x) => x.code === 'R_INSTANCE');
  assert.deepEqual([r.registreSeul, r.acces, r.types, r.journal], [true, [], [], 'aucun']);
  assert.ok(M2.registreSeul(['R_ANCIEN'], cfg));   // réglage enregistré en 1.65.0
  assert.ok(!M2.peut(['R_INSTANCE'], 'MESURE_DEBUT', cfg));
  assert.ok(M2.registreSeul(['R_INSTANCE'], cfg));
  assert.ok(!M2.registreSeul(['R_INSTANCE', 'IDE'], cfg));   // l'IDE, rôle fourni, ne peut pas être restreint ainsi
  assert.ok(!M2.rolesConfig(cfg).find((x) => x.code === 'IDE').registreSeul);
  assert.ok(!M2.registreSeul([], cfg));
  assert.ok(!M2.registreSeul(['ADMIN', 'R_INSTANCE'], cfg));
  assert.equal(M2.niveauJournal(['R_INSTANCE'], cfg), 'aucun');
});

test('Onglets masquables par rôle (tous sauf journal et administration) ; le plus large l’emporte', () => {
  const M2 = require('../app/js/model.js');
  const cfg = { roles: { SECRETAIRE: { ongletsMasques: ['surveillance', 'stats', 'mesures', 'journal', 'admin'] }, R_REG: { libelle: 'Registre (fictif)', registreSeul: true, ongletsMasques: ['registre'] } } };
  assert.deepEqual(M2.rolesConfig(cfg).find((r) => r.code === 'SECRETAIRE').ongletsMasques, ['mesures', 'surveillance', 'stats']);   // journal et administration : autres réglages
  assert.ok(!M2.ongletVisible(['SECRETAIRE'], cfg, 'surveillance'));
  assert.ok(M2.ongletVisible(['SECRETAIRE'], cfg, 'registre'));
  assert.ok(!M2.ongletVisible(['SECRETAIRE'], cfg, 'stats'));
  assert.ok(!M2.ongletVisible(['SECRETAIRE'], cfg, 'mesures'));
  assert.ok(M2.ongletVisible(['SECRETAIRE'], cfg, 'tableau'));
  assert.ok(M2.ongletVisible(['SECRETAIRE'], cfg, 'journal'));   // non concerné par ce réglage
  assert.ok(M2.ongletVisible(['SECRETAIRE', 'IDE'], cfg, 'surveillance'));   // l'IDE l'affiche
  assert.ok(M2.ongletVisible(['ADMIN'], cfg, 'stats'));
  assert.ok(M2.ongletVisible(['R_REG'], cfg, 'registre'));                   // registre seulement : toujours le registre
  assert.ok(!M2.ongletVisible(['R_REG'], cfg, 'stats'));
  assert.ok(M2.ongletVisible(['IDE'], {}, 'stats'));                          // par défaut, rien n'est masqué
  assert.ok(!M2.ongletVisible([], {}, 'stats'));
});
