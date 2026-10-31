// SPDX-License-Identifier: EUPL-1.2
// Import du classeur V1.3 fictif (tests/fixtures/classeur-v13-fictif.xlsx) : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../app/js/xlsx.js');
const M = require('../app/js/model.js');
const I = require('../app/js/import-v13.js');

const fichier = fs.readFileSync(path.join(__dirname, 'fixtures', 'classeur-v13-fictif.xlsx'));
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();

function lot(evenements) {
  return { id: 'L1', at: '2026-10-30T10:00:00.000Z', by: 'admin', type: 'LOT', data: { evenements } };
}
function configs(prep) {
  return prep.config.map((c, i) => ({ id: 'C' + i, at: '2026-10-30T09:00:00.000Z', by: 'admin', type: 'CONFIG', data: { cle: c.cle, valeur: c.valeur } }));
}

test('Lecture du classeur : feuilles, en-têtes et dates', async () => {
  const c = await X.lire(fichier);
  assert.ok(c.feuilles.Mesures && c.feuilles.Patients);
  const mesures = X.enObjets(c.feuilles.Mesures);
  assert.equal(mesures.length, 4);
  assert.equal(mesures[0].ID, 'M0001');
  assert.equal(X.valeurDate(mesures[0].Debut), local(2026, 3, 1, 8, 45));
  assert.equal(X.valeurDate('05/05/2026 10:00'), local(2026, 5, 5, 10, 0));
});

test('Import : mesures, patients, cycles JLD, tiers, professionnels, paramétrage', async () => {
  const c = await X.lire(fichier);
  const vide = M.reduire([]);
  const prep = I.preparer(c, vide, { maintenant: local(2026, 10, 6, 12) });
  const r = prep.rapport;
  assert.equal(r.mesures, 3);
  assert.equal(r.patients, 2);
  assert.equal(r.ignorees.length, 1);           // M0004 sans IPP
  assert.equal(r.professionnels, 1);            // la ligne « A renseigner » est ignorée
  const cles = prep.config.map(x => x.cle);
  ['lieuxCSI', 'periodesService', 'parametres', 'decompte', 'psychiatres'].forEach(k => assert.ok(cles.includes(k), k));
  // Services absents de l'outil : UHP (porte des données) à créer ; UR (inactif, sans données) ignoré par défaut
  assert.deepEqual(r.services.map(s => [s.code, s.action]), [['UR', 'ignorer'], ['UHP', 'creer']]);
  assert.deepEqual(prep.servicesACreer, [{ code: 'UHP', libelle: "Unité d'hospitalisation (fictive)" }]);
  // Compteur proposé : 12 − 2 entrées numérotées par l'outil à partir des mesures importées
  assert.deepEqual(prep.compteurs.map(c => [c.service, c.annee, c.dernier, c.entreesNumerotees, c.propose]), [['UHP', 2026, 12, 2, 10]]);
  // Contrôle des numéros : A11 identique ; D12 du classeur devient E12 (contention avec exception)
  const ctrl = I.controleNumeros(prep, { UHP: { 2026: 10 } });
  assert.equal(ctrl.verifiees, 1);
  assert.deepEqual(ctrl.ecarts.map(e => [e.ref, e.classeur, e.outil]), [['M0003', 'D12', 'E12']]);
  assert.match(ctrl.ecarts[0].motif, /même numéro, catégorie différente/);
  // Un compteur erroné décale tous les numéros
  assert.equal(I.controleNumeros(prep, { UHP: { 2026: 9 } }).verifiees, 0);

  const svc = { id: 'S0', at: '2026-10-30T08:59:00.000Z', by: 'admin', type: 'CONFIG', data: { cle: 'services', valeur: prep.servicesACreer } };
  const cpt = { id: 'S1', at: '2026-10-30T08:59:30.000Z', by: 'admin', type: 'CONFIG', data: { cle: 'compteursRegistre', valeur: { UHP: { 2026: 10 } } } };
  const etat = M.reduire([svc, cpt].concat(configs(prep), [lot(prep.evenements)]));
  const ms = M.listeMesures(etat);
  assert.equal(ms.length, 3);
  const enCours = ms.find(m => m.fin === null);
  assert.equal(enCours.cycle, 2);
  assert.equal(enCours.lieu, '412');
  assert.equal(M.tiersCycle(enCours).statut, 'TENTATIVE');
  assert.equal(enCours.tiers.find(t => t.cycle === 1).statut, 'INFORME');
  // Échéances recalculées identiques à celles du classeur
  assert.deepEqual(I.comparer(etat, prep.attendus), []);
  // Contention hors CSI avec exception : catégorie E ; compteur = 12 − 2 mesures numérotées importées
  assert.equal(etat.config.compteursRegistre.UHP['2026'], 10);
  const reg = M.registre(etat, 'UHP', 2026, local(2026, 10, 6, 12));
  assert.deepEqual(reg.map(e => e.numero), ['A11', 'E12', '']);
  assert.equal(etat.config.parametres.Isolement.seuilJaune, 8);
  assert.deepEqual(etat.config.decompte.UHP.masquer, ['N']);
  assert.equal(etat.professionnels[0].periode, 'MATIN');
  assert.equal(M.modeA(etat, enCours.patientId, enCours.debut), 'SDT');

  // Un import relancé ne crée pas de doublon
  const encore = I.preparer(c, etat, { maintenant: local(2026, 10, 6, 12) });
  assert.equal(encore.rapport.mesures, 0);
  assert.equal(encore.rapport.dejaPresentes, 3);
  assert.equal(encore.rapport.professionnels, 0);
});

test('Un fichier qui n\'est pas un classeur est refusé proprement', async () => {
  await assert.rejects(X.lire(new TextEncoder().encode('pas un zip')), /classeur Excel/);
});

test('Import : service absent rattaché à un service existant, ou créé sous un autre libellé', async () => {
  const c = await X.lire(fichier);
  const avecU1 = M.reduire([{ id: 'c1', at: '2026-01-01T00:00:00.000Z', by: 'a', type: 'CONFIG', data: { cle: 'services', valeur: [{ code: 'U1', libelle: 'Unité 1' }] } }]);
  const maintenant = local(2026, 10, 6, 12);
  // Rattachement de UHP à U1 : toutes les données du classeur vont dans U1
  let prep = I.preparer(c, avecU1, { maintenant, services: { UHP: { action: 'rattacher', vers: 'U1' } } });
  assert.deepEqual(prep.servicesACreer, []);
  const services = prep.evenements.filter(e => e.type === 'MESURE_DEBUT').map(e => e.data.service);
  assert.deepEqual([...new Set(services)], ['U1']);
  assert.deepEqual(prep.compteurs.map(x => x.service), ['U1']);
  assert.ok(prep.config.find(x => x.cle === 'lieuxCSI').valeur.U1.includes('410'));
  // Un service qui porte des données ne peut pas être ignoré ; création sous un libellé choisi
  prep = I.preparer(c, avecU1, { maintenant, services: { UHP: { action: 'ignorer' }, UR: { action: 'creer', libelle: 'Urgences psychiatriques' } } });
  assert.deepEqual(prep.servicesACreer.map(s => s.code).sort(), ['UHP', 'UR']);
  assert.equal(prep.servicesACreer.find(s => s.code === 'UR').libelle, 'Urgences psychiatriques');
});
