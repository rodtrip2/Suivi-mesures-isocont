# Suivi-mesures-isocont

**Suivi des mesures d'isolement et de contention en psychiatrie** — durées et cumuls, échéances du juge des libertés et de la détention (JLD), information des tiers, registre anonymisé (art. L. 3222-5-1 du code de la santé publique) et rapport annuel.

Application web statique, gratuite et libre (EUPL-1.2) : les données restent dans un dossier du réseau de l'établissement, chiffrées sur le poste avant d'y être écrites. Aucun serveur à installer, aucune connexion sortante.

- **Démonstration** (données fictives) : https://rodtrip2.github.io/Suivi-mesures-isocont/ → *Mode démonstration*
- **Kit de déploiement** pour tout établissement : [`kit/`](kit/) — fiche projet, fiche technique DSI, guide d'installation, procédures de secours, éléments RGPD/AIPD, guide utilisateur (Markdown et PDF)

> Aucune donnée réelle ne doit être saisie avant la validation de l'établissement (DSI, DPO, direction). En mode démonstration, les données restent dans le navigateur.

## Positionnement

Le DPI couvre la prescription médicale et la surveillance infirmière. Cet outil complète ce qu'il fait mal : **suivi des durées, calendrier JLD, registre anonymisé et statistiques**. Les IDE y reportent les décisions médicales de début et de fin de mesure ; les psychiatres ne sont pas utilisateurs.

## Fonctions

| Fonction | Rôles |
| --- | --- |
| Report des décisions de début et de fin, changement de lieu, patients et mode d'hospitalisation | IDE, AS, cadre |
| Échéances JLD calculées (cumul 15 jours, cycles, rythme des mesures longues, mainlevée), alertes | tous |
| Envois JLD (information, saisine, décision), décompte imprimable | secrétaire, IDE et AS (en permanence, usage prévu le week-end) |
| Information des tiers par cycle (psychiatre, IDE en dernier recours) | IDE, AS, cadre |
| Professionnels chargés de la surveillance en CSI, par poste | IDE, AS, cadre |
| Registre anonymisé A–E, statistiques annuelles N/N-1, exports | cadre |
| Corrections et annulations tracées, arbitrage des saisies concurrentes | cadre |
| **Mode formation** : bascule provisoire d'un poste sur un jeu de données fictives chiffré à part (sous-dossier du partage), avec les vrais comptes ; bandeau violet, retour automatique | formateur |
| Comptes un par un ou **en lot** depuis une liste d'agents, rôles cumulables, **services affectés par compte**, mot de passe provisoire **à changer à la première connexion**, réinitialisation des mots de passe perdus, clés YubiKey, code de secours, paramétrage, import du classeur Excel V1.3 | administrateur |

Chaque agent (hors administrateur) ne voit que les services qui lui sont affectés, à la connexion comme à la création d'une mesure.

## Principes techniques

- **HTML, CSS et JavaScript sans dépendance ni étape de construction** ; servi par l'intranet (recommandé), GitHub Pages (démonstration) ou ouvert depuis un partage (repli).
- **Stockage** : un dossier du partage réseau, lu et écrit par le navigateur (API File System Access, Edge ou Chrome).
- **Chiffrement** AES-GCM 256 côté poste, en enveloppe : mot de passe (PBKDF2, 600 000 itérations), clé FIDO2 (WebAuthn PRF), code de secours papier.
- **Journal d'événements en ajout seul** : une saisie = un fichier chiffré, jamais modifié ; saisie simultanée sans perte ; conflits signalés ; instantanés mensuels.
- **Règles légales isolées et testées** (`npm test`, Node.js ≥ 20).

Détails : [fiche technique](kit/02-fiche-technique-dsi.md) et [architecture](docs/architecture.md). Successeur du classeur Excel/VBA [Suivi_Isolement_Contention](https://github.com/rodtrip2/Suivi_Isolement_Contention) (V1.3), dont il reprend les calculs.

## Arborescence

```
app/                  l'application (seul dossier à déployer)
  index.html          page unique, politique de sécurité stricte
  EMPREINTES-SHA256.txt  empreintes des fichiers de la version
  js/rules.js         règles légales : cumuls, échéances JLD
  js/model.js         état reconstitué depuis le journal, registre, statistiques, décompte
  js/crypto.js        chiffrement, coffre, WebAuthn PRF
  js/store.js         dossier réseau, instantanés
  js/session.js       comptes, services, journal, synchronisation
  js/comptes.js       analyse des listes d'agents (création en lot)
  js/demo.js          données fictives (démonstration et jeu de formation)
  js/xlsx.js, js/import-v13.js   lecture et import du classeur Excel V1.3
  js/ui*.js           interface
kit/                  kit de déploiement (Markdown + PDF)
docs/                 architecture
scripts/              empreintes SHA-256, génération des PDF du kit
tests/                tests automatiques (règles, modèle, chiffrement, stockage, import)
```

## Développement

```
npm test                       # tests automatiques (Node.js 20 ou plus récent)
python3 -m http.server 8765    # puis http://localhost:8765/app/
node scripts/empreintes.mjs    # avant chaque version
python3 scripts/kit-pdf.py     # régénère les PDF du kit
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [CHANGELOG.md](CHANGELOG.md).

## Licence

Copyright © 2026 Roddy Ricart et les contributeurs. Distribué sous la **Licence publique de l'Union européenne v1.2 (EUPL-1.2)** — voir [LICENSE](LICENSE) et [NOTICE](NOTICE). Logiciel fourni sans garantie ; il ne constitue pas un dispositif médical et ne remplace ni le DPI ni la décision médicale.
