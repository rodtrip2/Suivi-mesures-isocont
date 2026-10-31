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

L'onglet *Administration* est organisé en **sous-onglets** : *Comptes et sécurité* (comptes, clés de sécurité, code de secours, mode formation), *Établissement et services* (services, chambres de soins intensifs, postes de surveillance), *Règles et pauses*, *Registre et statistiques* (compteurs, numérotation des mesures importées, colonnes de l'onglet Patients), *Décompte JLD* (masques), *Reprise des données* et *Informations*. Le dernier sous-onglet consulté est retenu.

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
