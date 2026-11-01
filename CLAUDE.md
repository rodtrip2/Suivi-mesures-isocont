# CLAUDE.md — consignes du projet Suivi-mesures-isocont

Ce fichier rassemble les consignes du porteur du projet et les conventions de travail. Il fait foi pour toute évolution du code ou de la documentation. En cas de doute sur une règle légale ou un choix fonctionnel, demander au porteur plutôt que supposer.

## 1. Le projet

- Application web de suivi des mesures d'isolement et de contention en psychiatrie, conforme à l'article L. 3222-5-1 du code de la santé publique et à l'instruction DGOS/DACS du 25 mars 2022. Elle succède au classeur Excel/VBA V1.3 (dépôt `rodtrip2/Suivi_Isolement_Contention`).
- Porteur : Roddy Ricart, faisant fonction cadre de santé (CHHA, pôle santé mentale, UHP). Projet réalisé sur son temps libre, **open source sous licence EUPL-1.2** (`LICENSE`, `NOTICE`).
- Objectifs : anticiper les communications au JLD ; tracer le recours aux mesures ; sécuriser les pratiques (délais, tiers informé, lieu dédié en CSI…) ; produire un registre présentable aux instances ; produire des statistiques.
- Le DPI couvre la prescription médicale et la surveillance infirmière. L'outil est parallèle et se limite aux **durées, au calendrier et aux envois JLD, au registre et aux statistiques**.
- Les psychiatres ne sont pas utilisateurs : les IDE reportent les décisions médicales (début, fin, pause, reprise).
- Le dépôt GitHub `rodtrip2/Suivi-mesures-isocont` est **public** (GitHub Pages). Un **kit de déploiement** valable pour tout hôpital accompagne l'application (`kit/`).

## 2. Données et sécurité (non négociable)

- **Aucune donnée réelle** dans le dépôt, les tests, la démonstration ou les captures. Toute donnée d'exemple est inventée et marquée « (fictif) ».
- Pas de données réelles avant validation par la DSI et le DPO de l'établissement.
- Les données ne quittent jamais le réseau de l'hôpital : application statique, aucune connexion sortante (CSP `connect-src 'none'`), aucun script ni service externe.
- Stockage chiffré sur un partage SMB (File System Access API) : AES-GCM 256 avec clé de données enveloppée ; déverrouillage par mot de passe (PBKDF2), clé de sécurité YubiKey (WebAuthn PRF) ou code de secours. Journal en ajout seul, un fichier chiffré par saisie, jamais modifié ; corrections et annulations sont elles-mêmes des saisies.
- Saisie simultanée sans perte : versions de base, détection des conflits (la saisie concurrente n'est pas appliquée et reste à arbitrer), chaînage des saisies (détection des fichiers manquants).
- Les mots de passe ne sont jamais écrits dans le journal.
- Le registre communiqué à un tiers (CADA) est toujours occulté (voir § 6).

## 3. Utilisateurs, rôles, services

- Comptes nominatifs, rôles cumulables : **IDE**, **AS** (mêmes droits que l'IDE), **Secrétaire**, **Cadre de santé**, **Administrateur**.
- La secrétaire fait les envois et le suivi JLD en semaine ; l'IDE le fait le week-end et en son absence : **droit JLD permanent pour l'IDE**.
- L'information du tiers est faite par le psychiatre, **en dernier recours par l'IDE**.
- Le cadre cumule pour l'instant le rôle d'administrateur, mais les deux rôles doivent rester **séparables**.
- Chaque compte (hors administrateur) a **un ou plusieurs services** : seuls ceux-ci s'affichent à la connexion et à la création d'une mesure. L'administrateur voit tous les services.
- Création de comptes **en lot** (liste d'agents collée ou CSV), mots de passe provisoires tirés au hasard, **changement obligatoire à la première connexion**, réinitialisation par l'administrateur (nouveau mot de passe provisoire), fiches de remise imprimables.
- **Mode formation** : accès accordé à tous les comptes, désactivable par l'administrateur compte par compte ; à la connexion, l'agent choisit *Données réelles* ou *Mode formation* (jeu entièrement fictif, chiffré à part, bandeau violet). Le rôle Formateur et la bascule de poste ont été abandonnés à la demande du porteur.

## 4. Règles légales et de calcul

- Cumul glissant sur 15 jours, par patient et par type, périodes qui se chevauchent comptées une seule fois ; une mesure reprise moins de 48 h après la fin de la précédente s'y ajoute.
- Échéances JLD **toujours calculées depuis le début de la mesure**, jamais depuis la date des décisions du juge ; rythme particulier des mesures longues conservé. Seuils par défaut : isolement 48/72/96 h, intervalle 96 h, rythme long à partir du cycle 3 (144/168 h) ; contention 24/48/72 h, intervalle 72 h. Valeurs modifiables uniquement en cas d'évolution des textes.
- La **mainlevée du JLD est un indicateur légal** : elle ne termine pas la mesure. La fin est toujours une décision médicale. Le cumul repart de zéro après la fin d'une mesure levée.
- Mode d'hospitalisation retenu au registre : le nouveau mode s'il passe des soins libres à la contrainte dans les 12 h suivant le début (délai paramétrable).
- Une mesure qui change réellement de lieu est terminée et une nouvelle commence au nouveau lieu ; une erreur de saisie se corrige (cadre, motif obligatoire).
- Nouvelle mesure : **date de naissance obligatoire** pour un nouveau patient ; **alertes en rouge sous les champs** concernés (mineur, soins libres, « SL mineur » incohérent, mesure du même type en cours, cumul élevé, protection juridique, IPP existant, saisie tardive ou future, contention hors CSI, service sans CSI). Les alertes n'empêchent pas l'enregistrement, sauf les dates impossibles.
- **Alertes de l'établissement** (`config.alertes`, `M.alertesConfig`, `app/js/ui-alertes.js`) : déclencheur (soins libres au début, mineur, protection juridique, contention / isolement hors CSI, toute contention, toute mesure), services, nature **rappel** (affiché à la saisie) ou **information** d'une personne dans un délai (0 = sans délai), avec **traçabilité** (saisie `INFORMATION` : qui, moyen, date) et suivi au tableau de bord tant qu'elle n'est pas tracée. Ne s'appliquent qu'aux mesures saisies après l'activation (`depuis`), jamais à l'historique importé. Besoin exprimé au CHHA : informer **sans délai** le cadre ou l'administrateur de garde quand un patient en soins libres est mis en isolement ou en contention (règle fournie, désactivée par défaut).
- **Cas particuliers** (`config.casParticuliers`, `M.optionsCas`, `app/js/ui-cas.js`, sous-onglet *Cas particuliers* où se rangent les arbitrages des situations rares) :
  - **48 h après une mainlevée** (art. L. 3222-5-1, II) : alerte rouge à la saisie pour **toute nouvelle mesure** (choix validé par le porteur ; « même type » reste possible), échéance « Info avant » ramenée au début de la nouvelle mesure (information du JLD sans délai ; **activé par défaut, réglable**, validé par le porteur), point de vigilance. Pas de description des éléments nouveaux dans l'outil : elle relève du certificat médical (consigne du porteur).
  - **Mesure débutée ailleurs** : `debutInitial` / `lieuInitial` ; `mesuresCalcul` ramène le début à la décision initiale pour les délais JLD, cumuls et décompte (`debutService` = arrivée) ; le registre et les statistiques partent de l'arrivée.
  - **Fusion de fiches** (saisie `FUSION`, cadre) : mesures, modes et champs manquants rattachés à la fiche conservée, saisies ultérieures sur l'ancienne fiche redirigées (`ciblePatient`), aperçu de l'effet (cumuls, échéances, écarts d'identité, chevauchements), annulable. Détection des fiches proches (`doublonsPossibles`).
  - Arbitrages à venir (lots suivants) : passage en soins somatiques ou aux urgences pendant une mesure (suspension, arrêt, poursuite avec décompte dans le service, ou dans un registre « hébergement somatique » / « urgences » — au choix de l'établissement), transfert entre services (mesure unique pour le JLD, répartie au registre), correction proposée par l'IDE puis validée par le cadre, entretien après la mesure facultatif et nommé par l'établissement (ex. « Débriefing post-isolement »).
- Textes légaux proposés : contention « prise dans le cadre d'une mesure d'isolement » (art. L. 3222-5-1) ; seule exception, la contention mécanique ambulatoire (HAS 2017 : troubles gravissimes de longue évolution, plan de soins du psychiatre traitant, hors urgence) ; soins libres : isolement exceptionnel, en urgence, 12 h au maximum (HAS 2017).

## 5. Pauses (levées temporaires)

- Bouton *Pause* : début, **durée ou heure de reprise**, motif, psychiatre ; bouton *Reprise*. La pause ne termine pas la mesure. Si le psychiatre décide de ne pas reprendre : *Fin*, date proposée = début de la pause.
- Par défaut, la durée des pauses reste **comptée** (calcul prudent : les échéances JLD ne bougent pas).
- Options d'administration (*Administration → Règles et pauses*), toutes tracées au journal :
  - **activer / désactiver** la levée temporaire (désactivable seulement si les pauses ne sont pas déduites) ;
  - **déduire la durée des pauses du cumul**, puis la **portée** : délais JLD seulement (registre et statistiques en durée réelle), ou **partout** ;
  - si déduites partout, **pause de la contention seule** au registre : en isolement seul (entrée A supplémentaire, par défaut) ou laissée dans l'entrée C sans déduction ; une pause commune isolement + contention est toujours déduite ;
  - **reprise automatique** à l'heure prévue (désactivée par défaut) ;
  - **seuils d'alerte et de refus réglables** (12 h et 48 h par défaut ; refus jamais au-delà de 48 h) ;
  - colonne « Levées temporaires » au registre (option) ;
  - **interdire la pause de l'isolement seul pendant une contention** (désactivé par défaut) : la contention est alors mise en pause aussi, ou terminée dans la même saisie.
- Une pause sans reprise saisie n'est déduite que jusqu'à son heure de reprise prévue.
- **Pause d'une contention pendant un isolement** : l'agent doit confirmer si elle concerne la contention seule ou aussi l'isolement. Pause d'un isolement avec contention en cours : la contention est mise en pause aussi (case cochée par défaut, alerte si décochée).
- Vocabulaire : toujours **« déduite du cumul »** ou **« comptée dans le cumul »**, jamais « décomptée » / « non décomptée » (ambigu : « décompter » signifie aussi « déduire »).

## 6. Registre

- Conforme à l'article L. 3222-5-1 : **identifiant du patient (IPP) et âge**, mode d'hospitalisation, date et heure de début, durée, psychiatre, professionnels chargés de la surveillance (traçabilité des agents **par demi-journée / poste**, indispensable au registre).
- Catégories A à E ; une contention en CSI couvre l'isolement qui l'accompagne (entrée C, isolement avant/après en A). Numérotation commune, dans l'ordre des fins, à la suite du dernier numéro du registre antérieur (compteur par service et par année).
- Registre légal présenté seulement à la CDSP, au CGLPL et aux parlementaires.
- **Version pour communication (CADA)** : options d'occultation (identifiant patient occulté ou remplacé par un numéro propre au document ; âge exact, tranche, mineur/majeur ou occulté ; dates ; psychiatre et soignants masqués, génériques ou numérotés — Psychiatre 1, IDE 1 ; lieu ; mode ; pauses). **Choix les plus protecteurs présélectionnés** (CE, 8 février 2023, n° 455887), avertissement sous chaque choix moins protecteur, édition tracée au journal avec la référence de la demande.
- Note sous le registre indiquant toujours quelle durée est affichée (réelle ou hors pauses) et la signification des mentions particulières.

## 7. Décompte JLD (pièce jointe aux communications)

- **Masques** : un masque d'établissement et, si besoin, un masque propre à chaque service (héritage). Réglages : titres, sous-titre, en-tête, destinataire, bandeau confidentiel, données d'identité, colonnes (choix et ordre), sections (dont **date d'édition et auteur séparés**), pied de page, bloc signature, **papier à en-tête** (image A4, toutes les pages ou la première, marges en mm), **format des durées et du cumul** (heures, jours, ou les deux), **durée maximale d'une ligne** par type (24 h isolement, 12 h contention ; 0 = une ligne), **mise en évidence** (mesure actuelle en surbrillance et/ou mesures antérieures grisées).
- Le **statut est celui de la mesure** (en cours sur toutes ses tranches). N° = numéro de la mesure dans le décompte, suivi du numéro de tranche (2.1, 2.2…), avec légende.
- Pauses déduites : chaque pause **interrompt le tableau** par une ligne « PAUSE » grisée (durée « (déduite) », cumul inchangé), puis « Reprise de la mesure après levée temporaire ». Tableau des pauses précédé d'une phrase qui explique la règle de l'établissement.
- Export impression / PDF et CSV (nominatif : à enregistrer sur le réseau de l'établissement).

## 8. Statistiques et onglet Patients

- Statistiques annuelles N / N-1 (rapport « L'isolement et la contention en chiffres »), export CSV pseudonymisé.
- Onglet Patients : cumuls 48 h / 15 jours, vigilance, mode d'hospitalisation ; **statistiques par année** en colonnes **paramétrables** regroupant des catégories A à E (par défaut : isolement seul A–B, contention seule D–E signalée si non nulle, isolement + contention C) ; colonne **« Mesures (JLD) »** qui compte isolements et contentions séparément, comme le juge ; bouton **Mesures** ouvrant la liste détaillée des mesures du patient et ses entrées du registre.

## 9. Reprise de l'historique

- **Import générique à partir du registre du service** (seul document obligatoirement numérique) : CSV ou Excel de n'importe quel outil, correspondance des colonnes proposée et modifiable, ligne d'en-tête repérée, modèle CSV téléchargeable (`app/js/import-registre.js`, fiche `kit/07`). Une ligne = une entrée : A/B → isolement, C → contention en CSI + l'isolement qui l'accompagne, D/E → contention hors espace d'isolement ; portions d'isolement contiguës d'un même patient fusionnées en une mesure ; lignes d'origine conservées (`entreesOrigine`) pour reproduire le registre à l'identique ; soignants cités affichés à défaut de traces par poste. Cycles JLD et tiers non repris (absents du registre).
- **Le kit et l'interface s'adressent à tout établissement** : ne jamais y présenter le classeur V1.3 (outil du CHHA dont est issu le projet) comme une référence ou un prérequis. La reprise de l'historique se présente à partir du registre ; l'import V1.3 n'apparaît que comme un cas particulier, clairement signalé. Dans les textes communs aux deux imports, parler de « document importé », « fichier » ou « registre importé ».
- Les deux imports partagent la même mécanique (services, compteurs, choix de numérotation, contrôle, aperçu, décisions et corrections par mesure).

### Import du classeur V1.3

- Lecture dans le navigateur, un seul lot annulable, pas de doublon si relancé, rapport et comparaison des échéances.
- **Services absents** : créer (libellé modifiable), rattacher à un service existant, ou ignorer s'il ne porte aucune donnée.
- **Compteurs du registre** proposés (calculés sur les entrées que l'outil numérotera) et modifiables ; dernier numéro du classeur mémorisé.
- **Contrôle de la numérotation** (numéros du classeur contre numéros recalculés, écarts expliqués).
- **Mesures déjà numérotées** : laisser tel quel (par défaut), recalculer l'année en cours, ou recalculer toutes les années (avertissement clair sur la modification des statistiques antérieures) ; modifiable ensuite année par année, compteur recalculé.
- **Aperçu de l'impact** de chaque choix sur le registre et les statistiques avant de confirmer : entrées et **durée cumulée par catégorie**, durées, heures de CSI, patients, numéros, et **détail des mesures modifiées** (entrées de chaque mesure selon chaque choix, mesures déjà présentes comprises), avec pour chaque entrée **le pourquoi de sa catégorie** (règle appliquée, lieu, case « exception », écart avec le classeur et piste de vérification).
- **Décision mesure par mesure** (prioritaire sur le choix de l'année) : garder le n° du classeur ou appliquer la règle de l'outil ; **correction des données** qui déterminent la catégorie (lieu CSI ou non, exception) avant import, tracée avec la mesure, sans modifier le classeur. Les numéros recalculés partent du compteur et sautent ceux conservés du classeur.

## 10. Interface

- Interface en français, vocabulaire du soin et du droit (pas de jargon technique). Libellés du journal lisibles : patient et mesure concernés, ancienne → nouvelle valeur, motif.
- **Administration en sous-onglets** : Comptes et sécurité · Établissement et services · Règles et pauses · Alertes · Cas particuliers · Registre et statistiques · Décompte JLD · Reprise des données · Informations (sous-onglet retenu par navigateur). Tout nouveau réglage se range dans le sous-onglet correspondant.
- Actualisation automatique **sans retour en haut de page ni perte de saisie** (synchronisation toutes les 5 s sans reconstruction si rien n'a changé ; bandeau « Actualiser » pendant une saisie ou en administration).
- Tout changement de paramétrage passe par une saisie `CONFIG` tracée au journal ; les choix à fort impact demandent une confirmation qui décrit l'effet.
- Les options nouvelles sont **désactivées par défaut** quand elles changent un comportement existant, sauf demande contraire du porteur.

## 11. Architecture et conventions de code

- HTML, CSS et JavaScript sans dépendance ni étape de construction (`app/`). Construction du DOM avec l'aide `h()`, **jamais `innerHTML`** ; styles par classes CSS ou CSSOM (`el.style.setProperty`), jamais d'attribut `style` ni de `<style>` (CSP).
- Modules : `rules.js` (moteur légal), `model.js` (réduction du journal, registre, statistiques, décompte), `crypto.js`, `store.js`, `session.js`, `import-v13.js`, `ui*.js`. La logique métier reste dans `rules.js` / `model.js` (testable sous Node) ; l'interface ne fait qu'afficher.
- Les paramètres ont une valeur par défaut dans `CONFIG_DEFAUT` et sont validés à la lecture (`optionsPauses`, `masqueDecompte`, `colonnesPatients`…).
- Ajouter tout nouveau paramètre à la copie du jeu de formation (`demo.js`) et à son libellé dans le journal (`LIB_CONFIG`, `resumeConfig`).

## 12. Procédure après chaque modification

1. Tests unitaires : `npm test` (Node ≥ 20) — tous verts ; ajouter des tests pour toute règle nouvelle ou tout défaut corrigé.
2. Vérification dans un vrai navigateur (Playwright, mode démonstration, données fictives) des écrans modifiés.
3. Mettre à jour le guide utilisateur (`kit/06`), et selon le cas la fiche projet (`kit/01`), le guide d'installation (`kit/03`), les éléments RGPD (`kit/05`), `docs/architecture.md`.
4. `CHANGELOG.md` (nouvelle entrée en tête), version dans `app/js/version.js` et `package.json`.
5. Régénérer les PDF du kit (`python3 scripts/kit-pdf.py`) et les empreintes (`node scripts/empreintes.mjs`).
6. **Commit et push sur GitHub après chaque modification** (consigne permanente du porteur). Message en français ; terminer par les lignes d'attribution demandées par l'environnement.
7. Compte rendu au porteur en français : ce qui a changé, ce qui reste à valider de son côté (choix juridiques, formulations), captures si utile.

## 13. Points à faire valider par l'établissement

- Déduire ou non les pauses (lecture des textes), portée de la déduction.
- Formulation des alertes (ex. information des titulaires de l'autorité parentale pour un mineur) ; textes des alertes de l'établissement (soins libres, contention hors CSI) et personnes à informer.
- Version du registre communiquée au titre du CRPA.
- Acceptation du CSV du décompte par le greffe du JLD.
- Test physique de la clé YubiKey sur un poste de l'établissement.
