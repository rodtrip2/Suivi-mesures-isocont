# Guide utilisateur

*Suivi des mesures d'isolement et de contention — à lire en 10 minutes.*

## Se connecter

1. Ouvrir le lien de l'application (Edge ou Chrome).
2. Cliquer *Reprendre* (ou, la première fois, *Ouvrir le dossier réseau du service* et choisir le dossier indiqué par votre cadre). Autoriser l'accès si le navigateur le demande.
3. Saisir votre identifiant et le mot de passe de votre fiche de remise.
4. **Première connexion** (ou après une réinitialisation) : l'application vous demande aussitôt de choisir votre mot de passe personnel, d'au moins 12 caractères. Une courte phrase de quelques mots est facile à retenir. Vous pouvez le changer ensuite à tout moment avec le bouton *Mot de passe*.
5. Vous ne voyez que les services qui vous sont affectés. La session se verrouille seule après quelques minutes sans activité ; pensez à *Verrouiller* en quittant le poste.

## Les couleurs des échéances

| Couleur | Signification |
| --- | --- |
| Vert | Dans les temps |
| Jaune | Échéance dans moins de 12 h |
| Rouge | Échéance dépassée |
| Bleu | Fait à temps |
| Violet | Fait hors délai |
| Gris | Sans objet (mesure terminée avant l'échéance) |

## IDE et aides-soignants (AS)

IDE et AS disposent des mêmes droits.

**Nouvelle mesure** (onglet *Mesures → + Nouvelle mesure*) : vous reportez la décision du psychiatre.
- Choisir le patient (ou *+ Nouveau patient* avec son IPP : si l'IPP existe déjà, l'outil propose sa fiche).
- Vérifier le mode d'hospitalisation.
- Type, date et heure **de la décision**, psychiatre, lieu.
- Pour une contention en chambre de soins intensifs sans isolement en cours, l'outil propose de créer aussi l'isolement : laissez la case cochée.

**Fin de mesure** : bouton *Fin* sur la ligne, avec la date, l'heure et le psychiatre qui a décidé l'arrêt. Une mainlevée du juge ne termine pas la mesure : c'est toujours la décision médicale qui y met fin.

**Changement de lieu** (de CSI vers une chambre, par exemple) : *Détail → Changer de lieu…*. Pour une simple erreur de saisie, demandez une correction à votre cadre.

**Information du tiers** : bouton *Tiers*. Indiquez le résultat (informé, tentative sans succès, pas de tiers, refus du patient…), la qualité du tiers et qui l'a informé : le psychiatre, ou vous-même en dernier recours. À renouveler à chaque nouveau cycle JLD.

**Surveillance en CSI** : onglet *Surveillance CSI*. Deux emplacements par poste ; complétez les noms et fonctions des professionnels présents. Ces informations alimentent le registre.

**Envois JLD le week-end** ou en l'absence du secrétariat : voir ci-dessous.

## Secrétariat

Onglet *JLD* : les mesures en cours, triées par urgence.
- *Saisir un envoi* : information du JLD, saisine, ou décision reçue (maintien ou mainlevée), avec la date et l'heure réelles.
- Une décision de **maintien** ouvre automatiquement le cycle suivant ; pensez au tiers, qui doit être informé de ce renouvellement.
- *Décompte* (onglet *Mesures*) : document à joindre à la communication. Choisissez « Enregistrer au format PDF » comme imprimante pour obtenir un PDF.

## Cadre de santé

- **Tableau de bord** : échéances, tiers à renseigner, postes de surveillance incomplets, points de vigilance (patient en soins libres, mineur, cumul élevé), saisies en conflit.
- **Patients** : cumuls sur 48 h et 15 jours, niveau de vigilance, mode d'hospitalisation et son historique.
- **Corrections** : *Détail → Corriger…* (motif obligatoire) ; *Annuler* une saisie erronée dans le détail. Tout reste visible dans le journal.
- **Conflits** : *Journal → Saisies en conflit à arbitrer*.
- **Registre anonymisé** : par service et par année, imprimable et exportable.
- **Statistiques** : rapport annuel comparé à l'année précédente. Saisissez le nombre de patients en hospitalisation complète et sous contrainte (chiffres du DIM) pour obtenir les pourcentages.

## Formateur — mode formation

Le mode formation bascule **provisoirement un poste de travail** sur un jeu de données entièrement fictif, rangé à part sur le réseau. Il sert à former les équipes et à tester l'outil sans toucher aux données réelles.

1. Connectez-vous avec votre compte (rôle *Formateur*), puis cliquez *Mode formation* en haut de l'écran.
2. La première fois, *Créer le jeu de formation* : il reprend les services, chambres de soins intensifs et postes de surveillance réels, avec des patients et des mesures fictifs (échéances JLD en cours, registre, statistiques). *Régénérer les données fictives* efface le jeu et en recrée un neuf, par exemple avant chaque session.
3. Choisissez la durée (1 à 8 heures ou jusqu'à la fin de la journée), puis *Basculer ce poste en formation*.
4. Un **bandeau violet** s'affiche sur tous les écrans. Chaque agent qui se connecte sur ce poste ouvre le jeu de formation avec **son compte habituel**, ses rôles et ses services. Une première connexion avec un mot de passe provisoire peut donc se faire pendant la formation : le mot de passe choisi est le vrai.
5. Dans le jeu de formation, le formateur dispose aussi des droits IDE, secrétaire et cadre, sur tous les services, pour faire les démonstrations.
6. Le poste revient aux données réelles à l'heure prévue, avec *Quitter le mode formation*, ou depuis l'écran de connexion (*Revenir aux données réelles*, accessible à tous en cas de besoin urgent du poste).

La bascule est mémorisée par le navigateur de la session Windows en cours. Si chaque agent ouvre sa propre session Windows sur le poste, activez le mode formation dans chacune, ou utilisez une session commune pour la formation.

## Administrateur

Comptes (rôles et services affectés), clés de sécurité, code de secours, paramétrage, import du classeur Excel : voir le guide d'installation et les procédures de secours.

## En cas de problème

- *Dossier inaccessible* ou application indisponible : appliquez la procédure dégradée papier, puis ressaisissez avec les heures réelles.
- *Mot de passe oublié* : demandez une réinitialisation à l'administrateur ; il vous remettra un mot de passe provisoire, à remplacer dès la connexion.
- *Erreur de saisie* : prévenez votre cadre, qui corrige avec un motif tracé.
