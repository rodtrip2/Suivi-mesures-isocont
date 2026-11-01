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
2. DSI : retirer l'agent du groupe ayant accès au dossier réseau.
3. Si l'agent détenait une clé de sécurité : la retirer.
4. Les saisies passées restent attribuées à son nom dans le journal.

## Suspicion de compromission

1. Désactiver les comptes concernés, retirer les clés de sécurité suspectes.
2. Générer un nouveau code de secours et faire changer les mots de passe des autres comptes.
3. Informer le RSSI et le DPO (éventuelle violation de données à notifier).
4. La version 1.0 ne propose pas de rotation automatique de la clé de données. Si l'on craint que la clé de données elle-même ait été exposée (session déverrouillée sur un poste compromis), le RSSI décide des suites, en s'appuyant sur le fait qu'une copie du dossier reste nécessaire pour l'exploiter.

## Dossier réseau ou application indisponible — procédure dégradée

1. Poursuivre la traçabilité **sur papier** avec la fiche ci-dessous (une par mesure), en reportant les heures réelles.
2. Les échéances JLD se calculent à la main à partir du début de la mesure : information à 48 h (isolement) ou 24 h (contention) de cumul sur 15 jours, saisine à 72 h ou 48 h, décision à 96 h ou 72 h. En cas de doute, informer le JLD sans attendre.
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
4. À défaut, demander à la DSI de restaurer `coffre.json` depuis la sauvegarde du partage.
5. Ensuite : *Administration → Informations → Vérifier maintenant*, puis télécharger une nouvelle copie sous scellé.

## Perte du dossier entier

1. Créer un dossier vide sur le partage (droits limités aux agents habilités) et l'ouvrir dans l'outil.
2. Sur l'écran d'initialisation, *Restaurer une copie de sauvegarde dans ce dossier* : choisir la dernière copie de sauvegarde complète téléchargée par l'administrateur.
3. Se connecter, vérifier l'état des données, puis ressaisir ce qui a été fait depuis la date de la copie (procédure papier).

## Alerte d'intégrité

Le tableau de bord signale « Intégrité des données » quand des saisies ont disparu (repère d'un agent non retrouvé, fichier chargé qui n'est plus sur le partage), quand des fichiers sont illisibles ou quand le chaînage des saisies présente un trou. Prévenir l'administrateur et la DSI : restaurer les fichiers manquants depuis la sauvegarde (étapes ci-dessous), puis *Vérifier maintenant*. Ne pas ressaisir avant d'avoir tenté la restauration, pour ne pas créer de doublons.

## Restauration après incident sur le dossier

1. DSI : restaurer le dossier (ou les fichiers manquants) depuis la sauvegarde.
2. Les fichiers de saisie sont indépendants : une restauration partielle est sans danger. Le dossier `instantanes` peut être supprimé : il est reconstruit automatiquement. Les dossiers `coffre-historique` et `reperes` doivent être restaurés avec le reste.
3. Ouvrir l'onglet *Journal* : l'application signale les fichiers illisibles ou les saisies manquantes.
4. Ressaisir ce qui a été fait depuis la sauvegarde, avec les heures réelles.

## Saisies en conflit

Deux agents ont modifié la même donnée en même temps (par exemple deux heures de fin différentes). Un cadre ouvre *Journal → Saisies en conflit à arbitrer* et choisit la saisie à garder. L'autre est annulée, avec un motif tracé.

## Test annuel

Une fois par an, avec la DSI : restaurer une sauvegarde dans un dossier de test, la déverrouiller avec la clé du coffre puis avec le code de secours, et consigner le résultat. Restaurer aussi la dernière copie de sauvegarde complète dans un dossier vide, et la copie sous scellé. Renouveler ensuite le code de secours, puis refaire la copie sous scellé.
