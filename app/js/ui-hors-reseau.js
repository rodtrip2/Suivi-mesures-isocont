// SPDX-License-Identifier: EUPL-1.2
/*
 * Travail hors réseau sur un poste désigné (demande du porteur), Administration → Sauvegardes et exports.
 * 1. L'outil : mise en cache par le navigateur (app/sw.js), possible seulement si l'outil est servi en HTTPS
 *    (intranet ou page GitHub). Sans HTTPS (outil ouvert depuis le partage), le service informatique copie
 *    l'outil sur le poste (kit/outils/copie-locale-outil.ps1, document 10).
 * 2. Les données : copie locale de ce poste (dossier sur son disque), tenue à jour comme un dossier de secours
 *    (ui-miroir.js) et ouverte en cas de panne depuis l'écran d'accueil.
 * Le choix est propre au poste (localStorage `sic-hors-reseau`, IndexedDB `miroirLocal`) et tracé au journal.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, h = U.h;
  var CLE = 'sic-hors-reseau';

  function possible() { return 'serviceWorker' in navigator && self.isSecureContext && /^https?:$/.test(location.protocol); }
  function demande() { try { return localStorage.getItem(CLE) === '1'; } catch (e) { return false; } }

  async function enregistrement() { try { return possible() ? await navigator.serviceWorker.getRegistration('./') : null; } catch (e) { return null; } }

  /** Au chargement : le poste choisi garde son enregistrement ; un poste non choisi n'en garde aucun. */
  async function demarrer() {
    if (!possible()) return;
    if (demande()) { try { await navigator.serviceWorker.register('sw.js', { scope: './' }); } catch (e) { /* réessayé au prochain chargement */ } }
    else { var r = await enregistrement(); if (r) { await r.unregister(); try { await caches.delete('sic-outil'); } catch (e) { /* rien à supprimer */ } } }
  }

  /** État de la mise en cache : 'impossible' | 'inactif' | 'installation' | 'pret'. */
  async function etat() {
    if (!possible()) return 'impossible';
    if (!demande()) return 'inactif';
    var r = await enregistrement();
    if (r && r.active) return 'pret';
    return 'installation';
  }

  async function activer() {
    if (!possible()) throw new Error('Mise en cache impossible : l’outil doit être ouvert en HTTPS (intranet ou page GitHub). Sinon, demandez au service informatique une copie de l’outil sur ce poste (document 10 du kit).');
    try { localStorage.setItem(CLE, '1'); } catch (e) { throw new Error('Le navigateur refuse d’enregistrer ce réglage sur ce poste.'); }
    var r = await navigator.serviceWorker.register('sw.js', { scope: './' });
    await new Promise(function (ok, ko) {
      var w = r.installing || r.waiting;
      if (!w) return ok();
      var t = setTimeout(function () { ok(); }, 60000);
      w.addEventListener('statechange', function () {
        if (w.state === 'activated') { clearTimeout(t); ok(); }
        if (w.state === 'redundant') { clearTimeout(t); ko(new Error('La mise en cache a échoué (fichier inaccessible ou empreinte différente : version en cours de publication ?). Réessayez dans quelques minutes.')); }
      });
    });
  }
  async function desactiver() {
    try { localStorage.removeItem(CLE); } catch (e) { /* sans effet */ }
    var r = await enregistrement(); if (r) await r.unregister();
    try { await caches.delete('sic-outil'); } catch (e) { /* rien à supprimer */ }
  }

  /** Section du panneau « Dossier de secours » : ce poste hors réseau. */
  function section(apres) {
    var s = U.App.session, zone = h('div', { class: 'pile' }), zoneErr = h('div');
    async function remplir() {
      U.vider(zone);
      var e = await etat(), local = await SIC.Dossier.miroirPoste('local');
      var lib = { impossible: 'impossible ici (outil ouvert sans HTTPS) — copie de l’outil sur le poste par le service informatique, document 10 du kit', inactif: 'non', installation: 'demandée, en cours de mise en place', pret: 'oui, l’outil s’ouvre même sans réseau' }[e];
      zone.appendChild(h('div', { class: 'recap' },
        h('div', { text: 'Outil disponible hors réseau sur ce poste : ' + lib }),
        h('div', { text: 'Copie locale des données sur ce poste : ' + (local ? '« ' + local.nom + ' »' : 'aucune') })));
      var actions = h('div', { class: 'actions gauche' });
      if (e === 'inactif' || e === 'installation') actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { faire(async function () {
        await activer(); await s.tracer('HORS_RESEAU', { libelle: 'Outil mis en cache sur ce poste' }); U.toast('L’outil est disponible hors réseau sur ce poste.');
      }); } }, 'Garder l’outil disponible hors réseau sur ce poste'));
      if (e === 'pret') actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { faire(async function () {
        await desactiver(); await s.tracer('HORS_RESEAU', { libelle: 'Mise en cache de l’outil retirée de ce poste' });
      }); } }, 'Retirer l’outil du cache de ce poste'));
      actions.appendChild(h('button', { class: 'btn', type: 'button', disabled: U.App.dossier.mode !== 'reseau', onclick: function () { faire(async function () {
        await U.miroir.relierLocal(); if (apres) apres();
      }); } }, local ? 'Changer la copie locale des données…' : 'Créer une copie locale des données sur ce poste…'));
      actions.appendChild(h('button', { class: 'btn', type: 'button', title: 'Copie tenue à jour même quand l’outil n’est pas ouvert (tâche planifiée Windows)', onclick: function () { U.miroir.assistantRobocopy('local'); } }, 'Tenir la copie locale à jour par robocopy…'));
      if (local) actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { faire(async function () {
        if (!confirm('Ne plus tenir à jour la copie locale de ce poste ? Le dossier n’est pas effacé : supprimez-le ensuite (données de santé chiffrées).')) return;
        await SIC.Dossier.relierMiroir(null, 'local'); await s.tracer('HORS_RESEAU', { libelle: 'Copie locale des données retirée de ce poste (« ' + local.nom + ' »)' });
      }); } }, 'Retirer la copie locale'));
      zone.appendChild(actions);
    }
    async function faire(fn) {
      U.erreurDans(zoneErr, null);
      try { await fn(); } catch (e) { if (e && e.name === 'AbortError') return; U.erreurDans(zoneErr, e); }
      remplir().catch(function () {});
    }
    remplir().catch(function (e) { U.erreurDans(zoneErr, e); });
    return h('div', {}, h('h3', { text: 'Travail hors réseau sur ce poste' }),
      h('p', { class: 'muted', text: 'Pour les postes désignés par l’établissement (liste tenue à jour, disque chiffré par BitLocker, accord du délégué à la protection des données) : l’outil reste utilisable pendant une panne du réseau. Il faut l’outil (mis en cache par le navigateur si l’outil est servi en HTTPS, sinon copié sur le poste par le service informatique) et une copie locale des données, chiffrée, tenue à jour toutes les 10 minutes. En cas de panne : bouton « Travailler hors réseau » de l’écran d’accueil. Au retour du réseau, les saisies faites sur le poste sont reprises automatiquement, sans rien écraser.' }),
      zoneErr, zone);
  }

  // ------------------------------------------------------------ Installation comme application (fenêtre séparée)
  // Edge et Chrome proposent d'installer l'outil (manifeste, display « standalone ») : il s'ouvre alors dans sa propre
  // fenêtre, avec son icône, depuis le bureau ou le menu Démarrer. HTTPS requis (intranet ou page GitHub).
  var invite = null;
  self.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); invite = ev; if (U.rendreContenu) { try { majBoutonsInstaller(); } catch (e) { /* écran sans bouton */ } } });
  self.addEventListener('appinstalled', function () { invite = null; majBoutonsInstaller(); U.toast && U.toast('Outil installé : il s’ouvre désormais dans sa propre fenêtre (icône sur le bureau et dans le menu Démarrer).'); });
  function enFenetre() { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches; } catch (e) { return false; } }
  var boutons = [];
  function majBoutonsInstaller() { boutons = boutons.filter(function (b) { return document.contains(b); }); boutons.forEach(function (b) { b.hidden = !invite || enFenetre(); }); }
  /** Bouton « Installer comme application » (visible seulement quand le navigateur le permet). */
  function boutonInstaller(classe) {
    var b = h('button', { class: classe || 'btn petit', type: 'button', hidden: !invite || enFenetre(), title: 'Ouvrir l’outil dans sa propre fenêtre, avec son icône sur le bureau', onclick: async function () {
      if (!invite) return;
      var e = invite; invite = null;
      try { await e.prompt(); await e.userChoice; } catch (er) { /* refus ou fermeture */ }
      majBoutonsInstaller();
    } }, 'Installer comme application');
    boutons.push(b);
    return b;
  }

  U.horsReseau = { boutonInstaller: boutonInstaller, enFenetre: enFenetre, demarrer: demarrer, etat: etat, activer: activer, desactiver: desactiver, section: section, possible: possible };
})();
