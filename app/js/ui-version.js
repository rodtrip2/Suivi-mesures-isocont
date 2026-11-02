// SPDX-License-Identifier: EUPL-1.2
/*
 * Vérification de la version (demande du porteur) : quand l'outil est ouvert depuis sa page GitHub
 * (*.github.io), relit `js/version.js` sur le même site et propose de recharger la page si une version
 * plus récente est publiée. Aucune connexion vers un autre site : le fichier est relu comme un script
 * (CSP `script-src 'self'`), jamais par une requête réseau (`connect-src 'none'` reste en vigueur).
 * Désactivable par l'administrateur : `config.verificationVersion` (true par défaut), retenu sur le poste
 * (`localStorage` `sic-verif-version`) pour s'appliquer dès l'écran de connexion.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, h = U.h;
  var INTERVALLE = 30 * 60000, CLE = 'sic-verif-version', CLE_ATTENDUE = 'sic-version-attendue';
  var etat = { derniere: 0, ignoree: null, enCours: false, bandeau: null };

  var comparer = SIC.model.comparerVersions;

  function surGitHub() { return /\.github\.io$/i.test(location.hostname) && /^https?:$/.test(location.protocol); }

  /** Choix de l'établissement : réglage du coffre si une session est ouverte, sinon dernier choix connu du poste. */
  function active() {
    var s = U.App && U.App.session;
    if (s && s.etat && s.etat.config) {
      var v = s.etat.config.verificationVersion !== false;
      try { localStorage.setItem(CLE, v ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
      return v;
    }
    try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; }
  }

  /** Version publiée : relecture de js/version.js (adresse unique pour éviter le cache), sans toucher à la version chargée. */
  function versionPubliee() {
    return new Promise(function (resoudre, rejeter) {
      var avant = SIC.VERSION, s = document.createElement('script'), fini = false;
      function terminer(v, err) {
        if (fini) return; fini = true;
        SIC.VERSION = avant; s.remove();
        if (err) rejeter(err); else resoudre(v);
      }
      s.src = 'js/version.js?verification=' + Date.now();
      s.onload = function () { terminer(SIC.VERSION); };
      s.onerror = function () { terminer(null, new Error('Version publiée illisible')); };
      setTimeout(function () { terminer(null, new Error('Délai dépassé')); }, 15000);
      document.head.appendChild(s);
    });
  }

  function retirerBandeau() { if (etat.bandeau) { etat.bandeau.remove(); etat.bandeau = null; } }

  function recharger(v) {
    var saisie = document.querySelector('dialog[open]');
    if (saisie && !confirm('Une fenêtre de saisie est ouverte : ce qui n’est pas enregistré sera perdu. Recharger quand même ?')) return;
    try { sessionStorage.setItem(CLE_ATTENDUE, v); } catch (e) { /* stockage indisponible */ }
    location.reload();
  }

  function afficher(v, incomplet) {
    retirerBandeau();
    etat.bandeau = h('div', { class: 'bandeau-version', role: 'status' },
      h('span', { text: incomplet
        ? 'La version ' + v + ' n’est pas encore entièrement disponible sur ce poste (fichiers encore en cache). Réessayez dans quelques minutes.'
        : 'Une nouvelle version de l’outil est disponible (' + v + ', vous utilisez la ' + SIC.VERSION + '). Enregistrez votre saisie en cours, puis rechargez la page.' }),
      h('button', { class: 'btn petit primaire', type: 'button', onclick: function () { recharger(v); } }, incomplet ? 'Réessayer' : 'Recharger la page'),
      h('button', { class: 'btn petit', type: 'button', onclick: function () { etat.ignoree = v; retirerBandeau(); } }, 'Plus tard'));
    document.body.appendChild(etat.bandeau);
  }

  /** Vérifie la version publiée (au plus une fois toutes les 30 min, sauf `force`). */
  async function verifier(force) {
    if (!surGitHub() || !active() || etat.enCours) return null;
    if (!force && Date.now() - etat.derniere < INTERVALLE) return null;
    etat.enCours = true; etat.derniere = Date.now();
    try {
      var v = await versionPubliee();
      if (v && comparer(v, SIC.VERSION) > 0 && v !== etat.ignoree) afficher(v, false);
      else if (!v || comparer(v, SIC.VERSION) <= 0) retirerBandeau();
      return v;
    } catch (e) { return null; }       // site injoignable : nouvelle tentative plus tard
    finally { etat.enCours = false; }
  }

  function demarrer() {
    if (!surGitHub()) return;
    // Après un rechargement : la version attendue est-elle bien chargée ?
    var attendue = null;
    try { attendue = sessionStorage.getItem(CLE_ATTENDUE); sessionStorage.removeItem(CLE_ATTENDUE); } catch (e) { /* stockage indisponible */ }
    if (attendue && comparer(attendue, SIC.VERSION) > 0) { afficher(attendue, true); etat.derniere = Date.now(); }
    else setTimeout(function () { verifier(true); }, 3000);
    setInterval(function () { if (document.visibilityState === 'visible') verifier(false); }, 5 * 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') verifier(false); });
  }

  /** Réglage d'administration (sous-onglet À propos). */
  function panneau() {
    var cfg = U.config(), cb = h('input', { type: 'checkbox', checked: cfg.verificationVersion !== false });
    var res = h('small', { class: 'muted' });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Mise à jour de l’outil' }),
      h('p', { class: 'muted', text: 'Quand l’outil est ouvert depuis sa page GitHub (adresse en « github.io »), il vérifie à l’ouverture puis toutes les 30 minutes qu’il s’agit de la dernière version publiée, et propose de recharger la page sinon. Seul le numéro de version est relu, sur le même site ; aucune donnée n’est envoyée. Sans effet pour un outil hébergé sur l’intranet ou ouvert depuis un dossier partagé : la mise à jour y est faite par le service informatique.' }),
      h('label', { class: 'case' }, cb, h('span', { text: 'Vérifier que la version utilisée est la dernière publiée (page GitHub)' })),
      h('div', { class: 'actions gauche' },
        U.boutonEnregistrer(async function () { await U.enregistrerConfig([['verificationVersion', cb.checked]]); active(); if (!cb.checked) retirerBandeau(); }),
        surGitHub() ? h('button', { class: 'btn', type: 'button', onclick: async function () {
          res.textContent = 'Vérification…';
          var v = await verifier(true);
          res.textContent = v ? (comparer(v, SIC.VERSION) > 0 ? 'Version ' + v + ' disponible.' : 'Vous utilisez la dernière version (' + SIC.VERSION + ').') : 'Vérification impossible pour le moment (réglage désactivé ou site injoignable).';
        } }, 'Vérifier maintenant') : null, res));
  }

  U.version = { demarrer: demarrer, verifier: verifier, comparer: comparer, panneau: panneau, surGitHub: surGitHub };
})();
