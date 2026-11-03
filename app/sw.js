// SPDX-License-Identifier: EUPL-1.2
/*
 * Mise en cache de l'outil sur un poste (option « Garder l'outil disponible hors réseau sur ce poste »,
 * Administration → Sauvegardes et exports), demande du porteur. Enregistré seulement sur les postes choisis, quand l'outil
 * est servi en HTTPS (intranet ou page GitHub). Ne met en cache que les fichiers de l'application (pages, scripts,
 * styles, images), jamais les données, qui restent dans le dossier choisi.
 * - Installation : chaque fichier listé dans EMPREINTES-SHA256.txt est téléchargé puis contrôlé par son empreinte
 *   SHA-256 ; au moindre écart, l'installation échoue et rien n'est gardé.
 * - Utilisation : réseau d'abord (version à jour, cache rafraîchi), cache si le réseau ne répond pas.
 * Les requêtes vers d'autres sites ne sont jamais traitées (et la page n'en fait aucune).
 */
'use strict';
// La version de l'outil est importée : à chaque nouvelle version publiée, le navigateur réinstalle ce script
// et recharge le cache (fichiers de nouveau contrôlés par leurs empreintes).
importScripts('js/version.js');
var CACHE = 'sic-outil';
var DELAI_RESEAU = 4000;

function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase(); }

async function precharger() {
  var rep = await fetch('EMPREINTES-SHA256.txt', { cache: 'no-store' });
  if (!rep.ok) throw new Error('Empreintes inaccessibles');
  var lignes = (await rep.text()).split(/\r?\n/).filter(function (l) { return /^[0-9A-F]{64}\s+app\//.test(l); });
  var cache = await caches.open(CACHE + '-nouveau');
  for (var i = 0; i < lignes.length; i++) {
    var m = /^([0-9A-F]{64})\s+app\/(.+)$/.exec(lignes[i]);
    if (m[2] === 'sw.js') continue;
    var r = await fetch(m[2], { cache: 'no-store' });
    if (!r.ok) throw new Error('Fichier inaccessible : ' + m[2]);
    var octets = await r.clone().arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', octets)) !== m[1]) throw new Error('Empreinte différente : ' + m[2]);
    await cache.put(new Request(m[2]), r);
  }
  await cache.put(new Request('EMPREINTES-SHA256.txt'), new Response(lignes.join('\n')));
  // La page d'accueil du dossier (« ./ ») sert index.html
  var index = await cache.match('index.html');
  if (index) await cache.put(new Request('./'), index.clone());
  await caches.delete(CACHE);
  var neuf = await caches.open(CACHE), cles = await cache.keys();
  for (var j = 0; j < cles.length; j++) await neuf.put(cles[j], await cache.match(cles[j]));
  await caches.delete(CACHE + '-nouveau');
}

self.addEventListener('install', function (ev) { ev.waitUntil(precharger().then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (ev) { ev.waitUntil(self.clients.claim()); });

function avecDelai(promesse, ms) {
  return new Promise(function (ok, ko) {
    var t = setTimeout(function () { ko(new Error('délai')); }, ms);
    promesse.then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); ko(e); });
  });
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf(new URL('./', self.registration.scope).pathname) !== 0) return;
  ev.respondWith((async function () {
    try {
      var r = await avecDelai(fetch(req, { cache: 'no-cache' }), DELAI_RESEAU);
      if (r.ok && !url.search) { var c = await caches.open(CACHE); c.put(req, r.clone()); }
      return r;
    } catch (e) {
      var enCache = await caches.match(req, { ignoreSearch: true, cacheName: CACHE });
      if (enCache) return enCache;
      if (req.mode === 'navigate') { var index = await caches.match('index.html', { cacheName: CACHE }); if (index) return index; }
      throw e;
    }
  })());
});
