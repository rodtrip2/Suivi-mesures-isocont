# Fiche projet — Suivi des mesures d'isolement et de contention

*Suivi-mesures-isocont, version 1.0 — logiciel libre (licence EUPL-1.2), gratuit, déployable dans tout établissement autorisé en psychiatrie.*

| En bref | |
| --- | --- |
| **Objet** | Suivre les durées des mesures d'isolement et de contention, anticiper l'information et la saisine du juge des libertés et de la détention (JLD), produire le registre anonymisé et le rapport annuel. |
| **Pour qui** | Infirmiers, secrétariat médical, cadres de santé des unités de psychiatrie ; direction des soins pour le rapport annuel. |
| **Coût** | Aucun coût de licence. Mise en place : quelques heures de DSI, une formation courte des équipes. |
| **Où sont les données** | Dans un dossier du réseau de l'établissement, chiffrées. Rien n'est envoyé à l'extérieur. |
| **Ce que l'outil ne fait pas** | Il ne remplace ni le dossier patient informatisé (DPI), ni la prescription médicale, ni la surveillance clinique. |

## 1. Contexte

L'article L. 3222-5-1 du code de la santé publique encadre strictement le recours à l'isolement et à la contention en psychiatrie : décisions médicales motivées pour des durées limitées, renouvellements, information du juge des libertés et de la détention puis saisine au-delà de seuils de durée cumulée, information d'un tiers, et tenue d'un **registre** dans chaque établissement. Ce registre, sans données nominatives, est consultable par la commission départementale des soins psychiatriques, le Contrôleur général des lieux de privation de liberté et les parlementaires ; il alimente un **rapport annuel** sur ces pratiques.

Le respect de ces délais repose sur des calculs délicats : cumul des durées sur quinze jours glissants, mesures qui se succèdent ou se chevauchent, cycles de renouvellement, rythme particulier des mesures longues, remise à zéro après une mainlevée du juge. Une erreur ou un retard peut conduire le juge à ordonner la mainlevée de la mesure.

## 2. Le besoin

Les DPI couvrent de plus en plus la prescription et la surveillance infirmière des mesures. En revanche, **le suivi des durées cumulées, le calendrier des communications au JLD et le registre anonymisé** y sont souvent absents ou insuffisants. Les équipes compensent avec des tableaux et des classeurs bureautiques, fragiles (fichiers verrouillés en saisie simultanée, corruption, macros bloquées) et peu protégés.

Suivi-mesures-isocont est né dans une unité d'hospitalisation psychiatrique, d'un classeur Excel utilisé en conditions réelles (versions 1.0 à 1.3), puis réécrit en application web pour lever ces limites.

## 3. Ce que fait l'outil

| Fonction | Détail |
| --- | --- |
| Report des décisions médicales | L'IDE reporte le début et la fin de chaque mesure : psychiatre décisionnaire, date, heure, lieu (chambre de soins intensifs ou non). |
| Échéances JLD | Calcul automatique des dates limites d'information, de saisine et de décision, cycle par cycle, avec alertes visuelles. Calculs vérifiés par des tests automatiques. |
| Envois JLD | Secrétariat (et IDE le week-end) : enregistrement des informations, saisines et décisions reçues ; repérage des envois hors délai. |
| Décompte JLD | Document imprimable ou PDF détaillant la durée cumulée, à joindre à la saisine. |
| Information des tiers | Traçabilité par cycle : qui a informé (psychiatre ou, en dernier recours, IDE), quel tiers, ou pourquoi aucun tiers n'a pu l'être. |
| Surveillance en CSI | Professionnels présents par poste, nécessaires au registre. |
| Registre anonymisé | Catégories A à E, numérotation annuelle, impression et export. |
| Rapport annuel | Indicateurs « L'isolement et la contention en chiffres » (année N et N-1), suivi réglementaire, répartition mensuelle, export pseudonymisé. |
| Vigilance | Tableau de bord : échéances proches ou dépassées, tiers à renseigner, patients en soins libres, mineurs, cumuls élevés. |
| Saisie à plusieurs | Plusieurs postes peuvent saisir en même temps sans perte d'information ; les saisies contradictoires sont signalées pour arbitrage. |
| Traçabilité | Chaque saisie est nominative, horodatée, jamais effacée ; les corrections sont elles-mêmes tracées. |
| Reprise de l'existant | Import du classeur Excel V1.3 et de son paramétrage. |

## 4. Organisation et rôles

| Rôle | Responsabilités dans l'outil |
| --- | --- |
| IDE | Report des décisions de début et de fin, information des tiers, professionnels en CSI, envois JLD le week-end ou en l'absence du secrétariat. |
| Secrétaire | Envois et suivi JLD, décomptes. |
| Cadre de santé | Pilotage, corrections tracées, registre, statistiques. |
| Administrateur | Comptes, services affectés à chaque compte, clés de secours, paramétrage, import. Rôle cumulable avec celui de cadre. |
| Psychiatres | Non utilisateurs à ce stade : la décision et la prescription restent dans le DPI. |
| DSI | Mise à disposition du dossier réseau et de l'application, sauvegardes, postes. |
| DPO | Inscription au registre des traitements, analyse d'impact. |

Chaque agent ne voit que les services qui lui sont affectés.

## 5. Sécurité et conformité, en résumé

- **Les données restent dans l'établissement**, sur un dossier du réseau, chiffrées (AES-256) sur le poste avant d'y être écrites.
- **Aucun serveur à installer, aucune connexion sortante** : l'application est un ensemble de fichiers statiques qui ne peuvent rien envoyer sur Internet.
- **Accès nominatifs**, rôles, verrouillage automatique, clés matérielles (YubiKey) et code de secours papier.
- **Hébergement de données de santé** : les données n'étant confiées à aucun prestataire, la certification HDS ne devrait pas s'appliquer ; la qualification revient au DPO et à la DSI (voir la fiche technique).
- **RGPD** : traitement à inscrire au registre ; une analyse d'impact est probablement requise (données de santé de personnes vulnérables). Les éléments utiles sont fournis dans le kit.

## 6. Bénéfices attendus et indicateurs de suivi

| Bénéfice | Indicateur proposé |
| --- | --- |
| Moins de communications au JLD hors délai | Nombre de cycles avec au moins une communication hors délai (calculé par l'outil) |
| Registre complet et conforme | Part des entrées A et C avec professionnels renseignés ; délai de production du registre |
| Rapport annuel produit sans ressaisie | Temps consacré à la préparation du rapport |
| Meilleure information des tiers | Part des mesures avec information du tiers renseignée |
| Fiabilité | Nombre d'incidents (perte de saisie, fichier inaccessible) |

## 7. Déploiement type

| Étape | Contenu | Durée indicative |
| --- | --- | --- |
| 1. Cadrage | Présentation de cette fiche à la direction, à la DSI et au DPO ; choix du mode d'hébergement. | 2 à 4 semaines |
| 2. Validation | Fiche technique revue par la DSI et le RSSI ; registre des traitements et analyse d'impact par le DPO. | selon l'établissement |
| 3. Installation | Dossier réseau, publication de l'application, test sur un poste type. | 1 demi-journée DSI |
| 4. Paramétrage | Services, CSI, postes de surveillance, comptes, clés de secours ; import éventuel de l'existant. | 1 demi-journée |
| 5. Pilote | Une unité, en parallèle de l'outil actuel, avec comparaison des échéances. | 1 à 2 mois |
| 6. Généralisation | Autres unités, abandon de l'outil antérieur. | progressive |

Formation : 20 à 30 minutes par agent, à partir du guide utilisateur du kit.

## 8. Risques et parades

| Risque | Parade |
| --- | --- |
| Perte de tous les moyens de déverrouillage | Deux clés matérielles d'administration dont une au coffre, code de secours papier scellé, procédure testée chaque année. |
| Indisponibilité du réseau | Procédure dégradée papier (modèle fourni), ressaisie avec les heures réelles. |
| Maintenance dépendante d'une seule personne | Logiciel libre documenté et testé, repris par toute équipe ou tout autre établissement. |
| Outil non reconnu comme support du registre | Décision institutionnelle avant la mise en production. |
| Navigateur non compatible | Edge ou Chrome à jour sur les postes concernés. |

## 9. Logiciel libre et gouvernance

Le code est publié sous **licence publique de l'Union européenne (EUPL-1.2)** : chaque établissement peut l'utiliser, l'étudier, l'adapter et le redistribuer ; les versions modifiées et redistribuées restent libres. Il est fourni sans garantie et sans support commercial. Les évolutions sont proposées et suivies sur le dépôt public du projet ; un établissement peut aussi déployer une version qu'il a lui-même vérifiée et figée.

Le logiciel n'est pas un dispositif médical : il n'émet aucune recommandation clinique et n'intervient pas dans la décision.

## 10. Décisions attendues

- [ ] Accord de la direction et de la direction des soins pour un pilote.
- [ ] Mode d'hébergement retenu par la DSI (intranet recommandé).
- [ ] Inscription au registre des traitements et analyse d'impact par le DPO.
- [ ] Reconnaissance de l'outil comme support du registre prévu à l'article L. 3222-5-1, ou articulation avec le registre existant.
- [ ] Désignation de l'administrateur fonctionnel et des détenteurs des clés de secours.

**Référent du projet dans l'établissement :** ______________________ — **Date :** ____ / ____ / ________

---
*Sources : [article L. 3222-5-1 du code de la santé publique](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048447133) ; [ANS, champ d'application de l'hébergement de données de santé](https://esante.gouv.fr/faq/quel-est-le-champ-dapplication-de-la-legislation-relative-lhebergement-de-donnees-de-sante-caractere-personnel) ; [CNIL, liste des traitements pour lesquels une analyse d'impact est requise](https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf). Ce document ne constitue pas un avis juridique.*
