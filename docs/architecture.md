# Architecture — Suivi-mesures-isocont

Version de travail du 30/10/2026. Le document de référence, avec schémas et tableau de conformité, est tenu à jour en ligne (Claude Docs, « Suivi iso/cont Web – Document d'architecture ») ; ce fichier en reprend les décisions techniques utiles au développement.

## 1. Périmètre fonctionnel

- Outil parallèle au DPI : suivi des durées, saisine JLD, registre anonymisé, statistiques.
- L'IDE reporte uniquement les décisions médicales de début et de fin de mesure (psychiatre décisionnaire, date, heure). Les psychiatres ne sont pas utilisateurs.
- Rôles (un utilisateur peut en cumuler plusieurs) :
  - **IDE** : report des décisions de début et de fin, traçabilité des agents par demi-journée, report de l'information des tiers, envois et suivi JLD le week-end ;
  - **Secrétaire** : envois et suivi JLD en semaine ;
  - **Cadre de santé** : pilotage, tableau de bord, registre anonymisé, statistiques, comptes du service ;
  - **Administrateur** : paramétrage, services, clés de secours, rotation de clé (porté actuellement par le cadre, séparable).
- Information des tiers : faite par le psychiatre, en dernier recours par l'IDE ; l'événement enregistre qui l'a faite (psychiatre nommé ou IDE).
- Envois JLD : le week-end, l'IDE dispose des mêmes actions JLD que la secrétaire (modalité à trancher : restriction par jour paramétrable, ou droit permanent avec usage prévu le week-end).
- Repris de la V1.3 : traçabilité des agents présents par demi-journée avec créneaux paramétrables (nécessaire au registre anonymisé), lieux de CSI par service, modes d'hospitalisation (SDT, SDTU, SPI, SDRE, SL, SL mineur) et alertes soins libres, mesure de protection juridique, information des tiers et motifs de refus, échéances et export JLD avec colonnes masquables par service, tableau de bord, registre anonymisé (catégories A à E, numérotation par service et par année), historique des changements de mode d'hospitalisation, création de service, verrouillage automatique.

## 2. Déploiement

| Mode | YubiKey | Usage |
| --- | --- | --- |
| GitHub Pages | Oui | Démonstration, données fictives |
| Intranet HTTPS | Oui (nom de domaine requis) | Production |
| Partage réseau (`file://`) | Non | Repli, accès au dossier à vérifier |

Une YubiKey est liée au nom de domaine : l'enregistrer dans chaque mode utilisé.

## 3. Stockage

```
SuiviIsoCont/
  coffre.json      copies emballées de la clé de données, comptes, rôles
  config/          paramétrage chiffré par service
  evenements/AAAA/MM/<horodatage>_<utilisateur>_<aléa>.enc
  instantanes/     états consolidés chiffrés
  verrous/         verrous de consolidation (avec expiration)
```

- Journal d'événements en **ajout seul** ; écriture dans un fichier temporaire puis renommage.
- État des mesures = relecture des événements (à partir du dernier instantané).
- Chaque événement porte : id, type, auteur, horodatage, id de mesure, version de mesure de base, données, empreinte de l'événement précédent du même poste.
- Conflit = deux événements modifiant le même champ d'une mesure depuis la même version → arbitrage manuel, les deux restent au journal.
- Correction = nouvel événement référençant l'original (jamais de modification en place).
- Relecture périodique du dossier (délai à calibrer sur le partage réseau réel).

## 4. Chiffrement

- Clé de données AES-GCM 256 bits générée aléatoirement (Web Crypto). IV aléatoire de 96 bits par fichier.
- `coffre.json` : une copie de la clé par moyen de déblocage :
  - mot de passe → PBKDF2-SHA256 (nombre d'itérations élevé) ou Argon2id (WASM embarqué) ;
  - YubiKey → secret WebAuthn PRF (YubiKey 5, firmware ≥ 5.2, Chrome/Edge récents) ;
  - code de secours papier (aléa long, imprimé à l'initialisation).
- Au moins deux YubiKeys d'administration, dont une au coffre.
- Clé en mémoire uniquement pendant la session ; effacée au verrouillage.
- Rotation : nouvelle clé + rechiffrement, opération tracée.

## 5. Sécurité applicative

- CSP stricte dans la page : `connect-src 'none'`, aucun script ni police externe.
- Aucune dépendance chargée à distance ; bibliothèques embarquées.
- Empreinte SHA-256 publiée pour chaque version.
- Rôles appliqués par l'interface (pas de serveur) : contournement possible mais détectable via la traçabilité nominative et le chaînage.

## 6. Règles métier à tester (cas de référence)

- Échéances JLD des cycles 2 et suivants calculées depuis la date et l'heure de **début de mesure**, jamais depuis les décisions du JLD ; rythmes particuliers des mesures longues conservés.
- Levée JLD = indicateur légal, ne clôt pas la mesure.
- Cumuls remis à zéro uniquement à la fin de mesure.
- Début et fin saisis uniquement comme report d'une décision médicale.
- Un seul chemin de calcul par donnée.

## 7. Migration depuis la V1.3

Import du classeur dans le navigateur → conversion en événements marqués « import Excel » → rapport de comparaison des échéances et cumuls recalculés → archivage du classeur en lecture seule.

## 8. Points ouverts

Navigateur des postes, hébergement intranet HTTPS, autorisation des clés USB, dossier réseau et sauvegardes (DSI) ; analyse HDS, AIPD, durée de conservation (DPO) ; statut de registre officiel (direction) ; détention des clés de secours et continuité de maintenance (encadrement).
