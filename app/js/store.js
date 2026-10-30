/*
 * Stockage — dossier réseau (API File System Access) ou stockage privé du
 * navigateur (mode démonstration, même API via navigator.storage.getDirectory).
 *
 *   coffre.json                       copies emballées de la clé + comptes chiffrés
 *   evenements/AAAA/MM/<nom>.enc      une saisie = un fichier chiffré, jamais modifié
 *
 * Écriture atomique : createWritable() écrit dans un fichier temporaire et ne
 * remplace la cible qu'à la fermeture ; un fichier interrompu n'apparaît jamais.
 */
(function (root) {
  'use strict';
  var SIC = root.SIC = root.SIC || {};
  var C = SIC.crypto;

  // --------------------------------------------- Mémorisation du dossier
  function idb() {
    return new Promise(function (ok, ko) {
      var r = indexedDB.open('sic-reglages', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
    });
  }
  async function memoriser(cle, valeur) {
    try {
      var db = await idb();
      await new Promise(function (ok, ko) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(valeur, cle); t.oncomplete = ok; t.onerror = function () { ko(t.error); }; });
    } catch (e) { /* stockage indisponible : sans conséquence */ }
  }
  async function relire(cle) {
    try {
      var db = await idb();
      return await new Promise(function (ok) { var r = db.transaction('kv').objectStore('kv').get(cle); r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ok(undefined); }; });
    } catch (e) { return undefined; }
  }

  // ---------------------------------------------------------- Le dossier
  function Dossier(handle, mode) {
    this.handle = handle;
    this.mode = mode; // 'reseau' | 'demo'
    this.nom = mode === 'demo' ? 'Stockage de démonstration du navigateur' : handle.name;
  }

  Dossier.choisirReseau = async function () {
    if (!window.showDirectoryPicker) throw new Error("Ce navigateur ne permet pas d'ouvrir un dossier réseau. Utilisez Edge ou Chrome à jour.");
    var h = await window.showDirectoryPicker({ id: 'sic-dossier', mode: 'readwrite' });
    await memoriser('dossier', h);
    await memoriser('mode', 'reseau');
    return new Dossier(h, 'reseau');
  };

  Dossier.demo = async function () {
    if (!navigator.storage || !navigator.storage.getDirectory) throw new Error('Le stockage de démonstration n\'est pas disponible dans ce navigateur.');
    var racine = await navigator.storage.getDirectory();
    var h = await racine.getDirectoryHandle('SuiviIsoCont-demo', { create: true });
    await memoriser('mode', 'demo');
    return new Dossier(h, 'demo');
  };

  /** Dossier utilisé lors de la dernière session (permission redemandée si nécessaire). */
  Dossier.precedent = async function () {
    var mode = await relire('mode');
    if (mode === 'demo') return { mode: 'demo', nom: 'Stockage de démonstration du navigateur' };
    var h = await relire('dossier');
    if (mode === 'reseau' && h) return { mode: 'reseau', nom: h.name, handle: h };
    return null;
  };

  Dossier.rouvrir = async function (prec) {
    if (prec.mode === 'demo') return Dossier.demo();
    var opts = { mode: 'readwrite' };
    if ((await prec.handle.queryPermission(opts)) !== 'granted' && (await prec.handle.requestPermission(opts)) !== 'granted') {
      throw new Error("L'accès au dossier a été refusé.");
    }
    return new Dossier(prec.handle, 'reseau');
  };

  Dossier.oublier = async function () { await memoriser('mode', null); await memoriser('dossier', null); };

  Dossier.prototype.sousDossier = async function (chemin, creer) {
    var h = this.handle;
    for (var i = 0; i < chemin.length; i++) h = await h.getDirectoryHandle(chemin[i], { create: !!creer });
    return h;
  };

  Dossier.prototype.lireFichier = async function (dirHandle, nom) {
    try { var f = await (await dirHandle.getFileHandle(nom)).getFile(); return new Uint8Array(await f.arrayBuffer()); }
    catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
  };

  Dossier.prototype.ecrireFichier = async function (dirHandle, nom, octets, exclusif) {
    if (exclusif) {
      var existe = true;
      try { await dirHandle.getFileHandle(nom); } catch (e) { existe = false; }
      if (existe) throw new Error('Un fichier de ce nom existe déjà : ' + nom);
    }
    var fh = await dirHandle.getFileHandle(nom, { create: true });
    var w = await fh.createWritable();
    await w.write(octets);
    await w.close();
  };

  // ------------------------------------------------------------- Coffre
  Dossier.prototype.lireCoffre = async function () {
    var o = await this.lireFichier(this.handle, 'coffre.json');
    return o ? JSON.parse(new TextDecoder().decode(o)) : null;
  };

  /** Écrit le coffre si personne ne l'a modifié depuis la lecture (contrôle de révision). */
  Dossier.prototype.ecrireCoffre = async function (coffre, revAttendue) {
    var actuel = await this.lireCoffre();
    if (actuel && actuel.rev !== revAttendue) throw new Error('Le coffre a été modifié sur un autre poste. Rechargez puis recommencez.');
    coffre.rev = (revAttendue || 0) + 1;
    await this.ecrireFichier(this.handle, 'coffre.json', new TextEncoder().encode(JSON.stringify(coffre, null, 1)));
    return coffre;
  };

  // ---------------------------------------------------------- Événements
  function horodatageCompact(iso) { return iso.replace(/[-:]/g, '').replace(/\.\d+/, ''); }

  Dossier.prototype.ecrireEvenement = async function (cle, evt) {
    var mois = evt.at.slice(0, 7).split('-');
    var dir = await this.sousDossier(['evenements', mois[0], mois[1]], true);
    var nom = evt.id + '.enc';
    var octets = await C.chiffrerJSON(cle, evt, 'evt:' + nom);
    await this.ecrireFichier(dir, nom, octets, true);
    return nom;
  };

  /** Liste les fichiers d'événements absents de `connus` et les déchiffre. */
  Dossier.prototype.lireNouveaux = async function (cle, connus) {
    var res = { evenements: [], rejetes: [] };
    var racine;
    try { racine = await this.sousDossier(['evenements'], false); } catch (e) { return res; }
    for await (var an of racine.values()) {
      if (an.kind !== 'directory') continue;
      for await (var mois of an.values()) {
        if (mois.kind !== 'directory') continue;
        for await (var f of mois.values()) {
          if (f.kind !== 'file' || !/\.enc$/.test(f.name) || connus.has(f.name)) continue;
          connus.add(f.name);
          try {
            var octets = new Uint8Array(await (await f.getFile()).arrayBuffer());
            var e = await C.dechiffrerJSON(cle, octets, 'evt:' + f.name);
            if (e.id + '.enc' !== f.name) throw new Error('nom incohérent');
            res.evenements.push(e);
          } catch (err) {
            res.rejetes.push({ nom: f.name, raison: err.message || String(err) });
          }
        }
      }
    }
    return res;
  };

  Dossier.prototype.vider = async function () {
    for await (var k of this.handle.keys()) await this.handle.removeEntry(k, { recursive: true });
  };

  SIC.Dossier = Dossier;
  SIC.horodatageCompact = horodatageCompact;
})(typeof self !== 'undefined' ? self : this);
