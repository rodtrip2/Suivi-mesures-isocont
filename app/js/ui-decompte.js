// SPDX-License-Identifier: EUPL-1.2
/*
 * Décompte JLD : pièce jointe à l'information ou à la saisine du juge (impression, PDF ou CSV).
 * Sa présentation suit un masque propre à chaque service (ou celui de l'établissement) :
 * en-tête, destinataire, données d'identité, colonnes et sections exportées, pied de page, signature.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var H = 3600 * 1000;

  var LIB_COLONNES = { N: 'N°', Debut: 'Début', Fin: 'Fin ou référence', Duree: 'Durée', Cumul: 'Cumul', Statut: 'Statut', Commentaire: 'Commentaire' };
  var LIB_IDENTITE = { patient: 'Patient (nom, prénom)', naissance: 'Date de naissance', ipp: 'IPP', service: 'Service', modeHospi: "Mode d'hospitalisation", protection: 'Protection juridique', mesure: 'Mesure (type, date de décision)', lieu: 'Lieu', psychiatre: 'Psychiatre décisionnaire' };
  var LIB_SECTIONS = { periode: 'Période analysée', situation: 'Situation (en cours ou terminée)', total: 'Totaux (cumul antérieur, durée totale retenue)', cycle: 'Cycle et échéances JLD', jld: 'Envois au JLD déjà effectués', tiers: 'Information du tiers', pauses: 'Levées temporaires (pauses)', mentionLegale: 'Mention du mode de calcul (art. L. 3222-5-1)', dateEdition: 'Date d’édition', auteur: 'Auteur du document' };
  var LIB_NATURE = { INFO: 'information', SAISINE: 'saisine', DECISION: 'décision' };

  function dateNaissance(iso) { return iso ? iso.split('-').reverse().join('/') : '—'; }
  function multiligne(texte, classe) {
    var lignes = String(texte || '').split('\n');
    return h('div', { class: classe }, lignes.map(function (l, i) { return [l, i < lignes.length - 1 ? h('br') : null]; }));
  }

  /** Données du décompte, prêtes pour l'impression comme pour l'export. */
  function contenu(etat, m, reference, masque) {
    var p = etat.patients[m.patientId] || {}, d = M.decompte(etat, m, reference);
    var j = M.suiviJLD(etat, m, d.reference);
    var mode = M.modeA(etat, m.patientId, d.reference) || m.modeHospi || '';
    var defMode = (etat.config.modesHospitalisation || []).filter(function (x) { return x.code === mode; })[0];
    var valeurs = {
      patient: ((p.nom || '') + ' ' + (p.prenom || '')).trim() || '—',
      naissance: dateNaissance(p.naissance), ipp: p.ipp || '—', service: U.libService(m.service),
      modeHospi: mode ? mode + (defMode ? ' — ' + defMode.libelle : '') : '—', protection: p.protection || 'Aucune',
      mesure: m.type + ' décidée le ' + U.date(m.debut), lieu: m.lieu || (m.csi ? 'CSI' : 'Hors CSI'), psychiatre: m.psychiatreDebut || '—'
    };
    var identite = masque.identite.map(function (k) { return [LIB_IDENTITE[k].replace(/ \(.*\)$/, ''), valeurs[k]]; });
    if (masque.sections.periode) identite.push(['Période analysée', 'du ' + U.date(d.fenetreDebut) + ' au ' + U.date(d.reference) + ' (15 jours glissants avant le début de la mesure, puis la mesure)']);
    if (masque.sections.situation) identite.push(['Situation', 'Dernière mesure initiée le ' + U.date(m.debut) + (d.enCours ? ' — EN COURS au ' + U.date(d.reference) : ' — TERMINÉE le ' + U.date(m.fin))]);
    function cellule(l, c) {
      switch (c) {
        case 'N': return String(l.n);
        case 'Debut': return U.date(l.debut);
        case 'Fin': return U.date(l.fin);
        case 'Duree': return l.type === 'pause' ? U.duree(l.duree) + ' (déduite)' : U.duree(l.duree);
        case 'Cumul': return U.duree(l.cumul);
        case 'Statut': return l.statut;
        default: return l.commentaire;
      }
    }
    var envois = [];
    Object.keys(m.jld).sort(function (a, b) { return a - b; }).forEach(function (c) {
      ['INFO', 'SAISINE', 'DECISION'].forEach(function (n) {
        var x = m.jld[c][n];
        if (x && typeof x.date === 'number' && x.date <= d.reference) envois.push('Cycle ' + c + ' — ' + LIB_NATURE[n] + ' le ' + U.date(x.date) + (x.decision ? ' (' + (x.decision === 'LEVEE' ? 'mainlevée' : 'maintien') + ')' : ''));
      });
    });
    var tiers = m.tiers.filter(function (t) { return t.date <= d.reference; }).map(function (t) {
      return 'Cycle ' + t.cycle + ' — ' + (U.LIB_TIERS[t.statut] || t.statut) + (t.personne ? ' (' + t.personne + ')' : '') + ' le ' + U.date(t.date) + ', par ' + (t.informateur === 'IDE' ? 'l’IDE' : (t.nomInformateur || 'le psychiatre'));
    });
    var deduire = d.pausesRetranchees;
    var pauses = (m.pauses || []).filter(function (x) { return x.debut <= d.reference; }).map(function (x) {
      var f = Math.min(M.finPause(m, x, d.reference, etat.config), d.reference);
      var plage = d.pauses.filter(function (q) { return q.pause.evt === x.evt; })[0];
      var reprise = x.reprise != null ? U.date(x.reprise)
        : M.repriseAutomatique(m, x, d.reference, etat.config) ? U.date(x.reprisePrevue) + ' (automatique)'
        : typeof m.fin === 'number' && m.fin <= d.reference ? 'aucune — fin de la mesure le ' + U.date(m.fin)
        : d.reference > x.reprisePrevue ? 'non saisie (prévue le ' + U.date(x.reprisePrevue) + ')'
        : 'pause en cours (reprise prévue le ' + U.date(x.reprisePrevue) + ')';
      var prise = !deduire ? 'Comptée dans le cumul'
        : plage && plage.nonConfirmee ? 'Déduite jusqu’à l’heure de reprise prévue, comptée ensuite'
        : 'Déduite du cumul';
      var duree = deduire && plage ? (plage.fin - plage.debut) / H : (f - x.debut) / H;
      return { debut: U.date(x.debut), reprise: reprise, duree: U.duree(duree), motif: x.motif || '—', psychiatre: x.psychiatre || '—', prise: prise };
    });
    var explicationPauses = deduire
      ? 'Le psychiatre a levé temporairement la mesure, sans y mettre fin. Selon la règle retenue par l’établissement, la durée de ces levées est déduite : elle n’est pas ajoutée au cumul. Chaque levée interrompt le tableau ci-dessus par une ligne « PAUSE » grisée, et les échéances JLD sont reportées d’autant.'
      : 'Le psychiatre a levé temporairement la mesure, sans y mettre fin. Selon la règle retenue par l’établissement, la durée de ces levées n’est pas déduite : elle reste comptée dans le cumul, comme le reste de la mesure. Le tableau ci-dessus n’est pas interrompu et les échéances JLD ne sont pas reportées.';
    return {
      d: d, j: j, titre: m.type === 'Isolement' ? masque.titreIsolement : masque.titreContention,
      identite: identite,
      entetes: masque.colonnes.map(function (c) { return LIB_COLONNES[c]; }),
      lignes: d.lignes.map(function (l) { return masque.colonnes.map(function (c) { return cellule(l, c); }); }),
      typesLignes: d.lignes.map(function (l) { return l.type; }),
      explicationPauses: explicationPauses,
      total: 'Cumul des mesures antérieures sur 15 jours : ' + U.duree(d.cumulAvant) + ' — Durée totale retenue : ' + U.duree(d.total) + '.',
      cycle: 'Cycle de contrôle n° ' + j.cycle + ' — information avant le ' + U.date(j.info.echeance) + ', saisine avant le ' + U.date(j.saisine.echeance) + ', décision avant le ' + U.date(j.decision.echeance) + '.',
      envois: envois, tiers: tiers, pauses: pauses
    };
  }

  // ------------------------------------------------------------ Page A4, papier à en-tête
  // La page imprimée n'a pas de marge (@page decompte, feuille de style) : l'image de fond couvre toute la feuille,
  // et les marges du texte sont réservées par l'en-tête et le pied d'un tableau, répétés par le navigateur sur chaque page.

  /** Ajuste l'aperçu (page A4 réduite) à la largeur de son cadre. */
  function ajusterApercu(cadre, page) {
    requestAnimationFrame(function () {
      var l = cadre.clientWidth - 28;
      if (l > 0) page.style.zoom = String(Math.min(1, l / page.offsetWidth));
    });
  }

  /** Document imprimable. `options` : { auteur, images } (images : papier à en-tête disponible, sinon celles du paramétrage). */
  function document_(etat, m, reference, masque, options) {
    options = options || {};
    var c = contenu(etat, m, reference, masque), s = masque.sections;
    var images = options.images || etat.config.imagesDecompte || {};
    var fond = masque.fond && images[masque.fond];
    function liste(titre, items, vide) {
      return h('div', { class: 'doc-section' }, h('p', {}, h('b', { text: titre })), items.length ? h('ul', {}, items.map(function (t) { return h('li', { text: t }); })) : h('p', { text: vide }));
    }
    var edition = '';
    if (s.dateEdition && s.auteur && options.auteur) edition = 'Édité le ' + U.date(Date.now()) + ' par ' + options.auteur + '.';
    else if (s.dateEdition) edition = 'Édité le ' + U.date(Date.now()) + '.';
    else if (s.auteur && options.auteur) edition = 'Édité par ' + options.auteur + '.';
    var mentions = [edition];
    if (s.mentionLegale) mentions.push('Décompte calculé selon l’article L. 3222-5-1 du code de la santé publique (périodes qui se chevauchent comptées une seule fois' + (c.d.pausesRetranchees ? ' ; durée des levées temporaires déduite du cumul' : ' ; durée des levées temporaires comptée dans le cumul') + ').');
    mentions = mentions.filter(Boolean);
    var corps = [
      masque.confidentiel ? h('div', { class: 'doc-confidentiel', text: 'Document confidentiel — données personnelles de santé' }) : null,
      (masque.entete || masque.destinataire) ? h('div', { class: 'doc-haut' },
        masque.entete ? multiligne(masque.entete, 'doc-entete') : h('div'),
        masque.destinataire ? multiligne(masque.destinataire, 'doc-destinataire') : null) : null,
      h('header', {},
        h('div', { class: 'doc-etab', text: [U.etablissement(), U.libService(m.service)].filter(Boolean).join(' — ') }),
        h('h1', { text: c.titre }),
        masque.sousTitre ? h('div', { class: 'doc-sous-titre', text: masque.sousTitre }) : null),
      c.identite.length ? h('table', { class: 'doc-identite' }, h('tbody', {}, c.identite.map(function (x) { return h('tr', {}, h('th', { text: x[0] }), h('td', { text: x[1] })); }))) : null,
      c.entetes.length ? h('table', { class: 'doc-tableau' },
        h('thead', {}, h('tr', {}, c.entetes.map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, c.lignes.map(function (l, i) { return h('tr', { class: c.typesLignes[i] === 'pause' ? 'doc-ligne-pause' : null }, l.map(function (v) { return h('td', { text: v }); })); }))) : null,
      s.total ? h('p', { class: 'doc-total', text: c.total }) : null,
      s.cycle ? h('p', { text: c.cycle }) : null,
      s.jld ? liste('Envois au juge des libertés et de la détention', c.envois, 'Aucun envoi enregistré.') : null,
      s.tiers ? liste('Information du tiers', c.tiers, 'Non renseignée.') : null,
      s.pauses && c.pauses.length ? h('div', { class: 'doc-section doc-pauses' },
        h('p', {}, h('b', { text: 'Levées temporaires de la mesure (pauses)' })),
        h('p', { class: 'doc-explication', text: c.explicationPauses }),
        h('table', {}, h('thead', {}, h('tr', {}, ['Début de la pause', 'Reprise', 'Durée', 'Motif', 'Décidée par', 'Prise en compte'].map(function (t) { return h('th', { text: t }); }))),
          h('tbody', {}, c.pauses.map(function (x) { return h('tr', {}, [x.debut, x.reprise, x.duree, x.motif, x.psychiatre, x.prise].map(function (v) { return h('td', { text: v }); })); })))) : null,
      masque.piedPage ? multiligne(masque.piedPage, 'doc-pied') : null,
      masque.signature ? h('div', { class: 'doc-signature' }, h('div', { text: 'Fait le ' + U.date(Date.now()).split(' ')[0] }), multiligne(masque.signature, '')) : null,
      mentions.length ? h('footer', { text: mentions.join(' ') }) : null];
    var page = h('article', { class: 'document-jld doc-page' + (fond ? ' avec-fond' : '') },
      fond ? h('img', { class: 'doc-fond ' + (masque.fondPages === 'premiere' ? 'premiere' : 'toutes'), src: fond.donnees, alt: '' }) : null,
      h('table', { class: 'doc-cadre' },
        h('thead', {}, h('tr', {}, h('td', {}, h('div', { class: 'doc-espace-haut' })))),
        h('tfoot', {}, h('tr', {}, h('td', {}, h('div', { class: 'doc-espace-bas' })))),
        h('tbody', {}, h('tr', {}, h('td', {}, corps)))));
    var mg = masque.marges;
    page.style.setProperty('--mh', mg.haut + 'mm'); page.style.setProperty('--md', mg.droite + 'mm');
    page.style.setProperty('--mb', mg.bas + 'mm'); page.style.setProperty('--mg', mg.gauche + 'mm');
    return page;
  }

  /** Export CSV (séparateur « ; », UTF-8 avec BOM, lisible par Excel) des données retenues par le masque. */
  function csv(etat, m, reference, masque) {
    var c = contenu(etat, m, reference, masque), s = masque.sections, lignes = [[c.titre]];
    c.identite.forEach(function (x) { lignes.push(x); });
    lignes.push([]);
    if (c.entetes.length) { lignes.push(c.entetes); c.lignes.forEach(function (l) { lignes.push(l); }); lignes.push([]); }
    if (s.total) lignes.push(['Cumul antérieur (h)', c.d.cumulAvant.toFixed(2).replace('.', ','), 'Durée totale retenue (h)', c.d.total.toFixed(2).replace('.', ',')]);
    if (s.cycle) lignes.push(['Cycle', c.j.cycle, 'Information avant', U.date(c.j.info.echeance), 'Saisine avant', U.date(c.j.saisine.echeance), 'Décision avant', U.date(c.j.decision.echeance)]);
    if (s.jld) c.envois.forEach(function (t) { lignes.push(['Envoi JLD', t]); });
    if (s.tiers) c.tiers.forEach(function (t) { lignes.push(['Tiers', t]); });
    if (s.pauses && c.pauses.length) {
      lignes.push([]); lignes.push(['Levées temporaires', c.explicationPauses]);
      lignes.push(['Début de la pause', 'Reprise', 'Durée', 'Motif', 'Décidée par', 'Prise en compte']);
      c.pauses.forEach(function (x) { lignes.push([x.debut, x.reprise, x.duree, x.motif, x.psychiatre, x.prise]); });
    }
    if (s.dateEdition) lignes.push(['Édité le', U.date(Date.now())]);
    if (s.auteur && U.App.session) lignes.push(['Édité par', U.App.session.utilisateur.nom]);
    return '﻿' + lignes.map(function (l) { return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
  }

  function telecharger(texte, nom) {
    var a = h('a', { href: URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' })), download: nom });
    document.body.appendChild(a); a.click(); a.remove();
  }

  U.actions.decompte = function (m) {
    var etat = U.st(), masque = M.masqueDecompte(etat.config, m.service);
    var ref = h('input', { type: 'datetime-local', value: U.versSaisie(typeof m.fin === 'number' ? Math.min(m.fin, Date.now()) : Date.now()) });
    var apercu = h('div', { class: 'apercu-document' });
    var options = { auteur: U.App.session.utilisateur.nom };
    function maj() {
      U.vider(apercu);
      try { var doc = document_(etat, m, U.depuisSaisie(ref.value), masque, options); apercu.appendChild(doc); ajusterApercu(apercu, doc); }
      catch (e) { apercu.appendChild(h('div', { class: 'erreur', text: e.message })); }
    }
    ref.addEventListener('change', maj);
    U.modale('Décompte JLD', h('div', { class: 'pile' },
      h('label', {}, 'Date et heure de référence (en général : maintenant)', ref),
      h('small', { class: 'muted', text: 'Masque : ' + (masque.propre ? 'propre au service ' + U.libService(m.service) : 'de l’établissement') + ' (modifiable par l’administrateur).' }),
      apercu,
      h('small', { class: 'muted', text: 'Pour un PDF, choisissez « Enregistrer au format PDF » comme imprimante' + (masque.fond ? ', format A4, sans marges ajoutées par le navigateur (« Marges : par défaut »)' : '') + '. L’export CSV contient des données nominatives : enregistrez-le uniquement sur le réseau de l’établissement.' })), [
      { texte: 'Fermer' },
      { texte: 'Exporter (CSV)', action: function () {
        var p = etat.patients[m.patientId] || {};
        telecharger(csv(etat, m, U.depuisSaisie(ref.value), masque), 'decompte_' + m.type.toLowerCase() + '_' + (p.ipp || m.patientId) + '_' + M.dateLocaleISO(U.depuisSaisie(ref.value)) + '.csv');
        return false;
      } },
      { texte: 'Imprimer / PDF', classe: 'primaire', action: function () {
        var doc = document_(etat, m, U.depuisSaisie(ref.value), masque, options);
        setTimeout(function () { U.imprimer(doc); }, 50);
        return true;
      } }]);
    setTimeout(maj, 0);
  };

  // ================================================================ Éditeur des masques (administration)
  var cibleMasque = '*';

  /** Image de papier à en-tête, ramenée à 1654 px de large au plus (A4 à 200 ppp), fond blanc, JPEG. */
  function preparerImage(fichier) {
    return new Promise(function (resoudre, rejeter) {
      if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(fichier.type)) return rejeter(new Error('Choisissez une image PNG ou JPEG. Pour un modèle Word ou PDF, enregistrez d’abord la page en image (format A4 portrait).'));
      var lecteur = new FileReader();
      lecteur.onerror = function () { rejeter(new Error('Lecture du fichier impossible.')); };
      lecteur.onload = function () {
        var img = new Image();
        img.onerror = function () { rejeter(new Error('Image illisible.')); };
        img.onload = function () {
          var l = Math.min(1654, img.naturalWidth), ht = Math.round(img.naturalHeight * l / img.naturalWidth);
          var cv = document.createElement('canvas'); cv.width = l; cv.height = ht;
          var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, l, ht); ctx.drawImage(img, 0, 0, l, ht);
          var donnees = cv.toDataURL('image/jpeg', 0.85);
          if (donnees.length > 1500000) donnees = cv.toDataURL('image/jpeg', 0.7);
          if (donnees.length > 2500000) return rejeter(new Error('Image trop lourde, même compressée : réduisez sa taille.'));
          resoudre({ nom: fichier.name, donnees: donnees, largeur: l, hauteur: ht });
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  /** Patient et mesures fictifs pour l'aperçu du masque (aucune donnée réelle). */
  function etatApercu(service, config) {
    var n = 0, now = Date.now(), t = function (hh) { return Math.round((now + hh * H) / 900000) * 900000; };
    var evt = function (type, data) { n++; return { id: 'apercu' + n, at: new Date(Date.UTC(2020, 0, 1) + n * 1000).toISOString(), by: 'apercu', type: type, data: data }; };
    var evts = [
      evt('CONFIG', { cle: 'pauses', valeur: config.pauses || {} }),
      evt('CONFIG', { cle: 'modesHospitalisation', valeur: config.modesHospitalisation }),
      evt('PATIENT', { patientId: 'X', ipp: '000000', nom: 'EXEMPLE (fictif)', prenom: 'Camille', naissance: '1990-05-12', protection: '' }),
      evt('MODE_HOSPI', { patientId: 'X', mode: 'SDT', date: t(-24 * 30) }),
      evt('MESURE_DEBUT', { mesureId: 'A', patientId: 'X', service: service, typeMesure: 'Isolement', debut: t(-24 * 6), lieu: 'CSI', csi: true, psychiatre: 'Dr Exemple (fictif)' }),
      evt('MESURE_FIN', { mesureId: 'A', fin: t(-24 * 6 + 14) }),
      evt('MESURE_DEBUT', { mesureId: 'B', patientId: 'X', service: service, typeMesure: 'Isolement', debut: t(-40), lieu: 'CSI', csi: true, psychiatre: 'Dr Exemple (fictif)' }),
      evt('TIERS', { mesureId: 'B', cycle: 1, statut: 'INFORME', personne: 'Mère', informateur: 'PSYCHIATRE', nomInformateur: 'Dr Exemple (fictif)', date: t(-39) }),
      evt('PAUSE', { mesureId: 'B', debut: t(-20), reprisePrevue: t(-19), motif: 'Repas', psychiatre: 'Dr Exemple (fictif)' }),
      evt('REPRISE', { mesureId: 'B', date: t(-19) }),
      evt('JLD', { mesureId: 'B', cycle: 1, nature: 'INFO', date: t(-6) })
    ];
    return M.reduire(evts);
  }

  U.actions.panneauMasquesDecompte = function () {
    var cfg = U.config(), dec = cfg.decompte || {};
    var services = U.tousServices();
    if (cibleMasque !== '*' && !services.some(function (s) { return s.code === cibleMasque; })) cibleMasque = '*';
    var selCible = h('select', { onchange: function () { cibleMasque = selCible.value; U.vider(zone).appendChild(editeur()); } },
      h('option', { value: '*', text: 'Masque de l’établissement (services sans masque propre)', selected: cibleMasque === '*' }),
      services.map(function (s) { return h('option', { value: s.code, text: s.libelle + (dec[s.code] ? ' — masque propre' : ' — utilise le masque de l’établissement'), selected: cibleMasque === s.code }); }));
    var zone = h('div');

    function editeur() {
      var cible = cibleMasque, mq = M.masqueDecompte(cfg, cible);
      var champ = function (v) { return h('input', { type: 'text', value: v || '' }); };
      var zoneT = function (v, r) { return h('textarea', { rows: r || 3 }, v || ''); };
      var tIso = champ(mq.titreIsolement), tCont = champ(mq.titreContention), sous = champ(mq.sousTitre);
      var entete = zoneT(mq.entete), dest = zoneT(mq.destinataire), pied = zoneT(mq.piedPage, 2), sign = zoneT(mq.signature, 3);
      var conf = h('input', { type: 'checkbox', checked: mq.confidentiel });
      var casesIdentite = {}, casesSections = {};
      var blocIdentite = h('div', { class: 'cases-ligne' }, M.IDENTITE_DECOMPTE.map(function (k) {
        casesIdentite[k] = h('input', { type: 'checkbox', checked: mq.identite.indexOf(k) >= 0 });
        return h('label', { class: 'case' }, casesIdentite[k], h('span', { text: LIB_IDENTITE[k] }));
      }));
      var blocSections = h('div', { class: 'cases-ligne' }, M.SECTIONS_DECOMPTE.map(function (k) {
        casesSections[k] = h('input', { type: 'checkbox', checked: !!mq.sections[k] });
        return h('label', { class: 'case' }, casesSections[k], h('span', { text: LIB_SECTIONS[k] }));
      }));
      // Colonnes : cochées = exportées, dans l'ordre de la liste
      var ordre = mq.colonnes.concat(M.COLONNES_DECOMPTE.filter(function (c) { return mq.colonnes.indexOf(c) < 0; }));
      var actives = {}; M.COLONNES_DECOMPTE.forEach(function (c) { actives[c] = mq.colonnes.indexOf(c) >= 0; });
      var listeCol = h('ol', { class: 'liste-colonnes' });
      function dessinerColonnes() {
        U.vider(listeCol);
        ordre.forEach(function (c, i) {
          var cb = h('input', { type: 'checkbox', checked: actives[c], onchange: function () { actives[c] = cb.checked; apercu(); } });
          listeCol.appendChild(h('li', {}, h('label', { class: 'case' }, cb, h('span', { text: LIB_COLONNES[c] })),
            h('button', { type: 'button', class: 'btn petit', 'aria-label': 'Monter', disabled: i === 0, onclick: function () { ordre.splice(i - 1, 0, ordre.splice(i, 1)[0]); dessinerColonnes(); apercu(); } }, '↑'),
            h('button', { type: 'button', class: 'btn petit', 'aria-label': 'Descendre', disabled: i === ordre.length - 1, onclick: function () { ordre.splice(i + 1, 0, ordre.splice(i, 1)[0]); dessinerColonnes(); apercu(); } }, '↓')));
        });
      }
      dessinerColonnes();

      // Papier à en-tête
      var images = JSON.parse(JSON.stringify(cfg.imagesDecompte || {}));
      var selFond = h('select', {});
      function remplirFonds(valeur) {
        U.vider(selFond);
        selFond.appendChild(h('option', { value: '', text: 'Aucune image de fond' }));
        Object.keys(images).forEach(function (id) { selFond.appendChild(h('option', { value: id, text: images[id].nom, selected: id === valeur })); });
        selFond.value = valeur || '';
      }
      remplirFonds(mq.fond);
      var infoFond = h('small', { class: 'muted' });
      var fichier = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async function () {
        var f = fichier.files[0]; if (!f) return;
        try {
          var im = await preparerImage(f);
          var id = 'img' + Date.now().toString(36);
          images[id] = im; remplirFonds(id); apercu();
          var ratio = im.hauteur / im.largeur;
          infoFond.textContent = 'Image importée (' + Math.round(im.donnees.length / 1024) + ' Ko). ' + (Math.abs(ratio - 1.414) > 0.1 ? 'Elle n’est pas au format A4 portrait : elle sera étirée sur la page.' : 'Format A4 portrait.') + ' Enregistrez le masque pour la conserver.';
        } catch (e) { alert(e.message); }
        fichier.value = '';
      } });
      var selPages = h('select', {}, h('option', { value: 'toutes', text: 'Sur toutes les pages', selected: mq.fondPages !== 'premiere' }), h('option', { value: 'premiere', text: 'Sur la première page seulement', selected: mq.fondPages === 'premiere' }));
      var marges = {};
      var blocMarges = h('div', { class: 'grille-4' }, [['haut', 'Haut'], ['droite', 'Droite'], ['bas', 'Bas'], ['gauche', 'Gauche']].map(function (x) {
        marges[x[0]] = h('input', { type: 'number', min: 0, max: 80, step: 1, value: mq.marges[x[0]] });
        return h('label', {}, x[1] + ' (mm)', marges[x[0]]);
      }));

      function lire() {
        return {
          titreIsolement: tIso.value.trim(), titreContention: tCont.value.trim(), sousTitre: sous.value.trim(),
          entete: entete.value.replace(/\s+$/, ''), destinataire: dest.value.replace(/\s+$/, ''), confidentiel: conf.checked,
          identite: M.IDENTITE_DECOMPTE.filter(function (k) { return casesIdentite[k].checked; }),
          colonnes: ordre.filter(function (c) { return actives[c]; }),
          sections: M.SECTIONS_DECOMPTE.reduce(function (o, k) { o[k] = casesSections[k].checked; return o; }, {}),
          piedPage: pied.value.replace(/\s+$/, ''), signature: sign.value.replace(/\s+$/, ''),
          fond: selFond.value, fondPages: selPages.value,
          marges: Object.keys(marges).reduce(function (o, k) { var v = +marges[k].value; o[k] = isFinite(v) ? Math.max(0, Math.min(80, v)) : 15; return o; }, {})
        };
      }
      var vue = h('div', { class: 'apercu-document' });
      var svApercu = cible === '*' ? ((services[0] || {}).code || 'U1') : cible;
      var etatEx = etatApercu(svApercu, cfg);
      function apercu() {
        U.vider(vue);
        try {
          var m2 = Object.assign({}, M.MASQUE_DEFAUT, lire()); m2.sections = Object.assign({}, M.MASQUE_DEFAUT.sections, m2.sections);
          if (!m2.titreIsolement) m2.titreIsolement = M.MASQUE_DEFAUT.titreIsolement;
          var doc = document_(etatEx, etatEx.mesures.B, Date.now(), m2, { auteur: U.App.session.utilisateur.nom, images: images });
          vue.appendChild(doc); ajusterApercu(vue, doc);
        } catch (e) { vue.appendChild(h('div', { class: 'erreur', text: e.message })); }
      }
      [tIso, tCont, sous, entete, dest, pied, sign, conf, selFond, selPages].concat(Object.keys(marges).map(function (k) { return marges[k]; })).forEach(function (x) { x.addEventListener('input', apercu); x.addEventListener('change', apercu); });
      Object.keys(casesIdentite).concat([]).forEach(function (k) { casesIdentite[k].addEventListener('change', apercu); });
      Object.keys(casesSections).forEach(function (k) { casesSections[k].addEventListener('change', apercu); });
      setTimeout(apercu, 0);

      async function enregistrer(valeur) {
        var nouveau = JSON.parse(JSON.stringify(U.config().decompte || {}));
        if (valeur === null) delete nouveau[cible]; else nouveau[cible] = valeur;
        // Images : ne conserver que celles utilisées par un masque (enregistrées avant le masque qui les cite)
        var utilisees = {};
        Object.keys(nouveau).forEach(function (k) { if (nouveau[k] && nouveau[k].fond) utilisees[nouveau[k].fond] = 1; });
        var gardees = {};
        Object.keys(utilisees).forEach(function (id) { var im = images[id] || (U.config().imagesDecompte || {})[id]; if (im) gardees[id] = im; });
        if (JSON.stringify(gardees) !== JSON.stringify(U.config().imagesDecompte || {})) await U.App.session.enregistrer('CONFIG', { cle: 'imagesDecompte', valeur: gardees });
        await U.App.session.enregistrer('CONFIG', { cle: 'decompte', valeur: nouveau });
        U.toast(valeur === null ? 'Masque propre supprimé : le service utilise le masque de l’établissement.' : 'Masque enregistré.');
      }
      var boutons = h('div', { class: 'actions' },
        cible !== '*' && dec[cible] ? h('button', { class: 'btn', onclick: async function () {
          if (!confirm('Supprimer le masque propre de ce service ? Il utilisera le masque de l’établissement.')) return;
          try { await enregistrer(null); } catch (e) { alert(e.message); }
        } }, 'Revenir au masque de l’établissement') : null,
        h('button', { class: 'btn primaire', onclick: async function (ev) {
          var b = ev.currentTarget; b.disabled = true;
          try {
            var v = lire();
            if (!v.colonnes.length) throw new Error('Cochez au moins une colonne du tableau.');
            if (v.identite.indexOf('patient') < 0 && v.identite.indexOf('ipp') < 0 && !confirm('Ni le nom du patient ni l’IPP ne figurent dans le masque : le juge ne pourra pas identifier le patient. Enregistrer quand même ?')) return;
            await enregistrer(v);
          } catch (e) { alert(e.message); } finally { b.disabled = false; }
        } }, cible === '*' ? 'Enregistrer le masque de l’établissement' : (dec[cible] ? 'Enregistrer le masque du service' : 'Créer le masque propre au service')));

      return h('div', { class: 'editeur-masque' },
        h('div', { class: 'pile' },
          cible !== '*' && !dec[cible] ? h('div', { class: 'info', text: 'Ce service utilise le masque de l’établissement, affiché ci-dessous. Modifiez-le puis enregistrez pour créer un masque propre au service.' }) : null,
          h('div', { class: 'grille-2' }, h('label', {}, 'Titre (isolement)', tIso), h('label', {}, 'Titre (contention)', tCont)),
          h('label', {}, 'Sous-titre', sous),
          h('div', { class: 'grille-2' }, h('label', {}, 'En-tête (adresse, service, téléphone…)', entete), h('label', {}, 'Destinataire (affiché à droite)', dest)),
          h('label', { class: 'case' }, conf, h('span', { text: 'Bandeau « Document confidentiel — données personnelles de santé »' })),
          h('fieldset', {}, h('legend', { text: 'Données d’identité exportées' }), blocIdentite),
          h('fieldset', {}, h('legend', { text: 'Colonnes du tableau (cochées = exportées, dans cet ordre)' }), listeCol),
          h('fieldset', {}, h('legend', { text: 'Sections exportées' }), blocSections),
          h('label', {}, 'Texte en pied de document', pied),
          h('label', {}, 'Bloc signature (ex. « Le directeur, par délégation » ; laisser vide pour aucun)', sign),
          h('fieldset', {}, h('legend', { text: 'Papier à en-tête (image de fond)' }),
            h('p', { class: 'muted' }, h('small', { text: 'Image A4 portrait (PNG ou JPEG) du papier à en-tête de l’établissement, par exemple celui des courriers : exportez la page vierge du modèle en image. Réglez les marges pour que le texte n’empiète ni sur l’en-tête ni sur le pied de page.' })),
            h('div', { class: 'grille-2' }, h('label', {}, 'Image', selFond), h('label', {}, 'Importer une image…', fichier)),
            infoFond,
            h('label', {}, 'Affichage', selPages),
            h('div', {}, h('b', { text: 'Marges du texte' }), blocMarges)),
          boutons),
        h('div', { class: 'pile' }, h('b', { text: 'Aperçu (patient fictif)' }), vue));
    }
    zone.appendChild(editeur());
    return h('section', { class: 'panneau' }, h('h2', { text: 'Masques du décompte JLD' }),
      h('p', { class: 'muted', text: 'Le masque de l’établissement s’applique à tous les services, sauf à ceux qui ont leur propre masque. Il fixe la présentation du décompte et les données exportées, à l’impression, en PDF comme en CSV.' }),
      h('label', {}, 'Masque à modifier', selCible), zone);
  };

  U.actions.documentDecompte = document_;
  U.actions.csvDecompte = csv;
})();
