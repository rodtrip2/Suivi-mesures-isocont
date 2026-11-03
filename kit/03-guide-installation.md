# Guide d'installation et de mise en service

*Pour le service informatique — DSI ou direction du numérique, selon l'établissement — (étapes 1 à 3) et l'administrateur fonctionnel, en général un cadre de santé (étapes 4 à 7).*

## 1. Récupérer et vérifier l'application (service informatique)

1. Télécharger la version voulue depuis https://github.com/rodtrip2/Suivi-mesures-isocont (bouton *Code → Download ZIP*, ou page des versions).
2. Seul le dossier `app/` est nécessaire au fonctionnement.
3. Vérifier les empreintes en PowerShell, depuis le dossier décompressé :

   ```powershell
   Get-ChildItem -Recurse .\app -File | Get-FileHash -Algorithm SHA256 | Format-Table Hash, Path
   ```

   Comparer avec `app/EMPREINTES-SHA256.txt`. Toute différence doit être expliquée avant la mise en service.

## 2. Créer le dossier de données (service informatique)

1. Créer un dossier vide sur un partage sauvegardé, par exemple `\\serveur\donnees\SuiviIsoCont`.
2. Droits NTFS : **Modifier** pour le groupe des utilisateurs de l'outil (IDE, secrétariat, cadres des unités concernées) ; retirer l'héritage des groupes plus larges.
3. Vérifier que le dossier est inclus dans les sauvegardes, avec ces exigences minimales à demander au service informatique :
   - sauvegarde **au moins quotidienne** du dossier, versions conservées **30 jours ou plus** ;
   - **une copie hors ligne ou non modifiable** (protection contre un rançongiciel) ;
   - droits du dossier limités aux comptes des agents habilités (pas de suppression possible par d'autres utilisateurs) ;
   - test de restauration annuel (voir les procédures de secours).
   Après l'initialisation, l'administrateur télécharge la **copie du coffre sous scellé** (*Administration → Informations*) et la range au coffre avec le code de secours.
4. Rendre le dossier accessible depuis les postes : lecteur réseau mappé ou chemin UNC.

## 3. Publier l'application (service informatique)

**Intranet (recommandé)** — copier le contenu de `app/` dans un site web statique servi en HTTPS, par exemple `https://intranet.etablissement.fr/isocont/`. Ajouter les en-têtes conseillés dans la fiche technique (section 3). Diffuser le lien sur les postes (favori, raccourci).

**Raccourci et icône, dans une fenêtre séparée.** L'application fournit son icône (`app/img/icone.ico`, et des images PNG pour le navigateur) et se déclare comme application (manifeste, affichage « standalone ») : installée, elle s'ouvre **dans sa propre fenêtre**, sans onglets ni barre d'adresse, avec son icône dans la barre des tâches. Quatre façons de la mettre à disposition des agents :

- **depuis l'outil** (HTTPS : intranet ou page GitHub) : bouton *Installer comme application* (en-tête, écran d'accueil ou de connexion), affiché quand Edge ou Chrome le permet ; ou menu du navigateur *Applications → Installer ce site en tant qu'application* ;
- **stratégie Edge déployée par le service informatique** (recommandé, HTTPS) : la stratégie `WebAppInstallForceList` installe l'outil sur les postes choisis, avec un raccourci sur le bureau, sans action des agents. Valeur (JSON) : `[{"url": "https://intranet.etablissement.fr/isocont/app/", "default_launch_container": "window", "create_desktop_shortcut": true}]` (Chrome : même stratégie) ;
- **raccourci Windows** (toutes situations, y compris outil ouvert sans HTTPS) : clic droit sur le bureau → *Nouveau → Raccourci*, cible `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=https://intranet.etablissement.fr/isocont/app/` : l'option `--app` ouvre l'outil dans une fenêtre séparée (un simple lien l'ouvre dans un onglet). Puis *Propriétés → Changer d'icône* et choisir `icone.ico` copié sur le partage ou le poste. Pour un outil copié sur le poste, le script du document 10 crée ce raccourci ;
- **stratégie de groupe** (service informatique) : raccourci déployé sur les postes concernés (préférence *Raccourcis*, champ *Fichier d'icône* pointant vers `\\serveur\partage\isocont\img\icone.ico`).

**Repli sans serveur web** — copier `app/` dans un dossier en lecture seule du partage et ouvrir `index.html` avec Edge ou Chrome. Les clés de sécurité ne fonctionnent pas dans ce mode.

**Choix du dossier bloqué** (facultatif) : après la mise en service, l'administrateur peut empêcher l'ouverture d'autres données sur les postes (*Administration → Informations → Choix du dossier sur les postes*) ; le blocage est posé sur chaque poste à sa connexion suivante et ne se lève que par un administrateur.

**Travail hors réseau** (facultatif, postes désignés) : voir le document 10 — mise en cache de l'outil par le navigateur si l'outil est servi en HTTPS (intranet ou page GitHub), sinon copie de l'outil sur le poste par le script fourni ; copie locale des données chiffrées.

**Démonstration** — https://rodtrip2.github.io/Suivi-mesures-isocont/, en *mode démonstration* uniquement, sans aucune donnée réelle. Ouverte depuis cette page (adresse en « github.io »), l'outil vérifie à l'ouverture puis toutes les 30 minutes qu'il s'agit de la dernière version publiée et propose de recharger la page sinon (réglage *Administration → À propos → Mise à jour de l'outil*, activé par défaut). Sur l'intranet ou un partage, la vérification n'a pas lieu : la mise à jour reste faite par le service informatique, après contrôle des empreintes.

Test sur un poste type : ouvrir le lien, cliquer *Ouvrir le dossier réseau du service*, choisir le dossier créé à l'étape 2. L'écran *Initialiser le dossier* doit s'afficher.

## 4. Initialiser le dossier (administrateur)

1. Sur l'écran *Initialiser le dossier* : nom affiché, identifiant (par exemple `prenom.nom`), mot de passe d'au moins 12 caractères. Ce premier compte est **cadre de santé et administrateur**.
2. Ne pas cocher *Charger des données fictives*.
3. Le **code de secours** s'affiche une seule fois : l'imprimer, le placer sous enveloppe scellée, datée et signée, et le remettre au coffre désigné (direction des soins, par exemple). Cocher la case de confirmation.

## 5. Sécuriser l'accès d'administration

Onglet *Administration → Comptes et sécurité → Moyens de déblocage* (site servi en HTTPS uniquement) :

1. *Enregistrer une clé de sécurité* : brancher la première YubiKey, la nommer (« YubiKey cadre »), la toucher quand le navigateur le demande.
2. Recommencer avec une seconde clé (« YubiKey coffre »), à conserver avec le code de secours.
3. Tester : *Verrouiller*, puis *Déverrouiller avec une clé de sécurité*.

## 6. Paramétrer (administrateur)

Onglet *Administration* :

| Section | À renseigner |
| --- | --- |
| Établissement et services | Nom de l'établissement (en-tête des documents), services (code ; libellé), chambres de soins intensifs par service, appellation de ces lieux dans l'outil (« chambre de soins intensifs (CSI) » par défaut, ou chambre d'isolement, espace d'isolement…), liste des psychiatres, organisation des envois au JLD (texte libre affiché en tête de l'onglet *JLD*, par exemple qui fait les envois en semaine et le week-end). |
| Postes de surveillance | Postes par défaut (matin, après-midi, nuit…) ou propres à un service (par exemple jour et nuit en 12 h). |
| Règles légales | Valeurs par défaut conformes aux textes en vigueur : ne les modifier qu'en cas d'évolution réglementaire. |
| Pauses (levées temporaires) | Par défaut, la levée temporaire est active, les pauses restent comptées dans les durées, sans reprise automatique, alerte au-delà de 12 h et refus à 48 h, colonne « Levées temporaires » affichée dans le registre. Si les pauses ne sont pas déduites, la fonction peut être désactivée. Si elles le sont, choisir la portée : délais du juge des libertés et de la détention (JLD) seulement (registre et statistiques en durée réelle) ou partout. Déduire la durée des pauses du cumul reporte les échéances JLD : décision de la direction, à tracer dans le projet d'établissement. |
| Masques du décompte JLD | Un masque pour l'établissement, et si besoin un masque propre à chaque service : en-tête, destinataire, bandeau confidentiel, données d'identité, colonnes (choix et ordre), format des durées et du cumul (heures, jours, ou les deux), durée maximale d'une ligne par type de mesure, mise en évidence de la mesure actuelle ou grisé des mesures antérieures, sections (dont date d'édition et auteur, séparément), pied de page, signature, papier à en-tête (image A4 PNG ou JPEG, marges du texte). Aperçu sur un patient fictif. Pour imprimer avec le papier à en-tête : format A4, marges « par défaut » dans la fenêtre d'impression. À valider avec le greffe du JLD. |
| Onglet Patients : statistiques annuelles | Colonnes regroupant des catégories du registre (par défaut : isolement seul A–B, contention seule D–E signalée si non nulle, isolement + contention C). |
| Registre | Dernier numéro du registre papier de l'année en cours, si l'outil démarre en cours d'année. |
| Rôles et accès | Facultatif : adapter le libellé et les accès des rôles fournis (IDE, AS, secrétaire, cadre de santé), créer des rôles propres à l'établissement (ex. direction des soins, consultation seule) ; le rôle Administrateur est fixe. |
| Comptes | Un compte par agent, avec ses rôles (IDE, AS, secrétaire, cadre, administrateur, ou rôles créés) et ses **services affectés**. Pour toute une équipe : *Créer des comptes en lot…* (voir ci-dessous). Chaque compte reçoit un mot de passe provisoire tiré au hasard ; l'agent doit le remplacer à sa première connexion. |

### Créer les comptes d'une équipe en une fois

1. Préparer la liste dans un tableur, une ligne par agent, colonnes : **Nom affiché**, **Identifiant** (facultatif), **Rôles** (facultatif), **Services** (facultatif). Exemple :

   | Nom | Identifiant | Rôles | Services |
   | --- | --- | --- | --- |
   | Marie DUPONT | | IDE | U1 |
   | Paul MARTIN | | AS | U1, U2 |
   | Jeanne PETIT | | Secrétaire | tous |

2. *Administration → Comptes et sécurité → Créer des comptes en lot…* : coller les cellules copiées, ou choisir le fichier enregistré au format CSV. Choisir le rôle et les services par défaut, appliqués aux colonnes vides.
3. Vérifier l'aperçu : identifiants proposés (prenom.nom), lignes en erreur (rôle ou service inconnu, identifiant déjà pris). Les lignes en erreur ne sont pas créées.
4. *Créer les comptes*, puis **imprimer les fiches de remise** (une par agent, avec identifiant et mot de passe provisoire). Ces mots de passe ne seront plus affichés.
5. Remettre chaque fiche en main propre. À sa première connexion, l'agent choisit son mot de passe personnel.

### Préparer la formation

Le mode formation ne demande aucune installation : le jeu de données fictives est créé automatiquement dans le sous-dossier `formation` du dossier de données, à la première connexion en mode formation (ou par l'administrateur, *Administration → Comptes et sécurité → Mode formation*). Tous les comptes y ont accès par défaut ; décochez *Accès au mode formation* dans la fiche d'un compte pour le retirer.

### Reprise de l'historique

L'historique se reprend **à partir du registre du service**, quel que soit l'outil utilisé jusque-là : *Administration → Reprise des données → Importer un registre…*. Exportez le registre de votre outil (tableur, logiciel métier, dossier patient informatisé) au format CSV ou Excel ; l'écran d'import propose la correspondance des colonnes, et un modèle est téléchargeable. Le format attendu et la reconstitution des mesures sont détaillés dans la fiche 07 — Reprise à partir du registre.

Avant validation, l'écran d'import :
- liste les **services du fichier absents de l'outil** : chacun peut être créé (libellé modifiable) ou rattaché à un service existant (toutes ses données y sont reprises) ;
- propose pour chaque service et chaque année le **compteur du registre** (dernier numéro utilisé avant l'outil), modifiable ;
- **contrôle la numérotation** : il compare les numéros du fichier (A11, D12…) à ceux que l'outil attribuera, et explique chaque écart (catégorie différente, numéro décalé, mesure formant plusieurs entrées) ;
- demande comment traiter les entrées **déjà numérotées** : *laisser tel quel* (catégorie et numéro d'origine conservés, l'outil numérote les mesures suivantes en sautant ces numéros — choix par défaut), *recalculer l'année en cours*, ou *recalculer toutes les années* (avertissement : les statistiques des années passées peuvent changer). Ce choix reste modifiable année par année dans *Administration → Registre et statistiques → Registre*, le compteur étant alors recalculé ;
- affiche, **avant de confirmer**, l'impact de chacun des trois choix sur le registre et les statistiques de chaque année concernée (entrées et durée cumulée par catégorie A à E, durées, heures en chambre de soins intensifs (CSI), patients, numéros attribués), valeurs différentes surlignées, et le détail des mesures modifiées avec l'explication de leur catégorie (règle appliquée, lieu, case « exception », écart avec le fichier) ;
- permet, mesure par mesure, de garder le numéro d'origine ou d'appliquer la règle de l'outil, et de corriger le lieu (CSI ou non) ou la case « exception » ; la correction est tracée avec la mesure, le fichier d'origine n'est pas modifié.

Le rapport d'import liste aussi les lignes ignorées et les points à vérifier. Le registre ne contenant ni les cycles JLD ni l'information des tiers, vérifiez les mesures en cours dans l'onglet JLD. Pensez ensuite à compléter les fiches des nouveaux patients et à affecter les services créés aux comptes concernés.

*Cas particulier — classeur Excel « Suivi_Isolement_Contention ».* Les établissements qui utilisaient ce classeur, outil Excel dont est issu le projet, disposent d'un import spécifique (*Importer un classeur V1.3…*) qui reprend en plus les cycles JLD, l'information des tiers, la surveillance poste par poste et le paramétrage. Les autres établissements n'en ont pas besoin.

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
3. Faire le point avec le service informatique, le délégué à la protection des données (DPO, référent RGPD) et l'encadrement avant d'étendre.
