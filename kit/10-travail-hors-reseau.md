# Travail hors réseau sur des postes désignés

*Suivi des mesures d'isolement et de contention. Permettre à quelques postes désignés de continuer à tracer les mesures pendant une panne du réseau, puis de tout reprendre au retour. Pour le service informatique, l'administrateur fonctionnel et le délégué à la protection des données (DPO, référent RGPD).*

## 1. Principe

Pendant une panne du réseau, un poste perd à la fois l'outil (s'il est servi par l'intranet) et les données (sur le partage). Un poste désigné garde donc **les deux sur son disque** :

| Élément | Outil servi en HTTPS (intranet HTTPS ou page GitHub) | Outil ouvert sans HTTPS (depuis le partage ou un intranet en HTTP) |
| --- | --- | --- |
| **L'outil** | Mis en cache par le navigateur : *Administration → Sauvegardes et exports → Garder l'outil disponible hors réseau sur ce poste*. Chaque fichier est contrôlé par son empreinte SHA-256 avant d'être gardé ; mises à jour automatiques. | Copié sur le disque du poste par le service informatique : script `outils/copie-locale-outil.ps1` (ci-dessous). Le poste utilise **toujours** cette copie locale (raccourci du bureau), en temps normal comme en panne. |
| **Les données** | Copie locale des données : *Administration → Sauvegardes et exports → Créer une copie locale des données sur ce poste*. | Idem, en ouvrant l'outil depuis sa copie locale. |

La **copie locale des données** est un dossier de secours placé sur le disque du poste : chiffrée comme le dossier principal, tenue à jour par le poste à la connexion puis toutes les 10 minutes. Le dossier principal garde la liste des copies (nom du poste, date de la dernière copie), visible dans *Administration → Sauvegardes et exports*.

## 2. Conditions à réunir avant la mise en place

- **Accord du délégué à la protection des données et du responsable de la sécurité informatique (RSSI)** : des données de santé, chiffrées, sont copiées sur le disque des postes désignés. À ajouter à l'analyse d'impact (document 05).
- **Liste nominative des postes désignés** (ex. un poste infirmier par unité), tenue à jour ; disque **chiffré par BitLocker** ; session Windows verrouillée en l'absence de l'agent.
- **Dossier local réservé** aux agents habilités (droits NTFS), par exemple `C:\SuiviIsoCont-local`, exclu des sauvegardes du poste et de toute synchronisation vers un service extérieur (OneDrive personnel…).
- À la réforme ou au changement d'affectation d'un poste : *Retirer la copie locale* dans l'outil, suppression du dossier local, puis *Retirer de la liste* dans *Administration → Sauvegardes et exports*.

## 3. Mise en place

### 3.1 Outil servi en HTTPS

1. Sur le poste désigné, l'administrateur se connecte et ouvre *Administration → Sauvegardes et exports → Travail hors réseau sur ce poste*.
2. *Garder l'outil disponible hors réseau sur ce poste* : l'outil est mis en cache (une minute environ).
3. *Créer une copie locale des données sur ce poste…* : saisir le nom du poste (ex. `PC-UHP-IDE-1`), puis *Choisir le dossier…* et désigner le dossier local **vide** ; autoriser l'accès quand le navigateur le demande.
4. Intranet seulement : la page doit autoriser son script de mise en cache. Ajouter `worker-src 'self'` à l'en-tête de sécurité de l'intranet, et servir le fichier `sw.js` avec un en-tête propre qui l'autorise à relire les fichiers du site, par exemple sous IIS :

```
<location path="isocont/sw.js">
  <system.webServer><httpProtocol><customHeaders>
    <remove name="Content-Security-Policy" />
    <add name="Content-Security-Policy" value="default-src 'none'; script-src 'self'; connect-src 'self'" />
    <add name="Cache-Control" value="no-cache" />
  </customHeaders></httpProtocol></system.webServer>
</location>
```

   Cet en-tête ne vaut que pour ce script, qui ne lit que les fichiers du site lui-même ; la page garde `connect-src 'none'`. Avec la page GitHub, rien à faire.

### 3.2 Outil ouvert sans HTTPS

1. Le service informatique publie le dossier `app` de la version validée dans un dossier en lecture seule pour les agents (ex. `\\serveur\partage\SuiviIsoCont-outil\app`), avec son fichier `EMPREINTES-SHA256.txt`.
2. Sur chaque poste désigné, le script `outils/copie-locale-outil.ps1` est lancé à l'ouverture de session (stratégie de groupe ou tâche planifiée) avec les chemins `-Source` et `-Local` (par défaut `C:\SuiviIsoCont\app`). Il copie l'outil dans un dossier temporaire, **contrôle chaque fichier par son empreinte**, puis remplace la version locale ; au moindre écart, ou si la source est inaccessible, la version locale reste en place. Il crée le raccourci « Suivi isolement contention » sur le bureau, avec l'icône de l'outil. Journal : `%ProgramData%\SuiviIsoCont\copie-locale-outil.log`.
3. Le poste utilise ce raccourci en temps normal : le choix du dossier des données et la copie locale des données sont retenus par cette copie de l'outil (le navigateur sépare les réglages d'une page ouverte depuis le disque et ceux d'une page de l'intranet). Créer la copie locale des données comme en 3.1, étape 3, depuis cette copie de l'outil.
4. Les clés de sécurité (YubiKey) ne fonctionnent pas dans une page ouverte depuis le disque : connexion par mot de passe.
5. Le contrôle des empreintes protège contre une copie abîmée ou incomplète ; il ne protège pas contre une modification volontaire de la source (empreintes comprises) : le dossier source doit rester en lecture seule pour tous, sauf le service informatique.

### 3.3 Copie des données indépendante du navigateur (recommandée)

La copie faite par l'outil n'a lieu que lorsqu'un agent a l'outil ouvert sur le poste (à la connexion, puis toutes les 10 minutes). Après une nuit ou un week-end sans connexion, elle peut être en retard.

**Méthode simple (assistant de l'outil).** Sur le poste désigné : *Administration → Sauvegardes et exports → Tenir la copie locale à jour par robocopy…*. Indiquer le même dossier local que pour la copie de l'outil (ex. `C:\SuiviIsoCont-local`). Choisir qui fait la copie :
- **les agents connectés à la machine** : aucun mot de passe ; la copie se fait à chaque ouverture de session Windows, puis à intervalle régulier, même si l'outil n'est pas ouvert ;
- **un compte de service** : la copie se fait même quand personne n'est connecté.

Ouvrir ensuite PowerShell en administrateur sur le poste (clic droit sur Démarrer → *Terminal (administrateur)*). Coller les commandes préparées par l'outil (*Copier les commandes*), puis appuyer sur Entrée. Le message vert « Installation terminée » confirme la mise en place.

**Méthode détaillée.** Pour une copie tenue à jour dès que le poste est allumé, sans assistant, le service informatique ajoute sur le poste désigné la tâche planifiée du document 09, en mode « local » :

```
schtasks /Create /TN "SuiviIsoCont - copie locale" /SC MINUTE /MO 15 /RU DOMAINE\svc-isocont-secours /RP * /RL LIMITED /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\SuiviIsoCont\miroir-robocopy.ps1 -Type local -Principal \\serveur-donnees\partage\SuiviIsoCont -Secours C:\SuiviIsoCont-local"
```

- La tâche s'exécute même si personne n'est connecté (compte de service avec lecture et écriture sur le dossier principal et sur le dossier local).
- Elle reprend l'identifiant de la copie créée par l'outil : l'outil et la tâche tiennent à jour la même ligne du tableau des dossiers de secours (*Administration → Sauvegardes et exports*).
- Mêmes garanties que pour le dossier de secours du serveur : contrôles avant copie, aucune suppression, aucun fichier plus récent écrasé, exports exclus. Le retour des saisies faites hors réseau se fait toujours par l'outil (paragraphe 5).
- Garder aussi la copie locale créée dans l'outil (3.1, étape 3) : c'est elle qui propose *Travailler hors réseau* à l'écran d'accueil et qui reprend les saisies au retour.

### 3.4 Avertissement sur le poste

Sur un poste désigné, un bandeau orange apparaît en haut de l'outil, pour tous les agents et sur tous les onglets, quand la copie locale n'a pas été mise à jour depuis plus d'une heure, quand sa mise à jour échoue, ou quand le navigateur a perdu l'accès au dossier local (après un redémarrage, selon les réglages d'Edge ou de Chrome). Le bouton *Mettre à jour maintenant* (ou *Autoriser l'accès et mettre à jour*) règle la situation en un clic. Pour que l'accès soit gardé, répondre « Autoriser à chaque visite » quand le navigateur le propose.

## 4. Pendant une panne du réseau

1. Sur le poste désigné, ouvrir l'outil comme d'habitude (il s'ouvre depuis le cache ou la copie locale). « Reprendre » le dossier habituel échoue : cliquer sur **Travailler hors réseau (copie locale de ce poste)**.
2. Se connecter (mêmes comptes, mêmes mots de passe). Un bandeau rouge « Hors réseau » est affiché. Tracer les mesures normalement, aux heures réelles.
3. Les saisies faites ailleurs dans les 10 minutes qui ont précédé la panne peuvent manquer sur ce poste ; les autres postes, sans copie locale, appliquent la procédure dégradée sur papier (document 04).

## 5. Au retour du réseau

1. Sur le poste désigné : *Verrouiller*, *Changer de dossier*, puis **Reprendre** le dossier habituel.
2. Dès la connexion, le poste synchronise sa copie locale : les saisies faites hors réseau sont reprises dans le dossier principal, sans rien écraser. Si plusieurs postes ont travaillé hors réseau, toutes leurs saisies sont réunies ; deux saisies concurrentes sur une même mesure sont signalées dans le *Journal* (saisies en conflit), comme d'habitude.
3. Ressaisir dans l'outil ce qui a été tracé sur papier par les autres postes.
4. L'administrateur vérifie dans *Administration → Sauvegardes et exports* la date de la dernière copie de chaque poste.

## 6. Vérifications

- **Chaque mois** : journal de la tâche planifiée de chaque poste désigné (`%ProgramData%\SuiviIsoCont\miroir-robocopy.log`) ; liste des copies locales et date de leur dernière mise à jour (*Administration → Sauvegardes et exports*) ; postes désignés toujours en service.
- **Chaque année**, avec le test des procédures de secours : sur un poste désigné, débrancher le réseau, ouvrir l'outil, *Travailler hors réseau*, se connecter, vérifier les dernières saisies, puis rebrancher et *Reprendre*. Ne rien saisir pendant le test, ou utiliser le mode formation.
