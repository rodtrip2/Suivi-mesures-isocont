# Contribuer

Les contributions sont bienvenues : signalement d'anomalie, proposition d'évolution, correction, adaptation à un autre établissement.

## Règles du projet

1. **Fidélité juridique.** Les règles de l'article L. 3222-5-1 du code de la santé publique sont reproduites telles quelles. Toute modification d'un calcul (cumuls, échéances, registre) s'accompagne d'un test et d'une référence au texte.
2. **Un seul chemin de calcul par donnée.** Les règles vivent dans `app/js/rules.js` et `app/js/model.js`, testables sans navigateur ; l'interface ne recalcule rien.
3. **Aucune donnée réelle** dans le dépôt, les tests, les captures ou les tickets. Les données d'exemple sont marquées « (fictif) ».
4. **Aucune dépendance distante.** Pas de bibliothèque chargée depuis Internet, pas de requête réseau : la politique de sécurité de la page l'interdit.
5. **Pas d'`innerHTML`** avec des données saisies : construire le DOM avec `h()`.
6. **Journal en ajout seul.** On n'efface ni ne modifie jamais un événement ; on en ajoute un.
7. **Compatibilité des données.** Une version doit lire les dossiers créés par les versions précédentes.

## Avant de proposer une modification

```
npm test
```

Les nouveaux fichiers commencent par `// SPDX-License-Identifier: EUPL-1.2`. En contribuant, vous acceptez que votre contribution soit distribuée sous la licence EUPL-1.2.

## Signaler une faille de sécurité

Ne publiez pas le détail dans un ticket public : contactez d'abord le mainteneur par la messagerie de GitHub.
