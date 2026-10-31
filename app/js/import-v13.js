// SPDX-License-Identifier: EUPL-1.2
/*
 * Import du classeur Excel/VBA V1.3 (Suivi_Isolement_Contention).
 * Fonction pure : à partir des feuilles lues par xlsx.js et de l'état actuel,
 * produit les saisies à enregistrer (en un seul lot), le paramétrage proposé
 * et un rapport. Un import relancé ne recrée pas les mesures déjà présentes
 * (même IPP, même type, même début).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xlsx.js'), require('./model.js'), require('./rules.js'));
  else (root.SIC = root.SIC || {}).importV13 = factory(root.SIC.xlsx, root.SIC.model, root.SIC.rules);
})(typeof self !== 'undefined' ? self : this, function (X, M, R) {
  'use strict';

  var H = R.H;

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  /** Valeur d'une colonne, retrouvée par son libellé (accents, casse et ponctuation ignorés). */
  function col(o, libelle) {
    var cible = norm(libelle);
    for (var k in o) if (k !== '_ligne' && norm(k) === cible) return o[k];
    return undefined;
  }
  function txt(v) { return v == null ? '' : String(v).trim(); }
  function oui(v) { return /^(oui|o|vrai|true|1)$/i.test(txt(v)) || v === true; }
  function dateISO(v) { var t = X.valeurDate(v); return t ? M.dateLocaleISO(t) : ''; }
  function heure(v) {
    if (typeof v === 'number') { var mn = Math.round(v * 1440) % 1440; return String(Math.floor(mn / 60)).padStart(2, '0') + ':' + String(mn % 60).padStart(2, '0'); }
    var m = /(\d{1,2})[:h](\d{2})/.exec(txt(v));
    return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
  }
  function feuille(classeur, nom) {
    var k = Object.keys(classeur.feuilles).filter(function (n) { return norm(n) === norm(nom); })[0];
    return k ? X.enObjets(classeur.feuilles[k]) : [];
  }
  function aleatoire() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }

  var PARAMS = {
    'information jld seuil cumul 15j heures': 'seuilInfo15j',
    'saisine jld seuil cumul 15j heures': 'seuilSaisine15j',
    'decision jld seuil cumul 15j heures': 'seuilDecision15j',
    'intervalle nouveau cycle heures': 'intervalleCycle',
    'seuil jaune avant echeance heures': 'seuilJaune',
    'rythme long a partir du cycle 0 desactive': 'rythmeLongCycle',
    'rythme long information et saisine heures': 'rythmeLongInfoSaisine',
    'rythme long decision heures': 'rythmeLongDecision'
  };

  function statutTiers(valeur, motif) {
    var v = norm(valeur), mo = norm(motif);
    if (!v || v === 'a renseigner') return null;
    if (v === 'oui') return 'INFORME';
    if (v.indexOf('impossible') === 0) return 'TENTATIVE';
    if (/refus/.test(mo) || /refus/.test(v)) return 'REFUS_PATIENT';
    if (/pas de tiers|aucun|absence|sans tiers/.test(mo + ' ' + v)) return 'PAS_DE_TIERS';
    return 'AUTRE';
  }

  /**
   * @param classeur   résultat de xlsx.lire()
   * @param etat       état actuel (model.reduire)
   * @param options    { serviceParDefaut, maintenant, services }
   *   services : choix pour les services du classeur absents de l'outil,
   *              { code: { action: 'creer', libelle } | { action: 'rattacher', vers } | { action: 'ignorer' } }
   */
  function preparer(classeur, etat, options) {
    options = options || {};
    var maintenant = options.maintenant || Date.now();
    var rapport = { patients: 0, patientsExistants: 0, mesures: 0, dejaPresentes: 0, cycles: 0, tiers: 0, modes: 0, professionnels: 0, ignorees: [], avertissements: [], ecartsNumeros: 0 };
    var evts = [], config = [];
    function ajouter(type, data) { evts.push({ type: type, data: data }); }

    var feuilles = Object.keys(classeur.feuilles).map(norm);
    if (feuilles.indexOf('mesures') < 0 || feuilles.indexOf('patients') < 0) throw new Error('Ce classeur ne contient pas les feuilles « Mesures » et « Patients » de la V1.3.');

    // ------------------------------------------------------- Paramétrage
    var services = feuille(classeur, 'CONFIG_SERVICES').filter(function (s) { return txt(col(s, 'Code')); })
      .map(function (s) { return { code: txt(col(s, 'Code')), libelle: txt(col(s, 'Libelle')) || txt(col(s, 'Code')), actif: col(s, 'Actif') === undefined || oui(col(s, 'Actif')) }; });
    var codesActuels = (etat.config.services || []).map(function (s) { return s.code; });
    // Services cités par le classeur (paramétrage et données) et absents de l'outil : à créer, rattacher ou ignorer.
    var cites = {};
    function citer(code, ou) { code = txt(code); if (!code || codesActuels.indexOf(code) >= 0) return; (cites[code] = cites[code] || { code: code, references: {}, total: 0 }); cites[code].references[ou] = (cites[code].references[ou] || 0) + 1; if (ou !== 'paramétrage des services') cites[code].total++; }
    services.forEach(function (s) { citer(s.code, 'paramétrage des services'); });
    feuille(classeur, 'Patients').forEach(function (p) { citer(col(p, 'Service'), 'patients'); });
    feuille(classeur, 'CONFIG_LIEUX_CSI').forEach(function (l) { citer(col(l, 'Service'), 'chambres de soins intensifs'); });
    feuille(classeur, 'CONFIG_PERIODES_SUIVI').forEach(function (p) { citer(col(p, 'Service'), 'périodes de surveillance'); });
    feuille(classeur, 'CONFIG_MASQUES_EXPORT').forEach(function (m) { citer(col(m, 'Service'), 'masques du décompte'); });
    feuille(classeur, 'CONFIG_COMPTEURS_REGISTRE').forEach(function (c) { citer(col(c, 'Service'), 'compteurs du registre'); });
    feuille(classeur, 'SUIVI_PROFESSIONNELS_CSI').forEach(function (p) { citer(col(p, 'Service'), 'professionnels en CSI'); });
    var choixSv = options.services || {}, servicesACreer = [];
    rapport.services = Object.keys(cites).map(function (code) {
      var def = services.filter(function (s) { return s.code === code; })[0];
      var c = choixSv[code] || {};
      var action = c.action || (cites[code].total || (def && def.actif) ? 'creer' : 'ignorer');
      if (action === 'ignorer' && cites[code].total) action = 'creer';             // un service qui porte des données ne peut pas être ignoré
      if (action === 'rattacher' && codesActuels.indexOf(c.vers) < 0) action = 'creer';
      var libelle = txt(c.libelle) || (def ? def.libelle : code);
      if (action === 'creer') servicesACreer.push({ code: code, libelle: libelle });
      return { code: code, libelle: libelle, actif: def ? def.actif : true, references: cites[code].references, total: cites[code].total, action: action, vers: action === 'rattacher' ? c.vers : '' };
    });
    var correspondance = {};
    rapport.services.forEach(function (s) { if (s.action === 'rattacher') correspondance[s.code] = s.vers; });
    /** Code du service dans l'outil pour un code du classeur (après rattachement éventuel). */
    function S(code) { code = txt(code); return correspondance[code] || code; }
    var svDefaut = options.serviceParDefaut || S((services.filter(function (s) { return s.actif; })[0] || {}).code) || codesActuels[0] || (servicesACreer[0] || {}).code;
    var lieux = JSON.parse(JSON.stringify(etat.config.lieuxCSI || {})), nLieux = 0;
    feuille(classeur, 'CONFIG_LIEUX_CSI').forEach(function (l) {
      var sv = S(col(l, 'Service')), lieu = txt(col(l, 'Lieu'));
      if (!sv || !lieu) return;
      lieux[sv] = lieux[sv] || [];
      if (lieux[sv].indexOf(lieu) < 0) { lieux[sv].push(lieu); nLieux++; }
    });
    if (nLieux) config.push({ cle: 'lieuxCSI', valeur: lieux, libelle: 'Lieux de CSI (' + nLieux + ')' });

    var periodesService = JSON.parse(JSON.stringify(etat.config.periodesService || {})), nPer = 0;
    feuille(classeur, 'CONFIG_PERIODES_SUIVI').sort(function (a, b) { return (+col(a, 'Ordre') || 0) - (+col(b, 'Ordre') || 0); }).forEach(function (p) {
      var sv = S(col(p, 'Service')), lib = txt(col(p, 'Periode')), d = heure(col(p, 'Heure debut')), f = heure(col(p, 'Heure fin'));
      if (!sv || !lib || !d || !f) return;
      if (!nPer || !periodesService[sv] || periodesService[sv]._import !== true) { periodesService[sv] = []; periodesService[sv]._import = true; }
      periodesService[sv].push({ code: norm(lib).replace(/ /g, '').toUpperCase().slice(0, 6) || 'P' + periodesService[sv].length, libelle: lib, debut: d, fin: f });
      nPer++;
    });
    Object.keys(periodesService).forEach(function (k) { delete periodesService[k]._import; });
    if (nPer) config.push({ cle: 'periodesService', valeur: periodesService, libelle: 'Périodes de surveillance par service (' + nPer + ')' });

    var parametres = JSON.parse(JSON.stringify(etat.config.parametres || {})), nParam = 0;
    (classeur.feuilles.PARAMETRES || []).forEach(function (l, i) {
      if (!i) return;
      var cle = PARAMS[norm(l[0])];
      if (!cle) return;
      ['Isolement', 'Contention'].forEach(function (type, j) {
        var v = +l[j + 1];
        if (isFinite(v) && l[j + 1] !== undefined && v !== R.PARAMETRES_DEFAUT[type][cle]) { parametres[type] = parametres[type] || {}; parametres[type][cle] = v; nParam++; }
      });
    });
    if (nParam) config.push({ cle: 'parametres', valeur: parametres, libelle: 'Paramètres légaux différents des valeurs par défaut (' + nParam + ')' });

    var decompte = JSON.parse(JSON.stringify(etat.config.decompte || {})), nMasque = 0;
    feuille(classeur, 'CONFIG_MASQUES_EXPORT').forEach(function (m) {
      var sv = S(col(m, 'Service'));
      if (!sv) return;
      var masquer = ['N', 'Debut', 'Fin', 'Duree', 'Cumul'].filter(function (c) { return oui(col(m, 'Masquer ' + c + ' (OUI/NON)')); });
      decompte[sv] = { titreIsolement: txt(col(m, 'Titre isolement')), titreContention: txt(col(m, 'Titre contention')), sousTitre: oui(col(m, 'Afficher sous-titre')) ? txt(col(m, 'Sous-titre')) : '', masquer: masquer };
      nMasque++;
    });
    if (nMasque) config.push({ cle: 'decompte', valeur: decompte, libelle: 'Mise en page du décompte JLD (' + nMasque + ' service(s))' });

    // ---------------------------------------------------------- Patients
    var parIPP = {};
    Object.keys(etat.patients).forEach(function (k) { var p = etat.patients[k]; if (p.ipp) parIPP[p.ipp] = { id: p.id, existant: true, service: p.service }; });
    var lignesPatients = feuille(classeur, 'Patients');
    var infosPatient = {};
    lignesPatients.forEach(function (p) { var ipp = txt(col(p, 'IPP')); if (ipp) infosPatient[ipp] = p; });
    var historique = {};
    feuille(classeur, 'HISTORIQUE_MODE_HOSPITALISATION').forEach(function (h) {
      var ipp = txt(col(h, 'IPP')), d = X.valeurDate(col(h, 'Date changement'));
      if (ipp && d) (historique[ipp] = historique[ipp] || []).push({ date: d, ancien: txt(col(h, 'Ancien mode')), nouveau: txt(col(h, 'Nouveau mode')) });
    });

    var lignesMesures = feuille(classeur, 'Mesures');
    var premiereMesure = {};
    lignesMesures.forEach(function (l) {
      var ipp = txt(col(l, 'IPP')), d = X.valeurDate(col(l, 'Debut'));
      if (ipp && d && (!premiereMesure[ipp] || d < premiereMesure[ipp])) premiereMesure[ipp] = d;
    });

    function patientPour(ipp, nomMesure) {
      if (parIPP[ipp]) return parIPP[ipp].id;
      var info = infosPatient[ipp] || {};
      var id = 'P' + aleatoire();
      var sv = S(col(info, 'Service')) || svDefaut;
      var nom = txt(col(info, 'Nom')) || txt(nomMesure) || 'IMPORT ' + ipp;
      ajouter('PATIENT', { patientId: id, ipp: ipp, nom: nom.toUpperCase(), prenom: txt(col(info, 'Prenom')), naissance: dateISO(col(info, 'Naissance')), protection: oui(col(info, 'Mesure de protection juridique (OUI/NON)')) ? 'Mesure de protection juridique' : '', service: sv });
      var depuis = (premiereMesure[ipp] || maintenant) - H;
      var hist = (historique[ipp] || []).sort(function (a, b) { return a.date - b.date; });
      var initial = hist.length ? (hist[0].ancien || hist[0].nouveau) : txt(col(info, "Mode d'hospitalisation"));
      if (initial && (!hist.length || hist[0].date > depuis)) { ajouter('MODE_HOSPI', { patientId: id, mode: initial, date: Math.min(depuis, hist.length ? hist[0].date - 1 : depuis) }); rapport.modes++; }
      hist.forEach(function (h) { if (h.nouveau) { ajouter('MODE_HOSPI', { patientId: id, mode: h.nouveau, date: h.date }); rapport.modes++; } });
      if (!initial && !hist.length) rapport.avertissements.push('Patient IPP ' + ipp + " : mode d'hospitalisation inconnu.");
      parIPP[ipp] = { id: id, existant: false, service: sv };
      rapport.patients++;
      return id;
    }

    // ----------------------------------------------------------- Mesures
    var dejaLa = {};
    M.listeMesures(etat).forEach(function (m) {
      var p = etat.patients[m.patientId];
      dejaLa[(p ? p.ipp : m.patientId) + '|' + m.type + '|' + m.debut] = true;
    });
    var cyclesParMesure = {};
    feuille(classeur, 'HISTORIQUE_CYCLES_JLD').forEach(function (c) {
      var id = txt(col(c, 'ID Mesure'));
      if (id) (cyclesParMesure[id] = cyclesParMesure[id] || []).push(c);
    });
    var psychiatres = (etat.config.psychiatres || []).slice();
    var attendus = [], parPatient = {}, numeros = {};

    lignesMesures.forEach(function (l) {
      var idV13 = txt(col(l, 'ID')), ipp = txt(col(l, 'IPP')), type = txt(col(l, 'Type'));
      var debut = X.valeurDate(col(l, 'Debut')), fin = X.valeurDate(col(l, 'Fin'));
      var ref = 'ligne ' + l._ligne + (idV13 ? ' (' + idV13 + ')' : '');
      if (!ipp) { rapport.ignorees.push(ref + ' : IPP manquant'); return; }
      if (type !== 'Isolement' && type !== 'Contention') { rapport.ignorees.push(ref + ' : type « ' + type + ' » non reconnu'); return; }
      if (!debut) { rapport.ignorees.push(ref + ' : date de début illisible'); return; }
      if (fin && fin < debut) { rapport.ignorees.push(ref + ' : fin antérieure au début'); return; }
      if (dejaLa[ipp + '|' + type + '|' + debut]) { rapport.dejaPresentes++; return; }
      dejaLa[ipp + '|' + type + '|' + debut] = true;

      var patientId = patientPour(ipp, col(l, 'Nom'));
      var sv = parIPP[ipp].service || svDefaut;
      var lieuType = norm(col(l, 'Lieu (CSI/Autre)')), nomLieu = txt(col(l, 'Nom du lieu'));
      var csi = lieuType ? lieuType === 'csi' : true;
      var psy = txt(col(l, 'Psychiatre'));
      if (psy && psychiatres.indexOf(psy) < 0) psychiatres.push(psy);
      var mesureId = 'I' + aleatoire();
      var numero = txt(col(l, 'ID Registre'));
      ajouter('MESURE_DEBUT', {
        mesureId: mesureId, patientId: patientId, service: sv, typeMesure: type, debut: debut,
        lieu: csi ? (nomLieu || 'CSI') : (nomLieu ? 'Chambre ' + nomLieu.replace(/^chambre\s*/i, '') : 'Hors CSI'),
        csi: csi, exception: oui(col(l, 'Exception CSI (contention)')), psychiatre: psy,
        origine: 'Classeur V1.3' + (idV13 ? ' — ' + idV13 : ''), numeroOrigine: numero
      });
      rapport.mesures++;
      if (numero) { var an = new Date(debut).getFullYear(); numeros[sv + '|' + an] = (numeros[sv + '|' + an] || 0) + 1; }
      (parPatient[ipp + '|' + type] = parPatient[ipp + '|' + type] || []).push([debut, fin || maintenant]);

      // Cycles JLD et information des tiers
      var cycleFinal = Math.max(1, +col(l, 'Cycle') || 1), levee = oui(col(l, 'JLD levee'));
      var parCycle = {};
      (cyclesParMesure[idV13] || []).forEach(function (c) { var n = +col(c, 'Cycle') || 1; parCycle[n] = c; });
      if (!parCycle[cycleFinal]) parCycle[cycleFinal] = l;
      var decisionLevee = false;
      for (var c = 1; c <= cycleFinal; c++) {
        var src = parCycle[c];
        if (src) {
          var t = statutTiers(col(src, 'Tiers'), col(src, 'Motif'));
          if (t) {
            var inf = txt(col(src, 'Informateur'));
            ajouter('TIERS', { mesureId: mesureId, cycle: c, statut: t, personne: txt(col(src, 'Personne')), informateur: /\bide\b|infirm/i.test(inf) ? 'IDE' : 'PSYCHIATRE', nomInformateur: /\bide\b|infirm/i.test(inf) ? '' : inf, date: X.valeurDate(col(src, 'Date tiers')) || debut, motif: txt(col(src, 'Motif')) });
            rapport.tiers++;
          }
          [['INFO', 'Info effective'], ['SAISINE', 'Saisine effective']].forEach(function (n) {
            var d = X.valeurDate(col(src, n[1]));
            if (d) ajouter('JLD', { mesureId: mesureId, cycle: c, nature: n[0], date: d, decision: null });
          });
        }
        var dDec = src ? X.valeurDate(col(src, 'Decision effective')) : null;
        if (c < cycleFinal) { ajouter('JLD', { mesureId: mesureId, cycle: c, nature: 'DECISION', date: dDec, decision: 'MAINTIEN' }); rapport.cycles++; }
        else if (levee) { ajouter('JLD', { mesureId: mesureId, cycle: c, nature: 'DECISION', date: dDec, decision: 'LEVEE' }); decisionLevee = true; }
        else if (dDec) ajouter('JLD', { mesureId: mesureId, cycle: c, nature: 'DECISION', date: dDec, decision: null });
      }
      if (levee && !decisionLevee) rapport.avertissements.push(ref + ' : levée JLD sans date de décision.');
      if (fin) ajouter('MESURE_FIN', { mesureId: mesureId, fin: fin, psychiatre: psy });
      if (!fin) attendus.push({ mesureId: mesureId, ref: ref, cycle: cycleFinal, info: X.valeurDate(col(l, 'Info avant')), saisine: X.valeurDate(col(l, 'Saisine avant')), decision: X.valeurDate(col(l, 'Decision avant')) });
    });

    // Chevauchements (signalés, comptés une seule fois dans les cumuls)
    Object.keys(parPatient).forEach(function (k) {
      var iv = parPatient[k].sort(function (a, b) { return a[0] - b[0]; });
      for (var i = 1; i < iv.length; i++) if (iv[i][0] < iv[i - 1][1]) { rapport.avertissements.push('IPP ' + k.split('|')[0] + ' : mesures de ' + k.split('|')[1].toLowerCase() + ' qui se chevauchent (temps commun compté une seule fois).'); break; }
    });

    // Professionnels en CSI
    var periodesDe = function (sv) { return periodesService[sv] && periodesService[sv].length ? periodesService[sv] : M.periodesDe(etat.config, sv); };
    var prosDeja = {};
    etat.professionnels.forEach(function (p) { prosDeja[p.service + '|' + p.date + '|' + p.periode + '|' + norm(p.nom)] = true; });
    feuille(classeur, 'SUIVI_PROFESSIONNELS_CSI').forEach(function (p) {
      var nom = txt(col(p, 'Nom')), sv = S(col(p, 'Service')) || svDefaut, jour = dateISO(col(p, 'Date')), lib = norm(col(p, 'Periode'));
      if (!nom || /a renseigner/.test(norm(nom)) || !jour) return;
      var per = periodesDe(sv).filter(function (x) { return norm(x.libelle) === lib || norm(x.code) === lib; })[0];
      if (!per) { rapport.avertissements.push('Professionnel ' + nom + ' le ' + jour + ' : période « ' + col(p, 'Periode') + ' » inconnue.'); return; }
      var cle = sv + '|' + jour + '|' + per.code + '|' + norm(nom);
      if (prosDeja[cle]) return;
      prosDeja[cle] = true;
      ajouter('PROFESSIONNEL', { service: sv, date: jour, periode: per.code, nom: nom, fonction: txt(col(p, 'Fonction')) });
      rapport.professionnels++;
    });

    if (psychiatres.length !== (etat.config.psychiatres || []).length) config.push({ cle: 'psychiatres', valeur: psychiatres, libelle: 'Liste des psychiatres (' + psychiatres.length + ')' });

    // Compteurs du registre : dernier numéro du classeur, à diminuer des entrées que l'outil numérotera
    // lui-même à partir des mesures importées déjà numérotées (une mesure peut donner plusieurs entrées : A, C, A).
    var compteurs = [];
    feuille(classeur, 'CONFIG_COMPTEURS_REGISTRE').forEach(function (c) {
      var sv = S(col(c, 'Service')), an = +col(c, 'Annee'), dernier = +col(c, 'Dernier numero utilise');
      if (!sv || !an || !isFinite(dernier)) return;
      compteurs.push({ service: sv, annee: an, dernier: dernier, mesuresNumerotees: numeros[sv + '|' + an] || 0 });
    });
    var anneesNumerotees = Object.keys(numeros).map(function (k) { var x = k.split('|'); return { service: x[0], annee: +x[1], mesures: numeros[k] }; });
    var prep = { evenements: evts, config: config, rapport: rapport, attendus: attendus, compteurs: compteurs, servicesACreer: servicesACreer, etatAvant: etat, maintenant: maintenant, anneesNumerotees: anneesNumerotees };
    var sim = simuler(prep, {}, {});
    compteurs.forEach(function (c) {
      c.entreesNumerotees = M.registre(sim, c.service, c.annee, maintenant).filter(function (e) { return e.fin !== null && (sim.mesures[e.mesureId] || {}).numeroOrigine; }).length;
      c.propose = Math.max(0, c.dernier - c.entreesNumerotees);
      c.existantes = M.listeMesures(etat).some(function (m) { return m.service === c.service && new Date(m.debut).getFullYear() === c.annee; });
    });
    return prep;
  }

  /**
   * Années dont la numérotation du classeur est conservée, selon le choix fait à l'import :
   * 'conserver' : toutes les années importées ; 'annee' : toutes sauf l'année en cours (recalculée) ;
   * 'tout' : aucune (tout est recalculé selon les règles de l'outil). Retourne { service: { annee: true } }.
   */
  function figeSelon(prep, mode, anneeCourante) {
    var r = {};
    if (mode === 'tout') return r;
    prep.anneesNumerotees.forEach(function (x) {
      if (mode === 'annee' && x.annee >= anneeCourante) return;
      r[x.service] = r[x.service] || {}; r[x.service][x.annee] = true;
    });
    return r;
  }

  /** Années figées choisies, fusionnées avec le paramétrage existant (les années recalculées en sont retirées). */
  function fusionFige(etat, prep, fige) {
    var r = JSON.parse(JSON.stringify((etat.config && etat.config.registreFige) || {}));
    prep.anneesNumerotees.forEach(function (x) {
      if (fige[x.service] && fige[x.service][x.annee]) { r[x.service] = r[x.service] || {}; r[x.service][x.annee] = true; }
      else if (r[x.service]) delete r[x.service][x.annee];
    });
    Object.keys(r).forEach(function (sv) { if (!Object.keys(r[sv]).length) delete r[sv]; });
    return r;
  }

  /** Compteurs choisis, fusionnés avec ceux déjà paramétrés : { service: { annee: n } }. */
  function fusionCompteurs(etat, choix) {
    var r = JSON.parse(JSON.stringify((etat.config && etat.config.compteursRegistre) || {}));
    Object.keys(choix || {}).forEach(function (sv) { Object.keys(choix[sv]).forEach(function (an) { r[sv] = r[sv] || {}; r[sv][an] = +choix[sv][an] || 0; }); });
    return r;
  }

  /**
   * État obtenu si l'import était enregistré (paramétrage actuel + paramétrage du classeur + services créés
   * + compteurs choisis + mesures importées). Les mesures déjà présentes dans l'outil n'y figurent pas.
   */
  function simuler(prep, compteurs, fige) {
    var etat = prep.etatAvant, n = 0, evts = [];
    // Avec les saisies existantes (prep.evtsExistants, fournies par l'interface), la simulation comprend aussi
    // les mesures déjà présentes dans l'outil ; les saisies simulées sont alors datées après elles.
    var existants = prep.evtsExistants || null, base = existants ? Date.UTC(2999, 0, 1) : Date.UTC(2000, 0, 1);
    function evt(type, data) { n++; evts.push({ id: 'sim' + String(n).padStart(6, '0'), at: new Date(base + n * 1000).toISOString(), by: 'import', type: type, data: data }); }
    if (existants) evts = existants.slice();
    else Object.keys(etat.config).forEach(function (k) { evt('CONFIG', { cle: k, valeur: etat.config[k] }); });
    prep.config.forEach(function (c) { evt('CONFIG', { cle: c.cle, valeur: c.valeur }); });
    if (prep.servicesACreer.length) evt('CONFIG', { cle: 'services', valeur: (etat.config.services || []).concat(prep.servicesACreer) });
    evt('CONFIG', { cle: 'compteursRegistre', valeur: fusionCompteurs(etat, compteurs) });
    evt('CONFIG', { cle: 'registreFige', valeur: fusionFige(etat, prep, fige || {}) });
    evt('LOT', { evenements: prep.evenements });
    return M.reduire(evts);
  }

  /**
   * Compare les numéros du registre du classeur (« A11 ») à ceux que l'outil attribue après import.
   * Retourne { verifiees, ecarts: [{ ref, classeur, outil, motif }] }.
   */
  function controleNumeros(prep, compteurs, fige) {
    var sim = simuler(prep, compteurs, fige), parMesure = {}, vus = {};
    M.listeMesures(sim).forEach(function (m) {
      if (!m.numeroOrigine) return;
      var an = new Date(m.debut).getFullYear(), cle = m.service + '|' + an;
      if (!vus[cle]) { vus[cle] = M.registre(sim, m.service, an, prep.maintenant); }
    });
    Object.keys(vus).forEach(function (k) { vus[k].forEach(function (e) { (parMesure[e.mesureId] = parMesure[e.mesureId] || []).push(e); }); });
    var verifiees = 0, ecarts = [];
    M.listeMesures(sim).forEach(function (m) {
      if (!m.numeroOrigine) return;
      var origine = String(m.numeroOrigine).trim().toUpperCase(), entrees = parMesure[m.id] || [];
      var numeros = entrees.map(function (e) { return e.numero || 'en cours'; });
      var ref = (m.origine || '').replace(/^Classeur V1\.3 — /, '') || m.id;
      if (numeros.indexOf(origine) >= 0) { verifiees++; return; }
      var mo = /^([A-E])\s*-?\s*(\d+)$/.exec(origine), motif;
      if (!mo) motif = 'numéro du classeur non reconnu';
      else {
        var memeNum = entrees.filter(function (e) { return e.numero && e.numero.slice(1) === mo[2]; })[0];
        var memeCat = entrees.filter(function (e) { return e.categorie === mo[1]; })[0];
        motif = memeNum ? 'même numéro, catégorie différente (' + mo[1] + ' dans le classeur, ' + memeNum.categorie + ' dans l’outil)'
          : memeCat ? 'même catégorie, numéro différent'
          : entrees.length > 1 ? 'la mesure forme ' + entrees.length + ' entrées dans l’outil' : 'catégorie et numéro différents';
      }
      ecarts.push({ ref: ref, classeur: origine, outil: numeros.join(', ') || '—', motif: motif });
    });
    return { verifiees: verifiees, ecarts: ecarts };
  }

  /**
   * Impact des trois choix de numérotation sur le registre et les statistiques, par service et par année
   * contenant des mesures importées numérotées. `compteursPar(mode)` : compteurs retenus pour chaque choix.
   * Retourne [{ service, annee, modes: { conserver|annee|tout: indicateurs } }].
   */
  function impactNumerotation(prep, compteursPar, anneeCourante) {
    var modes = ['conserver', 'annee', 'tout'], sims = {};
    modes.forEach(function (mo) { sims[mo] = simuler(prep, compteursPar(mo), figeSelon(prep, mo, anneeCourante)); });
    return prep.anneesNumerotees.map(function (x) {
      var r = { service: x.service, annee: x.annee, modes: {} };
      modes.forEach(function (mo) {
        var sim = sims[mo], s = M.statistiquesAnnee(sim, [x.service], x.annee, prep.maintenant);
        var reg = M.registre(sim, x.service, x.annee, prep.maintenant);
        r.modes[mo] = {
          entrees: s.mesures, enCours: s.enCours, categories: s.categories, dureeTotale: s.duree.total, dureeMoyenne: s.duree.moyenne,
          heuresCSI: s.heuresCSI, patients: s.patients, numeros: reg.filter(function (e) { return e.numero; }).map(function (e) { return e.numero; })
        };
      });
      return r;
    });
  }



  /** Compare les échéances recalculées aux valeurs du classeur pour les mesures en cours. */
  function comparer(etatApres, attendus) {
    var ecarts = [];
    attendus.forEach(function (a) {
      var m = etatApres.mesures[a.mesureId];
      if (!m) return;
      var e = R.echeances(M.listeMesures(etatApres), m, m.cycle, etatApres.config.parametres);
      ['info', 'saisine', 'decision'].forEach(function (k) {
        if (a[k] && Math.abs(a[k] - e[k]) > 60000) ecarts.push({ ref: a.ref, nature: k, classeur: a[k], calcule: e[k] });
      });
    });
    return ecarts;
  }

  return { preparer: preparer, comparer: comparer, simuler: simuler, controleNumeros: controleNumeros, fusionCompteurs: fusionCompteurs, figeSelon: figeSelon, fusionFige: fusionFige, impactNumerotation: impactNumerotation, norm: norm };
});
