// SPDX-License-Identifier: EUPL-1.2
/* Administration → À propos : licence, crédits, code source, signalement d'un problème ou demande d'amélioration. */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, h = U.h;
  var DEPOT = 'https://github.com/rodtrip2/Suivi-mesures-isocont';
  var EUPL_FR = 'https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12';

  function lien(url, texte, classe) {
    return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: classe || null }, texte);
  }
  function urlSignalement(modele) {
    return DEPOT + '/issues/new?template=' + modele + '&version=' + encodeURIComponent(SIC.VERSION);
  }

  function panneau() {
    var infosTech = 'Version ' + SIC.VERSION + ' — navigateur : ' + navigator.userAgent;
    var copie = h('button', { class: 'btn', type: 'button', onclick: async function () {
      try { await navigator.clipboard.writeText(infosTech); U.toast('Informations copiées : collez-les dans votre signalement.'); }
      catch (e) { U.toast('Copie impossible : recopiez la version ' + SIC.VERSION + '.'); }
    } }, 'Copier la version et le navigateur');

    return [
      h('section', { class: 'panneau' }, h('h2', { text: 'Suivi des mesures d’isolement et de contention' }),
        h('p', { text: 'Version ' + SIC.VERSION + '. Outil de suivi des durées, des communications au juge des libertés et de la détention, du registre et des statistiques des mesures d’isolement et de contention (article L. 3222-5-1 du code de la santé publique).' }),
        h('p', { class: 'muted', text: 'L’outil ne constitue pas un dispositif médical et ne remplace ni le dossier patient informatisé, ni la prescription médicale, ni le jugement des professionnels.' })),

      h('section', { class: 'panneau' }, h('h2', { text: 'Licence' }),
        h('p', {}, 'Logiciel libre distribué sous la ', h('b', { text: 'Licence publique de l’Union européenne (EUPL) version 1.2' }),
          '. Vous pouvez l’utiliser, l’étudier, le modifier et le redistribuer, y compris dans un autre établissement ; une version modifiée et redistribuée doit rester sous la même licence (ou une licence compatible) et son code source rester accessible.'),
        h('p', { class: 'muted', text: 'Le logiciel est fourni « en l’état », sans garantie ni responsabilité de ses auteurs (articles 7 et 8 de l’EUPL). Chaque établissement reste responsable de son déploiement, de son paramétrage et de la validation des règles par sa direction, sa DSI et son DPO.' }),
        h('p', {}, '© 2026 Roddy Ricart et les contributeurs du projet — droits d’auteur, logiciel distribué sous licence EUPL 1.2. ', lien(EUPL_FR, 'Texte officiel de l’EUPL 1.2 en français'), ' — fichiers LICENSE et NOTICE du dépôt.')),

      h('section', { class: 'panneau' }, h('h2', { text: 'Crédits' }),
        h('ul', { class: 'liste-credits' },
          h('li', {}, h('b', { text: 'Conception et pilotage : ' }), 'Roddy Ricart, faisant fonction cadre de santé (CHHA, pôle santé mentale, UHP). Projet réalisé sur son temps libre, à partir du classeur de suivi utilisé dans son service.'),
          h('li', {}, h('b', { text: 'Développement : ' }), 'réalisé avec l’assistance de Claude, assistant d’intelligence artificielle d’Anthropic.'),
          h('li', {}, h('b', { text: 'Contributeurs : ' }), 'toute personne ayant proposé une correction ou une amélioration — liste sur la page du projet.'),
          h('li', {}, h('b', { text: 'Références : ' }), 'article L. 3222-5-1 du code de la santé publique ; instruction ministérielle du 29 mars 2022 ; recommandations de la HAS (2017) sur l’isolement et la contention en psychiatrie générale.'),
          h('li', {}, h('b', { text: 'Composants tiers : ' }), 'aucun. L’application est écrite en HTML, CSS et JavaScript, sans bibliothèque externe ni service en ligne.'))),

      h('section', { class: 'panneau' }, h('h2', { text: 'Code source, signalements et suggestions' }),
        h('p', {}, 'Le code source, la documentation et le kit de déploiement sont publics : ', lien(DEPOT, 'github.com/rodtrip2/Suivi-mesures-isocont'), '.'),
        h('div', { class: 'alerte' }, h('b', { text: 'Aucune donnée réelle dans un signalement. ' }),
          'Les signalements sont publics : n’y mettez jamais de nom, d’IPP, de date de naissance, de capture d’écran de données réelles ni de nom d’agent. Reproduisez le problème en mode démonstration ou formation, avec des données fictives.'),
        h('div', { class: 'actions gauche' },
          lien(urlSignalement('signaler-un-probleme.yml'), 'Signaler un problème', 'btn primaire'),
          lien(urlSignalement('demande-amelioration.yml'), 'Demander une amélioration', 'btn'),
          copie),
        h('small', { class: 'muted', text: 'Les liens s’ouvrent dans un nouvel onglet sur GitHub (compte gratuit nécessaire) et demandent un accès à Internet, souvent indisponible depuis le réseau de l’hôpital : faites alors le signalement depuis un autre poste, en notant la version (' + SIC.VERSION + '). L’outil lui-même n’envoie jamais aucune donnée.' }))
    ];
  }

  /** Fenêtre « À propos », accessible à tous les agents depuis l'en-tête. */
  function modale() {
    U.modale('À propos', h('div', { class: 'pile' }, panneau()), [{ texte: 'Fermer' }], { large: true });
  }

  U.apropos = { panneau: panneau, modale: modale, DEPOT: DEPOT };
})();
