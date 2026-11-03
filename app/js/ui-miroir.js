// SPDX-License-Identifier: EUPL-1.2
/*
 * Dossier de secours (miroir) et déplacement des données (Administration → Sauvegardes et exports), demande du porteur.
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
  var etat = { minuteur: null, principal: null, dernierResultat: null, erreur: null, poste: null, autorise: false, local: null, autoriseLocal: false, erreurLocal: null, enCours: false };

  /** Date d'un état (ISO, ou « /Date(n)/ » écrit par une ancienne version de PowerShell). */
  function dateEtat(v) { var m = /Date\((\d+)/.exec(String(v || '')); return m ? +m[1] : Date.parse(v); }
  function optionsMiroir(cfg) { var m = (cfg && cfg.miroir) || {}; return { attendu: !!m.attendu, nom: String(m.nom || '') }; }
  /** Nom de ce poste (saisi à la création d'une copie locale), pour la liste des postes désignés. */
  function nomPoste() { try { return localStorage.getItem('sic-nom-poste') || ''; } catch (e) { return ''; } }

  async function lireEtats() {
    var s = U.App.session;
    try { etat.principal = await s.dossier.lireEtatMiroir(); } catch (e) { etat.principal = null; }
    etat.poste = await SIC.Dossier.miroirPoste('serveur');
    etat.autorise = etat.poste ? await etat.poste.autorise(false) : false;
    etat.local = await SIC.Dossier.miroirPoste('local');
    etat.autoriseLocal = etat.local ? await etat.local.autorise(false) : false;
  }

  /** Dossiers de secours connus du dossier principal : [{ id, nom, type, derniere, poste, outil }]. */
  function miroirsConnus() {
    var p = etat.principal, l = [];
    if (p && p.miroirs) Object.keys(p.miroirs).forEach(function (k) { l.push(Object.assign({ id: k }, p.miroirs[k])); });
    else if (p && p.derniere) l.push({ id: '', nom: p.autre, type: 'serveur', derniere: p.derniere, poste: p.poste, outil: p.outil || 'outil' });
    return l.sort(function (a, b) { return String(b.derniere).localeCompare(String(a.derniere)); });
  }
  /** Dernière copie vers un dossier de secours du service (hors copies locales des postes). */
  function derniereServeur() {
    return miroirsConnus().filter(function (x) { return x.type !== 'local'; })[0] || null;
  }

  /** Synchronisation d'un lien de ce poste ('serveur' ou 'local') ; silencieuse sauf `manuel`. */
  async function synchroniserUn(type, manuel) {
    var s = U.App.session, d = type === 'local' ? etat.local : etat.poste;
    if (!d) return null;
    if (!(await d.autorise(!!manuel))) { if (type === 'local') etat.autoriseLocal = false; else etat.autorise = false; return null; }
    if (type === 'local') etat.autoriseLocal = true; else etat.autorise = true;
    try {
      var r = await s.synchroniserMiroir(d, { tracer: !!manuel, type: type, poste: type === 'local' ? (nomPoste() || 'poste') : '' });
      if (type === 'local') {
        etat.erreurLocal = null;
        try { var el = await d.lireEtatMiroir(); if (el && el.id) localStorage.setItem('sic-id-copie-locale', el.id); } catch (e) { /* sans effet */ }
      } else etat.erreur = null;
      return r;
    } catch (e) { if (type === 'local') etat.erreurLocal = e.message || String(e); else etat.erreur = e.message || String(e); if (manuel) throw e; return null; }
  }
  async function synchroniser(manuel, seulement) {
    var s = U.App.session;
    if (!s || !s.cle || s.formation || U.App.dossier.mode !== 'reseau' || etat.enCours) return null;
    if (etat.principal && etat.principal.role === 'secours') return null;          // on travaille sur un dossier de secours
    if (!etat.poste && !etat.local) await lireEtats();
    etat.enCours = true;
    try {
      var r1 = !seulement || seulement === 'serveur' ? await synchroniserUn('serveur', manuel) : null;
      var r2 = !seulement || seulement === 'local' ? await synchroniserUn('local', manuel) : null;
      etat.dernierResultat = r1 || r2;
      return seulement === 'local' ? r2 : seulement === 'serveur' ? r1 : (r1 || r2);
    } finally { etat.enCours = false; try { etat.principal = await s.dossier.lireEtatMiroir(); } catch (e) { /* lecture impossible */ } }
  }

  function demarrer() {
    arreter();
    var s = U.App.session;
    if (!s || U.App.dossier.mode !== 'reseau') return;
    lireEtats().then(function () { setTimeout(function () { synchroniser(false); }, 8000); }).catch(function () {});
    etat.minuteur = setInterval(function () { if (document.visibilityState === 'visible') synchroniser(false); }, INTERVALLE);
  }
  function arreter() { if (etat.minuteur) clearInterval(etat.minuteur); etat.minuteur = null; }

  /** Points de vigilance (administrateur) : dossier de secours non synchronisé depuis 24 h, ou travail sur un secours. */
  function vigilance() {
    var s = U.App.session, res = [];
    if (!s || s.formation || U.App.dossier.mode !== 'reseau') return res;
    if (etat.principal && etat.principal.role === 'secours') {
      res.push(h('li', { class: 'urgent' }, h('b', { text: etat.principal.type === 'local' ? 'Travail hors réseau' : 'Dossier de secours' }), ' — ' + (etat.principal.type === 'local'
        ? 'vous travaillez sur la copie locale de ce poste. Dès que le réseau revient, verrouillez puis « Reprendre » le dossier habituel : les saisies faites ici y seront reprises automatiquement.'
        : 'vous travaillez sur le dossier de secours. Dès que le dossier principal est de nouveau accessible, ouvrez-le et synchronisez (Administration → Sauvegardes et exports) : les saisies faites ici y seront reprises.')));
      return res;
    }
    if (!s.peut('CONFIG')) return res;
    var o = optionsMiroir(s.etat.config);
    if (!o.attendu) return res;
    var srv = derniereServeur(), der = srv && srv.derniere ? dateEtat(srv.derniere) : 0;
    var robo = srv && srv.outil === 'robocopy';
    if (!der || Date.now() - der > ALERTE_HEURES * 3600000) res.push(h('li', {}, h('b', { text: 'Dossier de secours' }), ' — ' + (der ? 'dernière synchronisation le ' + U.date(der) : 'jamais synchronisé') + '. ' + (robo
      ? 'La copie est faite par une tâche planifiée robocopy' + (srv.poste ? ' (poste ou serveur ' + srv.poste + ')' : '') + ' : prévenez le service informatique (machine éteinte, tâche arrêtée, accès refusé ?).'
      : 'Reliez un poste utilisé chaque jour au dossier de secours (Administration → Sauvegardes et exports).')));
    return res;
  }

  var RETARD_LOCAL_HEURES = 1;
  /** Entrée du dossier principal qui décrit la copie locale de ce poste (par son identifiant, sinon par le nom du poste). */
  function entreeLocale() {
    var id = ''; try { id = localStorage.getItem('sic-id-copie-locale') || ''; } catch (e) { /* sans effet */ }
    var nom = nomPoste().toLowerCase();
    var l = miroirsConnus().filter(function (x) { return x.type === 'local' && ((id && x.id === id) || (nom && String(x.poste || '').toLowerCase() === nom)); });
    return l[0] || null;
  }
  /**
   * Avertissements sur le poste lui-même (tous les agents) : copie locale dont l'accès a été perdu, en échec ou en retard
   * de plus d'une heure, avec un bouton pour réautoriser l'accès et mettre à jour en un clic.
   */
  function vigilanceLocale() {
    var res = [];
    if (!etat.local) return res;
    var e = entreeLocale(), der = e && e.derniere ? dateEtat(e.derniere) : 0;
    var motif = !etat.autoriseLocal ? 'le navigateur n’a plus l’accès au dossier « ' + etat.local.nom + ' »'
      : etat.erreurLocal ? 'mise à jour impossible : ' + etat.erreurLocal
      : (!der || Date.now() - der > RETARD_LOCAL_HEURES * 3600000) ? (der ? 'dernière mise à jour le ' + U.date(der) : 'jamais mise à jour') : '';
    if (!motif) return res;
    var bouton = h('button', { class: 'btn petit primaire', type: 'button', onclick: async function () {
      bouton.disabled = true;
      try { var r = await synchroniser(true, 'local'); U.toast(r ? 'Copie locale à jour (' + r.versAutre + ' fichier(s) copié(s)).' : 'Accès refusé : la copie locale n’a pas été mise à jour.'); }
      catch (err) { U.toast(err.message || String(err)); }
      finally { bouton.disabled = false; U.rendreContenu(); }
    } }, etat.autoriseLocal ? 'Mettre à jour maintenant' : 'Autoriser l’accès et mettre à jour');
    res.push(h('li', { class: 'urgent' }, h('b', { text: 'Copie locale de ce poste (travail hors réseau)' }), ' — ' + motif + '. En cas de panne du réseau, ce poste ne disposerait pas des dernières saisies. ', bouton));
    return res;
  }

  /** Bandeau de l'en-tête (visible de tous les agents du poste, sur tous les onglets). */
  function bandeauLocal() {
    var s = U.App.session;
    if (!s || s.formation || U.App.dossier.mode !== 'reseau' || (etat.principal && etat.principal.role === 'secours')) return null;
    var l = vigilanceLocale();
    if (!l.length) return null;
    return h('div', { class: 'actualisation-attente', role: 'status' }, Array.prototype.slice.call(l[0].childNodes));
  }

  /** Crée (ou change) la copie locale des données de ce poste. */
  /**
   * Création de la copie locale : nom du poste et choix du dossier dans une même fenêtre. Le sélecteur de dossier
   * est ouvert directement par le clic sur « Choisir le dossier… » : le navigateur exige un geste récent de l'agent
   * (une saisie dans prompt() ou une alert() avant le sélecteur fait échouer showDirectoryPicker).
   */
  async function relierLocal() {
    var s = U.App.session;
    var champ = h('input', { type: 'text', maxlength: 40, value: nomPoste(), placeholder: 'Ex. PC-UHP-IDE-1' });
    var fait = await U.modale('Copie locale des données sur ce poste', h('div', { class: 'pile' },
      h('label', {}, 'Nom Windows de ce poste (pour la liste des postes désignés)', champ),
      h('p', { class: 'muted', text: 'Choisissez ensuite un dossier VIDE sur le disque de ce poste (ex. C:\\SuiviIsoCont-local), accessible aux seuls agents habilités. Le disque doit être chiffré (BitLocker).' })), [
      { texte: 'Annuler' },
      { texte: 'Choisir le dossier…', classe: 'primaire', action: async function () {
        var nom = champ.value.trim().slice(0, 40);
        if (!nom) throw new Error('Indiquez le nom du poste.');
        var d;
        try { d = await choisir('sic-local'); } catch (e) { if (e && e.name === 'AbortError') return false; throw e; }
        var nature = await s.controlerMiroir(d);
        if (etat.poste && await etat.poste.memeQue(d)) throw new Error('Ce dossier est déjà le dossier de secours du service : choisissez un dossier sur le disque de ce poste.');
        if (!confirm('Créer la copie locale des données dans « ' + d.nom + ' » ?\n\nLes données de santé, chiffrées, seront copiées sur ce poste et tenues à jour toutes les 10 minutes. À réserver aux postes désignés par l’établissement (disque chiffré, accord du délégué à la protection des données).' + (nature === 'meme' ? '\n\nCe dossier contient déjà une copie de ces données : elle sera complétée.' : ''))) return false;
        try { localStorage.setItem('sic-nom-poste', nom); } catch (e) { /* sans effet */ }
        await SIC.Dossier.relierMiroir(d, 'local'); etat.local = d;
        await s.tracer('HORS_RESEAU', { libelle: 'Copie locale des données créée sur le poste « ' + nom + ' » (dossier « ' + d.nom + ' »)' });
        return true;
      } }], { focus: champ });
    if (!fait) return;
    var r = await synchroniser(true, 'local');
    if (r) U.toast('Copie locale à jour : ' + r.versAutre + ' fichier(s) copié(s).');
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
      var srv = derniereServeur();
      zone.appendChild(h('div', { class: 'recap' },
        h('div', { text: 'Dossier de secours du service : ' + (o.attendu ? '« ' + (o.nom || (srv && srv.nom) || '?') + ' »' : 'aucun') }),
        h('div', { text: 'Dernière synchronisation : ' + (srv && srv.derniere ? U.date(dateEtat(srv.derniere)) + (srv.outil === 'robocopy' ? ' — copie robocopy par la tâche planifiée' + (srv.poste ? ' de « ' + srv.poste + ' »' : '') : (srv.poste ? ' (session de ' + srv.poste + ')' : '')) : 'jamais') }),
        h('div', { text: 'Ce poste : ' + (etat.poste ? 'relié au dossier « ' + etat.poste.nom + ' »' + (etat.autorise ? '' : ' — accès à autoriser') : 'non relié') }),
        etat.erreur ? h('div', { class: 'texte-bad', text: 'Dernière tentative : ' + etat.erreur }) : null));
      var connus = miroirsConnus();
      if (connus.length) zone.appendChild(h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Dossier de secours', 'Nature', 'Tenu à jour par', 'Dernière copie', ''].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, connus.map(function (x) {
          var vieux = !x.derniere || Date.now() - dateEtat(x.derniere) > ALERTE_HEURES * 3600000;
          return h('tr', {}, h('td', { text: x.nom || '—' }),
            h('td', { text: x.type === 'local' ? 'copie locale d’un poste' : x.outil === 'robocopy' ? 'serveur (robocopy)' : 'serveur' }),
            h('td', { text: x.poste || '—' }),
            h('td', { class: vieux ? 'texte-bad nowrap' : 'nowrap', text: x.derniere ? U.date(dateEtat(x.derniere)) : 'jamais' }),
            h('td', {}, x.id && s.peut('CONFIG') ? h('button', { class: 'btn petit', type: 'button', title: 'Pour un poste retiré ou un dossier abandonné : il ne sera plus listé (il revient s’il est de nouveau synchronisé).', onclick: function () { action(async function () {
              if (!confirm('Retirer « ' + (x.nom || x.id) + ' » de la liste ?')) return;
              await s.dossier.oublierMiroir(x.id);
            }); } }, 'Retirer de la liste') : null));
        })))));
      var actions = h('div', { class: 'actions gauche' });
      if (srv && srv.outil === 'robocopy' && !o.attendu) actions.appendChild(h('button', { class: 'btn primaire', type: 'button', onclick: function () { action(async function () {
        await U.enregistrerConfig([['miroir', { attendu: true, nom: srv.nom || '' }]]);
        U.toast('Copie robocopy surveillée : un point de vigilance apparaîtra après 24 h sans copie.');
      }); } }, 'Surveiller la copie robocopy (alerte après 24 h)'));
      actions.appendChild(h('button', { class: 'btn', type: 'button', disabled: !reseau, onclick: function () { action(async function () {
        var d = await choisir('sic-miroir');
        var nature = await s.controlerMiroir(d);
        if (!confirm(nature === 'vide'
          ? 'Utiliser « ' + d.nom + ' » comme dossier de secours ? Toutes les données chiffrées (sans les exports) y seront copiées, puis tenues à jour par ce poste.'
          : '« ' + d.nom + ' » contient déjà une copie de ces données : relier ce poste à ce dossier de secours ?')) return;
        await SIC.Dossier.relierMiroir(d, 'serveur'); etat.poste = d;
        if (!o.attendu || o.nom !== d.nom) await U.enregistrerConfig([['miroir', { attendu: true, nom: d.nom }]]);
        await s.tracer('MIROIR_LIEN', { libelle: 'Poste relié au dossier de secours « ' + d.nom + ' »' });
        var r = await synchroniser(true, 'serveur');
        if (r) U.toast('Dossier de secours à jour : ' + r.versAutre + ' fichier(s) copié(s).');
      }); } }, etat.poste ? 'Changer de dossier de secours…' : (o.attendu ? 'Relier ce poste au dossier de secours…' : 'Choisir un dossier de secours…')));
      if (etat.poste) {
        actions.appendChild(h('button', { class: 'btn primaire', type: 'button', onclick: function () { action(async function () {
          var r = await synchroniser(true, 'serveur');
          if (r) U.toast('Synchronisation faite : ' + r.versAutre + ' fichier(s) copié(s) vers le secours, ' + r.depuisAutre + ' repris du secours.');
          else U.toast('Synchronisation impossible : accès au dossier de secours refusé.');
        }); } }, etat.autorise ? 'Synchroniser maintenant' : 'Autoriser l’accès et synchroniser'));
        actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { action(async function () {
          await SIC.Dossier.relierMiroir(null, 'serveur'); etat.poste = null; U.toast('Ce poste n’est plus relié au dossier de secours.');
        }); } }, 'Délier ce poste'));
      }
      if (o.attendu) actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { action(async function () {
        if (!confirm('Ne plus utiliser de dossier de secours ? Le dossier de secours n’est pas effacé, mais il ne sera plus tenu à jour ni surveillé.')) return;
        await SIC.Dossier.relierMiroir(null, 'serveur'); etat.poste = null;
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
        await SIC.Dossier.relierMiroir(null, 'serveur'); await SIC.Dossier.relierMiroir(null, 'local');
        U.App.dossier = cible;
        location.reload();
      } catch (e) { deplacer.disabled = false; if (e && e.name === 'AbortError') return; U.erreurDans(zoneErr, e); }
    } }, 'Déplacer les données vers un nouveau dossier…');

    remplir().catch(function (e) { U.erreurDans(zoneErr, e); });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Dossier de secours et déplacement des données' }),
      h('p', { class: 'muted', text: 'Dossier de secours : un second dossier, de préférence sur un autre serveur, qui reçoit une copie des données chiffrées (coffre, saisies, repères ; ni les exports, ni le jeu de formation). Il est tenu à jour par chaque poste relié, à la connexion puis toutes les 10 minutes ; reliez au moins un poste utilisé chaque jour (le navigateur demande l’accès au dossier une première fois). Si le dossier principal devient inaccessible, ouvrez le dossier de secours avec « Changer de dossier » : il s’utilise normalement (mêmes comptes, mêmes mots de passe) ; au retour du dossier principal, ouvrez-le et synchronisez : les saisies faites entre-temps sont reprises. Il ne remplace pas les sauvegardes du service informatique. Autre possibilité, sans poste relié : une copie par robocopy, tâche planifiée du service informatique (kit, document 09) ; le retour après une panne se fait alors ici, en reliant ce poste au dossier de secours puis « Synchroniser maintenant ».' }),
      zoneErr, zone, res,
      U.horsReseau.section(function () { remplir().catch(function () {}); }),
      h('h3', { text: 'Déplacer les données' }),
      h('p', { class: 'muted', text: 'Pour changer de serveur ou de partage : choisissez un dossier vide ; toutes les données (exports compris) y sont copiées et vérifiées, puis l’ancien dossier est marqué « déplacé » et ne s’ouvre plus. Il n’est pas effacé : le service informatique le supprime après vérification.' }),
      h('div', { class: 'actions gauche' }, deplacer, progres));
  }

  /** Écran d'un dossier déplacé (avant connexion). */
  function ecranDeplace(dep) {
    return h('div', { class: 'ecran' }, h('div', { class: 'carte' },
      h('h1', { text: 'Données déplacées' }),
      h('p', { text: 'Les données de ce dossier (« ' + U.App.dossier.nom + ' ») ont été déplacées' + (dep.le ? ' le ' + U.date(dateEtat(dep.le)) : '') + ' vers le dossier « ' + (dep.vers || '?') + ' »' + (dep.par ? ' par ' + dep.par : '') + '.' }),
      h('p', { text: 'Choisissez le nouveau dossier. Si vous ne savez pas où il se trouve, demandez-le au cadre de santé ou au service informatique.' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn primaire', onclick: function () { U.changerDossier(); } }, 'Changer de dossier'))));
  }

  U.miroir = { bandeauLocal: bandeauLocal, vigilanceLocale: vigilanceLocale, relierLocal: relierLocal, miroirsConnus: miroirsConnus, demarrer: demarrer, arreter: arreter, vigilance: vigilance, panneau: panneau, ecranDeplace: ecranDeplace, synchroniser: synchroniser, etat: etat };
})();
