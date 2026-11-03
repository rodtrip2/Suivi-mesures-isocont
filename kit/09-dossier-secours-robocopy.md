# Dossier de secours copié par robocopy — fiche du service informatique

*Suivi des mesures d'isolement et de contention. Mise en place d'une copie automatique des données vers un dossier de secours, par une tâche planifiée Windows. À lire avec la fiche technique (document 02) et les procédures de secours (document 04).*

## 1. Principe

Une tâche planifiée lance toutes les 15 à 30 minutes le script fourni `kit/outils/miroir-robocopy.ps1`. Le script copie le dossier des données de l'outil vers un dossier de secours, de préférence sur un autre serveur. Les fichiers copiés restent **chiffrés** : le compte qui exécute la copie ne voit aucune donnée lisible.

Cette copie complète, sans la remplacer, la synchronisation que l'outil sait faire depuis un poste relié (*Administration → Sauvegardes et exports*). Elle ne dépend ni d'un navigateur ouvert, ni d'un agent connecté. Les deux mécanismes peuvent fonctionner ensemble, ainsi que les copies locales des postes désignés pour le travail hors réseau (document 10) : le dossier principal garde l'état de chaque copie.

**Où l'installer.** De préférence sur un **serveur**, qui reste allumé. À défaut, sur un poste de travail identifié, toujours allumé, et dont le nom est noté dans le dossier d'exploitation. Si la machine est éteinte, rien n'est copié : l'administrateur de l'outil est alerté après 24 h sans copie.

## 2. Ce que fait le script

| Étape | Détail |
| --- | --- |
| Contrôles avant copie | Dossier principal accessible, avec un coffre lisible (`coffre.json`) et non marqué « déplacé » ; dossier de secours vide ou contenant une copie des **mêmes** données (même date de création du coffre) ; les deux chemins différents et pas inversés. Au moindre doute, **arrêt sans rien copier** (code 1). |
| Copie | `robocopy /E /XO` : copie des fichiers nouveaux ou modifiés, **sans jamais rien supprimer** (pas de `/MIR` ni de `/PURGE`) et sans écraser un fichier plus récent du côté du secours. Un dossier principal vidé ou abîmé ne détruit donc pas le secours, et les saisies faites sur le secours pendant une panne sont conservées. |
| Exclusions | Dossier des exports (fichiers en clair, choix de l'établissement porteur du projet), `instantanes` (reconstruits automatiquement), `formation` (jeu fictif), fichiers temporaires du navigateur `*.crswap`, fichiers d'état propres à chaque dossier (`miroir-etat.json`, `deplace.json`…). |
| État | Après une copie réussie, `miroir-etat.json` est mis à jour dans les deux dossiers (rôle « principal » ou « secours », date, nom de la machine). L'outil affiche un bandeau rouge sur le dossier de secours et alerte l'administrateur après 24 h sans copie. |
| Journal | `%ProgramData%\SuiviIsoCont\miroir-robocopy.log` (résumé) et `miroir-robocopy-detail.log` (détail de robocopy) ; un fichier est renommé en `.ancien` au-delà de 5 Mo. |
| Codes de sortie | 0 : copie faite ; 1 : arrêt sur un contrôle (voir le journal) ; 2 : échec de robocopy sur au moins un fichier. |

## 3. Mise en place

### 3.0 Méthode simple : l'assistant de l'outil (recommandée)

L'outil prépare lui-même les commandes, avec les chemins exacts : *Administration → Sauvegardes et exports → Installer une copie automatique par robocopy…*.

1. Choisir *Dossier de secours sur un autre serveur*. Vérifier le chemin du dossier des données : il est proposé si l'administrateur l'a renseigné dans *Dossier des exports*. Saisir le chemin du dossier de secours (créé vide au préalable, étape 1 ci-dessous), le compte de service (étape 2) et la fréquence.
2. Sur la machine qui fera la copie, ouvrir PowerShell **en administrateur** : clic droit sur Démarrer → *Terminal (administrateur)*.
3. Dans l'outil, cliquer sur *Copier les commandes*, coller dans PowerShell, puis appuyer sur Entrée. Saisir le mot de passe du compte de service quand il est demandé.
4. Les commandes contrôlent les deux dossiers, enregistrent le script dans `C:\SuiviIsoCont`, font une première copie, puis créent la tâche planifiée. Au moindre problème, elles s'arrêtent avec un message en rouge et ne planifient rien.
5. Dans l'outil, cliquer sur *Surveiller la copie robocopy (alerte après 24 h)*.

Le script est intégré aux commandes : il n'y a rien à télécharger ni à modifier. Le compte administrateur qui colle les commandes doit avoir accès aux deux dossiers, car c'est lui qui fait la première copie. La méthode détaillée ci-dessous reste valable, par exemple pour un déploiement par stratégie de groupe.

### 3.1 Méthode détaillée

1. **Dossier de secours** : créer un dossier **vide** sur le second serveur, avec les mêmes droits NTFS que le dossier des données (agents habilités en lecture et écriture, pour pouvoir y travailler en cas de panne du serveur principal).
2. **Compte de service** : un compte du domaine (ex. `DOMAINE\svc-isocont-secours`) avec **lecture et écriture** sur les deux dossiers, et le droit « Ouvrir une session en tant que tâche ». L'écriture dans le dossier principal ne sert qu'au fichier `miroir-etat.json`.
3. **Script** : copier `miroir-robocopy.ps1` sur la machine, par exemple dans `C:\SuiviIsoCont\`, puis renseigner en tête du fichier les deux chemins UNC (`$Principal`, `$Secours`) et, si l'établissement l'a changé, le nom du dossier des exports (`$Exports`, « exports » par défaut). On peut aussi passer ces valeurs en paramètres dans la tâche planifiée.
4. **Premier essai à la main**, sous le compte de service :
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\SuiviIsoCont\miroir-robocopy.ps1`
   Vérifier le journal, puis la présence de `coffre.json`, du dossier `evenements` et de `miroir-etat.json` dans le dossier de secours.
5. **Tâche planifiée** (toutes les 15 minutes ; l'invite demande le mot de passe du compte) :

```
schtasks /Create /TN "SuiviIsoCont - dossier de secours" /SC MINUTE /MO 15 /RU DOMAINE\svc-isocont-secours /RP * /RL LIMITED /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\SuiviIsoCont\miroir-robocopy.ps1"
```

6. **Dans l'outil**, l'administrateur ouvre *Administration → Sauvegardes et exports → Dossier de secours* et clique sur *Surveiller la copie robocopy (alerte après 24 h)*. L'écran indique ensuite la date de la dernière copie et la machine qui l'a faite.
7. **Dossier d'exploitation** : noter le nom de la machine, le compte de service, les deux chemins et l'emplacement du journal.

## 3 bis. Copie locale d'un poste désigné

Le même script tient à jour la copie locale des données d'un poste désigné pour le travail hors réseau (document 10), avec le paramètre `-Type local` et le dossier du disque du poste en `-Secours` (ex. `C:\SuiviIsoCont-local`). La tâche planifiée est alors créée **sur le poste désigné** lui-même. Le script reprend l'identifiant de la copie créée par l'outil, pour que les deux tiennent à jour la même ligne du tableau des dossiers de secours.

## 4. Vérifications

- **Chaque mois** : date de la dernière copie (écran de l'outil, ou journal) ; absence de code 2 dans le journal.
- **Chaque année**, avec le test annuel des procédures de secours : ouvrir le dossier de secours depuis un poste de test (*Changer de dossier*), se connecter, vérifier les dernières saisies, puis rouvrir le dossier principal. Ne rien saisir pendant ce test.
- Le dossier de secours **ne remplace pas les sauvegardes** : il reproduit aussi une erreur (fichier abîmé, saisie erronée). Les sauvegardes du dossier principal, avec plusieurs versions conservées, restent indispensables (document 02).

## 5. En cas de panne du serveur principal

1. Les agents ouvrent le dossier de secours (*Verrouiller*, puis *Changer de dossier*). Un bandeau rouge le signale ; les comptes et les mots de passe sont les mêmes. Les saisies faites depuis la dernière copie (au plus l'intervalle de la tâche) peuvent manquer : les ressaisir à leur heure réelle.
2. **Suspendre la tâche planifiée** tant que le serveur principal est indisponible (elle s'arrête d'elle-même sur ses contrôles, mais la suspendre évite des alertes inutiles).
3. **Au retour du serveur principal, ne pas relancer la tâche tout de suite.** L'administrateur de l'outil ouvre le dossier principal, relie son poste au dossier de secours (*Administration → Sauvegardes et exports → Relier ce poste au dossier de secours*), puis clique sur *Synchroniser maintenant*. L'outil reprend les saisies faites sur le dossier de secours, sans rien écraser, et retient la bonne version du coffre. Robocopy ne sait pas faire ce choix : **ne jamais copier en sens inverse avec robocopy**.
4. Les agents rouvrent le dossier principal ; réactiver ensuite la tâche planifiée.

## 6. Déplacement des données, arrêt

- Après un **déplacement des données** (*Administration → Sauvegardes et exports → Déplacer les données*), le script s'arrête de lui-même (le dossier d'origine contient `deplace.json`). Mettre à jour le chemin `$Principal`.
- **Arrêt de la copie** : supprimer la tâche planifiée (`schtasks /Delete /TN "SuiviIsoCont - dossier de secours"`), puis, dans l'outil, *Ne plus utiliser de dossier de secours*.
