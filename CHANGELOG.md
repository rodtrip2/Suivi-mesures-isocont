# Journal des versions

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
