// SPDX-License-Identifier: EUPL-1.2
/*
 * Stockage — dossier réseau (API File System Access) ou stockage privé du
 * navigateur (mode démonstration, même API via navigator.storage.getDirectory).
 *
 *   coffre.json                       copies emballées de la clé + comptes chiffrés
 *   evenements/AAAA/MM/<nom>.enc      une saisie = un fichier chiffré, jamais modifié
 *   instantanes/AAAA-MM.enc           copie consolidée des saisies d'un mois clos
 *
 * Instantanés : les saisies sont rangées par mois de saisie. Un mois clos
 * (antérieur au mois précédent) ne reçoit plus de fichiers ; ses saisies sont
 * regroupées dans un instantané, lu en une seule fois au lieu de centaines de
 * petits fichiers. Les fichiers d'origine ne sont jamais supprimés : si un
 * instantané ne couvre pas tous les fichiers du mois, il est complété.
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

  function moisClos(cle, maintenant) {
    var d = new Date(maintenant); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    return cle < d.toISOString().slice(0, 7);
  }

  async function lireEvenement(cle, fichier) {
    var octets = new Uint8Array(await (await fichier.getFile()).arrayBuffer());
    var e = await C.dechiffrerJSON(cle, octets, 'evt:' + fichier.name);
    if (e.id + '.enc' !== fichier.name) throw new Error('nom incohérent');
    return e;
  }

  /**
   * Lit les saisies absentes de `connus` (noms de fichiers déjà chargés) :
   * instantané du mois s'il existe, puis fichiers individuels restants.
   * Écrit les instantanés manquants ou incomplets des mois clos.
   */
  Dossier.prototype.lireNouveaux = async function (cle, connus, options) {
    var res = { evenements: [], rejetes: [], instantanes: 0 };
    var racine;
    try { racine = await this.sousDossier(['evenements'], false); } catch (e) { return res; }
    var maintenant = Date.now();
    for await (var an of racine.values()) {
      if (an.kind !== 'directory') continue;
      for await (var mois of an.values()) {
        if (mois.kind !== 'directory') continue;
        var cleMois = an.name + '-' + mois.name;
        var fichiers = [];
        for await (var f of mois.values()) if (f.kind === 'file' && /\.enc$/.test(f.name)) fichiers.push(f);
        var nouveaux = fichiers.filter(function (x) { return !connus.has(x.name); });
        if (!nouveaux.length) continue;
        var clos = moisClos(cleMois, maintenant) && !(options && options.sansInstantanes);
        var duMois = {}, rejetsMois = 0;
        if (clos) {
          var snap = await this.lireInstantane(cle, cleMois);
          if (snap) snap.evenements.forEach(function (e) { duMois[e.id + '.enc'] = e; });
        }
        for (var i = 0; i < fichiers.length; i++) {
          var nom = fichiers[i].name;
          if (duMois[nom] || connus.has(nom)) continue; // déjà lu (instantané ou session en cours)
          try { duMois[nom] = await lireEvenement(cle, fichiers[i]); }
          catch (err) { rejetsMois++; res.rejetes.push({ nom: nom, raison: err.message || String(err) }); }
        }
        nouveaux.forEach(function (x) {
          connus.add(x.name);
          if (duMois[x.name]) res.evenements.push(duMois[x.name]);
        });
        // Instantané : seulement si tous les fichiers du mois sont lisibles et en main.
        if (clos && !rejetsMois && fichiers.every(function (x) { return duMois[x.name]; })) {
          var evts = fichiers.map(function (x) { return duMois[x.name]; });
          if (!snap || snap.evenements.length !== evts.length) {
            try { await this.ecrireInstantane(cle, cleMois, evts); res.instantanes++; } catch (err) { /* sans conséquence */ }
          }
        }
      }
    }
    return res;
  };

  Dossier.prototype.lireInstantane = async function (cle, cleMois) {
    try {
      var dir = await this.sousDossier(['instantanes'], false);
      var o = await this.lireFichier(dir, cleMois + '.enc');
      if (!o) return null;
      var snap = await C.dechiffrerJSON(cle, o, 'snap:' + cleMois);
      return snap && snap.mois === cleMois && Array.isArray(snap.evenements) ? snap : null;
    } catch (e) { return null; }
  };

  Dossier.prototype.ecrireInstantane = async function (cle, cleMois, evts) {
    var dir = await this.sousDossier(['instantanes'], true);
    var octets = await C.chiffrerJSON(cle, { mois: cleMois, creeLe: new Date().toISOString(), evenements: evts }, 'snap:' + cleMois);
    await this.ecrireFichier(dir, cleMois + '.enc', octets);
  };

  Dossier.prototype.vider = async function () {
    for await (var k of this.handle.keys()) await this.handle.removeEntry(k, { recursive: true });
  };

  SIC.Dossier = Dossier;
  SIC.horodatageCompact = horodatageCompact;
})(typeof self !== 'undefined' ? self : this);
