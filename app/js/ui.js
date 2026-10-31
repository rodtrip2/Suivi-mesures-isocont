// SPDX-License-Identifier: EUPL-1.2
/*
 * Interface — Suivi-mesures-isocont.
 * Construction du DOM sans innerHTML : aucune donnée saisie n'est jamais
 * interprétée comme du HTML.
 */
(function () {
  'use strict';
  var SIC = self.SIC, M = SIC.model, R = SIC.rules, C = SIC.crypto;
  var H = R.H, J = R.J;

  // ================================================================ Outils
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'required') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) ajouterEnfant(el, arguments[i]);
    return el;
  }
  function ajouterEnfant(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { ajouterEnfant(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function vider(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  var fmtDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  var fmtCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  var fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  function date(ms) { return typeof ms === 'number' ? fmtDate.format(ms) : '—'; }
  function court(ms) { return typeof ms === 'number' ? fmtCourt.format(ms) : '—'; }
  function duree(heures) {
    if (!isFinite(heures)) return '—';
    var neg = heures < 0; heures = Math.abs(heures);
    var tot = Math.round(heures * 60), j = Math.floor(tot / 1440), hh = Math.floor((tot % 1440) / 60), mm = tot % 60;
    var s = j ? j + ' j ' + hh + ' h' : hh + ' h ' + String(mm).padStart(2, '0');
    return (neg ? '−' : '') + s;
  }
  function relatif(ms, maintenant) {
    var d = (ms - maintenant) / H;
    return d >= 0 ? 'dans ' + duree(d) : 'il y a ' + duree(-d);
  }
  function versSaisie(ms) {
    var d = new Date(ms);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function depuisSaisie(s) { var t = new Date(s).getTime(); if (!isFinite(t)) throw new Error('Date invalide.'); return t; }
  function idMesure() { return 'M' + Date.now().toString(36).toUpperCase() + C.hex(C.aleatoire(2)).toUpperCase(); }

  function toast(msg) {
    var t = h('div', { class: 'toast', role: 'status', text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  var LIB_TIERS = { INFORME: 'Tiers informé', TENTATIVE: 'Tentative sans succès', PAS_DE_TIERS: 'Pas de tiers identifié', REFUS_PATIENT: 'Refus du patient', AUTRE: 'Non informé — autre motif' };
  var LIB_NATURE = { INFO: 'Information du JLD', SAISINE: 'Saisine du JLD', DECISION: 'Décision reçue du JLD' };
  var LIB_EVT = {
    CONFIG: 'Paramétrage', PATIENT: 'Patient', MODE_HOSPI: "Mode d'hospitalisation", MESURE_DEBUT: 'Début de mesure',
    MESURE_FIN: 'Fin de mesure', PAUSE: 'Pause de mesure', REPRISE: 'Reprise de mesure', TIERS: 'Information du tiers', JLD: 'JLD', PROFESSIONNEL: 'Professionnel en CSI',
    CORRECTION: 'Correction', ANNULATION: 'Annulation', COMPTE: 'Comptes et clés'
  };
  var LIB_COMPTE = { FORMATION_CREEE: 'jeu de formation créé ou régénéré', CREATION_LOT: 'comptes créés en lot', CREATION: 'compte créé', ROLES: 'rôles modifiés', MDP_CHANGE: 'mot de passe changé', MDP_REINIT: 'mot de passe réinitialisé', CLE_AJOUT: 'clé de sécurité enregistrée', CLE_RETRAIT: 'clé de sécurité retirée', CODE_SECOURS: 'nouveau code de secours généré' };
  var MOTIFS_PAUSE = ['Repas', 'Hygiène, douche', 'Visite', 'Appel téléphonique', 'Sortie accompagnée dans l’unité', 'Activité thérapeutique', 'Examen ou soin', 'Autre'];
  var LIB_STATUT = { ok: 'dans les temps', proche: 'échéance proche', depasse: 'dépassée', fait: 'fait à temps', 'fait-retard': 'fait hors délai', na: 'sans objet' };

  // ================================================================ État
  var App = { dossier: null, session: null, onglet: 'tableau', service: '*', minuteurs: [], derniereActivite: Date.now(), message: null };
  try { App.service = localStorage.getItem('sic-service') || '*'; } catch (e) { /* stockage indisponible */ }
  var racine = document.getElementById('app');

  function st() { return App.session && App.session.etat; }
  function config() { return st() ? st().config : M.CONFIG_DEFAUT; }
  function tousServices() { return config().services || []; }
  /** Services visibles par l'utilisateur connecté (tous pour un administrateur). */
  function services() {
    if (!App.session || !App.session.utilisateur || !st()) return tousServices();
    var miens = App.session.mesServices();
    return tousServices().filter(function (x) { return miens.indexOf(x.code) >= 0; });
  }
  function libService(code) { var s = tousServices().filter(function (x) { return x.code === code; })[0]; return s ? s.libelle : code; }
  function patient(id) { return st().patients[id] || { id: id, nom: '?', prenom: '', modes: [] }; }
  function nomPatient(id) { var p = patient(id); return (p.nom || '?') + ' ' + (p.prenom || ''); }
  function modeActuel(p) { return p.modes && p.modes.length ? p.modes[p.modes.length - 1].mode : ''; }
  function dansService(m) {
    if (App.service !== '*') return m.service === App.service;
    return App.session.mesServices().indexOf(m.service) >= 0;
  }
  function etablissement() { return config().etablissement || ''; }

  function erreurDans(zone, e) {
    vider(zone);
    if (e) zone.appendChild(h('div', { class: 'erreur', role: 'alert', text: e.message || String(e) }));
  }

  // ================================================================ Rendu principal
  function rendre() {
    vider(racine);
    if (App.dossier && App.dossier.mode === 'demo') racine.appendChild(h('div', { class: 'bandeau-demo', text: 'Mode démonstration — données fictives uniquement, stockées dans ce navigateur. Ne saisissez aucune donnée réelle.' }));
    if (!App.dossier) return racine.appendChild(ecranAccueil());
    if (!App.session.coffre) return racine.appendChild(App.anomalie ? ecranAnomalie() : ecranInitialisation());
    if (!App.session.cle) return racine.appendChild(ecranConnexion());
    if (App.session.utilisateur && App.session.utilisateur.mdpProvisoire) return racine.appendChild(ecranMotDePasseObligatoire());
    racine.appendChild(ecranApplication());
  }

  function marque(sousTitre) {
    return h('div', { class: 'marque' },
      h('div', { class: 'logo', 'aria-hidden': 'true', text: 'IC' }),
      h('div', {}, h('b', { text: 'Suivi des mesures d’isolement et de contention' }), h('small', { text: sousTitre || ('Version ' + SIC.VERSION) })));
  }

  // ---------------------------------------------------------------- Accueil
  function ecranAccueil() {
    var zoneErr = h('div');
    var pile = h('div', { class: 'pile' });
    var carte = h('div', { class: 'carte' }, marque(), h('p', { text: 'Les données restent dans un dossier du réseau de l’établissement, chiffrées sur ce poste avant d’y être écrites. Rien n’est envoyé sur Internet.' }), zoneErr, pile);

    async function ouvrir(fn) {
      try { App.dossier = await fn(); await demarrerSession(); }
      catch (e) { if (e.name !== 'AbortError') erreurDans(zoneErr, e); }
    }
    SIC.Dossier.precedent().then(function (prec) {
      if (prec) {
        pile.insertBefore(h('button', { class: 'btn primaire', onclick: function () { ouvrir(function () { return SIC.Dossier.rouvrir(prec); }); } }, 'Reprendre : ' + prec.nom), pile.firstChild);
        pile.insertBefore(h('div', { class: 'separateur', text: 'ou' }), pile.children[1]);
      }
    });
    var reseauOk = !!window.showDirectoryPicker;
    pile.appendChild(h('button', { class: 'btn' + (reseauOk ? ' primaire' : ''), disabled: !reseauOk, onclick: function () { ouvrir(SIC.Dossier.choisirReseau); } }, 'Ouvrir le dossier réseau du service…'));
    if (!reseauOk) pile.appendChild(h('small', { text: 'L’ouverture d’un dossier réseau nécessite Edge ou Chrome à jour.' }));
    pile.appendChild(h('button', { class: 'btn', onclick: function () { ouvrir(SIC.Dossier.demo); } }, 'Mode démonstration (données fictives)'));
    pile.appendChild(h('small', { text: location.protocol === 'file:' ? 'Application ouverte depuis un fichier : les clés de sécurité (YubiKey) ne sont pas disponibles dans ce mode.' : 'Astuce démonstration : ouvrez un second onglet pour simuler un autre poste et observer la saisie simultanée.' }));
    return h('div', { class: 'ecran' }, carte);
  }

  async function demarrerSession() {
    App.session = new SIC.Session(App.dossier);
    App.session.sur(function () { if (App.session.cle) rendreContenu(); });
    await App.session.chargerCoffre();
    App.anomalie = App.session.coffre ? null : await App.dossier.anomalie();
    rendre();
  }

  /** Dossier sans coffre mais contenant des saisies : jamais proposé à l'initialisation. */
  function ecranAnomalie() {
    var formation = App.anomalie === 'formation';
    return h('div', { class: 'ecran' }, h('div', { class: 'carte' }, marque(App.dossier.nom),
      h('h1', { text: formation ? 'Ce dossier est un jeu de formation' : 'Coffre introuvable' }),
      h('div', { class: 'erreur', text: formation
        ? 'Vous avez ouvert le sous-dossier « formation », qui contient le jeu de données fictives. Ouvrez le dossier principal (le dossier parent) ; le mode formation se choisit ensuite à la connexion.'
        : 'Ce dossier contient des saisies mais pas de fichier coffre.json : sans lui, les données ne peuvent pas être lues. Ne réinitialisez pas ce dossier : faites restaurer coffre.json depuis la sauvegarde par la DSI (voir les procédures de secours).' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn primaire', onclick: changerDossier }, 'Choisir un autre dossier'))));
  }

  // ---------------------------------------------------------------- Initialisation
  function ecranInitialisation() {
    var zoneErr = h('div');
    var nom = h('input', { type: 'text', required: true, autocomplete: 'name', placeholder: 'Prénom NOM' });
    var login = h('input', { type: 'text', required: true, autocomplete: 'username', placeholder: 'ex. prenom.nom' });
    var mdp = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
    var mdp2 = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
    var demo = h('input', { type: 'checkbox', checked: App.dossier.mode === 'demo' });
    var bouton = h('button', { class: 'btn primaire', type: 'submit' }, 'Initialiser le dossier');
    var form = h('form', { class: 'pile', onsubmit: async function (ev) {
      ev.preventDefault(); erreurDans(zoneErr, null);
      try {
        if (mdp.value.length < 12) throw new Error('Le mot de passe doit comporter au moins 12 caractères.');
        if (mdp.value !== mdp2.value) throw new Error('Les deux mots de passe ne correspondent pas.');
        bouton.disabled = true; bouton.textContent = 'Chiffrement en cours…';
        var code = await App.session.initialiser({ nom: nom.value, login: login.value, motDePasse: mdp.value });
        if (demo.checked) { bouton.textContent = 'Chargement des données fictives…'; await SIC.chargerDemo(App.session); }
        afficherCodeSecours(code, true);
      } catch (e) { bouton.disabled = false; bouton.textContent = 'Initialiser le dossier'; erreurDans(zoneErr, e); }
    } },
      h('h1', { text: 'Initialiser le dossier' }),
      h('p', { class: 'muted', text: 'Dossier : ' + App.dossier.nom + '. Ce compte sera cadre de santé et administrateur ; les deux rôles pourront être séparés ensuite.' }),
      zoneErr,
      h('div', { class: 'grille-2' }, h('label', {}, 'Nom affiché', nom), h('label', {}, 'Identifiant', login)),
      h('div', { class: 'grille-2' }, h('label', {}, 'Mot de passe (12 caractères minimum)', mdp), h('label', {}, 'Confirmation', mdp2)),
      h('label', { class: 'case' }, demo, h('span', {}, 'Charger des données fictives de démonstration')),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: changerDossier }, 'Changer de dossier'), bouton));
    return h('div', { class: 'ecran' }, h('div', { class: 'carte' }, marque(), form));
  }

  function afficherCodeSecours(code, premiere) {
    vider(racine);
    var ok = h('input', { type: 'checkbox' });
    var suite = h('button', { class: 'btn primaire', disabled: true, onclick: function () { demarrerMinuteurs(); rendre(); } }, 'Continuer');
    ok.addEventListener('change', function () { suite.disabled = !ok.checked; });
    racine.appendChild(h('div', { class: 'ecran' }, h('div', { class: 'carte' }, marque(),
      h('h1', { text: premiere ? 'Code de secours' : 'Nouveau code de secours' }),
      h('p', { text: 'Ce code permet de récupérer les données si tous les mots de passe et clés de sécurité sont perdus. Il ne sera plus jamais affiché.' }),
      h('div', { class: 'code-secours', text: code }),
      h('p', { class: 'muted', text: 'Imprimez-le ou recopiez-le, puis conservez-le sous enveloppe scellée au coffre. Sans lui, une perte de tous les moyens de déblocage rendrait les données définitivement illisibles.' }),
      h('label', { class: 'case' }, ok, h('span', { text: 'J’ai noté le code de secours et je le conserve en lieu sûr.' })),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: function () { window.print(); } }, 'Imprimer'), suite))));
  }

  // ---------------------------------------------------------------- Connexion
  function ecranConnexion() {
    var zoneErr = h('div');
    if (App.message) { zoneErr.appendChild(h('div', { class: 'info', text: App.message })); App.message = null; }
    var login = h('input', { type: 'text', required: true, autocomplete: 'username' });
    var mdp = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    var bouton = h('button', { class: 'btn primaire', type: 'submit' }, 'Se connecter');
    var choix = SIC.ui.formation.choixConnexion();
    async function apres(jeu) {
      await SIC.ui.formation.appliquerChoix(jeu);   // données réelles ou mode formation
      demarrerMinuteurs(); rendre();
    }
    var form = h('form', { class: 'pile', onsubmit: async function (ev) {
      ev.preventDefault(); erreurDans(zoneErr, null); bouton.disabled = true; bouton.textContent = 'Déverrouillage…';
      try { await App.session.connexionMotDePasse(login.value, mdp.value); App.mdpProvisoireSaisi = mdp.value; await apres(choix.valeur()); }
      catch (e) { bouton.disabled = false; bouton.textContent = 'Se connecter'; erreurDans(zoneErr, e); }
    } }, h('label', {}, 'Identifiant', login), h('label', {}, 'Mot de passe', mdp), choix, bouton);

    var cles = App.session.coffre.emballages.filter(function (e) { return e.methode === 'cle'; });
    var autres = h('div', { class: 'pile' });
    if (cles.length) {
      var dispo = C.webauthnDisponible();
      autres.appendChild(h('button', { class: 'btn', disabled: !dispo, onclick: async function () {
        erreurDans(zoneErr, null);
        try { await App.session.connexionCleSecurite(); await apres(choix.valeur()); } catch (e) { erreurDans(zoneErr, e); }
      } }, 'Déverrouiller avec une clé de sécurité'));
      if (!dispo) autres.appendChild(h('small', { text: 'Clé de sécurité indisponible : la page doit être servie en HTTPS.' }));
    }
    var code = h('input', { type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX', autocomplete: 'off' });
    var blocCode = h('div', { class: 'pile', hidden: true }, h('label', {}, 'Code de secours', code),
      h('button', { class: 'btn', onclick: async function () {
        erreurDans(zoneErr, null);
        try { await App.session.connexionCodeSecours(code.value); App.onglet = 'admin'; await apres('reel'); } catch (e) { erreurDans(zoneErr, e); }
      } }, 'Déverrouiller avec le code de secours'));
    autres.appendChild(h('button', { class: 'btn lien', onclick: function () { blocCode.hidden = !blocCode.hidden; } }, 'Mot de passe perdu ? Utiliser le code de secours'));
    autres.appendChild(blocCode);

    return h('div', { class: 'ecran-pile' }, h('div', { class: 'ecran' }, h('div', { class: 'carte' }, marque(App.dossier.nom), zoneErr, form,
      h('div', { class: 'separateur', text: 'secours' }), autres,
      h('div', { class: 'actions' }, h('button', { class: 'btn lien', onclick: changerDossier }, 'Changer de dossier')))));
  }

  /** Première connexion ou mot de passe réinitialisé : changement obligatoire avant tout accès. */
  function ecranMotDePasseObligatoire() {
    var zoneErr = h('div');
    var a = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
    var b = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
    var bouton = h('button', { class: 'btn primaire', type: 'submit' }, 'Enregistrer et continuer');
    var form = h('form', { class: 'pile', onsubmit: async function (ev) {
      ev.preventDefault(); erreurDans(zoneErr, null);
      try {
        verifierNouveauMotDePasse(a.value, b.value);
        if (App.mdpProvisoireSaisi && a.value === App.mdpProvisoireSaisi) throw new Error('Choisissez un mot de passe différent du mot de passe provisoire.');
        bouton.disabled = true; bouton.textContent = 'Chiffrement en cours…';
        await App.session.changerMonMotDePasse(a.value);
        App.mdpProvisoireSaisi = null;
        toast('Mot de passe enregistré.');
        rendre();
      } catch (e) { bouton.disabled = false; bouton.textContent = 'Enregistrer et continuer'; erreurDans(zoneErr, e); }
    } },
      h('h1', { text: 'Choisissez votre mot de passe' }),
      h('p', { text: 'Bonjour ' + App.session.utilisateur.nom + '. Vous vous êtes connecté avec un mot de passe provisoire : vous devez le remplacer par un mot de passe personnel avant de continuer.' }),
      zoneErr,
      h('label', {}, 'Nouveau mot de passe (12 caractères minimum)', a),
      h('label', {}, 'Confirmation', b),
      h('small', { class: 'muted', text: 'Conseil : une courte phrase facile à retenir, par exemple quatre mots séparés par des espaces. Ne la notez pas près du poste.' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: function () { App.mdpProvisoireSaisi = null; verrouiller(); } }, 'Se déconnecter'), bouton));
    setTimeout(function () { a.focus(); }, 30);
    return h('div', { class: 'ecran-pile' }, SIC.ui.formation.bandeau(), h('div', { class: 'ecran' }, h('div', { class: 'carte' }, marque(etablissement() || App.dossier.nom), form)));
  }

  function verifierNouveauMotDePasse(a, b) {
    if (a.length < 12) throw new Error('Le mot de passe doit comporter au moins 12 caractères.');
    if (a !== b) throw new Error('Les deux saisies diffèrent.');
    if (/^(.)\1+$/.test(a)) throw new Error('Ce mot de passe est trop simple.');
  }

  async function changerDossier() {
    arreterMinuteurs();
    if (App.session) App.session.verrouiller();
    await SIC.Dossier.oublier();
    App.dossier = null; App.session = null;
    rendre();
  }

  function verrouiller(message) {
    arreterMinuteurs();
    App.session.verrouiller();
    App.message = message || null;
    rendre();
  }

  // ---------------------------------------------------------------- Minuteurs
  function demarrerMinuteurs() {
    arreterMinuteurs();
    App.derniereActivite = Date.now();
    App.minuteurs.push(setInterval(function () {
      if (App.session && App.session.cle && document.visibilityState === 'visible') App.session.synchroniser().catch(function () {});
    }, 5000));
    App.minuteurs.push(setInterval(function () {
      var limite = (config().inactiviteMinutes || 10) * 60000;
      if (App.session && App.session.cle && Date.now() - App.derniereActivite > limite) verrouiller('Session verrouillée après ' + (config().inactiviteMinutes || 10) + ' minutes d’inactivité.');
    }, 15000));
  }
  function arreterMinuteurs() { App.minuteurs.forEach(clearInterval); App.minuteurs = []; }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, function () { App.derniereActivite = Date.now(); }, true); });

  // ================================================================ Application
  var zoneContenu = null, zoneEntete = null;

  var ONGLETS = [
    ['tableau', 'Tableau de bord'], ['mesures', 'Mesures'], ['patients', 'Patients'], ['jld', 'JLD'], ['surveillance', 'Surveillance CSI'],
    ['registre', 'Registre anonymisé'], ['stats', 'Statistiques'], ['journal', 'Journal'], ['admin', 'Administration']
  ];

  function ecranApplication() {
    zoneEntete = h('header', { class: 'entete' });
    zoneContenu = h('main', { id: 'contenu' });
    var frag = h('div', {}, zoneEntete, zoneContenu);
    rendreContenu();
    return frag;
  }

  function rendreContenu() {
    if (!zoneContenu || !document.body.contains(zoneContenu)) return;
    var s = App.session;
    var focus = document.activeElement && document.activeElement.closest && document.activeElement.closest('dialog');
    if (focus) return; // ne pas reconstruire derrière une fenêtre ouverte
    if (s.utilisateur && s.utilisateur.mdpProvisoire) return rendre();
    var maintenant = Date.now();
    var conflits = st().conflits.length;
    var estAdmin = s.roles().indexOf('ADMIN') >= 0;
    if (!estAdmin && App.onglet === 'admin') App.onglet = 'tableau';
    if (!s.utilisateur.actif) return verrouiller('Votre compte a été désactivé.');
    var mesSv = services();
    if (App.service !== '*' && !mesSv.some(function (x) { return x.code === App.service; })) App.service = '*';
    if (mesSv.length === 1) App.service = mesSv[0].code;

    // En-tête
    vider(zoneEntete);
    var bandeau = SIC.ui.formation.bandeau();
    if (bandeau) zoneEntete.appendChild(bandeau);
    document.body.classList.toggle('en-formation', !!s.formation);
    var selService = h('select', { 'aria-label': 'Service', onchange: function () { App.service = selService.value; try { localStorage.setItem('sic-service', App.service); } catch (e) { /* */ } rendreContenu(); } },
      mesSv.length > 1 ? h('option', { value: '*', text: estAdmin ? 'Tous les services' : 'Tous mes services' }) : null,
      mesSv.map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: App.service === x.code }); }));
    if (App.service === '*') selService.value = '*';
    var age = s.derniereSynchro ? Math.round((maintenant - s.derniereSynchro) / 1000) : null;
    zoneEntete.appendChild(h('div', { class: 'entete-haut' }, marque(etablissement() || App.dossier.nom), h('div', { class: 'espace' }), mesSv.length ? selService : null,
      h('div', { class: 'statut-synchro', title: s.evts.length + ' saisies dans le journal' }, h('span', { class: 'point' }), age !== null ? 'Synchronisé' : '—'),
      h('div', { class: 'utilisateur' }, h('b', { text: s.utilisateur.nom }), s.utilisateur.roles.map(function (r) { return M.ROLES[r]; }).join(' · ')),
      s.utilisateur.id !== 'secours' ? h('button', { class: 'btn petit', onclick: modaleMonMotDePasse }, 'Mot de passe') : null,
      h('button', { class: 'btn petit', onclick: function () { verrouiller(); } }, 'Verrouiller')));
    var nav = h('nav', { class: 'onglets', 'aria-label': 'Sections' });
    ONGLETS.forEach(function (o) {
      if (o[0] === 'admin' && !estAdmin) return;
      nav.appendChild(h('button', { 'aria-current': App.onglet === o[0] ? 'page' : null, onclick: function () { App.onglet = o[0]; rendreContenu(); } },
        o[1], o[0] === 'journal' && conflits ? h('span', { class: 'pastille', text: conflits }) : null));
    });
    zoneEntete.appendChild(nav);

    vider(zoneContenu);
    var vues = { tableau: vueTableau, mesures: vueMesures, jld: vueJLD, surveillance: vueSurveillance, registre: vueRegistre, journal: vueJournal, admin: vueAdmin };
    var vue = vues[App.onglet] || SIC.ui.vues[App.onglet] || vueTableau;
    if (!mesSv.length && !estAdmin) { zoneContenu.appendChild(h('div', { class: 'panneau vide', text: 'Aucun service ne vous est affecté. Demandez à l’administrateur de vous en attribuer un.' })); return; }
    try { zoneContenu.appendChild(vue(maintenant)); }
    catch (e) { zoneContenu.appendChild(h('div', { class: 'erreur', text: 'Erreur d’affichage : ' + e.message })); console.error(e); }
  }

  // ---------------------------------------------------------------- Aides d'affichage
  function badgeType(type) { return h('span', { class: 'badge ' + (type === 'Isolement' ? 'iso' : 'cont'), text: type }); }

  function cellEcheance(x) {
    if (!x) return '—';
    return h('span', { class: 'ech ' + x.statut, title: LIB_STATUT[x.statut] + (x.effective ? ' — fait le ' + date(x.effective) : '') },
      court(x.echeance), x.effective ? h('small', { text: 'fait ' + court(x.effective) }) : null);
  }

  function prochaineEcheance(j) {
    var liste = [['INFO', j.info], ['SAISINE', j.saisine], ['DECISION', j.decision]].filter(function (x) { return !x[1].effective && x[1].statut !== 'na'; });
    return liste.length ? { nature: liste[0][0], ech: liste[0][1] } : null;
  }

  function tiersBadge(m) {
    var t = M.tiersCycle(m);
    if (!t) return h('span', { class: 'badge warn', text: 'À renseigner' });
    var cls = t.statut === 'INFORME' ? 'ok' : '';
    return h('span', { class: 'badge ' + cls, title: (t.personne ? t.personne + ' — ' : '') + 'par ' + (t.informateur === 'IDE' ? 'IDE (dernier recours)' : (t.nomInformateur || 'psychiatre')), text: LIB_TIERS[t.statut] || t.statut });
  }

  /** Badge de pause d'une mesure en cours (ou null). */
  function badgePause(m, maintenant) {
    var p = M.pauseEnCours(m, maintenant, config());
    if (!p) return null;
    var heure = function (ms) { return Math.abs(ms - maintenant) < 20 * H ? new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : court(ms); };
    return p.depassee
      ? h('span', { class: 'badge bad', title: 'Pause depuis ' + date(p.debut) + (p.motif ? ' — ' + p.motif : ''), text: 'Reprise ' + heure(p.reprisePrevue) + ' à confirmer' })
      : h('span', { class: 'badge pause', title: 'Pause depuis ' + date(p.debut) + (p.motif ? ' — ' + p.motif : '') + ' (' + (p.psychiatre || '?') + ')', text: 'Pause → ' + heure(p.reprisePrevue) });
  }

  function legendeEcheances() {
    return h('div', { class: 'legende' }, 'Échéances :',
      ['ok', 'proche', 'depasse', 'fait', 'fait-retard', 'na'].map(function (k) { return h('span', { class: 'ech ' + k, text: LIB_STATUT[k] }); }));
  }

  function mesuresVisibles() { return M.listeMesures(st()).filter(dansService); }

  // ---------------------------------------------------------------- Tableau de bord
  function vueTableau(maintenant) {
    var ms = mesuresVisibles();
    var enCours = ms.filter(function (m) { return typeof m.fin !== 'number'; });
    var depassees = 0, proches = 0, aVenir = [];
    enCours.forEach(function (m) {
      var j = M.suiviJLD(st(), m, maintenant);
      [['INFO', j.info], ['SAISINE', j.saisine], ['DECISION', j.decision]].forEach(function (x) {
        if (x[1].statut === 'depasse') depassees++;
        if (x[1].statut === 'proche') proches++;
      });
      var p = prochaineEcheance(j);
      if (p) aVenir.push({ m: m, j: j, p: p });
    });
    aVenir.sort(function (a, b) { return a.p.ech.echeance - b.p.ech.echeance; });
    var tiersARenseigner = enCours.filter(function (m) { return !M.tiersCycle(m); }).length;
    var libres = enCours.filter(function (m) { return !M.estContrainte(config(), M.modeA(st(), m.patientId, maintenant) || m.modeHospi); });
    var mineurs = enCours.filter(function (m) { return M.estMineur(st(), m.patientId, maintenant); });
    var vigilance = [];
    libres.forEach(function (m) { vigilance.push(h('li', {}, h('b', { text: nomPatient(m.patientId) }), ' — ', m.type.toLowerCase() + ' en cours alors que le patient est en ' + (M.modeA(st(), m.patientId, maintenant) || m.modeHospi) + ' (soins libres) : régulariser le mode d’hospitalisation ou mettre fin à la mesure.')); });
    mineurs.forEach(function (m) { vigilance.push(h('li', {}, h('b', { text: nomPatient(m.patientId) }), ' — patient mineur : vigilance renforcée.')); });
    var enPause = enCours.filter(function (m) { return M.pauseEnCours(m, maintenant, config()); });
    enPause.forEach(function (m) {
      var p = M.pauseEnCours(m, maintenant, config());
      if (p.depassee) vigilance.push(h('li', {}, h('b', { text: nomPatient(m.patientId) }), ' — ' + m.type.toLowerCase() + ' en pause : la reprise était prévue le ' + date(p.reprisePrevue) + '. Confirmez la reprise ou saisissez la fin de la mesure.'));
      if (m.type === 'Isolement') enCours.forEach(function (c) {
        if (c.type === 'Contention' && c.patientId === m.patientId && !M.pauseEnCours(c, maintenant, config())) vigilance.push(h('li', {}, h('b', { text: nomPatient(m.patientId) }), ' — contention en cours alors que l’isolement est en pause : mettez aussi la contention en pause ou saisissez sa fin.'));
      });
    });
    var vusRouge = {};
    enCours.forEach(function (m) {
      if (vusRouge[m.patientId]) return; vusRouge[m.patientId] = 1;
      var c = M.cumulsPatient(st(), m.patientId, maintenant);
      if (c.niveau === 'rouge') vigilance.push(h('li', {}, h('b', { text: nomPatient(m.patientId) }), ' — cumul élevé sur 15 jours : isolement ' + duree(c.iso15) + ', contention ' + duree(c.cont15) + '.'));
    });
    var postesIncomplets = [];
    services().forEach(function (sv) {
      if (App.service !== '*' && sv.code !== App.service) return;
      M.postesSurveillance(st(), sv.code, maintenant, 2).forEach(function (p) {
        if (p.professionnels.length < 2) postesIncomplets.push({ sv: sv, p: p });
      });
    });
    postesIncomplets.sort(function (a, b) { return b.p.debut - a.p.debut; });

    function ind(valeur, libelle, niveau) { return h('div', { class: 'indicateur ' + (niveau || '') }, h('div', { class: 'valeur', text: valeur }), h('div', { class: 'libelle', text: libelle })); }
    var nIso = enCours.filter(function (m) { return m.type === 'Isolement'; }).length;

    var tableEch = aVenir.length ? h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Patient', 'Mesure', 'Prochaine étape', 'Échéance', ''].map(function (t) { return h('th', { text: t }); }))),
      h('tbody', {}, aVenir.slice(0, 12).map(function (x) {
        return h('tr', {},
          h('td', {}, nomPatient(x.m.patientId), h('br'), h('small', { text: libService(x.m.service) })),
          h('td', {}, badgeType(x.m.type), ' ', h('small', { text: 'cycle ' + x.j.cycle })),
          h('td', { text: LIB_NATURE[x.p.nature] }),
          h('td', {}, cellEcheance(x.p.ech), h('br'), h('small', { text: relatif(x.p.ech.echeance, maintenant) })),
          h('td', { class: 'actions-ligne' }, App.session.peut('JLD') ? h('button', { class: 'btn petit', onclick: function () { modaleJLD(x.m); } }, 'Saisir') : null));
      })))) : h('div', { class: 'vide', text: 'Aucune échéance JLD en cours.' });

    var listePostes = postesIncomplets.length ? h('div', { class: 'postes' }, postesIncomplets.slice(0, 8).map(function (x) {
      return h('div', { class: 'poste incomplet' }, h('div', {}, h('b', { text: x.p.libelle }), h('br'), h('small', { text: fmtJour.format(x.p.debut) })),
        h('div', {}, h('small', { text: libService(x.sv.code) + ' — ' + x.p.professionnels.length + ' / 2 professionnels' })),
        App.session.peut('PROFESSIONNEL') ? h('button', { class: 'btn petit', onclick: function () { modaleProfessionnel(x.sv.code, x.p.date, x.p.periode); } }, 'Compléter') : null);
    })) : h('div', { class: 'vide', text: 'Tous les postes des dernières 48 h sont complets.' });

    return h('div', {},
      h('div', { class: 'indicateurs' },
        ind(enCours.length, 'Mesures en cours (' + nIso + ' isolement, ' + (enCours.length - nIso) + ' contention)'),
        ind(depassees, 'Échéances JLD dépassées', depassees ? 'bad' : 'ok'),
        ind(proches, 'Échéances JLD dans les 12 h', proches ? 'warn' : 'ok'),
        ind(enPause.length, 'Mesures en pause (levée temporaire)', enPause.some(function (m) { return M.pauseEnCours(m, maintenant, config()).depassee; }) ? 'bad' : ''),
        ind(tiersARenseigner, 'Tiers à renseigner (cycle en cours)', tiersARenseigner ? 'warn' : 'ok'),
        ind(postesIncomplets.length, 'Postes CSI incomplets (48 h)', postesIncomplets.length ? 'warn' : 'ok'),
        ind(st().conflits.length, 'Saisies en conflit', st().conflits.length ? 'bad' : 'ok'),
        ind(libres.length, 'Mesures chez un patient en soins libres', libres.length ? 'bad' : 'ok')),
      vigilance.length ? h('section', { class: 'panneau' }, h('h2', { text: 'Points de vigilance' }), h('ul', { class: 'vigilance' }, vigilance)) : null,
      h('div', { class: 'deux-colonnes' },
        h('section', { class: 'panneau' }, h('h2', { text: 'Prochaines échéances JLD' }), tableEch),
        h('section', { class: 'panneau' }, h('h2', { text: 'Surveillance en CSI à compléter' }), listePostes)));
  }

  // ---------------------------------------------------------------- Mesures
  var afficherAnciennes = false;
  function vueMesures(maintenant) {
    var ms = mesuresVisibles().filter(function (m) { return afficherAnciennes || R.etatAffichage(m, maintenant) !== 'ancienne'; });
    ms.sort(function (a, b) {
      var ea = typeof a.fin === 'number' ? 1 : 0, eb = typeof b.fin === 'number' ? 1 : 0;
      return ea - eb || b.debut - a.debut;
    });
    var cb = h('input', { type: 'checkbox', checked: afficherAnciennes, onchange: function () { afficherAnciennes = cb.checked; rendreContenu(); } });
    var barre = h('div', { class: 'barre' },
      h('h1', { text: 'Mesures' }), h('div', { class: 'espace' }),
      h('label', { class: 'case' }, cb, h('span', { text: 'Afficher les mesures terminées depuis plus de 15 jours' })),
      App.session.peut('MESURE_DEBUT') ? h('button', { class: 'btn primaire', onclick: modaleNouvelleMesure }, '+ Nouvelle mesure') : null);
    if (!ms.length) return h('div', {}, barre, h('div', { class: 'panneau vide', text: 'Aucune mesure à afficher.' }));

    var tbody = h('tbody');
    ms.forEach(function (m) {
      var etat = R.etatAffichage(m, maintenant);
      var j = M.suiviJLD(st(), m, maintenant);
      var enCours = etat === 'en-cours';
      var pause = enCours ? M.pauseEnCours(m, maintenant, config()) : null;
      var hPauses = M.dureePausesHeures(m, maintenant, config());
      tbody.appendChild(h('tr', { class: etat + (pause ? ' en-pause' : '') },
        h('td', { class: 'patient' }, h('b', { text: nomPatient(m.patientId) }), h('br'), h('small', { text: 'IPP ' + (patient(m.patientId).ipp || '—') + ' · ' + libService(m.service) })),
        h('td', {}, badgeType(m.type), m.leveeJLD ? h('div', {}, h('span', { class: 'badge bad', text: 'Levée JLD' })) : null, pause ? h('div', {}, badgePause(m, maintenant)) : null),
        h('td', { text: m.lieu || (m.csi ? 'CSI' : 'Hors CSI') }),
        h('td', { class: 'nowrap', text: court(m.debut) }),
        h('td', { class: 'nowrap' }, duree(M.dureeHeures(m, maintenant, config())), enCours ? null : h('br'), enCours ? null : h('small', { text: 'fin ' + court(m.fin) }),
          hPauses >= 1 / 60 ? h('div', {}, h('small', { class: 'muted', title: M.optionsPauses(config()).retrancher ? 'Levées temporaires, retranchées de la durée' : 'Levées temporaires, comptées dans la durée', text: (M.optionsPauses(config()).retrancher ? 'pauses retranchées ' : 'dont pauses ') + duree(hPauses) })) : null),
        h('td', { text: String(j.cycle) }),
        h('td', {}, cellEcheance(j.info)), h('td', {}, cellEcheance(j.saisine)), h('td', {}, cellEcheance(j.decision)),
        h('td', {}, tiersBadge(m)),
        h('td', { class: 'actions-ligne' },
          enCours && App.session.peut('JLD') ? h('button', { class: 'btn petit', onclick: function () { modaleJLD(m); } }, 'JLD') : null, ' ',
          App.session.peut('TIERS') ? h('button', { class: 'btn petit', onclick: function () { modaleTiers(m); } }, 'Tiers') : null, ' ',
          enCours && !pause && App.session.peut('PAUSE') ? h('button', { class: 'btn petit', title: 'Levée temporaire décidée par le psychiatre', onclick: function () { modalePause(m); } }, 'Pause') : null,
          pause && App.session.peut('REPRISE') ? h('button', { class: 'btn petit primaire', onclick: function () { modaleReprise(m); } }, 'Reprise') : null, ' ',
          enCours && App.session.peut('MESURE_FIN') ? h('button', { class: 'btn petit danger', onclick: function () { modaleFin(m); } }, 'Fin') : null, ' ',
          SIC.ui.actions.decompte && App.session.peut('JLD') ? h('button', { class: 'btn petit', onclick: function () { SIC.ui.actions.decompte(m); } }, 'Décompte') : null, ' ',
          h('button', { class: 'btn petit', onclick: function () { modaleDetail(m); } }, 'Détail'))));
    });
    return h('div', {}, barre,
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Patient', 'Type', 'Lieu', 'Début', 'Durée', 'Cycle', 'Info avant', 'Saisine avant', 'Décision avant', 'Tiers', ''].map(function (t) { return h('th', { text: t }); }))),
        tbody)),
      legendeEcheances(),
      h('p', { class: 'muted' }, h('small', { text: 'Les échéances sont calculées depuis le début de la mesure et le cumul des 15 jours précédents (même patient, même type), jamais depuis la date des décisions du juge.' })));
  }

  // ---------------------------------------------------------------- JLD
  function vueJLD(maintenant) {
    var enCours = mesuresVisibles().filter(function (m) { return typeof m.fin !== 'number'; }).map(function (m) {
      var j = M.suiviJLD(st(), m, maintenant); return { m: m, j: j, p: prochaineEcheance(j) };
    }).sort(function (a, b) { return (a.p ? a.p.ech.echeance : Infinity) - (b.p ? b.p.ech.echeance : Infinity); });
    var tbody = h('tbody');
    enCours.forEach(function (x) {
      var t = M.tiersCycle(x.m);
      tbody.appendChild(h('tr', { class: 'en-cours' },
        h('td', {}, h('b', { text: nomPatient(x.m.patientId) }), h('br'), h('small', { text: libService(x.m.service) })),
        h('td', {}, badgeType(x.m.type), h('br'), h('small', { text: 'depuis ' + duree(M.dureeHeures(x.m, maintenant, config())) }), badgePause(x.m, maintenant) ? h('div', {}, badgePause(x.m, maintenant)) : null),
        h('td', {}, String(x.j.cycle), x.j.rythmeLong ? h('div', {}, h('small', { text: 'rythme long' })) : null),
        h('td', { class: 'nowrap', text: duree(x.j.cumulAvant) }),
        h('td', {}, cellEcheance(x.j.info)), h('td', {}, cellEcheance(x.j.saisine)), h('td', {}, cellEcheance(x.j.decision)),
        h('td', {}, tiersBadge(x.m), t ? null : h('div', {}, h('small', { text: 'tiers à informer avec le juge' }))),
        h('td', { class: 'actions-ligne' }, App.session.peut('JLD') ? h('button', { class: 'btn petit primaire', onclick: function () { modaleJLD(x.m); } }, 'Saisir un envoi') : null)));
    });
    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Suivi JLD' }), h('div', { class: 'espace' }),
        h('small', { class: 'muted', text: 'Envois assurés par la secrétaire en semaine, par l’IDE le week-end et en son absence.' })),
      enCours.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Patient', 'Mesure', 'Cycle', 'Cumul 15 j avant', 'Information avant', 'Saisine avant', 'Décision avant', 'Tiers', ''].map(function (t) { return h('th', { text: t }); }))),
        tbody)) : h('div', { class: 'panneau vide', text: 'Aucune mesure en cours.' }),
      legendeEcheances());
  }

  // ---------------------------------------------------------------- Surveillance CSI
  function vueSurveillance(maintenant) {
    var svs = services().filter(function (s) { return App.service === '*' || s.code === App.service; });
    var bloc = h('div');
    svs.forEach(function (sv) {
      var postes = M.postesSurveillance(st(), sv.code, maintenant, 7);
      bloc.appendChild(h('section', { class: 'panneau' },
        h('h2', {}, libService(sv.code), h('span', { class: 'badge', text: postes.length + ' postes sur 7 jours' })),
        postes.length ? h('div', { class: 'postes' }, postes.map(function (p) {
          var n = p.professionnels.length;
          var creneaux = p.professionnels.map(function (x) { return h('span', { class: 'creneau', text: x.nom + (x.fonction ? ' (' + x.fonction + ')' : '') }); });
          for (var i = n; i < 2; i++) creneaux.push(h('span', { class: 'creneau libre', text: 'À renseigner' }));
          return h('div', { class: 'poste ' + (n >= 2 ? 'complet' : 'incomplet') },
            h('div', {}, h('b', { text: p.libelle }), h('br'), h('small', { text: fmtJour.format(p.debut) })),
            h('div', { class: 'creneaux' }, creneaux),
            App.session.peut('PROFESSIONNEL') ? h('button', { class: 'btn petit', onclick: function () { modaleProfessionnel(sv.code, p.date, p.periode); } }, 'Ajouter') : null);
        })) : h('div', { class: 'vide', text: 'Aucune mesure en CSI sur les 7 derniers jours.' })));
    });
    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Professionnels chargés de la surveillance en CSI' }), h('div', { class: 'espace' }),
        App.session.peut('PROFESSIONNEL') ? h('button', { class: 'btn', onclick: function () { modaleProfessionnel(App.service === '*' ? (services()[0] || {}).code : App.service); } }, 'Saisie libre') : null),
      h('p', { class: 'muted', text: 'Deux emplacements par poste couvert par une mesure en CSI. Ces informations alimentent la colonne « professionnels chargés de la surveillance » du registre anonymisé.' }),
      bloc);
  }

  // ---------------------------------------------------------------- Registre
  var anneeRegistre = new Date().getFullYear();
  function vueRegistre(maintenant) {
    var svCode = App.service === '*' ? (services()[0] || {}).code : App.service;
    var selAn = h('input', { type: 'number', value: anneeRegistre, min: 2020, max: 2100, onchange: function () { anneeRegistre = +selAn.value; rendreContenu(); } });
    var entrees = svCode ? M.registre(st(), svCode, anneeRegistre, maintenant) : [];
    var synthese = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    entrees.forEach(function (e) { synthese[e.categorie]++; });
    var LIB_CAT = M.LIB_CATEGORIES;

    function exporterCSV() {
      var lignes = [['Numéro', 'Catégorie', 'Début', 'Fin', 'Durée (h)', "Mode d'hospitalisation", 'Lieu', 'Psychiatre', 'Professionnels chargés de la surveillance']];
      entrees.forEach(function (e) {
        lignes.push([e.numero || 'en cours', LIB_CAT[e.categorie], date(e.debut), e.fin ? date(e.fin) : 'en cours', e.dureeHeures.toFixed(2).replace('.', ','), e.modeHospi, e.lieu, e.psychiatre, e.professionnels.join(', ')]);
      });
      var csv = '\ufeff' + lignes.map(function (l) { return l.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
      var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'registre_' + svCode + '_' + anneeRegistre + '.csv' });
      document.body.appendChild(a); a.click(); a.remove();
    }

    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Registre anonymisé' }), h('div', { class: 'espace' }),
        h('label', {}, 'Année', selAn),
        h('button', { class: 'btn', disabled: !entrees.length, onclick: exporterCSV }, 'Exporter (CSV)'),
        h('button', { class: 'btn', onclick: function () { window.print(); } }, 'Imprimer')),
      h('div', { class: 'seulement-impression' }, h('h2', { text: (etablissement() ? etablissement() + ' — ' : '') + 'Registre des mesures d’isolement et de contention — ' + libService(svCode) + ' — ' + anneeRegistre }), h('p', { text: 'Article L. 3222-5-1 du code de la santé publique. Édité le ' + date(Date.now()) + '.' })),
      svCode ? h('p', { class: 'muted', text: libService(svCode) + ' — article L. 3222-5-1 du CSP. Aucune donnée nominative.' + (App.service === '*' ? ' Choisissez un service en haut de page pour changer de service.' : '') }) : null,
      h('div', { class: 'indicateurs' }, Object.keys(synthese).map(function (k) {
        return h('div', { class: 'indicateur' }, h('div', { class: 'valeur', text: synthese[k] }), h('div', { class: 'libelle', text: k + ' — ' + LIB_CAT[k] }));
      })),
      entrees.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['N°', 'Début', 'Fin', 'Durée', "Mode d'hosp.", 'Lieu', 'Psychiatre', 'Professionnels chargés de la surveillance'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, entrees.map(function (e) {
          return h('tr', { class: e.fin ? '' : 'en-cours' },
            h('td', {}, e.numero ? h('b', { text: e.numero }) : h('small', { text: 'en cours' })),
            h('td', { class: 'nowrap', text: date(e.debut) }),
            h('td', { class: 'nowrap', text: e.fin ? date(e.fin) : 'en cours' }),
            h('td', { class: 'nowrap', text: duree(e.dureeHeures) }),
            h('td', {}, e.modeHospi || '—', e.basculeMode ? h('span', { class: 'badge', title: 'Mode modifié dans les 12 h suivant le début : le nouveau mode est retenu.', text: '*' }) : null),
            h('td', { text: e.lieu || '—' }),
            h('td', { text: e.psychiatre || '—' }),
            h('td', {}, e.professionnels.length ? e.professionnels.join(', ') : (e.categorie === 'A' || e.categorie === 'C' ? h('span', { class: 'badge warn', text: 'non renseigné' }) : '—')));
        })))) : h('div', { class: 'panneau vide', text: 'Aucune entrée pour cette année.' }));
  }

  // ---------------------------------------------------------------- Journal
  function resumeEvt(e) {
    var d = e.data || {};
    var m = d.mesureId && st().mesures[d.mesureId];
    var qui = m ? nomPatient(m.patientId) + ' — ' : '';
    switch (e.type) {
      case 'MESURE_DEBUT': return nomPatient(d.patientId) + ' — ' + d.typeMesure + ' débutée le ' + date(d.debut) + ' (' + (d.psychiatre || '?') + ', ' + (d.lieu || '') + ')';
      case 'MESURE_FIN': return qui + 'fin le ' + date(d.fin) + (d.psychiatre ? ' (' + d.psychiatre + ')' : '');
      case 'PAUSE': return qui + 'pause du ' + date(d.debut) + ', reprise prévue le ' + date(d.reprisePrevue) + (d.motif ? ' — ' + d.motif : '') + (d.psychiatre ? ' (' + d.psychiatre + ')' : '');
      case 'REPRISE': return qui + 'reprise le ' + date(d.date);
      case 'TIERS': return qui + (LIB_TIERS[d.statut] || d.statut) + (d.personne ? ' : ' + d.personne : '') + ' — par ' + (d.informateur === 'IDE' ? 'l’IDE' : (d.nomInformateur || 'le psychiatre'));
      case 'JLD': return qui + LIB_NATURE[d.nature] + ' (cycle ' + d.cycle + ') le ' + date(d.date) + (d.decision ? ' — ' + (d.decision === 'LEVEE' ? 'levée' : 'maintien') : '');
      case 'PROFESSIONNEL': return libService(d.service) + ' — ' + d.date + ' ' + d.periode + ' : ' + d.nom + (d.fonction ? ' (' + d.fonction + ')' : '');
      case 'PATIENT': return (d.nom || '') + ' ' + (d.prenom || '') + (d.ipp ? ' — IPP ' + d.ipp : '');
      case 'MODE_HOSPI': return nomPatient(d.patientId) + ' — ' + d.mode + ' à partir du ' + date(d.date);
      case 'CONFIG': return 'Paramètre « ' + d.cle + ' » modifié';
      case 'ANNULATION': return 'Saisie ' + (d.cible || '').slice(-8) + ' annulée' + (d.motif ? ' : ' + d.motif : '');
      case 'COMPTE': if (d.comptes) return LIB_COMPTE[d.action] + ' : ' + d.comptes.length + ' — ' + d.comptes.map(function (x) { return x.login; }).join(', ');
        return (LIB_COMPTE[d.action] || d.action) + (d.login ? ' — ' + d.login : '') + (d.roles ? ' (' + d.roles.map(function (r) { return M.ROLES[r]; }).join(', ') + ')' : '') + (d.libelle ? ' — ' + d.libelle : '');
      case 'CORRECTION': return qui + 'correction : ' + Object.keys(d.champs || {}).join(', ') + (d.motif ? ' — ' + d.motif : '');
      case 'LOT': return (d.libelle || 'Lot de saisies') + ' — ' + (d.evenements || []).length + ' saisies';
      case 'STATS': return 'Statistiques ' + libService(d.service) + ' ' + d.annee + ' : patients HC ' + (d.hc == null ? '—' : d.hc) + ', sous contrainte ' + (d.ssc == null ? '—' : d.ssc);
      default: return e.type;
    }
  }

  function vueJournal() {
    var etat = st();
    var conflitsIds = {};
    etat.conflits.forEach(function (c) { conflitsIds[c.concurrent] = c; conflitsIds[c.retenu] = c; });
    var peutArbitrer = App.session.peut('ANNULATION');
    var blocConflits = etat.conflits.length ? h('section', { class: 'panneau' },
      h('h2', { text: 'Saisies en conflit à arbitrer' }),
      h('p', { class: 'muted', text: 'Deux saisies concurrentes portent sur la même donnée. La première est appliquée ; aucune n’est perdue. Choisissez celle à conserver.' }),
      etat.conflits.map(function (c) {
        var a = etat.parId[c.retenu], b = etat.parId[c.concurrent];
        function choix(garder, annuler) {
          return h('button', { class: 'btn petit', disabled: !peutArbitrer, onclick: async function () {
            try { await App.session.enregistrer('ANNULATION', { cible: annuler.id, motif: 'Arbitrage de conflit : saisie de ' + App.session.nomAuteur(garder.by) + ' conservée' }); toast('Conflit arbitré.'); }
            catch (e) { alert(e.message); }
          } }, 'Garder');
        }
        return h('div', { class: 'recap' },
          h('div', {}, h('b', { text: 'Appliquée : ' }), resumeEvt(a), ' — ', App.session.nomAuteur(a.by), ' ', choix(a, b)),
          h('div', {}, h('b', { text: 'Concurrente : ' }), resumeEvt(b), ' — ', App.session.nomAuteur(b.by), ' ', choix(b, a)));
      })) : null;
    var manquants = etat.manquants.length ? h('div', { class: 'erreur', text: etat.manquants.length + ' saisie(s) manquante(s) dans le dossier (fichier supprimé ou non encore synchronisé) : ' + etat.manquants.map(function (x) { return x.manque; }).join(', ') + '. Restaurez-les depuis la sauvegarde.' }) : null;
        var rejetes = App.session.rejetes.length ? h('div', { class: 'erreur', text: App.session.rejetes.length + ' fichier(s) illisible(s) ou altéré(s) ignoré(s) : ' + App.session.rejetes.map(function (r) { return r.nom; }).join(', ') }) : null;

    var lignes = etat.journal.slice().reverse().slice(0, 400);
    return h('div', {},
      h('div', { class: 'barre' }, h('h1', { text: 'Journal des saisies' }), h('div', { class: 'espace' }), h('small', { class: 'muted', text: etat.journal.length + ' saisies, chacune dans un fichier chiffré distinct, jamais modifié.' })),
      rejetes, manquants, blocConflits,
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Saisi le', 'Auteur', 'Action', 'Détail', ''].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, lignes.map(function (e) {
          var annule = etat.annules[e.id];
          return h('tr', { class: annule ? 'ancienne' : '' },
            h('td', { class: 'nowrap', text: date(Date.parse(e.at)) }),
            h('td', { text: App.session.nomAuteur(e.by) }),
            h('td', {}, LIB_EVT[e.type] || e.type),
            h('td', {}, resumeEvt(e)),
            h('td', {}, annule ? h('span', { class: 'badge', text: 'annulée' }) : null, conflitsIds[e.id] ? h('span', { class: 'badge bad', text: 'conflit' }) : null));
        })))),
      etat.journal.length > 400 ? h('p', { class: 'muted', text: 'Affichage limité aux 400 saisies les plus récentes.' }) : null);
  }

  // ================================================================ Fenêtres
  function modale(titre, contenu, boutons, options) {
    return new Promise(function (resoudre) {
      var zoneErr = h('div');
      var d = h('dialog', { 'aria-label': titre });
      function fermer(v) { d.close(); d.remove(); resoudre(v); rendreContenu(); }
      var pied = h('div', { class: 'pied' });
      boutons.forEach(function (b) {
        pied.appendChild(h('button', { class: 'btn ' + (b.classe || ''), type: 'button', onclick: async function (ev) {
          if (!b.action) return fermer(null);
          var bt = ev.currentTarget; bt.disabled = true; erreurDans(zoneErr, null);
          try { var r = await b.action(); if (r !== false) fermer(r === undefined ? true : r); }
          catch (e) { erreurDans(zoneErr, e); zoneErr.scrollIntoView({ block: 'nearest' }); }
          finally { bt.disabled = false; }
        } }, b.texte));
      });
      d.appendChild(h('div', { class: 'tete' }, h('h2', { text: titre }), h('button', { class: 'btn petit', 'aria-label': 'Fermer', onclick: function () { fermer(null); } }, '✕')));
      d.appendChild(h('div', { class: 'corps' }, zoneErr, contenu));
      d.appendChild(pied);
      d.addEventListener('cancel', function (ev) { ev.preventDefault(); fermer(null); });
      document.body.appendChild(d);
      d.showModal();
      if (options && options.focus) setTimeout(function () { options.focus.focus(); }, 30);
    });
  }

  function selectPsychiatre(valeur) {
    var liste = config().psychiatres || [];
    var sel = h('select', {}, h('option', { value: '', text: '— Choisir —' }), liste.map(function (p) { return h('option', { value: p, text: p, selected: p === valeur }); }), h('option', { value: '__autre', text: 'Autre…' }));
    var autre = h('input', { type: 'text', placeholder: 'Nom du psychiatre', hidden: true });
    sel.addEventListener('change', function () { autre.hidden = sel.value !== '__autre'; if (!autre.hidden) autre.focus(); });
    var bloc = h('div', { class: 'pile' }, sel, autre);
    bloc.valeur = function () { var v = sel.value === '__autre' ? autre.value.trim() : sel.value; if (!v) throw new Error('Indiquez le psychiatre décisionnaire.'); return v; };
    return bloc;
  }

  function recapMesure(m, maintenant) {
    return h('div', { class: 'recap' },
      h('div', {}, h('b', { text: nomPatient(m.patientId) }), ' — ', m.type, ' — ', m.lieu || ''),
      h('div', { text: 'Début ' + date(m.debut) + ' (' + (m.psychiatreDebut || '?') + ') · durée ' + duree(M.dureeHeures(m, maintenant || Date.now(), config())) }));
  }

  // ---------------------------------------------------------------- Nouvelle mesure
  /** Message d'alerte rouge placé sous un champ ; `afficher(textes)` le met à jour. */
  function alerteChamp() {
    var zone = h('div', { class: 'alerte-champ', role: 'alert', hidden: true });
    zone.afficher = function (textes) {
      textes = (textes || []).filter(Boolean);
      vider(zone);
      textes.forEach(function (t) { zone.appendChild(h('div', { text: t })); });
      zone.hidden = !textes.length;
    };
    return zone;
  }

  function ageA(naissanceISO, date) {
    if (!naissanceISO) return null;
    var n = new Date(naissanceISO + 'T00:00:00'), d = new Date(date);
    if (isNaN(n.getTime())) return null;
    return d.getFullYear() - n.getFullYear() - ((d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) ? 1 : 0);
  }

  function modaleNouvelleMesure() {
    var s = App.session, maintenant = Date.now();
    var svDefaut = App.service !== '*' ? App.service : (services()[0] || {}).code;
    var selSv = h('select', {}, services().map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: x.code === svDefaut }); }));
    var selPatient = h('select');
    var blocNouveau = h('div', { class: 'pile' });
    var ipp = h('input', { type: 'text', placeholder: 'IPP' }), nom = h('input', { type: 'text', placeholder: 'NOM' }), prenom = h('input', { type: 'text', placeholder: 'Prénom' });
    var naissance = h('input', { type: 'date', max: M.dateLocaleISO(maintenant), required: true });
    var protection = h('select', {}, ['Aucune', 'Tutelle', 'Curatelle', 'Sauvegarde de justice', 'Habilitation familiale'].map(function (x) { return h('option', { value: x === 'Aucune' ? '' : x, text: x }); }));
    var selMode = h('select', {}, (config().modesHospitalisation || []).map(function (x) { return h('option', { value: x.code, text: x.code + ' — ' + x.libelle }); }));
    var infoMode = h('small', { class: 'muted' });
    var type = h('select', {}, h('option', { value: 'Isolement', text: 'Isolement' }), h('option', { value: 'Contention', text: 'Contention' }));
    var debut = h('input', { type: 'datetime-local', value: versSaisie(maintenant) });
    var psy = selectPsychiatre();
    var selLieu = h('select');
    var chambre = h('input', { type: 'text', placeholder: 'N° de chambre', hidden: true });
    var exception = h('input', { type: 'checkbox' });
    var blocException = h('label', { class: 'case', hidden: true }, exception, h('span', { text: 'Contention hors espace d’isolement — exception prévue (catégorie E du registre)' }));
    var avecIso = h('input', { type: 'checkbox', checked: true });
    var blocIso = h('label', { class: 'case', hidden: true }, avecIso, h('span', { text: 'Créer aussi la mesure d’isolement qui accompagne cette contention (même début, même lieu)' }));

    // Alertes sous les champs
    var aPatient = alerteChamp(), aIpp = alerteChamp(), aNaissance = alerteChamp(), aMode = alerteChamp(), aType = alerteChamp(), aDebut = alerteChamp(), aLieu = alerteChamp();
    var labelNaissance = h('label', {}, 'Date de naissance (obligatoire)', naissance, aNaissance);

    blocNouveau.appendChild(h('div', { class: 'grille-2' }, h('label', {}, 'IPP', ipp, aIpp), h('label', {}, 'Protection juridique', protection)));
    blocNouveau.appendChild(h('div', { class: 'grille-2' }, h('label', {}, 'Nom', nom), h('label', {}, 'Prénom', prenom)));
    var zoneNaissance = h('div', { class: 'grille-2' }, labelNaissance, h('div'));

    function patientChoisi() { return selPatient.value === '__nouveau' ? null : patient(selPatient.value); }
    function naissanceRequise() { var p = patientChoisi(); return !p || !p.naissance; }

    function remplirPatients() {
      vider(selPatient);
      var pts = Object.keys(st().patients).map(function (k) { return st().patients[k]; })
        .filter(function (p) { return !p.service || p.service === selSv.value; })
        .sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || ''); });
      selPatient.appendChild(h('option', { value: '__nouveau', text: '+ Nouveau patient' }));
      pts.forEach(function (p) { selPatient.appendChild(h('option', { value: p.id, text: (p.nom || '') + ' ' + (p.prenom || '') + (p.ipp ? ' — IPP ' + p.ipp : '') })); });
      if (pts.length) selPatient.value = pts[0].id;
      majPatient();
    }
    function majPatient() {
      var p = patientChoisi();
      blocNouveau.hidden = !!p;
      zoneNaissance.hidden = !naissanceRequise();
      labelNaissance.firstChild.textContent = p ? 'Date de naissance (absente de la fiche, obligatoire)' : 'Date de naissance (obligatoire)';
      naissance.value = '';
      if (p) { var mode = modeActuel(p); if (mode) selMode.value = mode; infoMode.textContent = mode ? 'Mode actuel : ' + mode + '. Modifiez-le si le statut a changé.' : ''; }
      else infoMode.textContent = '';
      majLieu();
    }
    function majLieu() {
      var lieux = (config().lieuxCSI || {})[selSv.value] || [];
      var avant = selLieu.value;
      vider(selLieu);
      lieux.forEach(function (l) { selLieu.appendChild(h('option', { value: l, text: l })); });
      selLieu.appendChild(h('option', { value: '__hors', text: 'Hors CSI (chambre)' }));
      if (avant && Array.prototype.some.call(selLieu.options, function (o) { return o.value === avant; })) selLieu.value = avant;
      var hors = selLieu.value === '__hors';
      chambre.hidden = !hors;
      blocException.hidden = !(hors && type.value === 'Contention');
      var isoEnCours = selPatient.value !== '__nouveau' && M.listeMesures(st()).some(function (m) { return m.patientId === selPatient.value && m.type === 'Isolement' && typeof m.fin !== 'number'; });
      blocIso.hidden = !(type.value === 'Contention' && !hors && !isoEnCours);
      alertes();
    }

    /** Recalcule toutes les alertes à chaque modification. */
    function alertes() {
      var p = patientChoisi(), tDebut = new Date(debut.value).getTime();
      if (!isFinite(tDebut)) tDebut = Date.now();
      var dn = (p && p.naissance) || naissance.value || '';
      var age = ageA(dn, tDebut);
      var libre = !M.estContrainte(config(), selMode.value);

      // Date de naissance
      var an = [];
      if (naissanceRequise() && naissance.value) {
        if (naissance.value > M.dateLocaleISO(Date.now())) an.push('Date de naissance dans le futur.');
        else if (age !== null && age > 110) an.push('Date de naissance invraisemblable (' + age + ' ans) : vérifiez la saisie.');
      }
      if (age !== null && age >= 0 && age < 18) an.push('Patient mineur (' + age + ' ans) : vigilance renforcée ; informer les titulaires de l’autorité parentale.');
      aNaissance.afficher(naissanceRequise() ? an : []);

      // Patient existant
      var ap = [];
      if (p) {
        if (age !== null && age >= 0 && age < 18) ap.push('Patient mineur (' + age + ' ans) : vigilance renforcée ; informer les titulaires de l’autorité parentale.');
        var c = M.cumulsPatient(st(), p.id, tDebut);
        if (c.niveau === 'rouge') ap.push('Cumul élevé sur 15 jours : isolement ' + duree(c.iso15) + ', contention ' + duree(c.cont15) + '. Les échéances JLD seront avancées.');
        if (p.protection) ap.push('Mesure de protection juridique : ' + p.protection + '. Penser à informer le représentant légal.');
      }
      aPatient.afficher(ap);

      // IPP déjà utilisé (nouveau patient)
      var dup = !p && ipp.value.trim() && Object.keys(st().patients).map(function (k) { return st().patients[k]; }).filter(function (x) { return x.ipp === ipp.value.trim(); })[0];
      aIpp.afficher(dup ? ['IPP déjà attribué à ' + (dup.nom || '') + ' ' + (dup.prenom || '') + ' : sa fiche sera proposée à l’enregistrement.'] : []);

      // Mode d'hospitalisation
      var am = [];
      if (libre) am.push('Patient en soins libres : l’isolement et la contention sont réservés aux patients en soins sans consentement. Faire régulariser le mode d’hospitalisation sans délai.');
      if (selMode.value === 'SL mineur' && age !== null && age >= 18) am.push('Mode « SL mineur » alors que le patient est majeur (' + age + ' ans) : vérifiez le mode ou la date de naissance.');
      if (selMode.value !== 'SL mineur' && libre && age !== null && age < 18) am.push('Patient mineur en soins libres : utilisez le mode « SL mineur ».');
      aMode.afficher(am);

      // Type : mesure du même type déjà en cours
      var at = [];
      if (p) {
        M.listeMesures(st()).forEach(function (m) {
          if (m.patientId === p.id && typeof m.fin !== 'number' && (m.type === type.value || (!blocIso.hidden && avecIso.checked && m.type === 'Isolement')))
            at.push(m.type + ' déjà en cours pour ce patient depuis le ' + date(m.debut) + ' (' + (m.lieu || '') + ') : vérifiez qu’il ne s’agit pas d’un doublon.');
        });
      }
      aType.afficher(at);

      // Début
      var ad = [];
      if (tDebut > Date.now() + 10 * 60000) ad.push('Date de début dans le futur.');
      else if (Date.now() - tDebut > 24 * H) ad.push('Saisie tardive : début il y a ' + duree((Date.now() - tDebut) / H) + '. Les échéances JLD sont calculées depuis ce début et peuvent être proches ou dépassées.');
      aDebut.afficher(ad);

      // Lieu
      var al = [];
      if (selLieu.value === '__hors' && type.value === 'Contention' && !exception.checked) al.push('Contention hors espace d’isolement (catégorie D du registre) : à n’utiliser qu’à titre exceptionnel.');
      if (!((config().lieuxCSI || {})[selSv.value] || []).length) al.push('Aucune chambre de soins intensifs n’est paramétrée pour ce service.');
      aLieu.afficher(al);
    }

    selSv.addEventListener('change', remplirPatients);
    selPatient.addEventListener('change', majPatient);
    type.addEventListener('change', majLieu);
    selLieu.addEventListener('change', majLieu);
    [naissance, ipp, debut, chambre].forEach(function (x) { x.addEventListener('input', alertes); });
    [selMode, exception, avecIso].forEach(function (x) { x.addEventListener('change', alertes); });
    remplirPatients();

    var corps = h('div', { class: 'pile' },
      h('div', { class: 'grille-2' }, h('label', {}, 'Service', selSv), h('label', {}, 'Patient', selPatient, aPatient)),
      blocNouveau, zoneNaissance,
      h('label', {}, "Mode d'hospitalisation", selMode, infoMode, aMode),
      h('div', { class: 'grille-2' }, h('label', {}, 'Type de mesure', type, aType), h('label', {}, 'Date et heure de la décision de début', debut, aDebut)),
      h('label', {}, 'Psychiatre décisionnaire', psy),
      h('label', {}, 'Lieu', selLieu, chambre, aLieu), blocException, blocIso,
      h('p', { class: 'muted' }, h('small', { text: 'Vous reportez la décision médicale prise par le psychiatre ; la prescription reste dans le DPI.' })));

    modale('Nouvelle mesure — report de la décision médicale', corps, [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var tDebut = depuisSaisie(debut.value);
        if (tDebut > Date.now() + 10 * 60000) throw new Error('La date de début ne peut pas être dans le futur.');
        if (naissanceRequise()) {
          if (!naissance.value) { naissance.focus(); throw new Error('Indiquez la date de naissance du patient.'); }
          if (naissance.value > M.dateLocaleISO(Date.now())) throw new Error('La date de naissance ne peut pas être dans le futur.');
          if (ageA(naissance.value, Date.now()) > 120) throw new Error('Date de naissance invraisemblable : vérifiez la saisie.');
        }
        var psyNom = psy.valeur();
        var hors = selLieu.value === '__hors';
        if (hors && !chambre.value.trim()) throw new Error('Indiquez la chambre.');
        if (!hors && !selLieu.value) throw new Error('Aucune CSI n’est paramétrée pour ce service.');
        var patientId = selPatient.value;
        var existant = patientId === '__nouveau' && ipp.value.trim() && Object.keys(st().patients).map(function (k) { return st().patients[k]; }).filter(function (p) { return p.ipp === ipp.value.trim(); })[0];
        if (existant) {
          if (!confirm('Un patient porte déjà l’IPP ' + existant.ipp + ' : ' + (existant.nom || '') + ' ' + (existant.prenom || '') + '. Utiliser sa fiche ?')) return false;
          patientId = existant.id;
          var maj = { patientId: patientId };
          if (existant.service !== selSv.value) maj.service = selSv.value;
          if (!existant.naissance && naissance.value) maj.naissance = naissance.value;
          if (Object.keys(maj).length > 1) await s.enregistrer('PATIENT', maj);
          if (modeActuel(existant) !== selMode.value) await s.enregistrer('MODE_HOSPI', { patientId: patientId, mode: selMode.value, date: tDebut });
        } else if (patientId === '__nouveau') {
          if (!nom.value.trim()) throw new Error('Indiquez le nom du patient.');
          patientId = 'P' + C.hex(C.aleatoire(5));
          await s.enregistrer('PATIENT', { patientId: patientId, ipp: ipp.value.trim(), nom: nom.value.trim().toUpperCase(), prenom: prenom.value.trim(), naissance: naissance.value, protection: protection.value, service: selSv.value });
          await s.enregistrer('MODE_HOSPI', { patientId: patientId, mode: selMode.value, date: tDebut });
        } else {
          if (naissanceRequise()) await s.enregistrer('PATIENT', { patientId: patientId, naissance: naissance.value });
          if (modeActuel(patient(patientId)) !== selMode.value) await s.enregistrer('MODE_HOSPI', { patientId: patientId, mode: selMode.value, date: tDebut });
        }
        var commun = { patientId: patientId, service: selSv.value, debut: tDebut, lieu: hors ? 'Chambre ' + chambre.value.trim() : selLieu.value, csi: !hors, psychiatre: psyNom, modeHospi: selMode.value };
        if (!blocIso.hidden && avecIso.checked) await s.enregistrer('MESURE_DEBUT', Object.assign({ mesureId: idMesure(), typeMesure: 'Isolement' }, commun));
        await s.enregistrer('MESURE_DEBUT', Object.assign({ mesureId: idMesure(), typeMesure: type.value, exception: hors && type.value === 'Contention' && exception.checked }, commun));
        toast('Mesure enregistrée.');
      } }
    ]);
  }

  // ---------------------------------------------------------------- Fin
  function modaleFin(m) {
    var base = m.version;
    var pause = M.pauseEnCours(m, Date.now(), config());
    var fin = h('input', { type: 'datetime-local', value: versSaisie(pause ? pause.debut : Date.now()) });
    var psy = selectPsychiatre(m.psychiatreDebut);
    var lies = M.listeMesures(st()).filter(function (x) { return x.patientId === m.patientId && x.id !== m.id && typeof x.fin !== 'number'; });
    modale('Fin de mesure — report de la décision médicale', h('div', { class: 'pile' }, recapMesure(m),
      pause ? h('div', { class: 'info', text: 'Mesure en pause depuis le ' + date(pause.debut) + '. Si elle n’a pas repris (le psychiatre décide de ne pas la reprendre), la fin correspond en principe au début de la pause : la date est préremplie ainsi. Modifiez-la si la décision est autre.' }) : null,
      h('label', {}, 'Date et heure de la décision de fin', fin), h('label', {}, 'Psychiatre décisionnaire', psy),
      lies.length ? h('div', { class: 'info', text: 'Autre mesure en cours pour ce patient : ' + lies.map(function (x) { return x.type + ' depuis ' + court(x.debut); }).join(', ') + '. Elle reste en cours.' }) : null,
      m.leveeJLD ? h('div', { class: 'info', text: 'Le JLD a ordonné la levée : à compter de cette fin, le cumul des 15 jours repartira de zéro pour ce patient et ce type de mesure.' }) : null), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer la fin', classe: 'primaire', action: async function () {
        var t = depuisSaisie(fin.value);
        if (t < m.debut) throw new Error('La fin ne peut pas précéder le début (' + date(m.debut) + ').');
        if (t > Date.now() + 10 * 60000) throw new Error('La date de fin ne peut pas être dans le futur.');
        await App.session.enregistrer('MESURE_FIN', { mesureId: m.id, fin: t, psychiatre: psy.valeur() }, base);
        toast('Fin de mesure enregistrée.');
      } }]);
  }

  // ---------------------------------------------------------------- Pause (levée temporaire)
  function contentionsLiees(m, maintenant, enPause) {
    if (m.type !== 'Isolement') return [];
    return M.listeMesures(st()).filter(function (c) {
      return c.type === 'Contention' && c.patientId === m.patientId && typeof c.fin !== 'number' && !!M.pauseEnCours(c, maintenant, config()) === enPause;
    });
  }

  function modalePause(m) {
    var maintenant = Date.now(), op = M.optionsPauses(config());
    var debut = h('input', { type: 'datetime-local', value: versSaisie(maintenant) });
    var mode = h('select', {}, h('option', { value: 'duree', text: 'Pour une durée' }), h('option', { value: 'heure', text: 'Jusqu’à une heure de reprise' }));
    var dH = h('input', { type: 'number', min: 0, max: 47, step: 1, value: 1, 'aria-label': 'Heures' });
    var dM = h('select', { 'aria-label': 'Minutes' }, [0, 15, 30, 45].map(function (x) { return h('option', { value: x, text: String(x).padStart(2, '0') + ' min' }); }));
    var raccourcis = h('div', { class: 'raccourcis' }, [[0, 30, '30 min'], [1, 0, '1 h'], [2, 0, '2 h'], [4, 0, '4 h']].map(function (r) {
      return h('button', { type: 'button', class: 'btn petit', onclick: function () { dH.value = r[0]; dM.value = r[1]; maj(); } }, r[2]);
    }));
    var blocDuree = h('label', {}, 'Durée de la pause', h('div', { class: 'en-ligne' }, dH, h('span', { text: 'h' }), dM), raccourcis);
    var reprise = h('input', { type: 'datetime-local', value: versSaisie(maintenant + H) });
    var blocHeure = h('label', { hidden: true }, 'Date et heure de reprise prévue', reprise);
    var resume = h('div', { class: 'info' });
    var psy = selectPsychiatre(m.psychiatreDebut);
    var motif = h('select', {}, MOTIFS_PAUSE.map(function (x) { return h('option', { value: x, text: x }); }));
    var precision = h('input', { type: 'text', placeholder: 'Précision (facultatif)' });
    var conts = contentionsLiees(m, maintenant, false);
    var avecCont = h('input', { type: 'checkbox', checked: true });
    var blocCont = conts.length ? h('label', { class: 'case' }, avecCont, h('span', { text: 'Mettre aussi en pause la contention en cours (même début, même reprise prévue)' })) : null;
    var aDebut = alerteChamp(), aReprise = alerteChamp(), aCont = alerteChamp();

    function bornes() {
      var t0 = depuisSaisie(debut.value), t1;
      if (mode.value === 'duree') {
        var minutes = (+dH.value || 0) * 60 + (+dM.value || 0);
        t1 = t0 + minutes * 60000;
      } else t1 = depuisSaisie(reprise.value);
      return { t0: t0, t1: t1, heures: (t1 - t0) / H };
    }
    function maj() {
      blocDuree.hidden = mode.value !== 'duree'; blocHeure.hidden = mode.value !== 'heure';
      var b; try { b = bornes(); } catch (e) { aDebut.afficher(['Date invalide.']); resume.textContent = ''; return; }
      aDebut.afficher([
        b.t0 < m.debut ? 'La pause ne peut pas commencer avant le début de la mesure (' + date(m.debut) + ').' : null,
        b.t0 > Date.now() + 10 * 60000 ? 'Le début de la pause ne peut pas être dans le futur : saisissez-la au moment où elle commence.' : null
      ]);
      aReprise.afficher([
        b.t1 <= b.t0 ? 'La reprise doit être postérieure au début de la pause.' : null,
        b.heures >= op.refusHeures ? 'À partir de ' + op.refusHeures + ' h, la pause n’est pas acceptée : saisissez la fin de la mesure.' : null,
        op.alerteHeures && b.heures > op.alerteHeures && b.heures < op.refusHeures ? 'Pause de plus de ' + op.alerteHeures + ' h : vérifiez auprès du psychiatre qu’il ne s’agit pas d’une fin de mesure.' : null
      ]);
      aCont.afficher([conts.length && !avecCont.checked ? 'Une contention ne peut pas se poursuivre hors isolement : mettez-la aussi en pause ou saisissez sa fin.' : null]);
      resume.textContent = b.t1 > b.t0 ? 'Reprise prévue le ' + date(b.t1) + ' (pause de ' + duree(b.heures) + ').' : '';
    }
    [debut, dH, dM, reprise, mode, avecCont].forEach(function (x) { x.addEventListener('input', maj); x.addEventListener('change', maj); });
    maj();

    modale('Pause — levée temporaire de la mesure', h('div', { class: 'pile' }, recapMesure(m, maintenant),
      h('p', { class: 'muted' }, h('small', { text: 'Report de la décision du psychiatre (repas, hygiène, visite…). La pause ne met pas fin à la mesure. ' +
        (op.retrancher ? 'Selon le paramétrage de l’établissement, sa durée est retranchée des décomptes et les échéances JLD sont reportées d’autant (jusqu’à l’heure de reprise prévue au plus). ' : 'Sa durée et les échéances JLD continuent de courir. ') +
        (op.repriseAuto ? 'La mesure reprendra automatiquement à l’heure prévue ; saisissez une reprise seulement si elle a lieu plus tôt. ' : 'Saisissez la reprise au retour du patient. ') +
        'Si le patient ne réintègre pas la mesure, saisissez la fin de mesure.' })),
      h('div', { class: 'grille-2' }, h('label', {}, 'Début de la pause', debut, aDebut), h('label', {}, 'Reprise', mode)),
      blocDuree, blocHeure, aReprise, resume,
      h('div', { class: 'grille-2' }, h('label', {}, 'Motif', motif), h('label', {}, 'Précision', precision)),
      h('label', {}, 'Psychiatre décisionnaire', psy),
      blocCont, aCont), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer la pause', classe: 'primaire', action: async function () {
        var b = bornes();
        if (b.t0 < m.debut) throw new Error('La pause ne peut pas commencer avant le début de la mesure.');
        if (b.t0 > Date.now() + 10 * 60000) throw new Error('Le début de la pause ne peut pas être dans le futur.');
        if (b.t1 <= b.t0) throw new Error('Indiquez une durée ou une heure de reprise postérieure au début de la pause.');
        if (b.heures >= op.refusHeures) throw new Error('Une pause de ' + op.refusHeures + ' h ou plus n’est pas acceptée : saisissez la fin de la mesure.');
        var nomPsy = psy.valeur();
        var texteMotif = motif.value + (precision.value.trim() ? ' — ' + precision.value.trim() : '');
        var cibles = [m].concat(blocCont && avecCont.checked ? conts : []);
        for (var i = 0; i < cibles.length; i++) {
          await App.session.enregistrer('PAUSE', { mesureId: cibles[i].id, debut: Math.max(b.t0, cibles[i].debut), reprisePrevue: b.t1, psychiatre: nomPsy, motif: texteMotif }, cibles[i].version);
        }
        toast(cibles.length > 1 ? 'Pause enregistrée (isolement et contention).' : 'Pause enregistrée.');
      } }]);
  }

  function modaleReprise(m) {
    var maintenant = Date.now();
    var p = M.pauseEnCours(m, maintenant, config());
    if (!p) return;
    var quand = h('input', { type: 'datetime-local', value: versSaisie(Math.min(maintenant, Math.max(p.reprisePrevue, p.debut))) });
    var conts = contentionsLiees(m, maintenant, true);
    var avecCont = h('input', { type: 'checkbox', checked: true });
    var aQuand = alerteChamp();
    function maj() {
      var t; try { t = depuisSaisie(quand.value); } catch (e) { aQuand.afficher(['Date invalide.']); return; }
      aQuand.afficher([
        t < p.debut ? 'La reprise ne peut pas précéder le début de la pause (' + date(p.debut) + ').' : null,
        t > Date.now() + 10 * 60000 ? 'La reprise ne peut pas être dans le futur.' : null,
        t > p.reprisePrevue + 15 * 60000 ? 'Reprise après l’heure prévue (' + date(p.reprisePrevue) + ') : vérifiez que la décision du psychiatre couvre ce délai.' : null
      ]);
    }
    quand.addEventListener('input', maj); quand.addEventListener('change', maj); maj();
    modale('Reprise de la mesure', h('div', { class: 'pile' }, recapMesure(m, maintenant),
      h('div', { class: 'recap' }, h('div', { text: 'En pause depuis le ' + date(p.debut) + (p.motif ? ' — ' + p.motif : '') + ' (' + (p.psychiatre || '?') + ')' }), h('div', { text: 'Reprise prévue le ' + date(p.reprisePrevue) })),
      h('label', {}, 'Date et heure de la reprise effective', quand, aQuand),
      conts.length ? h('label', { class: 'case' }, avecCont, h('span', { text: 'Reprendre aussi la contention en pause' })) : null,
      h('p', { class: 'muted' }, h('small', { text: 'Si le psychiatre décide de ne pas reprendre la mesure, fermez cette fenêtre et utilisez « Fin ».' }))), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer la reprise', classe: 'primaire', action: async function () {
        var t = depuisSaisie(quand.value);
        if (t < p.debut) throw new Error('La reprise ne peut pas précéder le début de la pause.');
        if (t > Date.now() + 10 * 60000) throw new Error('La reprise ne peut pas être dans le futur.');
        await App.session.enregistrer('REPRISE', { mesureId: m.id, pause: p.evt, date: t }, m.version);
        if (conts.length && avecCont.checked) for (var i = 0; i < conts.length; i++) {
          var pc = M.pauseEnCours(conts[i], Date.now(), config());
          if (pc) await App.session.enregistrer('REPRISE', { mesureId: conts[i].id, pause: pc.evt, date: Math.max(t, pc.debut) }, conts[i].version);
        }
        toast('Reprise enregistrée.');
      } }]);
  }

  // ---------------------------------------------------------------- Tiers
  function modaleTiers(m) {
    var base = m.version;
    var statut = h('select', {}, Object.keys(LIB_TIERS).map(function (k) { return h('option', { value: k, text: LIB_TIERS[k] }); }));
    var personne = h('input', { type: 'text', placeholder: 'ex. Mère, personne de confiance, curateur' });
    var motif = h('input', { type: 'text', placeholder: 'Précision (facultatif)' });
    var informateur = h('select', {}, h('option', { value: 'PSYCHIATRE', text: 'Le psychiatre' }), h('option', { value: 'IDE', text: 'L’IDE (en dernier recours)' }));
    var psy = selectPsychiatre(m.psychiatreDebut);
    var blocPsy = h('label', {}, 'Psychiatre ayant informé', psy);
    informateur.addEventListener('change', function () { blocPsy.hidden = informateur.value !== 'PSYCHIATRE'; });
    var quand = h('input', { type: 'datetime-local', value: versSaisie(Date.now()) });
    var historique = m.tiers.length ? h('div', { class: 'recap' }, h('b', { text: 'Déjà saisi' }), m.tiers.map(function (t) {
      return h('div', { text: 'Cycle ' + t.cycle + ' — ' + (LIB_TIERS[t.statut] || t.statut) + (t.personne ? ' (' + t.personne + ')' : '') + ' le ' + date(t.date) + ', par ' + (t.informateur === 'IDE' ? 'l’IDE' : (t.nomInformateur || 'le psychiatre')) });
    })) : null;
    modale('Information du tiers — cycle ' + m.cycle, h('div', { class: 'pile' }, recapMesure(m), historique,
      h('p', { class: 'muted' }, h('small', { text: 'L’information est faite par le psychiatre, en dernier recours par l’IDE. Elle doit être renouvelée à chaque cycle, en même temps que l’information ou la saisine du juge.' })),
      h('div', { class: 'grille-2' }, h('label', {}, 'Résultat', statut), h('label', {}, 'Tiers (qualité)', personne)),
      h('div', { class: 'grille-2' }, h('label', {}, 'Information faite par', informateur), h('label', {}, 'Date et heure', quand)),
      blocPsy, h('label', {}, 'Précision', motif)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var parPsy = informateur.value === 'PSYCHIATRE';
        await App.session.enregistrer('TIERS', { mesureId: m.id, cycle: m.cycle, statut: statut.value, personne: personne.value.trim(), informateur: informateur.value, nomInformateur: parPsy ? psy.valeur() : '', date: depuisSaisie(quand.value), motif: motif.value.trim() }, base);
        toast('Information du tiers enregistrée.');
      } }]);
  }

  // ---------------------------------------------------------------- JLD
  function modaleJLD(m) {
    var base = m.version, maintenant = Date.now();
    var j = M.suiviJLD(st(), m, maintenant);
    var p = prochaineEcheance(j);
    var nature = h('select', {}, Object.keys(LIB_NATURE).map(function (k) { return h('option', { value: k, text: LIB_NATURE[k], selected: p && p.nature === k }); }));
    var quand = h('input', { type: 'datetime-local', value: versSaisie(maintenant) });
    var decision = h('select', {}, h('option', { value: 'MAINTIEN', text: 'Maintien de la mesure' }), h('option', { value: 'LEVEE', text: 'Levée de la mesure' }));
    var blocDecision = h('label', {}, 'Décision du juge', decision);
    var infoLevee = h('div', { class: 'info', hidden: true, text: 'La levée est un indicateur légal : la mesure reste en cours jusqu’au report de la décision médicale de fin.' });
    function maj() { blocDecision.hidden = nature.value !== 'DECISION'; infoLevee.hidden = blocDecision.hidden || decision.value !== 'LEVEE'; }
    nature.addEventListener('change', maj); decision.addEventListener('change', maj); maj();
    var tiers = M.tiersCycle(m);
    modale('Envoi JLD — cycle ' + j.cycle, h('div', { class: 'pile' }, recapMesure(m, maintenant),
      h('div', { class: 'recap' },
        h('div', {}, 'Information avant : ', cellEcheance(j.info)),
        h('div', {}, 'Saisine avant : ', cellEcheance(j.saisine)),
        h('div', {}, 'Décision avant : ', cellEcheance(j.decision))),
      tiers ? null : h('div', { class: 'alerte', text: 'Rappel : le tiers n’a pas encore été renseigné pour ce cycle. L’envoi peut néanmoins se poursuivre.' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Nature', nature), h('label', {}, 'Date et heure', quand)),
      blocDecision, infoLevee), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var n = nature.value, t = depuisSaisie(quand.value);
        if (m.jld[j.cycle] && m.jld[j.cycle][n] && !confirm(LIB_NATURE[n] + ' déjà saisie pour ce cycle (' + date(m.jld[j.cycle][n].date) + '). Enregistrer une nouvelle saisie ?')) return false;
        await App.session.enregistrer('JLD', { mesureId: m.id, cycle: j.cycle, nature: n, date: t, decision: n === 'DECISION' ? decision.value : null }, base);
        var ech = n === 'INFO' ? j.info.echeance : n === 'SAISINE' ? j.saisine.echeance : j.decision.echeance;
        if (n === 'DECISION' && decision.value === 'MAINTIEN') toast('Maintien enregistré : cycle ' + (j.cycle + 1) + ' ouvert. Le tiers doit être informé de ce renouvellement.');
        else toast(t > ech ? 'Enregistré — hors délai (échéance ' + date(ech) + ').' : 'Enregistré.');
      } }]);
  }

  // ---------------------------------------------------------------- Détail
  function modaleDetail(m) {
    var maintenant = Date.now(), j = M.suiviJLD(st(), m, maintenant);
    var evts = Object.keys(st().parId).map(function (k) { return st().parId[k]; }).filter(function (e) { return e.data && e.data.mesureId === m.id; })
      .sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : (a.id < b.id ? -1 : 1); });
    var peutCorriger = App.session.peut('CORRECTION');
    var corps = h('div', { class: 'pile' }, recapMesure(m, maintenant),
      h('div', { class: 'recap' },
        h('div', { text: 'Cycle JLD en cours : ' + j.cycle + (j.rythmeLong ? ' (rythme des mesures longues)' : '') + ' · cumul des 15 jours avant la mesure : ' + duree(j.cumulAvant) }),
        h('div', { text: 'Mode d’hospitalisation retenu : ' + (M.modeRetenu(st(), m).mode || '—') }),
        m.fin ? h('div', { text: 'Fin : ' + date(m.fin) + ' (' + (m.psychiatreFin || '?') + ')' }) : null),
      (m.pauses || []).length ? h('div', { class: 'recap' },
        h('b', { text: 'Levées temporaires (' + m.pauses.length + ', total ' + duree(M.dureePausesHeures(m, maintenant, config())) + (M.optionsPauses(config()).retrancher ? ', retranchées de la durée et des échéances' : ', comptées dans la durée de la mesure') + ')' }),
        m.pauses.map(function (p) {
          var effective = p.reprise != null ? 'reprise le ' + date(p.reprise)
            : M.repriseAutomatique(m, p, maintenant, config()) ? 'reprise automatique le ' + date(p.reprisePrevue)
            : (typeof m.fin === 'number' ? 'fin de mesure pendant la pause' : (maintenant > p.reprisePrevue ? 'reprise non confirmée' : 'en cours'));
          return h('div', { text: date(p.debut) + ' → reprise prévue ' + date(p.reprisePrevue) + ' — ' + effective + (p.motif ? ' — ' + p.motif : '') + ' (' + (p.psychiatre || '?') + ')' });
        })) : null,
      h('h3', { text: 'Historique' }),
      h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, evts.map(function (e) {
        var annule = st().annules[e.id];
        return h('tr', { class: annule ? 'ancienne' : '' },
          h('td', { class: 'nowrap', text: date(Date.parse(e.at)) }),
          h('td', { text: App.session.nomAuteur(e.by) }),
          h('td', {}, resumeEvt(e), annule ? h('span', { class: 'badge', text: ' annulée' }) : null),
          h('td', { class: 'actions-ligne' }, App.session.peut('ANNULATION') && !annule ? h('button', { class: 'btn petit', onclick: async function () {
            var motif = prompt(e.type === 'MESURE_DEBUT' ? 'Annuler le début annule toute la mesure (doublon, mauvais patient…). Motif :' : 'Motif de l’annulation de cette saisie :');
            if (!motif) return;
            await App.session.enregistrer('ANNULATION', { cible: e.id, motif: motif });
            toast('Saisie annulée.');
            var dlg = document.querySelector('dialog'); if (dlg) dlg.dispatchEvent(new Event('cancel'));
          } }, 'Annuler') : null));
      })))));
    var boutons = [{ texte: 'Fermer' }];
    if (typeof m.fin !== 'number' && App.session.peut('MESURE_FIN') && App.session.peut('MESURE_DEBUT')) boutons.unshift({ texte: 'Changer de lieu…', action: function () { setTimeout(function () { modaleLieu(m); }, 0); return true; } });
    if (peutCorriger) boutons.unshift({ texte: 'Corriger…', action: function () { setTimeout(function () { modaleCorrection(m); }, 0); return true; } });
    modale('Détail de la mesure', corps, boutons);
  }

  /** Changement réel de lieu : la mesure en cours prend fin et une mesure du même type commence au nouveau lieu (comme en V1.3). */
  function modaleLieu(m) {
    var base = m.version;
    var quand = h('input', { type: 'datetime-local', value: versSaisie(Date.now()) });
    var lieux = (config().lieuxCSI || {})[m.service] || [];
    var selLieu = h('select', {}, lieux.filter(function (l) { return l !== m.lieu; }).map(function (l) { return h('option', { value: l, text: l }); }), h('option', { value: '__hors', text: 'Hors CSI (chambre)' }));
    var chambre = h('input', { type: 'text', placeholder: 'N° de chambre', hidden: selLieu.value !== '__hors' });
    selLieu.addEventListener('change', function () { chambre.hidden = selLieu.value !== '__hors'; });
    var psy = selectPsychiatre(m.psychiatreDebut);
    modale('Changement de lieu', h('div', { class: 'pile' }, recapMesure(m),
      h('div', { class: 'info', text: 'Pour une erreur de saisie, utilisez « Corriger » (cadre de santé). Un changement réel de lieu termine la mesure en cours et en ouvre une nouvelle du même type au nouveau lieu, à la même heure. Les échéances JLD de la nouvelle mesure tiennent compte du cumul des 15 derniers jours.' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Date et heure du changement', quand), h('label', {}, 'Nouveau lieu', selLieu, chambre)),
      h('label', {}, 'Psychiatre décisionnaire', psy)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer le changement', classe: 'primaire', action: async function () {
        var t = depuisSaisie(quand.value), hors = selLieu.value === '__hors';
        if (t <= m.debut) throw new Error('Le changement doit être postérieur au début de la mesure.');
        if (t > Date.now() + 10 * 60000) throw new Error('La date ne peut pas être dans le futur.');
        if (hors && !chambre.value.trim()) throw new Error('Indiquez la chambre.');
        var nomPsy = psy.valeur();
        await App.session.enregistrer('MESURE_FIN', { mesureId: m.id, fin: t, psychiatre: nomPsy, motif: 'Changement de lieu' }, base);
        await App.session.enregistrer('MESURE_DEBUT', { mesureId: idMesure(), patientId: m.patientId, service: m.service, typeMesure: m.type, debut: t, lieu: hors ? 'Chambre ' + chambre.value.trim() : selLieu.value, csi: !hors, psychiatre: nomPsy, exception: false, modeHospi: m.modeHospi, suiteDe: m.id });
        toast('Changement de lieu enregistré.');
      } }]);
  }

  function modaleCorrection(m) {
    var base = m.version;
    var debut = h('input', { type: 'datetime-local', value: versSaisie(m.debut) });
    var fin = h('input', { type: 'datetime-local', value: m.fin ? versSaisie(m.fin) : '' });
    var lieu = h('input', { type: 'text', value: m.lieu });
    var motif = h('input', { type: 'text', placeholder: 'Motif obligatoire' });
    modale('Correction (cadre de santé)', h('div', { class: 'pile' }, recapMesure(m),
      h('p', { class: 'muted', text: 'La saisie d’origine est conservée ; la correction est tracée avec son motif.' }),
      h('div', { class: 'grille-2' }, h('label', {}, 'Début', debut), h('label', {}, 'Fin', fin)),
      h('label', {}, 'Lieu', lieu), h('label', {}, 'Motif', motif)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer la correction', classe: 'primaire', action: async function () {
        if (!motif.value.trim()) throw new Error('Le motif est obligatoire.');
        var ch = {};
        var d = depuisSaisie(debut.value); if (d !== m.debut) ch.debut = d;
        if (fin.value) { var f = depuisSaisie(fin.value); if (f !== m.fin) ch.fin = f; if (f < d) throw new Error('La fin précède le début.'); }
        if (lieu.value.trim() !== m.lieu) ch.lieu = lieu.value.trim();
        if (!Object.keys(ch).length) throw new Error('Aucune modification.');
        await App.session.enregistrer('CORRECTION', { mesureId: m.id, champs: ch, motif: motif.value.trim() }, base);
        toast('Correction enregistrée.');
      } }]);
  }

  // ---------------------------------------------------------------- Professionnel
  function modaleProfessionnel(service, dateISO, periode) {
    var selSv = h('select', {}, services().map(function (x) { return h('option', { value: x.code, text: x.libelle, selected: x.code === service }); }));
    var jour = h('input', { type: 'date', value: dateISO || M.dateLocaleISO(Date.now()) });
    var selP = h('select', {}, (config().periodes || []).map(function (p) { return h('option', { value: p.code, text: p.libelle + ' (' + p.debut + '–' + p.fin + ')', selected: p.code === periode }); }));
    var nom = h('input', { type: 'text', placeholder: 'Prénom NOM' });
    var fonction = h('select', {}, ['IDE', 'AS', 'ASH', 'Psychiatre', 'Médecin', 'Cadre de santé', 'Autre'].map(function (x) { return h('option', { value: x, text: x }); }));
    var ajoutes = h('div', { class: 'recap', hidden: true });
    async function enregistrer() {
      if (!nom.value.trim()) throw new Error('Indiquez le nom du professionnel.');
      if (!jour.value) throw new Error('Indiquez la date.');
      await App.session.enregistrer('PROFESSIONNEL', { service: selSv.value, date: jour.value, periode: selP.value, nom: nom.value.trim(), fonction: fonction.value });
    }
    modale('Professionnel chargé de la surveillance', h('div', { class: 'pile' },
      h('div', { class: 'grille-2' }, h('label', {}, 'Service', selSv), h('label', {}, 'Date', jour)),
      h('label', {}, 'Période', selP),
      h('div', { class: 'grille-2' }, h('label', {}, 'Nom', nom), h('label', {}, 'Fonction', fonction)), ajoutes), [
      { texte: 'Fermer' },
      { texte: 'Enregistrer et ajouter un autre', action: async function () {
        await enregistrer();
        ajoutes.hidden = false; ajoutes.appendChild(h('div', { text: '✓ ' + nom.value.trim() + ' (' + fonction.value + ')' }));
        nom.value = ''; nom.focus();
        return false;
      } },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () { await enregistrer(); toast('Professionnel enregistré.'); } }
    ], { focus: nom });
  }

  // ---------------------------------------------------------------- Mot de passe
  function modaleMonMotDePasse() {
    var a = h('input', { type: 'password', autocomplete: 'new-password' }), b = h('input', { type: 'password', autocomplete: 'new-password' });
    modale('Changer mon mot de passe', h('div', { class: 'pile' }, h('label', {}, 'Nouveau mot de passe (12 caractères minimum)', a), h('label', {}, 'Confirmation', b)), [
      { texte: 'Annuler' },
      { texte: 'Changer', classe: 'primaire', action: async function () {
        verifierNouveauMotDePasse(a.value, b.value);
        await App.session.changerMonMotDePasse(a.value);
        toast('Mot de passe modifié.');
      } }], { focus: a });
  }

  // ================================================================ Administration
  function lignesDe(t) { return t.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }
  function zoneTexte(valeur, lignes) { return h('textarea', { rows: lignes || 4, class: 'mono', spellcheck: 'false' }, valeur); }
  async function enregistrerConfig(changements) {
    var cfg = config(), n = 0;
    for (var i = 0; i < changements.length; i++) {
      if (JSON.stringify(cfg[changements[i][0]]) !== JSON.stringify(changements[i][1])) { await App.session.enregistrer('CONFIG', { cle: changements[i][0], valeur: changements[i][1] }); n++; }
    }
    toast(n ? 'Paramétrage enregistré (' + n + ' modification' + (n > 1 ? 's' : '') + ').' : 'Aucune modification.');
  }
  function boutonEnregistrer(fn) {
    return h('div', { class: 'actions' }, h('button', { class: 'btn primaire', onclick: async function (ev) {
      var b = ev.currentTarget; b.disabled = true;
      try { await fn(); } catch (err) { alert(err.message); } finally { b.disabled = false; }
    } }, 'Enregistrer'));
  }
  function periodeDepuis(x, l) {
    if (x.length !== 4 || !/^\d\d:\d\d$/.test(x[2]) || !/^\d\d:\d\d$/.test(x[3])) throw new Error('Période mal formée : ' + l);
    return { code: x[0], libelle: x[1], debut: x[2], fin: x[3] };
  }

  function vueAdmin() {
    var s = App.session, cfg = config();
    var comptes = h('section', { class: 'panneau' }, h('h2', { text: 'Comptes' }),
      h('p', { class: 'muted', text: 'Un compte peut cumuler plusieurs rôles. Les services affectés limitent ce que l’agent voit, à la connexion comme à la création d’une mesure ; un administrateur voit tous les services.' }),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Nom', 'Identifiant', 'Rôles', 'Services', 'État', ''].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, s.comptes.map(function (c) {
          var admin = c.roles.indexOf('ADMIN') >= 0;
          return h('tr', { class: c.actif ? '' : 'ancienne' },
            h('td', { text: c.nom }), h('td', { class: 'mono', text: c.login }),
            h('td', { text: c.roles.map(function (r) { return M.ROLES[r]; }).join(', ') }),
            h('td', {}, admin ? h('small', { text: 'Tous (administrateur)' }) : ((c.services || []).length ? (c.services || []).map(libService).join(', ') : h('span', { class: 'badge warn', text: 'aucun' }))),
            h('td', {}, h('span', { class: 'badge ' + (c.actif ? 'ok' : ''), text: c.actif ? 'actif' : 'désactivé' }), c.actif && c.mdpProvisoire ? h('div', {}, h('span', { class: 'badge warn', title: 'Le mot de passe sera changé à la prochaine connexion', text: 'mot de passe provisoire' })) : null,
              c.formation === false ? h('div', {}, h('span', { class: 'badge', text: 'sans mode formation' })) : null),
            h('td', { class: 'actions-ligne' },
              h('button', { class: 'btn petit', onclick: function () { modaleCompte(c); } }, 'Modifier'), ' ',
              h('button', { class: 'btn petit', onclick: function () { modaleReinit(c); } }, c.actif ? 'Réinitialiser le mot de passe' : 'Réactiver avec un mot de passe')));
        })))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: function () { if (SIC.ui.actions.comptesEnLot) SIC.ui.actions.comptesEnLot(); } }, 'Créer des comptes en lot…'),
        h('button', { class: 'btn primaire', onclick: function () { modaleCompte(null); } }, '+ Nouveau compte')));

    var embs = s.coffre.emballages;
    var webauthn = C.webauthnDisponible();
    var deblocage = h('section', { class: 'panneau' }, h('h2', { text: 'Moyens de déblocage de la clé de données' }),
      h('p', { class: 'muted', text: 'Gardez au moins deux clés de sécurité d’administration (dont une au coffre) et le code de secours papier. Une clé est liée à l’adresse du site : à enregistrer dans chaque mode de déploiement utilisé.' }),
      h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, embs.map(function (e) {
        var lib = e.methode === 'mdp' ? 'Mot de passe — ' + e.login : e.methode === 'cle' ? (e.libelle || 'Clé de sécurité') + ' — ' + s.nomAuteur(e.userId) + ' — ' + e.rpId : 'Code de secours papier';
        return h('tr', {}, h('td', {}, h('span', { class: 'badge', text: e.methode === 'mdp' ? 'mot de passe' : e.methode === 'cle' ? 'clé de sécurité' : 'secours' })), h('td', { text: lib }),
          h('td', { class: 'actions-ligne' }, e.methode === 'cle' ? h('button', { class: 'btn petit danger', onclick: async function () {
            if (!confirm('Retirer cette clé de sécurité ?')) return;
            try { await s.retirerEmballage(e.id); toast('Clé retirée.'); } catch (err) { alert(err.message); }
          } }, 'Retirer') : null));
      })))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: !webauthn, title: webauthn ? '' : 'Disponible uniquement en HTTPS', onclick: async function () {
          var lib = prompt('Nom de cette clé (ex. « YubiKey cadre », « YubiKey coffre ») :', 'YubiKey');
          if (lib === null) return;
          try { await s.ajouterCleSecurite(lib); toast('Clé de sécurité enregistrée.'); } catch (err) { alert(err.message); }
        } }, 'Enregistrer une clé de sécurité'),
        h('button', { class: 'btn', onclick: async function () {
          if (!confirm('Générer un nouveau code de secours ? L’ancien ne fonctionnera plus.')) return;
          try { var code = await s.nouveauCodeSecours(); arreterMinuteurs(); afficherCodeSecours(code, false); } catch (err) { alert(err.message); }
        } }, 'Nouveau code de secours')),
      webauthn ? null : h('small', { class: 'muted', text: 'Les clés de sécurité nécessitent une page servie en HTTPS (GitHub Pages ou intranet).' }));

    // -- Établissement et services
    var etab = h('input', { type: 'text', value: cfg.etablissement || '', placeholder: 'Nom de l’établissement (en-tête des documents imprimés)' });
    var tServices = zoneTexte(tousServices().map(function (x) { return x.code + ' ; ' + x.libelle; }).join('\n'));
    var tLieux = zoneTexte(Object.keys(cfg.lieuxCSI || {}).map(function (k) { return k + ' : ' + cfg.lieuxCSI[k].join(', '); }).join('\n'));
    var tPsy = zoneTexte((cfg.psychiatres || []).join('\n'), 5);
    var pServices = h('section', { class: 'panneau' }, h('h2', { text: 'Établissement et services' }),
      h('label', {}, 'Établissement', etab),
      h('div', { class: 'grille-2' },
        h('label', {}, 'Services (code ; libellé), un par ligne', tServices),
        h('label', {}, 'Chambres de soins intensifs (code service : CSI 1, CSI 2)', tLieux)),
      h('label', {}, 'Psychiatres proposés à la saisie (un par ligne)', tPsy),
      boutonEnregistrer(async function () {
        var svs = lignesDe(tServices).map(function (l) { var x = l.split(';'); if (x.length < 2 || !x[0].trim()) throw new Error('Service mal formé : ' + l); return { code: x[0].trim(), libelle: x.slice(1).join(';').trim() }; });
        var codes = svs.map(function (x) { return x.code; });
        if (codes.some(function (c, i) { return codes.indexOf(c) !== i; })) throw new Error('Deux services portent le même code.');
        var utilises = M.listeMesures(st()).map(function (m) { return m.service; });
        tousServices().forEach(function (x) { if (codes.indexOf(x.code) < 0 && utilises.indexOf(x.code) >= 0) throw new Error('Le service ' + x.code + ' a des mesures : il ne peut pas être supprimé (renommez son libellé).'); });
        var lieux = {}; lignesDe(tLieux).forEach(function (l) { var x = l.split(':'); if (x.length < 2) throw new Error('Lieu mal formé : ' + l); lieux[x[0].trim()] = x.slice(1).join(':').split(',').map(function (v) { return v.trim(); }).filter(Boolean); });
        await enregistrerConfig([['etablissement', etab.value.trim()], ['services', svs], ['lieuxCSI', lieux], ['psychiatres', lignesDe(tPsy)]]);
      }));

    // -- Surveillance
    var tPer = zoneTexte((cfg.periodes || []).map(function (p) { return p.code + ' ; ' + p.libelle + ' ; ' + p.debut + ' ; ' + p.fin; }).join('\n'), 3);
    var lignesPS = [];
    Object.keys(cfg.periodesService || {}).forEach(function (sv) { (cfg.periodesService[sv] || []).forEach(function (p) { lignesPS.push(sv + ' ; ' + p.code + ' ; ' + p.libelle + ' ; ' + p.debut + ' ; ' + p.fin); }); });
    var tPerSv = zoneTexte(lignesPS.join('\n'), 3);
    var pSurv = h('section', { class: 'panneau' }, h('h2', { text: 'Postes de surveillance en CSI' }),
      h('div', { class: 'grille-2' },
        h('label', {}, 'Postes par défaut (code ; libellé ; début ; fin)', tPer),
        h('label', {}, 'Postes propres à un service (service ; code ; libellé ; début ; fin)', tPerSv)),
      h('small', { class: 'muted', text: 'Un service qui a ses propres postes n’utilise pas les postes par défaut. Ne changez pas le code d’un poste déjà utilisé.' }),
      boutonEnregistrer(async function () {
        var pers = lignesDe(tPer).map(function (l) { return periodeDepuis(l.split(';').map(function (v) { return v.trim(); }), l); });
        var parSv = {};
        lignesDe(tPerSv).forEach(function (l) { var x = l.split(';').map(function (v) { return v.trim(); }); if (x.length !== 5) throw new Error('Poste mal formé : ' + l); (parSv[x[0]] = parSv[x[0]] || []).push(periodeDepuis(x.slice(1), l)); });
        await enregistrerConfig([['periodes', pers], ['periodesService', parSv]]);
      }));

    // -- Règles légales
    var champs = [['seuilInfo15j', 'Information du JLD : seuil de cumul sur 15 jours (h)'], ['seuilSaisine15j', 'Saisine du JLD : seuil de cumul sur 15 jours (h)'], ['seuilDecision15j', 'Décision du JLD : seuil de cumul sur 15 jours (h)'],
      ['intervalleCycle', 'Intervalle entre deux cycles (h)'], ['rythmeLongCycle', 'Rythme des mesures longues à partir du cycle (0 = désactivé)'], ['rythmeLongInfoSaisine', 'Rythme long : information et saisine (h)'], ['rythmeLongDecision', 'Rythme long : décision (h)'], ['seuilJaune', 'Alerte « échéance proche » (h avant)']];
    var entrees = {};
    var tbody = h('tbody', {}, champs.map(function (c) {
      return h('tr', {}, h('td', { text: c[1] }), ['Isolement', 'Contention'].map(function (t) {
        var p = R.params(t, cfg.parametres);
        var inp = h('input', { type: 'number', min: 0, step: 1, value: p[c[0]], class: 'champ-court' });
        entrees[t + c[0]] = inp;
        return h('td', {}, inp, p[c[0]] !== R.PARAMETRES_DEFAUT[t][c[0]] ? h('small', { class: 'muted', text: ' (défaut ' + R.PARAMETRES_DEFAUT[t][c[0]] + ')' }) : null);
      }));
    }));
    var delaiMode = h('input', { type: 'number', min: 0, max: 72, value: cfg.delaiModeHospiHeures == null ? 12 : cfg.delaiModeHospiHeures });
    var inact = h('input', { type: 'number', min: 2, max: 60, value: cfg.inactiviteMinutes || 10 });
    var pRegles = h('section', { class: 'panneau' }, h('h2', { text: 'Règles légales et sécurité' }),
      h('div', { class: 'alerte', text: 'Les valeurs par défaut traduisent l’article L. 3222-5-1 du code de la santé publique et la circulaire du 25 mars 2022. Ne les modifiez qu’en cas d’évolution des textes, après avis de la direction.' }),
      h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Paramètre' }), h('th', { text: 'Isolement' }), h('th', { text: 'Contention' }))), tbody)),
      h('div', { class: 'grille-2' },
        h('label', {}, 'Registre : passage des soins libres à une hospitalisation sous contrainte retenu s’il survient dans les … heures suivant le début', delaiMode),
        h('label', {}, 'Verrouillage automatique après inactivité (minutes)', inact)),
      boutonEnregistrer(async function () {
        var par = {};
        ['Isolement', 'Contention'].forEach(function (t) {
          champs.forEach(function (c) {
            var v = +entrees[t + c[0]].value;
            if (!isFinite(v) || v < 0) throw new Error('Valeur invalide : ' + c[1] + ' (' + t + ')');
            if (v !== R.PARAMETRES_DEFAUT[t][c[0]]) { par[t] = par[t] || {}; par[t][c[0]] = v; }
          });
        });
        await enregistrerConfig([['parametres', par], ['delaiModeHospiHeures', Math.max(0, +delaiMode.value || 0)], ['inactiviteMinutes', Math.max(2, Math.min(60, +inact.value || 10))]]);
      }));

    // -- Pauses (levées temporaires)
    var op = M.optionsPauses(cfg);
    var cbRetr = h('input', { type: 'checkbox', checked: op.retrancher });
    var cbAuto = h('input', { type: 'checkbox', checked: op.repriseAuto });
    var nAlerte = h('input', { type: 'number', min: 0, max: M.PAUSE_MAX_HEURES, step: 0.5, value: op.alerteHeures, class: 'champ-court' });
    var nRefus = h('input', { type: 'number', min: 1, max: M.PAUSE_MAX_HEURES, step: 0.5, value: op.refusHeures, class: 'champ-court' });
    var avertRetr = h('div', { class: 'alerte', hidden: !cbRetr.checked, text: 'Retrancher les pauses reporte les échéances JLD de la durée des pauses. Ce choix relève d’une lecture des textes à valider par la direction (et, si possible, avec le JLD) : par défaut, la loi prévoit qu’une mesure reprise moins de 48 h après la fin de la précédente s’y ajoute, ce qui plaide pour laisser courir la durée. Le réglage s’applique à toutes les mesures, y compris passées (échéances, cumuls, décompte, registre, statistiques), et il est tracé dans le journal.' });
    cbRetr.addEventListener('change', function () { avertRetr.hidden = !cbRetr.checked; });
    var pPauses = h('section', { class: 'panneau' }, h('h2', { text: 'Pauses (levées temporaires)' }),
      h('label', { class: 'case' }, cbRetr, h('span', { text: 'Retrancher les pauses des décomptes (durées, cumuls sur 15 jours, échéances JLD, décompte, registre, statistiques)' })),
      avertRetr,
      h('small', { class: 'muted', text: 'Une pause sans reprise saisie n’est retranchée que jusqu’à son heure de reprise prévue.' }),
      h('label', { class: 'case' }, cbAuto, h('span', { text: 'Reprise automatique à l’heure prévue (sans saisie de la reprise)' })),
      h('small', { class: 'muted', text: 'Sans cette option, une reprise prévue dépassée et non saisie est signalée en rouge. Avec elle, la mesure reprend d’elle-même ; une reprise plus tôt que prévu se saisit toujours avec le bouton Reprise, et un patient qui ne réintègre pas la mesure doit faire l’objet d’une fin de mesure.' }),
      h('div', { class: 'grille-2' },
        h('label', {}, 'Alerte : pause de plus de … heures (0 = aucune alerte)', nAlerte),
        h('label', {}, 'Refus : pause de … heures ou plus (' + M.PAUSE_MAX_HEURES + ' h au maximum)', nRefus)),
      h('small', { class: 'muted', text: 'Le refus ne peut pas dépasser ' + M.PAUSE_MAX_HEURES + ' h : une interruption de 48 h ou plus n’est pas une levée temporaire, c’est une fin de mesure.' }),
      boutonEnregistrer(async function () {
        var a = +nAlerte.value, r = +nRefus.value;
        if (!isFinite(r) || r <= 0 || r > M.PAUSE_MAX_HEURES) throw new Error('Le seuil de refus doit être compris entre 0 et ' + M.PAUSE_MAX_HEURES + ' h.');
        if (!isFinite(a) || a < 0 || (a && a >= r)) throw new Error('Le seuil d’alerte doit être inférieur au seuil de refus (0 pour aucune alerte).');
        if (cbRetr.checked !== op.retrancher && !confirm(cbRetr.checked ? 'Retrancher les pauses va reporter les échéances JLD de toutes les mesures concernées. Confirmer ?' : 'Ne plus retrancher les pauses va avancer les échéances JLD des mesures concernées. Confirmer ?')) return false;
        await enregistrerConfig([['pauses', { retrancher: cbRetr.checked, repriseAuto: cbAuto.checked, alerteHeures: a, refusHeures: r }]]);
      }));

    var pMasques = SIC.ui.actions.panneauMasquesDecompte ? SIC.ui.actions.panneauMasquesDecompte() : null;

    // -- Registre
    var lignesC = [];
    Object.keys(cfg.compteursRegistre || {}).forEach(function (sv) { Object.keys(cfg.compteursRegistre[sv]).forEach(function (an) { lignesC.push(sv + ' ; ' + an + ' ; ' + cfg.compteursRegistre[sv][an]); }); });
    var tComp = zoneTexte(lignesC.join('\n'), 3);
    var pDocs = h('section', { class: 'panneau' }, h('h2', { text: 'Registre anonymisé' }),
      h('label', {}, 'Dernier numéro utilisé dans le registre antérieur à l’outil (service ; année ; numéro)', tComp),
      boutonEnregistrer(async function () {
        var comp = {};
        lignesDe(tComp).forEach(function (l) { var x = l.split(';').map(function (v) { return v.trim(); }); if (x.length !== 3 || !/^\d{4}$/.test(x[1]) || !/^\d+$/.test(x[2])) throw new Error('Ligne mal formée : ' + l); comp[x[0]] = comp[x[0]] || {}; comp[x[0]][x[1]] = +x[2]; });
        await enregistrerConfig([['compteursRegistre', comp]]);
      }));

    var pImport = SIC.ui.actions.importer ? h('section', { class: 'panneau' }, h('h2', { text: 'Reprise des données du classeur Excel (V1.3)' }),
      h('p', { class: 'muted', text: 'Lit le classeur directement dans ce navigateur (rien n’est envoyé), affiche un rapport, puis enregistre les mesures, patients, cycles JLD, tiers et professionnels. Un import relancé ne crée pas de doublon.' }),
      h('button', { class: 'btn', onclick: SIC.ui.actions.importer }, 'Importer un classeur…')) : null;

    var demo = App.dossier.mode === 'demo' ? h('section', { class: 'panneau' }, h('h2', { text: 'Démonstration' }),
      h('p', { class: 'muted', text: 'Efface toutes les données de démonstration de ce navigateur et revient à l’accueil.' }),
      h('button', { class: 'btn danger', onclick: async function () {
        if (!confirm('Effacer toutes les données de démonstration ?')) return;
        arreterMinuteurs(); await App.dossier.vider(); await changerDossier();
      } }, 'Effacer la démonstration')) : null;

    var infos = h('section', { class: 'panneau' }, h('h2', { text: 'Informations techniques' }),
      h('div', { class: 'recap' },
        h('div', { text: 'Version : ' + SIC.VERSION }),
        h('div', { text: 'Dossier : ' + App.dossier.nom + ' (' + (App.dossier.mode === 'demo' ? 'démonstration' : 'réseau') + ')' }),
        h('div', { text: 'Saisies dans le journal : ' + s.evts.length + (s.rejetes.length ? ' — ' + s.rejetes.length + ' fichier(s) illisible(s)' : '') }),
        h('div', { text: 'Coffre : révision ' + s.coffre.rev + ', ' + embs.length + ' moyen(s) de déblocage' }),
        h('div', { text: 'Adresse : ' + location.protocol + '//' + (location.host || '(fichier local)') }),
        h('div', { text: 'Licence : EUPL-1.2 — code source : github.com/rodtrip2/Suivi-mesures-isocont' })));

    if (s.formation) {
      // Les comptes et les clés sont ceux des données réelles : ils ne se gèrent pas depuis le jeu de formation.
      var note = h('section', { class: 'panneau' }, h('h2', { text: 'Administration en mode formation' }),
        h('p', { text: 'Le paramétrage ci-dessous ne concerne que le jeu de formation. Les comptes, les clés de sécurité et l’import se gèrent depuis les données réelles.' }));
      return h('div', {}, h('h1', { text: 'Administration' }), note, pServices, pSurv, pRegles, pPauses, pMasques, pDocs, infos);
    }
    return h('div', {}, h('h1', { text: 'Administration' }), comptes, deblocage, SIC.ui.formation.sectionAdmin(), pServices, pSurv, pRegles, pPauses, pMasques, pDocs, pImport, demo, infos);
  }

  function casesRoles(actuels) {
    var bloc = h('div', { class: 'pile' });
    var cases = {};
    Object.keys(M.ROLES).forEach(function (r) {
      cases[r] = h('input', { type: 'checkbox', checked: actuels.indexOf(r) >= 0 });
      bloc.appendChild(h('label', { class: 'case' }, cases[r], h('span', { text: M.ROLES[r] + ' — ' + ({ IDE: 'décisions de début et de fin, tiers, surveillance CSI, envois JLD', AS: 'mêmes droits que l’IDE', SECRETAIRE: 'envois et suivi JLD', CADRE: 'pilotage, corrections, registre, statistiques', ADMIN: 'comptes, clés, paramétrage, import ; voit tous les services' })[r] })));
    });
    bloc.cases = cases;
    bloc.valeur = function () { var v = Object.keys(cases).filter(function (r) { return cases[r].checked; }); if (!v.length) throw new Error('Choisissez au moins un rôle.'); return v; };
    return bloc;
  }

  function casesServices(actuels, roles) {
    var bloc = h('div', { class: 'pile' });
    var cases = {};
    var note = h('small', { class: 'muted', text: 'Administrateur : accès à tous les services.' });
    tousServices().forEach(function (x) {
      cases[x.code] = h('input', { type: 'checkbox', checked: actuels.indexOf(x.code) >= 0 });
      bloc.appendChild(h('label', { class: 'case' }, cases[x.code], h('span', { text: x.libelle + ' (' + x.code + ')' })));
    });
    bloc.appendChild(note);
    function maj() {
      var admin = roles.cases.ADMIN.checked;
      note.hidden = !admin;
      Object.keys(cases).forEach(function (k) { cases[k].disabled = admin; });
    }
    roles.cases.ADMIN.addEventListener('change', maj); maj();
    bloc.valeur = function (rolesChoisis) {
      var v = Object.keys(cases).filter(function (k) { return cases[k].checked; });
      var exige = rolesChoisis.indexOf('ADMIN') < 0 && rolesChoisis.some(function (r) { return M.ROLES_DE_SERVICE.indexOf(r) >= 0; });
      if (exige && !v.length) throw new Error('Affectez au moins un service.');
      return v;
    };
    return bloc;
  }

  function modaleCompte(c) {
    var s = App.session;
    var roles = casesRoles(c ? c.roles : ['IDE']);
    var svs = casesServices(c ? (c.services || []) : (App.service !== '*' ? [App.service] : []), roles);
    if (c) {
      var actif = h('input', { type: 'checkbox', checked: c.actif });
      var formation = h('input', { type: 'checkbox', checked: c.formation !== false });
      return modale('Compte — ' + c.nom, h('div', { class: 'pile' },
        h('div', {}, h('b', { text: 'Rôles' }), roles), h('div', {}, h('b', { text: 'Services affectés' }), svs),
        h('label', { class: 'case' }, formation, h('span', { text: 'Accès au mode formation (choix proposé à la connexion)' })),
        h('label', { class: 'case' }, actif, h('span', { text: 'Compte actif (désactiver retire son mot de passe du coffre)' }))), [
        { texte: 'Annuler' },
        { texte: 'Enregistrer', classe: 'primaire', action: async function () {
          var r = roles.valeur(), sv = svs.valeur(r);
          if (c.id === s.utilisateur.id && r.indexOf('ADMIN') < 0 && !confirm('Vous retirez votre propre rôle d’administrateur. Continuer ?')) return false;
          if (r.indexOf('ADMIN') >= 0 && !actif.checked && s.comptes.filter(function (x) { return x.actif && x.roles.indexOf('ADMIN') >= 0 && x.id !== c.id; }).length === 0) throw new Error('Il doit rester au moins un administrateur actif.');
          await s.modifierRoles(c.id, r, actif.checked, sv, formation.checked); toast('Compte mis à jour.');
        } }]);
    }
    var nom = h('input', { type: 'text' }), login = h('input', { type: 'text', placeholder: 'prenom.nom' });
    var genere = C.nouveauMotDePasseProvisoire();
    var mdp = h('input', { type: 'text', class: 'mono', value: genere, autocomplete: 'off', spellcheck: 'false' });
    var accesForm = h('input', { type: 'checkbox', checked: true });
    nom.addEventListener('input', function () { if (!login.dataset.modifie) login.value = SIC.comptes.identifiantDepuisNom(nom.value); });
    login.addEventListener('input', function () { login.dataset.modifie = '1'; });
    modale('Nouveau compte', h('div', { class: 'pile' },
      h('div', { class: 'grille-2' }, h('label', {}, 'Nom affiché', nom), h('label', {}, 'Identifiant', login)),
      h('label', {}, 'Mot de passe provisoire', mdp),
      h('div', {}, h('b', { text: 'Rôles' }), roles),
      h('div', {}, h('b', { text: 'Services affectés' }), svs),
      h('label', { class: 'case' }, accesForm, h('span', { text: 'Accès au mode formation (choix proposé à la connexion)' })),
      h('small', { class: 'muted', text: 'Notez le mot de passe provisoire et remettez-le en main propre : l’agent devra obligatoirement le remplacer à sa première connexion.' })), [
      { texte: 'Annuler' },
      { texte: 'Créer le compte', classe: 'primaire', action: async function () {
        if (!nom.value.trim()) throw new Error('Indiquez le nom.');
        if (mdp.value.length < 12) throw new Error('Mot de passe provisoire : 12 caractères minimum.');
        var r = roles.valeur();
        var c2 = { nom: nom.value, login: login.value || SIC.comptes.identifiantDepuisNom(nom.value), motDePasse: mdp.value, roles: r, services: svs.valeur(r), aleatoire: mdp.value === genere, formation: accesForm.checked };
        await s.creerCompte(c2);
        setTimeout(function () { if (SIC.ui.actions.fichesRemise) SIC.ui.actions.fichesRemise([c2], 'Compte créé'); }, 0);
      } }], { focus: nom });
  }

  function modaleReinit(c) {
    var genere = C.nouveauMotDePasseProvisoire();
    var mdp = h('input', { type: 'text', class: 'mono', value: genere, autocomplete: 'off', spellcheck: 'false' });
    var soi = c.id === App.session.utilisateur.id;
    if (soi) return modaleMonMotDePasse();
    modale((c.actif ? 'Réinitialiser le mot de passe — ' : 'Réactiver — ') + c.nom, h('div', { class: 'pile' },
      h('p', { text: 'En cas de perte du mot de passe : l’ancien mot de passe cesse de fonctionner et un mot de passe provisoire le remplace. L’agent devra le changer à sa prochaine connexion. L’opération est tracée.' }),
      h('label', {}, 'Mot de passe provisoire', mdp)), [
      { texte: 'Annuler' },
      { texte: c.actif ? 'Réinitialiser' : 'Réactiver', classe: 'primaire', action: async function () {
        if (mdp.value.length < 12) throw new Error('Mot de passe provisoire : 12 caractères minimum.');
        if (!c.actif) await App.session.modifierRoles(c.id, c.roles, true, c.services || []);
        await App.session.reinitialiserMotDePasse(c.id, mdp.value, { aleatoire: mdp.value === genere });
        var fiche = { nom: c.nom, login: c.login, motDePasse: mdp.value, roles: c.roles, services: c.services || [] };
        setTimeout(function () { if (SIC.ui.actions.fichesRemise) SIC.ui.actions.fichesRemise([fiche], c.actif ? 'Mot de passe réinitialisé' : 'Compte réactivé'); }, 0);
      } }]);
  }

  // ================================================================ Impression
  /** Imprime un document construit à part (décompte, rapport), sans l'interface autour. */
  function imprimer(noeud) {
    var zone = document.getElementById('zone-impression') || document.body.appendChild(h('div', { id: 'zone-impression' }));
    vider(zone).appendChild(noeud);
    document.body.classList.add('mode-impression');
    var fin = function () { document.body.classList.remove('mode-impression'); vider(zone); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  }

  // ================================================================ Partage avec les autres modules
  SIC.ui = {
    vues: (SIC.ui && SIC.ui.vues) || {}, actions: (SIC.ui && SIC.ui.actions) || {},
    h: h, vider: vider, date: date, court: court, duree: duree, relatif: relatif, versSaisie: versSaisie, depuisSaisie: depuisSaisie,
    toast: toast, modale: modale, imprimer: imprimer, erreurDans: erreurDans, fmtJour: fmtJour,
    App: App, st: st, config: config, services: services, tousServices: tousServices, libService: libService, etablissement: etablissement,
    patient: patient, nomPatient: nomPatient, modeActuel: modeActuel, dansService: dansService, mesuresVisibles: mesuresVisibles,
    badgeType: badgeType, badgePause: badgePause, cellEcheance: cellEcheance, selectPsychiatre: selectPsychiatre, recapMesure: recapMesure, rendreContenu: rendreContenu,
    LIB_TIERS: LIB_TIERS, LIB_STATUT: LIB_STATUT, LIB_NATURE: LIB_NATURE,
    demarrer: rendre, verrouiller: verrouiller
  };
})();
