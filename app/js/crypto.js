// SPDX-License-Identifier: EUPL-1.2
/*
 * Chiffrement — Web Crypto API uniquement (aucune bibliothèque externe).
 *  - Clé de données : AES-GCM 256 bits, tirée au hasard à l'initialisation.
 *  - Chaque fichier : en-tête "SIC1" + IV aléatoire 96 bits + texte chiffré authentifié.
 *  - La clé de données est « emballée » par plusieurs moyens de déblocage :
 *      mot de passe (PBKDF2-SHA256), clé de sécurité (WebAuthn PRF), code de secours.
 * Utilisable dans le navigateur (window.SIC.crypto) et dans Node ≥ 20 (globalThis.crypto).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SIC = root.SIC || {}).crypto = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var subtle = globalThis.crypto.subtle;
  var enc = new TextEncoder(), dec = new TextDecoder();
  var MAGIC = enc.encode('SIC1');
  var ITERATIONS_MDP = 600000;     // recommandation OWASP pour PBKDF2-SHA256
  var ITERATIONS_SECOURS = 100000; // code de secours : 100 bits d'aléa, moins d'itérations suffisent

  function aleatoire(n) { return globalThis.crypto.getRandomValues(new Uint8Array(n)); }

  function b64(u8) {
    var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function deb64(s) {
    var b = atob(s), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function hex(u8) { return Array.prototype.map.call(u8, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

  async function nouvelleCleDonnees() {
    return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  async function chiffrerOctets(cle, octets, aad) {
    var iv = aleatoire(12);
    var ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(aad || '') }, cle, octets));
    var out = new Uint8Array(4 + 12 + ct.length);
    out.set(MAGIC, 0); out.set(iv, 4); out.set(ct, 16);
    return out;
  }

  async function dechiffrerOctets(cle, donnees, aad) {
    var u = new Uint8Array(donnees);
    for (var i = 0; i < 4; i++) if (u[i] !== MAGIC[i]) throw new Error('Fichier non reconnu');
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u.slice(4, 16), additionalData: enc.encode(aad || '') }, cle, u.slice(16)));
  }

  async function chiffrerJSON(cle, objet, aad) { return chiffrerOctets(cle, enc.encode(JSON.stringify(objet)), aad); }
  async function dechiffrerJSON(cle, donnees, aad) { return JSON.parse(dec.decode(await dechiffrerOctets(cle, donnees, aad))); }

  // ----------------------------------------------------------- Emballage
  async function cleDepuisSecret(secretOctets, sel, iterations) {
    var base = await subtle.importKey('raw', secretOctets, 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: iterations, hash: 'SHA-256' }, base,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function cleDepuisPRF(prfOctets, sel) {
    var base = await subtle.importKey('raw', prfOctets, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: sel, info: enc.encode('SIC cle de securite') }, base,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function emballer(cleDonnees, cleEmballage) {
    var brut = new Uint8Array(await subtle.exportKey('raw', cleDonnees));
    return b64(await chiffrerOctets(cleEmballage, brut, 'emballage'));
  }

  async function deballer(emballee, cleEmballage) {
    var brut = await dechiffrerOctets(cleEmballage, deb64(emballee), 'emballage');
    return subtle.importKey('raw', brut, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  /** Emballage par mot de passe → objet stockable dans le coffre. */
  async function emballerMotDePasse(cleDonnees, motDePasse) {
    var sel = aleatoire(16);
    var k = await cleDepuisSecret(enc.encode(motDePasse.normalize('NFC')), sel, ITERATIONS_MDP);
    return { methode: 'mdp', sel: b64(sel), iterations: ITERATIONS_MDP, cle: await emballer(cleDonnees, k) };
  }

  async function deballerMotDePasse(emb, motDePasse) {
    var k = await cleDepuisSecret(enc.encode(motDePasse.normalize('NFC')), deb64(emb.sel), emb.iterations);
    return deballer(emb.cle, k);
  }

  // Code de secours : 20 caractères (alphabet sans ambiguïté), 100 bits d'aléa.
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function nouveauCodeSecours() {
    var a = aleatoire(20), s = '';
    for (var i = 0; i < 20; i++) s += ALPHABET[a[i] % 32];
    return s.match(/.{4}/g).join('-');
  }
  function normaliserCode(code) { return code.toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  async function emballerCodeSecours(cleDonnees, code) {
    var sel = aleatoire(16);
    var k = await cleDepuisSecret(enc.encode(normaliserCode(code)), sel, ITERATIONS_SECOURS);
    return { methode: 'secours', sel: b64(sel), iterations: ITERATIONS_SECOURS, cle: await emballer(cleDonnees, k) };
  }

  async function deballerCodeSecours(emb, code) {
    var k = await cleDepuisSecret(enc.encode(normaliserCode(code)), deb64(emb.sel), emb.iterations);
    return deballer(emb.cle, k);
  }

  // ------------------------------------------------ Clé de sécurité (PRF)
  function webauthnDisponible() {
    return typeof window !== 'undefined' && window.isSecureContext && !!window.PublicKeyCredential &&
      location.protocol !== 'file:';
  }

  /** Enregistre une clé de sécurité et emballe la clé de données avec son secret PRF. */
  async function emballerCleSecurite(cleDonnees, identifiant, libelle) {
    if (!webauthnDisponible()) throw new Error('Les clés de sécurité nécessitent une page servie en HTTPS (GitHub Pages ou intranet).');
    var selPRF = aleatoire(32);
    var cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'Suivi mesures iso/cont', id: location.hostname },
        user: { id: aleatoire(16), name: identifiant, displayName: libelle || identifiant },
        challenge: aleatoire(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'cross-platform', userVerification: 'discouraged', residentKey: 'discouraged' },
        extensions: { prf: {} }
      }
    });
    var ext = cred.getClientExtensionResults();
    if (!ext.prf || ext.prf.enabled === false) throw new Error("Cette clé ou ce navigateur ne prend pas en charge l'extension PRF (YubiKey 5, firmware 5.2 ou plus, Chrome ou Edge récents).");
    var idCred = new Uint8Array(cred.rawId);
    var prf = await evaluerPRF([idCred], selPRF);
    var sel = aleatoire(16);
    var k = await cleDepuisPRF(prf.secret, sel);
    return { methode: 'cle', idCredential: b64(idCred), selPRF: b64(selPRF), sel: b64(sel), libelle: libelle || 'Clé de sécurité', rpId: location.hostname, cle: await emballer(cleDonnees, k) };
  }

  async function evaluerPRF(idsCredentials, selPRF, parCredential) {
    var opts = {
      challenge: aleatoire(32),
      rpId: location.hostname,
      allowCredentials: idsCredentials.map(function (id) { return { type: 'public-key', id: id }; }),
      userVerification: 'discouraged',
      extensions: { prf: parCredential ? { evalByCredential: parCredential } : { eval: { first: selPRF } } }
    };
    var a = await navigator.credentials.get({ publicKey: opts });
    var r = a.getClientExtensionResults();
    if (!r.prf || !r.prf.results || !r.prf.results.first) throw new Error("La clé n'a pas renvoyé de secret PRF.");
    return { idCredential: new Uint8Array(a.rawId), secret: new Uint8Array(r.prf.results.first) };
  }

  /** Déverrouille avec l'une des clés de sécurité enregistrées (liste d'emballages 'cle'). */
  async function deballerCleSecurite(emballages) {
    if (!webauthnDisponible()) throw new Error('Les clés de sécurité nécessitent une page servie en HTTPS.');
    var utilisables = emballages.filter(function (e) { return e.rpId === location.hostname; });
    if (!utilisables.length) throw new Error("Aucune clé de sécurité n'est enregistrée pour cette adresse (" + location.hostname + ').');
    var parCred = {};
    utilisables.forEach(function (e) { parCred[e.idCredential.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')] = { first: deb64(e.selPRF) }; });
    var res = await evaluerPRF(utilisables.map(function (e) { return deb64(e.idCredential); }), null, parCred);
    var idB64 = b64(res.idCredential);
    var emb = utilisables.filter(function (e) { return e.idCredential === idB64; })[0];
    if (!emb) throw new Error('Clé non reconnue.');
    var k = await cleDepuisPRF(res.secret, deb64(emb.sel));
    return { cle: await deballer(emb.cle, k), emballage: emb };
  }

  async function empreinte(texte) {
    return hex(new Uint8Array(await subtle.digest('SHA-256', enc.encode(texte))));
  }

  return {
    aleatoire: aleatoire, hex: hex, b64: b64, deb64: deb64,
    nouvelleCleDonnees: nouvelleCleDonnees,
    chiffrerJSON: chiffrerJSON, dechiffrerJSON: dechiffrerJSON,
    emballerMotDePasse: emballerMotDePasse, deballerMotDePasse: deballerMotDePasse,
    nouveauCodeSecours: nouveauCodeSecours, emballerCodeSecours: emballerCodeSecours, deballerCodeSecours: deballerCodeSecours,
    webauthnDisponible: webauthnDisponible, emballerCleSecurite: emballerCleSecurite, deballerCleSecurite: deballerCleSecurite,
    empreinte: empreinte, ITERATIONS_MDP: ITERATIONS_MDP
  };
});
