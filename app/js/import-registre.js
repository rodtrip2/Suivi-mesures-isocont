// SPDX-License-Identifier: EUPL-1.2
/*
 * Import générique à partir du registre du service (seul document obligatoirement numérique,
 * art. L. 3222-5-1 CSP), quel que soit l'outil d'origine. Fonction pure, testable sous Node.
 *
 * Une ligne du registre est une ENTRÉE (catégorie A à E), pas une mesure. Les mesures sont reconstituées :
 *  - A, B : isolement (A en chambre de soins intensifs, B hors CSI) ;
 *  - C : contention en CSI, qui implique l'isolement qui l'accompagne ;
 *  - D, E : contention hors espace d'isolement (E : exception prévue).
 * Les portions d'isolement contiguës d'un même patient (A, puis l'isolement d'une entrée C, puis A)
 * forment une seule mesure d'isolement, comme le compterait le juge. Chaque mesure garde les lignes
 * d'origine (numéro, catégorie, période, soignants) : si la numérotation est conservée, le registre
 * importé est reproduit à l'identique.
 * Le résultat a la même forme que l'import du classeur V1.3 (services, compteurs, contrôle, aperçu…).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xlsx.js'), require('./model.js'), require('./import-v13.js'));
  else (root.SIC = root.SIC || {}).importRegistre = factory(root.SIC.xlsx, root.SIC.model, root.SIC.importV13);
})(typeof self !== 'undefined' ? self : this, function (X, M, IV) {
  'use strict';

  var H = 3600 * 1000;
  var norm = IV.norm;

  /** Champs du modèle de registre : clé, libellé, obligatoire, synonymes reconnus dans les en-têtes. */
  var CHAMPS = [
    { cle: 'service', libelle: 'Service', aide: 'code du service (si absent : service choisi par défaut)', syn: ['service', 'unite', 'code service', 'uf'] },
    { cle: 'numero', libelle: 'Numéro d’entrée', aide: 'ex. A12, ou 12', syn: ['numero', 'n', 'no', 'num', 'numero registre', 'id registre', 'numero d entree', 'n registre', 'numero entree'] },
    { cle: 'categorie', libelle: 'Catégorie (A à E)', aide: 'A isolement CSI, B isolement hors CSI, C contention CSI, D/E contention hors espace d’isolement', syn: ['categorie', 'cat', 'type registre'] },
    { cle: 'type', libelle: 'Type de mesure', aide: 'Isolement ou Contention (déduit de la catégorie si absent)', syn: ['type', 'mesure', 'type de mesure', 'nature'] },
    { cle: 'identifiant', libelle: 'Identifiant du patient', obligatoire: true, aide: 'IPP ou identifiant du registre', syn: ['identifiant', 'ipp', 'identifiant patient', 'id patient', 'patient', 'n patient', 'numero patient'] },
    { cle: 'nom', libelle: 'Nom', aide: 'facultatif', syn: ['nom', 'nom patient'] },
    { cle: 'prenom', libelle: 'Prénom', aide: 'facultatif', syn: ['prenom'] },
    { cle: 'naissance', libelle: 'Date de naissance', aide: 'facultatif', syn: ['naissance', 'date de naissance', 'ne le', 'ddn'] },
    { cle: 'age', libelle: 'Âge', aide: 'contrôle seulement (la date de naissance reste à compléter)', syn: ['age'] },
    { cle: 'mode', libelle: 'Mode d’hospitalisation', aide: 'SDT, SDTU, SPI, SDRE, SL…', syn: ['mode', 'mode d hospitalisation', 'mode hospitalisation', 'statut', 'mode de soins'] },
    { cle: 'debut', libelle: 'Début (date et heure)', obligatoire: true, aide: 'ou date et heure dans deux colonnes', syn: ['debut', 'date debut', 'date et heure de debut', 'debut de la mesure', 'date heure debut', 'date de debut'] },
    { cle: 'heureDebut', libelle: 'Heure de début (si colonne séparée)', syn: ['heure debut', 'heure de debut'] },
    { cle: 'fin', libelle: 'Fin (date et heure)', aide: 'ou durée ; vide = en cours', syn: ['fin', 'date fin', 'date et heure de fin', 'fin de la mesure', 'date heure fin', 'date de fin'] },
    { cle: 'heureFin', libelle: 'Heure de fin (si colonne séparée)', syn: ['heure fin', 'heure de fin'] },
    { cle: 'duree', libelle: 'Durée (heures)', aide: 'utilisée si la fin manque', syn: ['duree', 'duree h', 'duree heures', 'duree en heures', 'duree de la mesure'] },
    { cle: 'lieu', libelle: 'Lieu', aide: 'nom de la CSI ou de la chambre', syn: ['lieu', 'chambre', 'nom du lieu', 'lieu de la mesure'] },
    { cle: 'csi', libelle: 'En chambre de soins intensifs (oui/non)', aide: 'déduit de la catégorie ou du lieu si absent', syn: ['csi', 'en csi', 'espace dedie', 'chambre d isolement', 'lieu csi autre'] },
    { cle: 'exception', libelle: 'Exception (contention hors espace d’isolement)', aide: 'oui/non ; déduit de la catégorie E si absent', syn: ['exception', 'exception csi', 'exception prevue'] },
    { cle: 'psychiatre', libelle: 'Psychiatre', syn: ['psychiatre', 'medecin', 'psychiatre decisionnaire', 'nom du psychiatre'] },
    { cle: 'professionnels', libelle: 'Professionnels chargés de la surveillance', aide: 'séparés par « ; », fonction entre parenthèses', syn: ['professionnels', 'soignants', 'surveillance', 'professionnels charges de la surveillance', 'professionnels de sante'] }
  ];

  /** Lecture d'un CSV (séparateur « ; », « , » ou tabulation, guillemets, BOM) en tableau de lignes. */
  function lireCSV(texte) {
    texte = String(texte || '').replace(/^﻿/, '');
    var premiere = texte.split(/\r?\n/)[0] || '';
    var sep = [';', '\t', ','].map(function (s) { return [s, premiere.split(s).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var lignes = [], ligne = [], champ = '', guillemets = false;
    for (var i = 0; i < texte.length; i++) {
      var c = texte[i];
      if (guillemets) {
        if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
        else if (c === '"') guillemets = false;
        else champ += c;
      } else if (c === '"') guillemets = true;
      else if (c === sep) { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texte[i + 1] === '\n') i++;
        ligne.push(champ); champ = '';
        if (ligne.some(function (x) { return x.trim() !== ''; })) lignes.push(ligne);
        ligne = [];
      } else champ += c;
    }
    ligne.push(champ);
    if (ligne.some(function (x) { return x.trim() !== ''; })) lignes.push(ligne);
    return lignes;
  }

  /** Repère la ligne d'en-tête (la première qui contient au moins deux champs connus) et propose les correspondances. */
  function deviner(lignes) {
    var meilleure = 0, score = -1;
    for (var i = 0; i < Math.min(lignes.length, 15); i++) {
      var n = (lignes[i] || []).filter(function (x) { return trouverChamp(x); }).length;
      if (n > score) { score = n; meilleure = i; }
    }
    var entetes = (lignes[meilleure] || []).map(function (x) { return x == null ? '' : String(x).trim(); });
    var correspondance = {}, pris = {};
    CHAMPS.forEach(function (c) {
      var j = entetes.findIndex(function (e, k) { return !pris[k] && c.syn.indexOf(norm(e)) >= 0; });
      if (j >= 0) { correspondance[c.cle] = j; pris[j] = true; }
    });
    return { ligneEntete: meilleure, entetes: entetes, correspondance: correspondance };
  }
  function trouverChamp(e) { var n = norm(e); return n && CHAMPS.some(function (c) { return c.syn.indexOf(n) >= 0; }); }

  function txt(v) { return v == null ? '' : String(v).trim(); }
  function oui(v) { return /^(oui|o|vrai|true|1|x|yes)$/i.test(txt(v)) || v === true; }
  function non(v) { return /^(non|n|faux|false|0|no)$/i.test(txt(v)) || v === false; }

  /** Date (et heure) : nombre Excel, JJ/MM/AAAA [HH:MM], AAAA-MM-JJ[ HH:MM], éventuellement complétée par une heure séparée. */
  function lireDate(v, heure) {
    var t = null;
    if (typeof v === 'number') t = X.serieVersDate(v);
    else if (v instanceof Date) t = v.getTime();
    else {
      var s = txt(v);
      t = X.valeurDate(s);
      if (t == null) {
        var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})[:h](\d{2}))?/.exec(s);
        if (m) t = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
      }
    }
    if (t == null) return null;
    if (heure != null && txt(heure) !== '') {
      var mn = null;
      if (typeof heure === 'number') mn = Math.round((heure % 1) * 1440);
      else { var mh = /(\d{1,2})[:h](\d{2})/.exec(txt(heure)); if (mh) mn = +mh[1] * 60 + +mh[2]; }
      if (mn != null) { var d = new Date(t); d.setHours(0, 0, 0, 0); t = d.getTime() + mn * 60000; }
    }
    return t;
  }
  function lireNombre(v) { if (typeof v === 'number') return v; var n = parseFloat(txt(v).replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(n) ? n : null; }
  function aleatoire() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }

  /**
   * Prépare l'import.
   * @param table     { lignes: [[...]], ligneEntete, correspondance: { champ: index de colonne } }
   * @param etat      état actuel (model.reduire)
   * @param options   { serviceParDefaut, maintenant, services (créer / rattacher / ignorer), corrections { 'L12': { csi, exception } } }
   */
  function preparer(table, etat, options) {
    options = options || {};
    var maintenant = options.maintenant || Date.now();
    var cor = table.correspondance || {}, corrections = options.corrections || {};
    var rapport = { patients: 0, patientsExistants: 0, mesures: 0, dejaPresentes: 0, cycles: 0, tiers: 0, modes: 0, professionnels: 0, ignorees: [], avertissements: [], entrees: 0, services: [] };
    var evts = [];
    function ajouter(type, data) { evts.push({ type: type, data: data }); }
    function val(l, cle) { return cor[cle] == null || cor[cle] === '' ? undefined : l[cor[cle]]; }
    if (cor.identifiant == null || cor.debut == null) throw new Error('Indiquez au moins les colonnes « Identifiant du patient » et « Début ».');
    if (cor.type == null && cor.categorie == null && cor.numero == null) throw new Error('Indiquez la colonne « Type de mesure » ou « Catégorie » (ou un numéro d’entrée qui commence par la catégorie).');

    // ---------------------------------------------------------------- Lecture des lignes
    var codesActuels = (etat.config.services || []).map(function (s) { return s.code; });
    var cites = {}, lignes = [];
    (table.lignes || []).forEach(function (l, i) {
      if (i <= (table.ligneEntete || 0)) return;
      if (!l || !l.some(function (x) { return txt(x) !== ''; })) return;
      var ref = 'L' + (i + 1), r = { ref: ref, ligne: i + 1 };
      var ident = txt(val(l, 'identifiant'));
      if (!ident) { rapport.ignorees.push('ligne ' + (i + 1) + ' : identifiant du patient manquant'); return; }
      var debut = lireDate(val(l, 'debut'), val(l, 'heureDebut'));
      if (!debut) { rapport.ignorees.push('ligne ' + (i + 1) + ' : date de début illisible'); return; }
      var fin = lireDate(val(l, 'fin'), val(l, 'heureFin'));
      var duree = lireNombre(val(l, 'duree'));
      if (!fin && duree != null && txt(val(l, 'fin')) === '') fin = debut + duree * H;
      if (fin && fin < debut) { rapport.ignorees.push('ligne ' + (i + 1) + ' : fin antérieure au début'); return; }
      var numero = txt(val(l, 'numero')).toUpperCase().replace(/\s+/g, '');
      var cat = txt(val(l, 'categorie')).toUpperCase().charAt(0);
      if (!/^[A-E]$/.test(cat)) cat = /^[A-E]/.test(numero) ? numero.charAt(0) : '';
      var typeTxt = norm(val(l, 'type'));
      var type = /^isol/.test(typeTxt) ? 'Isolement' : /^conten/.test(typeTxt) ? 'Contention' : cat ? (/[AB]/.test(cat) ? 'Isolement' : 'Contention') : '';
      if (!type) { rapport.ignorees.push('ligne ' + (i + 1) + ' : type de mesure inconnu (ni type ni catégorie)'); return; }
      var lieu = txt(val(l, 'lieu'));
      var csiCol = val(l, 'csi'), csi;
      if (txt(csiCol) !== '') csi = oui(csiCol) || /csi|soins intensifs|isolement/.test(norm(csiCol)) ? true : non(csiCol) || /autre|chambre/.test(norm(csiCol)) ? false : undefined;
      if (csi === undefined && cat) csi = /[AC]/.test(cat);
      if (csi === undefined) csi = /csi|soins intensifs|isolement/.test(norm(lieu)) || !/chambre/.test(norm(lieu));
      var exc = txt(val(l, 'exception')) !== '' ? oui(val(l, 'exception')) : cat === 'E';
      var notes = [], c = corrections[ref];
      if (c && typeof c.csi === 'boolean' && c.csi !== csi) { notes.push('lieu : ' + (csi ? 'CSI' : 'hors CSI') + ' → ' + (c.csi ? 'CSI' : 'hors CSI')); csi = c.csi; }
      if (c && typeof c.exception === 'boolean' && c.exception !== exc && type === 'Contention') { notes.push('exception : ' + (exc ? 'oui' : 'non') + ' → ' + (c.exception ? 'oui' : 'non')); exc = c.exception; }
      if (numero && /^\d+$/.test(numero) && cat) numero = cat + numero;
      if (cat && numero && numero.charAt(0) !== cat && /^[A-E]/.test(numero)) rapport.avertissements.push('ligne ' + (i + 1) + ' : catégorie ' + cat + ' et numéro ' + numero + ' incohérents.');
      var codeSv = txt(val(l, 'service'));
      if (codeSv && codesActuels.indexOf(codeSv) < 0) { cites[codeSv] = cites[codeSv] || { n: 0 }; cites[codeSv].n++; }
      r.service = codeSv; r.identifiant = ident; r.debut = debut; r.fin = fin || null; r.type = type; r.cat = cat; r.numero = numero;
      r.csi = !!csi; r.exception = type === 'Contention' && !csi && !!exc; r.lieu = lieu; r.correction = notes.length ? 'Corrigé à l’import : ' + notes.join(' ; ') : '';
      r.nom = txt(val(l, 'nom')); r.prenom = txt(val(l, 'prenom')); r.naissance = lireDate(val(l, 'naissance')); r.age = lireNombre(val(l, 'age'));
      r.mode = txt(val(l, 'mode')); r.psychiatre = txt(val(l, 'psychiatre')); r.professionnels = txt(val(l, 'professionnels')).replace(/\s*\n\s*/g, ' ; ');
      lignes.push(r);
      rapport.entrees++;
    });

    // ---------------------------------------------------------------- Services
    var choix = options.services || {}, servicesACreer = [], correspondanceSv = {};
    rapport.services = Object.keys(cites).map(function (code) {
      var ch = choix[code] || {}, action = ch.action === 'rattacher' && codesActuels.indexOf(ch.vers) >= 0 ? 'rattacher' : 'creer';
      var libelle = txt(ch.libelle) || code;
      if (action === 'creer') servicesACreer.push({ code: code, libelle: libelle }); else correspondanceSv[code] = ch.vers;
      return { code: code, libelle: libelle, actif: true, references: { 'lignes du registre': cites[code].n }, total: cites[code].n, action: action, vers: action === 'rattacher' ? ch.vers : '' };
    });
    var svDefaut = options.serviceParDefaut || codesActuels[0] || (servicesACreer[0] || {}).code;
    if (!svDefaut) throw new Error('Aucun service : créez un service ou indiquez la colonne « Service ».');
    lignes.forEach(function (r) { r.service = correspondanceSv[r.service] || r.service || svDefaut; });

    // ---------------------------------------------------------------- Patients
    var parIdent = {};
    Object.keys(etat.patients).forEach(function (k) { var p = etat.patients[k]; if (p.ipp) parIdent[p.ipp] = { id: p.id, existant: true }; });
    var dernierMode = {};
    lignes.sort(function (a, b) { return a.debut - b.debut; });
    lignes.forEach(function (r) {
      if (!parIdent[r.identifiant]) {
        var id = 'P' + aleatoire();
        ajouter('PATIENT', { patientId: id, ipp: r.identifiant, nom: (r.nom || 'REGISTRE ' + r.identifiant).toUpperCase(), prenom: r.prenom, naissance: r.naissance ? M.dateLocaleISO(r.naissance) : '', protection: '', service: r.service });
        parIdent[r.identifiant] = { id: id, existant: false };
        rapport.patients++;
        if (!r.naissance) rapport.avertissements.push('Patient ' + r.identifiant + ' : date de naissance à compléter' + (r.age != null ? ' (âge indiqué dans le registre : ' + r.age + ' ans)' : '') + '.');
      } else if (parIdent[r.identifiant].existant && !parIdent[r.identifiant].compte) { parIdent[r.identifiant].compte = true; rapport.patientsExistants++; }
      r.patientId = parIdent[r.identifiant].id;
      if (r.mode && dernierMode[r.patientId] !== r.mode && !parIdent[r.identifiant].existant) {
        ajouter('MODE_HOSPI', { patientId: r.patientId, mode: r.mode, date: dernierMode[r.patientId] ? r.debut : r.debut - H });
        dernierMode[r.patientId] = r.mode; rapport.modes++;
      }
    });

    // ---------------------------------------------------------------- Mesures reconstituées
    var deja = {};
    M.listeMesures(etat).forEach(function (m) { var p = etat.patients[m.patientId]; deja[(p ? p.ipp : m.patientId) + '|' + m.type + '|' + m.debut] = true; });
    var refs = {}, numeros = {}, derniers = {};
    function origineDe(r) { return { numero: r.numero, categorie: r.cat || (r.type === 'Isolement' ? (r.csi ? 'A' : 'B') : (r.csi ? 'C' : (r.exception ? 'E' : 'D'))), debut: r.debut, fin: r.fin, professionnels: r.professionnels, ref: r.ref }; }
    // Isolements : lignes A/B et isolement accompagnant une contention en CSI (C), fusionnés s'ils se touchent.
    var morceaux = [];
    lignes.forEach(function (r) {
      if (r.type === 'Isolement') morceaux.push({ r: r, debut: r.debut, fin: r.fin, csi: r.csi, origine: r.numero || r.cat ? origineDe(r) : null });
      else if (r.csi) morceaux.push({ r: r, debut: r.debut, fin: r.fin, csi: true, origine: null, implicite: true });
    });
    var groupes = {};
    morceaux.forEach(function (x) { var k = x.r.patientId + '|' + x.r.service + '|' + x.csi; (groupes[k] = groupes[k] || []).push(x); });
    var mesures = [];
    Object.keys(groupes).forEach(function (k) {
      var g = groupes[k].sort(function (a, b) { return a.debut - b.debut; }), cur = null;
      g.forEach(function (x) {
        var fx = x.fin == null ? Infinity : x.fin;
        if (cur && x.debut <= cur.finCalc) { cur.morceaux.push(x); if (fx > cur.finCalc) cur.finCalc = fx; }
        else { cur = { type: 'Isolement', morceaux: [x], debut: x.debut, finCalc: fx }; mesures.push(cur); }
      });
    });
    lignes.forEach(function (r) { if (r.type === 'Contention') mesures.push({ type: 'Contention', morceaux: [{ r: r, debut: r.debut, fin: r.fin, origine: r.numero || r.cat ? origineDe(r) : null }], debut: r.debut, finCalc: r.fin == null ? Infinity : r.fin }); });
    mesures.sort(function (a, b) { return a.debut - b.debut; });

    mesures.forEach(function (ms) {
      var principal = ms.morceaux.filter(function (x) { return !x.implicite; })[0] || ms.morceaux[0], r = principal.r;
      if (deja[r.identifiant + '|' + ms.type + '|' + ms.debut]) { rapport.dejaPresentes++; return; }
      deja[r.identifiant + '|' + ms.type + '|' + ms.debut] = true;
      var origines = ms.morceaux.map(function (x) { return x.origine; }).filter(Boolean);
      var mesureId = 'R' + aleatoire(), fin = ms.finCalc === Infinity ? null : ms.finCalc;
      var refsMesure = ms.morceaux.filter(function (x) { return !x.implicite; }).map(function (x) { return x.r.ref; });
      var pros = [];
      ms.morceaux.forEach(function (x) { (x.r.professionnels || '').split(/\s*;\s*/).forEach(function (p) { if (p && pros.indexOf(p) < 0 && !x.implicite) pros.push(p); }); });
      var lieu = r.lieu || (r.csi ? 'CSI' : 'Hors CSI');
      ajouter('MESURE_DEBUT', {
        mesureId: mesureId, patientId: r.patientId, service: r.service, typeMesure: ms.type, debut: ms.debut,
        lieu: r.csi ? lieu : (/^chambre/i.test(lieu) || lieu === 'Hors CSI' ? lieu : 'Chambre ' + lieu), csi: ms.type === 'Isolement' ? principal.csi : r.csi, exception: ms.type === 'Contention' && r.exception,
        psychiatre: r.psychiatre, origine: 'Registre importé — ' + (refsMesure.join(', ') || 'isolement d’une contention en CSI (' + ms.morceaux[0].r.ref + ')'),
        numeroOrigine: origines.length ? origines[0].numero || '' : '', entreesOrigine: origines.length ? origines : null,
        professionnelsOrigine: pros.join(' ; '), correctionImport: ms.morceaux.map(function (x) { return x.r.correction; }).filter(Boolean).join(' ; ')
      });
      if (fin) ajouter('MESURE_FIN', { mesureId: mesureId, fin: fin, psychiatre: r.psychiatre });
      rapport.mesures++;
      refsMesure.forEach(function (rf) { refs[rf] = mesureId; });
      if (refsMesure.length) refs[refsMesure[0]] = mesureId;
      origines.forEach(function (o) {
        var an = new Date(o.debut).getFullYear(), k = r.service + '|' + an, n = /(\d+)$/.exec(o.numero || '');
        if (o.numero) numeros[k] = (numeros[k] || 0) + 1;
        if (n) { derniers[k] = Math.max(derniers[k] || 0, +n[1]); }
      });
      if (ms.morceaux.length > 1) rapport.avertissements.push('Patient ' + r.identifiant + ' : ' + ms.morceaux.length + ' portions contiguës regroupées en une mesure d’' + ms.type.toLowerCase() + ' débutant le ' + new Date(ms.debut).toLocaleString('fr-FR') + '.');
    });

    // Compteurs : par service et par année, le plus grand numéro du registre importé
    var compteurs = Object.keys(derniers).map(function (k) { var x = k.split('|'); return { service: x[0], annee: +x[1], dernier: derniers[k], mesuresNumerotees: numeros[k] || 0 }; });
    var anneesNumerotees = Object.keys(numeros).map(function (k) { var x = k.split('|'); return { service: x[0], annee: +x[1], mesures: numeros[k] }; });
    var prep = { source: 'registre', evenements: evts, config: [], rapport: rapport, attendus: [], compteurs: compteurs, servicesACreer: servicesACreer, etatAvant: etat, maintenant: maintenant, anneesNumerotees: anneesNumerotees, refs: refs, corrections: corrections };
    var sim = IV.simuler(prep, {}, {});
    compteurs.forEach(function (c) {
      c.entreesNumerotees = M.registre(sim, c.service, c.annee, maintenant).filter(function (e) { return e.fin !== null && (sim.mesures[e.mesureId] || {}).numeroOrigine; }).length;
      c.propose = Math.max(0, c.dernier - c.entreesNumerotees);
      c.existantes = M.listeMesures(etat).some(function (m) { return m.service === c.service && new Date(m.debut).getFullYear() === c.annee; });
    });
    return prep;
  }

  /** Modèle de registre à remplir (CSV, séparateur « ; »), avec deux lignes d'exemple fictives. */
  function modeleCSV() {
    var entetes = ['Service', 'Numéro', 'Catégorie', 'Type', 'Identifiant patient', 'Nom', 'Prénom', 'Date de naissance', 'Âge', "Mode d'hospitalisation",
      'Début', 'Fin', 'Durée (h)', 'Lieu', 'En CSI', 'Exception', 'Psychiatre', 'Professionnels chargés de la surveillance'];
    var ex = [
      ['U1', 'A1', 'A', 'Isolement', '000001', 'EXEMPLE (fictif)', 'Camille', '12/05/1990', '35', 'SDT', '02/01/2026 08:00', '02/01/2026 12:00', '', 'CSI 1', 'oui', 'non', 'Dr Exemple (fictif)', 'Agent A (fictif) (IDE) ; Agent B (fictif) (AS)'],
      ['U1', 'C2', 'C', 'Contention', '000001', 'EXEMPLE (fictif)', 'Camille', '12/05/1990', '35', 'SDT', '02/01/2026 12:00', '02/01/2026 18:00', '', 'CSI 1', 'oui', 'non', 'Dr Exemple (fictif)', 'Agent A (fictif) (IDE)'],
      ['U1', 'A3', 'A', 'Isolement', '000001', 'EXEMPLE (fictif)', 'Camille', '12/05/1990', '35', 'SDT', '02/01/2026 18:00', '', '4', 'CSI 1', 'oui', 'non', 'Dr Exemple (fictif)', 'Agent C (fictif) (IDE)']
    ];
    return '﻿' + [entetes].concat(ex).map(function (l) { return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
  }

  return { CHAMPS: CHAMPS, lireCSV: lireCSV, deviner: deviner, lireDate: lireDate, preparer: preparer, modeleCSV: modeleCSV };
});
