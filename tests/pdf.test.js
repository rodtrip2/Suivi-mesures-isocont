// SPDX-License-Identifier: EUPL-1.2
// Générateur PDF autonome (décompte JLD enregistré en PDF) : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../app/js/pdf.js');
// JPEG 2 × 3 pixels (niveaux de gris), pour le papier à en-tête
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAADAAIBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AOkr/9k=';

function texte(octets) { return Buffer.from(octets).toString('latin1'); }

test('Structure : en-tête, table des positions exacte, fin de fichier', () => {
  const d = new P.Document({ titre: 'Décompte (fictif)', auteur: 'Agent (fictif)', piedDePage: (n, t) => 'Page ' + n + ' / ' + t });
  d.paragraphe('Cumul des mesures d’isolement — « été » à 12 h 05, œuvre, 10 €', { taille: 12, style: 'gras' });
  const s = texte(d.octets());
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const xref = +/startxref\n(\d+)/.exec(s)[1];
  assert.ok(s.slice(xref).startsWith('xref'));
  const lignes = s.slice(xref).split('\n'), n = +lignes[1].split(' ')[1];
  for (let i = 1; i < n; i++) {
    const pos = +lignes[2 + i].slice(0, 10);
    assert.ok(s.slice(pos).startsWith(i + ' 0 obj'), 'objet ' + i);
  }
  // Accents et signes codés en WinAnsi
  assert.ok(s.includes('\xe9t\xe9'));            // « été »
  assert.ok(s.includes('\x9cuvre'));             // œ
  assert.ok(s.includes('\x80'));                  // €
  assert.ok(s.includes('\x92'));                  // ’
  assert.ok(s.includes('Page 1 / 1'));
});

test('Tableau sur plusieurs pages, en-tête répété, retour à la ligne', () => {
  const d = new P.Document({ piedDePage: (n, t) => 'Page ' + n + ' / ' + t });
  const lignes = [];
  for (let i = 0; i < 80; i++) lignes.push([String(i + 1), '31/10/2026 02:10', 'Suite de la même mesure (tranche ' + (i + 1) + ') avec un commentaire assez long pour être coupé sur deux lignes']);
  d.tableau({ entetes: ['N°', 'Début', 'Commentaire'], lignes: lignes, poids: [8, 25, 67], taille: 8 });
  const s = texte(d.octets());
  assert.ok(d.pages.length >= 3);
  assert.equal((s.match(/\(Commentaire\) Tj/g) || []).length, d.pages.length);   // en-tête sur chaque page
  assert.ok(s.includes('/Count ' + d.pages.length));
  assert.ok(s.includes('Page ' + d.pages.length + ' / ' + d.pages.length));
  const coupe = P.couper('mot '.repeat(60), 9, false, 200);
  assert.ok(coupe.length > 1 && coupe.every((l) => P.largeur(l, 9, false) <= 200));
});

test('Papier à en-tête JPEG : sur toutes les pages ou la première seulement', () => {
  assert.deepEqual(P.infoJPEG(Buffer.from(JPEG.split(',')[1], 'base64')), { h: 3, l: 2, comp: 1 });
  const d = new P.Document({ fond: JPEG, fondPages: 'premiere' });
  for (let i = 0; i < 120; i++) d.paragraphe('Ligne ' + i);
  const s = texte(d.octets());
  assert.ok(s.includes('/Subtype /Image') && s.includes('/DCTDecode') && s.includes('/DeviceGray'));
  assert.equal((s.match(/\/Fond Do/g) || []).length, 1);
  const d2 = new P.Document({ fond: JPEG, fondPages: 'toutes' });
  for (let i = 0; i < 120; i++) d2.paragraphe('Ligne ' + i);
  assert.equal((texte(d2.octets()).match(/\/Fond Do/g) || []).length, d2.pages.length);
  assert.throws(() => new P.Document({ fond: 'data:image/png;base64,iVBORw0KGgo=' }), /JPEG/);
});
