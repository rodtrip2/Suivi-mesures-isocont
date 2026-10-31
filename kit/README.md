# Kit de déploiement

Tout ce qu'il faut pour présenter, valider, installer et exploiter Suivi-mesures-isocont dans un établissement autorisé en psychiatrie. Les documents existent en Markdown (modifiables) et en PDF (dossier [`pdf/`](pdf/)).

| Document | Pour qui | Usage |
| --- | --- | --- |
| [01 — Fiche projet](01-fiche-projet.md) | Direction, direction des soins, encadrement, instances | Présenter le projet et obtenir les décisions |
| [02 — Fiche technique](02-fiche-technique-dsi.md) | DSI, RSSI | Architecture, sécurité, prérequis, recette technique |
| [03 — Guide d'installation](03-guide-installation.md) | DSI, administrateur fonctionnel | Mise en service pas à pas |
| [04 — Procédures de secours](04-procedures-secours.md) | Administrateur, cadres, DSI | Mots de passe, clés, départs, panne, restauration ; fiche papier dégradée |
| [05 — Éléments RGPD et AIPD](05-elements-rgpd-aipd.md) | DPO | Fiche du registre des traitements et préparation de l'analyse d'impact |
| [06 — Guide utilisateur](06-guide-utilisateur.md) | IDE, secrétariat, cadres | Formation des équipes |
| [07 — Reprise à partir du registre](07-modele-import-registre.md) | Administrateur fonctionnel, cadres | Format du registre à importer, reconstitution des mesures, contrôles avant import |

## Parcours de déploiement

1. **Présenter** la fiche projet (01) à la direction, la fiche technique (02) à la DSI, les éléments RGPD (05) au DPO.
2. **Valider** : mode d'hébergement, registre des traitements, analyse d'impact, statut du registre légal.
3. **Installer** selon le guide (03) et faire la recette.
4. **Former** les équipes avec le guide utilisateur (06) ; imprimer les procédures de secours (04).
5. **Piloter** dans une unité, puis étendre.

Pour adapter les documents à votre établissement (référents, chemins du partage, adresse intranet), modifiez les fichiers Markdown puis régénérez les PDF : `python3 scripts/kit-pdf.py`.
