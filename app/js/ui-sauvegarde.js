// SPDX-License-Identifier: EUPL-1.2
/*
 * Robustesse des données : état des données (Administration → Informations), copie du coffre sous scellé,
 * copie de sauvegarde complète et rappel, contrôle d'intégrité, restauration (coffre perdu ou abîmé,
 * dossier vide). Les fichiers produits restent chiffrés : inutilisables sans un moyen de déblocage.
 * Stockage : store.js (versionsCoffre, restaurerCoffre, copieComplete, restaurerCopie, repères) ;
 * session.js (verifierIntegrite, copieSousScelle, etatScelle, copieComplete, derniereCopie).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var J = 86400000;

  function telechargerJSON(nom, objet) {
    var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(objet)], { type: 'application/json' })), download: nom });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function jourISO() { return M.dateLocaleISO(Date.now()); }
  function rappelJours() { return Math.max(0, Math.round(+((U.config().sauvegarde || {}).rappelJours) || 0)); }
  function lireFichierJSON(input) {
    return new Promise(function (ok, ko) {
      var f = input.files[0];
      if (!f) return ko(new Error('Choisissez un fichier.'));
      var r = new FileReader();
      r.onload = function () { try { ok(JSON.parse(r.result)); } catch (e) { ko(new Error('Fichier illisible : ce n’est pas un fichier de l’outil.')); } };
      r.onerror = function () { ko(new Error('Lecture du fichier impossible.')); };
      r.readAsText(f);
    });
  }

  // ------------------------------------------------------------ Contrôle d'intégrité
  function texteIntegrite(r) {
    if (!r) return null;
    var pbs = [];
    r.reperes.forEach(function (x) {
      var nom = U.App.session.nomAuteur(x.agent);
      pbs.push(x.illisible ? 'repère d’intégrité illisible (' + nom + ')' : nom + ' : ' + (x.attendu - x.present > 0 ? (x.attendu - x.present) + ' saisie(s) manquante(s)' : 'dernière saisie manquante') + (x.dernierLe ? ' (dernière saisie attendue du ' + U.date(Date.parse(x.dernierLe)) + ')' : ''));
    });
    if (r.disparus.length) pbs.push(r.disparus.length + ' fichier(s) de saisie chargé(s) depuis l’ouverture de la session ne sont plus sur le partage');
    if (r.illisibles) pbs.push(r.illisibles + ' fichier(s) illisible(s)');
    if (r.manquants) pbs.push(r.manquants + ' maillon(s) manquant(s) dans le chaînage des saisies');
    return pbs;
  }

  /** Lance le contrôle (après la connexion, puis toutes les 15 minutes) et rafraîchit l'affichage si un problème apparaît. */
  async function controler() {
    var s = U.App.session;
    if (!s || !s.cle) return null;
    var avant = JSON.stringify(texteIntegrite(s.integrite) || []);
    try { await s.verifierIntegrite(); } catch (e) { return null; }
    if (JSON.stringify(texteIntegrite(s.integrite)) !== avant) U.rendreContenu();
    return s.integrite;
  }

  /** Points de vigilance du tableau de bord (cadre, administrateur). */
  function vigilance() {
    var s = U.App.session, res = [], admin = s.peut('CONFIG');
    if (!(admin || s.peut('CORRECTION'))) return res;
    var pbs = texteIntegrite(s.integrite) || [];
    if (pbs.length) res.push(h('li', { class: 'urgent' }, h('b', { text: 'Intégrité des données' }), ' — ' + pbs.join(' ; ') + '. Prévenez l’administrateur et la DSI (restauration depuis la sauvegarde, voir les procédures de secours).'));
    if (admin && !s.formation && U.App.dossier.mode !== 'demo') {
      var der = s.derniereCopie(), n = rappelJours();
      if (n && (!der || Date.now() - der > n * J)) res.push(h('li', {}, h('b', { text: 'Copie de sauvegarde' }), ' — ' + (der ? 'dernière copie complète le ' + U.date(der).slice(0, 10) : 'aucune copie complète téléchargée') + ' (rappel tous les ' + n + ' jours). Administration → Informations.'));
      var sc = s.etatScelle();
      if (!sc || !sc.aJour) res.push(h('li', {}, h('b', { text: 'Copie du coffre sous scellé' }), ' — ' + (!sc ? 'jamais faite' : 'à refaire : le code de secours a été renouvelé depuis') + '. Administration → Informations.'));
    }
    return res;
  }

  // ------------------------------------------------------------ Administration → Informations
  function panneau() {
    var s = U.App.session;
    var zone = h('div', { class: 'pile' }, h('div', { class: 'muted', text: 'Lecture de l’état des données…' }));
    var rappel = h('select', {}, [0, 1, 3, 7, 14, 30].map(function (j) { return h('option', { value: j, text: j ? 'tous les ' + j + ' jours' : 'aucun rappel', selected: j === rappelJours() }); }));
    async function remplir() {
      var versions = [];
      try { versions = await s.dossier.versionsCoffre(); } catch (e) { /* lecture impossible */ }
      var sc = s.etatScelle(), der = s.derniereCopie(), r = s.integrite, pbs = texteIntegrite(r);
      U.vider(zone).appendChild(h('div', { class: 'recap' },
        h('div', { text: 'Coffre : révision ' + s.coffre.rev + ' — ' + versions.filter(function (v) { return v.valide; }).length + ' version(s) conservée(s) dans le dossier, la version actuelle comprise' + (versions[0] && versions[0].archiveLe ? ' (la plus récente du ' + U.date(Date.parse(versions[0].archiveLe)) + ')' : '') + (s.coffre.restaureLe ? ' — coffre restauré le ' + U.date(Date.parse(s.coffre.restaureLe)) : '') }),
        h('div', { class: !sc || !sc.aJour ? 'texte-bad' : '', text: 'Copie du coffre sous scellé : ' + (!sc ? 'jamais faite' : 'faite le ' + U.date(Date.parse(sc.creeLe)) + (sc.aJour ? '' : ' — à refaire, le code de secours a été renouvelé depuis')) }),
        h('div', { class: der && Date.now() - der <= (rappelJours() || 9999) * J ? '' : 'texte-bad', text: 'Dernière copie de sauvegarde complète : ' + (der ? U.date(der) : 'aucune') }),
        h('div', { class: pbs && pbs.length ? 'texte-bad' : '', text: 'Contrôle d’intégrité : ' + (!r ? 'non encore effectué' : (pbs.length ? pbs.join(' ; ') : 'aucune anomalie') + ' (le ' + U.date(r.verifieLe) + ')') })));
    }
    remplir();
    return h('section', { class: 'panneau' }, h('h2', { text: 'État des données et sauvegardes' }),
      h('p', { class: 'muted', text: 'Le dossier réseau doit être sauvegardé par la DSI (au moins chaque jour, versions conservées 30 jours ou plus, une copie hors ligne ou non modifiable). Les copies ci-dessous la complètent ; elles restent chiffrées et ne s’ouvrent qu’avec un moyen de déblocage de l’outil.' }),
      zone,
      h('h3', { text: 'Copie du coffre sous scellé' }),
      h('p', { class: 'muted', text: 'À enregistrer sur une clé USB ou un CD conservé au coffre avec l’enveloppe du code de secours. Si le fichier coffre.json était perdu avec ses sauvegardes, cette copie et le code de secours suffisent à rouvrir toutes les données (les mots de passe des agents seront alors à réinitialiser). À refaire après chaque renouvellement du code de secours.' }),
      h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: async function () {
        try { var c = await s.copieSousScelle(); telechargerJSON('coffre-sous-scelle_' + jourISO() + '.json', c); U.toast('Copie sous scellé téléchargée.'); remplir(); }
        catch (e) { alert(e.message); }
      } }, 'Télécharger la copie sous scellé')),
      h('h3', { text: 'Copie de sauvegarde complète' }),
      h('p', { class: 'muted', text: 'Un seul fichier réunissant le coffre et toutes les saisies (chiffrées), à enregistrer sur un autre support que le partage (autre serveur, support hors ligne). Il protège contre une sauvegarde défaillante ou un rançongiciel. Restauration : dans un dossier vide, depuis l’écran d’initialisation.' }),
      h('div', { class: 'actions gauche' },
        h('button', { class: 'btn', type: 'button', onclick: async function (ev) {
          var b = ev.currentTarget; b.disabled = true;
          try { var c = await s.copieComplete(); telechargerJSON('sauvegarde-suivi-isocont_' + jourISO() + '.json', c); U.toast('Copie de sauvegarde téléchargée (' + c.fichiers.length + ' fichiers).'); remplir(); }
          catch (e) { alert(e.message); } finally { b.disabled = false; }
        } }, 'Télécharger une copie de sauvegarde complète'),
        h('label', { class: 'en-ligne' }, 'Rappel au tableau de bord', rappel),
        h('button', { class: 'btn petit', type: 'button', onclick: async function () { await U.enregistrerConfig([['sauvegarde', { rappelJours: +rappel.value }]]); remplir(); } }, 'Enregistrer le rappel')),
      h('h3', { text: 'Contrôle d’intégrité' }),
      h('p', { class: 'muted', text: 'Fait à la connexion puis toutes les 15 minutes : chaque agent laisse un repère (nombre et dernière de ses saisies) ; l’outil signale les saisies disparues, les fichiers illisibles et les trous dans le chaînage.' }),
      h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: async function () { await controler(); remplir(); U.toast('Contrôle effectué.'); } }, 'Vérifier maintenant')));
  }

  // ------------------------------------------------------------ Restauration (avant connexion)
  /** Blocs de restauration pour un dossier dont le coffre est absent ou abîmé. */
  function blocRestaurationCoffre(apres) {
    var d = U.App.dossier, zone = h('div', { class: 'pile' }, h('small', { class: 'muted', text: 'Recherche des versions précédentes du coffre…' }));
    var zoneErr = h('div');
    var fichier = h('input', { type: 'file', accept: '.json,application/json' });
    d.versionsCoffre().then(function (versions) {
      var valides = versions.filter(function (v) { return v.valide; });
      U.vider(zone);
      if (!valides.length) { zone.appendChild(h('small', { class: 'muted', text: 'Aucune version précédente du coffre dans ce dossier.' })); return; }
      var sel = h('select', {}, valides.map(function (v, i) { return h('option', { value: i, text: 'Révision ' + v.rev + (v.archiveLe ? ' — enregistrée le ' + U.date(Date.parse(v.archiveLe)) : '') }); }));
      zone.appendChild(h('label', {}, 'Version du coffre (la plus récente est proposée)', sel));
      zone.appendChild(h('button', { class: 'btn primaire', type: 'button', onclick: async function () {
        U.erreurDans(zoneErr, null);
        try { await d.restaurerCoffre(valides[+sel.value].coffre); U.toast('Coffre restauré.'); apres(); } catch (e) { U.erreurDans(zoneErr, e); }
      } }, 'Restaurer cette version'));
      zone.appendChild(h('small', { class: 'muted', text: 'Si vous choisissez une version plus ancienne, les comptes créés et les mots de passe changés depuis seront à refaire.' }));
    });
    return h('div', { class: 'pile' }, zoneErr,
      h('h3', { text: 'Restaurer le coffre' }), zone,
      h('label', {}, 'ou copie du coffre sous scellé (fichier .json)', fichier),
      h('button', { class: 'btn', type: 'button', onclick: async function () {
        U.erreurDans(zoneErr, null);
        try {
          var c = await lireFichierJSON(fichier);
          await d.restaurerCoffre(c);
          U.App.message = 'Coffre restauré depuis la copie sous scellé : connectez-vous avec le code de secours (ou une clé de sécurité), puis réinitialisez les mots de passe des agents.';
          apres();
        } catch (e) { U.erreurDans(zoneErr, e); }
      } }, 'Restaurer depuis la copie sous scellé'));
  }

  /** Bloc de restauration d'une copie complète, pour un dossier vide (écran d'initialisation). */
  function blocRestaurationCopie(apres) {
    var zoneErr = h('div'), fichier = h('input', { type: 'file', accept: '.json,application/json' });
    var details = h('details', { class: 'restauration' }, h('summary', { text: 'Restaurer une copie de sauvegarde dans ce dossier' }),
      h('div', { class: 'pile' },
        h('p', { class: 'muted', text: 'Pour reconstituer les données après la perte du dossier : choisissez la copie de sauvegarde complète téléchargée depuis l’outil. Le dossier doit être vide. Connectez-vous ensuite comme d’habitude.' }),
        zoneErr, h('label', {}, 'Copie de sauvegarde (fichier .json)', fichier),
        h('button', { class: 'btn', type: 'button', onclick: async function (ev) {
          var b = ev.currentTarget; b.disabled = true; U.erreurDans(zoneErr, null);
          try { var c = await lireFichierJSON(fichier); var n = await U.App.dossier.restaurerCopie(c); U.App.message = 'Copie restaurée (' + n + ' fichiers de saisie). Connectez-vous, puis vérifiez l’état des données (Administration → Informations).'; apres(); }
          catch (e) { U.erreurDans(zoneErr, e); } finally { b.disabled = false; }
        } }, 'Restaurer la copie')));
    return details;
  }

  U.sauvegarde = { panneau: panneau, controler: controler, vigilance: vigilance, blocRestaurationCoffre: blocRestaurationCoffre, blocRestaurationCopie: blocRestaurationCopie, texteIntegrite: texteIntegrite };
})();
