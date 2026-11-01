# Architecture — Suivi-mesures-isocont 1.0

Document de référence pour les développeurs. La présentation destinée à la DSI est dans [kit/02-fiche-technique-dsi.md](../kit/02-fiche-technique-dsi.md).

## 1. Périmètre fonctionnel

- Outil parallèle au DPI : suivi des durées, calendrier JLD, registre anonymisé, statistiques.
- L'IDE reporte les décisions médicales de début et de fin (psychiatre décisionnaire, date, heure), ainsi que les levées temporaires (événements `PAUSE` avec reprise prévue, puis `REPRISE`). Une pause ne termine pas la mesure : par défaut, la durée et les échéances JLD continuent de courir. Le paramètre `pauses` (`retrancher`, `repriseAuto`, `alerteHeures`, `refusHeures` ≤ 48) permet de retrancher les pauses : le modèle passe alors au moteur de règles des copies de mesures portant leurs plages `exclusions` (pause reprise : jusqu'à la reprise ; non reprise : jusqu'à l'heure prévue au plus), soustraites des cumuls, et les échéances sont reportées par `instantEffectif`. Les psychiatres ne sont pas utilisateurs.
- Rôles cumulables : **IDE** et **AS** (mêmes droits : début, fin, tiers, professionnels en CSI, JLD en permanence) ; **secrétaire** (JLD) ; **cadre** (idem IDE + corrections, annulations, statistiques) ; **administrateur** (paramétrage, comptes, clés, import).
- **Services affectés** : chaque compte non administrateur porte une liste de services ; l'interface ne montre que ceux-ci (sélecteur d'en-tête, listes, création de mesure). `model.servicesDe(compte, config)`.
- Comptes : créés un par un ou en lot (`comptes.js` analyse la liste ; `session.creerComptes` écrit le coffre une seule fois). Indicateur `mdpProvisoire` dans le compte chiffré : posé à la création et à la réinitialisation par un administrateur, levé quand l'agent choisit son mot de passe ; tant qu'il est posé, l'interface n'affiche que l'écran de changement.
- Information des tiers : le psychiatre ou une autre fonction de la liste de l'établissement (`config.informateursTiers`, `M.informateursTiers`, `M.libInformateur`) ; l'événement enregistre la fonction (`informateur`) et, si précisé, le nom (`nomInformateur`).
- Reprise intégrale de la V1.3, y compris la traçabilité des professionnels par poste (nécessaire au registre). La réévaluation médicale optionnelle de la V1.3 n'est pas reprise (elle relève du DPI).

## 2. Modules

| Fichier | Rôle | Testé sous Node |
| --- | --- | --- |
| `rules.js` | Cumuls glissants, échéances JLD par cycle, statuts | oui |
| `model.js` | Réduction du journal en état, droits, conflits, chaînage, registre, statistiques, décompte, postes | oui |
| `crypto.js` | AES-GCM, PBKDF2, HKDF, WebAuthn PRF, code de secours | oui (hors WebAuthn) |
| `store.js` | Dossier (File System Access ou stockage privé du navigateur), lecture incrémentale, instantanés | oui (dossier simulé) |
| `session.js` | Coffre, comptes, connexion, enregistrement, lots, synchronisation | oui (dossier simulé) |
| `xlsx.js`, `import-v13.js` | Lecture d'un classeur Excel sans bibliothèque ; conversion V1.3 → événements | oui |
| `ui.js`, `ui-*.js`, `main.js` | Interface (DOM construit sans `innerHTML`) | test de bout en bout manuel/Playwright |

## 2 bis. Mode formation

- Jeu de données fictives dans `formation/` (même structure que le dossier principal, sans coffre), chiffré par une clé propre. `coffre.formation = { cle, creeLe, par }`, où `cle` est la clé du jeu chiffrée par la clé des données réelles (données associées `formation`).
- `Session` distingue le dossier du coffre (`dossier`, clé `cle`) et le jeu actif (`dossierActif`, `cleActive`) : `ouvrirFormation()` / `fermerFormation()` basculent le jeu actif ; les traces de comptes (`tracer`, option `journalReel`) vont toujours au journal réel.
- Accès au mode formation : propriété `formation` du compte (vraie par défaut, `model.accesFormation`), désactivable par l'administrateur. Rôles et services identiques dans les deux jeux.
- Choix du jeu à la connexion (mot de passe ou clé de sécurité ; le code de secours ouvre toujours les données réelles). `ouvrirFormation(generer)` crée le jeu s'il n'existe pas encore ; seul un administrateur peut le régénérer ensuite.
- `SIC.donneesFictives({ config })` génère le contenu à partir du paramétrage réel ; `creerFormation` efface le sous-dossier, écrit un lot unique puis met à jour le coffre.

## 3. Stockage

```
SuiviIsoCont/
  coffre.json                      emballages de la clé de données, comptes chiffrés, révision
  evenements/AAAA/MM/<id>.enc      une saisie (ou un lot) par fichier, mois UTC de la saisie
  instantanes/AAAA-MM.enc          copie consolidée d'un mois clos (régénérable)
```

- Identifiant d'événement : `AAAAMMJJTHHMMSSZ_<auteur>_<aléa>` ; écriture exclusive (refus si le nom existe), atomique (`createWritable`).
- Événement : `{ v, id, at, by, type, data, base?, prec }`. `base` = version de la mesure vue par l'auteur ; `prec` = identifiant de sa saisie précédente (chaînage).
- **Lot** (`type: LOT`) : un fichier contenant plusieurs saisies (`data.evenements`), dépliées à la lecture avec les identifiants `<lot>.<n°>` ; annulable en bloc ou saisie par saisie. Utilisé par l'import et les données de démonstration.
- **Instantanés** : un mois est clos s'il est antérieur au mois précédent. À la lecture, l'instantané fournit les saisies du mois ; les fichiers absents de l'instantané sont lus un à un, puis l'instantané est réécrit. Les fichiers individuels font foi : une saisie présente dans l'instantané sans fichier correspondant est ignorée.

## 4. Réduction et conflits

- Tri par `at` puis `id` ; annulations appliquées d'abord (elles neutralisent leur cible quelle que soit leur date).
- Conflit : deux saisies du même champ logique d'une mesure (`fin`, `jld:<cycle>:<nature>`, `corr:<champs>`) dont la seconde a une `base` antérieure à la version produite par la première et un auteur différent. La seconde n'est pas appliquée, elle est listée dans `st.conflits` ; l'arbitrage consiste à annuler l'une des deux.
- Chaînage : un `prec` introuvable est listé dans `st.manquants` (fichier supprimé ou non restauré).

## 5. Règles légales (tests de référence)

- Échéances du cycle 1 : début + (seuil sur 15 jours − cumul du même type dans les 15 jours précédant le début). Seuils par défaut : isolement 48/72/96 h, contention 24/48/72 h.
- Cycles suivants : + (n − 1) × intervalle (96 h isolement, 72 h contention), **toujours depuis le début de la mesure**, jamais depuis la date des décisions du juge.
- Rythme des mesures longues (isolement, à partir du cycle 3) : chaque cycle part de l'échéance de décision du précédent ; information et saisine à + 144 h, décision à + 168 h.
- Mainlevée du JLD : indicateur légal, ne clôt pas la mesure ; les cumuls ultérieurs repartent de la fin de la mesure levée.
- Périodes qui se chevauchent comptées une fois. Paramètres modifiables par l'administrateur (`config.parametres`).

## 6. Registre et statistiques

- Catégories : A isolement en CSI, B isolement hors CSI, C contention en CSI, D contention hors espace d'isolement, E idem avec exception. Une contention en CSI couvre l'isolement concomitant ; seules les portions d'isolement non couvertes deviennent des entrées A.
- Année d'une entrée : année de son début. Numérotation commune A–E par service et par année, attribuée aux entrées terminées dans l'ordre de leur fin, à la suite de `config.compteursRegistre[service][année]`. Une saisie rétroactive peut décaler les numéros suivants : le registre transmis est celui imprimé à la date d'édition.
- Mode d'hospitalisation retenu : celui en vigueur au début ; si le patient était en soins libres et passe sous contrainte dans les `delaiModeHospiHeures` (12 h), le nouveau mode est retenu.
- Statistiques : une mesure = une entrée terminée ; données HC/SSC saisies par le cadre (événement `STATS`).

## 7. Sécurité

Voir la fiche technique : chiffrement, politique de sécurité du contenu, modèle de menace, limites (contrôle des rôles côté poste, pas de rotation automatique de la clé en 1.0).

## 8. Évolutions envisagées

Rotation de la clé de données, export du registre au format tableur natif, interopérabilité avec le DPI (lecture des décisions), notifications.
