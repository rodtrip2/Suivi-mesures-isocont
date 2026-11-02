// SPDX-License-Identifier: EUPL-1.2
/*
 * Robustesse des données : état des données (Administration → Informations), copie du coffre sous scellé,
 * copie de sauvegarde complète et rappel, contrôle d'intégrité, restauration (coffre perdu ou abîmé,
 * dossier vide). Les fichiers produits restent chiffrés : inutilisables sans un moyen de déblocage.
 * Stockage : store.js (versionsCoffre, restaurerCoffre, copieComplete, restaurerCopie, repères) ;
 * session.js (verifierIntegrite, reparerDepuisCopie, mettreEnQuarantaine, prendreActeIntegrite, copieSousScelle,
 * etatScelle, copieComplete, derniereCopie). Prise d'acte : saisie INTEGRITE, M.filtrerIntegrite.
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

  /** Date d'une saisie d'après le nom de son fichier (horodatage UTC en tête de l'identifiant). */
  function dateDeNom(nom) {
    var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(nom || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
  function agentDeNom(nom) {
    var id = String(nom || '').replace(/\.enc$/, ''), i = id.indexOf('_'), j = id.lastIndexOf('_');
    return i > 0 && j > i ? id.slice(i + 1, j) : '';
  }
  function loginDe(agent) {
    var c = (U.App.session.comptes || []).filter(function (x) { return x.id === agent; })[0];
    return c ? c.login : agent;
  }

  /** Anomalies du dernier contrôle, une ligne par fichier : { nature, chemin, agent, date, conseil }. */
  function lignesAnomalies(r) {
    var s = U.App.session, res = [], parId = {};
    if (!r) return res;
    s.evts.forEach(function (e) { parId[e.id] = e.by; });
    r.fichiersIllisibles.forEach(function (f) { res.push({ nature: 'Fichier illisible (abîmé, modifié ou chiffré par un autre outil)', chemin: f.chemin, agent: agentDeNom(f.nom), date: dateDeNom(f.nom), conseil: 'à restaurer ou mettre en quarantaine' }); });
    var illisibles = {}; r.fichiersIllisibles.forEach(function (f) { illisibles[f.nom.replace(/\.enc$/, '')] = true; });
    r.listeManquants.filter(function (x) { return !illisibles[x.id]; }).forEach(function (x) { res.push({ nature: 'Saisie absente (trou dans le chaînage)', chemin: x.chemin, agent: x.by, date: dateDeNom(x.id), conseil: 'à restaurer' }); });
    r.disparus.forEach(function (nom) { var id = nom.replace(/\.enc$/, ''); res.push({ nature: 'Saisie disparue du partage depuis l’ouverture de la session', chemin: M.cheminEvenement(nom), agent: parId[id] || agentDeNom(nom), date: dateDeNom(nom), conseil: 'à restaurer' }); });
    r.reperes.forEach(function (x) {
      if (x.illisible) res.push({ nature: 'Repère d’intégrité illisible', chemin: 'reperes/' + x.agent + '.enc', agent: x.agent, date: null, conseil: 'se répare à la prochaine saisie de l’agent' });
      else res.push({ nature: (x.attendu - x.present > 0 ? (x.attendu - x.present) + ' saisie(s) de l’agent introuvable(s)' : 'dernière saisie de l’agent introuvable') + ' (' + x.present + ' présente(s) sur ' + x.attendu + ' attendue(s))', chemin: x.dernierManquant ? M.cheminEvenement(x.dernier + '.enc') : 'evenements/ (fichiers de l’agent)', agent: x.agent, date: x.dernierLe ? Date.parse(x.dernierLe) : null, conseil: 'à restaurer' });
    });
    return res;
  }

  /** Texte à transmettre à la DSI : chemins, dates, identifiants de connexion ; aucune donnée de patient. */
  function texteDSI(r) {
    var d = U.App.dossier, lignes = lignesAnomalies(r);
    return ['Suivi des mesures d’isolement et de contention — version ' + SIC.VERSION,
      'Contrôle d’intégrité du ' + U.date(r.verifieLe) + (d && d.handle && d.handle.name ? ' — dossier « ' + d.handle.name + ' »' : ''),
      lignes.length + ' anomalie(s). Chemins relatifs au dossier de l’outil. Merci de rechercher ces fichiers dans les sauvegardes (version la plus récente avant la date indiquée ou peu après) et de nous les restituer à l’identique, sans les ouvrir ni les renommer.',
      ''].concat(lignes.map(function (l) {
      return '- ' + l.chemin + ' | ' + l.nature + ' | ' + (l.date ? 'saisie du ' + U.date(l.date) : 'date inconnue') + ' | agent : ' + loginDe(l.agent) + ' | ' + l.conseil;
    })).join('\n');
  }

  /** Bloc « Anomalies » d'Administration → Informations : détail, copie pour la DSI, réparation, quarantaine, prise d'acte, historique. */
  function blocIntegrite(r, rafraichir) {
    var s = U.App.session, admin = s.peut('INTEGRITE'), zoneErr = h('div'), out = h('div', { class: 'pile' }, zoneErr);
    var lignes = lignesAnomalies(r);
    function erreur(e) { U.erreurDans(zoneErr, e); }
    if (r && lignes.length) {
      var texte = texteDSI(r), repli = h('textarea', { class: 'mono texte-dsi', readonly: true, rows: 8, hidden: true });
      repli.value = texte;
      out.appendChild(h('h4', { text: 'Détail des anomalies' }));
      out.appendChild(h('table', { class: 'stats' },
        h('thead', {}, h('tr', {}, ['Nature', 'Fichier', 'Agent', 'Date de la saisie', 'Que faire'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, lignes.map(function (l) {
          return h('tr', {}, h('td', { text: l.nature }), h('td', { class: 'mono', text: l.chemin }), h('td', { text: s.nomAuteur(l.agent) }), h('td', { text: l.date ? U.date(l.date) : '—' }), h('td', { text: l.conseil }));
        }))));
      out.appendChild(h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: async function () {
        try { await navigator.clipboard.writeText(texte); U.toast('Liste copiée : collez-la dans votre demande à la DSI.'); }
        catch (e) { repli.hidden = false; repli.select(); U.toast('Copie automatique impossible : sélectionnez le texte affiché.'); }
      } }, 'Copier la liste pour la DSI')));
      out.appendChild(repli);
      out.appendChild(h('p', { class: 'muted', text: 'La liste ne contient que des chemins de fichiers, des dates et des identifiants de connexion : aucune donnée de patient. Si de nombreux fichiers deviennent illisibles en même temps, prévenez aussi le RSSI (attaque possible, voir la fiche « Alerte d’intégrité » du kit).' }));

      if (admin) {
        // Réparation depuis une copie complète
        if (!s.formation) {
          var fichier = h('input', { type: 'file', accept: '.json,application/json' });
          out.appendChild(h('h4', { text: 'Réparer depuis une copie de sauvegarde' }));
          out.appendChild(h('p', { class: 'muted', text: 'Choisissez la copie de sauvegarde complète la plus récente (fichier téléchargé depuis cet écran, ou restitué par la DSI). L’outil ne remet que les fichiers absents ou illisibles, après avoir vérifié qu’ils s’ouvrent avec la clé de l’établissement ; il ne modifie jamais un fichier présent et lisible. Un fichier illisible remplacé est d’abord mis en quarantaine. Le contrôle est ensuite refait.' }));
          out.appendChild(h('div', { class: 'actions gauche' }, h('label', {}, 'Copie de sauvegarde (fichier .json)', fichier), h('button', { class: 'btn primaire', type: 'button', onclick: async function (ev) {
            var b = ev.currentTarget; erreur(null);
            try {
              var copie = await lireFichierJSON(fichier);
              if (!confirm('Remettre depuis la copie du ' + (copie.creeLe ? U.date(Date.parse(copie.creeLe)) : '?') + ' les fichiers absents ou illisibles du dossier ? Les fichiers présents et lisibles ne seront pas touchés.')) return;
              b.disabled = true;
              var rap = await s.reparerDepuisCopie(copie);
              U.toast(rap.remis.length + ' fichier(s) remis' + (rap.invalides.length ? ', ' + rap.invalides.length + ' refusé(s) (ne s’ouvrent pas avec la clé actuelle)' : '') + '.');
              if (!rap.remis.length) erreur(new Error('Aucun fichier manquant n’a été trouvé dans cette copie' + (rap.invalides.length ? ' (' + rap.invalides.length + ' fichier(s) refusé(s) : copie d’une autre installation ou abîmée)' : '') + '. Essayez une copie plus ancienne ou demandez les fichiers à la DSI.'));
              rafraichir();
            } catch (e) { erreur(e); } finally { b.disabled = false; }
          } }, 'Réparer')));
        }
        // Quarantaine des fichiers illisibles
        if (r.fichiersIllisibles.length) {
          out.appendChild(h('h4', { text: 'Mettre à l’écart les fichiers illisibles' }));
          out.appendChild(h('p', { class: 'muted', text: 'Les ' + r.fichiersIllisibles.length + ' fichier(s) illisible(s) sont déplacés dans le dossier « quarantaine » de l’outil, sans être supprimés : la DSI peut les examiner ou les restaurer. À faire après avoir tenté la réparation. Une saisie mise en quarantaine reste à restaurer ; si elle ne peut pas l’être, prenez-en acte.' }));
          out.appendChild(h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: async function () {
            erreur(null);
            if (!confirm('Déplacer ' + r.fichiersIllisibles.length + ' fichier(s) illisible(s) dans le dossier « quarantaine » ? L’opération est tracée au journal.')) return;
            try { var f = await s.mettreEnQuarantaine(r.fichiersIllisibles.map(function (x) { return x.nom; })); U.toast(f.length + ' fichier(s) mis en quarantaine.'); rafraichir(); }
            catch (e) { erreur(e); }
          } }, 'Mettre en quarantaine')));
        }
        // Prise d'acte
        var motif = h('textarea', { rows: 2, placeholder: 'Ex. : fichiers absents des sauvegardes de la DSI (ticket n° …), saisies ressaisies le …' });
        out.appendChild(h('h4', { text: 'Prendre acte (récupération impossible)' }));
        out.appendChild(h('p', { class: 'muted', text: 'Si les fichiers ne peuvent pas être récupérés (absents des sauvegardes), vérifiez les mesures concernées et ressaisissez ce qui doit l’être, puis prenez acte de ces anomalies avec un motif. L’alerte est alors close pour ces fichiers ; la décision est enregistrée au journal et listée ci-dessous. Toute nouvelle anomalie déclenche une nouvelle alerte.' }));
        out.appendChild(h('label', {}, 'Motif (obligatoire)', motif));
        out.appendChild(h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: async function () {
          erreur(null);
          if (!motif.value.trim()) return erreur(new Error('Le motif est obligatoire.'));
          if (!confirm('Prendre acte de ' + lignes.length + ' anomalie(s) ? L’alerte sera close pour ces fichiers ; une nouvelle anomalie déclenchera toujours une alerte.')) return;
          try { await s.prendreActeIntegrite(motif.value); U.toast('Prise d’acte enregistrée au journal.'); rafraichir(); }
          catch (e) { erreur(e); }
        } }, 'Prendre acte')));
      }
    }
    var hist = (s.etat && s.etat.integrite && s.etat.integrite.historique) || [];
    if (r && r.acquis) out.appendChild(h('p', { class: 'muted', text: r.acquis + ' anomalie(s) déjà prise(s) en compte par une décision ci-dessous : elles ne sont plus signalées.' }));
    if (hist.length) {
      out.appendChild(h('h4', { text: 'Décisions de prise d’acte' }));
      out.appendChild(h('ul', { class: 'liste-simple' }, hist.slice().reverse().map(function (x) {
        return h('li', { text: U.date(Date.parse(x.at)) + ' — ' + s.nomAuteur(x.by) + ' — ' + [x.manquants ? x.manquants + ' saisie(s) perdue(s)' : '', x.fichiers ? x.fichiers + ' fichier(s) illisible(s)' : '', x.reperes ? x.reperes + ' repère(s) d’agent' : ''].filter(Boolean).join(', ') + ' — motif : ' + x.motif });
      })));
    }
    return out;
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
    if (pbs.length) res.push(h('li', { class: 'urgent' }, h('b', { text: 'Intégrité des données' }), ' — ' + pbs.join(' ; ') + '. ' + (admin ? 'Détail, liste à transmettre à la DSI, réparation ou prise d’acte : Administration → Informations.' : 'Prévenez l’administrateur.')));
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
    var zoneIntegrite = h('div');
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
      U.vider(zoneIntegrite).appendChild(blocIntegrite(r, function () { U.rendreContenu(); }));
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
      h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: async function () { await controler(); remplir(); U.toast('Contrôle effectué.'); } }, 'Vérifier maintenant')),
      zoneIntegrite);
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

  U.sauvegarde = { panneau: panneau, controler: controler, vigilance: vigilance, blocRestaurationCoffre: blocRestaurationCoffre, blocRestaurationCopie: blocRestaurationCopie, texteIntegrite: texteIntegrite, lignesAnomalies: lignesAnomalies, texteDSI: texteDSI };
})();
