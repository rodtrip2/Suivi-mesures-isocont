# Journal des versions

## 1.3.1 — 31 octobre 2026

- Nouvelle mesure : **date de naissance obligatoire** pour un nouveau patient, demandée aussi quand elle manque dans une fiche existante (patients importés).
- **Alertes en rouge sous les champs concernés**, recalculées pendant la saisie : patient mineur, patient en soins libres, « SL mineur » incohérent avec l'âge, mesure du même type déjà en cours, cumul élevé sur 15 jours, protection juridique, IPP déjà attribué, saisie tardive ou dans le futur, contention hors espace d'isolement, service sans CSI paramétrée.
- Patients fictifs (démonstration, formation) avec date de naissance, dont un mineur.

## 1.3.0 — 31 octobre 2026

Le mode formation est revu : il remplace le rôle Formateur et la bascule de poste de la version 1.2.0.

- **Accès au mode formation** accordé à tous les comptes, **désactivable par l'administrateur** compte par compte (fiche du compte, création en lot).
- **Choix à la connexion** entre *Données réelles* et *Mode formation* ; l'agent garde son compte, ses rôles et ses services dans les deux.
- Jeu de formation créé automatiquement à la première connexion en mode formation, à partir du paramétrage réel ; régénération réservée à l'administrateur.
- Bouton *Passer aux données réelles* dans le bandeau violet.
- Suppression du rôle Formateur et de la bascule de poste.

## 1.2.0 — 31 octobre 2026

- **Rôle Formateur**, sans droit sur les données réelles par ce seul rôle.
- **Mode formation** : le formateur bascule provisoirement un poste (1 à 8 h ou jusqu'à la fin de la journée) sur un jeu de données fictives, rangé dans le sous-dossier `formation` du partage et chiffré avec sa propre clé (conservée chiffrée dans le coffre réel).
- Le jeu de formation reprend les services, CSI et postes de surveillance réels, avec patients et mesures fictifs ; il peut être régénéré à tout moment.
- Les agents s'y connectent avec leur vrai compte, rôles et services ; le formateur y dispose aussi des droits IDE, secrétaire et cadre sur tous les services.
- Bandeau violet sur tous les écrans, retour aux données réelles à l'heure prévue, par le formateur ou depuis l'écran de connexion.
- Les traces de comptes restent dans le journal réel ; l'administration des comptes et l'import sont indisponibles en formation.
- Un dossier sans coffre (jeu de formation ouvert par erreur, coffre perdu) n'est plus jamais proposé à l'initialisation.

## 1.1.0 — 30 octobre 2026

- **Rôle aide-soignant(e) (AS)**, avec les mêmes droits que l'IDE.
- **Création de comptes en lot** à partir d'une liste d'agents collée depuis un tableur ou d'un fichier CSV : identifiants proposés (prenom.nom), rôles et services par ligne ou par défaut, aperçu des erreurs avant création, une seule écriture du coffre.
- **Mots de passe provisoires** tirés au hasard, **changement obligatoire à la première connexion** (et après une réinitialisation) ; le nouveau mot de passe doit différer du provisoire.
- **Réinitialisation par l'administrateur** en cas de perte : l'ancien mot de passe cesse aussitôt de fonctionner, le nouveau est provisoire.
- **Fiches de remise** imprimables (une par agent) et export CSV des mots de passe provisoires, affichés une seule fois.
- Identifiant proposé automatiquement à la création d'un compte.

## 1.0.0 — 30 octobre 2026

Première version complète de l'application web, successeur du classeur Excel/VBA V1.3.

- Comptes nominatifs, rôles cumulables (IDE, secrétaire, cadre de santé, administrateur) et **services affectés par compte**, appliqués à la connexion et à la création d'une mesure.
- Report des décisions médicales de début et de fin, changement de lieu, contention en CSI avec isolement associé.
- Échéances JLD identiques à la V1.3 : cumul sur 15 jours glissants, cycles ancrés sur le début de la mesure, rythme des mesures longues, remise à zéro après mainlevée.
- Envois JLD, information des tiers par cycle, décompte JLD imprimable avec mise en page par service.
- Professionnels chargés de la surveillance en CSI, postes par défaut ou propres à un service.
- Onglet Patients : cumuls 48 h et 15 jours, niveau de vigilance, historique du mode d'hospitalisation.
- Registre anonymisé A à E, numéroté dans l'ordre des fins, à la suite du registre antérieur.
- Statistiques annuelles N/N-1, suivi réglementaire, répartition mensuelle, export pseudonymisé.
- Tableau de bord : échéances, tiers, postes incomplets, patients en soins libres, mineurs, cumuls élevés, conflits.
- Import du classeur V1.3 (mesures, patients, cycles, tiers, professionnels, paramétrage) avec rapport et comparaison des échéances.
- Stockage chiffré en ajout seul, saisie simultanée, détection des conflits et des saisies manquantes, instantanés mensuels.
- Kit de déploiement : fiche projet, fiche technique, installation, secours, RGPD/AIPD, guide utilisateur.
- Licence EUPL-1.2.

## 0.1.0 — 30 octobre 2026

Prototype : moteur de règles, journal chiffré, mode démonstration.
