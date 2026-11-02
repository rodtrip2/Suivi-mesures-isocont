// SPDX-License-Identifier: EUPL-1.2
/*
 * Stockage — dossier réseau (API File System Access) ou stockage privé du
 * navigateur (mode démonstration, même API via navigator.storage.getDirectory).
 *
 *   coffre.json                       copies emballées de la clé + comptes chiffrés
 *   evenements/AAAA/MM/<nom>.enc      une saisie = un fichier chiffré, jamais modifié
 *   instantanes/AAAA-MM.enc           copie consolidée des saisies d'un mois clos
 *   coffre-historique/rev-N.json      versions du coffre, la dernière comprise (les 30 dernières)
 *   reperes/<agent>.enc               repère d'intégrité : nombre et dernière saisie de chaque agent
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

  /** Réglages propres à ce poste de travail (navigateur), hors données. */
  Dossier.lireReglage = relire;
  Dossier.ecrireReglage = memoriser;

  /** Signale un dossier sans coffre qui contient pourtant des saisies (jeu de formation, coffre perdu ou illisible). */
  Dossier.prototype.anomalie = async function () {
    try { await this.handle.getFileHandle('FORMATION-LISEZMOI.txt'); return 'formation'; } catch (e) { /* absent */ }
    if (this.coffreIllisible) return 'coffre-illisible';
    try { await this.handle.getDirectoryHandle('evenements'); return 'sans-coffre'; } catch (e) { return null; }
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
  /** Vrai si l'objet a la forme d'un coffre utilisable (au moins un moyen de déblocage et les comptes). */
  function coffreValide(c) {
    return !!(c && c.format === 'SIC-coffre' && Array.isArray(c.emballages) && c.emballages.length && typeof c.comptes === 'string');
  }

  /** Lit le coffre ; un coffre abîmé est signalé (coffreIllisible) et vaut absence de coffre. */
  Dossier.prototype.lireCoffre = async function () {
    var o = await this.lireFichier(this.handle, 'coffre.json');
    this.coffreIllisible = false;
    if (!o) return null;
    try {
      var c = JSON.parse(new TextDecoder().decode(o));
      if (!coffreValide(c)) throw new Error('forme inattendue');
      return c;
    } catch (e) { this.coffreIllisible = true; return null; }
  };

  var HISTORIQUE_COFFRE = 30;

  /**
   * Écrit le coffre si personne ne l'a modifié depuis la lecture (contrôle de révision). La version
   * remplacée est d'abord copiée dans coffre-historique ; le nouveau coffre est vérifié avant et
   * relu après l'écriture, et l'ancienne version est remise en place si la relecture échoue.
   */
  Dossier.prototype.ecrireCoffre = async function (coffre, revAttendue) {
    var actuel = await this.lireCoffre();
    if (this.coffreIllisible) throw new Error('Le coffre actuel est illisible : restaurez une version précédente avant toute modification.');
    if (actuel && actuel.rev !== revAttendue) throw new Error('Le coffre a été modifié sur un autre poste. Rechargez puis recommencez.');
    coffre.rev = (revAttendue || 0) + 1;
    if (!coffreValide(coffre)) throw new Error('Coffre incomplet : écriture refusée.');
    var octets = new TextEncoder().encode(JSON.stringify(coffre, null, 1));
    if (actuel) await this.archiverCoffre(actuel);
    await this.ecrireFichier(this.handle, 'coffre.json', octets);
    var relu = await this.lireCoffre();
    if (!relu || relu.rev !== coffre.rev) {
      if (actuel) await this.ecrireFichier(this.handle, 'coffre.json', new TextEncoder().encode(JSON.stringify(actuel, null, 1)));
      throw new Error('L’écriture du coffre n’a pas pu être vérifiée : la version précédente a été remise en place.');
    }
    // La version qui vient d'être écrite est aussi copiée : l'historique contient toujours la dernière version valide.
    try { await this.archiverCoffre(coffre); } catch (e) { /* sans conséquence sur l'écriture */ }
    return coffre;
  };

  /** Copie une version du coffre dans coffre-historique (les plus anciennes au-delà de 30 sont retirées). */
  Dossier.prototype.archiverCoffre = async function (coffre) {
    var dir = await this.sousDossier(['coffre-historique'], true);
    var nom = 'rev-' + String(coffre.rev || 0).padStart(6, '0') + '.json';
    await this.ecrireFichier(dir, nom, new TextEncoder().encode(JSON.stringify(Object.assign({}, coffre, { archiveLe: new Date().toISOString() }), null, 1)));
    var noms = [];
    for await (var f of dir.values()) if (f.kind === 'file' && /^rev-\d+\.json$/.test(f.name)) noms.push(f.name);
    noms.sort();
    for (var i = 0; i < noms.length - HISTORIQUE_COFFRE; i++) { try { await dir.removeEntry(noms[i]); } catch (e) { /* sans conséquence */ } }
  };

  /** Versions précédentes du coffre : [{ nom, rev, archiveLe, valide }], la plus récente d'abord. */
  Dossier.prototype.versionsCoffre = async function () {
    var res = [], dir;
    try { dir = await this.sousDossier(['coffre-historique'], false); } catch (e) { return res; }
    for await (var f of dir.values()) {
      if (f.kind !== 'file' || !/^rev-\d+\.json$/.test(f.name)) continue;
      var c = null;
      try { c = JSON.parse(new TextDecoder().decode(await this.lireFichier(dir, f.name))); } catch (e) { c = null; }
      res.push({ nom: f.name, rev: c ? c.rev : null, archiveLe: c ? c.archiveLe : null, valide: coffreValide(c), coffre: c });
    }
    return res.sort(function (a, b) { return a.nom < b.nom ? 1 : -1; });
  };

  /**
   * Remet en place un coffre (version de l'historique ou copie sous scellé), sans contrôle de révision :
   * réservé au cas où le coffre actuel est absent ou illisible. La révision repart au-dessus de toutes
   * les versions connues.
   */
  Dossier.prototype.restaurerCoffre = async function (coffre) {
    if (!coffreValide(coffre)) throw new Error('Ce fichier n’est pas un coffre utilisable.');
    var actuel = await this.lireCoffre();
    if (actuel) throw new Error('Le dossier contient déjà un coffre lisible : restauration inutile.');
    var versions = await this.versionsCoffre();
    var max = versions.reduce(function (m, v) { return Math.max(m, v.rev || 0); }, coffre.rev || 0);
    var c = Object.assign({}, coffre, { rev: max + 1, restaureLe: new Date().toISOString() });
    delete c.archiveLe;
    await this.ecrireFichier(this.handle, 'coffre.json', new TextEncoder().encode(JSON.stringify(c, null, 1)));
    var relu = await this.lireCoffre();
    if (!relu) throw new Error('La restauration du coffre a échoué.');
    return relu;
  };

  // ------------------------------------------------- Copie de sauvegarde complète
  /** Fichiers d'un sous-dossier, récursivement : [{ chemin, octets }]. */
  async function fichiers(dir, prefixe, res) {
    for await (var x of dir.values()) {
      if (x.kind === 'directory') await fichiers(x, prefixe + x.name + '/', res);
      else res.push({ chemin: prefixe + x.name, octets: new Uint8Array(await (await x.getFile()).arrayBuffer()) });
    }
    return res;
  }

  /**
   * Copie de sauvegarde complète : coffre et fichiers de saisie (toujours chiffrés, copiés tels quels).
   * Les instantanés (reconstruits automatiquement) et le jeu de formation (fictif) n'y figurent pas.
   */
  Dossier.prototype.copieComplete = async function () {
    var coffre = await this.lireCoffre();
    if (!coffre) throw new Error('Coffre absent ou illisible : copie impossible.');
    var liste = [];
    try { await fichiers(await this.sousDossier(['evenements'], false), 'evenements/', liste); } catch (e) { /* aucun */ }
    return { format: 'SIC-sauvegarde', version: 1, creeLe: new Date().toISOString(), coffre: coffre,
      fichiers: liste.map(function (f) { return { chemin: f.chemin, contenu: C.b64(f.octets) }; }) };
  };

  /** Restaure une copie complète dans un dossier vide. */
  Dossier.prototype.restaurerCopie = async function (copie) {
    if (!copie || copie.format !== 'SIC-sauvegarde' || !coffreValide(copie.coffre) || !Array.isArray(copie.fichiers)) throw new Error('Ce fichier n’est pas une copie de sauvegarde de l’outil.');
    for await (var k of this.handle.keys()) { if (k) throw new Error('Le dossier n’est pas vide : choisissez un dossier vide pour restaurer la copie.'); }
    for (var i = 0; i < copie.fichiers.length; i++) {
      var f = copie.fichiers[i], parties = f.chemin.split('/');
      if (parties[0] !== 'evenements' || parties.some(function (p) { return !p || p === '..'; })) continue;
      var dir = await this.sousDossier(parties.slice(0, -1), true);
      await this.ecrireFichier(dir, parties[parties.length - 1], C.deb64(f.contenu));
    }
    await this.ecrireFichier(this.handle, 'coffre.json', new TextEncoder().encode(JSON.stringify(copie.coffre, null, 1)));
    return copie.fichiers.length;
  };

  function cheminSur(chemin) {
    var parties = String(chemin || '').split('/');
    return parties.length === 4 && parties[0] === 'evenements' && /^\d{4}$/.test(parties[1]) && /^\d{2}$/.test(parties[2]) && /\.enc$/.test(parties[3]) && !parties.some(function (p) { return !p || p === '..' || p === '.'; }) ? parties : null;
  }

  /**
   * Met un fichier de saisie à l'écart dans quarantaine/AAAA/MM (copie relue, puis retrait du dossier
   * en service). Rien n'est supprimé : la DSI peut l'examiner ou le restaurer.
   */
  Dossier.prototype.mettreEnQuarantaine = async function (chemin) {
    var parties = cheminSur(chemin);
    if (!parties) throw new Error('Chemin de fichier inattendu : ' + chemin);
    var source = await this.sousDossier(parties.slice(0, 3), false), nom = parties[3];
    var octets = await this.lireFichier(source, nom);
    if (!octets) throw new Error('Fichier introuvable : ' + chemin);
    var dest = await this.sousDossier(['quarantaine', parties[1], parties[2]], true);
    await this.ecrireFichier(dest, nom, octets);
    var relu = await this.lireFichier(dest, nom);
    if (!relu || relu.length !== octets.length) throw new Error('La copie en quarantaine n’a pas pu être vérifiée : le fichier est laissé en place.');
    await source.removeEntry(nom);
    return 'quarantaine/' + parties[1] + '/' + parties[2] + '/' + nom;
  };

  /**
   * Réparation depuis une copie de sauvegarde complète : ne remet que les fichiers de saisie absents du
   * dossier en service ou illisibles (`illisibles` : Set de noms), jamais un fichier présent et lisible.
   * `verifier(nom, octets)` doit confirmer que le fichier de la copie s'ouvre avec la clé actuelle.
   * Un fichier illisible remplacé est d'abord mis en quarantaine.
   * Retourne { remis: [chemin], invalides: [chemin], dejaPresents: n }.
   */
  Dossier.prototype.reparerDepuisCopie = async function (copie, illisibles, verifier) {
    if (!copie || copie.format !== 'SIC-sauvegarde' || !Array.isArray(copie.fichiers)) throw new Error('Ce fichier n’est pas une copie de sauvegarde de l’outil.');
    var presents = await this.nomsEvenements(), res = { remis: [], invalides: [], dejaPresents: 0 };
    illisibles = illisibles || new Set();
    for (var i = 0; i < copie.fichiers.length; i++) {
      var f = copie.fichiers[i], parties = cheminSur(f.chemin);
      if (!parties) continue;
      var nom = parties[3];
      if (presents.has(nom) && !illisibles.has(nom)) { res.dejaPresents++; continue; }
      var octets;
      try { octets = C.deb64(f.contenu); if (!(await verifier(nom, octets))) throw new Error('contenu inattendu'); }
      catch (e) { res.invalides.push(f.chemin); continue; }
      if (presents.has(nom)) { try { await this.mettreEnQuarantaine(f.chemin); } catch (e) { res.invalides.push(f.chemin); continue; } }
      var dir = await this.sousDossier(parties.slice(0, 3), true);
      await this.ecrireFichier(dir, nom, octets);
      res.remis.push(f.chemin);
    }
    return res;
  };

  /** Noms des fichiers de saisie présents sur le partage. */
  Dossier.prototype.nomsEvenements = async function () {
    var noms = new Set(), racine;
    try { racine = await this.sousDossier(['evenements'], false); } catch (e) { return noms; }
    for await (var an of racine.values()) {
      if (an.kind !== 'directory') continue;
      for await (var mois of an.values()) {
        if (mois.kind !== 'directory') continue;
        for await (var f of mois.values()) if (f.kind === 'file' && /\.enc$/.test(f.name)) noms.add(f.name);
      }
    }
    return noms;
  };

  // ------------------------------------------------------ Repères d'intégrité
  /** Repère d'un agent : nombre de ses saisies et identifiant de la dernière (chiffré). */
  Dossier.prototype.ecrireRepere = async function (cle, agent, repere) {
    var dir = await this.sousDossier(['reperes'], true), nom = agent.replace(/[^a-zA-Z0-9_-]/g, '_') + '.enc';
    await this.ecrireFichier(dir, nom, await C.chiffrerJSON(cle, Object.assign({ agent: agent }, repere), 'repere:' + nom));
  };

  /** Repère d'un agent, ou null (absent ou illisible). */
  Dossier.prototype.lireRepere = async function (cle, agent) {
    try {
      var dir = await this.sousDossier(['reperes'], false), nom = agent.replace(/[^a-zA-Z0-9_-]/g, '_') + '.enc';
      var o = await this.lireFichier(dir, nom);
      return o ? await C.dechiffrerJSON(cle, o, 'repere:' + nom) : null;
    } catch (e) { return null; }
  };

  Dossier.prototype.lireReperes = async function (cle) {
    var res = [], dir;
    try { dir = await this.sousDossier(['reperes'], false); } catch (e) { return res; }
    for await (var f of dir.values()) {
      if (f.kind !== 'file' || !/\.enc$/.test(f.name)) continue;
      try { res.push(await C.dechiffrerJSON(cle, await this.lireFichier(dir, f.name), 'repere:' + f.name)); }
      catch (e) { res.push({ agent: f.name.replace(/\.enc$/, ''), illisible: true }); }
    }
    return res;
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
          catch (err) { rejetsMois++; res.rejetes.push({ nom: nom, chemin: 'evenements/' + an.name + '/' + mois.name + '/' + nom, raison: err.message || String(err) }); }
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
