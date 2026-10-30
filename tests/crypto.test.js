// Tests du chiffrement (Web Crypto de Node ≥ 20) : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../app/js/crypto.js');

test('Chiffrement authentifié : un fichier modifié ou renommé est rejeté', async () => {
  const k = await C.nouvelleCleDonnees();
  const f = await C.chiffrerJSON(k, { a: 1, texte: 'événement' }, 'evt:x.enc');
  assert.deepEqual(await C.dechiffrerJSON(k, f, 'evt:x.enc'), { a: 1, texte: 'événement' });
  await assert.rejects(C.dechiffrerJSON(k, f, 'evt:y.enc'));
  const altere = f.slice(); altere[30] ^= 1;
  await assert.rejects(C.dechiffrerJSON(k, altere, 'evt:x.enc'));
});

test('Emballage par mot de passe : bon mot de passe accepté, mauvais refusé', async () => {
  const k = await C.nouvelleCleDonnees();
  const emb = await C.emballerMotDePasse(k, 'un mot de passe solide');
  assert.equal(emb.iterations, C.ITERATIONS_MDP);
  const k2 = await C.deballerMotDePasse(emb, 'un mot de passe solide');
  const f = await C.chiffrerJSON(k, { ok: true }, 'test');
  assert.deepEqual(await C.dechiffrerJSON(k2, f, 'test'), { ok: true });
  await assert.rejects(C.deballerMotDePasse(emb, 'mauvais'));
});

test('Code de secours : format, tolérance aux tirets et à la casse', async () => {
  const code = C.nouveauCodeSecours();
  assert.match(code, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
  const k = await C.nouvelleCleDonnees();
  const emb = await C.emballerCodeSecours(k, code);
  const k2 = await C.deballerCodeSecours(emb, code.toLowerCase().replace(/-/g, ' '));
  const f = await C.chiffrerJSON(k, 1, 't');
  assert.equal(await C.dechiffrerJSON(k2, f, 't'), 1);
});
