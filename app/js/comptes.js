// SPDX-License-Identifier: EUPL-1.2
/*
 * Création de comptes en lot : analyse d'une liste d'agents collée depuis un
 * tableur ou lue dans un fichier CSV. Une ligne par agent :
 *   Nom affiché ; identifiant (facultatif) ; rôles (facultatif) ; services (facultatif)
 * Séparateur : tabulation, point-virgule ou virgule (détecté). Rôles et
 * services multiples séparés par « , », « / » ou « + ».
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SIC = root.SIC || {}).comptes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  var ALIAS_ROLES = {
    'ide': 'IDE', 'infirmier': 'IDE', 'infirmiere': 'IDE',
    'as': 'AS', 'aide soignant': 'AS', 'aide soignante': 'AS',
    'secretaire': 'SECRETAIRE', 'secretariat': 'SECRETAIRE', 'secretaire medicale': 'SECRETAIRE',
    'cadre': 'CADRE', 'cadre de sante': 'CADRE', 'ffcs': 'CADRE',
    'admin': 'ADMIN', 'administrateur': 'ADMIN'
  };
  var MOTIF_IDENTIFIANT = /^[a-z0-9._-]{2,40}$/;

  /** « Marie-Hélène DUPONT » → « marie-helene.dupont ». */
  function identifiantDepuisNom(nom) {
    var morceaux = String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9 -]+/g, ' ').split(/\s+/).filter(Boolean);
    return morceaux.join('.').replace(/-+/g, '-').slice(0, 40).replace(/[.-]+$/, '');
  }

  function decouper(ligne, sep) {
    if (sep !== ',' && sep !== ';') return ligne.split(sep);
    // Guillemets CSV
    var res = [], cour = '', guill = false;
    for (var i = 0; i < ligne.length; i++) {
      var c = ligne[i];
      if (c === '"') { if (guill && ligne[i + 1] === '"') { cour += '"'; i++; } else guill = !guill; }
      else if (c === sep && !guill) { res.push(cour); cour = ''; }
      else cour += c;
    }
    res.push(cour);
    return res;
  }

  function separateur(lignes) {
    var echantillon = lignes.slice(0, 5).join('\n');
    if (echantillon.indexOf('\t') >= 0) return '\t';
    if (echantillon.indexOf(';') >= 0) return ';';
    return ',';
  }

  function liste(valeur) { return String(valeur || '').split(/[,/+|]/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /**
   * @param texte     contenu collé ou lu dans un fichier
   * @param contexte  { services: [{code, libelle}], loginsExistants: [], rolesDefaut: [], servicesDefaut: [] }
   * @return [{ ligne, nom, login, loginGenere, roles, services, erreurs: [] }]
   */
  function analyser(texte, contexte) {
    var services = contexte.services || [];
    var existants = {};
    (contexte.loginsExistants || []).forEach(function (l) { existants[l] = true; });
    var lignes = String(texte || '').replace(/^﻿/, '').split(/\r?\n/);
    var sep = separateur(lignes.filter(function (l) { return l.trim(); }));
    var vus = {}, res = [];

    lignes.forEach(function (brute, i) {
      if (!brute.trim()) return;
      var c = decouper(brute, sep).map(function (x) { return x.trim(); });
      if (!res.length && /^nom( affiche)?$/.test(norm(c[0]))) return; // en-tête
      var r = { ligne: i + 1, nom: c[0] || '', login: (c[1] || '').toLowerCase(), loginGenere: false, roles: [], services: [], erreurs: [] };
      if (!r.nom) r.erreurs.push('nom manquant');

      // Rôles
      var roles = liste(c[2]);
      if (!roles.length) r.roles = (contexte.rolesDefaut || []).slice();
      roles.forEach(function (x) {
        var code = ALIAS_ROLES[norm(x)] || (/^[A-Z]+$/.test(x) && ['IDE', 'AS', 'SECRETAIRE', 'CADRE', 'ADMIN'].indexOf(x) >= 0 ? x : null);
        if (!code) r.erreurs.push('rôle inconnu « ' + x + ' »');
        else if (r.roles.indexOf(code) < 0) r.roles.push(code);
      });
      if (!r.roles.length && !r.erreurs.length) r.erreurs.push('aucun rôle');

      // Services
      var svs = liste(c[3]);
      if (!svs.length) r.services = (contexte.servicesDefaut || []).slice();
      svs.forEach(function (x) {
        if (/^(\*|tous)$/i.test(norm(x) || x)) { r.services = services.map(function (s) { return s.code; }); return; }
        var s = services.filter(function (s) { return s.code === x || norm(s.code) === norm(x) || norm(s.libelle) === norm(x); })[0];
        if (!s) r.erreurs.push('service inconnu « ' + x + ' »');
        else if (r.services.indexOf(s.code) < 0) r.services.push(s.code);
      });
      var exigeService = r.roles.indexOf('ADMIN') < 0 && r.roles.some(function (x) { return ['IDE', 'AS', 'SECRETAIRE', 'CADRE'].indexOf(x) >= 0; });
      if (exigeService && !r.services.length && !svs.length) r.erreurs.push('aucun service affecté');

      // Identifiant
      if (!r.login && r.nom) {
        var base = identifiantDepuisNom(r.nom), login = base, k = 2;
        while (existants[login] || vus[login]) login = (base.slice(0, 38) + k++);
        r.login = login; r.loginGenere = true;
      }
      if (r.login && !MOTIF_IDENTIFIANT.test(r.login)) r.erreurs.push('identifiant invalide « ' + r.login + ' »');
      else if (existants[r.login]) r.erreurs.push('identifiant déjà utilisé « ' + r.login + ' »');
      else if (vus[r.login]) r.erreurs.push('identifiant en double dans la liste « ' + r.login + ' »');
      if (r.login) vus[r.login] = true;
      res.push(r);
    });
    return res;
  }

  return { analyser: analyser, identifiantDepuisNom: identifiantDepuisNom, norm: norm };
});
