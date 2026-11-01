// SPDX-License-Identifier: EUPL-1.2
/*
 * Écriture de documents PDF sans bibliothèque externe : pages A4, texte (polices standard Helvetica,
 * codage WinAnsi : accents français, « », ’, –, €…), filets, aplats de couleur, image JPEG de fond.
 * Mise en page simple : flux de paragraphes et tableaux avec retour à la ligne et saut de page.
 * Utilisable dans le navigateur (SIC.pdf) et dans Node (tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SIC = root.SIC || {}).pdf = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MM = 72 / 25.4;
  var A4 = { l: 595.28, h: 841.89 };

  // Chasses Helvetica (unités de 1/1000), caractères 32 à 126 ; les lettres accentuées prennent la chasse de leur lettre de base.
  var CHASSE = {
    R: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
    B: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]
  };
  var SPECIAUX = { '€': [0x80, 556], '‚': [0x82, 278], '„': [0x84, 500], '…': [0x85, 1000], '‰': [0x89, 1000], 'Œ': [0x8C, 1000], '‘': [0x91, 222], '’': [0x92, 222],
    '“': [0x93, 333], '”': [0x94, 333], '•': [0x95, 350], '–': [0x96, 556], '—': [0x97, 1000], '™': [0x99, 1000], 'œ': [0x9C, 944], 'Ÿ': [0x9F, 667], '«': [0xAB, 556], '»': [0xBB, 556],
    '°': [0xB0, 400], '·': [0xB7, 278], '×': [0xD7, 584], ' ': [0xA0, 278], ' ': [0xA0, 278], '≥': [0x3E, 584], '≤': [0x3C, 584], '→': [0x3E, 584], '✓': [0x76, 556] };
  var BASES = 'ÀÁÂÃÄÅAÇCÈÉÊËEÌÍÎÏIÑNÒÓÔÕÖØOÙÚÛÜUÝYàáâãäåaçcèéêëeìíîïiñnòóôõöøoùúûüuýÿy';

  function base(ch) {
    var i = BASES.indexOf(ch);
    if (i < 0) return null;
    for (var j = i; j < BASES.length; j++) if (/[A-Za-z]/.test(BASES[j])) return BASES[j];
    return null;
  }

  /** Code WinAnsi et chasse d'un caractère. */
  function glyphe(ch, gras) {
    var t = CHASSE[gras ? 'B' : 'R'], c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) return [c, t[c - 32]];
    if (SPECIAUX[ch]) return SPECIAUX[ch];
    if (c >= 0xA0 && c <= 0xFF) { var b = base(ch); return [c, b ? t[b.charCodeAt(0) - 32] : 556]; }
    if (ch === '\t') return [32, t[0]];
    return [63, t[63 - 32]];   // « ? » pour un caractère non représentable
  }

  /** Largeur d'un texte en points. */
  function largeur(texte, taille, gras) {
    var s = 0;
    for (var i = 0; i < texte.length; i++) s += glyphe(texte[i], gras)[1];
    return s * taille / 1000;
  }

  /** Texte codé pour un flux PDF (chaîne d'octets, parenthèses et barres obliques protégées). */
  function code(texte, gras) {
    var r = '';
    for (var i = 0; i < texte.length; i++) {
      var o = glyphe(texte[i], gras)[0];
      r += o === 40 || o === 41 || o === 92 ? '\\' + String.fromCharCode(o) : String.fromCharCode(o);
    }
    return r;
  }

  /** Coupe un texte en lignes d'au plus `max` points (respecte les retours à la ligne). */
  function couper(texte, taille, gras, max) {
    var res = [];
    String(texte == null ? '' : texte).split('\n').forEach(function (para) {
      var mots = para.split(/ +/), ligne = '';
      mots.forEach(function (mot) {
        var essai = ligne ? ligne + ' ' + mot : mot;
        if (largeur(essai, taille, gras) <= max || !ligne) {
          // Mot plus long que la ligne : coupé de force
          while (largeur(essai, taille, gras) > max && essai.length > 1) {
            var k = essai.length;
            while (k > 1 && largeur(essai.slice(0, k), taille, gras) > max) k--;
            res.push(essai.slice(0, k)); essai = essai.slice(k);
          }
          ligne = essai;
        } else { res.push(ligne); ligne = mot; }
      });
      res.push(ligne);
    });
    return res;
  }

  function num(v) { return (Math.round(v * 100) / 100).toString(); }
  function couleur(c) { return c ? c.map(num).join(' ') : '0 0 0'; }

  /** Dimensions et composantes d'une image JPEG (marqueur SOF). */
  function infoJPEG(o) {
    if (o[0] !== 0xFF || o[1] !== 0xD8) throw new Error('Image JPEG attendue.');
    var i = 2;
    while (i < o.length) {
      if (o[i] !== 0xFF) { i++; continue; }
      var mk = o[i + 1], lg = (o[i + 2] << 8) | o[i + 3];
      if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) return { h: (o[i + 5] << 8) | o[i + 6], l: (o[i + 7] << 8) | o[i + 8], comp: o[i + 9] };
      i += 2 + lg;
    }
    throw new Error('Image JPEG illisible.');
  }

  function base64(s) {
    if (typeof atob === 'function') { var b = atob(s), o = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
    return new Uint8Array(Buffer.from(s, 'base64'));
  }

  /**
   * Document PDF. `options` : { titre, auteur, marges: { haut, droite, bas, gauche } (mm), fond: data URL JPEG,
   * fondPages: 'toutes' | 'premiere', piedDePage: fonction (n, total) → texte }.
   */
  function Document(options) {
    this.o = options || {};
    var m = this.o.marges || { haut: 15, droite: 15, bas: 15, gauche: 15 };
    this.mg = { h: m.haut * MM, d: m.droite * MM, b: m.bas * MM, g: m.gauche * MM };
    this.largeurUtile = A4.l - this.mg.g - this.mg.d;
    this.pages = [];
    this.image = null;
    if (this.o.fond) {
      var o = base64(String(this.o.fond).replace(/^data:[^,]*,/, ''));
      this.image = { octets: o, info: infoJPEG(o) };
    }
    this.nouvellePage();
  }

  Document.prototype.nouvellePage = function () {
    this.page = { ops: [] };
    this.pages.push(this.page);
    if (this.image && (this.o.fondPages !== 'premiere' || this.pages.length === 1)) this.page.ops.push('q ' + num(A4.l) + ' 0 0 ' + num(A4.h) + ' 0 0 cm /Fond Do Q');
    this.y = A4.h - this.mg.h;
  };

  /** Réserve `hauteur` points ; saute de page si nécessaire. Retourne vrai si une page a été ajoutée. */
  Document.prototype.place = function (hauteur) {
    if (this.y - hauteur < this.mg.b && this.y < A4.h - this.mg.h - 1) { this.nouvellePage(); return true; }
    return false;
  };

  Document.prototype.texte = function (x, y, t, taille, style, rgb) {
    var gras = style === 'gras', police = gras ? '/F2' : style === 'italique' ? '/F3' : '/F1';
    this.page.ops.push('BT ' + couleur(rgb) + ' rg ' + police + ' ' + num(taille) + ' Tf ' + num(x) + ' ' + num(y) + ' Td (' + code(t, gras) + ') Tj ET');
  };
  Document.prototype.rect = function (x, y, l, h, fond, trait, pointille) {
    var op = 'q ';
    if (fond) op += couleur(fond) + ' rg ';
    if (trait) op += couleur(trait) + ' RG 0.5 w ' + (pointille ? '[2 2] 0 d ' : '');
    op += num(x) + ' ' + num(y) + ' ' + num(l) + ' ' + num(h) + ' re ' + (fond && trait ? 'B' : fond ? 'f' : 'S') + ' Q';
    this.page.ops.push(op);
  };
  Document.prototype.filet = function (x1, y1, x2, y2, rgb, ep) {
    this.page.ops.push('q ' + couleur(rgb || [0.6, 0.6, 0.6]) + ' RG ' + num(ep || 0.5) + ' w ' + num(x1) + ' ' + num(y1) + ' m ' + num(x2) + ' ' + num(y2) + ' l S Q');
  };

  /**
   * Paragraphe dans le flux. `o` : { taille, style, rgb, aligne: 'gauche'|'droite'|'centre', x, largeur, avant, apres, cadre }.
   */
  Document.prototype.paragraphe = function (t, o) {
    o = o || {};
    var taille = o.taille || 9, gras = o.style === 'gras', inter = taille * 1.3;
    var x0 = o.x != null ? o.x : this.mg.g, l = o.largeur || this.largeurUtile;
    var lignes = couper(t, taille, gras, l - (o.cadre ? 8 : 0));
    this.y -= o.avant || 0;
    var self = this;
    if (o.cadre) {
      this.place(lignes.length * inter + 6);
      this.rect(x0, this.y - lignes.length * inter - 4, l, lignes.length * inter + 4, o.fond || null, [0.1, 0.1, 0.1]);
      this.y -= 2;
    }
    lignes.forEach(function (ligne) {
      self.place(inter);
      var lg = largeur(ligne, taille, gras), x = o.aligne === 'droite' ? x0 + l - lg - (o.cadre ? 4 : 0) : o.aligne === 'centre' ? x0 + (l - lg) / 2 : x0 + (o.cadre ? 4 : 0);
      self.texte(x, self.y - taille, ligne, taille, o.style, o.rgb);
      self.y -= inter;
    });
    this.y -= (o.apres != null ? o.apres : 3) + (o.cadre ? 2 : 0);
  };

  /** Liste à puces. */
  Document.prototype.liste = function (items, taille) {
    var self = this;
    items.forEach(function (t) {
      var lignes = couper(t, taille || 9, false, self.largeurUtile - 12), inter = (taille || 9) * 1.3;
      lignes.forEach(function (l, i) {
        self.place(inter);
        if (!i) self.texte(self.mg.g + 2, self.y - (taille || 9), '•', taille || 9);
        self.texte(self.mg.g + 12, self.y - (taille || 9), l, taille || 9);
        self.y -= inter;
      });
    });
    this.y -= 3;
  };

  /**
   * Tableau. `o` : { entetes: [], lignes: [[]], poids: [] (largeurs relatives), taille, styles: fonction(i) →
   * { fond, rgb, style, pointille } pour la ligne i, enteteRepete: vrai, colonneGrasse: index }.
   */
  Document.prototype.tableau = function (o) {
    var self = this, taille = o.taille || 8, inter = taille * 1.25, pad = 3;
    var total = o.poids.reduce(function (s, x) { return s + x; }, 0);
    var larg = o.poids.map(function (p) { return p / total * self.largeurUtile; });
    function hauteurLigne(cells, gras) {
      return Math.max.apply(null, cells.map(function (c, j) { return couper(c, taille, gras || (o.colonneGrasse === j), larg[j] - 2 * pad).length; })) * inter + 2 * pad;
    }
    function dessiner(cells, st) {
      st = st || {};
      var hl = hauteurLigne(cells, st.style === 'gras'), x = self.mg.g;
      self.rect(self.mg.g, self.y - hl, self.largeurUtile, hl, st.fond || null, null);
      cells.forEach(function (c, j) {
        var gras = st.style === 'gras' || o.colonneGrasse === j;
        couper(c, taille, gras, larg[j] - 2 * pad).forEach(function (l, k) {
          self.texte(x + pad, self.y - pad - taille - k * inter + 1, l, taille, gras ? 'gras' : st.style, st.rgb);
        });
        self.rect(x, self.y - hl, larg[j], hl, null, st.trait || [0.55, 0.55, 0.55], st.pointille);
        x += larg[j];
      });
      self.y -= hl;
    }
    var styleEntete = { fond: [0.9, 0.9, 0.9], style: 'gras' };
    if (o.entetes) { this.place(hauteurLigne(o.entetes, true) + hauteurLigne(o.lignes[0] || [''])); dessiner(o.entetes, styleEntete); }
    o.lignes.forEach(function (cells, i) {
      if (self.place(hauteurLigne(cells)) && o.entetes && o.enteteRepete !== false) dessiner(o.entetes, styleEntete);
      dessiner(cells, o.styles ? o.styles(i) : null);
    });
    this.y -= 6;
  };

  /** Octets du fichier PDF. */
  Document.prototype.octets = function () {
    var self = this, objets = [], n = this.pages.length;
    function obj(contenu) { objets.push(contenu); return objets.length; }
    var catalogue = obj(null), pagesId = obj(null);
    var f1 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var f2 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var f3 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    var imgId = null;
    if (this.image) {
      var inf = this.image.info;
      imgId = obj({ entete: '<< /Type /XObject /Subtype /Image /Width ' + inf.l + ' /Height ' + inf.h + ' /ColorSpace /' + (inf.comp === 1 ? 'DeviceGray' : inf.comp === 4 ? 'DeviceCMYK' : 'DeviceRGB') + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + this.image.octets.length + ' >>', flux: this.image.octets });
    }
    var ressources = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R /F3 ' + f3 + ' 0 R >>' + (imgId ? ' /XObject << /Fond ' + imgId + ' 0 R >>' : '') + ' >>';
    var idsPages = [];
    this.pages.forEach(function (p, i) {
      var ops = p.ops.slice();
      if (self.o.piedDePage) {
        var t = self.o.piedDePage(i + 1, n), lg = largeur(t, 7, false);
        ops.push('BT 0.35 0.35 0.35 rg /F1 7 Tf ' + num(A4.l - self.mg.d - lg) + ' ' + num(Math.max(10, self.mg.b / 2 - 3)) + ' Td (' + code(t, false) + ') Tj ET');
      }
      var flux = ops.join('\n');
      var c = obj({ entete: '<< /Length ' + flux.length + ' >>', flux: flux });
      idsPages.push(obj('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + num(A4.l) + ' ' + num(A4.h) + '] /Resources ' + ressources + ' /Contents ' + c + ' 0 R >>'));
    });
    objets[catalogue - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
    objets[pagesId - 1] = '<< /Type /Pages /Kids [' + idsPages.map(function (i) { return i + ' 0 R'; }).join(' ') + '] /Count ' + n + ' >>';
    function dateP(d) { var p = function (x) { return String(x).padStart(2, '0'); }; return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
    var info = obj('<< /Title (' + code(this.o.titre || 'Document', false) + ') /Author (' + code(this.o.auteur || '', false) + ') /Producer (Suivi-mesures-isocont) /CreationDate (' + dateP(new Date()) + ') >>');

    // Assemblage : chaînes d'octets (codes 0-255) et flux binaires, avec la table des positions.
    var morceaux = [], pos = 0, positions = [];
    function ajouter(x) {
      var o = typeof x === 'string' ? Uint8Array.from(x, function (ch) { return ch.charCodeAt(0) & 0xFF; }) : x;
      morceaux.push(o); pos += o.length;
    }
    ajouter('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objets.forEach(function (o, i) {
      positions.push(pos);
      ajouter((i + 1) + ' 0 obj\n');
      if (typeof o === 'string') ajouter(o + '\n');
      else { ajouter(o.entete + '\nstream\n'); ajouter(o.flux); ajouter('\nendstream\n'); }
      ajouter('endobj\n');
    });
    var xref = pos;
    ajouter('xref\n0 ' + (objets.length + 1) + '\n0000000000 65535 f \n' + positions.map(function (p) { return String(p).padStart(10, '0') + ' 00000 n \n'; }).join(''));
    ajouter('trailer\n<< /Size ' + (objets.length + 1) + ' /Root ' + catalogue + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var res = new Uint8Array(pos), k = 0;
    morceaux.forEach(function (m) { res.set(m, k); k += m.length; });
    return res;
  };

  return { Document: Document, largeur: largeur, couper: couper, infoJPEG: infoJPEG, MM: MM, A4: A4 };
});
