// SPDX-License-Identifier: EUPL-1.2
/* Administration des comptes : création en lot et fiches de remise des mots de passe provisoires. */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, C = SIC.crypto, h = U.h;

  function libRoles(r) { return r.map(function (x) { return M.ROLES[x] || x; }).join(', '); }
  function libServices(r, s) { return r.indexOf('ADMIN') >= 0 ? 'tous (administrateur)' : s.map(U.libService).join(', '); }

  // ---------------------------------------------------------- Création en lot
  U.actions.comptesEnLot = function () {
    var session = U.App.session;
    var texte = h('textarea', { rows: 8, class: 'mono', spellcheck: 'false', placeholder: 'Marie DUPONT ; ; IDE ; U1\nPaul MARTIN ; paul.martin ; AS ; U1, U2\nJeanne PETIT ; ; Secrétaire ; tous' });
    var fichier = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain' });
    var roleDefaut = h('select', {}, ['IDE', 'AS', 'SECRETAIRE', 'CADRE'].map(function (r) { return h('option', { value: r, text: M.ROLES[r] }); }));
    var casesSv = {};
    var blocSv = h('div', { class: 'cases-ligne' }, U.tousServices().map(function (x) {
      casesSv[x.code] = h('input', { type: 'checkbox', checked: U.App.service === x.code });
      return h('label', { class: 'case' }, casesSv[x.code], h('span', { text: x.libelle }));
    }));
    var accesForm = h('input', { type: 'checkbox', checked: true });
    var finLot = h('input', { type: 'date', min: M.dateLocaleISO(Date.now()) });
    var apercu = h('div', { class: 'pile' });
    var analyse = [];

    function verifier() {
      U.vider(apercu);
      analyse = SIC.comptes.analyser(texte.value, {
        services: U.tousServices(),
        loginsExistants: session.comptes.map(function (c) { return c.login; }),
        rolesDefaut: [roleDefaut.value],
        servicesDefaut: Object.keys(casesSv).filter(function (k) { return casesSv[k].checked; })
      });
      if (!analyse.length) return;
      var ok = analyse.filter(function (r) { return !r.erreurs.length; }).length;
      apercu.appendChild(h('div', { class: ok === analyse.length ? 'info' : 'alerte', text: ok + ' compte(s) prêt(s) à créer' + (ok < analyse.length ? ', ' + (analyse.length - ok) + ' ligne(s) à corriger (elles ne seront pas créées)' : '') + '.' }));
      apercu.appendChild(h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Ligne', 'Nom', 'Identifiant', 'Rôles', 'Services', ''].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, analyse.map(function (r) {
          return h('tr', { class: r.erreurs.length ? 'ligne-erreur' : '' },
            h('td', { text: String(r.ligne) }), h('td', { text: r.nom }),
            h('td', { class: 'mono' }, r.login, r.loginGenere ? h('small', { class: 'muted', text: ' (proposé)' }) : null),
            h('td', { text: libRoles(r.roles) }), h('td', { text: libServices(r.roles, r.services) }),
            h('td', {}, r.erreurs.length ? h('span', { class: 'badge bad', text: r.erreurs.join(' ; ') }) : h('span', { class: 'badge ok', text: 'ok' })));
        })))));
    }
    var minuteur = null;
    texte.addEventListener('input', function () { clearTimeout(minuteur); minuteur = setTimeout(verifier, 300); });
    roleDefaut.addEventListener('change', verifier);
    Object.keys(casesSv).forEach(function (k) { casesSv[k].addEventListener('change', verifier); });
    fichier.addEventListener('change', async function () {
      var f = fichier.files[0]; if (!f) return;
      var octets = new Uint8Array(await f.arrayBuffer()), t;
      try { t = new TextDecoder('utf-8', { fatal: true }).decode(octets); } catch (e) { t = new TextDecoder('windows-1252').decode(octets); } // CSV enregistré par Excel
      texte.value = t; verifier();
    });

    U.modale('Créer des comptes en lot', h('div', { class: 'pile' },
      h('p', { class: 'muted', text: 'Une ligne par agent : nom affiché ; identifiant ; rôles ; services. Seul le nom est obligatoire : l’identifiant est proposé (prenom.nom), le rôle et les services par défaut s’appliquent aux colonnes vides. Vous pouvez coller des colonnes copiées depuis un tableur, ou choisir un fichier CSV.' }),
      h('label', {}, 'Liste des agents', texte),
      h('label', {}, 'ou fichier CSV', fichier),
      h('div', { class: 'grille-2' }, h('label', {}, 'Rôle par défaut', roleDefaut), h('div', {}, h('b', { text: 'Services par défaut' }), blocSv)),
      h('label', { class: 'case' }, accesForm, h('span', { text: 'Donner à ces comptes l’accès au mode formation' })),
      h('label', {}, 'Dernier jour d’accès (comptes temporaires : intérimaires, vacataires, stagiaires — facultatif)', finLot),
      h('small', { class: 'muted', text: 'Rôles reconnus : IDE, AS (aide-soignant), Secrétaire, Cadre, Administrateur ; plusieurs rôles ou services séparés par des virgules. « tous » affecte tous les services. Chaque compte reçoit un mot de passe provisoire tiré au hasard, à changer obligatoirement à la première connexion.' }),
      apercu), [
      { texte: 'Annuler' },
      { texte: 'Créer les comptes', classe: 'primaire', action: async function () {
        verifier();
        var valides = analyse.filter(function (r) { return !r.erreurs.length; });
        if (!valides.length) throw new Error('Aucun compte valide à créer.');
        if (valides.length < analyse.length && !confirm((analyse.length - valides.length) + ' ligne(s) en erreur seront ignorées. Créer les ' + valides.length + ' autres comptes ?')) return false;
        var liste = valides.map(function (r) { return { nom: r.nom, login: r.login, roles: r.roles, services: r.roles.indexOf('ADMIN') >= 0 ? [] : r.services, motDePasse: C.nouveauMotDePasseProvisoire(), aleatoire: true, formation: accesForm.checked, finValidite: finLot.value }; });
        U.vider(apercu).appendChild(h('div', { class: 'info', text: 'Chiffrement des mots de passe…' }));
        await session.creerComptes(liste, function (n, total) { apercu.firstChild.textContent = 'Chiffrement des mots de passe… ' + n + ' / ' + total; });
        setTimeout(function () { U.actions.fichesRemise(liste, liste.length + ' compte(s) créé(s)'); }, 0);
      } }]);
  };

  // ---------------------------------------------------------- Fiches de remise
  function fiches(liste) {
    var adresse = location.protocol === 'file:' ? 'Application ouverte depuis le partage réseau' : location.origin + location.pathname;
    return h('div', { class: 'fiches-remise' }, liste.map(function (c) {
      return h('section', { class: 'fiche-remise' },
        h('div', { class: 'doc-etab', text: U.etablissement() || 'Suivi des mesures d’isolement et de contention' }),
        h('h2', { text: 'Votre accès — ' + c.nom }),
        h('table', {}, h('tbody', {},
          h('tr', {}, h('th', { text: 'Adresse' }), h('td', { text: adresse })),
          h('tr', {}, h('th', { text: 'Identifiant' }), h('td', { class: 'mono', text: c.login })),
          h('tr', {}, h('th', { text: 'Mot de passe provisoire' }), h('td', { class: 'mono fort', text: c.motDePasse })),
          h('tr', {}, h('th', { text: 'Rôles' }), h('td', { text: libRoles(c.roles) })),
          h('tr', {}, h('th', { text: 'Services' }), h('td', { text: libServices(c.roles, c.services) })),
          c.finValidite ? h('tr', {}, h('th', { text: 'Accès jusqu’au' }), h('td', { text: c.finValidite.split('-').reverse().join('/') + ' inclus' })) : null)),
        h('p', { text: 'À votre première connexion, vous devrez remplacer ce mot de passe par un mot de passe personnel d’au moins 12 caractères. Détruisez ensuite cette fiche.' }));
    }));
  }

  /** Affiche les mots de passe provisoires (une seule fois) avec impression des fiches à découper et export. */
  U.actions.fichesRemise = function (liste, titre) {
    var vus = h('input', { type: 'checkbox' });
    var fermer = { texte: 'Fermer', classe: 'primaire', action: function () {
      if (!vus.checked && !confirm('Les mots de passe provisoires ne seront plus affichés. Fermer quand même ?')) return false;
      return true;
    } };
    U.modale(titre + ' — mots de passe provisoires', h('div', { class: 'pile' },
      h('div', { class: 'alerte', text: 'Ces mots de passe provisoires ne seront plus jamais affichés. Imprimez les fiches (une par agent) et remettez-les en main propre. En cas d’oubli, l’administrateur pourra réinitialiser le mot de passe.' }),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Nom', 'Identifiant', 'Mot de passe provisoire', 'Rôles', 'Services'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, liste.map(function (c) {
          return h('tr', {}, h('td', { text: c.nom }), h('td', { class: 'mono', text: c.login }), h('td', { class: 'mono fort', text: c.motDePasse }), h('td', { text: libRoles(c.roles) }), h('td', { text: libServices(c.roles, c.services) }));
        })))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: function () { U.imprimer(fiches(liste)); } }, 'Imprimer les fiches de remise'),
        h('button', { class: 'btn', onclick: function () {
          var lignes = [['Nom', 'Identifiant', 'Mot de passe provisoire', 'Rôles', 'Services']].concat(liste.map(function (c) { return [c.nom, c.login, c.motDePasse, libRoles(c.roles), libServices(c.roles, c.services)]; }));
          var csv = '﻿' + lignes.map(function (l) { return l.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
          var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'comptes-mots-de-passe-provisoires.csv' });
          document.body.appendChild(a); a.click(); a.remove();
        } }, 'Exporter (CSV)')),
      h('small', { class: 'muted', text: 'Un fichier exporté contient des mots de passe : supprimez-le dès que les fiches sont remises.' }),
      h('label', { class: 'case' }, vus, h('span', { text: 'J’ai imprimé ou noté les mots de passe provisoires.' }))), [fermer]);
  };
})();
