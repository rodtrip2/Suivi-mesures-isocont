# Procédures de secours et d'exploitation

*À imprimer et à ranger avec le code de secours. Chaque procédure indique qui agit.*

## Mot de passe oublié par un agent — administrateur

1. Vérifier l'identité de l'agent.
2. *Administration → Comptes → Réinitialiser le mot de passe* sur le compte de l'agent. Un mot de passe provisoire est proposé ; l'ancien mot de passe cesse aussitôt de fonctionner.
3. Imprimer la fiche de remise et la donner en main propre (jamais par messagerie).
4. À sa connexion suivante, l'agent doit choisir un nouveau mot de passe personnel avant de continuer. L'opération est tracée dans le journal, sans le mot de passe.

## Mot de passe de l'administrateur oublié

1. Déverrouiller avec une **clé de sécurité** d'administration (*Déverrouiller avec une clé de sécurité*), ou à défaut avec le **code de secours** (*Mot de passe perdu ? Utiliser le code de secours*).
2. La session ouverte est une session d'administration de secours : *Administration → Comptes → Réinitialiser le mot de passe* du compte administrateur.
3. Si le code de secours a été utilisé : *Nouveau code de secours*, puis nouvelle enveloppe scellée au coffre. L'ancien code est invalidé.

## Perte ou vol d'une clé de sécurité

1. *Administration → Moyens de déblocage → Retirer* la clé concernée.
2. Enregistrer une clé de remplacement.
3. Vérifier qu'il reste au moins deux clés d'administration ou une clé et le code de secours.

## Départ d'un agent

1. *Administration → Comptes → Modifier* : décocher *Compte actif*. Son mot de passe est retiré du coffre : il ne déverrouille plus rien.
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

## Restauration après incident sur le dossier

1. DSI : restaurer le dossier (ou les fichiers manquants) depuis la sauvegarde.
2. Les fichiers de saisie sont indépendants : une restauration partielle est sans danger. Le dossier `instantanes` peut être supprimé : il est reconstruit automatiquement.
3. Ouvrir l'onglet *Journal* : l'application signale les fichiers illisibles ou les saisies manquantes.
4. Ressaisir ce qui a été fait depuis la sauvegarde, avec les heures réelles.

## Saisies en conflit

Deux agents ont modifié la même donnée en même temps (par exemple deux heures de fin différentes). Un cadre ouvre *Journal → Saisies en conflit à arbitrer* et choisit la saisie à garder. L'autre est annulée, avec un motif tracé.

## Test annuel

Une fois par an, avec la DSI : restaurer une sauvegarde dans un dossier de test, la déverrouiller avec la clé du coffre puis avec le code de secours, et consigner le résultat. Renouveler ensuite le code de secours.
