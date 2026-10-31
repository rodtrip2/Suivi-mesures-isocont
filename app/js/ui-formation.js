// SPDX-License-Identifier: EUPL-1.2
/*
 * Mode formation : à la connexion, chaque agent dont l'accès n'a pas été désactivé par
 * l'administrateur choisit entre les données réelles et le jeu de formation (données
 * fictives, sous-dossier « formation » du dossier réseau, chiffré à part). Il y retrouve
 * son compte, ses rôles et ses services. L'administrateur peut régénérer le jeu.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, h = U.h;

  function generer(config) { return SIC.donneesFictives({ config: config }); }

  U.formation = {
    /** Champ de choix affiché sur l'écran de connexion. */
    choixConnexion: function () {
      var reel = h('input', { type: 'radio', name: 'jeu', value: 'reel', checked: true });
      var form = h('input', { type: 'radio', name: 'jeu', value: 'formation' });
      var bloc = h('fieldset', { class: 'choix-jeu' }, h('legend', { text: 'Ouvrir' }),
        h('label', { class: 'case' }, reel, h('span', {}, h('b', { text: 'Données réelles' }))),
        h('label', { class: 'case formation' }, form, h('span', {}, h('b', { text: 'Mode formation' }), ' — données fictives, pour s’entraîner ou tester'))) ;
      bloc.valeur = function () { return form.checked ? 'formation' : 'reel'; };
      return bloc;
    },

    /** Après authentification : ouvre le jeu choisi. */
    appliquerChoix: async function (choix) {
      if (choix !== 'formation') return;
      var s = U.App.session;
      if (!s.accesFormation()) { s.verrouiller(); throw new Error('L’accès au mode formation est désactivé pour votre compte. Choisissez « Données réelles » ou contactez l’administrateur.'); }
      try { await s.ouvrirFormation(generer); }
      catch (e) { s.verrouiller(); throw new Error('Mode formation indisponible : ' + e.message); }
    },

    /** Bandeau affiché en haut de chaque écran pendant le mode formation. */
    bandeau: function () {
      var s = U.App.session;
      if (!s || !s.formation) return null;
      return h('div', { class: 'bandeau-formation', role: 'status' },
        h('span', { text: 'MODE FORMATION — données fictives. Ne saisissez aucune donnée réelle.' }),
        h('button', { class: 'btn petit', onclick: U.formation.quitter }, 'Passer aux données réelles'));
    },

    quitter: async function () {
      await U.App.session.fermerFormation();
      U.toast('Données réelles ouvertes.');
      U.demarrer();
    },

    /** Section de l'onglet Administration (données réelles uniquement). */
    sectionAdmin: function () {
      var s = U.App.session, jeu = s.jeuFormation();
      var avec = s.comptes.filter(function (c) { return c.actif && SIC.model.accesFormation(c); }).length;
      var actifs = s.comptes.filter(function (c) { return c.actif; }).length;
      return h('section', { class: 'panneau' }, h('h2', { text: 'Mode formation' }),
        h('p', { class: 'muted', text: 'À la connexion, chaque agent choisit entre les données réelles et le mode formation. Le jeu de formation reprend les services, chambres de soins intensifs et postes de surveillance réels, avec des patients et des mesures fictifs ; il est chiffré à part dans le sous-dossier « formation ». L’accès se désactive compte par compte (bouton « Modifier »).' }),
        h('div', { class: 'recap' },
          h('div', { text: jeu ? 'Jeu de formation créé le ' + U.date(Date.parse(jeu.creeLe)) + ' par ' + jeu.par + '.' : 'Le jeu de formation sera créé à la première connexion en mode formation.' }),
          h('div', { text: avec + ' compte(s) actif(s) sur ' + actifs + ' ont accès au mode formation.' })),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: async function () {
          if (jeu && !confirm('Effacer le jeu de formation actuel (y compris les saisies des stagiaires) et en recréer un neuf ?')) return;
          try { await s.creerFormation(generer(s.etat.config), 'Jeu de formation (données fictives)'); U.toast('Jeu de formation ' + (jeu ? 'régénéré' : 'créé') + '.'); U.rendreContenu(); }
          catch (e) { alert(e.message); }
        } }, jeu ? 'Régénérer les données fictives' : 'Créer le jeu de formation maintenant')));
    }
  };
})();
