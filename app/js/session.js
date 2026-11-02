// SPDX-License-Identifier: EUPL-1.2
/*
 * Session — coffre de clés, comptes, journal et synchronisation.
 */
(function (root) {
  'use strict';
  var SIC = root.SIC = root.SIC || {};
  var C = SIC.crypto, M = SIC.model;

  function id8() { return C.hex(C.aleatoire(4)); }

  function Session(dossier) {
    this.dossier = dossier;
    this.cle = null;
    this.coffre = null;
    this.comptes = [];         // [{id, login, nom, roles, actif}]
    this.utilisateur = null;   // compte connecté (ou compte de secours)
    this.evts = [];
    this.connus = new Set();
    this.rejetes = [];
    this.etat = null;
    this.derniereSynchro = null;
    this.auditeurs = [];
    // Jeu de données actif : les données réelles (dossier principal) ou le jeu de formation.
    this.donnees = null;       // Dossier du jeu de formation quand il est ouvert
    this.cleDonnees = null;    // sa clé
    this.formation = false;
  }

  var DOSSIER_FORMATION = 'formation';
  function dossierActif(s) { return s.formation ? s.donnees : s.dossier; }
  function cleActive(s) { return s.formation ? s.cleDonnees : s.cle; }

  Session.prototype.sur = function (fn) { this.auditeurs.push(fn); };
  /** Prévient l'interface. `info` : { source: 'synchro', nouveaux: n } pour une synchronisation, sinon saisie locale. */
  Session.prototype.notifier = function (info) { var s = this; this.auditeurs.forEach(function (f) { f(s, info || { source: 'local' }); }); };

  // --------------------------------------------------------- Coffre
  Session.prototype.chargerCoffre = async function () {
    this.coffre = await this.dossier.lireCoffre();
    return this.coffre;
  };

  async function chiffrerComptes(cle, comptes) {
    return C.b64(await C.chiffrerJSON(cle, { comptes: comptes }, 'comptes'));
  }

  /** Initialise un dossier vide : clé de données, compte administrateur, code de secours. */
  Session.prototype.initialiser = async function (admin) {
    if (await this.dossier.lireCoffre()) throw new Error('Ce dossier contient déjà des données.');
    this.cle = await C.nouvelleCleDonnees();
    var compte = { id: 'u' + id8(), login: admin.login.trim().toLowerCase(), nom: admin.nom.trim(), roles: ['CADRE', 'ADMIN'], actif: true };
    var code = C.nouveauCodeSecours();
    var embMdp = await C.emballerMotDePasse(this.cle, admin.motDePasse);
    embMdp.id = 'k' + id8(); embMdp.userId = compte.id; embMdp.login = compte.login;
    var embSec = await C.emballerCodeSecours(this.cle, code);
    embSec.id = 'k' + id8(); embSec.userId = null;
    this.comptes = [compte];
    var coffre = { format: 'SIC-coffre', version: 1, creeLe: new Date().toISOString(), emballages: [embMdp, embSec], comptes: await chiffrerComptes(this.cle, this.comptes) };
    this.coffre = await this.dossier.ecrireCoffre(coffre, undefined);
    this.utilisateur = compte;
    await this.synchroniser();
    return code;
  };

  async function lireComptes(session) {
    var o = await C.dechiffrerJSON(session.cle, C.deb64(session.coffre.comptes), 'comptes');
    session.comptes = o.comptes;
  }

  Session.prototype.connexionMotDePasse = async function (login, motDePasse) {
    login = login.trim().toLowerCase();
    var embs = this.coffre.emballages.filter(function (e) { return e.methode === 'mdp' && e.login === login; });
    if (!embs.length) throw new Error('Identifiant ou mot de passe incorrect.');
    for (var i = 0; i < embs.length; i++) {
      try { this.cle = await C.deballerMotDePasse(embs[i], motDePasse); break; } catch (e) { this.cle = null; }
    }
    if (!this.cle) throw new Error('Identifiant ou mot de passe incorrect.');
    await lireComptes(this);
    var u = this.comptes.filter(function (c) { return c.id === embs[0].userId; })[0];
    if (!u || !u.actif) { this.verrouiller(); throw new Error('Ce compte est désactivé.'); }
    var val = SIC.comptes.validite(u, Date.now());
    if (val.expire) { this.verrouiller(); throw new Error('Ce compte temporaire a expiré (dernier jour d’accès : ' + u.finValidite.split('-').reverse().join('/') + '). Demandez sa prolongation à l’administrateur.'); }
    this.utilisateur = u;
    await this.synchroniser();
  };

  Session.prototype.connexionCleSecurite = async function () {
    var embs = this.coffre.emballages.filter(function (e) { return e.methode === 'cle'; });
    var r = await C.deballerCleSecurite(embs);
    this.cle = r.cle;
    await lireComptes(this);
    var u = this.comptes.filter(function (c) { return c.id === r.emballage.userId; })[0];
    this.utilisateur = u && u.actif ? u : { id: 'secours', login: 'secours', nom: 'Déblocage par clé de sécurité', roles: ['ADMIN'], actif: true };
    await this.synchroniser();
  };

  Session.prototype.connexionCodeSecours = async function (code) {
    var emb = this.coffre.emballages.filter(function (e) { return e.methode === 'secours'; })[0];
    if (!emb) throw new Error('Aucun code de secours enregistré.');
    try { this.cle = await C.deballerCodeSecours(emb, code); } catch (e) { throw new Error('Code de secours incorrect.'); }
    await lireComptes(this);
    this.utilisateur = { id: 'secours', login: 'secours', nom: 'Déblocage par code de secours', roles: ['ADMIN'], actif: true };
    await this.synchroniser();
  };

  Session.prototype.verrouiller = function () {
    this.cle = null; this.utilisateur = null; this.evts = []; this.connus = new Set(); this.etat = null; this.comptes = [];
    this.donnees = null; this.cleDonnees = null; this.formation = false; this.rejetes = []; this.reperesLus = {}; this.integrite = null;
  };

  /** Relit le coffre, applique `modif`, réécrit (contrôle de révision). */
  Session.prototype.modifierCoffre = async function (modif) {
    var coffre = await this.dossier.lireCoffre();
    this.coffre = coffre;
    await lireComptes(this);
    await modif(coffre, this.comptes);
    coffre.comptes = await chiffrerComptes(this.cle, this.comptes);
    this.coffre = await this.dossier.ecrireCoffre(coffre, coffre.rev);
    var moi = this.utilisateur && this.comptes.filter(function (x) { return x.id === this.utilisateur.id; }, this)[0];
    if (moi) this.utilisateur = moi;
    this.notifier();
  };

  /** Trace dans le journal une opération sur les comptes ou les clés (sans aucun secret). */
  Session.prototype.tracer = function (action, detail) {
    return this.enregistrer('COMPTE', Object.assign({ action: action }, detail || {}), undefined, { sansControle: true, journalReel: true });
  };

  var MOTIF_LOGIN = /^[a-z0-9._-]{2,40}$/;

  /** Crée un compte. Le mot de passe est provisoire : il devra être changé à la première connexion. */
  Session.prototype.creerCompte = async function (c) {
    await this.creerComptes([c]);
  };

  /**
   * Crée plusieurs comptes en une seule écriture du coffre.
   * `liste` : [{ nom, login, roles, services, motDePasse, aleatoire? }] ; `progres(n, total)` facultatif.
   */
  Session.prototype.creerComptes = async function (liste, progres) {
    var s = this;
    liste.forEach(function (c) {
      c.login = c.login.trim().toLowerCase();
      if (!MOTIF_LOGIN.test(c.login)) throw new Error('Identifiant « ' + c.login + ' » : lettres minuscules, chiffres, point, tiret (2 à 40 caractères).');
      if (!c.nom || !c.nom.trim()) throw new Error('Nom manquant pour « ' + c.login + ' ».');
    });
    // Emballages préparés avant d'ouvrir le coffre : la fenêtre d'écriture reste courte.
    var prepares = [];
    for (var i = 0; i < liste.length; i++) {
      var c = liste[i], id = 'u' + id8();
      var emb = await C.emballerMotDePasse(s.cle, c.motDePasse, c.aleatoire ? C.ITERATIONS_PROVISOIRE : undefined);
      emb.id = 'k' + id8(); emb.userId = id; emb.login = c.login;
      prepares.push({ compte: { id: id, login: c.login, nom: c.nom.trim(), roles: c.roles, services: c.services || [], actif: true, mdpProvisoire: true, formation: c.formation !== false, finValidite: c.finValidite || '' }, emb: emb });
      if (progres) progres(i + 1, liste.length);
    }
    await this.modifierCoffre(async function (coffre, comptes) {
      prepares.forEach(function (p) {
        if (comptes.some(function (x) { return x.login === p.compte.login; })) throw new Error('L’identifiant « ' + p.compte.login + ' » existe déjà.');
      });
      prepares.forEach(function (p) { comptes.push(p.compte); coffre.emballages.push(p.emb); });
    });
    if (prepares.length === 1) await this.tracer('CREATION', { login: prepares[0].compte.login, roles: prepares[0].compte.roles, services: prepares[0].compte.services, finValidite: prepares[0].compte.finValidite || undefined });
    else await this.tracer('CREATION_LOT', { comptes: prepares.map(function (p) { return { login: p.compte.login, roles: p.compte.roles, services: p.compte.services }; }) });
  };

  /** Modifie un compte. `formation` (facultatif) : accès au mode formation. */
  Session.prototype.modifierRoles = async function (userId, roles, actif, services, formation, finValidite) {
    await this.modifierCoffre(async function (coffre, comptes) {
      var c = comptes.filter(function (x) { return x.id === userId; })[0];
      if (!c) throw new Error('Compte introuvable.');
      c.roles = roles; c.actif = actif; c.services = services || [];
      if (typeof formation === 'boolean') c.formation = formation;
      if (typeof finValidite === 'string') c.finValidite = finValidite;
      if (!actif) coffre.emballages = coffre.emballages.filter(function (e) { return e.userId !== userId; });
    });
    var c2 = this.comptes.filter(function (x) { return x.id === userId; })[0];
    await this.tracer('ROLES', { login: c2 ? c2.login : userId, roles: roles, actif: actif, services: services || [], formation: c2 ? c2.formation !== false : undefined, finValidite: c2 && c2.finValidite ? c2.finValidite : undefined });
    if (userId === this.utilisateur.id && c2) this.utilisateur = c2;
  };

  /**
   * Remplace le mot de passe d'un compte. Fait par l'administrateur pour un autre agent,
   * le mot de passe est provisoire (à changer à la connexion suivante) ; fait par l'agent
   * lui-même, il devient définitif.
   */
  Session.prototype.reinitialiserMotDePasse = async function (userId, motDePasse, options) {
    var s = this, provisoire = userId !== this.utilisateur.id;
    var emb = await C.emballerMotDePasse(s.cle, motDePasse, options && options.aleatoire ? C.ITERATIONS_PROVISOIRE : undefined);
    await this.modifierCoffre(async function (coffre, comptes) {
      var c = comptes.filter(function (x) { return x.id === userId; })[0];
      if (!c) throw new Error('Compte introuvable.');
      coffre.emballages = coffre.emballages.filter(function (e) { return !(e.methode === 'mdp' && e.userId === userId); });
      emb.id = 'k' + id8(); emb.userId = userId; emb.login = c.login;
      coffre.emballages.push(emb);
      c.mdpProvisoire = provisoire;
    });
    var c3 = this.comptes.filter(function (x) { return x.id === userId; })[0];
    await this.tracer(userId === this.utilisateur.id ? 'MDP_CHANGE' : 'MDP_REINIT', { login: c3 ? c3.login : userId });
  };

  Session.prototype.changerMonMotDePasse = function (motDePasse) {
    return this.reinitialiserMotDePasse(this.utilisateur.id, motDePasse);
  };

  Session.prototype.ajouterCleSecurite = async function (libelle) {
    var s = this;
    var emb = await C.emballerCleSecurite(this.cle, this.utilisateur.login, libelle);
    emb.id = 'k' + id8(); emb.userId = this.utilisateur.id === 'secours' ? null : this.utilisateur.id;
    await this.modifierCoffre(async function (coffre) { coffre.emballages.push(emb); });
    await this.tracer('CLE_AJOUT', { libelle: emb.libelle, rpId: emb.rpId });
    return s;
  };

  Session.prototype.retirerEmballage = async function (idEmb) {
    await this.modifierCoffre(async function (coffre) {
      coffre.emballages = coffre.emballages.filter(function (e) { return e.id !== idEmb; });
    });
    await this.tracer('CLE_RETRAIT', { id: idEmb });
  };

  Session.prototype.nouveauCodeSecours = async function () {
    var s = this, code = C.nouveauCodeSecours();
    var emb = await C.emballerCodeSecours(this.cle, code);
    emb.id = 'k' + id8(); emb.userId = null;
    await this.modifierCoffre(async function (coffre) {
      coffre.emballages = coffre.emballages.filter(function (e) { return e.methode !== 'secours'; }).concat([emb]);
    });
    await this.tracer('CODE_SECOURS', {});
    return code;
  };

  // ---------------------------------------------------------- Journal
  /** Rôles de l'utilisateur : les mêmes dans les données réelles et dans le jeu de formation. */
  Session.prototype.roles = function () { return this.utilisateur ? this.utilisateur.roles : []; };
  /** Codes des services visibles (tous pour un administrateur). */
  Session.prototype.mesServices = function () { return this.etat ? M.servicesDe(this.utilisateur, this.etat.config) : []; };
  Session.prototype.accesFormation = function () { return M.accesFormation(this.utilisateur); };
  Session.prototype.peut = function (type) { return M.peut(this.roles(), type); };

  Session.prototype.nomAuteur = function (userId) {
    var c = this.comptes.filter(function (x) { return x.id === userId; })[0];
    return c ? c.nom : (userId === 'secours' ? 'Compte de secours' : userId === 'demo' ? 'Données fictives' : userId);
  };

  /**
   * Enregistre une saisie dans le jeu de données actif. `base` = version de la mesure au moment de la saisie.
   * `options.journalReel` : la saisie va toujours dans le journal des données réelles (traces des comptes),
   * même pendant le mode formation ; elle n'apparaît alors pas dans le jeu de formation.
   */
  Session.prototype.enregistrer = async function (type, data, base, options) {
    if (options && options.journalReel && this.formation) {
      var at0 = new Date().toISOString(), by0 = this.utilisateur.id;
      var trace = { v: 1, id: SIC.horodatageCompact(at0) + '_' + by0 + '_' + id8(), at: at0, by: by0, type: type, data: data, prec: null };
      await this.dossier.ecrireEvenement(this.cle, trace);
      return trace;
    }
    if (!(options && options.sansControle) && !this.peut(type)) throw new Error("Votre rôle ne permet pas cette action.");
    var at = (options && options.at) || new Date().toISOString();
    var by = (options && options.by) || this.utilisateur.id;
    var mesUns = this.evts.filter(function (e) { return e.by === by; });
    var evt = {
      v: 1,
      id: SIC.horodatageCompact(at) + '_' + by + '_' + id8(),
      at: at, by: by, type: type, data: data,
      prec: mesUns.length ? mesUns[mesUns.length - 1].id : null
    };
    if (typeof base === 'number') evt.base = base;
    await dossierActif(this).ecrireEvenement(cleActive(this), evt);
    this.connus.add(evt.id + '.enc');
    this.evts.push(evt);
    // Repère d'intégrité de l'agent : permet de détecter la disparition de ses dernières saisies.
    // Le compteur ne recule jamais : un poste qui ne voit pas une saisie perdue ne doit pas effacer l'écart.
    this.reperesLus = this.reperesLus || {};
    if (this.reperesLus[by] === undefined) {
      var lu = await dossierActif(this).lireRepere(cleActive(this), by);
      this.reperesLus[by] = (lu && lu.n) || 0;
    }
    var n = Math.max(mesUns.length, this.reperesLus[by] || 0) + 1;
    this.reperesLus[by] = n;
    try { await dossierActif(this).ecrireRepere(cleActive(this), by, { n: n, dernier: evt.id, at: at }); } catch (e) { /* sans conséquence sur la saisie */ }
    this.recalculer();
    return evt;
  };

  // ---------------------------------------------------------- Intégrité et copies
  /**
   * Contrôle d'intégrité du jeu de données actif : repères des agents (nombre de saisies et dernière
   * saisie attendus), saisies chargées qui ne sont plus sur le partage, fichiers illisibles, maillons
   * manquants du chaînage. Les anomalies dont l'administrateur a pris acte sont écartées (M.filtrerIntegrite).
   * Retourne { verifieLe, reperes: [], disparus: [], illisibles, fichiersIllisibles: [], manquants,
   * listeManquants: [], acquis }.
   */
  Session.prototype.verifierIntegrite = async function () {
    var s = this, d = dossierActif(this), etat = this.etat || { manquants: [], manquantsAcquis: [] };
    var res = { verifieLe: Date.now(), reperes: [], disparus: [],
      fichiersIllisibles: this.rejetes.map(function (r) { return { nom: r.nom, chemin: r.chemin || M.cheminEvenement(r.nom), raison: r.raison || '' }; }),
      listeManquants: etat.manquants.map(function (x) { return { id: x.manque, chemin: M.cheminEvenement(x.manque + '.enc'), by: x.by, suivant: x.evt }; }),
      manquantsAcquis: (etat.manquantsAcquis || []).length };
    res.manquants = res.listeManquants.length;
    var ids = {};
    this.evts.forEach(function (e) { ids[e.id] = e.by; });
    (await d.lireReperes(cleActive(this))).forEach(function (r) {
      if (r.illisible) { res.reperes.push({ agent: r.agent, illisible: true }); return; }
      s.reperesLus = s.reperesLus || {};
      s.reperesLus[r.agent] = Math.max(s.reperesLus[r.agent] || 0, r.n || 0);
      var n = s.evts.filter(function (e) { return e.by === r.agent; }).length;
      if (!ids[r.dernier] || n < r.n) res.reperes.push({ agent: r.agent, attendu: r.n, present: n, dernier: r.dernier, dernierManquant: !ids[r.dernier], dernierLe: r.at });
    });
    var surPartage = await d.nomsEvenements();
    this.connus.forEach(function (nom) { if (!surPartage.has(nom)) res.disparus.push(nom); });
    res = M.filtrerIntegrite(res, etat.integrite);
    this.integrite = res;
    return res;
  };

  /** Vrai si le dernier contrôle a relevé une anomalie non prise en compte. */
  Session.prototype.anomaliesIntegrite = function () {
    var r = this.integrite;
    return !!r && !!(r.reperes.length || r.disparus.length || r.illisibles || r.manquants);
  };

  /**
   * Répare le dossier des données réelles depuis une copie de sauvegarde complète : seuls les fichiers
   * absents ou illisibles sont remis, après vérification qu'ils s'ouvrent avec la clé actuelle ;
   * les fichiers illisibles remplacés passent en quarantaine. Relit le dossier, refait le contrôle,
   * trace l'opération au journal. Retourne le rapport de store.reparerDepuisCopie.
   */
  Session.prototype.reparerDepuisCopie = async function (copie) {
    if (this.formation) throw new Error('Réparation possible seulement sur les données réelles (quittez le mode formation).');
    if (!this.peut('INTEGRITE')) throw new Error('Réservé à l’administrateur.');
    var cle = this.cle, illisibles = new Set(this.rejetes.map(function (r) { return r.nom; }));
    var rapport = await this.dossier.reparerDepuisCopie(copie, illisibles, async function (nom, octets) {
      var e = await C.dechiffrerJSON(cle, octets, 'evt:' + nom);
      return !!e && e.id + '.enc' === nom;
    });
    var charges = {}, s = this;
    this.evts.forEach(function (e) { charges[e.id + '.enc'] = true; });
    var remis = new Set(rapport.remis.map(function (c) { return c.split('/').pop(); }));
    remis.forEach(function (nom) { if (!charges[nom]) s.connus.delete(nom); });
    this.rejetes = this.rejetes.filter(function (r) { return !remis.has(r.nom); });
    if (rapport.remis.length || rapport.invalides.length) await this.tracer('REPARATION', { libelle: rapport.remis.length + ' fichier(s) remis depuis la copie du ' + (copie.creeLe ? copie.creeLe.slice(0, 10) : '?') + (rapport.invalides.length ? ', ' + rapport.invalides.length + ' refusé(s)' : '') });
    await this.synchroniser();
    await this.verifierIntegrite();
    return rapport;
  };

  /** Met en quarantaine les fichiers illisibles désignés (noms), tracé au journal. Retourne les chemins de destination. */
  Session.prototype.mettreEnQuarantaine = async function (noms) {
    if (!this.peut('INTEGRITE')) throw new Error('Réservé à l’administrateur.');
    var d = dossierActif(this), voulus = new Set(noms), faits = [], s = this;
    for (var i = 0; i < this.rejetes.length; i++) {
      var r = this.rejetes[i];
      if (!voulus.has(r.nom)) continue;
      faits.push({ nom: r.nom, vers: await d.mettreEnQuarantaine(r.chemin || M.cheminEvenement(r.nom)) });
    }
    var ecartes = new Set(faits.map(function (f) { return f.nom; }));
    this.rejetes = this.rejetes.filter(function (r) { return !ecartes.has(r.nom); });
    ecartes.forEach(function (nom) { s.connus.delete(nom); });   // jamais chargés : ne pas les signaler comme disparus
    if (faits.length) await this.tracer('QUARANTAINE', { libelle: faits.length + ' fichier(s) illisible(s) mis en quarantaine : ' + faits.map(function (f) { return f.nom; }).join(', ') });
    await s.verifierIntegrite();
    return faits;
  };

  /**
   * Prise d'acte, par l'administrateur, des anomalies du dernier contrôle (récupération impossible) :
   * saisie INTEGRITE avec motif obligatoire. Les anomalies listées ne déclenchent plus d'alerte ;
   * une anomalie nouvelle en déclenche une.
   */
  Session.prototype.prendreActeIntegrite = async function (motif) {
    motif = String(motif || '').trim();
    if (!motif) throw new Error('Le motif est obligatoire.');
    var r = await this.verifierIntegrite();
    if (!this.anomaliesIntegrite()) throw new Error('Aucune anomalie à prendre en compte.');
    var ids = {};
    r.listeManquants.forEach(function (x) { ids[x.id] = true; });
    r.disparus.forEach(function (nom) { ids[nom.replace(/\.enc$/, '')] = true; });
    var data = {
      motif: motif,
      reperes: r.reperes.map(function (x) { return x.illisible ? { agent: x.agent, illisible: true } : { agent: x.agent, ecart: Math.max(0, x.attendu - x.present), dernier: x.dernierManquant ? x.dernier : '' }; }),
      manquants: Object.keys(ids),
      fichiers: r.fichiersIllisibles.map(function (f) { return f.nom; })
    };
    var evt = await this.enregistrer('INTEGRITE', data);
    await this.verifierIntegrite();
    return evt;
  };

  /**
   * Copie du coffre à conserver sous scellé avec le code de secours : sans les mots de passe des agents
   * (ils seraient à réinitialiser après une restauration), avec le code de secours et les clés de sécurité.
   * La date et le code de secours couverts sont notés dans le coffre.
   */
  Session.prototype.copieSousScelle = async function () {
    var secours = this.coffre.emballages.filter(function (e) { return e.methode === 'secours'; })[0];
    if (!secours) throw new Error('Aucun code de secours enregistré.');
    var creeLe = new Date().toISOString();
    await this.modifierCoffre(async function (coffre) { coffre.scelle = { creeLe: creeLe, secours: secours.id }; });
    var copie = JSON.parse(JSON.stringify(this.coffre));
    copie.emballages = copie.emballages.filter(function (e) { return e.methode !== 'mdp'; });
    copie.copieSousScelle = creeLe;
    await this.tracer('SCELLE', { libelle: 'copie du coffre sous scellé' });
    return copie;
  };

  /** État de la copie sous scellé : { creeLe, aJour } (à refaire si le code de secours a été renouvelé). */
  Session.prototype.etatScelle = function () {
    var sc = this.coffre && this.coffre.scelle, secours = this.coffre && this.coffre.emballages.filter(function (e) { return e.methode === 'secours'; })[0];
    if (!sc) return null;
    return { creeLe: sc.creeLe, aJour: !!secours && sc.secours === secours.id };
  };

  /** Copie de sauvegarde complète (coffre et saisies chiffrées), tracée au journal. */
  Session.prototype.copieComplete = async function () {
    var copie = await this.dossier.copieComplete();
    await this.tracer('SAUVEGARDE', { libelle: copie.fichiers.length + ' fichiers de saisie' });
    return copie;
  };

  /** Date de la dernière copie de sauvegarde complète (journal), ou null. */
  Session.prototype.derniereCopie = function () {
    var t = null;
    this.evts.forEach(function (e) { if (e.type === 'COMPTE' && e.data && e.data.action === 'SAUVEGARDE' && (!t || e.at > t)) t = e.at; });
    return t ? Date.parse(t) : null;
  };

  /** Enregistre plusieurs saisies dans un seul fichier (import, données de démonstration). */
  Session.prototype.enregistrerLot = function (evenements, options) {
    return this.enregistrer('LOT', { evenements: evenements, libelle: (options && options.libelle) || '' }, undefined, options);
  };

  Session.prototype.recalculer = function (info) {
    this.etat = M.reduire(this.evts);
    this.notifier(info);
  };

  Session.prototype.synchroniser = async function () {
    if (!this.cle) return 0;
    if (this.derniereSynchro && Date.now() - (this.dernierCoffre || 0) > 60000) {
      this.dernierCoffre = Date.now();
      try {
        var coffre = await this.dossier.lireCoffre();
        if (coffre && this.coffre && coffre.rev !== this.coffre.rev) {
          var jeuChange = this.formation && JSON.stringify(coffre.formation || null) !== JSON.stringify(this.coffre.formation || null);
          this.coffre = coffre; await lireComptes(this);
          var moi = this.utilisateur && this.comptes.filter(function (c) { return c.id === this.utilisateur.id; }, this)[0];
          if (moi) this.utilisateur = moi;
          if (this.formation && !this.accesFormation()) { await this.fermerFormation(); return 0; }
          if (jeuChange) {   // jeu de formation régénéré ou supprimé depuis un autre poste
            if (coffre.formation && this.accesFormation()) { await this.ouvrirFormation(); return 0; }
            await this.fermerFormation(); return 0;
          }
        }
      } catch (e) { /* coffre momentanément illisible : nouvelle tentative plus tard */ }
    }
    var r = await dossierActif(this).lireNouveaux(cleActive(this), this.connus);
    this.rejetes = this.rejetes.concat(r.rejetes);
    this.derniereSynchro = Date.now();
    if (r.evenements.length || !this.etat) {
      this.evts = this.evts.concat(r.evenements);
      this.recalculer({ source: 'synchro', nouveaux: r.evenements.length });
    } else this.notifier({ source: 'synchro', nouveaux: 0 });
    return r.evenements.length;
  };

  // ---------------------------------------------------------- Mode formation
  /*
   * Le jeu de formation est un second jeu de données, entièrement fictif, rangé dans le
   * sous-dossier « formation » du dossier principal, chiffré avec sa propre clé. Cette clé est
   * conservée dans le coffre, chiffrée par la clé des données réelles : seul un agent connecté
   * avec son vrai compte peut l'ouvrir, avec ses vrais rôles et services. À la connexion, chaque
   * agent dont l'accès au mode formation n'a pas été désactivé choisit entre les données réelles
   * et le jeu de formation. Les comptes, mots de passe et clés restent ceux du coffre réel.
   */
  Session.prototype.jeuFormation = function () { return (this.coffre && this.coffre.formation) || null; };

  /**
   * Crée le jeu de formation (première ouverture par un agent) ou le recrée en effaçant
   * l'ancien (administrateur), à partir des saisies fictives fournies.
   */
  Session.prototype.creerFormation = async function (saisies, libelle) {
    var admin = this.roles().indexOf('ADMIN') >= 0;
    if (!(admin || (this.accesFormation() && !this.jeuFormation()))) throw new Error('Seul un administrateur peut régénérer le jeu de formation.');
    if (this.formation) throw new Error('Revenez d’abord aux données réelles.');
    var s = this;
    var handle = await this.dossier.sousDossier([DOSSIER_FORMATION], true);
    var df = new SIC.Dossier(handle, 'formation');
    await df.vider();
    await df.ecrireFichier(handle, 'FORMATION-LISEZMOI.txt', new TextEncoder().encode(
      'Jeu de données FICTIVES de Suivi-mesures-isocont, utilisé pour la formation et les tests.\r\n' +
      'Ne pas ouvrir ce dossier comme dossier principal. Il peut être supprimé sans perte de données réelles :\r\n' +
      'le formateur le recrée depuis l’application (bouton « Mode formation »).\r\n'));
    var cle = await C.nouvelleCleDonnees();
    var at = new Date().toISOString();
    var lot = { v: 1, id: SIC.horodatageCompact(at) + '_' + this.utilisateur.id + '_' + id8(), at: at, by: this.utilisateur.id, type: 'LOT', data: { evenements: saisies, libelle: libelle || 'Jeu de formation' }, prec: null };
    await df.ecrireEvenement(cle, lot);
    var protege = C.b64(await C.chiffrerJSON(this.cle, { k: await C.exporterCle(cle) }, 'formation'));
    await this.modifierCoffre(async function (coffre) {
      coffre.formation = { cle: protege, creeLe: at, par: s.utilisateur.nom };
    });
    await this.tracer('FORMATION_CREEE', { saisies: saisies.length });
  };

  /**
   * Bascule la session sur le jeu de formation. `generer(config)` fournit les saisies fictives
   * si le jeu n'existe pas encore (il est alors créé à partir du paramétrage réel).
   */
  Session.prototype.ouvrirFormation = async function (generer) {
    if (!this.accesFormation()) throw new Error('L’accès au mode formation est désactivé pour ce compte.');
    if (!this.jeuFormation()) this.coffre = await this.dossier.lireCoffre();
    if (!this.jeuFormation()) {
      if (!generer) throw new Error('Le jeu de formation n’existe pas encore.');
      await this.creerFormation(generer(this.etat.config), 'Jeu de formation (données fictives)');
    }
    var jeu = this.jeuFormation();
    var o = await C.dechiffrerJSON(this.cle, C.deb64(jeu.cle), 'formation');
    this.cleDonnees = await C.importerCle(o.k);
    this.donnees = new SIC.Dossier(await this.dossier.sousDossier([DOSSIER_FORMATION], false), 'formation');
    this.formation = true;
    this.evts = []; this.connus = new Set(); this.rejetes = []; this.etat = null; this.reperesLus = {}; this.integrite = null;
    await this.synchroniser();
  };

  /** Revient aux données réelles. */
  Session.prototype.fermerFormation = async function () {
    this.donnees = null; this.cleDonnees = null; this.formation = false;
    this.evts = []; this.connus = new Set(); this.rejetes = []; this.etat = null; this.reperesLus = {}; this.integrite = null;
    await this.synchroniser();
  };

  SIC.Session = Session;
})(typeof self !== 'undefined' ? self : this);
