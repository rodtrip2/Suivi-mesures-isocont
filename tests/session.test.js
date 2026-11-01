// SPDX-License-Identifier: EUPL-1.2
// Coffre, comptes, saisie simultanée et instantanés sur un dossier simulé en mémoire : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Dossier simulé : sous-ensemble de l'API File System Access utilisé par store.js
class Fichier {
  constructor(name) { this.name = name; this.kind = 'file'; this.data = new Uint8Array(); }
  async getFile() { const d = this.data; return { arrayBuffer: async () => d.slice().buffer }; }
  async createWritable() { let tampon; return { write: async (o) => { tampon = new Uint8Array(o); }, close: async () => { this.data = tampon; } }; }
}
class Repertoire {
  constructor(name) { this.name = name; this.kind = 'directory'; this.e = new Map(); }
  async getDirectoryHandle(n, o) { return this.obtenir(n, o, Repertoire); }
  async getFileHandle(n, o) { return this.obtenir(n, o, Fichier); }
  obtenir(n, o, Type) {
    if (!this.e.has(n)) { if (!(o && o.create)) throw Object.assign(new Error('introuvable'), { name: 'NotFoundError' }); this.e.set(n, new Type(n)); }
    return this.e.get(n);
  }
  async *values() { for (const v of [...this.e.values()]) yield v; }
  async *keys() { for (const k of [...this.e.keys()]) yield k; }
  async removeEntry(n) { this.e.delete(n); }
}

globalThis.self = globalThis;
globalThis.SIC = { rules: require('../app/js/rules.js'), crypto: require('../app/js/crypto.js') };
globalThis.SIC.model = require('../app/js/model.js');
globalThis.SIC.comptes = require('../app/js/comptes.js');
require('../app/js/store.js');
require('../app/js/session.js');
const { Dossier, Session } = globalThis.SIC;
const C = globalThis.SIC.crypto;

async function nouveauDossier() {
  const racine = new Repertoire('SuiviIsoCont');
  const admin = new Session(new Dossier(racine, 'reseau'));
  const code = await admin.initialiser({ nom: 'Admin', login: 'admin', motDePasse: 'mot de passe solide' });
  return { racine, admin, code };
}
async function connecter(racine, login, mdp) {
  const s = new Session(new Dossier(racine, 'reseau'));
  await s.chargerCoffre();
  await s.connexionMotDePasse(login, mdp);
  return s;
}

test('Comptes : services affectés, connexion, refus du mauvais mot de passe, code de secours', async () => {
  const { racine, admin, code } = await nouveauDossier();
  await admin.enregistrer('CONFIG', { cle: 'services', valeur: [{ code: 'A', libelle: 'A' }, { code: 'B', libelle: 'B' }] });
  await admin.creerCompte({ nom: 'IDE', login: 'ide', motDePasse: 'autre mot de passe', roles: ['IDE'], services: ['B'] });
  const ide = await connecter(racine, 'ide', 'autre mot de passe');
  assert.deepEqual(ide.mesServices(), ['B']);
  assert.deepEqual(admin.mesServices(), ['A', 'B']);
  assert.ok(!ide.peut('CONFIG'));
  await assert.rejects(connecter(racine, 'ide', 'faux'), /incorrect/);
  const secours = new Session(new Dossier(racine, 'reseau'));
  await secours.chargerCoffre();
  await secours.connexionCodeSecours(code.toLowerCase());
  assert.equal(secours.utilisateur.roles[0], 'ADMIN');
  // Désactivation : le mot de passe est retiré du coffre
  await admin.modifierRoles(ide.utilisateur.id, ['IDE'], false, ['B']);
  await assert.rejects(connecter(racine, 'ide', 'autre mot de passe'), /incorrect/);
});

test('Compte temporaire : connexion refusée après le dernier jour d’accès, prolongation possible', async () => {
  const { racine, admin } = await nouveauDossier();
  const hier = new Date(Date.now() - 86400000), demain = new Date(Date.now() + 86400000);
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await admin.creerCompte({ nom: 'Intérim (fictif)', login: 'interim', motDePasse: 'mot de passe interim', roles: ['IDE'], services: ['U1'], finValidite: iso(hier) });
  await assert.rejects(connecter(racine, 'interim', 'mot de passe interim'), /expiré/);
  const c = admin.comptes.find((x) => x.login === 'interim');
  await admin.modifierRoles(c.id, ['IDE'], true, ['U1'], true, iso(demain));
  const s = await connecter(racine, 'interim', 'mot de passe interim');
  assert.equal(s.utilisateur.login, 'interim');
});

test('Deux postes saisissent en même temps : aucune saisie perdue, conflit détecté', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: Date.now() - 5 * 3600e3, csi: true });
  const autre = await connecter(racine, 'admin', 'mot de passe solide');
  const base = autre.etat.mesures.M1.version;
  await Promise.all([
    admin.enregistrer('MESURE_FIN', { mesureId: 'M1', fin: Date.now() - 3600e3 }, base),
    autre.enregistrer('MESURE_FIN', { mesureId: 'M1', fin: Date.now() - 1800e3 }, base, { by: 'autre-poste', sansControle: true })
  ]);
  await admin.synchroniser(); await autre.synchroniser();
  assert.equal(admin.evts.length, autre.evts.length);
  assert.equal(admin.etat.conflits.length, 1);
  assert.equal(autre.etat.conflits.length, 1);
});

test('Instantanés des mois clos et rejet d\'un fichier altéré', async () => {
  const { racine, admin } = await nouveauDossier();
  const ancien = new Date(); ancien.setUTCMonth(ancien.getUTCMonth() - 3);
  for (let i = 0; i < 5; i++) {
    await admin.enregistrer('PROFESSIONNEL', { service: 'U1', date: '2026-01-0' + (i + 1), periode: 'M', nom: 'Agent ' + i }, undefined, { at: new Date(ancien.getTime() + i * 1000).toISOString() });
  }
  const s2 = await connecter(racine, 'admin', 'mot de passe solide');
  assert.equal(s2.etat.professionnels.length, 5);
  const mois = ancien.toISOString().slice(0, 7);
  const inst = await racine.getDirectoryHandle('instantanes');
  assert.ok(inst.e.has(mois + '.enc'));
  // Une nouvelle session lit l'instantané ; un fichier d'origine altéré n'est plus lu individuellement
  const s3 = await connecter(racine, 'admin', 'mot de passe solide');
  assert.equal(s3.etat.professionnels.length, 5);
  // Altération d'un fichier du mois courant : rejeté
  await admin.enregistrer('PROFESSIONNEL', { service: 'U1', date: '2026-10-01', periode: 'M', nom: 'Agent X' });
  const courant = new Date().toISOString().slice(0, 7).split('-');
  const rep = await (await (await racine.getDirectoryHandle('evenements')).getDirectoryHandle(courant[0])).getDirectoryHandle(courant[1]);
  const f = [...rep.e.values()].pop(); f.data[40] ^= 1;
  const s4 = await connecter(racine, 'admin', 'mot de passe solide');
  assert.equal(s4.rejetes.length, 1);
  assert.equal(s4.etat.professionnels.length, 5);
});

test('Mot de passe provisoire : création en lot, changement obligatoire, réinitialisation par l\'administrateur', async () => {
  const { racine, admin } = await nouveauDossier();
  assert.ok(!admin.utilisateur.mdpProvisoire);
  const liste = ['a.un', 'b.deux', 'c.trois'].map(l => ({ nom: l, login: l, roles: ['AS'], services: ['U1'], motDePasse: C.nouveauMotDePasseProvisoire(), aleatoire: true }));
  let progres = 0;
  await admin.creerComptes(liste, (n) => { progres = n; });
  assert.equal(progres, 3);
  assert.equal(admin.comptes.length, 4);
  const journal = admin.evts.filter(e => e.type === 'COMPTE' && e.data.action === 'CREATION_LOT');
  assert.equal(journal.length, 1);
  assert.ok(!JSON.stringify(journal).includes(liste[0].motDePasse));   // aucun secret dans le journal

  // Première connexion : mot de passe provisoire signalé ; l'agent le change
  const agent = await connecter(racine, 'b.deux', liste[1].motDePasse);
  assert.equal(agent.utilisateur.mdpProvisoire, true);
  assert.ok(agent.peut('MESURE_DEBUT'));
  await agent.changerMonMotDePasse('mon mot de passe personnel');
  assert.equal(agent.utilisateur.mdpProvisoire, false);
  await assert.rejects(connecter(racine, 'b.deux', liste[1].motDePasse), /incorrect/);
  const encore = await connecter(racine, 'b.deux', 'mon mot de passe personnel');
  assert.equal(encore.utilisateur.mdpProvisoire, false);

  // Mot de passe perdu : l'administrateur réinitialise, l'ancien ne marche plus, le nouveau est provisoire
  await admin.reinitialiserMotDePasse(encore.utilisateur.id, 'provisoire-xyz-123', {});
  await assert.rejects(connecter(racine, 'b.deux', 'mon mot de passe personnel'), /incorrect/);
  const apres = await connecter(racine, 'b.deux', 'provisoire-xyz-123');
  assert.equal(apres.utilisateur.mdpProvisoire, true);

  // Un identifiant existant refuse tout le lot sans rien écrire
  await assert.rejects(admin.creerComptes([{ nom: 'X', login: 'a.un', roles: ['IDE'], services: ['U1'], motDePasse: 'abcdefghijkl' }]), /existe déjà/);
  assert.equal((await connecter(racine, 'admin', 'mot de passe solide')).comptes.length, 4);
});

test('Mode formation : accès par compte, choix à la connexion, jeu fictif séparé, traces dans le journal réel', async () => {
  require('../app/js/demo.js');
  const { racine, admin } = await nouveauDossier();
  await admin.enregistrer('CONFIG', { cle: 'services', valeur: [{ code: 'A', libelle: 'Unité A' }, { code: 'B', libelle: 'Unité B' }] });
  await admin.enregistrer('CONFIG', { cle: 'lieuxCSI', valeur: { A: ['410', '412'] } });
  await admin.enregistrer('MESURE_DEBUT', { mesureId: 'REEL', patientId: 'P', service: 'A', typeMesure: 'Isolement', debut: Date.now() - 3600e3, csi: true });
  await admin.creerComptes([
    { nom: 'IDE', login: 'ide', roles: ['IDE'], services: ['B'], motDePasse: 'ide 2026 ok ok' },
    { nom: 'Sans', login: 'sans', roles: ['IDE'], services: ['A'], motDePasse: 'sans 2026 ok ok', formation: false }
  ]);
  const generer = (config) => SIC.donneesFictives({ config });

  // Accès accordé par défaut ; désactivé pour « sans »
  const ide = await connecter(racine, 'ide', 'ide 2026 ok ok');
  assert.equal(ide.accesFormation(), true);
  const sans = await connecter(racine, 'sans', 'sans 2026 ok ok');
  assert.equal(sans.accesFormation(), false);
  await assert.rejects(sans.ouvrirFormation(generer), /désactivé/);

  // Première ouverture : le jeu est créé à partir du paramétrage réel, avec les rôles et services réels
  assert.equal(ide.jeuFormation(), null);
  await ide.ouvrirFormation(generer);
  assert.ok(ide.formation && ide.jeuFormation());
  assert.ok(!ide.etat.mesures.REEL);
  assert.ok(Object.keys(ide.etat.mesures).length >= 5);
  assert.deepEqual(ide.etat.config.services.map(x => x.code), ['A', 'B']);
  assert.ok(Object.values(ide.etat.mesures).filter(m => m.csi && m.service === 'A').every(m => ide.etat.config.lieuxCSI.A.includes(m.lieu)));
  assert.deepEqual(ide.mesServices(), ['B']);
  assert.ok(ide.peut('MESURE_DEBUT') && !ide.peut('CORRECTION'));

  // Une saisie en formation ne touche pas aux données réelles ; les traces de comptes vont au journal réel
  await ide.enregistrer('MESURE_DEBUT', { mesureId: 'FICTIF', patientId: 'P01', service: 'B', typeMesure: 'Isolement', debut: Date.now() - 60e3, csi: true });
  await ide.changerMonMotDePasse('nouveau mot de passe ide');
  assert.ok(!ide.etat.journal.some(e => e.type === 'COMPTE'));
  await admin.synchroniser();
  assert.ok(!admin.etat.mesures.FICTIF);
  assert.ok(admin.etat.journal.some(e => e.type === 'COMPTE' && e.data.action === 'MDP_CHANGE'));

  // Un agent ne peut pas régénérer un jeu existant ; l'administrateur peut
  await assert.rejects(sans.creerFormation(generer(sans.etat.config)), /administrateur/);
  const autre = await connecter(racine, 'ide', 'nouveau mot de passe ide');
  await autre.ouvrirFormation(generer);
  assert.ok(autre.etat.mesures.FICTIF);
  await autre.fermerFormation();
  assert.ok(autre.etat.mesures.REEL && !autre.etat.mesures.FICTIF);
  await assert.rejects(autre.creerFormation(generer(autre.etat.config)), /administrateur/);
  const avant = admin.jeuFormation() || (await admin.chargerCoffre()).formation;
  await admin.creerFormation(generer(admin.etat.config), 'Jeu de formation');
  assert.notEqual(admin.jeuFormation().cle, avant.cle);
  const apres = await connecter(racine, 'ide', 'nouveau mot de passe ide');
  await apres.ouvrirFormation(generer);
  assert.ok(!apres.etat.mesures.FICTIF);
  assert.equal(apres.rejetes.length, 0);

  // Accès retiré par l'administrateur
  await admin.modifierRoles(apres.utilisateur.id, ['IDE'], true, ['B'], false);
  const retire = await connecter(racine, 'ide', 'nouveau mot de passe ide');
  await assert.rejects(retire.ouvrirFormation(generer), /désactivé/);

  // Le sous-dossier de formation n'est jamais pris pour un dossier principal
  const sous = new Dossier(await racine.getDirectoryHandle('formation'), 'reseau');
  assert.equal(await sous.lireCoffre(), null);
  assert.equal(await sous.anomalie(), 'formation');
  assert.equal(await new Dossier(racine, 'reseau').anomalie(), 'sans-coffre');
});

test('Coffre : historique des versions, refus d’un coffre incomplet, restauration après perte', async () => {
  const { racine, admin, code } = await nouveauDossier();
  await admin.creerCompte({ nom: 'IDE', login: 'ide', motDePasse: 'autre mot de passe', roles: ['IDE'], services: ['U1'] });
  const versions = await admin.dossier.versionsCoffre();
  assert.ok(versions.length >= 1 && versions[0].valide);
  assert.equal(versions[0].rev, admin.coffre.rev);                       // la version actuelle est dans l'historique
  await assert.rejects(admin.dossier.ecrireCoffre({ format: 'SIC-coffre', emballages: [], comptes: 'x' }, admin.coffre.rev), /incomplet/);
  // Coffre abîmé : signalé, puis restauré depuis l'historique
  racine.e.get('coffre.json').data = new TextEncoder().encode('{ abîmé');
  const d = new Dossier(racine, 'reseau');
  assert.equal(await d.lireCoffre(), null);
  assert.equal(await d.anomalie(), 'coffre-illisible');
  await assert.rejects(d.ecrireCoffre(versions[0].coffre, versions[0].rev), /illisible/);
  racine.e.delete('coffre.json');
  await d.restaurerCoffre((await d.versionsCoffre())[0].coffre);
  const s = await connecter(racine, 'admin', 'mot de passe solide');
  assert.equal(s.utilisateur.login, 'admin');
  // Copie sous scellé : sans mots de passe, ouvre avec le code de secours
  const scelle = await s.copieSousScelle();
  assert.ok(!scelle.emballages.some((e) => e.methode === 'mdp'));
  assert.deepEqual(s.etatScelle().aJour, true);
  racine.e.delete('coffre.json');
  await new Dossier(racine, 'reseau').restaurerCoffre(scelle);
  const sec = new Session(new Dossier(racine, 'reseau'));
  await sec.chargerCoffre();
  await sec.connexionCodeSecours(code);
  assert.equal(sec.utilisateur.id, 'secours');
  await assert.rejects(connecter(racine, 'admin', 'mot de passe solide'), /incorrect/);   // mots de passe à réinitialiser
});

test('Copie de sauvegarde complète restaurée dans un dossier vide', async () => {
  const { admin } = await nouveauDossier();
  await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: Date.now() - 3600e3, csi: true });
  const copie = await admin.copieComplete();
  assert.ok(admin.derniereCopie());
  const vide = new Repertoire('Restauration');
  const d = new Dossier(vide, 'reseau');
  assert.equal(await d.restaurerCopie(JSON.parse(JSON.stringify(copie))), copie.fichiers.length);
  await assert.rejects(d.restaurerCopie(copie), /pas vide/);
  const s = await connecter(vide, 'admin', 'mot de passe solide');
  assert.ok(s.etat.mesures.M1);
});

test('Intégrité : disparition des dernières saisies d’un agent et des fichiers chargés', async () => {
  const { racine, admin } = await nouveauDossier();
  const e1 = await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: Date.now() - 3600e3, csi: true });
  const e2 = await admin.enregistrer('MESURE_FIN', { mesureId: 'M1', fin: Date.now() });
  let r = await admin.verifierIntegrite();
  assert.deepEqual([r.reperes.length, r.disparus.length], [0, 0]);
  // Suppression de la dernière saisie : le chaînage ne la voit pas, le repère si
  const mois = e2.at.slice(0, 7).split('-');
  const dir = racine.e.get('evenements').e.get(mois[0]).e.get(mois[1]);
  dir.e.delete(e2.id + '.enc');
  r = await admin.verifierIntegrite();
  assert.deepEqual(r.disparus, [e2.id + '.enc']);                       // poste ouvert : fichier disparu
  const autre = await connecter(racine, 'admin', 'mot de passe solide');
  r = await autre.verifierIntegrite();
  assert.equal(r.reperes.length, 1);
  assert.equal(r.reperes[0].dernierManquant, true);
  assert.ok(autre.etat.mesures[e1.data.mesureId]);
});
