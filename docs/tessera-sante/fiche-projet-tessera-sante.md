# Fiche projet — Tessera Santé

*Plateforme modulaire de suivi et d'organisation d'un service de soins, issue de Suivi-mesures-isocont. Logiciel libre (licence EUPL-1.2), gratuit. Document de travail présenté au cadre supérieur de santé et au directeur des soins.*

*Porteur : Roddy Ricart, faisant fonction cadre de santé (pôle santé mentale, UHP). Version du 5 novembre 2026.*

| En bref | |
| --- | --- |
| **Objet** | Faire de l'outil de suivi de l'isolement et de la contention le premier module d'une plateforme commune : **une seule connexion**, des modules ouverts selon le service et le rôle de chaque agent. |
| **Premiers modules** | Isolement et contention (existant), Patients (fiche commune), Agenda du service. |
| **Pour qui** | Équipes soignantes, secrétariat médical, cadres de santé ; direction des soins pour le pilotage et les rapports. |
| **Coût** | Aucun coût de licence. Développement réalisé par le porteur sur son temps personnel. Mise en place : quelques heures du service informatique (DSI ou direction du numérique, selon l'établissement), une formation courte des équipes. |
| **Où sont les données** | Dans un dossier du réseau de l'établissement, chiffrées. Rien n'est envoyé à l'extérieur. |
| **Ce que la plateforme ne fait pas** | Elle ne remplace ni le dossier patient informatisé (DPI), ni la prescription, ni les transmissions cliniques. Elle ne contient aucune donnée clinique. |

## 1. Point de départ

**Suivi-mesures-isocont** suit les mesures d'isolement et de contention prévues à l'article L. 3222-5-1 du code de la santé publique : échéances d'information et de saisine du juge des libertés et de la détention (JLD), décomptes, information des tiers, registre, rapport annuel. Né d'un classeur Excel utilisé à l'UHP, il a été réécrit en application web. Il est documenté, accompagné d'un kit de déploiement et vérifié par des tests automatiques. Il n'est pas encore en production.

En le construisant, deux constats sont apparus :

- **Les besoins d'un service dépassent l'isolement et la contention.** Les fiches patient, par exemple, n'existent aujourd'hui dans l'outil que pour les patients ayant fait l'objet d'une mesure.
- **Chaque nouvel outil ajoute un identifiant, un fichier et une procédure.** Les équipes multiplient les tableaux et les mots de passe, sans lien entre eux.

## 2. Le projet

Tessera Santé sépare ce qui est commun de ce qui est propre à chaque besoin :

- **Un socle commun** : connexion unique, comptes, services, droits, chiffrement, sauvegardes, traçabilité, impression.
- **Des modules** qui s'y branchent, chacun pour un besoin précis.

| Principe | Ce que cela veut dire pour les équipes |
| --- | --- |
| Une seule connexion | Un identifiant et un mot de passe (ou une clé de sécurité) ouvrent tous les modules auxquels l'agent a droit. |
| Modules par service | L'établissement choisit quels modules sont ouverts dans quel service. |
| Droits par rôle | Dans chaque module, l'agent ne voit et ne fait que ce que son rôle permet. Un agent peut, si besoin, avoir un rôle différent selon le service. |
| Modules qui communiquent | Un module peut afficher une information calculée par un autre : par exemple, les échéances JLD dans l'agenda du service. |
| Administration unique | Un onglet général pour les éléments communs, un onglet par module. |
| Ouverture | La fiche patient et le socle ne supposent pas la psychiatrie : d'autres disciplines pourront utiliser la plateforme. |

Le nom vient de la *tessera hospitalis* romaine, le jeton d'hospitalité qui garantissait l'accueil chez un hôte. Une *tessera* est aussi une pièce de mosaïque, comme chaque module.

## 3. Les premiers modules

| Module | Contenu | État |
| --- | --- | --- |
| **Isolement et contention** | Toutes les fonctions actuelles de Suivi-mesures-isocont : échéances et envois JLD, décomptes, tiers, surveillance, registre, rapport annuel. | Existant, à intégrer |
| **Patients** | Fiche commune à tous les modules : identité, séjour (entrée, sortie, unité), chambre, médecin de 1re ligne et de 2e ligne, référents soignants, protection juridique, mode d'hospitalisation. Patients avec ou sans mesure. | À construire à partir de l'existant |
| **Agenda** | Calendrier du service, avec les échéances JLD des mesures en cours. | À construire |

D'autres modules liés aux patients ou à l'organisation du service pourront s'ajouter. Chacun fera l'objet d'une validation avant son développement.

**Alimentation de la fiche patient.** Une partie de la fiche est importée depuis la liste des patients exportée du DPI en CSV. Les colonnes sont attribuées au moment de l'import, car l'export diffère d'un DPI à l'autre. Une information que l'export ne fournit pas se saisit dans Tessera. Les médecins de 1re et 2e ligne et les référents soignants sont saisis dans Tessera, car le médecin référent du DPI n'est pas toujours celui qui suit le patient au moment présent.

**Mise en production à partir de zéro.** L'historique des mesures est repris par import : registre du service (quel que soit l'outil d'origine) ou classeur Excel existant. Cet import crée à la fois les fiches patient et les mesures.

## 4. Ce qui ne change pas

- **Les données restent dans l'établissement**, sur un dossier du réseau, chiffrées sur le poste avant d'y être écrites.
- **Aucun serveur à installer, aucune connexion sortante.**
- **Traçabilité complète** : chaque saisie est nominative, horodatée, jamais effacée ; les corrections et annulations sont elles-mêmes tracées.
- **Saisie simultanée sans perte** sur plusieurs postes.
- **Outil parallèle au DPI**, limité à ce que le DPI ne fait pas ou fait mal.

## 5. Bénéfices attendus

| Bénéfice | Pour qui |
| --- | --- |
| Une connexion et un outil au lieu de plusieurs tableaux | Équipes |
| Une fiche patient saisie une fois, utilisée par tous les modules | Équipes, secrétariat |
| Échéances JLD visibles dans l'agenda du service | Équipes, secrétariat, cadre |
| Organisation du service lisible : chambre, médecins, référents | Équipes, cadre |
| Droit d'accès d'un patient à ses données : un seul export pour tous les modules | Établissement, patients |
| Nouveaux besoins couverts sans repartir de zéro | Établissement |

## 6. Sécurité et conformité

- **Un module, une clé de chiffrement** : un agent ne peut déchiffrer que les modules auxquels il a accès. L'accès ne dépend pas seulement de ce qu'affiche l'écran.
- **Retrait d'un droit** : l'agent concerné perd l'accès aux nouvelles saisies ; les autres agents, et les nouveaux, gardent l'accès à tout l'historique.
- **Cloisonnement entre services** : il est fait par l'interface, pour permettre simplement le transfert d'un patient d'un service à l'autre.
- **RGPD** : chaque module correspond à un traitement à inscrire au registre des traitements. Une analyse d'impact est probablement requise (données de santé de personnes vulnérables). L'avis du délégué à la protection des données (DPO, référent RGPD) est nécessaire avant toute donnée réelle.
- **Hébergement de données de santé** : les données n'étant confiées à aucun prestataire, la certification HDS ne devrait pas s'appliquer ; la qualification revient au délégué à la protection des données et au service informatique.

## 7. Démarche

Chaque étape aboutit à une version utilisable et vérifiée ; l'outil actuel continue de fonctionner à chaque étape.

| Étape | Contenu |
| --- | --- |
| 1. Réorganisation du code | Séparer le socle commun et le module isolement et contention, sans rien changer pour les utilisateurs. |
| 2. Branchement des modules | Mise en place du mécanisme qui permet d'ajouter un module. |
| 3. Comptes et services communs | Comptes, services et activation des modules par service. |
| 4. Clés par module | Chiffrement séparé pour chaque module. |
| 5. Module Patients | Fiche commune, import de la liste des patients du DPI, reprise de l'historique. |
| 6. Module Agenda | Calendrier du service et échéances JLD. |
| 7. Kit de déploiement | Fiche technique, éléments RGPD, guides, mis à jour. |

Puis, après validation : **pilote à l'UHP**, en parallèle des outils actuels, avant toute généralisation.

## 8. Risques et parades

| Risque | Parade |
| --- | --- |
| Maintenance dépendante d'une seule personne | Logiciel libre, documenté et testé, repris par toute équipe ou tout autre établissement. |
| Extension sans limite du périmètre | Chaque nouveau module validé avant développement ; aucune donnée clinique. |
| Charge de saisie des fiches patient | Import de la liste des patients exportée du DPI ; saisie limitée à ce que le DPI ne fournit pas. |
| Confusion avec le DPI | Périmètre écrit et rappelé : le DPI reste la référence clinique. |
| Perte des moyens de déverrouillage | Clés matérielles d'administration, code de secours papier scellé, procédure testée. |
| Indisponibilité du réseau | Procédure dégradée papier, travail hors réseau prévu, ressaisie avec les heures réelles. |

## 9. Décisions attendues

- [ ] Accord de principe pour faire évoluer Suivi-mesures-isocont vers la plateforme Tessera Santé.
- [ ] Validation des trois premiers modules : isolement et contention, Patients, Agenda.
- [ ] Accord pour présenter le projet au service informatique et au délégué à la protection des données.
- [ ] Accord pour un pilote à l'UHP, une fois ces validations obtenues.
- [ ] Désignation des interlocuteurs : direction des soins, service informatique, délégué à la protection des données.

**Roddy Ricart — Faisant fonction cadre de santé** — **Date :** ........ / ........ / ................

---
*Sources : [article L. 3222-5-1 du code de la santé publique](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048447133) ; [CNIL, liste des traitements pour lesquels une analyse d'impact est requise](https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf). Code source : dépôt public `rodtrip2/Suivi-mesures-isocont`. Ce document ne constitue pas un avis juridique.*
