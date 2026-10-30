# Suivi-mesures-isocont

Application web de suivi des mesures d'isolement et de contention en psychiatrie, successeur web du classeur Excel/VBA [Suivi_Isolement_Contention](https://github.com/rodtrip2/Suivi_Isolement_Contention) (V1.3).

> Statut : cadrage. Aucune donnée réelle ne doit être utilisée avant validation par la DSI et le DPO de l'établissement.

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
- **Saisie simultanée sans perte** : journal d'événements en ajout seul, un fichier chiffré par saisie, détection des conflits, instantanés consolidés.
- **Règles légales isolées et testées** : échéances JLD calculées depuis le début de la mesure, levée JLD sans clôture automatique, remise à zéro des cumuls uniquement en fin de mesure.

Détails : [docs/architecture.md](docs/architecture.md).

## Arborescence prévue

```
app/        application statique (index.html, modules JS, styles)
  core/     moteur de règles (échéances, cumuls, registre) — sans dépendance à l'interface
  store/    journal d'événements, instantanés, accès au dossier réseau
  crypto/   chiffrement, coffre de clés, WebAuthn PRF
  ui/       écrans
tests/      tests automatiques des règles métier (cas de référence)
docs/       documentation d'architecture et d'exploitation
```

## Licence

Dépôt privé, tous droits réservés, en attendant une décision sur la licence.
