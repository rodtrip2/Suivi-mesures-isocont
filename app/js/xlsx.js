// SPDX-License-Identifier: EUPL-1.2
/*
 * Lecteur minimal de classeurs Excel (.xlsx / .xlsm), sans bibliothèque :
 * archive ZIP lue à la main, décompression par DecompressionStream
 * (navigateur et Node ≥ 18), XML lu par expressions régulières.
 * Renvoie les valeurs brutes des cellules (texte, nombre, booléen) ;
 * les dates Excel restent des nombres de série, convertis par serieVersDate().
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SIC = root.SIC || {}).xlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var dec = new TextDecoder();

  async function inflate(octets) {
    var flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  }

  /** Table des fichiers d'une archive ZIP : { nom: fonction async → Uint8Array }. */
  function lireZip(buf) {
    var u = new Uint8Array(buf), v = new DataView(u.buffer, u.byteOffset, u.byteLength);
    var fin = -1;
    for (var i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    }
    if (fin < 0) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx ou .xlsm).");
    var n = v.getUint16(fin + 10, true), p = v.getUint32(fin + 16, true), fichiers = {};
    for (var k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Archive endommagée.');
      var methode = v.getUint16(p + 10, true), taille = v.getUint32(p + 20, true);
      var ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true);
      var local = v.getUint32(p + 42, true);
      var nom = dec.decode(u.subarray(p + 46, p + 46 + ln));
      (function (methode, taille, local) {
        fichiers[nom] = async function () {
          var debut = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
          var brut = u.subarray(debut, debut + taille);
          if (methode === 0) return brut;
          if (methode === 8) return inflate(brut);
          throw new Error('Compression non prise en charge (' + methode + ').');
        };
      })(methode, taille, local);
      p += 46 + ln + le + lc;
    }
    return fichiers;
  }

  function entites(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(+d); })
      .replace(/&amp;/g, '&');
  }

  function attr(balise, nom) {
    var m = new RegExp('\\s' + nom + '="([^"]*)"').exec(balise);
    return m ? entites(m[1]) : null;
  }

  function texteDe(xml) {
    var t = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g, m;
    while ((m = re.exec(xml))) t += m[1] ? entites(m[1]) : '';
    return t;
  }

  function colonne(ref) {
    var c = 0, lettres = /^[A-Z]+/.exec(ref)[0];
    for (var i = 0; i < lettres.length; i++) c = c * 26 + lettres.charCodeAt(i) - 64;
    return c - 1;
  }

  function lireFeuille(xml, partages) {
    var lignes = [], reL = /<row\b([^>]*)>([\s\S]*?)<\/row>/g, mL;
    while ((mL = reL.exec(xml))) {
      var r = +attr(mL[1], 'r') - 1, ligne = [];
      var reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mC;
      while ((mC = reC.exec(mL[2]))) {
        var ref = attr(mC[1], 'r'), t = attr(mC[1], 't'), corps = mC[2] || '', val = null;
        var mv = /<v>([\s\S]*?)<\/v>/.exec(corps);
        if (t === 's') val = mv ? partages[+mv[1]] : null;
        else if (t === 'inlineStr') val = texteDe(corps);
        else if (t === 'str' || t === 'e') val = mv ? entites(mv[1]) : null;
        else if (t === 'b') val = mv ? mv[1] === '1' : null;
        else val = mv ? +mv[1] : null;
        if (val !== null && val !== '') ligne[ref ? colonne(ref) : ligne.length] = val;
      }
      lignes[r] = ligne;
    }
    for (var i = 0; i < lignes.length; i++) if (!lignes[i]) lignes[i] = [];
    return lignes;
  }

  /** Lit un classeur : { feuilles: { nom: [[valeurs]] } }. */
  async function lire(buf) {
    var z = lireZip(buf);
    var lireTexte = async function (n) { return z[n] ? dec.decode(await z[n]()) : ''; };
    var classeur = await lireTexte('xl/workbook.xml');
    if (!classeur) throw new Error('Classeur Excel non reconnu.');
    var liens = {}, rels = await lireTexte('xl/_rels/workbook.xml.rels'), m;
    var reR = /<Relationship\b([^>]*)\/?>/g;
    while ((m = reR.exec(rels))) {
      var cible = attr(m[1], 'Target');
      liens[attr(m[1], 'Id')] = cible.charAt(0) === '/' ? cible.slice(1) : 'xl/' + cible.replace(/^\.\//, '');
    }
    var partages = [], ss = await lireTexte('xl/sharedStrings.xml'), reS = /<si>([\s\S]*?)<\/si>/g;
    while ((m = reS.exec(ss))) partages.push(texteDe(m[1]));
    var feuilles = {}, reF = /<sheet\b([^>]*)\/?>/g;
    while ((m = reF.exec(classeur))) {
      var nom = attr(m[1], 'name'), cheminF = liens[attr(m[1], 'r:id')];
      if (cheminF && z[cheminF]) feuilles[nom] = lireFeuille(await lireTexte(cheminF), partages);
    }
    return { feuilles: feuilles };
  }

  /** Nombre de série Excel (système 1900) → horodatage, en heure locale. */
  function serieVersDate(x) {
    if (typeof x !== 'number' || !isFinite(x) || x <= 0) return null;
    var jours = Math.floor(x), ms = Math.round((x - jours) * 86400000);
    return new Date(1899, 11, 30 + jours, 0, 0, 0, ms).getTime();
  }

  /** Date Excel ou texte « JJ/MM/AAAA [HH:MM] » → horodatage local (ou null). */
  function valeurDate(v) {
    if (typeof v === 'number') return serieVersDate(v);
    if (typeof v !== 'string') return null;
    var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T]+(\d{1,2})[:h](\d{2})(?::(\d{2}))?)?\s*$/.exec(v);
    if (!m) return null;
    var an = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(an, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  }

  /** Transforme une feuille en objets à partir de sa ligne d'en-tête. */
  function enObjets(lignes, ligneEntete) {
    ligneEntete = ligneEntete || 0;
    var entetes = (lignes[ligneEntete] || []).map(function (x) { return x == null ? '' : String(x).trim(); });
    var res = [];
    for (var i = ligneEntete + 1; i < lignes.length; i++) {
      var l = lignes[i], o = {}, vide = true;
      entetes.forEach(function (e, j) { if (e) { o[e] = l[j]; if (l[j] != null && l[j] !== '') vide = false; } });
      if (!vide) { o._ligne = i + 1; res.push(o); }
    }
    return res;
  }

  return { lire: lire, lireZip: lireZip, serieVersDate: serieVersDate, valeurDate: valeurDate, enObjets: enObjets };
});
