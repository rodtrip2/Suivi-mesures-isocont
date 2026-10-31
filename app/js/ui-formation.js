// SPDX-License-Identifier: EUPL-1.2
/*
 * Mode formation : le formateur bascule provisoirement un poste de travail sur le jeu de
 * données fictives (sous-dossier « formation » du dossier réseau). Tant que la bascule est
 * active, chaque connexion sur ce poste ouvre le jeu de formation, avec les vrais comptes.
 * La bascule s'arrête à l'heure choisie, par le formateur, ou depuis l'écran de connexion.
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, h = U.h;
  var CLE_REGLAGE = 'formation';

  /** État de la bascule de ce poste pour le dossier ouvert, ou null (expirée ou absente). */
  async function etatPoste() {
    var r = await SIC.Dossier.lireReglage(CLE_REGLAGE);
    if (!r || !U.App.dossier || r.dossier !== U.App.dossier.nom) return null;
    if (Date.now() > r.jusqua) { await SIC.Dossier.ecrireReglage(CLE_REGLAGE, null); return null; }
    return r;
  }

  function finDeJournee() { var d = new Date(); d.setHours(23, 59, 0, 0); return d.getTime(); }
  var heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

  U.formation = {
    etatPoste: etatPoste,

    /** À appeler après une connexion : ouvre le jeu de formation si le poste est basculé. */
    appliquerApresConnexion: async function () {
      var r = await etatPoste();
      U.App.posteFormation = r;
      if (!r) return;
      try { await U.App.session.ouvrirFormation(); }
      catch (e) {
        await SIC.Dossier.ecrireReglage(CLE_REGLAGE, null); U.App.posteFormation = null;
        U.toast('Mode formation impossible : ' + e.message + ' Données réelles ouvertes.');
      }
    },

    /** Bandeau affiché en haut de l'application et de l'écran de connexion. */
    bandeau: function (surConnexion) {
      var r = U.App.posteFormation;
      if (!(surConnexion ? r : U.App.session && U.App.session.formation)) return null;
      var texte = surConnexion
        ? 'Poste en MODE FORMATION' + (r ? ' jusqu’à ' + heure.format(r.jusqua) + ' (activé par ' + r.par + ')' : '') + ' : les connexions ouvrent le jeu de données fictives.'
        : 'MODE FORMATION — données fictives' + (r ? ', jusqu’à ' + heure.format(r.jusqua) : '') + '. Ne saisissez aucune donnée réelle.';
      var bouton = surConnexion
        ? h('button', { class: 'btn petit', onclick: async function () { await SIC.Dossier.ecrireReglage(CLE_REGLAGE, null); U.App.posteFormation = null; U.demarrer(); } }, 'Revenir aux données réelles')
        : (U.App.session.estFormateur() ? h('button', { class: 'btn petit', onclick: U.formation.quitter }, 'Quitter le mode formation') : null);
      return h('div', { class: 'bandeau-formation', role: 'status' }, h('span', { text: texte }), bouton);
    },

    /** Vérification périodique : fin de la bascule à l'heure prévue. */
    verifierExpiration: async function () {
      var s = U.App.session;
      if (!s || !s.formation) return;
      if (!(await etatPoste())) {
        U.App.posteFormation = null;
        U.verrouiller('Fin du mode formation : le poste est revenu aux données réelles.');
      }
    },

    quitter: async function () {
      var s = U.App.session;
      await SIC.Dossier.ecrireReglage(CLE_REGLAGE, null);
      U.App.posteFormation = null;
      await s.fermerFormation();
      await s.tracer('FORMATION_FIN', {});
      U.toast('Poste revenu aux données réelles.');
      U.demarrer();
    },

    /** Fenêtre du formateur : créer ou régénérer le jeu, basculer le poste. */
    ouvrir: function () {
      var s = U.App.session, jeu = s.jeuFormation();
      var duree = h('select', {},
        h('option', { value: '1', text: '1 heure' }), h('option', { value: '2', text: '2 heures' }),
        h('option', { value: '4', text: '4 heures', selected: true }), h('option', { value: '8', text: '8 heures' }),
        h('option', { value: 'jour', text: 'Jusqu’à la fin de la journée' }));
      var etat = h('div', { class: 'recap' },
        jeu ? h('div', { text: 'Jeu de formation créé le ' + U.date(Date.parse(jeu.creeLe)) + ' par ' + jeu.par + '.' })
            : h('div', { text: 'Aucun jeu de formation pour l’instant.' }),
        h('div', { text: 'Il reprend les services, chambres de soins intensifs et postes de surveillance réels, avec des patients et des mesures fictifs (échéances JLD en cours, registre, statistiques).' }));

      async function creer() {
        var saisies = SIC.donneesFictives({ config: s.etat.config });
        await s.creerFormation(saisies, 'Jeu de formation (données fictives)');
      }
      var boutons = [{ texte: 'Fermer' }];
      boutons.push({ texte: jeu ? 'Régénérer les données fictives' : 'Créer le jeu de formation', action: async function () {
        if (jeu && !confirm('Effacer le jeu de formation actuel (y compris les saisies des stagiaires) et en recréer un neuf ?')) return false;
        await creer();
        U.toast('Jeu de formation ' + (jeu ? 'régénéré' : 'créé') + '.');
        setTimeout(U.formation.ouvrir, 0);
        return true;
      } });
      boutons.push({ texte: 'Basculer ce poste en formation', classe: 'primaire', action: async function () {
        if (!s.jeuFormation()) await creer();
        var jusqua = duree.value === 'jour' ? finDeJournee() : Date.now() + (+duree.value) * 3600000;
        var r = { jusqua: jusqua, par: s.utilisateur.nom, dossier: U.App.dossier.nom };
        await SIC.Dossier.ecrireReglage(CLE_REGLAGE, r);
        U.App.posteFormation = r;
        await s.tracer('FORMATION_ACTIVE', { jusqua: new Date(jusqua).toISOString() });
        await s.ouvrirFormation();
        U.toast('Poste en mode formation jusqu’à ' + heure.format(jusqua) + '.');
        return true;
      } });

      U.modale('Mode formation', h('div', { class: 'pile' },
        h('p', { text: 'Le mode formation bascule ce poste de travail sur un jeu de données entièrement fictif, rangé à part sur le réseau. Les agents s’y connectent avec leur compte habituel : ils retrouvent leurs rôles et leurs services, et peuvent tout essayer sans toucher aux données réelles.' }),
        etat,
        h('label', {}, 'Durée de la bascule de ce poste', duree),
        h('ul', { class: 'vigilance' },
          h('li', { text: 'Un bandeau violet signale le mode formation sur tous les écrans.' }),
          h('li', { text: 'Dans le jeu de formation, le formateur dispose aussi des droits IDE, secrétaire et cadre, sur tous les services.' }),
          h('li', { text: 'Les comptes et les mots de passe restent les vrais : un changement de mot de passe fait en formation vaut aussi pour les données réelles.' }),
          h('li', { text: 'Le poste revient aux données réelles à l’heure prévue, avec le bouton « Quitter le mode formation », ou depuis l’écran de connexion.' }))), boutons);
    }
  };
})();
