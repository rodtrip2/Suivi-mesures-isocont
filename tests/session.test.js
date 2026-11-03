// SPDX-License-Identifier: EUPL-1.2
// Coffre, comptes, saisie simultanée et instantanés sur un dossier simulé en mémoire : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Dossier simulé : sous-ensemble de l'API File System Access utilisé par store.js
class Fichier {
  constructor(name) { this.name = name; this.kind = 'file'; this.data = new Uint8Array(); this.modifie = 0; }
  async getFile() { const d = this.data; return { size: d.length, lastModified: this.modifie, arrayBuffer: async () => d.slice().buffer }; }
  async createWritable() { let tampon; return { write: async (o) => { tampon = new Uint8Array(o); }, close: async () => { this.data = tampon; this.modifie = Date.now() + (Fichier.horloge = (Fichier.horloge || 0) + 1); } }; }
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
  async isSameEntry(o) { return o === this; }
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

function dossierMois(racine, evt) {
  const m = evt.at.slice(0, 7).split('-');
  return racine.e.get('evenements').e.get(m[0]).e.get(m[1]);
}

test('Intégrité : réparation depuis une copie (absents et illisibles seulement), quarantaine, refus d’un fichier étranger', async () => {
  const { racine, admin } = await nouveauDossier();
  const debut = Date.now() - 5 * 3600e3;
  const e1 = await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut, csi: true });
  const e2 = await admin.enregistrer('PAUSE', { mesureId: 'M1', debut: debut + 3600e3, repriseprevue: debut + 2 * 3600e3 });
  const e3 = await admin.enregistrer('MESURE_FIN', { mesureId: 'M1', fin: Date.now() - 60e3 });
  const copie = JSON.parse(JSON.stringify(await admin.copieComplete()));
  // Incident : une saisie supprimée, une autre altérée
  dossierMois(racine, e1).e.delete(e1.id + '.enc');
  const altere = dossierMois(racine, e2).e.get(e2.id + '.enc'); altere.data[50] ^= 1;
  const s = await connecter(racine, 'admin', 'mot de passe solide');
  let r = await s.verifierIntegrite();
  assert.ok(s.anomaliesIntegrite());
  assert.deepEqual(r.fichiersIllisibles.map((f) => f.nom), [e2.id + '.enc']);
  assert.match(r.fichiersIllisibles[0].chemin, /^evenements\/\d{4}\/\d{2}\/.+\.enc$/);
  assert.deepEqual(r.listeManquants.map((x) => x.id), [e2.id]);
  assert.equal(SIC.model.cheminEvenement(e1.id + '.enc'), 'evenements/' + e1.at.slice(0, 4) + '/' + e1.at.slice(5, 7) + '/' + e1.id + '.enc');
  // Un fichier de la copie qui ne s'ouvre pas avec la clé actuelle est refusé
  const piege = JSON.parse(JSON.stringify(copie));
  const f1 = piege.fichiers.find((f) => f.chemin.endsWith(e1.id + '.enc'));
  f1.contenu = C.b64(new TextEncoder().encode('pas une saisie'));
  const rp = await s.reparerDepuisCopie(piege);
  assert.deepEqual([rp.invalides.length, rp.remis.length], [1, 1]);      // e1 refusé ; e2 (illisible) remis
  // Réparation : seuls e1 (absent) et e2 (illisible) sont remis ; l'original altéré part en quarantaine
  const presentAvant = dossierMois(racine, e3).e.get(e3.id + '.enc').data;
  const rap = await s.reparerDepuisCopie(copie);
  assert.deepEqual(rap.remis.map((c) => c.split('/').pop()), [e1.id + '.enc']);   // seul e1 manquait encore
  assert.equal(dossierMois(racine, e3).e.get(e3.id + '.enc').data, presentAvant);   // fichier présent jamais réécrit
  assert.ok(racine.e.get('quarantaine'));
  assert.equal(s.rejetes.length, 0);
  assert.ok([e1, e2, e3].every((e) => s.evts.some((x) => x.id === e.id)) && s.etat.mesures.M1.fin);
  assert.equal(s.anomaliesIntegrite(), false);
  assert.ok(s.evts.some((e) => e.type === 'COMPTE' && e.data.action === 'REPARATION'));
});

test('Intégrité : prise d’acte par l’administrateur (motif obligatoire), nouvelle anomalie toujours signalée, quarantaine', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.creerCompte({ nom: 'IDE', login: 'ide', motDePasse: 'autre mot de passe', roles: ['IDE'], services: ['U1'] });
  const a = await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: Date.now() - 3600e3, csi: true });
  const b = await admin.enregistrer('PATIENT', { patientId: 'P', ipp: '000 (fictif)' });
  await admin.enregistrer('PATIENT', { patientId: 'P', nom: 'FICTIF' });
  dossierMois(racine, b).e.delete(b.id + '.enc');                          // perdu, sans copie
  const s = await connecter(racine, 'admin', 'mot de passe solide');
  await s.verifierIntegrite();
  assert.ok(s.anomaliesIntegrite());
  const ide = await connecter(racine, 'ide', 'autre mot de passe');
  await assert.rejects(ide.prendreActeIntegrite('test'), /rôle/);
  await assert.rejects(s.prendreActeIntegrite('  '), /obligatoire/);
  await s.prendreActeIntegrite('Fichier perdu, absent des sauvegardes du service informatique (test fictif)');
  assert.equal(s.anomaliesIntegrite(), false);
  assert.equal(s.etat.integrite.historique.length, 1);
  assert.equal(s.etat.manquants.length, 0);
  assert.equal(s.etat.manquantsAcquis.length, 1);
  // Une autre session voit la même chose
  const t = await connecter(racine, 'admin', 'mot de passe solide');
  await t.verifierIntegrite();
  assert.equal(t.anomaliesIntegrite(), false);
  // Nouvelle disparition : nouvelle alerte
  dossierMois(racine, a).e.delete(a.id + '.enc');
  const u = await connecter(racine, 'admin', 'mot de passe solide');
  await u.verifierIntegrite();
  assert.ok(u.anomaliesIntegrite());
  // Fichier illisible mis en quarantaine (rien n'est supprimé)
  const c = await u.enregistrer('PATIENT', { patientId: 'P', prenom: 'Test' });
  dossierMois(racine, c).e.get(c.id + '.enc').data[45] ^= 1;
  const v = await connecter(racine, 'admin', 'mot de passe solide');
  assert.equal(v.rejetes.length, 1);
  const faits = await v.mettreEnQuarantaine([c.id + '.enc']);
  assert.equal(faits.length, 1);
  assert.equal(v.rejetes.length, 0);
  assert.ok(!dossierMois(racine, c).e.has(c.id + '.enc'));
  const m = c.at.slice(0, 7).split('-');
  assert.ok(racine.e.get('quarantaine').e.get(m[0]).e.get(m[1]).e.has(c.id + '.enc'));
  assert.ok(v.evts.some((e) => e.type === 'COMPTE' && e.data.action === 'QUARANTAINE'));
  // L'annulation de la prise d'acte rouvre l'alerte
  const acte = v.evts.find((e) => e.type === 'INTEGRITE');
  await v.enregistrer('ANNULATION', { cible: acte.id, motif: 'test' });
  assert.equal(v.etat.integrite.historique.length, 0);
});

test('Préférences de l’agent : thème enregistré chiffré pour son compte, retrouvé depuis un autre poste', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.creerCompte({ nom: 'IDE', login: 'ide', motDePasse: 'autre mot de passe', roles: ['IDE'], services: ['U1'] });
  const ide = await connecter(racine, 'ide', 'autre mot de passe');
  assert.deepEqual(await ide.lirePreferences(), {});
  await ide.enregistrerPreference('theme', 'dark');
  const fichier = [...racine.e.get('preferences').e.values()][0];
  assert.ok(!new TextDecoder().decode(fichier.data).includes('dark'));   // chiffré
  const autrePoste = await connecter(racine, 'ide', 'autre mot de passe');
  assert.equal((await autrePoste.lirePreferences()).theme, 'dark');
  assert.equal((await admin.lirePreferences()).theme, undefined);          // propre à chaque agent
  assert.ok(!autrePoste.evts.some((e) => JSON.stringify(e.data || {}).includes('theme')));   // rien au journal
});

test('Exports : enregistrés dans le dossier des exports, jamais écrasés, listés, chemins sûrs, tracés', async () => {
  const { racine, admin } = await nouveauDossier();
  const octets = new TextEncoder().encode('%PDF-1.4 (fictif)');
  const c1 = await admin.exporter('decomptes', 'decompte_fictif.pdf', octets);
  const c2 = await admin.exporter('decomptes', 'decompte_fictif.pdf', octets);
  assert.equal(c1, 'exports/Etablissement/decomptes/decompte_fictif.pdf');
  assert.equal(c2, 'exports/Etablissement/decomptes/decompte_fictif-2.pdf');                 // pas d'écrasement
  assert.ok(racine.e.get('exports').e.get('Etablissement').e.get('decomptes').e.has('decompte_fictif.pdf'));
  // Un sous-dossier par service
  assert.equal(await admin.exporter('decomptes', 'u1.pdf', octets, { service: 'U1', sansTrace: true }), 'exports/U1/decomptes/u1.pdf');
  assert.equal(SIC.model.dossierExportService('../x'), '.._x');
  assert.equal(SIC.model.cheminWindowsExports({ exports: { cheminReseau: '\\\\srv\\partage\\Suivi\\' } }, ['U1']), '\\\\srv\\partage\\Suivi\\exports\\U1');
  const liste = await admin.listerExports();
  assert.deepEqual(liste.map((f) => f.nom).sort(), ['decompte_fictif-2.pdf', 'decompte_fictif.pdf', 'u1.pdf']);
  assert.equal(new TextDecoder().decode(await admin.lireExport(c1)), '%PDF-1.4 (fictif)');
  assert.ok(admin.evts.some((e) => e.type === 'COMPTE' && e.data.action === 'EXPORT' && e.data.libelle === c1));
  // Dossier réglé par l'administrateur, chemins dangereux refusés
  await admin.enregistrer('CONFIG', { cle: 'exports', valeur: { dossier: 'Exports unité/2026' } });
  assert.equal(await admin.exporter('registres', 'registre.csv', octets, { sansTrace: true, service: 'U1' }), 'Exports unité/2026/U1/registres/registre.csv');
  for (const mauvais of ['../hors', 'evenements', 'a/../b', '']) {
    await assert.rejects(admin.dossier.ecrireExport(mauvais, 'x', 'y.csv', octets));
  }
  await assert.rejects(admin.dossier.lireExport('../coffre.json'));
  // Suppression réservée à l'administrateur
  await admin.creerCompte({ nom: 'IDE', login: 'ide', motDePasse: 'autre mot de passe', roles: ['IDE'], services: ['U1'] });
  const ide = await connecter(racine, 'ide', 'autre mot de passe');
  await assert.rejects(ide.supprimerExport(c2), /administrateur/);
  await admin.supprimerExport(c2);
  assert.ok(!racine.e.get('exports').e.get('Etablissement').e.get('decomptes').e.has('decompte_fictif-2.pdf'));
});

test('Exports : purge selon la durée de conservation réglée, simulée puis appliquée, tracée', async () => {
  const { racine, admin } = await nouveauDossier();
  const o = new TextEncoder().encode('fictif');
  const ancien = await admin.exporter('registres', 'ancien.csv', o, { sansTrace: true });
  await admin.exporter('registres', 'recent.csv', o, { sansTrace: true });
  // Le fichier « ancien » date de 100 jours
  racine.e.get('exports').e.get('Etablissement').e.get('registres').e.get('ancien.csv').getFile = async function () { return { size: 6, lastModified: Date.now() - 100 * 864e5, arrayBuffer: async () => o.buffer }; };
  assert.deepEqual(await admin.purgerExports(), []);                               // aucune règle : rien
  await admin.enregistrer('CONFIG', { cle: 'exports', valeur: { dossier: 'exports', conservationJours: 92 } });
  assert.deepEqual((await admin.purgerExports({ simulation: true })).map((f) => f.chemin), [ancien]);
  assert.ok(racine.e.get('exports').e.get('Etablissement').e.get('registres').e.has('ancien.csv'));       // simulation : rien supprimé
  assert.equal((await admin.purgerExports()).length, 1);
  assert.deepEqual([...racine.e.get('exports').e.get('Etablissement').e.get('registres').e.keys()], ['recent.csv']);
  assert.ok(admin.evts.some((e) => e.type === 'COMPTE' && e.data.action === 'PURGE_EXPORTS'));
});

// ------------------------------------------------------ Dossier de secours et déplacement
function compterFichiers(rep, prefixe, res) {
  for (const [n, v] of rep.e) { if (v.kind === 'directory') compterFichiers(v, prefixe + n + '/', res); else res.push(prefixe + n); }
  return res;
}

test('Dossier de secours : copie, travail sur le secours, reprise des saisies au retour', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: Date.now() - 3600e3, csi: true });
  const secoursRep = new Repertoire('Secours');
  const secours = new Dossier(secoursRep, 'reseau');
  assert.equal(await admin.controlerMiroir(secours), 'vide');
  const r1 = await admin.synchroniserMiroir(secours);
  assert.ok(r1.versAutre >= 2);
  assert.equal(r1.coffre, 'vers');
  assert.ok(compterFichiers(secoursRep, '', []).some((c) => c.startsWith('evenements/')));
  assert.equal((await secours.lireEtatMiroir()).role, 'secours');
  assert.equal(await admin.controlerMiroir(secours), 'meme');
  // Le dossier principal est indisponible : on travaille sur le secours
  const surSecours = await connecter(secoursRep, 'admin', 'mot de passe solide');
  assert.ok(surSecours.etat.mesures.M1);
  await surSecours.enregistrer('MESURE_FIN', { mesureId: 'M1', fin: Date.now() }, surSecours.etat.mesures.M1.version);
  // Retour du principal : les saisies faites sur le secours sont reprises, rien n'est écrasé
  const r2 = await admin.synchroniserMiroir(secours);
  assert.ok(r2.depuisAutre >= 1);
  assert.equal(typeof admin.etat.mesures.M1.fin, 'number');
  await admin.synchroniserMiroir(secours);                              // trace de la reprise et repère copiés vers le secours
  const r4 = await admin.synchroniserMiroir(secours);
  assert.equal(r4.versAutre + r4.depuisAutre, 0);                      // plus rien à copier
  // Un dossier contenant d'autres données est refusé
  const autre = await nouveauDossier();
  await assert.rejects(admin.controlerMiroir(new Dossier(autre.racine, 'reseau')), /autres données/);
  await assert.rejects(admin.controlerMiroir(new Dossier(racine, 'reseau')), /dossier des données lui-même|n’est pas vide|autres données/);
});

test('Déplacement des données : copie vérifiée, ancien dossier marqué, nouveau dossier utilisable', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.enregistrer('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: Date.now() - 3600e3, csi: true });
  await admin.exporter('registres', 'registre_U1_2026.csv', new TextEncoder().encode('fictif'), { service: 'U1' });
  const plein = new Repertoire('Plein'); plein.e.set('x.txt', new Fichier('x.txt'));
  await assert.rejects(admin.deplacerDonnees(new Dossier(plein, 'reseau')), /pas vide/);
  const neuf = new Repertoire('Nouveau');
  const n = await admin.deplacerDonnees(new Dossier(neuf, 'reseau'));
  assert.ok(n >= 4);
  assert.ok(compterFichiers(neuf, '', []).some((c) => c.startsWith('exports/')));
  const dep = await new Dossier(racine, 'reseau').lireDeplacement();
  assert.equal(dep.vers, 'Nouveau');
  const s = await connecter(neuf, 'admin', 'mot de passe solide');
  assert.ok(s.etat.mesures.M1);
  assert.ok(s.evts.some((e) => e.type === 'COMPTE' && e.data.action === 'DEPLACEMENT'));
  await assert.rejects(admin.deplacerDonnees(new Dossier(new Repertoire('Encore'), 'reseau')), /déjà été déplacé/);
});

test('Plusieurs dossiers de secours (serveur et copies locales) : état de chacun gardé, saisies hors réseau reprises', async () => {
  const { racine, admin } = await nouveauDossier();
  const serveur = new Dossier(new Repertoire('Secours-serveur'), 'reseau');
  const localA = new Dossier(new Repertoire('Local-A'), 'reseau');
  const localB = new Dossier(new Repertoire('Local-B'), 'reseau');
  await admin.synchroniserMiroir(serveur, { type: 'serveur' });
  await admin.synchroniserMiroir(localA, { type: 'local', poste: 'PC-A (fictif)' });
  await admin.synchroniserMiroir(localB, { type: 'local', poste: 'PC-B (fictif)' });
  const ep = await new Dossier(racine, 'reseau').lireEtatMiroir();
  const liste = Object.values(ep.miroirs);
  assert.equal(liste.length, 3);
  assert.deepEqual(liste.map((x) => x.type).sort(), ['local', 'local', 'serveur']);
  assert.equal((await localA.lireEtatMiroir()).type, 'local');
  // Panne réseau : chaque poste travaille sur sa copie locale
  const surA = await connecter(localA.handle, 'admin', 'mot de passe solide');
  const surB = await connecter(localB.handle, 'admin', 'mot de passe solide');
  await surA.enregistrer('PATIENT', { patientId: 'PA', nom: 'A (fictif)' });
  await surB.enregistrer('PATIENT', { patientId: 'PB', nom: 'B (fictif)' });
  // Retour du réseau : les deux copies sont reprises, l'identifiant de chaque copie est conservé
  const idA = (await localA.lireEtatMiroir()).id;
  await admin.synchroniserMiroir(localA, { type: 'local' });
  await admin.synchroniserMiroir(localB, { type: 'local' });
  assert.ok(admin.etat.patients.PA && admin.etat.patients.PB);
  assert.equal((await localA.lireEtatMiroir()).id, idA);
  assert.equal(Object.keys((await new Dossier(racine, 'reseau').lireEtatMiroir()).miroirs).length, 3);
  await new Dossier(racine, 'reseau').oublierMiroir(idA);
  assert.equal(Object.keys((await new Dossier(racine, 'reseau').lireEtatMiroir()).miroirs).length, 2);
});

test('Vérification d’un administrateur (déblocage du choix du dossier) sans ouvrir de session', async () => {
  const { racine, admin, code } = await nouveauDossier();
  await admin.creerCompte({ nom: 'IDE (fictif)', login: 'ide', motDePasse: 'mot de passe ide', roles: ['IDE'], services: ['U1'] });
  const d = new Dossier(racine, 'reseau');
  assert.equal(await Session.verifierAdministrateur(d, 'admin', 'mot de passe solide'), 'Admin');
  await assert.rejects(Session.verifierAdministrateur(d, 'admin', 'faux'), /incorrect/);
  await assert.rejects(Session.verifierAdministrateur(d, 'ide', 'mot de passe ide'), /pas un compte administrateur/);
  assert.equal(await Session.verifierAdministrateur(d, '', code), 'code de secours');
  await assert.rejects(Session.verifierAdministrateur(d, '', 'AAAA-BBBB-CCCC-DDDD-EEEE'), /Code de secours incorrect/);
});

test('Lecture d’une saisie en échec passager : relue à la synchronisation suivante, sans rester signalée illisible', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.enregistrer('PATIENT', { patientId: 'P1', nom: 'P1 (fictif)' });
  // Un autre poste se connecte pendant que le fichier est momentanément illisible (réseau, synchronisation…)
  const mois = racine.e.get('evenements');
  const fichiers = [];
  (function parcourir(rep) { for (const v of rep.e.values()) { if (v.kind === 'directory') parcourir(v); else fichiers.push(v); } })(mois);
  const cible = fichiers.find((f) => /\.enc$/.test(f.name) && f.data.length > 0);
  const getFile = cible.getFile.bind(cible);
  let panne = true;
  cible.getFile = async () => { if (panne) throw Object.assign(new Error('fichier verrouillé'), { name: 'NotReadableError' }); return getFile(); };
  const poste = await connecter(racine, 'admin', 'mot de passe solide');
  assert.equal(poste.rejetes.length, 1);
  assert.match(poste.rejetes[0].raison, /lecture refusée par le système/);
  panne = false;
  await poste.synchroniser();
  assert.equal(poste.rejetes.length, 0);
  assert.ok(poste.etat.patients.P1);
  const r = await poste.verifierIntegrite();
  assert.equal(r.fichiersIllisibles.length, 0);
});

test('Aperçu de l’affichage d’un rôle : droits et services du rôle, aucune saisie enregistrée, réservé à l’administrateur', async () => {
  const { racine, admin } = await nouveauDossier();
  await admin.enregistrer('CONFIG', { cle: 'services', valeur: [{ code: 'A', libelle: 'A (fictif)' }, { code: 'B', libelle: 'B (fictif)' }] });
  assert.ok(admin.peut('CONFIG'));
  admin.definirApercu('SECRETAIRE');
  assert.ok(admin.peut('JLD') && !admin.peut('MESURE_DEBUT') && !admin.peut('CONFIG'));
  admin.definirApercu('IDE');
  assert.deepEqual(admin.roles(), ['IDE']);
  assert.ok(admin.peut('MESURE_DEBUT'));
  assert.ok(!admin.peut('CONFIG'));
  assert.deepEqual(admin.mesServices(), ['A', 'B']);
  assert.deepEqual(admin.utilisateur.roles, ['CADRE', 'ADMIN']);   // le compte réel n'est pas modifié
  const n = admin.evts.length;
  await assert.rejects(admin.enregistrer('PATIENT', { patientId: 'p1', nom: 'X (fictif)' }), /Aperçu.*aucune saisie/);
  await assert.rejects(admin.enregistrer('CONFIG', { cle: 'inactiviteMinutes', valeur: 5 }), /aucune saisie/);
  assert.equal(admin.evts.length, n);
  assert.throws(() => admin.definirApercu('ADMIN'), /inconnu/);
  admin.definirApercu(null);
  assert.ok(admin.peut('CONFIG'));
  await admin.creerCompte({ nom: 'IDE (fictif)', login: 'ide', motDePasse: 'autre mot de passe', roles: ['IDE'], services: ['A'] });
  const ide = await connecter(racine, 'ide', 'autre mot de passe');
  assert.throws(() => ide.definirApercu('CADRE'), /administrateur/);
  admin.definirApercu('CADRE'); admin.verrouiller();
  assert.equal(admin.apercu, null);
});
