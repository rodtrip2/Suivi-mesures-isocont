// SPDX-License-Identifier: EUPL-1.2
/*
 * Blocage du choix du dossier sur les postes (demande du porteur). Option de l'établissement `config.verrouDossier`
 * (Administration → Comptes et sécurité, désactivée par défaut) : à chaque connexion, le poste retient les données de travail
 * comme verrouillées (IndexedDB `verrou` : nom du dossier et date de création du coffre). Ensuite, seul un dossier
 * contenant LES MÊMES DONNÉES peut être ouvert sans formalité (dossier habituel, dossier de secours, copie locale,
 * nouveau dossier après un déplacement) ; ouvrir d'autres données ou le mode démonstration demande l'identifiant et
 * le mot de passe d'un administrateur (ou le code de secours), vérifiés sur le coffre des données verrouillées.
 * Contrainte d'organisation : effacer les données du site dans le navigateur lève aussi le verrou (service informatique).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;

  /** Après la connexion : pose ou retire le verrou de ce poste selon le réglage de l'établissement. */
  async function appliquer() {
    var s = U.App.session;
    if (!s || !s.etat || s.formation || U.App.dossier.mode !== 'reseau' || U.App.secours) return;
    try {
      if (s.etat.config.verrouDossier === true) await SIC.Dossier.ecrireVerrou({ nom: U.App.dossier.nom, creeLe: s.coffre.creeLe, le: new Date().toISOString(), par: s.utilisateur ? s.utilisateur.nom : '' });
      else if (await SIC.Dossier.lireVerrou()) await SIC.Dossier.ecrireVerrou(null);
    } catch (e) { /* réglage du poste indisponible : sans effet sur la session */ }
  }

  /**
   * Fenêtre de déblocage : vérifie un administrateur sur le coffre de `dossier` (dossier verrouillé ou sa copie
   * locale). Résout avec le nom de l'administrateur, ou null si la fenêtre est fermée.
   */
  function demanderAdministrateur(dossier, motif) {
    var login = h('input', { type: 'text', autocomplete: 'off' }), mdp = h('input', { type: 'password', autocomplete: 'off' });
    var parCode = h('input', { type: 'checkbox' });
    var blocLogin = h('label', {}, 'Identifiant de l’administrateur', login);
    var lblSecret = h('label', {}, 'Mot de passe', mdp);
    parCode.addEventListener('change', function () { blocLogin.hidden = parCode.checked; lblSecret.firstChild.textContent = parCode.checked ? 'Code de secours' : 'Mot de passe'; mdp.type = parCode.checked ? 'text' : 'password'; });
    return U.modale('Déblocage par un administrateur', h('div', { class: 'pile' },
      h('p', { text: motif + ' Le choix du dossier est bloqué sur ce poste par l’établissement (dossier « ' + dossier.nom + ' ») : un administrateur doit le débloquer.' }),
      blocLogin, lblSecret,
      h('label', { class: 'case' }, parCode, h('span', { text: 'Utiliser le code de secours' }))), [
      { texte: 'Annuler' },
      { texte: 'Débloquer', classe: 'primaire', action: async function () {
        if (!mdp.value) throw new Error(parCode.checked ? 'Saisissez le code de secours.' : 'Saisissez le mot de passe.');
        if (!parCode.checked && !login.value.trim()) throw new Error('Saisissez l’identifiant.');
        return await SIC.Session.verifierAdministrateur(dossier, parCode.checked ? '' : login.value, mdp.value);
      } }], { focus: login });
  }

  /** Dossier où vérifier l'administrateur : dossier retenu, sinon copie locale du poste (mêmes données). */
  async function dossierDeReference() {
    var cible = null, prec = await SIC.Dossier.precedent();
    if (prec && prec.handle) { try { cible = await SIC.Dossier.rouvrir(prec); if (!(await cible.lireCoffre())) cible = null; } catch (e) { cible = null; } }
    if (!cible) { try { cible = await SIC.Dossier.ouvrirLocal(); } catch (e) { cible = null; } }
    return cible;
  }

  /** Lève le verrou de ce poste après vérification d'un administrateur. Retourne vrai si débloqué. */
  async function debloquer(motif) {
    var v = await SIC.Dossier.lireVerrou();
    if (!v) return true;
    var cible = await dossierDeReference();
    if (!cible) throw new Error('Le dossier verrouillé (« ' + v.nom + ' ») et la copie locale de ce poste sont inaccessibles : le déblocage n’est pas possible pour le moment. Réessayez quand le réseau est revenu, ou demandez au service informatique (procédures de secours, document 04).');
    var nom = await demanderAdministrateur(cible, motif || '');
    if (!nom) return false;
    await SIC.Dossier.ecrireVerrou(null);
    U.toast('Choix du dossier débloqué par ' + nom + ' sur ce poste. Le blocage reprendra à la prochaine connexion si l’établissement l’a activé.');
    return true;
  }

  /**
   * Ouvre un dossier choisi par l'agent alors que le poste est verrouillé : accepté sans formalité s'il contient les
   * mêmes données (même coffre d'origine) ; sinon, déblocage par un administrateur. Un dossier de secours n'est pas
   * retenu comme dossier habituel (« Reprendre » garde le dossier principal).
   */
  async function ouvrirMemesDonnees() {
    var v = await SIC.Dossier.lireVerrou();
    var d = await SIC.Dossier.choisirAutre('sic-dossier');
    var c = await d.lireCoffre();
    if (v && (!c || c.creeLe !== v.creeLe)) {
      if (!(await debloquer('Le dossier « ' + d.nom + ' » ne contient pas les données de ce poste.'))) { var e = new Error('annulé'); e.name = 'AbortError'; throw e; }
    }
    var em = null; try { em = await d.lireEtatMiroir(); } catch (er) { /* sans état */ }
    if (!(em && em.role === 'secours')) await d.retenir();
    return d;
  }

  /** Réglage d'administration (sous-onglet Comptes et sécurité). */
  function panneau() {
    var cfg = U.config(), cb = h('input', { type: 'checkbox', checked: cfg.verrouDossier === true }), etat = h('small', { class: 'muted' });
    SIC.Dossier.lireVerrou().then(function (v) { etat.textContent = 'Ce poste : ' + (v ? 'choix bloqué sur « ' + v.nom + ' » depuis le ' + U.date(Date.parse(v.le)) : 'choix libre'); }).catch(function () {});
    return h('section', { class: 'panneau' }, h('h2', { text: 'Choix du dossier sur les postes' }),
      h('p', { class: 'muted', text: 'Une fois le dossier de travail ouvert sur un poste, empêcher d’y ouvrir d’autres données (autre dossier, dossier personnel, mode démonstration). Le blocage est posé sur chaque poste à la connexion suivante. Restent possibles sans formalité les dossiers contenant les mêmes données : dossier habituel, dossier de secours, copie locale d’un poste désigné, nouveau dossier après un déplacement. Pour autre chose, un administrateur débloque le poste (identifiant et mot de passe, ou code de secours) depuis l’écran d’accueil. Il s’agit d’une règle d’organisation : le service informatique peut toujours lever le blocage en effaçant les données du site dans le navigateur.' }),
      h('label', { class: 'case' }, cb, h('span', { text: 'Bloquer le changement de dossier sur les postes (déblocage par un administrateur)' })),
      etat,
      U.boutonEnregistrer(async function () {
        await U.enregistrerConfig([['verrouDossier', cb.checked]]);
        await appliquer();
        var v = await SIC.Dossier.lireVerrou();
        etat.textContent = 'Ce poste : ' + (v ? 'choix bloqué sur « ' + v.nom + ' »' : 'choix libre');
      }));
  }

  U.verrou = { appliquer: appliquer, debloquer: debloquer, ouvrirMemesDonnees: ouvrirMemesDonnees, panneau: panneau, demanderAdministrateur: demanderAdministrateur };
})();
