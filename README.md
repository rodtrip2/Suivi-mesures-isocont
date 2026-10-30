# Suivi-mesures-isocont

Application web de suivi des mesures d'isolement et de contention en psychiatrie, successeur web du classeur Excel/VBA [Suivi_Isolement_Contention](https://github.com/rodtrip2/Suivi_Isolement_Contention) (V1.3).

> **Statut : prototype (v0.1).** Démonstration en ligne : https://rodtrip2.github.io/Suivi-mesures-isocont/ — choisir « Mode démonstration ».
> Aucune donnée réelle ne doit être utilisée avant validation par la DSI et le DPO de l'établissement.

## Positionnement

Le DPI de l'établissement couvrira la prescription médicale et la surveillance infirmière des mesures. Cet outil est un **outil parallèle**, centré sur ce que le DPI ne fait pas correctement :

1. **Suivi des durées** des mesures et des cumuls.
2. **Saisine du JLD** : anticipation des échéances, préparation et export.
3. **Registre anonymisé** (art. L3222-5-1 CSP) et statistiques présentables aux instances.

Il ne remplace pas le DPI : la surveillance clinique reste dans le DPI. L'outil conserve en revanche la traçabilité des agents présents par demi-journée, nécessaire au registre anonymisé.

## Utilisateurs

| Rôle | Actions |
| --- | --- |
| IDE | Report des décisions médicales de **début** et de **fin** de mesure (psychiatre décisionnaire, date, heure), traçabilité des agents par demi-journée, report de l'information des tiers, envois et suivi JLD (droit permanent, usage prévu le week-end et en l'absence de la secrétaire) |
| Secrétaire | Envois et suivi JLD (saisines, décisions reçues, export) en semaine |
| Cadre de santé | Tableau de bord, suivi des durées et échéances, registre anonymisé, statistiques, comptes du service |
| Administrateur | Paramétrage, création de service, clés de secours, rotation de clé |

- Les psychiatres ne sont pas utilisateurs à ce stade.
- L'information des tiers est faite par le psychiatre, en dernier recours par l'IDE : l'IDE la reporte en précisant qui l'a faite.
- Le cadre de santé cumule actuellement le rôle d'administrateur ; les deux rôles restent séparables (un utilisateur peut porter plusieurs rôles).

## Principes d'architecture

- **Application statique** (HTML/CSS/JavaScript, sans serveur), déployable au choix sur GitHub Pages (démonstration), l'intranet de l'établissement en HTTPS (production) ou un partage réseau (repli).
- **Les données ne quittent jamais le réseau de l'établissement** : elles sont stockées dans un dossier du partage réseau, lu et écrit par le navigateur (API File System Access, Edge ou Chrome).
- **Chiffrement côté poste** (Web Crypto, AES-GCM 256) avec chiffrement en enveloppe : déblocage par mot de passe, YubiKey (WebAuthn PRF) ou code de secours papier.
- **Saisie simultanée sans perte** : journal d'événements en ajout seul, un fichier chiffré par saisie, détection des conflits (instantanés consolidés à venir).
- **Règles légales isolées et testées** : échéances JLD calculées depuis le début de la mesure, levée JLD sans clôture automatique, remise à zéro des cumuls uniquement en fin de mesure.

Détails : [docs/architecture.md](docs/architecture.md).

## Essayer le prototype

1. Ouvrir la [démonstration](https://rodtrip2.github.io/Suivi-mesures-isocont/) dans Edge ou Chrome (Firefox fonctionne en mode démonstration, pas pour un dossier réseau).
2. Choisir **Mode démonstration**, créer le compte cadre/administrateur et laisser cochée l'option « données fictives ».
3. Noter le code de secours affiché (exercice), puis explorer : tableau de bord, mesures, JLD, surveillance CSI, registre, journal.
4. Pour voir la **saisie simultanée** : ouvrir un second onglet, créer un compte IDE dans Administration, se connecter avec lui dans l'autre onglet. Les saisies de chaque onglet apparaissent dans l'autre en quelques secondes ; deux fins saisies en même temps sur la même mesure produisent un conflit à arbitrer dans le Journal.

Les données de démonstration restent dans le stockage privé du navigateur. Pour un usage réel, l'application s'ouvre sur un **dossier du partage réseau** (bouton « Ouvrir le dossier réseau du service »).

### Contenu du prototype

| Fonction | État |
| --- | --- |
| Report des décisions de début et de fin, lieux CSI, modes d'hospitalisation, protection juridique | fait |
| Échéances JLD (cumul 15 j, cycles, rythme long, levée) — calculs identiques à la V1.3 | fait, testé |
| Envois JLD (secrétaire, IDE en permanence), information des tiers par cycle | fait |
| Traçabilité des professionnels par poste (2 emplacements par poste couvert) | fait |
| Registre anonymisé A à E, découpage isolement / contention en CSI, export CSV | fait, testé |
| Journal chiffré en ajout seul, saisie simultanée, détection et arbitrage des conflits | fait, testé |
| Coffre : mot de passe, YubiKey (WebAuthn PRF), code de secours ; comptes et rôles cumulables | fait |
| Corrections et annulations tracées (cadre) | fait |
| Instantanés consolidés, import du classeur V1.3, décompte JLD, statistiques, export PDF | à venir |

## Arborescence

```
index.html          redirection vers app/ (GitHub Pages)
app/
  index.html        page unique, politique de sécurité stricte (aucune connexion sortante)
  css/app.css
  js/rules.js       moteur de règles légales (échéances, cumuls) — aussi exécuté par les tests
  js/model.js       reconstitution de l'état depuis le journal, conflits, registre, postes
  js/crypto.js      chiffrement AES-GCM, coffre, PBKDF2, WebAuthn PRF
  js/store.js       dossier réseau ou stockage de démonstration
  js/session.js     comptes, déblocage, journal, synchronisation
  js/ui.js          interface
  js/demo.js        données fictives
tests/              tests automatiques (npm test)
docs/               architecture
```

Aucune dépendance, aucune étape de construction : les fichiers sont servis tels quels. Les tests nécessitent Node.js 20 ou plus récent (`npm test`).

## Licence

Tous droits réservés, en attendant une décision sur la licence (le code développé dans le cadre des fonctions appartient en principe à l'établissement).
