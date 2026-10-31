# Guide d'installation et de mise en service

*Pour la DSI (étapes 1 à 3) et l'administrateur fonctionnel, en général un cadre de santé (étapes 4 à 7).*

## 1. Récupérer et vérifier l'application (DSI)

1. Télécharger la version voulue depuis https://github.com/rodtrip2/Suivi-mesures-isocont (bouton *Code → Download ZIP*, ou page des versions).
2. Seul le dossier `app/` est nécessaire au fonctionnement.
3. Vérifier les empreintes en PowerShell, depuis le dossier décompressé :

   ```powershell
   Get-ChildItem -Recurse .\app -File | Get-FileHash -Algorithm SHA256 | Format-Table Hash, Path
   ```

   Comparer avec `app/EMPREINTES-SHA256.txt`. Toute différence doit être expliquée avant la mise en service.

## 2. Créer le dossier de données (DSI)

1. Créer un dossier vide sur un partage sauvegardé, par exemple `\\serveur\donnees\SuiviIsoCont`.
2. Droits NTFS : **Modifier** pour le groupe des utilisateurs de l'outil (IDE, secrétariat, cadres des unités concernées) ; retirer l'héritage des groupes plus larges.
3. Vérifier que le dossier est inclus dans les sauvegardes.
4. Rendre le dossier accessible depuis les postes : lecteur réseau mappé ou chemin UNC.

## 3. Publier l'application (DSI)

**Intranet (recommandé)** — copier le contenu de `app/` dans un site web statique servi en HTTPS, par exemple `https://intranet.etablissement.fr/isocont/`. Ajouter les en-têtes conseillés dans la fiche technique (section 3). Diffuser le lien sur les postes (favori, raccourci).

**Repli sans serveur web** — copier `app/` dans un dossier en lecture seule du partage et ouvrir `index.html` avec Edge ou Chrome. Les clés de sécurité ne fonctionnent pas dans ce mode.

**Démonstration** — https://rodtrip2.github.io/Suivi-mesures-isocont/, en *mode démonstration* uniquement, sans aucune donnée réelle.

Test sur un poste type : ouvrir le lien, cliquer *Ouvrir le dossier réseau du service*, choisir le dossier créé à l'étape 2. L'écran *Initialiser le dossier* doit s'afficher.

## 4. Initialiser le dossier (administrateur)

1. Sur l'écran *Initialiser le dossier* : nom affiché, identifiant (par exemple `prenom.nom`), mot de passe d'au moins 12 caractères. Ce premier compte est **cadre de santé et administrateur**.
2. Ne pas cocher *Charger des données fictives*.
3. Le **code de secours** s'affiche une seule fois : l'imprimer, le placer sous enveloppe scellée, datée et signée, et le remettre au coffre désigné (direction des soins, par exemple). Cocher la case de confirmation.

## 5. Sécuriser l'accès d'administration

Onglet *Administration → Moyens de déblocage* (site servi en HTTPS uniquement) :

1. *Enregistrer une clé de sécurité* : brancher la première YubiKey, la nommer (« YubiKey cadre »), la toucher quand le navigateur le demande.
2. Recommencer avec une seconde clé (« YubiKey coffre »), à conserver avec le code de secours.
3. Tester : *Verrouiller*, puis *Déverrouiller avec une clé de sécurité*.

## 6. Paramétrer (administrateur)

Onglet *Administration* :

| Section | À renseigner |
| --- | --- |
| Établissement et services | Nom de l'établissement (en-tête des documents), services (code ; libellé), chambres de soins intensifs par service, liste des psychiatres. |
| Postes de surveillance | Postes par défaut (matin, après-midi, nuit…) ou propres à un service (par exemple jour et nuit en 12 h). |
| Règles légales | Valeurs par défaut conformes aux textes en vigueur : ne les modifier qu'en cas d'évolution réglementaire. |
| Registre et décompte | Dernier numéro du registre papier de l'année en cours, si l'outil démarre en cours d'année ; titres du décompte JLD. |
| Comptes | Un compte par agent, avec ses rôles (IDE, AS, secrétaire, cadre, administrateur) et ses **services affectés**. Pour toute une équipe : *Créer des comptes en lot…* (voir ci-dessous). Chaque compte reçoit un mot de passe provisoire tiré au hasard ; l'agent doit le remplacer à sa première connexion. |

### Créer les comptes d'une équipe en une fois

1. Préparer la liste dans un tableur, une ligne par agent, colonnes : **Nom affiché**, **Identifiant** (facultatif), **Rôles** (facultatif), **Services** (facultatif). Exemple :

   | Nom | Identifiant | Rôles | Services |
   | --- | --- | --- | --- |
   | Marie DUPONT | | IDE | U1 |
   | Paul MARTIN | | AS | U1, U2 |
   | Jeanne PETIT | | Secrétaire | tous |

2. *Administration → Créer des comptes en lot…* : coller les cellules copiées, ou choisir le fichier enregistré au format CSV. Choisir le rôle et les services par défaut, appliqués aux colonnes vides.
3. Vérifier l'aperçu : identifiants proposés (prenom.nom), lignes en erreur (rôle ou service inconnu, identifiant déjà pris). Les lignes en erreur ne sont pas créées.
4. *Créer les comptes*, puis **imprimer les fiches de remise** (une par agent, avec identifiant et mot de passe provisoire). Ces mots de passe ne seront plus affichés.
5. Remettre chaque fiche en main propre. À sa première connexion, l'agent choisit son mot de passe personnel.

### Préparer la formation

Créer au moins un compte avec le rôle *Formateur* (il peut être cumulé avec un autre rôle). Le formateur crée le jeu de formation depuis le bouton *Mode formation* : il est rangé dans le sous-dossier `formation` du dossier de données, sans action de la DSI.

Reprise d'un classeur Excel V1.3 : *Administration → Importer un classeur…*. Le rapport d'import liste les lignes ignorées, les points à vérifier et les éventuels écarts d'échéances JLD.

## 7. Recette avant production

- [ ] Deux postes connectés en même temps : une saisie sur l'un apparaît sur l'autre en moins de 10 secondes.
- [ ] Création d'une mesure de test, information du tiers, envoi JLD, décompte imprimé, fin de mesure.
- [ ] Échéances JLD vérifiées sur un cas connu (par exemple un isolement débuté le 1er à 8 h 45 sans cumul antérieur : information avant le 3 à 8 h 45, saisine avant le 4, décision avant le 5).
- [ ] Un compte IDE ne voit que ses services.
- [ ] Première connexion d'un agent : le mot de passe provisoire doit être remplacé avant d'accéder à l'application.
- [ ] Mot de passe oublié : réinitialisation par l'administrateur ; l'ancien mot de passe est refusé, le nouveau est provisoire.
- [ ] Déverrouillage par le code de secours, puis génération d'un nouveau code (l'ancien est ainsi invalidé après le test).
- [ ] Annulation de la mesure de test (onglet *Mesures → Détail*, par un cadre).
- [ ] Procédure dégradée papier imprimée et rangée dans chaque unité.

## 8. Mise en production

1. Former les agents (20 à 30 minutes, guide utilisateur).
2. Démarrer par une unité pilote, en parallèle de l'outil antérieur pendant quelques semaines, en comparant les échéances.
3. Faire le point avec la DSI, le DPO et l'encadrement avant d'étendre.
