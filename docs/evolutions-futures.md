# Évolutions futures

Évolutions étudiées avec le porteur du projet et gardées pour plus tard. Chacune reste à valider avant développement.

## Connexion avec la session Windows (étudiée le 2 novembre 2026)

**Besoin** : permettre aux établissements qui le souhaitent de se connecter avec l'identifiant Windows de l'agent, l'administrateur gérant les identifiants autorisés et leurs accès.

**Principe retenu à l'étude**

- Possible uniquement avec un hébergement sur le serveur web interne (IIS), mode déjà conseillé pour la production ; impossible avec GitHub Pages ou une ouverture depuis le partage réseau (une page web ne connaît pas seule l'utilisateur Windows).
- **Identité** : authentification Windows activée dans IIS (transparente dans Edge et Chrome) ; une page `.stm` fournie avec l'outil renvoie l'identifiant (`<!--#echo var="AUTH_USER" -->`, fonction « Server Side Includes » d'IIS, sans code serveur ; à vérifier en recette selon la version d'IIS). Référence : [IIS, directive #echo](https://learn.microsoft.com/en-us/previous-versions/iis/6.0-sdk/ms525581(v=vs.90)).
- **Ouverture des données** : les données restent chiffrées. Une clé générée par l'administrateur est déposée sur le serveur IIS dans un dossier réservé, par autorisation d'URL d'IIS, à un groupe Windows défini par le service informatique (ex. « GG_SuiviIsoCont ») ; le coffre contient une enveloppe de la clé de données ouverte par cette clé. Une copie du partage seule reste illisible.
- **Identifiants autorisés** : chaque identifiant Windows (`DOMAINE\login`) est associé à un compte de l'outil (rôles, services, date de fin), saisi un par un ou collé en lot ; un identifiant absent de la liste est refusé.
- **Connexion** : bouton « Se connecter avec ma session Windows (DOMAINE\login) » à l'écran d'accueil ; saisies tracées au nom de l'agent.
- **Deux contrôles à tenir ensemble** : le groupe Windows (service informatique) donne l'accès technique aux données, la liste de l'outil (administrateur) donne les rôles et services. Le groupe ne doit contenir que les agents autorisés.
- **Départ d'un agent** : renouvellement de la clé déposée sur le serveur en un clic (à redéposer), comme le code de secours.
- **Sécurité de la page** : la politique de sécurité devra autoriser les requêtes vers le serveur de l'outil lui-même (`connect-src 'self'` au lieu de `'none'`), à signaler au responsable de la sécurité informatique.
- **Tests** : authentification Windows simulée pour les tests automatiques ; procédure de recette à ajouter à la fiche technique.

**Questions à trancher avant développement**

1. Garder les autres moyens de connexion à côté de Windows (mot de passe, clé de sécurité, code de secours) ? Recommandé : oui (intérimaires sans compte Windows, panne de l'annuaire, secours).
2. Connexion automatique à l'ouverture ou par un bouton ? Recommandé : bouton (poste partagé, session Windows pas toujours celle de l'agent présent).
3. Liste des identifiants saisie par l'administrateur, ou demande d'accès par un membre du groupe, validée ensuite par l'administrateur ?

## Stockage sur un partage autre que SMB (demande du porteur, 2 novembre 2026)

Demande : pouvoir enregistrer les données (ou le dossier de secours) ailleurs que sur un partage réseau Windows (SMB), par exemple un espace documentaire de l'établissement, un serveur WebDAV ou un stockage objet. À développer plus tard.

- **Contrainte actuelle** : l'outil n'écrit que dans un dossier ouvert par le navigateur (API *File System Access*), donc un dossier visible dans l'Explorateur : partage SMB, lecteur réseau, ou dossier synchronisé (client OneDrive / SharePoint, qui synchronise ensuite vers le serveur). Ce dernier cas fonctionne déjà, sous réserve de validation du service informatique (délais de synchronisation, conflits).
- **Partage accessible seulement par le web** (WebDAV, API d'une gestion électronique de documents) : il faudrait que la page envoie des requêtes à ce serveur, donc ouvrir la politique de sécurité (`connect-src` vers ce seul serveur, au lieu de `'none'`), gérer l'authentification (session Windows, jeton) et adapter `store.js` derrière une interface commune (lister, lire, écrire sans écraser). Les données resteraient chiffrées sur le poste avant l'envoi.
- **À trancher avant développement** : type de partage visé par les établissements intéressés ; accord du responsable de la sécurité informatique sur l'ouverture de `connect-src` ; usage comme stockage principal ou seulement comme dossier de secours.
