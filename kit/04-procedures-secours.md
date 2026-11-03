# Procédures de secours et d'exploitation

*À imprimer et à ranger avec le code de secours. Chaque procédure indique qui agit.*

## Mot de passe oublié par un agent — administrateur

1. Vérifier l'identité de l'agent.
2. *Administration → Comptes et sécurité → Réinitialiser le mot de passe* sur le compte de l'agent. Un mot de passe provisoire est proposé ; l'ancien mot de passe cesse aussitôt de fonctionner.
3. Imprimer la fiche de remise et la donner en main propre (jamais par messagerie).
4. À sa connexion suivante, l'agent doit choisir un nouveau mot de passe personnel avant de continuer. L'opération est tracée dans le journal, sans le mot de passe.

## Mot de passe de l'administrateur oublié

1. Déverrouiller avec une **clé de sécurité** d'administration (*Déverrouiller avec une clé de sécurité*), ou à défaut avec le **code de secours** (*Mot de passe perdu ? Utiliser le code de secours*).
2. La session ouverte est une session d'administration de secours : *Administration → Comptes et sécurité → Réinitialiser le mot de passe* du compte administrateur.
3. Si le code de secours a été utilisé : *Nouveau code de secours*, puis nouvelle enveloppe scellée au coffre. L'ancien code est invalidé.

## Perte ou vol d'une clé de sécurité

1. *Administration → Comptes et sécurité → Moyens de déblocage → Retirer* la clé concernée.
2. Enregistrer une clé de remplacement.
3. Vérifier qu'il reste au moins deux clés d'administration ou une clé et le code de secours.

## Départ d'un agent

1. *Administration → Comptes et sécurité → Modifier* : décocher *Compte actif*. Son mot de passe est retiré du coffre : il ne déverrouille plus rien.
2. Service informatique (DSI ou direction du numérique, selon l'établissement) : retirer l'agent du groupe ayant accès au dossier réseau.
3. Si l'agent détenait une clé de sécurité : la retirer.
4. Les saisies passées restent attribuées à son nom dans le journal.

## Suspicion de compromission

1. Désactiver les comptes concernés, retirer les clés de sécurité suspectes.
2. Générer un nouveau code de secours et faire changer les mots de passe des autres comptes.
3. Informer le responsable de la sécurité informatique (RSSI) et le délégué à la protection des données (DPO, référent RGPD) : éventuelle violation de données à notifier.
4. La version 1.0 ne propose pas de rotation automatique de la clé de données. Si l'on craint que la clé de données elle-même ait été exposée (session déverrouillée sur un poste compromis), le responsable de la sécurité informatique décide des suites, en s'appuyant sur le fait qu'une copie du dossier reste nécessaire pour l'exploiter.

## Panne du réseau sur un poste désigné pour le travail hors réseau

Sur les postes désignés (document 10) : ouvrir l'outil comme d'habitude, puis **Travailler hors réseau (copie locale de ce poste)** et se connecter (bandeau rouge « Hors réseau »). Au retour du réseau : *Verrouiller*, *Changer de dossier*, **Reprendre** le dossier habituel ; les saisies faites hors réseau sont reprises automatiquement. Les autres postes appliquent la procédure dégradée sur papier ci-dessous.

## Choix du dossier bloqué et déblocage impossible

Si l'établissement a bloqué le choix du dossier sur les postes, le déblocage par un administrateur se vérifie sur le dossier habituel ou la copie locale du poste. S'ils sont tous deux inaccessibles et qu'il faut absolument ouvrir un autre dossier : le service informatique efface les données de l'outil dans le navigateur du poste (Edge : *Paramètres → Cookies et autorisations de site → Gérer et supprimer les cookies et les données de site*, adresse de l'outil). Le poste oublie alors son dossier, sa copie locale et son blocage ; aucune donnée du partage n'est touchée. Refaire ensuite le choix du dossier et, si besoin, la copie locale.

## Dossier réseau indisponible, dossier de secours en place

Si l'établissement a mis en place un **dossier de secours** (*Administration → Informations*, sur un autre serveur, tenu à jour par des postes reliés ou par une copie robocopy du service informatique, document 09) :
1. Sur chaque poste : *Verrouiller* puis *Changer de dossier*, et ouvrir le dossier de secours (le service informatique ou le cadre en donne l'emplacement). Un bandeau rouge rappelle qu'il s'agit du dossier de secours ; les comptes et mots de passe sont les mêmes.
2. Travailler normalement. Les saisies faites depuis la dernière synchronisation (10 minutes au plus en temps normal) peuvent manquer : les ressaisir à leur heure réelle si besoin.
3. Au retour du dossier principal : l'administrateur l'ouvre (*Changer de dossier*), puis *Administration → Informations → Synchroniser maintenant* : les saisies faites sur le dossier de secours sont reprises, rien n'est écrasé. Chaque poste rouvre ensuite le dossier principal. Avec une copie robocopy : suspendre la tâche planifiée pendant la panne et ne la réactiver qu'après cette synchronisation (document 09).

## Dossier réseau ou application indisponible — procédure dégradée

1. Poursuivre la traçabilité **sur papier** avec la fiche ci-dessous (une par mesure), en reportant les heures réelles.
2. Les échéances du juge des libertés et de la détention (JLD) se calculent à la main à partir du début de la mesure : information à 48 h (isolement) ou 24 h (contention) de cumul sur 15 jours, saisine à 72 h ou 48 h, décision à 96 h ou 72 h. En cas de doute, informer le JLD sans attendre.
3. Au retour du service, ressaisir chaque élément avec sa **date et son heure réelles** (les écrans acceptent une saisie rétroactive). Le journal garde la date de saisie.

### Fiche de traçabilité dégradée

| Champ | Valeur |
| --- | --- |
| Unité | |
| Patient (nom, prénom, IPP) | |
| Mode d'hospitalisation | |
| Type de mesure | ☐ Isolement ☐ Contention |
| Lieu | ☐ CSI n° ____ ☐ Chambre n° ____ |
| Début : date, heure, psychiatre | |
| Tiers informé : qui, par qui, quand | |
| Information du JLD : date, heure | |
| Saisine du JLD : date, heure | |
| Décision du JLD : date, heure, maintien ou mainlevée | |
| Fin : date, heure, psychiatre | |
| Professionnels en CSI (poste, nom, fonction) | |
| Ressaisi dans l'outil le, par | |

## Saisie réelle faite par erreur en mode formation

Un bandeau violet indique en permanence le mode formation. **Aucune information réelle ne doit y être saisie.** Si cela arrive : *Passer aux données réelles* (bouton du bandeau), ressaisir l'information avec les heures réelles, puis demander à l'administrateur de régénérer le jeu de formation (*Administration → Comptes et sécurité → Mode formation*), ce qui efface son contenu.

## Coffre introuvable ou abîmé

Le fichier `coffre.json` contient les copies protégées de la clé des données : sans lui, rien n'est lisible. L'outil le vérifie avant et après chaque écriture et en garde les 30 dernières versions (dossier `coffre-historique`).

1. À l'ouverture du dossier, l'outil affiche « Coffre introuvable » ou « Coffre illisible ». **Ne jamais réinitialiser le dossier.**
2. Choisir *Restaurer cette version* (la plus récente est proposée), puis se connecter normalement.
3. Si le dossier `coffre-historique` est lui aussi perdu : *Restaurer depuis la copie sous scellé* (fichier conservé au coffre), puis se connecter avec le **code de secours** (ou une clé de sécurité) et réinitialiser les mots de passe des agents (*Administration → Comptes et sécurité*), car la copie sous scellé ne contient pas les mots de passe.
4. À défaut, demander au service informatique de restaurer `coffre.json` depuis la sauvegarde du partage.
5. Ensuite : *Administration → Informations → Vérifier maintenant*, puis télécharger une nouvelle copie sous scellé.

## Perte du dossier entier

Si un dossier de secours existe, l'ouvrir et l'utiliser (paragraphe ci-dessus), puis le **déplacer** vers un nouveau dossier principal (*Administration → Informations → Déplacer les données*) et en recréer un autre comme secours. Sinon :

1. Créer un dossier vide sur le partage (droits limités aux agents habilités) et l'ouvrir dans l'outil.
2. Sur l'écran d'initialisation, *Restaurer une copie de sauvegarde dans ce dossier* : choisir la dernière copie de sauvegarde complète téléchargée par l'administrateur.
3. Se connecter, vérifier l'état des données, puis ressaisir ce qui a été fait depuis la date de la copie (procédure papier).

## Alerte d'intégrité

Le tableau de bord signale « Intégrité des données » quand des saisies ont disparu (repère d'un agent non retrouvé, fichier chargé qui n'est plus sur le partage), quand des fichiers sont illisibles ou quand le chaînage des saisies présente un trou. Le cadre prévient l'administrateur. Tout se traite dans *Administration → Informations*, rubrique *Contrôle d'intégrité*, qui donne le détail des fichiers concernés (chemin, agent, date de la saisie).

**Règle d'or : ne pas ressaisir avant d'avoir tenté la récupération**, pour ne pas créer de doublons.

### Arbre de décision

1. **Refaire le contrôle** (*Vérifier maintenant*) après quelques minutes. Un fichier écrit sur un autre poste peut ne pas encore être synchronisé sur le partage : si l'alerte disparaît, rien à faire.
2. **Beaucoup de fichiers illisibles en même temps, extensions ou noms de fichiers modifiés, message de rançon dans le dossier ?** C'est peut-être une attaque (rançongiciel). Arrêter les saisies dans l'outil, passer en **procédure dégradée** (fiche papier ci-dessus), prévenir **immédiatement le responsable de la sécurité informatique** et le service informatique, ne rien réparer soi-même. Le responsable de la sécurité informatique et le délégué à la protection des données décident des suites (notification éventuelle à la CNIL dans les 72 heures).
3. **Quelques fichiers seulement** (erreur de manipulation, incident de stockage) :
   - **Une copie de sauvegarde complète récente existe** : *Réparer depuis une copie de sauvegarde*. L'outil ne remet que les fichiers absents ou illisibles, après avoir vérifié qu'ils s'ouvrent avec la clé de l'établissement, et ne touche jamais aux fichiers présents et lisibles. Le contrôle est refait automatiquement. Si l'alerte persiste (saisies postérieures à la copie), passer au point suivant.
   - **Sinon, ou en complément** : *Copier la liste pour le service informatique* et l'envoyer (modèle ci-dessous). Le service informatique remet les fichiers à l'identique, au même chemin, depuis ses sauvegardes ; puis *Vérifier maintenant*.
4. **Fichier illisible qui ne peut pas être remplacé** : *Mettre en quarantaine*. Le fichier est déplacé dans le dossier `quarantaine` de l'outil, sans être supprimé, pour que le service informatique puisse l'examiner. La saisie qu'il contenait reste à récupérer.
5. **Récupération impossible** (fichiers absents de toutes les sauvegardes) : vérifier les mesures des patients concernés (dates indiquées dans le détail) avec le dossier patient, **ressaisir ce qui doit l'être** avec les heures réelles, puis *Prendre acte* avec un **motif obligatoire** (par exemple : « fichiers absents des sauvegardes, ticket informatique n° …, saisies refaites le … »). L'alerte est close pour ces fichiers ; la décision est enregistrée au journal et listée dans *Informations* (elle peut être annulée). Toute nouvelle anomalie déclenche une nouvelle alerte.
6. **Consigner l'incident** : date, fichiers concernés, cause connue, actions menées. Une perte de données de santé, même sans attaque, peut constituer une violation de données : en informer le délégué à la protection des données.

### Quand prévenir le responsable de la sécurité informatique

- dès qu'un grand nombre de fichiers devient illisible en même temps, ou que des fichiers ont été renommés ou chiffrés ;
- quand des fichiers ont disparu sans explication (aucune manipulation connue) ;
- quand un fichier remis par le service informatique est refusé par l'outil (« ne s'ouvre pas avec la clé actuelle ») alors qu'il provient bien des sauvegardes du dossier.

### Modèle de message au service informatique

La liste copiée depuis l'outil ne contient que des chemins de fichiers, des dates et des identifiants de connexion : aucune donnée de patient. Elle peut être jointe à un ticket.

```
Objet : Restauration de fichiers — outil de suivi isolement et contention

Bonjour,

Le contrôle d'intégrité de l'outil de suivi des mesures d'isolement et de contention
(dossier réseau : \\serveur\partage\SuiviIsoCont) signale des fichiers absents ou illisibles.

Pouvez-vous rechercher dans les sauvegardes les fichiers listés ci-dessous (version la plus
récente précédant l'incident) et les remettre à l'identique, au même chemin, sans les
ouvrir, les renommer ni les convertir ? Les fichiers sont chiffrés ; les autres fichiers du
dossier ne doivent pas être modifiés. Merci d'indiquer ceux qui sont introuvables.

[coller ici la liste copiée depuis Administration → Informations]

Merci de nous prévenir une fois la restauration faite : nous relancerons le contrôle.

[Nom, fonction, service, téléphone]
```

## Restauration après incident sur le dossier

1. Service informatique : restaurer le dossier (ou les fichiers manquants) depuis la sauvegarde.
2. Les fichiers de saisie sont indépendants : une restauration partielle est sans danger. Le dossier `instantanes` peut être supprimé : il est reconstruit automatiquement. Les dossiers `coffre-historique` et `reperes` doivent être restaurés avec le reste.
3. *Administration → Informations → Vérifier maintenant* : l'application signale les fichiers encore illisibles ou manquants (voir « Alerte d'intégrité » ci-dessus).
4. Ressaisir ce qui a été fait depuis la sauvegarde, avec les heures réelles, puis prendre acte des pertes définitives.

## Saisies en conflit

Deux agents ont modifié la même donnée en même temps (par exemple deux heures de fin différentes). Un cadre ouvre *Journal → Saisies en conflit à arbitrer* et choisit la saisie à garder. L'autre est annulée, avec un motif tracé.

## Test annuel

Une fois par an, avec le service informatique : restaurer une sauvegarde dans un dossier de test, la déverrouiller avec la clé du coffre puis avec le code de secours, et consigner le résultat. Restaurer aussi la dernière copie de sauvegarde complète dans un dossier vide, et la copie sous scellé. Renouveler ensuite le code de secours, puis refaire la copie sous scellé.
