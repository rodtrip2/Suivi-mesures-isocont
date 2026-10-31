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

test('Import : numérotation du classeur conservée, recalculée pour l’année en cours, ou partout', async () => {
  const c = await X.lire(fichier);
  const maintenant = local(2026, 10, 6, 12);
  const prep = I.preparer(c, M.reduire([]), { maintenant });
  assert.deepEqual(prep.anneesNumerotees, [{ service: 'UHP', annee: 2026, mesures: 2 }]);
  // Conserver : D12 reste D12 (une entrée par mesure, numéros du classeur) ; la suite reprend après 12
  const fige = I.figeSelon(prep, 'conserver', 2026);
  assert.deepEqual(fige, { UHP: { 2026: true } });
  assert.deepEqual(I.controleNumeros(prep, { UHP: { 2026: 12 } }, fige), { verifiees: 2, ecarts: [] });
  // Année en cours recalculée : 2026 n'est pas figée ; tout recalculer : rien n'est figé
  assert.deepEqual(I.figeSelon(prep, 'annee', 2026), {});
  assert.deepEqual(I.figeSelon(prep, 'annee', 2027), { UHP: { 2026: true } });
  assert.deepEqual(I.figeSelon(prep, 'tout', 2027), {});
  // Registre réel avec l'année figée : numéros du classeur, puis l'outil continue à 13
  const ev = (id, cle, valeur) => ({ id, at: '2026-10-30T08:00:0' + id.slice(-1) + '.000Z', by: 'admin', type: 'CONFIG', data: { cle, valeur } });
  const st = M.reduire([ev('K1', 'services', prep.servicesACreer), ev('K2', 'registreFige', fige), ev('K3', 'compteursRegistre', { UHP: { 2026: 12 } }),
    { id: 'L1', at: '2026-10-30T10:00:00.000Z', by: 'admin', type: 'LOT', data: { evenements: prep.evenements } },
    { id: 'L2', at: '2026-10-30T11:00:00.000Z', by: 'admin', type: 'LOT', data: { evenements: [
      { type: 'MESURE_DEBUT', data: { mesureId: 'N1', patientId: prep.evenements.find(e => e.type === 'PATIENT').data.patientId, service: 'UHP', typeMesure: 'Isolement', debut: local(2026, 10, 3, 8), csi: true } },
      { type: 'MESURE_FIN', data: { mesureId: 'N1', fin: local(2026, 10, 3, 12) } }] } }]);
  const reg = M.registre(st, 'UHP', 2026, maintenant);
  assert.deepEqual(reg.map(e => [e.numero, e.fige]), [['A11', true], ['D12', true], ['A13', false], ['', false]]);
  // Sans figer : l'outil recalcule (E12 au lieu de D12)
  const recalc = M.registre(M.reduire(st.journal.filter(e => e.id !== 'K2')), 'UHP', 2026, maintenant).map(e => e.numero);
  assert.ok(!recalc.includes('D12') && recalc.some(n => /^E/.test(n)));
});

test('Import : compteur recalculé quand on change de numérotation après l’import', async () => {
  const c = await X.lire(fichier);
  const maintenant = local(2026, 10, 6, 12);
  const prep = I.preparer(c, M.reduire([]), { maintenant });
  const ev = (id, cle, valeur) => ({ id, at: '2026-10-30T08:00:0' + id.slice(-1) + '.000Z', by: 'admin', type: 'CONFIG', data: { cle, valeur } });
  const st = M.reduire([ev('K1', 'services', prep.servicesACreer), ev('K2', 'registreFige', { UHP: { 2026: true } }), ev('K3', 'compteursRegistre', { UHP: { 2026: 12 } }),
    ev('K4', 'derniersClasseur', { UHP: { 2026: 12 } }), { id: 'L1', at: '2026-10-30T10:00:00.000Z', by: 'admin', type: 'LOT', data: { evenements: prep.evenements } }]);
  assert.equal(M.compteurPour(st, 'UHP', 2026, false, maintenant), 10);   // recalcul : 12 − 2 entrées numérotées par l'outil
  assert.equal(M.compteurPour(st, 'UHP', 2026, true, maintenant), 12);
  assert.equal(M.compteurPour(st, 'UHP', 2025, true, maintenant), null);
});

test('Import : impact des trois choix de numérotation sur le registre et les statistiques', async () => {
  const c = await X.lire(fichier);
  const prep = I.preparer(c, M.reduire([]), { maintenant: local(2026, 10, 6, 12) });
  const cpt = mo => ({ UHP: { 2026: mo === 'conserver' ? 12 : 10 } });
  const imp = I.impactNumerotation(prep, cpt, 2026);
  assert.equal(imp.length, 1);
  const m = imp[0].modes;
  assert.deepEqual(m.conserver.numeros, ['A11', 'D12']);
  assert.deepEqual(m.tout.numeros, ['A11', 'E12']);
  assert.deepEqual(m.annee.numeros, ['A11', 'E12']);                     // 2026 est l'année en cours
  assert.deepEqual([m.conserver.categories.D, m.conserver.categories.E], [1, 0]);
  assert.deepEqual([m.tout.categories.D, m.tout.categories.E], [0, 1]);
  assert.equal(m.conserver.entrees, 2); assert.equal(m.tout.dureeTotale, m.conserver.dureeTotale);
});

test('Import : aperçu — durée par catégorie et détail des mesures modifiées', async () => {
  const c = await X.lire(fichier);
  const prep = I.preparer(c, M.reduire([]), { maintenant: local(2026, 10, 6, 12) });
  const imp = I.impactNumerotation(prep, mo => ({ UHP: { 2026: mo === 'conserver' ? 12 : 10 } }), 2026)[0];
  assert.equal(imp.modes.conserver.dureeCategories.D, 6);
  assert.equal(imp.modes.tout.dureeCategories.D, 0);
  assert.equal(imp.modes.tout.dureeCategories.E, 6);
  assert.equal(imp.modes.conserver.dureeCategories.A, 24);
  assert.equal(imp.mesures.length, 1);                                    // seule M0003 change
  const d = imp.mesures[0];
  assert.equal(d.origine, 'M0003'); assert.equal(d.numeroOrigine, 'D12');
  assert.deepEqual(d.modes.conserver.map(e => [e.numero, e.categorie, e.duree]), [['D12', 'D', 6]]);
  assert.deepEqual(d.modes.tout.map(e => [e.numero, e.categorie, e.duree]), [['E12', 'E', 6]]);
});

test('Import : explication de la catégorie, décision et correction mesure par mesure', async () => {
  const c = await X.lire(fichier);
  const maintenant = local(2026, 10, 6, 12);
  let prep = I.preparer(c, M.reduire([]), { maintenant });
  const cpt = () => ({ UHP: { 2026: 10 } });
  let imp = I.impactNumerotation(prep, cpt, 2026)[0];
  const d = imp.mesures.find(x => x.ref === 'M0003');
  assert.match(d.pourquoi.tout[0], /Catégorie E : contention hors espace d’isolement, exception prévue — lieu « Chambre 12 », case « exception » cochée\. Le document importé indiquait D \(D12\) : vérifier la case « exception »/);
  assert.match(d.pourquoi.conserver[0], /repris du document importé \(D12\)/);
  // Décision par mesure : garder D12 même si l'on recalcule tout
  imp = I.impactNumerotation(prep, cpt, 2026, { M0003: 'classeur' })[0];
  assert.deepEqual(imp.mesures.find(x => x.ref === 'M0003').modes.tout.map(e => e.numero), ['D12']);
  assert.deepEqual(I.controleNumeros(prep, { UHP: { 2026: 10 } }, {}, { M0003: 'classeur' }).ecarts, []);
  // Correction des données : exception décochée → l'outil retrouve D12 ; la correction est tracée
  prep = I.preparer(c, M.reduire([]), { maintenant, corrections: { M0003: { exception: false } } });
  const debut = prep.evenements.find(e => e.type === 'MESURE_DEBUT' && /M0003/.test(e.data.origine));
  assert.equal(debut.data.exception, false);
  assert.equal(debut.data.correctionImport, 'Corrigé à l’import : exception : oui → non');
  assert.deepEqual(I.controleNumeros(prep, { UHP: { 2026: 10 } }, {}).ecarts, []);
  imp = I.impactNumerotation(prep, cpt, 2026)[0];
  assert.equal(imp.mesures.length, 1);                                    // la mesure corrigée reste visible
  assert.match(imp.mesures[0].correction, /exception : oui → non/);
  assert.deepEqual(I.fusionFigeMesures(M.reduire([]), prep, { M0003: 'outil', INCONNUE: 'classeur' }), { [prep.refs.M0003]: false });
});
