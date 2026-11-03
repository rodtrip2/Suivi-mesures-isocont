# Journal des versions

## 1.63.0 — 3 novembre 2026

- **Copie locale robocopy sans droits d'administrateur.** L'assistant propose un troisième choix, *Ma session Windows seulement*, réservé à la copie locale d'un poste. Il convient à un poste toujours ouvert sous la même session (compte du poste ou agent référent). Les commandes se collent dans un PowerShell ordinaire ; le script et son journal sont enregistrés dans le profil de la session. La tâche planifiée est créée au nom de cette session : la copie ne se fait que lorsqu'elle est ouverte. Si le poste interdit les tâches planifiées aux utilisateurs, un message l'explique, une fois la première copie faite.

## 1.62.0 — 3 novembre 2026

- **Assistant d'installation de la copie robocopy** (*Administration → Sauvegardes et exports*) : *Installer une copie automatique par robocopy…* (dossier de secours sur un autre serveur) et *Tenir la copie locale à jour par robocopy…* (poste désigné pour le travail hors réseau). L'outil demande les chemins exacts : le dossier des données est proposé d'après le chemin réseau déjà renseigné. Il demande aussi qui fait la copie (compte de service, ou agents connectés au poste sans aucun mot de passe) et la fréquence. Il prépare ensuite un bloc de commandes à coller une seule fois dans PowerShell ouvert en administrateur.
- Ce bloc contrôle les dossiers, enregistre le script (intégré : rien à télécharger ni à modifier), règle les droits, fait une première copie et crée la tâche planifiée. Au moindre problème, il s'arrête avec un message clair, sans rien planifier.
- Fiches 09 et 10 et guide utilisateur : la méthode simple vient en premier, la méthode détaillée reste décrite.

## 1.61.1 — 3 novembre 2026

- **Correction : création de la copie locale d'un poste.** Le choix du dossier échouait avec le message « Must be handling a user gesture to show a file picker ». Le navigateur n'ouvre le sélecteur de dossier qu'aussitôt après un clic, et la saisie du nom du poste puis le message d'information le retardaient. Le nom du poste se saisit désormais dans une fenêtre dont le bouton *Choisir le dossier…* ouvre directement le sélecteur.

## 1.61.0 — 3 novembre 2026

- **Décompte JLD** : quand le service est placé à la ligne, sa ligne a sa **propre mise en forme** (taille, gras, italique, position, espace au-dessus), indépendante de celle de l'établissement. Le réglage apparaît dans *Mise en forme des titres* dès que *Service à la ligne* est choisi. Sans réglage propre, le service reprend la mise en forme de l'établissement, comme jusqu'ici.

## 1.60.0 — 3 novembre 2026

- **Décompte JLD** : la ligne « établissement — service » et le titre de la mesure peuvent chacun être mis en **gras** et/ou en **italique** (*Administration → Décompte JLD → Mise en forme des titres*). Ces réglages s'appliquent au PDF, à l'impression et à l'aperçu. Par défaut, rien ne change : l'établissement reste en caractères normaux et le titre en gras.

## 1.59.1 — 3 novembre 2026

- **Décompte JLD** : dans la mise en forme des titres, le service peut être placé **à la ligne**, sous le nom de l'établissement, au lieu de « établissement — service » sur une seule ligne. Utile quand les deux noms sont longs ou quand les titres sont centrés. Par défaut, rien ne change.

## 1.59.0 — 3 novembre 2026

- **Décompte JLD : mise en forme des titres** (*Administration → Décompte JLD*, rubrique *Mise en forme des titres* de chaque masque). Elle se règle séparément pour la ligne « établissement — service » et pour le titre de la mesure : taille en points, position (à gauche, centrée ou à droite), espace au-dessus en millimètres. Cet espace permet par exemple de descendre les titres sous le logo d'un papier à en-tête. Le sous-titre suit la position du titre. Le réglage s'applique au PDF, à l'impression et à l'aperçu, et se transmet du masque de l'établissement aux masques des services.
- Par défaut, rien ne change pour le PDF (8,5 et 15 points, à gauche). À l'impression, les titres prennent désormais les mêmes tailles que le PDF.

## 1.58.1 — 3 novembre 2026

- **Sous-onglet *Informations* supprimé** : les informations techniques (version, dossier, saisies, révision du coffre) et l'effacement de la démonstration passent dans *À propos* ; le **choix du dossier bloqué sur les postes** passe dans *Comptes et sécurité*.

## 1.58.0 — 3 novembre 2026

- **Nouveau sous-onglet *Administration → Sauvegardes et exports*** : il réunit l'état des données et les sauvegardes (copie sous scellé, copie complète, contrôle d'intégrité, restauration), le dossier de secours, le travail hors réseau et le déplacement des données, le dossier des exports (emplacement, chemin réseau, durée de conservation, nouveau bouton *Voir les fichiers exportés*), l'archive annuelle et l'export ou l'import des réglages.
- *Informations* ne garde que les informations techniques, le choix du dossier bloqué sur les postes et la démonstration. La rubrique *Qualité, conservation et archivage* devient *Qualité et conservation* : l'archive annuelle a rejoint le nouveau sous-onglet.
- Messages de l'outil, guides et fiches du kit renvoient au nouveau sous-onglet.

## 1.57.1 — 3 novembre 2026

- **Raccourci du dossier des exports** : le bouton *Télécharger un raccourci pour le bureau* produisait un fichier « .download » inutilisable. Edge et Chrome bloquent le téléchargement des fichiers de raccourci (.url), jugés dangereux. Il est remplacé par la marche à suivre pour créer le raccourci directement dans Windows (*Copier le chemin*, puis clic droit sur le bureau → *Nouveau* → *Raccourci*). Le service informatique peut aussi le déployer par stratégie de groupe.

## 1.57.0 — 3 novembre 2026

- **Journal des saisies selon le rôle** (*Administration → Comptes et sécurité → Rôles et accès*, réglage *Journal des saisies* de chaque rôle) : journal complet ; saisies de ses services (et ses propres saisies) ; ses propres saisies seulement ; ou pas d'accès (onglet masqué). Un agent qui cumule des rôles a le niveau le plus large ; l'administrateur garde toujours le journal complet.
- **Nouveau réglage par défaut** (choix de l'établissement porteur du projet) : IDE, AS et secrétaire ne voient plus que les saisies de leurs services, sans les opérations sur les comptes, le paramétrage, les imports et les exports ; le cadre de santé garde le journal complet. Réglable rôle par rôle.
- Les saisies en conflit (journal et tableau de bord) sont limitées aux services de l'agent quand son journal est restreint.

## 1.56.0 — 3 novembre 2026

- **Export et import des réglages** (*Administration → Informations*) : le paramétrage de l'établissement s'exporte dans un fichier `.json`, rubrique par rubrique, sans aucune donnée de patient, ni compte, ni mot de passe. Usages : reporter dans les données réelles un paramétrage préparé dans un dossier d'essai, partager un paramétrage avec un autre établissement.
- **Import contrôlé** : l'outil affiche les rubriques qui changent, l'administrateur coche celles à reprendre (règles légales décochées par prudence). Les services et rôles utilisés ne sont jamais retirés ; les alertes importées ne s'appliquent qu'aux mesures saisies ensuite ; la numérotation du registre antérieur, les rapports annuels et le dossier de secours ne sont jamais repris. L'import tient en une ligne du journal, annulable en une fois.

## 1.55.1 — 3 novembre 2026

- **Correction : saisies signalées à tort comme illisibles.** Un fichier de saisie qui n'avait pas pu être lu au moment de la connexion (partage momentanément indisponible, fichier verrouillé ou en cours de synchronisation) restait considéré comme illisible pendant toute la session, et ses saisies manquaient à l'écran. Il est désormais relu à chaque synchronisation (toutes les 5 secondes) et sort de la liste des anomalies dès qu'il est lu.
- **Diagnostic** : le détail des anomalies d'intégrité indique la raison de chaque échec de lecture (fichier vide, tronqué, lecture refusée par le système, déchiffrement impossible…) et la taille du fichier.

## 1.55.0 — 3 novembre 2026

- **Ouverture dans une fenêtre séparée** : bouton *Installer comme application* (en-tête, écran d'accueil et de connexion), affiché quand Edge ou Chrome le permet. Une fois installé, l'outil s'ouvre dans sa propre fenêtre, sans onglets ni barre d'adresse, avec son icône sur le bureau, dans le menu Démarrer et la barre des tâches.
- Guide d'installation : installation sur tous les postes par la stratégie Edge `WebAppInstallForceList`, ou raccourci Windows `msedge.exe --app=…` (fenêtre séparée aussi pour un outil ouvert sans HTTPS).

## 1.54.1 — 3 novembre 2026

- **Ouverture directe sur l'invite de connexion** : un poste qui a déjà ouvert le dossier réseau du service, et dont le navigateur a gardé l'accès, rouvre ce dossier sans clic. Si le partage est inaccessible, l'écran d'accueil l'indique et propose *Reprendre* (ou *Travailler hors réseau*).
- **Poste au choix du dossier bloqué** : le mode démonstration n'est plus proposé (ni « Reprendre » une démonstration) ; les choix de l'écran d'accueil n'apparaissent qu'après lecture du blocage.

## 1.54.0 — 3 novembre 2026

- **Choix du dossier bloqué sur les postes** (*Administration → Informations*, désactivé par défaut) : une fois activé, chaque poste retient à sa connexion suivante les données qu'il utilise. Il ne peut plus ouvrir que des dossiers contenant ces mêmes données (dossier habituel, dossier de secours, copie locale, nouveau dossier après un déplacement). Ouvrir d'autres données ou le mode démonstration demande le déblocage par un administrateur (identifiant et mot de passe, ou code de secours), vérifié sur le coffre des données du poste.
- Procédures de secours : conduite à tenir si le déblocage est impossible (dossier et copie locale inaccessibles).

## 1.53.0 — 3 novembre 2026

- **Surveillance en CSI : liste des agents à cocher.** La fenêtre *Ajouter* présente les agents de l'équipe (comptes affectés au service portant les rôles choisis, IDE et AS par défaut) : il suffit de cocher les présents, plusieurs à la fois. Les agents déjà inscrits pour le poste sont grisés ; recherche par nom pour les grandes équipes.
- Une **personne non listée** (intérim, renfort, étudiant) s'ajoute toujours par son nom et sa fonction ; les noms déjà saisis dans le service sont proposés.
- Réglage des rôles proposés dans *Administration → Établissement et services → Postes de surveillance*.
- Guide pratique IDE / AS (captures) et guide utilisateur mis à jour.

## 1.52.0 — 3 novembre 2026

- **Avertissement sur le poste désigné** : bandeau orange en haut de l'outil, pour tous les agents, quand la copie locale des données n'a pas été mise à jour depuis plus d'une heure, quand sa mise à jour échoue ou quand le navigateur a perdu l'accès au dossier local ; bouton *Mettre à jour maintenant* ou *Autoriser l'accès et mettre à jour*.
- **Copie locale indépendante du navigateur** : le script robocopy accepte `-Type local` et se lance en tâche planifiée sur le poste désigné ; la copie est tenue à jour dès que le poste est allumé, même sans agent connecté. Le script reprend l'identifiant de la copie créée par l'outil (une seule ligne au tableau des dossiers de secours).
- Fiches 09 et 10 du kit et guide utilisateur complétés.

## 1.51.0 — 2 novembre 2026

- **Travail hors réseau sur des postes désignés** (*Administration → Informations*), pour les deux modes d'hébergement :
  - outil servi en HTTPS (intranet ou page GitHub) : *Garder l'outil disponible hors réseau sur ce poste* — mise en cache par le navigateur, chaque fichier contrôlé par son empreinte SHA-256, mise à jour automatique ;
  - outil ouvert sans HTTPS : script fourni au service informatique (`kit/outils/copie-locale-outil.ps1`) qui copie l'outil sur le poste après contrôle des empreintes et crée le raccourci du bureau ;
  - *Créer une copie locale des données sur ce poste* : copie chiffrée sur le disque du poste, tenue à jour toutes les 10 minutes. En cas de panne : *Travailler hors réseau* à l'écran d'accueil (bandeau rouge) ; au retour, *Reprendre* le dossier habituel et les saisies sont reprises sans rien écraser.
- **Plusieurs dossiers de secours** suivis ensemble (serveur, copie robocopy, copies locales des postes) : tableau avec la dernière copie de chacun, *Retirer de la liste* pour un poste réformé. Le script robocopy conserve l'état des autres copies.
- Kit : nouvelle fiche 10 (travail hors réseau) ; fiche technique (en-têtes de sécurité, `worker-src 'self'`), guide d'installation, procédures de secours, éléments RGPD et guide utilisateur complétés.

## 1.50.0 — 2 novembre 2026

- **Dossier de secours copié par robocopy** : script PowerShell fourni (`kit/outils/miroir-robocopy.ps1`) à lancer par une tâche planifiée, de préférence sur un serveur. Contrôles avant copie (dossier principal valide, dossier de secours vide ou copie des mêmes données, chemins non inversés), copie sans jamais supprimer ni écraser un fichier plus récent, exports exclus, journal. Nouvelle fiche du kit pour le service informatique (document 09) : installation, compte de service, tâche planifiée, vérifications, retour après une panne.
- L'outil indique la date de la dernière copie robocopy et la machine qui l'a faite, et propose *Surveiller la copie robocopy* (point de vigilance après 24 h sans copie).

## 1.49.0 — 2 novembre 2026

- **Dossier de secours** (*Administration → Informations*) : un second dossier, de préférence sur un autre serveur, reçoit une copie des données chiffrées, tenue à jour par les postes reliés (à la connexion puis toutes les 10 minutes). Si le dossier principal est inaccessible, on travaille sur le dossier de secours (bandeau rouge) ; au retour, *Synchroniser maintenant* reprend les saisies faites entre-temps, sans rien écraser. Point de vigilance après 24 h sans synchronisation ; dossier contenant d'autres données refusé.
- **Déplacement des données** vers un nouveau dossier vide : copie de tous les fichiers relue et vérifiée, ancien dossier marqué « déplacé » (il ne s'ouvre plus et indique le nouveau dossier), tracé au journal.
- Stockage sur un partage autre que SMB : étude ajoutée aux évolutions futures.
- Procédures de secours (document 04) et fiche technique complétées.

## 1.48.0 — 2 novembre 2026

- **Registre en PDF** (bouton *Enregistrer en PDF* de l'onglet *Registre*) : synthèse par catégorie et entrées, avec le papier à en-tête, les marges, l'en-tête, le pied de page et le bloc signature du masque du décompte JLD du service, mention « document confidentiel », numéros de page. Fichier rangé dans les exports du service.
- **Statistiques en PDF** : indicateurs N / N-1, catégories, suivi réglementaire, séquences, répartition mensuelle et méthode, avec le même papier à en-tête (masque de l'établissement pour plusieurs services).

## 1.47.0 — 2 novembre 2026

- **Modes d'hospitalisation modifiables** (*Administration → Établissement et services*) : ajout (soins sur décision de justice, personne détenue, ordonnance de placement provisoire d'un mineur…), libellé, soins sans consentement ou soins libres ; un code déjà employé reste protégé.
- **Listes de saisie de l'établissement** : fonctions des professionnels de surveillance, motifs de pause, motifs de fin propres, raccourcis de durée des pauses.
- **Motif de fin « Autre »** : précision obligatoire.
- **Seuils des points de vigilance** (cumul élevé sur 15 jours, rouge et orange) et **durée d'affichage des mesures terminées** réglables.
- **Écran de connexion** : contact en cas de difficulté et consigne de l'établissement (le contact figure aussi sur les fiches de remise des identifiants) ; **logo de l'établissement** dans l'en-tête.
- **Surveillance en CSI** : bouton *M'ajouter* sur chaque poste (l'agent connecté, en un clic) et *Moi-même* dans la fenêtre *Ajouter*.

## 1.46.1 — 2 novembre 2026

- Tableau de bord : la tuile « Échéances JLD dans les … h » reprend le seuil « échéance proche » réglé par l'établissement (12 h par défaut) au lieu d'afficher toujours 12 h.
- Registre : l'infobulle du mode d'hospitalisation modifié reprend le délai de bascule réglé (12 h par défaut).

## 1.46.0 — 2 novembre 2026

- **Vérification de la version sur la page GitHub** : ouvert depuis sa page GitHub (adresse en « github.io »), l'outil vérifie à l'ouverture puis toutes les 30 minutes que la version utilisée est la dernière publiée. Sinon, un bandeau propose *Recharger la page* ou *Plus tard*. Seul le numéro de version est relu, sur le même site ; aucune donnée n'est envoyée et la politique de sécurité du contenu est inchangée. Sans effet sur l'intranet ou un partage.
- Réglage *Administration → À propos → Mise à jour de l'outil* : activer ou désactiver la vérification (activée par défaut, tracée au journal), bouton *Vérifier maintenant*.

## 1.45.0 — 2 novembre 2026

- **Décompte JLD : lieu exact et type d'espace.** La ligne *Lieu* de l'identité indique le lieu précis et sa nature (« CSI 1 — chambre de soins intensifs », « Chambre 12 — hors chambre de soins intensifs »), selon l'appellation choisie par l'établissement. Nouvelle colonne **Lieu** dans le tableau : le lieu de chaque ligne, mesures antérieures comprises ; un changement de lieu en cours de mesure (transfert, soins somatiques) ouvre une nouvelle ligne. Colonne ajoutée automatiquement aux masques existants (décochable dans *Administration → Décompte JLD*), en PDF, à l'impression et en CSV.
- Un lieu enregistré sans nom précis (« CSI » seul, import sans nom de lieu) est signalé « nom du lieu non précisé ».

## 1.44.0 — 2 novembre 2026

- **Icône de l'application** : icône propre à l'outil (onglet du navigateur, application installée, raccourci Windows), fichier `app/img/icone.ico` pour les raccourcis et les stratégies de groupe, images PNG ; manifeste pour **installer l'outil comme une application** depuis Edge ou Chrome (fenêtre dédiée, menu Démarrer, bureau). Politique de sécurité du contenu complétée par `manifest-src 'self'`.
- Guide d'installation : trois façons de créer le raccourci avec l'icône (installation par le navigateur, raccourci Windows, stratégie de groupe).

## 1.43.0 — 2 novembre 2026

- **Exports rangés par service** : `exports\<service>\<catégorie>` (et `exports\Etablissement` pour les exports qui couvrent plusieurs services). La fenêtre *Exports* ne montre à chaque agent que les fichiers de ses services, avec un filtre par service.
- **Accès direct au dossier Windows** : l'administrateur renseigne le chemin réseau du dossier des données (*Établissement et services → Dossier des exports*). La fenêtre *Exports* affiche alors le chemin du dossier du service, avec *Copier le chemin* (à coller dans l'Explorateur) et *Télécharger un raccourci pour le bureau* (fichier .url qui ouvre ce dossier).

## 1.42.0 — 2 novembre 2026

- **Durée de conservation des exports** réglable dans *Administration → Établissement et services → Dossier des exports* : aucune purge (par défaut), 1, 3 ou 6 mois, 1, 2, 3 ou 5 ans. Les exports plus anciens sont supprimés automatiquement à la première connexion de la journée sur chaque poste ; chaque purge est inscrite au journal. L'écran indique combien de fichiers sont concernés avant d'enregistrer ; bouton *Purger maintenant*.

## 1.41.0 — 2 novembre 2026

- **Exports enregistrés automatiquement sur le réseau** : décomptes JLD (PDF, CSV), registres, statistiques, registres pour communication, données d'un patient et archives sont écrits dans le **dossier des exports** (sous-dossier du dossier des données, « exports » par défaut, réglable dans *Administration → Établissement et services*), classés par catégorie, jamais écrasés et tracés au journal. Plus de fichiers nominatifs laissés dans les téléchargements des postes (téléchargement seulement en secours si le dossier est inaccessible).
- **Bouton « Exports »** dans le bandeau : liste des fichiers (recherche, catégorie), *Ouvrir* (PDF), *Télécharger*, *Supprimer* (administrateur, tracé).
- **Surveillance en CSI** : nombre minimal de professionnels par poste réglable (1 à 6, deux par défaut) ; chaque professionnel peut préciser les **lieux surveillés** (tous par défaut) — il n'est alors cité au registre que pour les mesures de ces lieux ; lieux occupés rappelés sur chaque poste.
- Guide pratique IDE / AS et kit mis à jour (captures régénérées).

## 1.40.1 — 2 novembre 2026

- **Kit : guide pratique des IDE et aides-soignant(e)s** (`kit/08-guide-ide-as.md` et PDF, 11 pages, 18 captures en mode démonstration avec un compte IDE fictif) : se connecter, tableau de bord, créer une mesure, pause et reprise, information du tiers, décompte JLD enregistré en PDF et traçabilité de l'envoi, surveillance en CSI, fin de mesure, correction d'une erreur, mémo d'une page.
- Script `scripts/captures-guide-ide-as.py` pour régénérer les captures après une évolution de l'interface ; le générateur des PDF du kit sait désormais inclure des images.

## 1.40.0 — 2 novembre 2026

- **Rôles configurables** (*Administration → Comptes et sécurité → Rôles et accès*) :
  - les rôles fournis (IDE, aide-soignant(e), secrétaire, cadre de santé) se renomment et leurs accès se règlent ; *Rétablir les droits par défaut* ramène les droits d'origine ;
  - **nouveaux rôles** propres à l'établissement, vides ou copiés d'un rôle existant (ex. direction des soins, consultation seule), supprimables tant qu'ils ne sont attribués à aucun compte ;
  - **16 accès regroupés** en langage courant (fiches patient, début et fin des mesures, pauses, tiers, envois au JLD, recours, surveillance, alertes, transferts et soins somatiques, entretien, proposition et validation des corrections, annulation, fusion, statistiques, registre pour communication et droit d'accès) ;
  - option « accès à tous les services » par rôle (sans affectation de services au compte) ;
  - le rôle **Administrateur reste fixe**, pour ne jamais perdre l'accès aux réglages ;
  - changements résumés et confirmés avant l'enregistrement, tracés au journal et annulables.
- Les rôles créés sont proposés à la création des comptes, un par un ou en lot (reconnus par leur libellé dans la liste collée).
- Sans réglage, les droits restent exactement ceux d'avant (vérifié par les tests).

## 1.39.0 — 2 novembre 2026

- **Annuler depuis le journal** : bouton *Annuler* sur chaque ligne du journal. L'administrateur peut annuler toute saisie, y compris un réglage (qui reprend sa valeur précédente), un import ou une prise d'acte d'intégrité ; le cadre, les saisies sur les mesures et les patients. Une fenêtre rappelle la saisie, décrit l'effet et demande un motif. Les traces de comptes ne s'annulent pas.
- **Rétablir** : une annulation faite par erreur s'annule à son tour (bouton *Rétablir* sur la ligne de l'annulation) ; la saisie d'origine produit de nouveau son effet. Rien n'est jamais effacé.

## 1.38.0 — 2 novembre 2026

- **Affichage clair ou sombre** : bouton *☾ Sombre* / *☀ Clair* dans le bandeau supérieur. Le choix est mémorisé **pour chaque agent** (fichier chiffré `preferences/<agent>.enc` sur le partage) et le suit d'un poste à l'autre ; le dernier choix du poste s'applique dès l'écran de connexion. Sans choix, le thème du système. Les impressions restent en clair.

## 1.37.2 — 2 novembre 2026

- Fiche du patient : la durée totale de l'année s'affiche en jours et heures et en heures dans la même case (« 3 j 22 h (94 h 14) ») ; trois cases au lieu de quatre.

## 1.37.1 — 2 novembre 2026

- Fiche du patient, histogramme de l'année : les heures d'une mesure à cheval sur plusieurs mois (ou sur deux années) sont **réparties sur les mois réellement couverts**, pauses déduites si le registre les déduit ; la frise montre aussi une entrée débutée l'année précédente. Les totaux restent ceux des statistiques (entrées débutées dans l'année) ; l'écart éventuel est indiqué sous la frise.

## 1.37.0 — 2 novembre 2026

- **Onglet Patients, statistiques améliorées** :
  - colonne **Total** de l'année : nombre d'entrées du registre et durée totale (sans double compte, une contention en chambre de soins intensifs couvrant l'isolement qui l'accompagne) ;
  - menu **Durées en** : jours et heures, heures, ou les deux (« 2 j 8 h (56 h) ») ; choix mémorisé sur le poste ;
  - fiche du patient (bouton *Mesures*) : bloc **Année** avec durée totale, isolement seul et contention, **histogramme des heures par mois** (empilé) et **frise de l'année** (chaque entrée à sa date, détail au survol), flèches pour changer d'année.
- Tableau des patients : intitulés de colonnes sur deux lignes et durées insécables, pour tenir sans défilement horizontal sur les écrans de 1 280 pixels et plus.

## 1.36.0 — 2 novembre 2026

- **Organisation des envois au JLD réglable** (*Administration → Établissement et services*) : le texte affiché en tête de l'onglet *JLD* (« Envois assurés par la secrétaire en semaine, par l'IDE le week-end… », propre à un établissement) est désormais rédigé par chaque établissement ; vide par défaut, rien n'est alors affiché. Réglage tracé au journal.

## 1.35.3 — 2 novembre 2026

- Onglet *JLD*, colonne *Tiers* : « tiers à informer avec le juge » devient « Proche à informer avant le [échéance de l'information du juge], comme le juge », avec la règle au survol (le médecin informe du renouvellement au moins un membre de la famille ou un proche, et de son droit de saisir le juge ; pour un majeur protégé, aussi le tuteur ou le curateur).

## 1.35.2 — 2 novembre 2026

- Onglet *JLD* : le bouton « Saisir un envoi » devient « Saisir un envoi ou une décision » (il sert aussi à enregistrer les décisions reçues) ; la fenêtre s'intitule « Envoi au JLD ou décision reçue ».

## 1.35.1 — 2 novembre 2026

- **Affichage sur ordinateur** : les pages de tableaux (tableau de bord, Mesures, Patients, JLD, Surveillance, Registre, Statistiques, Journal) occupent toute la largeur de l'écran au lieu de 1 400 pixels ; les pages de réglage gardent une largeur de lecture. Sur les écrans de 1 280 à 1 600 pixels, les boutons d'action passent sur plusieurs lignes et les cellules sont resserrées : plus de défilement horizontal, les boutons *Décompte* et *Détail* restent visibles.

## 1.35.0 — 2 novembre 2026

- **Appellation des lieux dédiés à l'isolement réglable** (*Administration → Établissement et services*) : « chambre de soins intensifs (CSI) » par défaut, chambre d'isolement (CI), espace d'isolement, chambre de soins intensifs psychiatriques (CSIP), ou appellation propre (sigle, singulier, pluriel), avec aperçu. Elle s'applique aux textes de l'outil : onglet *Surveillance*, tableau de bord, saisie, registre, statistiques, décompte, alertes proposées, journal. Les noms des lieux saisis (« CSI 1 »…), les textes d'alerte rédigés par l'établissement et les calculs ne changent pas. Réglage tracé au journal.
- Quelques libellés tournés pour rester corrects quelle que soit l'appellation (« Heures en CSI », « Aucun lieu de type… n'est paramétré »).

## 1.34.1 — 2 novembre 2026

- **Sigles** : « DSI », qui se lit à l'hôpital « Direction des soins infirmiers », est remplacé par « service informatique » (à la première mention : « service informatique (DSI ou direction du numérique, selon l'établissement) ») ; « DPO » par « délégué à la protection des données (DPO, référent RGPD) » ; « RSSI » par « responsable de la sécurité informatique ». Interface et kit.
- Autres sigles écrits en toutes lettres à leur première mention (CADA, CRPA, CDSP, CGLPL, HDS, DIM, AIPD, QPC, CSI, IPP, JLD, HAS, modes d'hospitalisation SDT, SDTU, SPI, SDRE) ; statistiques : « patients en hospitalisation complète », « patients en soins sans consentement » au lieu de « HC » et « SSC ».
- La fiche technique du kit devient `02-fiche-technique-informatique` (PDF compris) ; « Recette DSI » devient « Recette technique ».

## 1.34.0 — 2 novembre 2026

- **Anomalie d'intégrité : que faire ?** Dans *Administration → Informations*, le contrôle d'intégrité détaille désormais chaque anomalie (nature, chemin du fichier, agent, date de la saisie) et propose :
  - *Copier la liste pour la DSI* : chemins, dates et identifiants de connexion, sans aucune donnée de patient ;
  - *Réparer depuis une copie de sauvegarde* (administrateur) : seuls les fichiers absents ou illisibles sont remis, après vérification qu'ils s'ouvrent avec la clé de l'établissement ; les fichiers présents et lisibles ne sont jamais modifiés ; le contrôle est refait ;
  - *Mettre en quarantaine* les fichiers illisibles (dossier `quarantaine`, jamais de suppression) ;
  - *Prendre acte* quand la récupération est impossible, avec un motif obligatoire : l'alerte est close pour ces fichiers, la décision est inscrite au journal (*Intégrité des données*, annulable) et listée ; toute nouvelle anomalie déclenche une nouvelle alerte.
- Repère d'intégrité plus sûr : son compteur ne recule plus quand un poste ne voit pas une saisie perdue (l'écart restait sinon invisible après la saisie suivante).
- Kit : fiche « Alerte d'intégrité » réécrite (arbre de décision, quand prévenir le RSSI, modèle de message à la DSI) ; fiche technique DSI, guide utilisateur et analyse de risques complétés.

## 1.33.0 — 2 novembre 2026

- **Décompte JLD — « Enregistrer en PDF »** : le fichier PDF est produit directement, sans passer par la boîte d'impression (masque, papier à en-tête, marges, mise en évidence, bandeau confidentiel, numéros de page) ; bouton *Imprimer* distinct. Générateur PDF intégré, sans bibliothèque externe.
- **Export CSV du décompte désactivable**, désactivé par défaut : case « Proposer aussi l'export CSV du décompte » dans le masque (établissement ou service).
- Ligne d'identité « Mesure » : « Isolement - décidée le … » (et « Contention - décidée le … »).

## 1.32.2 — 1er novembre 2026

- **Information du tiers** : explication de la décision n° 2024-1127 QPC réécrite en clair, sous l'extrait de loi (situation visée, ce qui a été jugé, effet sur le texte, ce qu'il faut faire en pratique, point à faire confirmer) ; rappel plus explicite pour un patient sous protection juridique.

## 1.32.1 — 1er novembre 2026

- **Information du tiers** : extrait de l'article L. 3222-5-1, II (« Le médecin informe du renouvellement de ces mesures… », « Le médecin réitère… ») dans la fenêtre *Tiers* et dans le réglage des fonctions, avec la mention de la décision du Conseil constitutionnel n° 2024-1127 QPC du 5 mars 2025. Rappel, pour un patient sous protection juridique, d'informer aussi la personne chargée de la mesure de protection.

## 1.32.0 — 1er novembre 2026

- **Information du tiers** : la mention « (en dernier recours) », propre à l'organisation d'un établissement, est retirée. La liste des fonctions pouvant informer le tiers se règle dans *Administration → Établissement et services* (IDE par défaut ; ajout possible de cadre de santé, médecin de garde, assistant de service social…) ; le psychiatre reste toujours proposé en premier, l'article L. 3222-5-1 confiant cette information au médecin. Le nom de la personne ayant informé peut être précisé pour toutes les fonctions ; il apparaît dans le journal, le détail et le décompte JLD.

## 1.31.0 — 1er novembre 2026

- **Coffre protégé** : vérifié avant et après chaque écriture (la version précédente est remise en place si la relecture échoue) ; **30 dernières versions conservées** dans le dossier, la version actuelle comprise ; un coffre abîmé ou manquant est signalé et se restaure depuis l'écran d'ouverture (version de l'historique ou copie sous scellé).
- **Copie du coffre sous scellé** à conserver avec le code de secours : avec elle, le code de secours suffit à rouvrir les données même si le coffre et ses versions sont perdus (mots de passe à réinitialiser ensuite) ; signalée « à refaire » après un nouveau code de secours.
- **Copie de sauvegarde complète** (coffre et saisies, chiffrés, en un fichier) à enregistrer sur un autre support ; restauration dans un dossier vide depuis l'écran d'initialisation ; rappel au tableau de bord (tous les 7 jours par défaut, réglable).
- **Contrôle d'intégrité** à la connexion puis toutes les 15 minutes : repère de chaque agent (nombre et dernière saisie), fichiers chargés disparus du partage, fichiers illisibles, trous du chaînage ; alerte au tableau de bord.
- **État des données et sauvegardes** dans *Administration → Informations*.
- Kit : exigences de sauvegarde à demander à la DSI, procédures de restauration (coffre, dossier entier, alerte d'intégrité), test annuel complété, analyse de risques mise à jour.

## 1.30.0 — 1er novembre 2026

- **Séquences** : entrées du registre d'un même patient qui se suivent (tous services), regroupées selon une tolérance réglable de « continu » à 48 h. Indicateurs dans les statistiques, le rapport annuel et l'export : nombre, patients, entrées par séquence, durées moyenne, médiane, maximale et cumulée, composition (isolement seul, avec contention, contention seule). Colonne « Séquences » de l'onglet Patients (option).
- **Unités de compte** expliquées (entrées du registre, mesures au sens du juge, séquences) ; unité principale du rapport annuel réglable (entrées du registre par défaut), placée en tête.
- **Méthode de calcul** sous les statistiques, dans le rapport et l'export, selon les mentions choisies par l'établissement : règles en vigueur, changements de règles datés relus au journal (pauses, soins somatiques, délai de bascule du mode, numérotation importée, tolérance des séquences), comparaison chiffrée avec la règle antérieure au dernier changement, méthode de comptage utilisée avant l'outil (texte par année).

## 1.29.0 — 1er novembre 2026

- **À propos** (sous-onglet de l'administration et bouton de l'en-tête, pour tous les agents) : version, licence EUPL 1.2 expliquée, crédits, lien vers la page du projet sur GitHub, boutons *Signaler un problème* et *Demander une amélioration* (formulaires GitHub en français, version préremplie, rappel de ne jamais y mettre de donnée réelle), copie de la version et du navigateur.
- Mention des droits d'auteur en termes français (« © 2026 Roddy Ricart et les contributeurs du projet — droits d'auteur »), dans l'application et le fichier NOTICE.

## 1.28.0 — 1er novembre 2026

- **Motif du recours** (option) : liste paramétrable proposée dans la nouvelle mesure, facultative pour l'agent ; statistiques et rapport annuel.
- **Entretien après la mesure** (option), sous le nom choisi par l'établissement (ex. « Débriefing post-isolement ») : réalisé ou non, date, depuis le détail de la mesure ; mesures terminées depuis moins de 7 jours sans entretien renseigné dans les points de vigilance ; statistiques.
- **Motifs de fin** dans les statistiques.
- **Surveillance des mesures hors CSI** (option) : postes à compléter et professionnels au registre pour les catégories B, D et E.
- **Rapport annuel (trame)** dans l'onglet Statistiques (art. L. 3222-5-1, III) : chiffres N / N-1 repris de l'outil, textes de l'établissement enregistrés, impression ou PDF.
- **Droit d'accès** : export des données d'un patient (fiche, modes, mesures, registre), tracé au journal.
- **Conservation et archivage** : durée de conservation (signalement des patients au-delà, sans suppression) et archive annuelle (registres et statistiques en CSV, tracée).

## 1.27.0 — 1er novembre 2026

- **Comptes temporaires** (intérimaires, vacataires, stagiaires) : dernier jour d'accès à la création (y compris en lot) ou par *Modifier*, imprimé sur la fiche de remise ; connexion refusée après ce jour ; badges « expire le… » (7 jours) et « expiré » ; bouton *Désactiver les comptes expirés*.
- **Correction proposée par l'IDE ou l'AS** en l'absence du cadre : la proposition n'est pas appliquée, elle est signalée (ligne de la mesure, détail, points de vigilance) jusqu'à ce que le cadre la valide ou la refuse avec un motif ; tout est tracé au journal.
- **Patient détenu** : case dans la fiche et à la création du patient, badge dans l'onglet Patients, nouveau déclencheur d'alerte de l'établissement.
- **Changement d'heure** : tests du passage à l'heure d'hiver et d'été (durées, tranches du décompte, échéances JLD, registre), calculés en heures réelles.

## 1.26.0 — 1er novembre 2026

- **Transfert vers un autre service** (détail de la mesure) : la mesure reste unique pour le JLD et elle est répartie au registre entre les services ; mesures en cours du patient transférées ensemble ; lieux successifs dans le détail.
- **Passage en soins somatiques ou aux urgences** (détail de la mesure, puis bouton *Retour*) selon la règle choisie dans *Cas particuliers* : poursuite comptée au registre du service (par défaut), poursuite comptée dans un registre dédié (« Hébergement somatique », « Urgences »…), suspension jusqu'au retour (délais JLD reportés, ligne « SUSPENDUE » au décompte), ou fin de la mesure.
- **Motif de fin** de mesure (décision médicale, suite à la mainlevée, sortie, transfert hors de l'établissement, soins somatiques, fugue, décès, autre) ; rappel de la déclaration d'événement indésirable grave à l'ARS en cas de décès.
- **Recours au JLD et appel** (détail de la mesure) : saisine à l'initiative du patient, d'un proche, de l'avocat…, décision, appel devant le premier président et décision ; une mainlevée sur recours a les effets d'une mainlevée. Recours repris dans le décompte JLD.
- Corrections : boutons du pied des fenêtres renvoyés à la ligne quand ils sont nombreux ; libellé du journal d'un changement de service sur la fiche patient.

## 1.25.0 — 1er novembre 2026

- **Sous-onglet *Cas particuliers*** dans l'administration, pour les arbitrages des situations moins fréquentes.
- **Nouvelle mesure dans les 48 h suivant une mainlevée du JLD** (art. L. 3222-5-1, II) : alerte rouge à la saisie (date de la mainlevée, fin du délai, exception des éléments nouveaux décrits dans le certificat), information du JLD due sans délai (échéance « Info avant » ramenée au début de la mesure), point de vigilance au tableau de bord, mention dans le détail. Réglages : toute nouvelle mesure ou même type seulement ; échéance avancée ou non.
- **Mesure débutée avant l'arrivée dans le service** (urgences, autre établissement) : décision initiale et lieu d'origine saisis avec la mesure ; délais JLD, cumuls et décompte depuis la décision initiale (partie antérieure sur une ligne distincte), registre et statistiques depuis l'arrivée. Durée totale affichée dans la liste des mesures.
- **Fiches patient en double** : alerte à la création d'un patient proche d'une fiche existante ; liste des fiches peut-être en double dans l'onglet Patients ; **fusion** par le cadre avec aperçu de l'effet (cumuls, échéances JLD, informations différentes, mesures qui se chevauchent), motif obligatoire, tracée et annulable.

## 1.24.0 — 31 octobre 2026

- **Sous-onglet *Alertes* dans l'administration** : alertes propres à l'établissement, par service. Chacune se déclenche pour une situation (patient en soins libres au début de la mesure, patient mineur, protection juridique, contention ou isolement hors CSI, toute contention, toute mesure) et est soit un **rappel** affiché dans le formulaire de la nouvelle mesure, soit une **personne à informer** dans un délai (sans délai à 24 h).
- **Traçabilité de l'information** : à l'enregistrement de la mesure, l'outil demande qui a été informé, comment et quand (saisie « Information » au journal, visible dans le détail de la mesure). Information non tracée : point de vigilance en rouge au tableau de bord avec bouton *Tracer l'information*, indicateur, badge et bouton *Informer* dans la liste des mesures.
- Alertes proposées : *Patient en soins libres* (informer sans délai le cadre de santé ou l'administrateur de garde ; désactivée par défaut) et *Contention hors CSI : exceptions prévues* (rappel de l'article L. 3222-5-1 et de la seule exception prévue par la HAS, la contention mécanique ambulatoire ; active).
- Point de vigilance « soins libres » : durée de la mesure affichée, avec le rappel des 12 h maximum recommandées par la HAS au-delà.
- Une alerte ne concerne que les mesures saisies après son activation, jamais l'historique importé ; en mode formation, seules les saisies de formation la déclenchent.

## 1.23.0 — 31 octobre 2026

- **Administration en sous-onglets** : *Comptes et sécurité* (comptes, moyens de déblocage, mode formation), *Établissement et services* (services, CSI, postes de surveillance), *Règles et pauses*, *Registre et statistiques* (compteurs, numérotation des mesures importées, colonnes de l'onglet Patients), *Décompte JLD* (masques), *Reprise des données*, *Informations*. Seul le sous-onglet choisi est affiché ; il est conservé après un enregistrement et retenu d'une visite à l'autre. En mode formation, seuls les sous-onglets de paramétrage apparaissent.
- Chemins « Administration → … » mis à jour dans le kit et les messages de l'interface.

## 1.22.1 — 31 octobre 2026

- Documentation et interface pour tout établissement : la reprise de l'historique est présentée à partir du **registre du service** ; le classeur Excel V1.3 n'apparaît plus que comme un **cas particulier** (outil Excel dont est issu le projet), signalé comme tel (section repliée dans *Administration*, paragraphe distinct dans le guide d'installation). Fiche projet, guide d'installation, guide utilisateur, fiche 07 et README réécrits en conséquence.
- Textes communs aux deux imports rendus génériques : « document importé » au lieu de « classeur » (explication des catégories, compteurs, journal), choix « Laisser tel quel » décrit selon la source.

## 1.22.0 — 31 octobre 2026

- **Import générique à partir du registre du service**, pour tout établissement quel que soit son outil : fichier CSV (UTF-8 ou Windows) ou Excel, choix de la feuille, ligne d'en-tête repérée automatiquement, **correspondance des colonnes** proposée d'après leurs intitulés et modifiable, exemple de valeur pour chaque donnée. **Modèle de registre CSV** téléchargeable.
- Reconstitution des mesures à partir des entrées : A/B → isolement ; C → contention en CSI et l'isolement qui l'accompagne ; D/E → contention hors espace d'isolement ; portions d'isolement contiguës d'un même patient regroupées en une seule mesure (le juge compte un isolement). Chaque mesure garde ses lignes d'origine : en numérotation conservée, le registre importé est reproduit à l'identique, soignants compris.
- Même mécanique que l'import V1.3 : services absents, compteurs, choix de numérotation, contrôle, aperçu de l'impact, décisions et corrections par mesure. Libellés adaptés (« registre importé »).
- Registre : soignants cités par le registre importé affichés à défaut de traces de surveillance par poste ; mention « n° d'origine » (classeur ou registre).
- Kit : nouvelle fiche **07 — Reprise à partir du registre** (format, reconstitution, contrôles). Fiche projet, guide d'installation et `CLAUDE.md` mis à jour.

## 1.21.0 — 31 octobre 2026

- Aperçu d'import : **pourquoi de chaque catégorie** sous chaque entrée — règle appliquée, lieu, case « exception », portion d'isolement hors contention, et, en cas d'écart avec le classeur, la lettre du classeur et une piste de vérification (« vérifier la case « exception » de la mesure »…).
- **Décision mesure par mesure** : garder le n° du classeur ou appliquer la règle de l'outil, prioritaire sur le choix de l'année (paramètre `registreFigeMesures`, tracé au journal).
- **Correction des données d'une mesure avant import** (lieu CSI ou non, exception) : appliquée à la mesure importée, tracée (« Corrigé à l'import : exception : oui → non »), visible dans le détail et le journal ; le classeur n'est pas modifié. Une mesure corrigée ou décidée reste affichée dans l'aperçu.
- Registre : les numéros attribués par l'outil partent du compteur et **sautent les numéros conservés du classeur** (auparavant, ils reprenaient après le plus grand, ce qui décalait les mesures recalculées).
- Journal : libellés lisibles pour les compteurs du registre et les derniers numéros du classeur.

## 1.20.0 — 31 octobre 2026

- Aperçu de l'impact avant import : ajout de la **durée cumulée par catégorie** (A à E) pour chacun des trois choix, et du **détail des mesures modifiées** — pour chaque mesure dont le registre change selon le choix (mesures importées, ou déjà présentes dont la numérotation se décale) : patient, type, période, origine et numéro du classeur, et ses entrées (numéro, catégorie, période, durée) selon chaque choix, différences surlignées.

## 1.19.0 — 31 octobre 2026

- Import du classeur V1.3 : **aperçu de l'impact avant confirmation** — pour chaque service et chaque année contenant des mesures numérotées, comparaison des trois choix (laisser tel quel, recalculer l'année en cours, recalculer tout) sur le registre et les statistiques : entrées terminées et en cours, catégories A à E, durée cumulée et moyenne, heures de CSI, patients distincts, numéros attribués. Simulation complète, mesures déjà présentes comprises ; valeurs différentes surlignées, choix retenu encadré ; liste des mesures dont la numérotation changerait.
- Ajout de `CLAUDE.md` : consignes du projet (objectifs, sécurité des données, rôles, règles légales, pauses, registre, décompte, statistiques, import, interface, conventions de code, procédure après chaque modification, points à faire valider).

## 1.18.0 — 31 octobre 2026

- Import du classeur V1.3 — **traitement des mesures déjà numérotées** : *laisser tel quel* (par défaut : chaque mesure importée garde la catégorie et le numéro du classeur, une entrée par mesure ; l'outil numérote les mesures suivantes à la suite du plus grand numéro), *recalculer l'année en cours*, ou *recalculer toutes les années*, avec un avertissement clair sur le risque de modifier les statistiques antérieures. Le compteur proposé et le contrôle de la numérotation suivent le choix.
- *Administration → Registre* : liste des années contenant des mesures importées numérotées, avec leur numérotation (classeur ou outil) et un bouton pour basculer année par année ; le compteur du registre est recalculé en conséquence (dernier numéro du classeur mémorisé à l'import). Avertissement renforcé pour une année passée.
- Registre : les entrées gardant la numérotation du classeur portent la mention « n° du classeur », expliquée sous le tableau.

## 1.17.0 — 31 octobre 2026

- Import du classeur V1.3 — **services absents de l'outil** : détectés dans tout le classeur (paramétrage, patients, chambres, postes, masques, compteurs, professionnels), avec pour chacun le choix de le **créer** (libellé modifiable), de le **rattacher** à un service existant (toutes ses données y sont reprises) ou de l'ignorer s'il ne porte aucune donnée.
- **Compteurs du registre** proposés par service et par année, calculés sur les entrées que l'outil numérotera lui-même (une mesure peut former plusieurs entrées A, C, A), et **modifiables** avant validation.
- **Contrôle de la numérotation** : comparaison des numéros du classeur (A11, D12…) et de ceux attribués par l'outil, avec l'explication de chaque écart ; repris dans le compte rendu d'import.
- Le service par défaut des patients sans service est désormais, par défaut, le service actif du classeur (auparavant le premier service de l'outil, ce qui pouvait fausser la numérotation).

## 1.16.0 — 31 octobre 2026

- **Option « Interdire la pause de l'isolement seul pendant une contention »** (*Administration → Pauses*, désactivée par défaut). Activée, la fenêtre de pause d'un isolement remplace la case « Mettre aussi en pause la contention » par un choix : mettre aussi la contention en pause, ou y mettre fin au début de la pause (décision du même psychiatre, motif tracé). Désactivée, le comportement reste celui d'avant : case cochée par défaut, alerte si elle est décochée.

## 1.15.0 — 31 octobre 2026

- **Pause d'une contention pendant un isolement** : l'agent doit confirmer si la pause concerne la contention seulement (le patient reste à l'isolement) ou aussi l'isolement ; dans le second cas, les deux mesures sont mises en pause ensemble. À la reprise d'une contention, l'outil propose de reprendre aussi l'isolement en pause.
- **Pauses déduites partout — réglage du registre** pour une pause de la contention seule : en isolement seul (entrée A supplémentaire, par défaut) ou laissée dans l'entrée C sans déduction (pas d'entrée supplémentaire). Une pause commune à l'isolement et à la contention reste toujours déduite.

## 1.14.0 — 31 octobre 2026

- Onglet Patients : bouton **Mesures** sur la ligne du patient — liste détaillée de ses mesures (type, service, lieu, début et fin avec psychiatre, durée, pauses, cycle JLD, tiers, accès au détail et au décompte), ses cumuls glissants et ses entrées du registre (numéro, catégorie, période, durée).
- **Correction du registre quand les pauses sont déduites partout** : une pause de la contention pendant laquelle l'isolement continue était perdue (ni dans l'entrée C, ni ailleurs). Elle forme désormais une entrée A (isolement seul), de sorte que le registre totalise bien la durée de l'isolement. Les autres réglages ne sont pas modifiés.

## 1.13.0 — 31 octobre 2026

- Onglet Patients : **statistiques par année** pour chaque patient — colonnes regroupant des catégories du registre, avec nombre d'entrées, durée cumulée et entrées en cours. Par défaut : isolement seul (A, B), contention seule (D, E ; en rouge si elle n'est pas à 0), isolement + contention (C).
- Colonne **« Mesures (JLD) »** : isolements et contentions comptés séparément, comme le juge (une contention en CSI avec isolement = 1 entrée C au registre, mais 1 isolement et 1 contention pour le juge).
- **Colonnes paramétrables** par l'administrateur (*Administration → Onglet Patients : statistiques annuelles*) : libellé, catégories A à E, signalement si la colonne devrait rester à 0.

## 1.12.0 — 31 octobre 2026

- Décompte JLD, masques : **mise en évidence** au choix — aucune (par défaut), mesure actuelle en surbrillance (fond jaune pâle, texte en gras), mesures antérieures grisées, ou les deux. Conservée à l'impression et dans le PDF.

## 1.11.0 — 31 octobre 2026

- Décompte JLD : **le statut est celui de la mesure** — une mesure en cours est « EN COURS » sur toutes ses lignes (auparavant, une tranche de 24 h écoulée apparaissait « TERMINÉE »).
- **Numérotation par mesure** : N° 1, 2… désigne une mesure ; une même mesure présentée sur plusieurs lignes est numérotée par tranche (2.1, 2.2…), avec une légende sous le tableau. Commentaire « Suite de la même mesure (tranche n) ». Auparavant, le N° était un simple numéro de ligne.
- **Durée maximale d'une ligne réglable** dans le masque, pour l'isolement (24 h par défaut) et pour la contention (12 h par défaut) ; 0 présente chaque mesure sur une seule ligne.

## 1.10.2 — 31 octobre 2026

- **Actualisation sans retour en haut de page** : la synchronisation (toutes les 5 secondes) ne reconstruit plus la page quand rien n'a changé ; seul l'indicateur de synchronisation est mis à jour.
- Quand la page est actualisée (saisie d'un autre poste, enregistrement, fermeture d'une fenêtre, heures relatives rafraîchies chaque minute), la position de défilement de la page et des tableaux est conservée.
- Pendant une saisie dans un champ, ou dans l'administration, les nouveautés d'un autre poste ne sont pas appliquées d'office : un bandeau « Nouvelles saisies depuis un autre poste — Actualiser » apparaît, et l'actualisation se fait à la fin de la saisie (dans l'administration, au clic, pour ne pas perdre un paramétrage non enregistré).

## 1.10.1 — 31 octobre 2026

- **Journal plus lisible** : chaque saisie est décrite en clair, avec le patient et la mesure concernés.
  - Annulation : nature de la saisie annulée, date et auteur, contenu, conséquence (« toute la mesure est annulée ») et motif — au lieu de « Saisie 5774d188 annulée : erreur ».
  - Correction : champs corrigés avec ancienne et nouvelle valeur (« lieu : CSI 1 → CSI 2 ») et motif.
  - Paramétrage : libellé du paramètre et changement (« Verrouillage après inactivité : 10 min → 15 min » ; pour les pauses, seuls les réglages modifiés).
  - Fiche patient créée ou modifiée, mode d'hospitalisation avec son libellé, poste de surveillance avec son libellé, JLD et tiers avec cycle et date.

## 1.10.0 — 31 octobre 2026

- **Registre conforme à l'article L. 3222-5-1** : ajout de l'identifiant du patient (IPP) et de son âge au début de la mesure (écran, impression, CSV). L'onglet devient « Registre ».
- **Version pour communication (CADA)** du registre, réservée au cadre et à l'administrateur : identifiant patient occulté ou remplacé par un numéro propre au document ; âge exact, en tranche, mineur / majeur ou occulté ; dates complètes, sans heure ou au mois ; psychiatre masqué, « Psychiatre » ou numéroté (Psychiatre 1…) ; soignants masqués, fonction et nombre (2 IDE) ou numérotés (IDE 1…) ; lieu, mode d'hospitalisation et levées temporaires réductibles ou occultables.
- Choix les plus protecteurs présélectionnés (Conseil d'État, 8 février 2023, n° 455887), avertissement sous chaque choix moins protecteur, aperçu, impression / PDF et CSV mentionnant les occultations appliquées et la référence de la demande ; chaque édition est tracée dans le journal.

## 1.9.0 — 31 octobre 2026

- Pauses déduites : **portée au choix** — pour les délais JLD seulement (échéances, cumuls, décompte ; registre et statistiques en durée réelle, levées temporaires comprises), ou **partout** (registre et statistiques en durées hors pauses, colonne « Durée hors pauses »).
- Registre anonymisé : **colonne « Levées temporaires »** (nombre et durée) en option, aussi dans l'export CSV ; note sous le registre précisant toujours la durée affichée. Statistiques : même précision.
- **Levée temporaire désactivable** par l'administrateur quand les pauses ne sont pas déduites : le bouton *Pause* disparaît de la page des mesures ; l'historique est conservé et une pause en cours peut être reprise.

## 1.8.0 — 31 octobre 2026

- Décompte JLD, masques : **format des durées réglable** séparément pour la colonne Durée (et le tableau des pauses) et pour le cumul et les totaux : en heures (« 68 h 05 »), en jours et heures (« 2 j 20 h », présentation précédente, par défaut) ou les deux (« 68 h 05, soit 2 j 20 h 05 »). S'applique à l'impression, au PDF et au CSV.

## 1.7.1 — 31 octobre 2026

- Décompte JLD : vocabulaire des pauses sans ambiguïté. « Non décomptée » (qui peut se lire « non déduite ») est remplacé par « déduite du cumul » ou « comptée dans le cumul », dans les lignes de pause (« 1 h 00 (déduite) », « Durée déduite, non ajoutée au cumul »), le tableau des levées temporaires, la phrase d'explication, la mention de calcul en bas de page (qui précise désormais la règle dans les deux cas) et l'export CSV. « Durée totale décomptée » devient « Durée totale retenue ».
- Écrans et administration : « retrancher » devient « déduire ».

## 1.7.0 — 31 octobre 2026

- Décompte JLD, masques : **date d'édition** et **auteur** deviennent deux sections distinctes (l'ancien réglage commun est repris pour les deux).
- **Papier à en-tête** : image de fond A4 (PNG ou JPEG, compressée à l'import), sur toutes les pages ou la première seulement, **marges du texte** réglables en millimètres et respectées sur chaque page imprimée. Images partagées entre masques, supprimées quand plus aucun masque ne les utilise.
- **Pauses plus lisibles** : tableau des levées temporaires (début, reprise, durée, motif, psychiatre, prise en compte) précédé d'une phrase expliquant la règle de l'établissement.
- **Pauses déduites : rupture dans les lignes du décompte** — chaque pause interrompt le tableau par une ligne grisée « PAUSE — non décomptée » (sans numéro, cumul inchangé), et la ligne suivante « Reprise de la mesure après levée temporaire » repart de l'heure de reprise. Pauses comptées : le commentaire de la ligne concernée les signale.
- Aperçu du décompte au format de la page A4.

## 1.6.0 — 31 octobre 2026

- **Masques du décompte JLD** (*Administration*) : un masque pour l'établissement, et un masque propre à chaque service si besoin (hérite du masque de l'établissement).
- Réglages : titres, sous-titre, en-tête, destinataire, bandeau « document confidentiel », données d'identité exportées (patient, naissance, IPP, service, mode d'hospitalisation, protection juridique, mesure, lieu, psychiatre), colonnes du tableau (choix et ordre), sections (période, situation, totaux, cycle et échéances, envois JLD effectués, information du tiers, pauses, mention légale, auteur), pied de page, bloc signature.
- Aperçu en direct sur un patient fictif ; alerte si ni le nom ni l'IPP ne sont exportés.
- **Export CSV** du décompte selon le masque, en plus de l'impression et du PDF.
- Les anciens réglages (titres, colonnes masquées, import V1.3) restent repris.

## 1.5.0 — 31 octobre 2026

- **Option « Retrancher les pauses des décomptes »** (*Administration → Pauses*) : durées, cumuls sur 15 jours, échéances JLD (reportées de la durée des pauses), décompte JLD (pause retranchée indiquée par ligne), registre et statistiques. Une pause sans reprise saisie n'est retranchée que jusqu'à son heure de reprise prévue. Désactivée par défaut.
- **Option « Reprise automatique »** à l'heure prévue, sans saisie ; la reprise anticipée reste possible. Désactivée par défaut.
- **Seuils réglables** : alerte (12 h par défaut, 0 pour aucune) et refus (48 h par défaut, plafonné à 48 h).
- Textes de la fenêtre de pause, du détail et du décompte adaptés au réglage en vigueur.

## 1.4.0 — 31 octobre 2026

- **Pause d'une mesure (levée temporaire décidée par le psychiatre)** : bouton *Pause* avec durée (raccourcis 30 min, 1 h, 2 h, 4 h) ou heure de reprise prévue, motif et psychiatre ; bouton *Reprise* pour la reprise effective.
- La pause ne termine pas la mesure : durée et échéances JLD inchangées (calcul prudent). Total des pauses affiché dans la liste, le détail et le décompte JLD.
- Contention en cours mise en pause avec l'isolement (case cochée par défaut), et reprise ensemble.
- Alertes : reprise prévue dépassée sans saisie (badge rouge, tableau de bord), contention en cours pendant la pause de l'isolement, pause de plus de 12 h ; refus au-delà de 48 h (fin de mesure).
- Fin d'une mesure en pause : la date proposée est le début de la pause.
- Deux pauses saisies en même temps sur une même mesure sont signalées comme conflit à arbitrer.

## 1.3.1 — 31 octobre 2026

- Nouvelle mesure : **date de naissance obligatoire** pour un nouveau patient, demandée aussi quand elle manque dans une fiche existante (patients importés).
- **Alertes en rouge sous les champs concernés**, recalculées pendant la saisie : patient mineur, patient en soins libres, « SL mineur » incohérent avec l'âge, mesure du même type déjà en cours, cumul élevé sur 15 jours, protection juridique, IPP déjà attribué, saisie tardive ou dans le futur, contention hors espace d'isolement, service sans CSI paramétrée.
- Patients fictifs (démonstration, formation) avec date de naissance, dont un mineur.

## 1.3.0 — 31 octobre 2026

Le mode formation est revu : il remplace le rôle Formateur et la bascule de poste de la version 1.2.0.

- **Accès au mode formation** accordé à tous les comptes, **désactivable par l'administrateur** compte par compte (fiche du compte, création en lot).
- **Choix à la connexion** entre *Données réelles* et *Mode formation* ; l'agent garde son compte, ses rôles et ses services dans les deux.
- Jeu de formation créé automatiquement à la première connexion en mode formation, à partir du paramétrage réel ; régénération réservée à l'administrateur.
- Bouton *Passer aux données réelles* dans le bandeau violet.
- Suppression du rôle Formateur et de la bascule de poste.

## 1.2.0 — 31 octobre 2026

- **Rôle Formateur**, sans droit sur les données réelles par ce seul rôle.
- **Mode formation** : le formateur bascule provisoirement un poste (1 à 8 h ou jusqu'à la fin de la journée) sur un jeu de données fictives, rangé dans le sous-dossier `formation` du partage et chiffré avec sa propre clé (conservée chiffrée dans le coffre réel).
- Le jeu de formation reprend les services, CSI et postes de surveillance réels, avec patients et mesures fictifs ; il peut être régénéré à tout moment.
- Les agents s'y connectent avec leur vrai compte, rôles et services ; le formateur y dispose aussi des droits IDE, secrétaire et cadre sur tous les services.
- Bandeau violet sur tous les écrans, retour aux données réelles à l'heure prévue, par le formateur ou depuis l'écran de connexion.
- Les traces de comptes restent dans le journal réel ; l'administration des comptes et l'import sont indisponibles en formation.
- Un dossier sans coffre (jeu de formation ouvert par erreur, coffre perdu) n'est plus jamais proposé à l'initialisation.

## 1.1.0 — 30 octobre 2026

- **Rôle aide-soignant(e) (AS)**, avec les mêmes droits que l'IDE.
- **Création de comptes en lot** à partir d'une liste d'agents collée depuis un tableur ou d'un fichier CSV : identifiants proposés (prenom.nom), rôles et services par ligne ou par défaut, aperçu des erreurs avant création, une seule écriture du coffre.
- **Mots de passe provisoires** tirés au hasard, **changement obligatoire à la première connexion** (et après une réinitialisation) ; le nouveau mot de passe doit différer du provisoire.
- **Réinitialisation par l'administrateur** en cas de perte : l'ancien mot de passe cesse aussitôt de fonctionner, le nouveau est provisoire.
- **Fiches de remise** imprimables (une par agent) et export CSV des mots de passe provisoires, affichés une seule fois.
- Identifiant proposé automatiquement à la création d'un compte.

## 1.0.0 — 30 octobre 2026

Première version complète de l'application web, successeur du classeur Excel/VBA V1.3.

- Comptes nominatifs, rôles cumulables (IDE, secrétaire, cadre de santé, administrateur) et **services affectés par compte**, appliqués à la connexion et à la création d'une mesure.
- Report des décisions médicales de début et de fin, changement de lieu, contention en CSI avec isolement associé.
- Échéances JLD identiques à la V1.3 : cumul sur 15 jours glissants, cycles ancrés sur le début de la mesure, rythme des mesures longues, remise à zéro après mainlevée.
- Envois JLD, information des tiers par cycle, décompte JLD imprimable avec mise en page par service.
- Professionnels chargés de la surveillance en CSI, postes par défaut ou propres à un service.
- Onglet Patients : cumuls 48 h et 15 jours, niveau de vigilance, historique du mode d'hospitalisation.
- Registre anonymisé A à E, numéroté dans l'ordre des fins, à la suite du registre antérieur.
- Statistiques annuelles N/N-1, suivi réglementaire, répartition mensuelle, export pseudonymisé.
- Tableau de bord : échéances, tiers, postes incomplets, patients en soins libres, mineurs, cumuls élevés, conflits.
- Import du classeur V1.3 (mesures, patients, cycles, tiers, professionnels, paramétrage) avec rapport et comparaison des échéances.
- Stockage chiffré en ajout seul, saisie simultanée, détection des conflits et des saisies manquantes, instantanés mensuels.
- Kit de déploiement : fiche projet, fiche technique, installation, secours, RGPD/AIPD, guide utilisateur.
- Licence EUPL-1.2.

## 0.1.0 — 30 octobre 2026

Prototype : moteur de règles, journal chiffré, mode démonstration.
