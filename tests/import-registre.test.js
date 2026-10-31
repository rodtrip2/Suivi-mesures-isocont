// SPDX-License-Identifier: EUPL-1.2
// Import générique à partir du registre du service (données fictives) : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');
const IV = require('../app/js/import-v13.js');
const R = require('../app/js/import-registre.js');
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
const maintenant = local(2026, 3, 1, 12);

const CSV = [
  'Registre isolement contention — Unité fictive',
  'N° registre;Cat.;IPP;Âge;Mode;Date début;Heure début;Date fin;Heure fin;Lieu;Psychiatre;Soignants',
  'A1;A;000001;35;SDT;02/01/2026;08:00;02/01/2026;12:00;CSI 1;Dr Exemple (fictif);"Agent A (fictif) (IDE) ; Agent B (fictif) (AS)"',
  'C2;C;000001;35;SDT;02/01/2026;12:00;02/01/2026;18:00;CSI 1;Dr Exemple (fictif);Agent A (fictif) (IDE)',
  'A3;A;000001;35;SDT;02/01/2026;18:00;02/01/2026;22:00;CSI 1;Dr Exemple (fictif);Agent C (fictif) (IDE)',
  'D4;D;000002;17;SL mineur;05/01/2026;10:00;05/01/2026;13:00;Chambre 12;Dr Autre (fictif);',
  'B5;B;000003;50;SPI;10/01/2026;09:00;;;Chambre 3;Dr Autre (fictif);',
  ';;;;;;;;;;;',
  'X6;A;;40;SDT;11/01/2026;08:00;11/01/2026;10:00;CSI 1;;'
].join('\r\n');

function avecU1() {
  return M.reduire([{ id: 'c1', at: '2026-01-01T00:00:00.000Z', by: 'a', type: 'CONFIG', data: { cle: 'services', valeur: [{ code: 'U1', libelle: 'Unité 1' }] } }]);
}
function appliquer(etat, prep, extra) {
  const evts = etat.journal.slice();
  let n = 0;
  const cfg = (cle, valeur) => evts.push({ id: 'z' + (++n), at: '2026-02-01T00:00:0' + n + '.000Z', by: 'a', type: 'CONFIG', data: { cle, valeur } });
  Object.entries(extra || {}).forEach(([k, v]) => cfg(k, v));
  evts.push({ id: 'zL', at: '2026-02-01T00:01:00.000Z', by: 'a', type: 'LOT', data: { evenements: prep.evenements } });
  return M.reduire(evts);
}

test('Registre importé : lecture CSV, en-tête repéré, colonnes reconnues', () => {
  const lignes = R.lireCSV(CSV);
  const g = R.deviner(lignes);
  assert.equal(g.ligneEntete, 1);
  ['numero', 'categorie', 'identifiant', 'age', 'mode', 'debut', 'heureDebut', 'fin', 'heureFin', 'lieu', 'psychiatre', 'professionnels'].forEach(k => assert.ok(g.correspondance[k] != null, k));
});

test('Registre importé : mesures reconstituées, isolement unique autour de la contention, numérotation conservée ou recalculée', () => {
  const lignes = R.lireCSV(CSV), g = R.deviner(lignes);
  const prep = R.preparer({ lignes, ligneEntete: g.ligneEntete, correspondance: g.correspondance }, avecU1(), { maintenant, serviceParDefaut: 'U1' });
  const r = prep.rapport;
  assert.equal(r.entrees, 5);
  assert.equal(r.ignorees.length, 1);                                    // ligne sans identifiant
  assert.equal(r.patients, 3);
  const debuts = prep.evenements.filter(e => e.type === 'MESURE_DEBUT').map(e => [e.data.typeMesure, new Date(e.data.debut).getDate(), e.data.csi, e.data.exception]);
  assert.deepEqual(debuts, [['Isolement', 2, true, false], ['Contention', 2, true, false], ['Contention', 5, false, false], ['Isolement', 10, false, false]]);
  assert.equal(r.mesures, 4);                                            // A1 + A3 + isolement de C2 = un seul isolement 8 h–22 h
  assert.deepEqual(prep.compteurs.map(c => [c.service, c.annee, c.dernier]), [['U1', 2026, 5]]);

  // Numérotation conservée : le registre importé est reproduit à l'identique (soignants compris)
  const fige = IV.figeSelon(prep, 'conserver', 2027);
  let st = appliquer(avecU1(), prep, { registreFige: fige, compteursRegistre: { U1: { 2026: 5 } } });
  let reg = M.registre(st, 'U1', 2026, maintenant);
  assert.deepEqual(reg.map(e => [e.numero, e.categorie, e.fin === null ? 'en cours' : e.dureeHeures]), [['A1', 'A', 4], ['C2', 'C', 6], ['A3', 'A', 4], ['D4', 'D', 3], ['B5', 'B', 'en cours']]);
  assert.deepEqual(reg[0].professionnels, ['Agent A (fictif) (IDE)', 'Agent B (fictif) (AS)']);
  assert.deepEqual(IV.controleNumeros(prep, { U1: { 2026: 5 } }, fige), { verifiees: 5, ecarts: [] });
  // Le juge compte 1 isolement et 1 contention pour le patient 000001
  const s = M.statistiquesPatients(st, ['U1'], 2026, maintenant);
  const p1 = Object.values(st.patients).find(p => p.ipp === '000001').id;
  assert.deepEqual([s.parPatient[p1].isolements, s.parPatient[p1].contentions], [1, 1]);

  // Recalcul selon les règles de l'outil : mêmes entrées A, C, A, D (compteur 0) — le registre importé était cohérent
  st = appliquer(avecU1(), prep, { compteursRegistre: { U1: { 2026: 0 } } });
  reg = M.registre(st, 'U1', 2026, maintenant);
  assert.deepEqual(reg.filter(e => e.numero).map(e => [e.numero, e.categorie, e.dureeHeures]), [['A1', 'A', 4], ['C2', 'C', 6], ['A3', 'A', 4], ['D4', 'D', 3]]);
  assert.equal(reg[0].professionnels.join(' ; '), 'Agent A (fictif) (IDE) ; Agent B (fictif) (AS) ; Agent C (fictif) (IDE)');   // soignants cités, faute de traces par poste
});

test('Registre importé : colonnes manquantes refusées, modèle CSV relisible, correction par ligne', () => {
  assert.throws(() => R.preparer({ lignes: [['a']], ligneEntete: 0, correspondance: {} }, avecU1(), {}), /Identifiant du patient/);
  const lignes = R.lireCSV(R.modeleCSV()), g = R.deviner(lignes);
  assert.equal(g.ligneEntete, 0);
  const prep = R.preparer({ lignes, ligneEntete: 0, correspondance: g.correspondance }, avecU1(), { maintenant });
  assert.equal(prep.rapport.entrees, 3);
  assert.equal(prep.rapport.mesures, 2);                                 // un isolement (A1, isolement de C2, A3) et une contention
  const fin = prep.evenements.find(e => e.type === 'MESURE_FIN' && prep.evenements.find(d => d.type === 'MESURE_DEBUT' && d.data.mesureId === e.data.mesureId && d.data.typeMesure === 'Isolement'));
  assert.equal(new Date(fin.data.fin).getHours(), 22);                   // A3 : début 18 h + durée 4 h
  // Correction : la ligne D4 déclarée en exception → E
  const l2 = R.lireCSV(CSV), g2 = R.deviner(l2);
  const p2 = R.preparer({ lignes: l2, ligneEntete: g2.ligneEntete, correspondance: g2.correspondance }, avecU1(), { maintenant, serviceParDefaut: 'U1', corrections: { L6: { csi: false, exception: true } } });
  const d4 = p2.evenements.find(e => e.type === 'MESURE_DEBUT' && /L6/.test(e.data.origine));
  assert.equal(d4.data.exception, true);
  assert.match(d4.data.correctionImport, /exception : non → oui/);
});
