// SPDX-License-Identifier: EUPL-1.2
/*
 * Dossier de secours (miroir) et déplacement des données (Administration → Informations), demande du porteur.
 * - Dossier de secours : second dossier, de préférence sur un autre serveur, tenu à jour par les postes qui y sont
 *   reliés (à la connexion puis toutes les 10 minutes). Les saisies sont réunies dans les deux sens : si le dossier
 *   principal est indisponible, on peut travailler sur le dossier de secours, puis tout est repris au retour.
 * - Déplacement : copie vérifiée de toutes les données vers un nouveau dossier vide ; l'ancien est marqué « déplacé ».
 * Mécanique : store.js (synchroniserAvec, deplacerVers), session.js (synchroniserMiroir, deplacerDonnees).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var INTERVALLE = 10 * 60000, ALERTE_HEURES = 24;
  var etat = { minuteur: null, principal: null, dernierResultat: null, erreur: null, poste: null, autorise: false, enCours: false };

  function optionsMiroir(cfg) { var m = (cfg && cfg.miroir) || {}; return { attendu: !!m.attendu, nom: String(m.nom || '') }; }

  async function lireEtats() {
    var s = U.App.session;
    try { etat.principal = await s.dossier.lireEtatMiroir(); } catch (e) { etat.principal = null; }
    etat.poste = await SIC.Dossier.miroirPoste();
    etat.autorise = etat.poste ? await etat.poste.autorise(false) : false;
  }

  /** Synchronisation silencieuse (poste relié, accès déjà accordé). */
  async function synchroniser(manuel) {
    var s = U.App.session;
    if (!s || !s.cle || s.formation || U.App.dossier.mode !== 'reseau' || etat.enCours) return null;
    if (etat.principal && etat.principal.role === 'secours') return null;          // on travaille sur le dossier de secours
    if (!etat.poste) etat.poste = await SIC.Dossier.miroirPoste();
    if (!etat.poste) return null;
    if (!(await etat.poste.autorise(!!manuel))) { etat.autorise = false; return null; }
    etat.autorise = true; etat.enCours = true;
    try {
      etat.dernierResultat = await s.synchroniserMiroir(etat.poste, { tracer: !!manuel });
      etat.erreur = null;
      return etat.dernierResultat;
    } catch (e) { etat.erreur = e.message || String(e); if (manuel) throw e; return null; }
    finally { etat.enCours = false; try { etat.principal = await s.dossier.lireEtatMiroir(); } catch (e) { /* lecture impossible */ } }
  }

  function demarrer() {
    arreter();
    var s = U.App.session;
    if (!s || U.App.dossier.mode !== 'reseau') return;
    lireEtats().then(function () { setTimeout(function () { synchroniser(false); }, 8000); }).catch(function () {});
    etat.minuteur = setInterval(function () { if (document.visibilityState === 'visible') synchroniser(false); }, INTERVALLE);
  }
  function arreter() { if (etat.minuteur) clearInterval(etat.minuteur); etat.minuteur = null; }

  /** Points de vigilance (administrateur) : dossier de secours non synchronisé depuis 24 h, ou travail sur le secours. */
  function vigilance() {
    var s = U.App.session, res = [];
    if (!s || !s.peut('CONFIG') || s.formation || U.App.dossier.mode !== 'reseau') return res;
    if (etat.principal && etat.principal.role === 'secours') {
      res.push(h('li', { class: 'urgent' }, h('b', { text: 'Dossier de secours' }), ' — vous travaillez sur le dossier de secours. Dès que le dossier principal est de nouveau accessible, ouvrez-le et synchronisez (Administration → Informations) : les saisies faites ici y seront reprises.'));
      return res;
    }
    var o = optionsMiroir(s.etat.config);
    if (!o.attendu) return res;
    var der = etat.principal && etat.principal.derniere ? Date.parse(etat.principal.derniere) : 0;
    var robo = etat.principal && etat.principal.outil === 'robocopy';
    if (!der || Date.now() - der > ALERTE_HEURES * 3600000) res.push(h('li', {}, h('b', { text: 'Dossier de secours' }), ' — ' + (der ? 'dernière synchronisation le ' + U.date(der) : 'jamais synchronisé') + '. ' + (robo
      ? 'La copie est faite par une tâche planifiée robocopy' + (etat.principal.poste ? ' (poste ou serveur ' + etat.principal.poste + ')' : '') + ' : prévenez le service informatique (machine éteinte, tâche arrêtée, accès refusé ?).'
      : 'Reliez un poste utilisé chaque jour au dossier de secours (Administration → Informations).')));
    return res;
  }

  function choisir(id) { return SIC.Dossier.choisirAutre(id); }

  function panneau() {
    var s = U.App.session, zone = h('div', { class: 'pile' }), zoneErr = h('div'), res = h('div');
    var reseau = U.App.dossier.mode === 'reseau';

    async function remplir() {
      await lireEtats();
      U.vider(zone);
      var o = optionsMiroir(s.etat.config), p = etat.principal;
      if (p && p.role === 'secours') {
        zone.appendChild(h('div', { class: 'erreur', text: 'Ce dossier est le dossier de SECOURS de « ' + (p.autre || '?') + ' ». N’y travaillez que si le dossier principal est inaccessible. Au retour du dossier principal, ouvrez-le (« Changer de dossier ») et lancez « Synchroniser maintenant » : les saisies faites ici y seront reprises.' }));
        return;
      }
      zone.appendChild(h('div', { class: 'recap' },
        h('div', { text: 'Dossier de secours : ' + (o.attendu ? '« ' + (o.nom || (p && p.autre) || '?') + ' »' : 'aucun') }),
        h('div', { text: 'Dernière synchronisation : ' + (p && p.derniere ? U.date(Date.parse(p.derniere)) + (p.outil === 'robocopy' ? ' — copie robocopy par la tâche planifiée' + (p.poste ? ' de « ' + p.poste + ' »' : '') : (p.poste ? ' (session de ' + p.poste + ')' : '')) : 'jamais') }),
        h('div', { text: 'Ce poste : ' + (etat.poste ? 'relié au dossier « ' + etat.poste.nom + ' »' + (etat.autorise ? '' : ' — accès à autoriser') : 'non relié') }),
        etat.erreur ? h('div', { class: 'texte-bad', text: 'Dernière tentative : ' + etat.erreur }) : null));
      var actions = h('div', { class: 'actions gauche' });
      if (p && p.outil === 'robocopy' && !o.attendu) actions.appendChild(h('button', { class: 'btn primaire', type: 'button', onclick: function () { action(async function () {
        await U.enregistrerConfig([['miroir', { attendu: true, nom: p.autre || '' }]]);
        U.toast('Copie robocopy surveillée : un point de vigilance apparaîtra après 24 h sans copie.');
      }); } }, 'Surveiller la copie robocopy (alerte après 24 h)'));
      actions.appendChild(h('button', { class: 'btn', type: 'button', disabled: !reseau, onclick: function () { action(async function () {
        var d = await choisir('sic-miroir');
        var nature = await s.controlerMiroir(d);
        if (!confirm(nature === 'vide'
          ? 'Utiliser « ' + d.nom + ' » comme dossier de secours ? Toutes les données chiffrées (sans les exports) y seront copiées, puis tenues à jour par ce poste.'
          : '« ' + d.nom + ' » contient déjà une copie de ces données : relier ce poste à ce dossier de secours ?')) return;
        await SIC.Dossier.relierMiroir(d); etat.poste = d;
        if (!o.attendu || o.nom !== d.nom) await U.enregistrerConfig([['miroir', { attendu: true, nom: d.nom }]]);
        await s.tracer('MIROIR_LIEN', { libelle: 'Poste relié au dossier de secours « ' + d.nom + ' »' });
        var r = await synchroniser(true);
        if (r) U.toast('Dossier de secours à jour : ' + r.versAutre + ' fichier(s) copié(s).');
      }); } }, etat.poste ? 'Changer de dossier de secours…' : (o.attendu ? 'Relier ce poste au dossier de secours…' : 'Choisir un dossier de secours…')));
      if (etat.poste) {
        actions.appendChild(h('button', { class: 'btn primaire', type: 'button', onclick: function () { action(async function () {
          var r = await synchroniser(true);
          if (r) U.toast('Synchronisation faite : ' + r.versAutre + ' fichier(s) copié(s) vers le secours, ' + r.depuisAutre + ' repris du secours.');
          else U.toast('Synchronisation impossible : accès au dossier de secours refusé.');
        }); } }, etat.autorise ? 'Synchroniser maintenant' : 'Autoriser l’accès et synchroniser'));
        actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { action(async function () {
          await SIC.Dossier.relierMiroir(null); etat.poste = null; U.toast('Ce poste n’est plus relié au dossier de secours.');
        }); } }, 'Délier ce poste'));
      }
      if (o.attendu) actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { action(async function () {
        if (!confirm('Ne plus utiliser de dossier de secours ? Le dossier de secours n’est pas effacé, mais il ne sera plus tenu à jour ni surveillé.')) return;
        await SIC.Dossier.relierMiroir(null); etat.poste = null;
        await U.enregistrerConfig([['miroir', { attendu: false, nom: '' }]]);
      }); } }, 'Ne plus utiliser de dossier de secours'));
      zone.appendChild(actions);
    }
    async function action(fn) {
      U.erreurDans(zoneErr, null);
      try { await fn(); } catch (e) { if (e && e.name === 'AbortError') return; U.erreurDans(zoneErr, e); }
      remplir().catch(function () {});
    }

    // Déplacement des données
    var progres = h('small', { class: 'muted' });
    var deplacer = h('button', { class: 'btn', type: 'button', disabled: !reseau || s.formation, onclick: async function () {
      U.erreurDans(zoneErr, null);
      try {
        var cible = await choisir('sic-deplacement');
        if (!confirm('Déplacer toutes les données vers « ' + cible.nom + ' » ?\n\nChaque fichier est copié puis relu. Ensuite, l’ancien dossier « ' + U.App.dossier.nom + ' » ne s’ouvrira plus : chaque poste devra choisir le nouveau dossier (« Changer de dossier »). Prévenez les équipes et évitez toute saisie pendant le déplacement.')) return;
        deplacer.disabled = true;
        var n = await s.deplacerDonnees(cible, function (i, total) { progres.textContent = i + ' / ' + total + ' fichier(s) copié(s)…'; });
        await cible.retenir();
        alert(n + ' fichier(s) copié(s) et vérifié(s). L’outil s’ouvre maintenant sur « ' + cible.nom + ' » : reconnectez-vous. Communiquez le nouveau dossier au service informatique (sauvegardes) et aux autres postes.');
        await SIC.Dossier.relierMiroir(null);
        U.App.dossier = cible;
        location.reload();
      } catch (e) { deplacer.disabled = false; if (e && e.name === 'AbortError') return; U.erreurDans(zoneErr, e); }
    } }, 'Déplacer les données vers un nouveau dossier…');

    remplir().catch(function (e) { U.erreurDans(zoneErr, e); });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Dossier de secours et déplacement des données' }),
      h('p', { class: 'muted', text: 'Dossier de secours : un second dossier, de préférence sur un autre serveur, qui reçoit une copie des données chiffrées (coffre, saisies, repères ; ni les exports, ni le jeu de formation). Il est tenu à jour par chaque poste relié, à la connexion puis toutes les 10 minutes ; reliez au moins un poste utilisé chaque jour (le navigateur demande l’accès au dossier une première fois). Si le dossier principal devient inaccessible, ouvrez le dossier de secours avec « Changer de dossier » : il s’utilise normalement (mêmes comptes, mêmes mots de passe) ; au retour du dossier principal, ouvrez-le et synchronisez : les saisies faites entre-temps sont reprises. Il ne remplace pas les sauvegardes du service informatique. Autre possibilité, sans poste relié : une copie par robocopy, tâche planifiée du service informatique (kit, document 09) ; le retour après une panne se fait alors ici, en reliant ce poste au dossier de secours puis « Synchroniser maintenant ».' }),
      zoneErr, zone, res,
      h('h3', { text: 'Déplacer les données' }),
      h('p', { class: 'muted', text: 'Pour changer de serveur ou de partage : choisissez un dossier vide ; toutes les données (exports compris) y sont copiées et vérifiées, puis l’ancien dossier est marqué « déplacé » et ne s’ouvre plus. Il n’est pas effacé : le service informatique le supprime après vérification.' }),
      h('div', { class: 'actions gauche' }, deplacer, progres));
  }

  /** Écran d'un dossier déplacé (avant connexion). */
  function ecranDeplace(dep) {
    return h('div', { class: 'ecran' }, h('div', { class: 'carte' },
      h('h1', { text: 'Données déplacées' }),
      h('p', { text: 'Les données de ce dossier (« ' + U.App.dossier.nom + ' ») ont été déplacées' + (dep.le ? ' le ' + U.date(Date.parse(dep.le)) : '') + ' vers le dossier « ' + (dep.vers || '?') + ' »' + (dep.par ? ' par ' + dep.par : '') + '.' }),
      h('p', { text: 'Choisissez le nouveau dossier. Si vous ne savez pas où il se trouve, demandez-le au cadre de santé ou au service informatique.' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn primaire', onclick: function () { U.changerDossier(); } }, 'Changer de dossier'))));
  }

  U.miroir = { demarrer: demarrer, arreter: arreter, vigilance: vigilance, panneau: panneau, ecranDeplace: ecranDeplace, synchroniser: synchroniser, etat: etat };
})();
