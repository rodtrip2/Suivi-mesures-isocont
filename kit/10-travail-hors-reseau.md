# Travail hors réseau sur des postes désignés

*Suivi des mesures d'isolement et de contention. Permettre à quelques postes désignés de continuer à tracer les mesures pendant une panne du réseau, puis de tout reprendre au retour. Pour le service informatique, l'administrateur fonctionnel et le délégué à la protection des données (DPO, référent RGPD).*

## 1. Principe

Pendant une panne du réseau, un poste perd à la fois l'outil (s'il est servi par l'intranet) et les données (sur le partage). Un poste désigné garde donc **les deux sur son disque** :

| Élément | Outil servi en HTTPS (intranet HTTPS ou page GitHub) | Outil ouvert sans HTTPS (depuis le partage ou un intranet en HTTP) |
| --- | --- | --- |
| **L'outil** | Mis en cache par le navigateur : *Administration → Informations → Garder l'outil disponible hors réseau sur ce poste*. Chaque fichier est contrôlé par son empreinte SHA-256 avant d'être gardé ; mises à jour automatiques. | Copié sur le disque du poste par le service informatique : script `outils/copie-locale-outil.ps1` (ci-dessous). Le poste utilise **toujours** cette copie locale (raccourci du bureau), en temps normal comme en panne. |
| **Les données** | Copie locale des données : *Administration → Informations → Créer une copie locale des données sur ce poste*. | Idem, en ouvrant l'outil depuis sa copie locale. |

La **copie locale des données** est un dossier de secours placé sur le disque du poste : chiffrée comme le dossier principal, tenue à jour par le poste à la connexion puis toutes les 10 minutes. Le dossier principal garde la liste des copies (nom du poste, date de la dernière copie), visible dans *Administration → Informations*.

## 2. Conditions à réunir avant la mise en place

- **Accord du délégué à la protection des données et du responsable de la sécurité informatique (RSSI)** : des données de santé, chiffrées, sont copiées sur le disque des postes désignés. À ajouter à l'analyse d'impact (document 05).
- **Liste nominative des postes désignés** (ex. un poste infirmier par unité), tenue à jour ; disque **chiffré par BitLocker** ; session Windows verrouillée en l'absence de l'agent.
- **Dossier local réservé** aux agents habilités (droits NTFS), par exemple `C:\SuiviIsoCont-local`, exclu des sauvegardes du poste et de toute synchronisation vers un service extérieur (OneDrive personnel…).
- À la réforme ou au changement d'affectation d'un poste : *Retirer la copie locale* dans l'outil, suppression du dossier local, puis *Retirer de la liste* dans *Administration → Informations*.

## 3. Mise en place

### 3.1 Outil servi en HTTPS

1. Sur le poste désigné, l'administrateur se connecte et ouvre *Administration → Informations → Travail hors réseau sur ce poste*.
2. *Garder l'outil disponible hors réseau sur ce poste* : l'outil est mis en cache (une minute environ).
3. *Créer une copie locale des données sur ce poste…* : saisir le nom du poste (ex. `PC-UHP-IDE-1`), puis choisir le dossier local **vide** ; autoriser l'accès quand le navigateur le demande.
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

## 4. Pendant une panne du réseau

1. Sur le poste désigné, ouvrir l'outil comme d'habitude (il s'ouvre depuis le cache ou la copie locale). « Reprendre » le dossier habituel échoue : cliquer sur **Travailler hors réseau (copie locale de ce poste)**.
2. Se connecter (mêmes comptes, mêmes mots de passe). Un bandeau rouge « Hors réseau » est affiché. Tracer les mesures normalement, aux heures réelles.
3. Les saisies faites ailleurs dans les 10 minutes qui ont précédé la panne peuvent manquer sur ce poste ; les autres postes, sans copie locale, appliquent la procédure dégradée sur papier (document 04).

## 5. Au retour du réseau

1. Sur le poste désigné : *Verrouiller*, *Changer de dossier*, puis **Reprendre** le dossier habituel.
2. Dès la connexion, le poste synchronise sa copie locale : les saisies faites hors réseau sont reprises dans le dossier principal, sans rien écraser. Si plusieurs postes ont travaillé hors réseau, toutes leurs saisies sont réunies ; deux saisies concurrentes sur une même mesure sont signalées dans le *Journal* (saisies en conflit), comme d'habitude.
3. Ressaisir dans l'outil ce qui a été tracé sur papier par les autres postes.
4. L'administrateur vérifie dans *Administration → Informations* la date de la dernière copie de chaque poste.

## 6. Vérifications

- **Chaque mois** : liste des copies locales et date de leur dernière mise à jour (*Administration → Informations*) ; postes désignés toujours en service.
- **Chaque année**, avec le test des procédures de secours : sur un poste désigné, débrancher le réseau, ouvrir l'outil, *Travailler hors réseau*, se connecter, vérifier les dernières saisies, puis rebrancher et *Reprendre*. Ne rien saisir pendant le test, ou utiliser le mode formation.
