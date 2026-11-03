// SPDX-License-Identifier: EUPL-1.2
// Assistant d'installation de la copie robocopy : commandes préparées par l'outil : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../app/js/model.js');

global.self = global;
require('../app/js/outils-robocopy.js');
const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'kit', 'outils', 'miroir-robocopy.ps1'), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const base = { principal: '\\\\serveur-fictif\\partage\\SuiviIsoCont', script: global.SIC.scriptRobocopy };

test('Robocopy : le script intégré à l’outil est celui du kit (lancer node scripts/outils-js.mjs après une modification)', () => {
  assert.equal(global.SIC.scriptRobocopy, SCRIPT);
});

test('Robocopy : chemins Windows reconnus et refusés', () => {
  assert.deepEqual(M.cheminWindows('\\\\srv\\partage\\dossier\\'), { chemin: '\\\\srv\\partage\\dossier', unc: true });
  assert.deepEqual(M.cheminWindows('c:/SuiviIsoCont-local'), { chemin: 'c:\\SuiviIsoCont-local', unc: false });
  assert.deepEqual(M.cheminWindows('D:'), { chemin: 'D:\\', unc: false });
  ['', 'dossier', '\\\\srv', 'C:\\a"b', 'C:\\a\nb', 'C:\\a:b', 'https://x'].forEach((c) => assert.equal(M.cheminWindows(c), null, c));
});

test('Robocopy : erreurs de saisie signalées, aucune commande produite', () => {
  const r = M.commandesRobocopy(Object.assign({}, base, { type: 'local', secours: '\\\\srv\\copie', compte: 'service', utilisateur: 'svc' }));
  assert.equal(r.texte, '');
  assert.ok(r.erreurs.some((t) => /disque du poste/.test(t)));
  assert.ok(r.erreurs.some((t) => /DOMAINE/.test(t)));
  assert.ok(M.commandesRobocopy(Object.assign({}, base, { type: 'serveur', secours: base.principal + '\\secours', compte: 'agents' })).erreurs.some((t) => /intérieur/.test(t)));
  assert.ok(M.commandesRobocopy(Object.assign({}, base, { type: 'serveur', secours: base.principal.toUpperCase(), compte: 'agents' })).erreurs.some((t) => /différents/.test(t)));
});

test('Robocopy : copie locale par les agents connectés (sans mot de passe)', () => {
  const r = M.commandesRobocopy(Object.assign({}, base, { type: 'local', secours: 'C:\\SuiviIsoCont-local', compte: 'agents', intervalle: 10 }));
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.tache, 'SuiviIsoCont - copie locale');
  assert.match(r.texte, /\$Principal = '\\\\serveur-fictif\\partage\\SuiviIsoCont'; \$Secours = 'C:\\SuiviIsoCont-local'; \$Exports = 'exports'; \$Type = 'local'/);
  assert.match(r.texte, /New-ScheduledTaskPrincipal -GroupId 'S-1-5-32-545'/);
  assert.match(r.texte, /-AtLogOn/);
  assert.match(r.texte, /-RepetitionInterval \(New-TimeSpan -Minutes 10\)/);
  assert.doesNotMatch(r.texte, /Get-Credential/);
  assert.ok(r.texte.includes("$contenu = @'\r\n" + SCRIPT.replace(/\n+$/, '').replace(/\n/g, '\r\n') + "\r\n'@"), 'script intégré tel quel');
});

test('Robocopy : dossier de secours par un compte de service ; guillemets et apostrophes sûrs pour PowerShell', () => {
  const r = M.commandesRobocopy(Object.assign({}, base, { type: 'serveur', principal: '\\\\srv\\Données d\'essai (fictif)', secours: '\\\\srv2\\secours', compte: 'service', utilisateur: 'FICTIF\\svc-isocont', intervalle: 30, exports: 'exports/u1' }));
  assert.deepEqual(r.erreurs, []);
  assert.match(r.texte, /\$Principal = '\\\\srv\\Données d''essai \(fictif\)'/);
  assert.match(r.texte, /\$Exports = 'exports\\u1'/);
  assert.match(r.texte, /Get-Credential -UserName 'FICTIF\\svc-isocont'/);
  assert.doesNotMatch(r.texte, /AtLogOn|GroupId/);
  // Hors script intégré et commentaires, aucune apostrophe typographique (PowerShell la lit comme un guillemet)
  const hors = r.texte.split("$contenu = @'")[0] + r.texte.split("\r\n'@")[1];
  hors.split('\r\n').filter((l) => !/^#/.test(l)).forEach((l) => assert.doesNotMatch(l, /[\u2018\u2019]/, l));
  assert.match(r.texte, /^& \{$/m);
  assert.match(r.texte, /^\}\r\n$/m);
});

test('Robocopy : « ma session » sans droits d’administrateur (copie locale seulement)', () => {
  const r = M.commandesRobocopy(Object.assign({}, base, { type: 'local', secours: 'C:\\SuiviIsoCont-local', compte: 'session' }));
  assert.deepEqual(r.erreurs, []);
  assert.doesNotMatch(r.texte, /IsInRole|icacls|Get-Credential|GroupId/);
  assert.match(r.texte, /\$Outil = Join-Path \$env:LOCALAPPDATA 'SuiviIsoCont'/);
  assert.match(r.texte, /New-ScheduledTaskPrincipal -UserId \$Moi -LogonType Interactive/);
  assert.match(r.texte, /-AtLogOn -User \$Moi/);
  assert.match(r.texte, /-Journal \$Log/);
  assert.match(r.tache, /copie locale - /);
  assert.ok(M.commandesRobocopy(Object.assign({}, base, { type: 'serveur', secours: '\\\\srv2\\secours', compte: 'session' })).erreurs.some((t) => /réservé à la copie locale/.test(t)));
});
