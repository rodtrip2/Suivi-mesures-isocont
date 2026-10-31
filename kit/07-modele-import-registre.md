# Reprise de l'historique à partir du registre

*Pour tout établissement, quel que soit son outil actuel de suivi des mesures.*

Le registre prévu par l'article L. 3222-5-1 du code de la santé publique est le seul document que tout établissement tient obligatoirement sous forme numérique. Suivi-mesures-isocont peut donc reprendre l'historique d'un service à partir de son registre : exportez-le de votre outil (tableur, logiciel métier, DPI) au format CSV ou Excel, puis importez-le dans *Administration → Reprise des données existantes → Importer un registre…*.

Le fichier est lu dans le navigateur : rien n'est envoyé sur Internet. L'import est enregistré en un seul lot, annulable depuis le journal.

## Modèle de fichier

Un modèle prêt à remplir est téléchargeable dans l'application (*Télécharger le modèle de registre (CSV)*). Il n'est pas obligatoire : l'écran d'import propose la correspondance de vos propres colonnes, quels que soient leurs intitulés et leur ordre. La ligne des en-têtes peut ne pas être la première (titre au-dessus du tableau).

Une ligne = une **entrée** du registre.

| Donnée | Obligatoire | Contenu attendu |
| --- | --- | --- |
| Identifiant du patient | oui | IPP ou identifiant utilisé par le registre |
| Début | oui | date et heure (JJ/MM/AAAA HH:MM, AAAA-MM-JJ HH:MM, ou date et heure dans deux colonnes) |
| Type de mesure ou Catégorie | l'un des deux | Isolement / Contention, ou catégorie A à E (le type s'en déduit) ; un numéro qui commence par la catégorie (A12) suffit |
| Numéro d'entrée | non | A12, ou 12 avec la catégorie dans sa colonne ; permet de conserver la numérotation |
| Fin | non | date et heure ; vide = mesure en cours |
| Durée (heures) | non | utilisée si la fin manque |
| Service | non | code du service ; sinon, service choisi à l'import (services inconnus : à créer ou rattacher) |
| Lieu, En CSI, Exception | non | à défaut, déduits de la catégorie (A, C en CSI ; B, D hors CSI ; E exception prévue) |
| Mode d'hospitalisation | non | SDT, SDTU, SPI, SDRE, SL, SL mineur… |
| Psychiatre | non | psychiatre ayant décidé la mesure |
| Professionnels chargés de la surveillance | non | séparés par « ; », fonction entre parenthèses : Agent A (IDE) ; Agent B (AS) |
| Nom, prénom, date de naissance, âge | non | la date de naissance est à compléter ensuite si elle manque (l'âge sert seulement au contrôle) |

Catégories : A isolement en chambre de soins intensifs · B isolement hors CSI · C contention en CSI (elle couvre l'isolement qui l'accompagne) · D contention hors espace d'isolement · E idem, exception prévue.

## Comment les mesures sont reconstituées

Le registre compte des entrées ; l'outil (comme le juge) compte des mesures :

- une entrée A ou B donne un isolement ; une entrée C donne une contention en CSI **et** l'isolement qui l'accompagne ; une entrée D ou E donne une contention hors espace d'isolement ;
- les portions d'isolement contiguës d'un même patient (A, puis l'isolement d'une entrée C, puis A) forment **une seule mesure d'isolement** ;
- chaque mesure garde ses lignes d'origine (numéro, catégorie, période, soignants).

Exemple : A1 (8 h–12 h), C2 (12 h–18 h), A3 (18 h–22 h) pour un même patient donnent un isolement de 8 h à 22 h et une contention de 12 h à 18 h. Le registre de l'outil redonne A, C, A ; le juge compte un isolement et une contention.

## Numérotation et contrôle avant import

Comme pour le classeur V1.3, l'écran d'import :

- propose pour chaque service et chaque année un compteur (dernier numéro du registre), modifiable ;
- propose de **laisser tel quel** (les lignes du registre sont reproduites à l'identique, l'outil numérote les mesures suivantes en sautant ces numéros), de **recalculer l'année en cours** ou de **recalculer toutes les années** (avertissement : les statistiques des années passées peuvent changer) ;
- contrôle la numérotation et affiche, avant de confirmer, l'impact de chaque choix (entrées et durées par catégorie, heures de CSI, patients) et le détail des mesures modifiées, avec le pourquoi de chaque catégorie ;
- permet, mesure par mesure, de garder le numéro d'origine ou d'appliquer la règle de l'outil, et de corriger le lieu ou la case « exception ».

## Ce que le registre ne contient pas

Les cycles JLD (information, saisine, décisions), l'information des tiers et la surveillance poste par poste ne figurent pas au registre : ils ne sont pas repris. Pour les mesures en cours au moment de la reprise, saisissez-les dans l'onglet JLD. Les soignants cités par le registre restent affichés dans le registre de l'outil.

Complétez ensuite dans l'onglet Patients les fiches des nouveaux patients (nom, date de naissance), et affectez les services créés aux comptes concernés.
