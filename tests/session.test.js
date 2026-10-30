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
