// SPDX-License-Identifier: EUPL-1.2
// Création de comptes en lot, rôle AS, mot de passe provisoire : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../app/js/comptes.js');
const M = require('../app/js/model.js');
const C = require('../app/js/crypto.js');

const services = [{ code: 'U1', libelle: 'Unité 1' }, { code: 'U2', libelle: 'Unité 2' }];

test('Identifiant proposé depuis le nom', () => {
  assert.equal(K.identifiantDepuisNom('Marie-Hélène DUPONT'), 'marie-helene.dupont');
  assert.equal(K.identifiantDepuisNom("  Noël  O'Brien "), 'noel.o.brien');
});

test('Liste collée depuis un tableur : séparateurs, en-tête, rôles, services, identifiants', () => {
  const texte = [
    'Nom\tIdentifiant\tRôles\tServices',
    'Marie DUPONT\t\tIDE\tU1',
    'Paul MARTIN\tpaul.m\taide-soignant\tUnité 1, U2',
    'Jeanne PETIT\t\tSecrétaire\ttous',
    'Marie DUPONT\t\t\t',
    'Inconnu\t\tchef\tU9',
    'Admin Bis\t\tadministrateur\t'
  ].join('\n');
  const r = K.analyser(texte, { services, loginsExistants: ['marie.dupont'], rolesDefaut: ['IDE'], servicesDefaut: ['U1'] });
  assert.equal(r.length, 6);
  assert.equal(r[0].login, 'marie.dupont2');            // existe déjà → suffixe
  assert.deepEqual(r[0].roles, ['IDE']);
  assert.deepEqual(r[1].roles, ['AS']);
  assert.deepEqual(r[1].services, ['U1', 'U2']);
  assert.deepEqual(r[2].services, ['U1', 'U2']);
  assert.equal(r[3].login, 'marie.dupont3');            // doublon dans la liste
  assert.deepEqual(r[3].services, ['U1']);              // valeurs par défaut
  assert.equal(r[4].erreurs.length, 2);                 // rôle et service inconnus
  assert.deepEqual(r[5].erreurs, []);                   // administrateur sans service : accepté
  assert.ok(r.slice(0, 4).every(x => !x.erreurs.length));
});

test('CSV point-virgule avec guillemets, identifiant déjà pris refusé', () => {
  const r = K.analyser('"DURAND, Luc";luc.d;IDE;U1\nAnne;x;IDE;U1', { services, loginsExistants: ['luc.d'], rolesDefaut: [], servicesDefaut: [] });
  assert.equal(r[0].nom, 'DURAND, Luc');
  assert.match(r[0].erreurs.join(), /déjà utilisé/);
  assert.match(r[1].erreurs.join(), /invalide/);
});

test('Rôle AS : mêmes droits que l\'IDE', () => {
  ['PATIENT', 'MESURE_DEBUT', 'MESURE_FIN', 'TIERS', 'PROFESSIONNEL', 'JLD', 'CONFIG', 'CORRECTION'].forEach(t => {
    assert.equal(M.peut(['AS'], t), M.peut(['IDE'], t), t);
  });
});

test('Mot de passe provisoire : format et entropie', () => {
  const a = C.nouveauMotDePasseProvisoire(), b = C.nouveauMotDePasseProvisoire();
  assert.match(a, /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
  assert.notEqual(a, b);
  assert.ok(a.length >= 12);
});

test('Accès au mode formation : accordé par défaut, désactivable, jamais pour le compte de secours', () => {
  assert.equal(M.accesFormation({ id: 'u1', roles: ['IDE'] }), true);
  assert.equal(M.accesFormation({ id: 'u1', roles: ['IDE'], formation: false }), false);
  assert.equal(M.accesFormation({ id: 'secours', roles: ['ADMIN'] }), false);
  assert.ok(!M.ROLES.FORMATEUR);
});

test('Validité d’un compte temporaire', () => {
  const C = require('../app/js/comptes.js');
  const t = new Date(2026, 10, 10, 15).getTime();
  assert.deepEqual(C.validite({}, t).temporaire, false);
  assert.equal(C.validite({ finValidite: '2026-11-10' }, t).expire, false);          // dernier jour inclus
  assert.equal(C.validite({ finValidite: '2026-11-09' }, t).expire, true);
  assert.equal(C.validite({ finValidite: '2026-11-15' }, t).bientot, true);
  assert.equal(C.validite({ finValidite: '2026-12-15' }, t).bientot, false);
});
