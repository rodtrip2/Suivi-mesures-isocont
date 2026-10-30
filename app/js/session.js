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
  }

  Session.prototype.sur = function (fn) { this.auditeurs.push(fn); };
  Session.prototype.notifier = function () { var s = this; this.auditeurs.forEach(function (f) { f(s); }); };

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
  };

  /** Relit le coffre, applique `modif`, réécrit (contrôle de révision). */
  Session.prototype.modifierCoffre = async function (modif) {
    var coffre = await this.dossier.lireCoffre();
    this.coffre = coffre;
    await lireComptes(this);
    await modif(coffre, this.comptes);
    coffre.comptes = await chiffrerComptes(this.cle, this.comptes);
    this.coffre = await this.dossier.ecrireCoffre(coffre, coffre.rev);
    this.notifier();
  };

  /** Trace dans le journal une opération sur les comptes ou les clés (sans aucun secret). */
  Session.prototype.tracer = function (action, detail) {
    return this.enregistrer('COMPTE', Object.assign({ action: action }, detail || {}), undefined, { sansControle: true });
  };

  Session.prototype.creerCompte = async function (c) {
    var s = this, login = c.login.trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,40}$/.test(login)) throw new Error('Identifiant : lettres minuscules, chiffres, point, tiret (2 à 40 caractères).');
    await this.modifierCoffre(async function (coffre, comptes) {
      if (comptes.some(function (x) { return x.login === login; })) throw new Error('Cet identifiant existe déjà.');
      var compte = { id: 'u' + id8(), login: login, nom: c.nom.trim(), roles: c.roles, services: c.services || [], actif: true };
      comptes.push(compte);
      var emb = await C.emballerMotDePasse(s.cle, c.motDePasse);
      emb.id = 'k' + id8(); emb.userId = compte.id; emb.login = login;
      coffre.emballages.push(emb);
    });
    await this.tracer('CREATION', { login: login, roles: c.roles, services: c.services || [] });
  };

  Session.prototype.modifierRoles = async function (userId, roles, actif, services) {
    await this.modifierCoffre(async function (coffre, comptes) {
      var c = comptes.filter(function (x) { return x.id === userId; })[0];
      if (!c) throw new Error('Compte introuvable.');
      c.roles = roles; c.actif = actif; c.services = services || [];
      if (!actif) coffre.emballages = coffre.emballages.filter(function (e) { return e.userId !== userId; });
    });
    var c2 = this.comptes.filter(function (x) { return x.id === userId; })[0];
    await this.tracer('ROLES', { login: c2 ? c2.login : userId, roles: roles, actif: actif, services: services || [] });
    if (userId === this.utilisateur.id && c2) this.utilisateur = c2;
  };

  Session.prototype.reinitialiserMotDePasse = async function (userId, motDePasse) {
    var s = this;
    await this.modifierCoffre(async function (coffre, comptes) {
      var c = comptes.filter(function (x) { return x.id === userId; })[0];
      if (!c) throw new Error('Compte introuvable.');
      coffre.emballages = coffre.emballages.filter(function (e) { return !(e.methode === 'mdp' && e.userId === userId); });
      var emb = await C.emballerMotDePasse(s.cle, motDePasse);
      emb.id = 'k' + id8(); emb.userId = userId; emb.login = c.login;
      coffre.emballages.push(emb);
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
  Session.prototype.roles = function () { return this.utilisateur ? this.utilisateur.roles : []; };
  /** Codes des services que l'utilisateur connecté peut voir (tous pour un administrateur). */
  Session.prototype.mesServices = function () { return this.etat ? M.servicesDe(this.utilisateur, this.etat.config) : []; };
  Session.prototype.peut = function (type) { return M.peut(this.roles(), type); };

  Session.prototype.nomAuteur = function (userId) {
    var c = this.comptes.filter(function (x) { return x.id === userId; })[0];
    return c ? c.nom : (userId === 'secours' ? 'Compte de secours' : userId === 'demo' ? 'Données fictives' : userId);
  };

  /** Enregistre une saisie. `base` = version de la mesure au moment de la saisie. */
  Session.prototype.enregistrer = async function (type, data, base, options) {
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
    await this.dossier.ecrireEvenement(this.cle, evt);
    this.connus.add(evt.id + '.enc');
    this.evts.push(evt);
    this.recalculer();
    return evt;
  };

  /** Enregistre plusieurs saisies dans un seul fichier (import, données de démonstration). */
  Session.prototype.enregistrerLot = function (evenements, options) {
    return this.enregistrer('LOT', { evenements: evenements, libelle: (options && options.libelle) || '' }, undefined, options);
  };

  Session.prototype.recalculer = function () {
    this.etat = M.reduire(this.evts);
    this.notifier();
  };

  Session.prototype.synchroniser = async function () {
    if (!this.cle) return 0;
    if (this.derniereSynchro && Date.now() - (this.dernierCoffre || 0) > 60000) {
      this.dernierCoffre = Date.now();
      try {
        var coffre = await this.dossier.lireCoffre();
        if (coffre && this.coffre && coffre.rev !== this.coffre.rev) {
          this.coffre = coffre; await lireComptes(this);
          var moi = this.utilisateur && this.comptes.filter(function (c) { return c.id === this.utilisateur.id; }, this)[0];
          if (moi) this.utilisateur = moi;
        }
      } catch (e) { /* coffre momentanément illisible : nouvelle tentative plus tard */ }
    }
    var r = await this.dossier.lireNouveaux(this.cle, this.connus);
    this.rejetes = this.rejetes.concat(r.rejetes);
    this.derniereSynchro = Date.now();
    if (r.evenements.length || !this.etat) {
      this.evts = this.evts.concat(r.evenements);
      this.recalculer();
    } else this.notifier();
    return r.evenements.length;
  };

  SIC.Session = Session;
})(typeof self !== 'undefined' ? self : this);
