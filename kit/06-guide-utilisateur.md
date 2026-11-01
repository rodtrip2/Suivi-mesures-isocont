# Guide utilisateur

*Suivi des mesures d'isolement et de contention — à lire en 10 minutes.*

## Se connecter

1. Ouvrir le lien de l'application (Edge ou Chrome).
2. Cliquer *Reprendre* (ou, la première fois, *Ouvrir le dossier réseau du service* et choisir le dossier indiqué par votre cadre). Autoriser l'accès si le navigateur le demande.
3. Saisir votre identifiant et le mot de passe de votre fiche de remise.
4. **Première connexion** (ou après une réinitialisation) : l'application vous demande aussitôt de choisir votre mot de passe personnel, d'au moins 12 caractères. Une courte phrase de quelques mots est facile à retenir. Vous pouvez le changer ensuite à tout moment avec le bouton *Mot de passe*.
5. Vous ne voyez que les services qui vous sont affectés. La session se verrouille seule après quelques minutes sans activité ; pensez à *Verrouiller* en quittant le poste.

## Les couleurs des échéances

| Couleur | Signification |
| --- | --- |
| Vert | Dans les temps |
| Jaune | Échéance dans moins de 12 h |
| Rouge | Échéance dépassée |
| Bleu | Fait à temps |
| Violet | Fait hors délai |
| Gris | Sans objet (mesure terminée avant l'échéance) |

## IDE et aides-soignants (AS)

IDE et AS disposent des mêmes droits.

**Nouvelle mesure** (onglet *Mesures → + Nouvelle mesure*) : vous reportez la décision du psychiatre.
- Choisir le patient (ou *+ Nouveau patient* avec son IPP : si l'IPP existe déjà, l'outil propose sa fiche). La **date de naissance est obligatoire** pour un nouveau patient, et demandée si elle manque dans une fiche existante.
- Lisez les **alertes en rouge** qui apparaissent sous les champs pendant la saisie : patient mineur, patient en soins libres, mode « SL mineur » incohérent avec l'âge, mesure du même type déjà en cours (doublon possible), cumul élevé sur 15 jours, mesure de protection juridique, saisie tardive, contention hors espace d'isolement. Elles n'empêchent pas l'enregistrement (sauf date dans le futur) : elles signalent ce qu'il faut vérifier ou régulariser.
- Vérifier le mode d'hospitalisation.
- Type, date et heure **de la décision**, psychiatre, lieu.
- Pour une contention en chambre de soins intensifs sans isolement en cours, l'outil propose de créer aussi l'isolement : laissez la case cochée.

**Fin de mesure** : bouton *Fin* sur la ligne, avec la date, l'heure et le psychiatre qui a décidé l'arrêt. Une mainlevée du juge ne termine pas la mesure : c'est toujours la décision médicale qui y met fin.

**Pause (levée temporaire)** : quand le psychiatre lève temporairement la mesure (repas, douche, visite…), bouton *Pause* sur la ligne. Indiquez le début, puis **une durée** (raccourcis 30 min, 1 h, 2 h, 4 h) **ou une heure de reprise**, le motif et le psychiatre. Pour un isolement avec une contention en cours, la contention est mise en pause en même temps (case cochée par défaut : une contention ne peut pas se poursuivre hors isolement ; si vous la décochez, une alerte le rappelle et le tableau de bord le signale). Si l'établissement a activé le verrou, choisissez entre mettre aussi la contention en pause ou y mettre fin au début de la pause. Pour une **contention pendant un isolement**, indiquez obligatoirement si la pause concerne la contention seulement (le patient reste à l'isolement) ou aussi l'isolement (le patient sort de l'isolement) ; à la reprise, l'outil propose de reprendre les deux.
- La pause **ne met pas fin à la mesure**. Selon le choix de l'établissement, sa durée est soit comptée (la durée et les échéances JLD continuent de courir, réglage par défaut), soit déduite du cumul (les échéances JLD sont alors reportées d'autant). La fenêtre de pause indique le réglage en vigueur. La ligne apparaît hachurée avec un badge *Pause → heure de reprise*.
- Au retour du patient, bouton *Reprise* : l'heure prévue est proposée, corrigez-la si besoin. Si l'heure prévue est dépassée sans reprise saisie, le badge passe au rouge et le tableau de bord le signale. Si l'établissement a activé la **reprise automatique**, la mesure reprend d'elle-même à l'heure prévue : ne saisissez une reprise que si elle a lieu plus tôt.
- Si le psychiatre décide de ne pas reprendre, utilisez *Fin* : la date proposée est le début de la pause.
- Au-delà d'une durée réglée par l'administrateur (12 h par défaut), une alerte demande de vérifier qu'il ne s'agit pas d'une fin de mesure ; au-delà d'un second seuil (48 h par défaut, et jamais plus), la pause est refusée : c'est une fin de mesure.

**Changement de lieu** (de CSI vers une chambre, par exemple) : *Détail → Changer de lieu…*. Pour une simple erreur de saisie, demandez une correction à votre cadre.

**Information du tiers** : bouton *Tiers*. Indiquez le résultat (informé, tentative sans succès, pas de tiers, refus du patient…), la qualité du tiers et qui l'a informé : le psychiatre, ou vous-même en dernier recours. À renouveler à chaque nouveau cycle JLD.

**Surveillance en CSI** : onglet *Surveillance CSI*. Deux emplacements par poste ; complétez les noms et fonctions des professionnels présents. Ces informations alimentent le registre.

**Envois JLD le week-end** ou en l'absence du secrétariat : voir ci-dessous.

## Secrétariat

Onglet *JLD* : les mesures en cours, triées par urgence.
- *Saisir un envoi* : information du JLD, saisine, ou décision reçue (maintien ou mainlevée), avec la date et l'heure réelles.
- Une décision de **maintien** ouvre automatiquement le cycle suivant ; pensez au tiers, qui doit être informé de ce renouvellement.
- *Décompte* (onglet *Mesures*) : document à joindre à la communication, mis en forme selon le masque du service. Le N° désigne la mesure (1 = première mesure prise en compte dans les 15 jours) ; une mesure présentée sur plusieurs lignes porte des numéros de tranche (2.1, 2.2…) et son statut (en cours ou terminée) figure sur chacune de ses lignes. Les levées temporaires y figurent dans un tableau (début, reprise, durée, motif, psychiatre, prise en compte) précédé d'une phrase qui explique la règle de l'établissement ; si les pauses sont déduites, chacune interrompt le tableau du décompte par une ligne grisée « PAUSE » dont la durée est marquée « (déduite) » et n'est pas ajoutée au cumul, et la ligne suivante reprend à l'heure de reprise. Le décompte emploie toujours « déduite du cumul » ou « comptée dans le cumul », jamais « décomptée », qui prête à confusion. *Imprimer / PDF* : choisissez « Enregistrer au format PDF » comme imprimante. *Exporter (CSV)* : mêmes données, pour un tableur ; le fichier est nominatif, enregistrez-le uniquement sur le réseau de l'établissement.

## Cadre de santé

- **Tableau de bord** : échéances, tiers à renseigner, postes de surveillance incomplets, points de vigilance (patient en soins libres, mineur, cumul élevé), saisies en conflit.
- **Patients** : cumuls sur 48 h et 15 jours, niveau de vigilance, mode d'hospitalisation et son historique. Pour l'année choisie, colonnes du registre par patient (par défaut : isolement seul A–B, contention seule D–E — en rouge si elle n'est pas à 0 —, isolement + contention C), avec nombre d'entrées et durée cumulée, et colonne *Mesures (JLD)* qui compte isolements et contentions séparément, comme le juge. Les colonnes se paramètrent dans *Administration → Registre et statistiques → Onglet Patients : statistiques annuelles*. Le bouton *Mesures* de la ligne ouvre la liste détaillée des mesures du patient (accès au détail et au décompte de chacune) et ses entrées du registre.
- **Corrections** : *Détail → Corriger…* (motif obligatoire) ; *Annuler* une saisie erronée dans le détail. Tout reste visible dans le journal.
- **Conflits** : *Journal → Saisies en conflit à arbitrer*.
- **Registre** : par service et par année, imprimable et exportable ; il désigne le patient par son IPP et son âge (art. L. 3222-5-1) et n'est présenté qu'à la CDSP, au CGLPL et aux parlementaires.
- **Version pour communication (CADA)** (onglet *Registre*, cadre et administrateur) : pour toute autre demande, choisissez les occultations (identifiant patient, âge, dates, psychiatre, soignants, lieu, mode d'hospitalisation, levées temporaires) ; les choix recommandés sont présélectionnés et un avertissement accompagne les choix moins protecteurs. Indiquez la référence de la demande : l'impression ou l'export est tracé dans le journal. Selon le paramétrage, la durée est réelle ou hors pauses (indiqué sous le tableau), avec une colonne des levées temporaires si elle est activée.
- **Statistiques** : rapport annuel comparé à l'année précédente. Saisissez le nombre de patients en hospitalisation complète et sous contrainte (chiffres du DIM) pour obtenir les pourcentages.

## Mode formation

Le mode formation ouvre un jeu de données **entièrement fictif**, rangé à part sur le réseau, pour s'entraîner, former un collègue ou tester une manipulation sans toucher aux données réelles.

1. Sur l'écran de connexion, sous le mot de passe, choisissez **Mode formation** au lieu de *Données réelles*.
2. Vous retrouvez votre compte, vos rôles et vos services, avec des patients et des mesures fictifs (échéances JLD en cours, registre, statistiques).
3. Un **bandeau violet** reste affiché sur tous les écrans. N'y saisissez jamais de donnée réelle.
4. Pour revenir aux données réelles : bouton *Passer aux données réelles* du bandeau, ou déconnexion puis nouvelle connexion en choisissant *Données réelles*.

L'accès au mode formation est ouvert à tous les comptes ; l'administrateur peut le retirer à un agent. Votre mot de passe est le même dans les deux modes : un changement fait en formation vaut aussi pour les données réelles.

## Administrateur

L'onglet *Administration* est organisé en **sous-onglets** : *Comptes et sécurité* (comptes, clés de sécurité, code de secours, mode formation), *Établissement et services* (services, chambres de soins intensifs, postes de surveillance), *Règles et pauses*, *Alertes*, *Cas particuliers*, *Registre et statistiques* (compteurs, numérotation des mesures importées, colonnes de l'onglet Patients), *Décompte JLD* (masques), *Reprise des données* et *Informations*. Le dernier sous-onglet consulté est retenu.

**Correction d'une erreur de saisie en l'absence du cadre** : l'IDE ou l'AS ouvre le détail de la mesure, bouton *Proposer une correction…* (début, fin, lieu, avec un motif). La correction n'est pas appliquée tout de suite : la mesure garde ses valeurs, un signalement « Correction proposée » s'affiche sur sa ligne et dans les points de vigilance. Le cadre l'examine (ancienne → nouvelle valeur, auteur, motif), puis la valide ou la refuse avec un motif. Tout est tracé au journal.

**Patient détenu** : case à cocher à la création du patient et dans sa fiche ; badge « détenu » dans l'onglet Patients. L'établissement peut y associer une alerte (*Administration → Alertes*, déclencheur « Patient détenu »).

**Changement d'heure** : les durées et les échéances sont calculées en heures réelles. Une mesure qui traverse le passage à l'heure d'hiver dure une heure de plus que ne le laisse penser l'horloge (une tranche de 24 h du décompte se termine alors à 19 h pour une mesure débutée à 20 h) ; une heure de moins au passage à l'heure d'été.

**Motif du recours et entretien après la mesure** (si l'établissement les a activés) : la nouvelle mesure propose un motif du recours (liste de l'établissement, facultatif). Après la fin d'une mesure, le bouton portant le nom choisi par l'établissement (par exemple *Débriefing post-isolement…*) dans le détail permet de noter s'il a été réalisé et quand ; le contenu reste dans le dossier du patient. Les mesures terminées depuis moins de 7 jours sans entretien renseigné apparaissent dans les points de vigilance.

**Motif de fin** : la fin d'une mesure précise son motif (décision médicale, suite à la mainlevée du JLD — proposé si le juge a levé la mesure —, sortie, transfert hors de l'établissement, passage en soins somatiques ou aux urgences, fugue, décès, autre), avec une précision facultative. Pour un décès, un rappel s'affiche : un décès inattendu au regard de l'état de santé est un événement indésirable grave associé à des soins, à déclarer sans délai à l'ARS selon la procédure de l'établissement.

**Recours et appel** : en dehors des cycles de contrôle, le JLD peut être saisi à tout moment par le patient, ses proches, son avocat… Dans le détail de la mesure, bouton *Recours ou appel…* : saisine du JLD (à l'initiative de…), décision du JLD sur ce recours, appel devant le premier président de la cour d'appel, décision du premier président. Une mainlevée sur recours ou en appel a les mêmes effets qu'une mainlevée du cycle (remise à zéro du cumul après la fin, règle des 48 h). Les recours figurent dans le décompte JLD avec les envois.

**Qualité, conservation et archivage** (*Administration → Registre et statistiques*) : activer le motif du recours (et sa liste), l'entretien après la mesure (et son nom), les traces de surveillance des mesures hors CSI (onglet Surveillance CSI et registre pour les catégories B, D, E), la durée de conservation (l'outil signale les patients dont la dernière mesure la dépasse ; il ne supprime rien) et télécharger l'archive d'une année (registres et statistiques en CSV, tracé au journal).

**Rapport annuel** (onglet *Statistiques*, bouton *Rapport annuel (trame)…*) : trame du rapport prévu par l'article L. 3222-5-1 (III), soumis pour avis à la commission des usagers et au conseil de surveillance. Les chiffres N / N-1 sont repris de l'outil (mesures, patients, durées, CSI, mineurs, soins libres, mainlevées, délais JLD, catégories, motifs du recours, entretiens) ; la politique de l'établissement, son évaluation, les actions prévues et les avis se rédigent dans la fenêtre (enregistrés par l'administrateur), puis *Imprimer / PDF*.

**Droit d'accès d'un patient** (onglet *Patients* → *Mesures* → *Exporter ses données (droit d'accès)*, cadre ou administrateur) : fichier CSV réunissant la fiche, les modes d'hospitalisation, les mesures (lieux, pauses, JLD, recours, tiers, motifs, entretien) et les entrées du registre ; les noms des professionnels n'y figurent pas. L'export est tracé au journal.

**À propos** (bouton *À propos* en haut de l'écran, pour tous les agents ; aussi *Administration → À propos*) : version, licence EUPL 1.2, crédits, lien vers la page du projet sur GitHub et boutons *Signaler un problème* / *Demander une amélioration* (formulaires publics : jamais de donnée réelle ; accès à Internet nécessaire, souvent depuis un autre poste que ceux du réseau de l'hôpital).

**Comptes temporaires** (*Administration → Comptes et sécurité*) : pour un intérimaire, un vacataire ou un stagiaire, indiquez le dernier jour d'accès à la création du compte (ou en lot, pour toute la liste), ou plus tard avec *Modifier*. La date figure sur la fiche de remise. La connexion est refusée après ce jour ; un badge signale les comptes qui expirent dans les 7 jours et ceux qui ont expiré, et un bouton *Désactiver les comptes expirés* retire leur mot de passe du coffre. Pour prolonger un accès, modifiez la date.

**Cas particuliers** (*Administration → Cas particuliers*) :
- *Nouvelle mesure après une mainlevée du JLD* : l'article L. 3222-5-1 interdit toute nouvelle mesure pendant 48 h après une mainlevée, sauf éléments nouveaux (décrits par le psychiatre dans son certificat), et impose d'en informer le juge sans délai. À la saisie, une alerte rouge rappelle la date de la mainlevée et la fin du délai ; l'échéance « Info avant » de la nouvelle mesure est ramenée à son début (réglable) et un point de vigilance reste au tableau de bord tant que l'information n'est pas saisie. L'alerte concerne toute nouvelle mesure (par défaut) ou seulement celles du même type.
- *Mesure débutée avant l'arrivée dans le service* (urgences, autre établissement) : dans la nouvelle mesure, cochez « La mesure a débuté avant l'arrivée dans le service », puis indiquez la date et l'heure de la décision initiale et le lieu d'origine ; le champ de début devient l'heure d'arrivée. Les délais JLD et les cumuls partent de la décision initiale ; le registre et les statistiques du service, de l'arrivée. Le décompte JLD présente la partie antérieure sur une ligne distincte (« avant l'arrivée dans le service »). Saisissez ensuite les étapes JLD déjà faites avec le bouton *JLD*, à leur date.
- *Passage en soins somatiques ou aux urgences* : le registre n'est pas demandé dans les services de soins somatiques, la règle est donc choisie par l'établissement : la mesure continue et reste comptée au registre du service avec le lieu indiqué (isolement en B, contention en D) — réglage par défaut ; la mesure continue et cette période est comptée dans un registre dédié (un service créé à cet effet, par exemple « Hébergement somatique » ou « Urgences ») ; la mesure est suspendue jusqu'au retour (période comptée ni dans les délais JLD, reportés d'autant, ni au registre ; ligne « SUSPENDUE » dans le décompte) ; ou la mesure prend fin au départ. Dans le détail de la mesure, bouton *Soins somatiques ou urgences…* (les mesures en cours du patient sont traitées ensemble), puis bouton *Retour* sur la ligne de la mesure. Le choix en vigueur au départ est enregistré avec la saisie.
- *Transfert vers un autre service* : bouton *Transfert vers un autre service…* dans le détail de la mesure. La mesure reste unique pour le JLD (mêmes délais, même cycle, même tiers) et elle est répartie au registre : le premier service clôt son entrée à l'heure du transfert, le service d'accueil ouvre la sienne. La fiche du patient est rattachée au service d'accueil. Le détail de la mesure montre les lieux successifs.
- *Fiches en double* : à la création d'un patient, une alerte signale les fiches proches (même IPP, même nom et prénom, ou même date de naissance et même nom ou prénom). L'onglet *Patients* liste les fiches peut-être en double ; le cadre de santé les fusionne (bouton *Fusionner*) après avoir vu l'effet sur les cumuls et les échéances JLD, les informations qui diffèrent et les mesures qui se chevauchent. Motif obligatoire ; la fusion est tracée au journal et s'annule depuis le journal.

**Alertes de l'établissement** (*Administration → Alertes*) : chaque alerte se déclenche pour une situation (patient en soins libres au début de la mesure, patient mineur, protection juridique, contention ou isolement hors CSI, toute contention, toute nouvelle mesure), dans tous les services ou seulement ceux cochés. Elle est soit un **rappel** affiché dans le formulaire de la nouvelle mesure, soit une **personne à informer** dans un délai (sans délai, 15 min… 24 h, compté depuis le début de la mesure). Dans ce cas, à l'enregistrement de la mesure, l'outil demande qui a été informé, comment et quand ; la saisie est tracée au journal et visible dans le détail de la mesure. Tant qu'elle n'est pas faite, l'information reste dans les points de vigilance du tableau de bord (en rouge, bouton *Tracer l'information*) et un bouton *Informer* apparaît sur la ligne de la mesure. Deux alertes sont proposées : *Patient en soins libres* (informer le cadre de santé ou l'administrateur de garde sans délai ; désactivée par défaut, à activer et adapter) et *Contention hors CSI : exceptions prévues* (rappel du texte de loi et de la seule exception prévue par la HAS ; active). Le message proposé peut être remplacé par celui de l'établissement. Une alerte ne concerne que les mesures saisies après son activation, jamais l'historique importé.

**Masques du décompte JLD** (*Administration → Décompte JLD*) : choisissez *Masque de l'établissement* ou un service, puis réglez l'en-tête, le destinataire, le bandeau confidentiel, les données d'identité, les colonnes (cochées et ordonnées avec ↑ ↓) le format des durées et du cumul (en heures, en jours et heures, ou les deux : « 68 h 05, soit 2 j 20 h 05 ») et la durée maximale d'une ligne pour l'isolement (24 h par défaut) et la contention (12 h), 0 pour présenter chaque mesure sur une seule ligne, la mise en évidence (mesure actuelle en surbrillance, mesures antérieures grisées, ou les deux), les sections (dont la date d'édition et l'auteur, séparément), le pied de page, le bloc signature et le **papier à en-tête** : image A4 du papier de l'établissement (celui des courriers, exporté en PNG ou JPEG), sur toutes les pages ou la première seulement, avec les marges du texte en millimètres. Pour imprimer, gardez le format A4 et les marges « par défaut ». L'aperçu se met à jour sur un patient fictif. Un service sans masque propre utilise celui de l'établissement ; *Revenir au masque de l'établissement* supprime le masque propre.

Réglage des **pauses** (*Administration → Règles et pauses*) :
- **Activer la levée temporaire** : si l'établissement ne déduit pas les pauses, il peut désactiver la fonction ; le bouton *Pause* disparaît de la page des mesures (les pauses déjà saisies restent dans l'historique, une pause en cours peut être reprise).
- **Déduire la durée des pauses du cumul**, puis choisir **où** : pour les délais JLD seulement (échéances, cumuls, décompte ; le registre et les statistiques gardent la durée réelle), ou **partout** (registre et statistiques en durées hors pauses). Dans ce dernier cas, choisir comment le registre traite une pause de la contention seule (le patient reste à l'isolement) : en isolement seul (entrée A supplémentaire, durée de l'isolement exacte) ou laissée dans l'entrée de contention C, sans déduction.
- **Interdire la pause de l'isolement seul pendant une contention** (désactivé par défaut) : la contention doit alors être mise en pause elle aussi, ou terminée dans la même saisie.
- **Colonne « Levées temporaires » dans le registre** (nombre et durée), en option ; une note sous le registre indique toujours quelle durée est affichée.
- Reprise automatique à l'heure prévue, seuils d'alerte et de refus.

Déduire les pauses reporte les échéances JLD de toutes les mesures concernées, y compris passées : décision à prendre avec la direction.

Comptes (rôles, services affectés, accès au mode formation), régénération du jeu de formation, clés de sécurité, code de secours, paramétrage, reprise de l'historique à partir du registre : voir le guide d'installation et les procédures de secours.

## En cas de problème

- *Dossier inaccessible* ou application indisponible : appliquez la procédure dégradée papier, puis ressaisissez avec les heures réelles.
- *Mot de passe oublié* : demandez une réinitialisation à l'administrateur ; il vous remettra un mot de passe provisoire, à remplacer dès la connexion.
- *Erreur de saisie* : prévenez votre cadre, qui corrige avec un motif tracé.
