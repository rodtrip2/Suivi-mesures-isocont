# Journal des versions

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
