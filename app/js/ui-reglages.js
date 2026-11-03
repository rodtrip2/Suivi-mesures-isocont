// SPDX-License-Identifier: EUPL-1.2
/*
 * Export et import des réglages (demande du porteur), Administration → Sauvegardes et exports.
 * Usages : reporter dans le dossier des données réelles le paramétrage préparé et validé dans un dossier d'essai ;
 * partager un paramétrage avec un autre établissement ; garder une trace du paramétrage.
 * Le fichier (JSON en clair) ne contient que le paramétrage : aucune donnée de patient, aucun compte, aucun mot de
 * passe. Il peut contenir des noms (psychiatres, contact) : groupes à décocher avant de le partager.
 * L'import est un lot de saisies CONFIG (une ligne au journal, annulable en une fois) ; la logique est dans
 * model.js (exporterReglages, analyserReglages, reglagesAImporter).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  function nomFichier(cfg) {
    var etab = String(cfg.etablissement || 'etablissement').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'etablissement';
    return 'reglages_' + etab + '_' + M.dateLocaleISO(Date.now()) + '.json';
  }

  /** Comptes et mesures : services et rôles en usage, que l'import ne doit jamais retirer. */
  function contexte() {
    var s = U.App.session, sv = {}, ro = {};
    M.listeMesures(U.st()).forEach(function (m) { if (m.service) sv[m.service] = 1; (m.segments || []).forEach(function (x) { if (x.service) sv[x.service] = 1; }); });
    (s.comptes || []).forEach(function (c) { (c.services || []).forEach(function (x) { sv[x] = 1; }); (c.roles || []).forEach(function (r) { ro[r] = 1; }); });
    return { servicesUtilises: Object.keys(sv), rolesUtilises: Object.keys(ro), maintenant: Date.now() };
  }

  function lireFichier(input) {
    var f = input.files && input.files[0];
    if (!f) return Promise.reject(new Error('Choisissez d’abord le fichier de réglages (.json).'));
    if (f.size > 20 * 1048576) return Promise.reject(new Error('Fichier trop volumineux pour un fichier de réglages.'));
    return f.text().then(function (t) {
      try { return { nom: f.name, contenu: JSON.parse(t) }; } catch (e) { throw new Error('Ce fichier n’est pas lisible (JSON attendu) : ' + f.name); }
    });
  }

  /** Fenêtre d'import : groupes à cocher, changements, avertissements, puis lot de saisies CONFIG. */
  async function examiner(fichier) {
    var s = U.App.session, cfg = U.config(), ctx = contexte();
    var a = M.analyserReglages(fichier.contenu, cfg, ctx);
    var cases = {}, zoneAvert = h('div', { class: 'pile' }), compte = h('p', { class: 'muted' });
    function choisis() { return Object.keys(cases).filter(function (k) { return cases[k].checked; }); }
    function maj() {
      var r = M.reglagesAImporter(a, choisis(), cfg, ctx);
      compte.textContent = r.changements.length ? r.changements.length + ' réglage(s) seront modifiés.' : 'Aucun réglage ne sera modifié.';
      U.vider(zoneAvert);
      r.avertissements.forEach(function (t) { zoneAvert.appendChild(h('div', { class: 'alerte-champ', text: t })); });
    }
    var src = a.source;
    var liste = h('div', { class: 'pile' }, a.groupes.map(function (g) {
      var cb = h('input', { type: 'checkbox', checked: g.change && !g.prudence, disabled: !g.change, onchange: maj });
      cases[g.code] = cb;
      var modifies = g.cles.filter(function (c) { return c.change; });
      return h('div', { class: 'pile' },
        h('label', { class: 'case' }, cb, h('span', { text: g.libelle + (g.change ? '' : ' — identique, rien à importer') })),
        modifies.length ? h('small', { class: 'muted', text: 'Modifié : ' + modifies.map(function (c) { return U.libConfig(c.cle); }).join(' ; ') }) : null,
        g.prudence && g.change ? h('small', { class: 'alerte-champ', text: 'Décoché par prudence : les seuils légaux ne changent qu’en cas d’évolution des textes.' }) : null);
    }));
    maj();
    var contenu = h('div', { class: 'pile' },
      h('div', { class: 'recap' },
        h('div', { text: 'Fichier : ' + fichier.nom }),
        h('div', { text: 'Établissement d’origine : ' + (src.etablissement || 'non renseigné') }),
        h('div', { text: 'Exporté le : ' + (src.exporteLe && !isNaN(Date.parse(src.exporteLe)) ? U.date(Date.parse(src.exporteLe)) : 'date inconnue') + (src.outil ? ' (version ' + src.outil + ' de l’outil)' : '') })),
      h('p', { text: 'Cochez les rubriques à reprendre. Les autres réglages restent inchangés. L’import est inscrit au journal en une seule ligne, annulable en une fois.' }),
      liste,
      a.ignores.length ? h('small', { class: 'muted', text: 'Non repris : ' + a.ignores.map(function (x) { return U.libConfig(x.cle) + ' (' + x.raison + ')'; }).join(' ; ') + '.' }) : null,
      compte, zoneAvert);
    return U.modale('Importer des réglages', contenu, [
      { texte: 'Annuler' },
      { texte: 'Importer', classe: 'primaire', action: async function () {
        var r = M.reglagesAImporter(a, choisis(), cfg, ctx);
        if (!r.changements.length) throw new Error('Aucun réglage à modifier : cochez au moins une rubrique.');
        if (!confirm('Modifier ' + r.changements.length + ' réglage(s) de l’établissement à partir de ce fichier ?')) return false;
        await s.enregistrerLot(r.changements.map(function (c) { return { type: 'CONFIG', data: { cle: c[0], valeur: c[1] } }; }),
          { libelle: 'Import des réglages « ' + fichier.nom + ' »' + (src.etablissement ? ' (' + src.etablissement + ')' : '') + ' : ' + r.changements.map(function (c) { return U.libConfig(c[0]); }).join(', ') });
        if (r.changements.some(function (c) { return c[0] === 'affichage'; })) U.retenirAccueil();
        U.toast(r.changements.length + ' réglage(s) importé(s). Annulable depuis le journal (ligne « Import des réglages »).');
        return true;
      } }], { large: true });
  }

  function panneau() {
    var cfg = U.config(), zoneErr = h('div'), cases = {};
    var groupes = h('div', { class: 'pile' }, M.GROUPES_REGLAGES.map(function (g) {
      var cb = h('input', { type: 'checkbox', checked: true });
      cases[g.code] = cb;
      return h('label', { class: 'case' }, cb, h('span', { text: g.libelle }));
    }));
    function fichierExport() {
      var choix = Object.keys(cases).filter(function (k) { return cases[k].checked; });
      if (!choix.length) throw new Error('Cochez au moins une rubrique à exporter.');
      var f = M.exporterReglages(U.config(), choix, { outil: SIC.VERSION, maintenant: Date.now() });
      return { nom: nomFichier(U.config()), texte: JSON.stringify(f, null, 2) };
    }
    async function faire(fn) { U.erreurDans(zoneErr, null); try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') U.erreurDans(zoneErr, e); } }
    var fichier = h('input', { type: 'file', accept: '.json,application/json' });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Réglages : export et import' }),
      h('p', { class: 'muted', text: 'Pour reporter dans le dossier des données réelles le paramétrage préparé dans un dossier d’essai, pour le partager avec un autre établissement ou pour en garder une trace. Le fichier ne contient que le paramétrage : aucune donnée de patient, aucun compte, aucun mot de passe. Les réglages propres aux données (numérotation du registre antérieur, textes des rapports annuels, dossier de secours) ne sont jamais exportés.' }),
      zoneErr,
      h('h3', { text: 'Exporter' }),
      groupes,
      h('small', { class: 'muted', text: 'Avant de partager le fichier hors de l’établissement, décochez les rubriques qui contiennent des noms ou des coordonnées (liste des psychiatres ; écran de connexion : contact) et celles qui décrivent l’organisation interne (exports : chemin réseau).' }),
      h('div', { class: 'actions gauche' },
        h('button', { class: 'btn', type: 'button', onclick: function () { faire(async function () {
          var f = fichierExport();
          await U.exporter('reglages', f.nom, f.texte, 'application/json', { service: M.DOSSIER_ETABLISSEMENT });
        }); } }, 'Enregistrer dans le dossier des exports'),
        h('button', { class: 'btn', type: 'button', onclick: function () { faire(async function () {
          var f = fichierExport();
          U.telechargerOctets(f.nom, new TextEncoder().encode(f.texte), 'application/json');
          await U.App.session.tracer('REGLAGES_EXPORT', { libelle: f.nom });
        }); } }, 'Télécharger')),
      h('h3', { text: 'Importer' }),
      h('p', { class: 'muted', text: 'Choisissez un fichier de réglages exporté par l’outil. Vous verrez les rubriques qui changent et choisirez celles à reprendre avant toute modification. Les services et rôles utilisés dans ces données ne sont jamais retirés ; les alertes importées ne s’appliquent qu’aux mesures saisies ensuite.' }),
      h('div', { class: 'actions gauche' }, h('label', {}, 'Fichier de réglages (.json)', fichier),
        h('button', { class: 'btn primaire', type: 'button', onclick: function () { faire(async function () {
          var f = await lireFichier(fichier);
          var ok = await examiner(f);
          if (ok) fichier.value = '';
        }); } }, 'Examiner le fichier…')));
  }

  U.reglages = { panneau: panneau, examiner: examiner };
})();
