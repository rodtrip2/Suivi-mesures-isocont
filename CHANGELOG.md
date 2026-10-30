# Journal des versions

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
