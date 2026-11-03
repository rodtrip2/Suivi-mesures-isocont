# SPDX-License-Identifier: EUPL-1.2
#
# Suivi-mesures-isocont : copie du dossier des données vers le dossier de secours, par robocopy.
# À lancer par une tâche planifiée Windows (toutes les 15 à 30 minutes), de préférence sur un serveur,
# sous un compte de service qui a accès en lecture et écriture aux deux dossiers.
# Mode d'emploi : kit/09-dossier-secours-robocopy.md (fiche du service informatique).
#
# Ce que fait le script :
#   - contrôles avant copie (dossier principal valide et non déplacé ; dossier de secours vide ou copie des
#     mêmes données ; rôles des deux dossiers non inversés) : en cas de doute, il s'arrête sans rien copier ;
#   - copie SANS JAMAIS SUPPRIMER (pas de /MIR ni de /PURGE) et sans écraser un fichier plus récent du côté
#     du secours (/XO) : un dossier principal vidé ou abîmé ne détruit pas le secours ;
#   - exclusions : exports (fichiers en clair, choix du porteur), instantanés (reconstruits automatiquement),
#     jeu de formation (fictif), fichiers temporaires du navigateur (*.crswap), fichiers d'état propres à
#     chaque dossier ;
#   - mise à jour de miroir-etat.json dans les deux dossiers (rôle, date, poste) : l'outil reconnaît ainsi le
#     dossier de secours et alerte l'administrateur après 24 h sans copie.
# Le retour après une panne (saisies faites sur le dossier de secours) se fait dans l'outil :
# Administration → Sauvegardes et exports → Synchroniser maintenant (jamais par ce script en sens inverse).
#
# Codes de sortie : 0 = copie faite ; 1 = arrêt sur un contrôle ; 2 = erreur de robocopy (voir le journal).

param(
  # Dossier des données de l'outil (chemin UNC conseillé)
  [string]$Principal = '\\serveur-donnees\partage\SuiviIsoCont',
  # Dossier de secours, sur un autre serveur de préférence
  [string]$Secours = '\\serveur-secours\partage\SuiviIsoCont-secours',
  # Sous-dossier des exports (réglage « Dossier des exports » de l'outil, « exports » par défaut)
  [string]$Exports = 'exports',
  # Journal du script (résumé) ; le détail de robocopy va dans le même dossier, fichier « -detail »
  [string]$Journal = (Join-Path $env:ProgramData 'SuiviIsoCont\miroir-robocopy.log'),
  # Nature de la copie : 'serveur' (dossier de secours du service) ou 'local' (copie locale d'un poste désigné
  # pour le travail hors réseau, document 10 ; $Secours est alors un dossier du disque du poste, ex. C:\SuiviIsoCont-local)
  [ValidateSet('serveur', 'local')][string]$Type = 'serveur',
  # Commande robocopy (modifiable pour les tests)
  [string]$Robocopy = 'robocopy.exe'
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false

function Ecrire-Journal([string]$texte) {
  $ligne = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $texte
  Add-Content -LiteralPath $Journal -Value $ligne -Encoding UTF8
  Write-Output $ligne
}
function Lire-Json([string]$chemin) {
  if (-not (Test-Path -LiteralPath $chemin)) { return $null }
  try { return ([System.IO.File]::ReadAllText($chemin, $utf8) | ConvertFrom-Json) } catch { return 'illisible' }
}
function Arreter([string]$motif) { Ecrire-Journal ('ARRÊT sans copie : ' + $motif); exit 1 }

# Journal : dossier créé si besoin, rotation au-delà de 5 Mo
$dossierJournal = Split-Path -Parent $Journal
if ($dossierJournal -and -not (Test-Path -LiteralPath $dossierJournal)) { New-Item -ItemType Directory -Path $dossierJournal -Force | Out-Null }
$Detail = [System.IO.Path]::ChangeExtension($Journal, $null).TrimEnd('.') + '-detail.log'
foreach ($f in @($Journal, $Detail)) {
  if ((Test-Path -LiteralPath $f) -and (Get-Item -LiteralPath $f).Length -gt 5MB) { Move-Item -LiteralPath $f -Destination ($f + '.ancien') -Force }
}

# ------------------------------------------------------------------ Contrôles avant copie
if (-not (Test-Path -LiteralPath $Principal)) { Arreter ('dossier principal inaccessible : ' + $Principal) }
if (-not (Test-Path -LiteralPath $Secours)) { Arreter ('dossier de secours inaccessible : ' + $Secours + ' (créez-le, vide, avant la première copie)') }
if ((Resolve-Path -LiteralPath $Principal).ProviderPath -eq (Resolve-Path -LiteralPath $Secours).ProviderPath) { Arreter 'les deux chemins désignent le même dossier' }
if (Test-Path -LiteralPath (Join-Path $Principal 'deplace.json')) { Arreter 'le dossier principal a été déplacé (deplace.json) : mettez à jour le chemin du script' }

$coffreP = Lire-Json (Join-Path $Principal 'coffre.json')
if ($null -eq $coffreP -or $coffreP -eq 'illisible' -or -not $coffreP.creeLe) { Arreter 'coffre du dossier principal absent ou illisible : rien n''est copié, pour ne pas abîmer le secours' }

$etatP = Lire-Json (Join-Path $Principal 'miroir-etat.json')
if ($etatP -and $etatP -ne 'illisible' -and $etatP.role -eq 'secours') { Arreter 'le dossier indiqué comme principal est un dossier de secours : chemins inversés ?' }

$coffreS = Lire-Json (Join-Path $Secours 'coffre.json')
if ($coffreS -eq 'illisible') { Arreter 'coffre du dossier de secours illisible : vérifiez ce dossier' }
if ($null -ne $coffreS) {
  if ($coffreS.creeLe -ne $coffreP.creeLe) { Arreter 'le dossier de secours contient d''autres données (autre service ou établissement)' }
} else {
  $contenu = @(Get-ChildItem -LiteralPath $Secours -Force | Where-Object { $_.Name -ne 'miroir-etat.json' })
  if ($contenu.Count -gt 0) { Arreter 'le dossier de secours n''est pas vide et ne contient pas ces données' }
}
$etatS = Lire-Json (Join-Path $Secours 'miroir-etat.json')
if ($etatS -and $etatS -ne 'illisible' -and $etatS.role -eq 'principal') { Arreter 'le dossier de secours est marqué comme dossier principal : chemins inversés ?' }

# ------------------------------------------------------------------ Copie
$exclusDossiers = @((Join-Path $Principal $Exports), (Join-Path $Principal 'instantanes'), (Join-Path $Principal 'formation'))
$exclusFichiers = @('*.crswap', 'miroir-etat.json', 'deplace.json', 'DONNEES-DEPLACEES-LISEZMOI.txt', 'FORMATION-LISEZMOI.txt')
$arguments = @($Principal, $Secours, '/E', '/XO', '/R:2', '/W:5', '/FFT', '/NP', '/NDL', '/NJH', ('/LOG+:' + $Detail), '/XD') + $exclusDossiers + @('/XF') + $exclusFichiers
Ecrire-Journal ('Copie de ' + $Principal + ' vers ' + $Secours)
& $Robocopy @arguments | Out-Null
$code = $LASTEXITCODE
# robocopy : 0 à 7 = réussite (avec ou sans fichiers copiés) ; 8 et plus = échec d'au moins un fichier
if ($code -ge 8) { Ecrire-Journal ('ÉCHEC de robocopy (code ' + $code + ') : voir ' + $Detail); exit 2 }

# Identifiant de cette copie : celui déjà inscrit dans le dossier de secours (par l'outil ou un passage précédent),
# sinon un identifiant propre à la machine ; l'outil et le script tiennent ainsi à jour la même entrée.
$id = $null
if ($etatS -and $etatS -ne 'illisible' -and $etatS.id) { $id = [string]$etatS.id }
if (-not $id) { $id = 'robocopy-' + $(if ($Type -eq 'local') { 'local-' } else { '' }) + $env:COMPUTERNAME }
$maintenant = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
# Dossier de secours : son propre état
$etatSecours = [ordered]@{ role = 'secours'; id = $id; type = $Type; autre = (Split-Path -Leaf $Principal); derniere = $maintenant; poste = $env:COMPUTERNAME; outil = 'robocopy'; code = $code }
[System.IO.File]::WriteAllText((Join-Path $Secours 'miroir-etat.json'), ($etatSecours | ConvertTo-Json), $utf8)
# Dossier principal : l'état des autres dossiers de secours (copies locales des postes, autres serveurs) est conservé
$miroirs = [ordered]@{}
$ancien = Lire-Json (Join-Path $Principal 'miroir-etat.json')
if ($ancien -and $ancien -ne 'illisible' -and $ancien.miroirs) {
  foreach ($p in $ancien.miroirs.PSObject.Properties) { $miroirs[$p.Name] = $p.Value }
}
$miroirs[$id] = [ordered]@{ nom = (Split-Path -Leaf $Secours); type = $Type; derniere = $maintenant; poste = $env:COMPUTERNAME; outil = 'robocopy' }
$etatPrincipal = [ordered]@{ role = 'principal'; autre = (Split-Path -Leaf $Secours); derniere = $maintenant; poste = $env:COMPUTERNAME; outil = 'robocopy'; code = $code; miroirs = $miroirs }
[System.IO.File]::WriteAllText((Join-Path $Principal 'miroir-etat.json'), ($etatPrincipal | ConvertTo-Json -Depth 5), $utf8)
Ecrire-Journal ('Copie terminée (code robocopy ' + $code + ')')
exit 0
