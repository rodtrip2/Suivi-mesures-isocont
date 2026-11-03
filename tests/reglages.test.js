// SPDX-License-Identifier: EUPL-1.2
// Export et import des réglages de l'établissement : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

const cfg = (extra) => Object.assign(JSON.parse(JSON.stringify(M.CONFIG_DEFAUT)), extra || {});
const T0 = Date.UTC(2026, 10, 3, 12);

test('Réglages : chaque paramètre de CONFIG_DEFAUT est rangé dans un groupe ou exclu', () => {
  const ranges = {};
  M.GROUPES_REGLAGES.forEach((g) => g.cles.forEach((k) => { assert.ok(!ranges[k], k + ' dans deux groupes'); ranges[k] = 1; }));
  Object.keys(M.CONFIG_DEFAUT).forEach((k) => assert.ok(ranges[k] || M.REGLAGES_EXCLUS[k], k + ' : ni groupe ni exclusion'));
});

test('Réglages : export sans les données propres à l’établissement d’origine', () => {
  const c = cfg({ etablissement: 'CH (fictif)', compteursRegistre: { U1: { 2026: 37 } }, rapportsAnnuels: { 2025: { politique: 'x' } }, miroir: { attendu: true, nom: 'secours' },
    imagesDecompte: { img1: 'data:image/jpeg;base64,AAAA' },
    statsMethode: Object.assign({}, M.CONFIG_DEFAUT.statsMethode, { methodesAnterieures: { 2024: { toleranceMinutes: 60 } } }) });
  c.alertes[0].active = true; c.alertes[0].depuis = 123;
  const f = M.exporterReglages(c, null, { outil: '1.56.0', maintenant: T0 });
  assert.equal(f.format, 'suivi-isocont-reglages');
  assert.equal(f.etablissement, 'CH (fictif)');
  assert.equal(f.exporteLe, new Date(T0).toISOString());
  ['compteursRegistre', 'rapportsAnnuels', 'miroir', 'registreFige', 'derniersClasseur', 'registreFigeMesures'].forEach((k) => assert.equal(f.reglages[k], undefined, k));
  assert.equal(f.reglages.statsMethode.methodesAnterieures, undefined);
  assert.equal(f.reglages.alertes[0].depuis, undefined);
  assert.equal(f.reglages.imagesDecompte.img1, 'data:image/jpeg;base64,AAAA');
  const partiel = M.exporterReglages(c, ['decompte'], {});
  assert.deepEqual(Object.keys(partiel.reglages).sort(), ['decompte', 'imagesDecompte']);
  assert.deepEqual(partiel.groupes, ['decompte']);
});

test('Réglages : fichier refusé s’il n’est pas un export de l’outil ou vient d’un format plus récent', () => {
  assert.throws(() => M.analyserReglages({ coffre: 1 }, cfg()), /pas un fichier de réglages/);
  assert.throws(() => M.analyserReglages({ format: 'suivi-isocont-reglages', version: 2, reglages: {} }, cfg()), /plus récente/);
  assert.throws(() => M.analyserReglages({ format: 'suivi-isocont-reglages', version: 1, reglages: [] }, cfg()), /vide ou abîmé/);
});

test('Réglages : analyse — changements repérés, valeurs inconnues, invalides ou exclues ignorées', () => {
  const source = cfg({ inactiviteMinutes: 20, vigilance: { isolementRouge: 72, contentionRouge: 24, isolementJaune: 24, contentionJaune: 12 } });
  const f = M.exporterReglages(source, null, {});
  f.reglages.compteursRegistre = { U1: { 2026: 99 } };
  f.reglages.inconnu = 1;
  f.reglages.psychiatres = 'Dr X';   // invalide : une liste est attendue
  const a = M.analyserReglages(f, cfg(), { maintenant: T0 });
  const raisons = Object.fromEntries(a.ignores.map((x) => [x.cle, x.raison]));
  assert.match(raisons.compteursRegistre, /jamais importé/);
  assert.match(raisons.inconnu, /inconnu/);
  assert.match(raisons.psychiatres, /invalide/);
  const roles = a.groupes.find((g) => g.code === 'roles');
  assert.ok(roles.change);
  assert.ok(roles.cles.find((c) => c.cle === 'inactiviteMinutes').change);
  assert.ok(a.groupes.find((g) => g.code === 'affichage').change);
  assert.ok(!a.groupes.find((g) => g.code === 'cas').change);
  const r = M.reglagesAImporter(a, ['roles', 'cas'], cfg(), {});
  assert.deepEqual(r.changements, [['inactiviteMinutes', 20]]);
});

test('Réglages : alertes actives à partir de l’import, jamais sur l’historique', () => {
  const source = cfg(); source.alertes[0].active = true;
  const f = M.exporterReglages(source, ['alertes'], {});
  const ici = cfg();
  const a = M.analyserReglages(f, ici, { maintenant: T0 });
  const v = a.groupes[0].cles[0].valeur;
  assert.equal(v[0].depuis, T0);
  assert.equal(v[1].depuis, 0);   // déjà active ici (règle fournie) : inchangée
  // Alerte déjà active ici avec le même déclencheur : la date d'activation d'origine est gardée.
  const deja = cfg(); deja.alertes[0].active = true; deja.alertes[0].depuis = 1000;
  const b = M.analyserReglages(f, deja, { maintenant: T0 });
  assert.equal(b.groupes[0].cles[0].valeur[0].depuis, 1000);
  assert.ok(M.reglagesAImporter(a, ['alertes'], ici, {}).avertissements.some((t) => /après l’import/.test(t)));
});

test('Réglages : services et rôles utilisés jamais retirés ; services inconnus signalés', () => {
  const source = cfg({ services: [{ code: 'A', libelle: 'Unité A (fictif)' }], lieuxCSI: { A: ['CSI 1'], Z: ['CSI Z'] } });
  const f = M.exporterReglages(source, ['etablissement', 'roles'], {});
  f.reglages.roles = { IDE: { libelle: 'IDE', acces: [] } };
  const ici = cfg({ services: [{ code: 'U1', libelle: 'Unité 1 (fictif)' }], roles: { R_ab: { libelle: 'Psychologue (fictif)', acces: [], services: true } } });
  const a = M.analyserReglages(f, ici, { servicesUtilises: ['U1'], rolesUtilises: ['IDE', 'R_ab'] });
  const svs = a.groupes.find((g) => g.code === 'etablissement').cles.find((c) => c.cle === 'services').valeur;
  assert.deepEqual(svs.map((x) => x.code), ['A', 'U1']);
  assert.equal(svs[1].libelle, 'Unité 1 (fictif)');
  const roles = a.groupes.find((g) => g.code === 'roles').cles.find((c) => c.cle === 'roles').valeur;
  assert.equal(roles.R_ab.libelle, 'Psychologue (fictif)');
  const r = M.reglagesAImporter(a, ['etablissement', 'roles'], ici, {});
  assert.ok(r.avertissements.some((t) => /conservé\(s\) : U1/.test(t)));
  assert.ok(r.avertissements.some((t) => /Psychologue/.test(t)));
  assert.ok(r.avertissements.some((t) => /n’existent pas ici.*Z/.test(t)));
});

test('Réglages : la méthode antérieure des statistiques reste celle des données présentes', () => {
  const f = M.exporterReglages(cfg({ statsMethode: Object.assign({}, M.CONFIG_DEFAUT.statsMethode, { toleranceMinutes: 120 }) }), ['registre'], {});
  const ici = cfg({ statsMethode: Object.assign({}, M.CONFIG_DEFAUT.statsMethode, { methodesAnterieures: { 2025: { toleranceMinutes: 0 } } }) });
  const a = M.analyserReglages(f, ici, {});
  const v = a.groupes[0].cles.find((c) => c.cle === 'statsMethode').valeur;
  assert.equal(v.toleranceMinutes, 120);
  assert.deepEqual(v.methodesAnterieures, { 2025: { toleranceMinutes: 0 } });
});

test('Réglages : export puis import identique = aucun changement', () => {
  const c = cfg({ etablissement: 'CH (fictif)' }); c.alertes[0].active = true; c.alertes[0].depuis = 5;
  const a = M.analyserReglages(JSON.parse(JSON.stringify(M.exporterReglages(c, null, {}))), c, { maintenant: T0 });
  assert.ok(a.groupes.every((g) => !g.change), a.groupes.filter((g) => g.change).map((g) => g.code).join(','));
});
