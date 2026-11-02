// SPDX-License-Identifier: EUPL-1.2
/*
 * Listes et affichage propres à l'établissement (Administration → Établissement et services), demande du porteur :
 * modes d'hospitalisation, fonctions des professionnels de surveillance, motifs de pause, motifs de fin propres,
 * raccourcis de durée des pauses, seuils des points de vigilance, durée d'affichage des mesures terminées,
 * contact et consigne de l'écran de connexion, logo. Chaque réglage est une saisie CONFIG (tracée, annulable).
 * Règles et valeurs par défaut : model.js (listesConfig, optionsVigilance, optionsAffichage).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  function lignes(t) { return t.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }
  function zone(valeurs, n) { return h('textarea', { rows: n || 5, spellcheck: 'false' }, valeurs.join('\n')); }
  function nombre(v, min, max) { return h('input', { type: 'number', min: min, max: max, step: 1, value: v }); }

  /** Codes de mode d'hospitalisation déjà employés dans les données (non supprimables). */
  function modesEmployes() {
    var st = U.st(), vus = {};
    Object.keys(st.patients || {}).forEach(function (k) { ((st.patients[k] || {}).modes || []).forEach(function (x) { vus[x.mode] = 1; }); });
    M.listeMesures(st).forEach(function (m) { if (m.modeHospi) vus[m.modeHospi] = 1; });
    return vus;
  }

  // ------------------------------------------------------------ Modes d'hospitalisation
  function panneauModes() {
    var liste = (U.config().modesHospitalisation || []).map(function (x) { return { code: x.code, libelle: x.libelle, contrainte: x.contrainte !== false, ancien: x.code }; });
    var corps = h('tbody'), zoneErr = h('div');
    function dessiner() {
      U.vider(corps);
      var employes = modesEmployes();
      liste.forEach(function (x, i) {
        var code = h('input', { type: 'text', maxlength: 20, value: x.code, 'aria-label': 'Code', disabled: !!employes[x.ancien], oninput: function () { x.code = code.value; } });
        var lib = h('input', { type: 'text', maxlength: 100, value: x.libelle, 'aria-label': 'Libellé', oninput: function () { x.libelle = lib.value; } });
        var cb = h('input', { type: 'checkbox', checked: x.contrainte, 'aria-label': 'Soins sans consentement', onchange: function () { x.contrainte = cb.checked; } });
        corps.appendChild(h('tr', {}, h('td', {}, code), h('td', {}, lib), h('td', { class: 'centre' }, cb),
          h('td', {}, employes[x.ancien] ? h('small', { class: 'muted', text: 'employé dans les données' })
            : h('button', { class: 'btn petit', type: 'button', onclick: function () { liste.splice(i, 1); dessiner(); } }, 'Retirer'))));
      });
    }
    dessiner();
    return h('section', { class: 'panneau' }, h('h2', { text: 'Modes d’hospitalisation' }),
      h('p', { class: 'muted', text: 'Liste proposée à la création d’une mesure et dans la fiche patient. Exemples d’ajouts : soins sur décision de justice (art. 706-135 du code de procédure pénale), personne détenue (art. D. 398 du code de procédure pénale), ordonnance de placement provisoire d’un mineur. « Soins sans consentement » décoché = soins libres : les alertes et règles des soins libres s’appliquent (isolement exceptionnel, 12 h au plus). Un code déjà employé ne peut être ni modifié ni retiré ; son libellé reste modifiable.' }),
      zoneErr,
      h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', { text: 'Code' }), h('th', { text: 'Libellé' }), h('th', { text: 'Soins sans consentement' }), h('th'))), corps),
      h('div', { class: 'actions gauche' }, h('button', { class: 'btn', type: 'button', onclick: function () { liste.push({ code: '', libelle: '', contrainte: true, ancien: null }); dessiner(); } }, '+ Ajouter un mode')),
      U.boutonEnregistrer(async function () {
        var vus = {}, valeur = liste.map(function (x) {
          var c = String(x.code || '').trim(), l = String(x.libelle || '').trim();
          if (!c || !l) throw new Error('Chaque mode doit avoir un code et un libellé.');
          if (vus[c.toLowerCase()]) throw new Error('Le code « ' + c + ' » est en double.');
          vus[c.toLowerCase()] = 1;
          return { code: c, libelle: l, contrainte: !!x.contrainte };
        });
        if (!valeur.some(function (x) { return x.contrainte; })) throw new Error('Gardez au moins un mode de soins sans consentement.');
        await U.enregistrerConfig([['modesHospitalisation', valeur]]);
      }));
  }

  // ------------------------------------------------------------ Listes de saisie
  function panneauListes() {
    var l = M.listesConfig(U.config());
    var tFonctions = zone(l.fonctionsSurveillance, 7), tPauses = zone(l.motifsPause, 8), tFin = zone(l.motifsFinPropres, 4);
    var tRacc = h('input', { type: 'text', value: l.raccourcisPause.map(M.libRaccourci).join(' ; '), placeholder: '30 min ; 1 h ; 2 h ; 4 h' });
    function lireRaccourcis() {
      return tRacc.value.split(/[;,]/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
        var m = x.replace(/\s/g, '').toLowerCase().match(/^(?:(\d+)h)?(?:(\d+)(?:min|mn)?)?$/);
        if (!m || (!m[1] && !m[2])) throw new Error('Raccourci illisible : « ' + x + ' » (écrivez par exemple 30 min, 1 h, 1 h 30).');
        return (+m[1] || 0) * 60 + (+m[2] || 0);
      });
    }
    return h('section', { class: 'panneau' }, h('h2', { text: 'Listes de saisie' }),
      h('p', { class: 'muted', text: 'Une valeur par ligne. Les saisies déjà enregistrées gardent leur valeur.' }),
      h('div', { class: 'grille-2' },
        h('label', {}, 'Fonctions des professionnels chargés de la surveillance', tFonctions),
        h('label', {}, 'Motifs de pause (levée temporaire)', tPauses)),
      h('label', {}, 'Motifs de fin propres à l’établissement',
        h('small', { class: 'muted', text: 'Ajoutés à ceux de l’outil (' + M.MOTIFS_FIN.slice(0, -1).join(', ') + '), qui restent proposés car certains déclenchent un rappel (décès, fugue, mainlevée). « Autre » est toujours proposé en dernier et demande de préciser le motif.' }), tFin),
      h('label', {}, 'Raccourcis de durée des pauses (séparés par « ; »)', tRacc),
      U.boutonEnregistrer(async function () {
        var f = lignes(tFonctions), p = lignes(tPauses);
        if (!f.length) throw new Error('Indiquez au moins une fonction.');
        if (!p.length) throw new Error('Indiquez au moins un motif de pause.');
        var r = lireRaccourcis();
        if (r.some(function (x) { return x < 5 || x > 47 * 60; })) throw new Error('Chaque raccourci doit être compris entre 5 min et 47 h.');
        await U.enregistrerConfig([['listes', { fonctionsSurveillance: f, motifsPause: p, motifsFin: lignes(tFin), raccourcisPause: r }]]);
      }));
  }

  // ------------------------------------------------------------ Vigilance et affichage
  function panneauVigilance() {
    var v = M.optionsVigilance(U.config()), a = M.optionsAffichage(U.config());
    var iR = nombre(v.isolementRouge, 1, 360), cR = nombre(v.contentionRouge, 1, 360), iJ = nombre(v.isolementJaune, 1, 360), cJ = nombre(v.contentionJaune, 1, 360);
    var jours = nombre(a.mesuresTermineesJours, 1, 90);
    return h('section', { class: 'panneau' }, h('h2', { text: 'Points de vigilance et liste des mesures' }),
      h('p', { class: 'muted', text: 'Cumul sur 15 jours glissants à partir duquel un patient est signalé « cumul élevé » (rouge : tableau de bord, onglet Patients, création d’une mesure) ou à surveiller (orange, onglet Patients). Par défaut : rouge à 48 h d’isolement ou 24 h de contention, orange à 24 h ou 12 h. Ces seuils n’ont aucun effet sur les échéances JLD, qui suivent les règles légales.' }),
      h('div', { class: 'grille-2' },
        h('label', {}, 'Rouge : isolement (h)', iR), h('label', {}, 'Rouge : contention (h)', cR),
        h('label', {}, 'Orange : isolement (h)', iJ), h('label', {}, 'Orange : contention (h)', cJ)),
      h('label', {}, 'Mesures terminées visibles dans la liste des mesures (jours, 15 par défaut)', jours),
      U.boutonEnregistrer(async function () {
        var val = { isolementRouge: +iR.value, contentionRouge: +cR.value, isolementJaune: +iJ.value, contentionJaune: +cJ.value };
        Object.keys(val).forEach(function (k) { if (!(val[k] > 0 && val[k] <= 360)) throw new Error('Les seuils doivent être compris entre 1 et 360 h.'); });
        if (val.isolementJaune > val.isolementRouge || val.contentionJaune > val.contentionRouge) throw new Error('Le seuil orange ne peut pas dépasser le seuil rouge.');
        var j = Math.round(+jours.value);
        if (!(j >= 1 && j <= 90)) throw new Error('Durée d’affichage : de 1 à 90 jours.');
        var aff = Object.assign({}, U.config().affichage || {}, { mesuresTermineesJours: j });
        await U.enregistrerConfig([['vigilance', val], ['affichage', aff]]);
      }));
  }

  /** Réduit une image (logo) à 240 × 96 px au plus, en PNG. */
  function reduireLogo(fichier) {
    return new Promise(function (resoudre, rejeter) {
      if (!/^image\/(png|jpeg)$/.test(fichier.type)) return rejeter(new Error('Choisissez une image PNG ou JPEG.'));
      var lecteur = new FileReader();
      lecteur.onload = function () {
        var img = new Image();
        img.onload = function () {
          var r = Math.min(1, 240 / img.width, 96 / img.height), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL('image/png');
          if (url.length > 110000) url = c.toDataURL('image/jpeg', 0.85);
          resoudre(url);
        };
        img.onerror = function () { rejeter(new Error('Image illisible.')); };
        img.src = lecteur.result;
      };
      lecteur.onerror = function () { rejeter(new Error('Fichier illisible.')); };
      lecteur.readAsDataURL(fichier);
    });
  }

  function panneauAccueil() {
    var a = M.optionsAffichage(U.config()), logo = a.logo;
    var contact = h('textarea', { rows: 3, maxlength: 300, placeholder: 'Ex. : cadre de santé de l’unité, poste 1234 ; nuit et week-end : cadre de garde, poste 5678 ; panne : service informatique, poste 4321' }, a.contact);
    var consigne = h('textarea', { rows: 3, maxlength: 600, placeholder: 'Ex. : en cas de panne de l’outil, appliquer la procédure dégradée (fiche papier dans le classeur de l’unité).' }, a.consigne);
    var apercu = h('div', { class: 'apercu-logo' });
    function dessinerApercu() {
      U.vider(apercu);
      apercu.appendChild(logo ? h('img', { class: 'logo-etab', src: logo, alt: 'Logo de l’établissement' }) : h('small', { class: 'muted', text: 'Aucun logo : le pictogramme « IC » de l’outil est affiché.' }));
    }
    dessinerApercu();
    var fichier = h('input', { type: 'file', accept: 'image/png,image/jpeg', onchange: async function () {
      if (!fichier.files[0]) return;
      try { logo = await reduireLogo(fichier.files[0]); dessinerApercu(); } catch (e) { alert(e.message); }
      fichier.value = '';
    } });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Écran de connexion et logo' }),
      h('p', { class: 'muted', text: 'Le contact et la consigne s’affichent sur l’écran de connexion, et le contact sur les fiches de remise des identifiants. Les données étant chiffrées, l’écran de connexion d’un poste montre ce qui y a été lu lors de la dernière connexion (rien sur un poste jamais utilisé). Le logo remplace le pictogramme de l’outil dans l’en-tête ; il est réduit à 240 × 96 pixels.' }),
      h('label', {}, 'Contact en cas de difficulté', contact),
      h('label', {}, 'Consigne de l’établissement', consigne),
      h('div', { class: 'actions gauche' }, h('label', {}, 'Logo (PNG ou JPEG)', fichier), apercu,
        h('button', { class: 'btn petit', type: 'button', onclick: function () { logo = ''; dessinerApercu(); } }, 'Retirer le logo')),
      U.boutonEnregistrer(async function () {
        var aff = Object.assign({}, U.config().affichage || {}, { contact: contact.value.trim(), consigne: consigne.value.trim(), logo: logo || '' });
        if ((aff.logo || '').length > 120000) throw new Error('Logo trop volumineux.');
        await U.enregistrerConfig([['affichage', aff]]);
      }));
  }

  U.listes = { panneauModes: panneauModes, panneauListes: panneauListes, panneauVigilance: panneauVigilance, panneauAccueil: panneauAccueil };
})();
