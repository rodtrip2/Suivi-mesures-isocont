# Kit de déploiement

Tout ce qu'il faut pour présenter, valider, installer et exploiter Suivi-mesures-isocont dans un établissement autorisé en psychiatrie. Les documents existent en Markdown (modifiables) et en PDF (dossier [`pdf/`](pdf/)).

| Document | Pour qui | Usage |
| --- | --- | --- |
| [01 — Fiche projet](01-fiche-projet.md) | Direction, direction des soins, encadrement, instances | Présenter le projet et obtenir les décisions |
| [02 — Fiche technique](02-fiche-technique-informatique.md) | Service informatique (DSI ou direction du numérique), responsable de la sécurité informatique (RSSI) | Architecture, sécurité, prérequis, recette technique |
| [03 — Guide d'installation](03-guide-installation.md) | Service informatique, administrateur fonctionnel | Mise en service pas à pas |
| [04 — Procédures de secours](04-procedures-secours.md) | Administrateur, cadres, service informatique | Mots de passe, clés, départs, panne, restauration ; fiche papier dégradée |
| [05 — Éléments RGPD et analyse d'impact (AIPD)](05-elements-rgpd-aipd.md) | Délégué à la protection des données (DPO, référent RGPD) | Fiche du registre des traitements et préparation de l'analyse d'impact |
| [06 — Guide utilisateur](06-guide-utilisateur.md) | IDE, secrétariat, cadres | Formation des équipes |
| [08 — Guide pratique IDE et AS](08-guide-ide-as.md) | IDE, aides-soignant(e)s | Les gestes du quotidien avec captures : créer une mesure, pause et reprise, tiers, décompte et envoi au JLD, surveillance en CSI, fin |
| [09 — Dossier de secours copié par robocopy](09-dossier-secours-robocopy.md) | Service informatique | Copie automatique des données vers un second serveur (tâche planifiée, script `outils/miroir-robocopy.ps1`), retour après une panne |
| [07 — Reprise à partir du registre](07-modele-import-registre.md) | Administrateur fonctionnel, cadres | Format du registre à importer, reconstitution des mesures, contrôles avant import |

## Parcours de déploiement

1. **Présenter** la fiche projet (01) à la direction, la fiche technique (02) au service informatique, les éléments RGPD (05) au délégué à la protection des données.
2. **Valider** : mode d'hébergement, registre des traitements, analyse d'impact, statut du registre légal.
3. **Installer** selon le guide (03) et faire la recette.
4. **Former** les équipes avec le guide utilisateur (06) et le guide pratique des IDE et AS (08) ; imprimer les procédures de secours (04).
5. **Piloter** dans une unité, puis étendre.

Pour adapter les documents à votre établissement (référents, chemins du partage, adresse intranet), modifiez les fichiers Markdown puis régénérez les PDF : `python3 scripts/kit-pdf.py`.
