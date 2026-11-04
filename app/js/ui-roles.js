// SPDX-License-Identifier: EUPL-1.2
/*
 * Rôles et accès (Administration → Comptes et sécurité) : libellé et accès des rôles fournis (IDE, AS,
 * Secrétaire, Cadre de santé), création de rôles propres à l'établissement, rôle Administrateur fixe.
 * Réglage `config.roles`, enregistré par une saisie CONFIG (tracée au journal, annulable).
 * Règles : model.js (ACCES, rolesConfig, peut, voitTousServices, exigeService).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  function comptesAvec(code) {
    return (U.App.session.comptes || []).filter(function (c) { return c.actif !== false && (c.roles || []).indexOf(code) >= 0; });
  }

  function nouveauCode(libelle, pris) {
    var base = 'R_' + (String(libelle).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20).replace(/^_+|_+$/g, '') || 'ROLE');
    var code = base, k = 2;
    while (pris.indexOf(code) >= 0) code = base + '_' + k++;
    return code;
  }

  var LIB_ONGLETS = { tableau: 'Tableau de bord', mesures: 'Mesures', patients: 'Patients', jld: 'JLD', surveillance: 'Surveillance CSI', registre: 'Registre', stats: 'Statistiques' };
  function libOnglets(l) { return l.length ? l.map(function (o) { return U.lieu(LIB_ONGLETS[o]); }).join(', ') : 'aucun'; }
  function libJournal(c) { var n = M.NIVEAUX_JOURNAL.filter(function (x) { return x.code === c; })[0]; return n ? n.libelle : c; }
  function minuscule(t) { return t.charAt(0).toLowerCase() + t.slice(1); }
  function resumeAcces(acces) {
    return acces.length ? M.ACCES.filter(function (a) { return acces.indexOf(a.code) >= 0; }).map(function (a) { return minuscule(U.lieu(a.libelle)); }).join(', ') : 'aucun accès (consultation seule)';
  }

  function panneau() {
    var cfg = U.config();
    // Copie de travail des rôles réglables (l'administrateur est fixe)
    var liste = M.rolesConfig(cfg).filter(function (r) { return !r.admin; }).map(function (r) {
      return { code: r.code, libelle: r.libelle, acces: r.acces.slice(), services: r.services, journal: r.journal, registreSeul: !!r.registreSeul, ongletsMasques: r.ongletsMasques.slice(), fourni: r.fourni };
    });
    var avant = JSON.parse(JSON.stringify(liste));
    var zone = h('div', { class: 'pile' }), zoneErr = h('div');

    function carte(r) {
      var lib = h('input', { type: 'text', maxlength: 40, value: r.libelle, 'aria-label': 'Libellé du rôle', oninput: function () { r.libelle = lib.value; } });
      var cases = M.ACCES.map(function (a) {
        var cb = h('input', { type: 'checkbox', checked: r.acces.indexOf(a.code) >= 0, onchange: function () {
          r.acces = M.ACCES.map(function (x) { return x.code; }).filter(function (c) { return c === a.code ? cb.checked : r.acces.indexOf(c) >= 0; });
        } });
        return h('label', { class: 'case' }, cb, h('span', { text: U.lieu(a.libelle) }));
      });
      var tous = h('input', { type: 'checkbox', checked: !r.services, onchange: function () { r.services = !tous.checked; } });
      var n = comptesAvec(r.code).length;
      var noteJournal = h('small', { class: 'alerte-champ' });
      function majNote() {
        var arbitre = r.acces.indexOf('annulation') >= 0 && (r.journal === 'aucun' || r.journal === 'siennes');
        noteJournal.textContent = arbitre ? 'Ce rôle peut annuler des saisies : les saisies en conflit s’arbitrent dans le journal, qui doit montrer au moins les saisies de ses services.' : '';
        noteJournal.hidden = !arbitre;
      }
      var selJournal = h('select', { 'aria-label': 'Journal des saisies', onchange: function () { r.journal = selJournal.value; majNote(); } },
        M.NIVEAUX_JOURNAL.map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: r.journal === x.code }); }));
      majNote();
      // Rôle « registre seulement » (rôles créés) : remplace les accès et le journal
      var grilleAcces = h('div', { class: 'grille-acces' }, cases), blocJournal = h('label', {}, 'Journal des saisies', selJournal);
      // Onglets masquables (Surveillance CSI, Registre, Statistiques) : cochés = affichés
      var blocOnglets = h('div', { class: 'pile' }, h('span', { text: 'Onglets affichés' }), h('div', { class: 'actions gauche' }, M.ONGLETS_MASQUABLES.map(function (o) {
        var cb = h('input', { type: 'checkbox', checked: r.ongletsMasques.indexOf(o) < 0, onchange: function () {
          r.ongletsMasques = M.ONGLETS_MASQUABLES.filter(function (x) { return x === o ? !cb.checked : r.ongletsMasques.indexOf(x) >= 0; });
        } });
        return h('label', { class: 'case' }, cb, h('span', { text: U.lieu(LIB_ONGLETS[o]) }));
      })), h('small', { class: 'muted', text: 'Le journal se règle ci-dessous (« Journal des saisies ») ; l’onglet Administration est réservé à l’administrateur. Un agent qui cumule des rôles voit un onglet dès qu’un de ses rôles l’affiche. Masquer le JLD ou la surveillance retire aussi leurs éléments du tableau de bord.' }));
      var cbAnonyme = r.fourni ? null : h('input', { type: 'checkbox', checked: !!r.registreSeul, onchange: function () { r.registreSeul = cbAnonyme.checked; majAnonyme(); } });
      var noteAnonyme = h('small', { class: 'muted', text: 'Seul l’onglet Registre est ouvert, tel qu’il s’affiche habituellement (patients désignés par leur identifiant, IPP, et leur âge ; psychiatre et soignants chargés de la surveillance) : ni mesures, ni fiches patient, ni journal, ni fenêtre des exports, aucune saisie. Les agents peuvent l’imprimer et l’enregistrer en PDF ou en CSV. Exemple : membre d’une instance, direction, chargé de qualité.' });
      function majAnonyme() { var a = !!r.registreSeul; grilleAcces.hidden = a; blocJournal.hidden = a; blocOnglets.hidden = a; noteJournal.hidden = a || noteJournal.hidden; noteAnonyme.hidden = !a; }
      majAnonyme();
      return h('fieldset', { class: 'role' },
        h('legend', {}, r.libelle || r.code),
        h('div', { class: 'grille-2' }, h('label', {}, 'Libellé', lib),
          h('div', { class: 'muted' }, h('small', { text: (r.fourni ? 'Rôle fourni avec l’outil' : 'Rôle propre à l’établissement') + ' — code ' + r.code + ' — ' + n + ' compte(s) actif(s)' }))),
        cbAnonyme ? h('label', { class: 'case' }, cbAnonyme, h('span', { text: 'Accès limité au registre (consultation seule)' })) : null, noteAnonyme,
        grilleAcces,
        h('label', { class: 'case' }, tous, h('span', { text: 'Accès à tous les services (sans affectation de services au compte), par exemple pour une direction des soins' })),
        blocOnglets, blocJournal, noteJournal,
        h('div', { class: 'actions gauche' },
          r.fourni ? h('button', { class: 'btn petit', type: 'button', onclick: function () {
            r.acces = M.accesDefaut(r.code); r.ongletsMasques = []; r.services = true; r.libelle = M.ROLES[r.code]; r.journal = M.rolesConfig({}).filter(function (x) { return x.code === r.code; })[0].journal; dessiner();
          } }, 'Rétablir les droits par défaut') : null,
          !r.fourni ? h('button', { class: 'btn petit danger', type: 'button', disabled: n > 0, title: n ? 'Retirez d’abord ce rôle des ' + n + ' compte(s) qui le portent.' : '', onclick: function () {
            liste.splice(liste.indexOf(r), 1); dessiner();
          } }, n ? 'Supprimer (rôle encore attribué)' : 'Supprimer ce rôle') : null));
    }

    function dessiner() {
      U.vider(zone);
      liste.forEach(function (r) { zone.appendChild(carte(r)); });
      zone.appendChild(h('fieldset', { class: 'role' }, h('legend', { text: M.ROLES.ADMIN }),
        h('small', { class: 'muted', text: 'Rôle fixe : réglages, comptes et clés, imports, annulation de toute saisie, intégrité des données, accès à tous les services, journal complet. Il ne se modifie pas, pour qu’un établissement ne puisse pas perdre l’accès aux réglages ; il se cumule avec un autre rôle.' })));
    }

    var modele = h('select', { 'aria-label': 'Modèle du nouveau rôle' }, h('option', { value: '', text: 'aucun accès' }), h('option', { value: '__anonyme', text: 'registre seulement' }),
      liste.map(function (r) { return h('option', { value: r.code, text: 'copie de « ' + r.libelle + ' »' }); }));
    var nomNouveau = h('input', { type: 'text', maxlength: 40, placeholder: 'Ex. : Interne, Direction des soins, Psychologue…' });
    var ajout = h('div', { class: 'actions gauche' },
      h('label', {}, 'Nouveau rôle', nomNouveau), h('label', {}, 'À partir de', modele),
      h('button', { class: 'btn', type: 'button', onclick: function () {
        U.erreurDans(zoneErr, null);
        var libelle = nomNouveau.value.trim();
        if (!libelle) return U.erreurDans(zoneErr, new Error('Indiquez le libellé du nouveau rôle.'));
        var src = liste.filter(function (x) { return x.code === modele.value; })[0];
        liste.push({ code: nouveauCode(libelle, liste.map(function (x) { return x.code; }).concat(['ADMIN'])), libelle: libelle, acces: src ? src.acces.slice() : [], services: src ? src.services : true, journal: src ? src.journal : 'services', ongletsMasques: src ? src.ongletsMasques.slice() : [], registreSeul: modele.value === '__anonyme' || !!(src && src.registreSeul), fourni: false });
        nomNouveau.value = ''; dessiner();
      } }, '+ Ajouter'));

    dessiner();
    return h('section', { class: 'panneau' }, h('h2', { text: 'Rôles et accès' }),
      h('p', { class: 'muted', text: 'Chaque compte porte un ou plusieurs rôles ; ses accès sont la réunion de ceux de ses rôles. Tous les agents voient les données de leurs services ; les accès ci-dessous ouvrent les saisies et actions. Un rôle sans accès donne une consultation seule. Le journal des saisies montre, selon le rôle, tout le journal, les saisies des services de l’agent, ses propres saisies, ou rien ; un agent qui cumule des rôles a le niveau le plus large. Les changements s’appliquent à la prochaine actualisation de chaque poste et sont tracés au journal.' }),
      zoneErr, zone, ajout,
      U.boutonEnregistrer(async function () {
        var vus = {}, valeur = {};
        liste.forEach(function (r) {
          var l = String(r.libelle || '').trim();
          if (!l) throw new Error('Un rôle n’a pas de libellé.');
          if (vus[l.toLowerCase()] || l.toLowerCase() === M.ROLES.ADMIN.toLowerCase()) throw new Error('Deux rôles portent le libellé « ' + l + ' ».');
          if (!r.registreSeul && r.ongletsMasques.length === M.ONGLETS_MASQUABLES.length && r.journal === 'aucun') throw new Error('Le rôle « ' + l + ' » n’affiche aucun onglet : laissez au moins un onglet ou le journal.');
          vus[l.toLowerCase()] = 1;
          valeur[r.code] = { libelle: l, acces: r.registreSeul ? [] : r.acces.slice(), services: !!r.services, journal: r.journal };
          if (!r.registreSeul && r.ongletsMasques.length) valeur[r.code].ongletsMasques = r.ongletsMasques.slice();
          if (r.registreSeul) valeur[r.code].registreSeul = true;
        });
        // Résumé des changements, à confirmer
        var lignes = [];
        liste.forEach(function (r) {
          var a = avant.filter(function (x) { return x.code === r.code; })[0], n = comptesAvec(r.code).length;
          if (!a) { lignes.push('Nouveau rôle « ' + r.libelle + ' » : ' + (r.registreSeul ? 'registre seulement' : resumeAcces(r.acces) + ' ; journal : ' + minuscule(libJournal(r.journal))) + '.'); return; }
          var plus = r.acces.filter(function (x) { return a.acces.indexOf(x) < 0; }), moins = a.acces.filter(function (x) { return r.acces.indexOf(x) < 0; });
          var ch = [];
          if (a.libelle !== r.libelle.trim()) ch.push('renommé « ' + r.libelle.trim() + ' »');
          if (plus.length) ch.push('accès ajoutés : ' + resumeAcces(plus));
          if (moins.length) ch.push('accès retirés : ' + resumeAcces(moins));
          if (a.services !== r.services) ch.push(r.services ? 'limité aux services affectés' : 'accès à tous les services');
          if (a.journal !== r.journal && !r.registreSeul) ch.push('journal : ' + minuscule(libJournal(r.journal)));
          if (!r.registreSeul && a.ongletsMasques.join() !== r.ongletsMasques.join()) ch.push('onglets masqués : ' + libOnglets(r.ongletsMasques));
          if (!!a.registreSeul !== !!r.registreSeul) ch.push(r.registreSeul ? 'accès limité au registre' : 'accès complet rétabli selon les cases cochées');
          if (ch.length) lignes.push('« ' + a.libelle + ' » (' + n + ' compte(s)) : ' + ch.join(' ; ') + '.');
        });
        avant.forEach(function (a) { if (!liste.some(function (r) { return r.code === a.code; })) lignes.push('Rôle « ' + a.libelle + ' » supprimé.'); });
        if (!lignes.length) { U.toast('Aucun changement.'); return; }
        if (!confirm('Enregistrer ces changements de rôles ?\n\n' + lignes.join('\n'))) return;
        await U.enregistrerConfig([['roles', valeur]]);
      }));
  }

  U.roles = { panneau: panneau, resumeAcces: resumeAcces };
})();
