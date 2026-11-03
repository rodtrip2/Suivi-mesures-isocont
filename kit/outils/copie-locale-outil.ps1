# SPDX-License-Identifier: EUPL-1.2
#
# Suivi-mesures-isocont : copie de l'outil (dossier « app ») sur le disque d'un poste désigné, pour l'utiliser
# même pendant une panne du réseau, quand l'outil n'est pas servi en HTTPS (sinon, préférer la mise en cache par
# le navigateur, Administration → Sauvegardes et exports). Mode d'emploi : kit/10-travail-hors-reseau.md.
#
# À lancer à l'ouverture de session (stratégie de groupe ou tâche planifiée « À l'ouverture de session »), sous le
# compte de l'agent ou un compte de service ayant lecture sur la source et écriture dans le dossier local.
#   1. copie de la source vers un dossier temporaire ;
#   2. contrôle de CHAQUE fichier par son empreinte SHA-256 (EMPREINTES-SHA256.txt publié avec l'outil) :
#      au moindre écart, la copie est abandonnée et la version déjà présente sur le poste reste en place ;
#   3. remplacement de la version locale (l'ancienne est gardée dans « app.ancien ») ;
#   4. raccourci « Suivi isolement contention » sur le bureau public, avec l'icône de l'outil.
# Si la source est inaccessible (panne), rien n'est modifié : le poste garde sa dernière copie.
# Codes de sortie : 0 = à jour ; 1 = source inaccessible (copie locale inchangée) ; 2 = contrôle refusé ou erreur.

param(
  # Dossier « app » publié par le service informatique (partage ou dossier du serveur intranet)
  [string]$Source = '\\serveur-donnees\partage\SuiviIsoCont-outil\app',
  # Dossier local du poste
  [string]$Local = 'C:\SuiviIsoCont\app',
  # Raccourci sur le bureau public (vide = pas de raccourci)
  [string]$Raccourci = (Join-Path $env:PUBLIC 'Desktop\Suivi isolement contention.lnk'),
  [string]$Journal = (Join-Path $env:ProgramData 'SuiviIsoCont\copie-locale-outil.log'),
  [string]$Robocopy = 'robocopy.exe'
)

$ErrorActionPreference = 'Stop'
function Ecrire-Journal([string]$texte) {
  $d = Split-Path -Parent $Journal
  if ($d -and -not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
  $ligne = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $texte
  Add-Content -LiteralPath $Journal -Value $ligne -Encoding UTF8
  Write-Output $ligne
}

if (-not (Test-Path -LiteralPath (Join-Path $Source 'index.html'))) { Ecrire-Journal ('Source inaccessible (' + $Source + ') : la copie locale reste celle du poste.'); exit 1 }
$empreintes = Join-Path $Source 'EMPREINTES-SHA256.txt'
if (-not (Test-Path -LiteralPath $empreintes)) { Ecrire-Journal 'ARRÊT : EMPREINTES-SHA256.txt absent de la source.'; exit 2 }

# Déjà à jour ? (même fichier d'empreintes)
$fichierLocal = Join-Path $Local 'EMPREINTES-SHA256.txt'
if ((Test-Path -LiteralPath $fichierLocal) -and ((Get-FileHash -LiteralPath $fichierLocal).Hash -eq (Get-FileHash -LiteralPath $empreintes).Hash)) {
  Ecrire-Journal 'Copie locale déjà à jour.'
} else {
  $temp = $Local + '.nouveau'
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
  & $Robocopy $Source $temp '/E' '/R:2' '/W:5' '/NP' '/NDL' '/NFL' '/NJH' '/NJS' | Out-Null
  if ($LASTEXITCODE -ge 8) { Ecrire-Journal ('ÉCHEC de la copie (code robocopy ' + $LASTEXITCODE + ').'); exit 2 }
  # Contrôle de chaque fichier publié
  $lignes = Get-Content -LiteralPath (Join-Path $temp 'EMPREINTES-SHA256.txt') -Encoding UTF8 | Where-Object { $_ -match '^[0-9A-F]{64}\s+app/' }
  if ($lignes.Count -lt 10) { Ecrire-Journal 'ARRÊT : liste d''empreintes incomplète.'; Remove-Item -LiteralPath $temp -Recurse -Force; exit 2 }
  foreach ($l in $lignes) {
    $attendu = $l.Substring(0, 64)
    $rel = ($l.Substring(64).Trim() -replace '^app/', '') -replace '/', [System.IO.Path]::DirectorySeparatorChar
    $f = Join-Path $temp $rel
    if (-not (Test-Path -LiteralPath $f) -or (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash -ne $attendu) {
      Ecrire-Journal ('ARRÊT : empreinte différente ou fichier absent : ' + $rel + ' — la version locale actuelle est conservée.')
      Remove-Item -LiteralPath $temp -Recurse -Force; exit 2
    }
  }
  # Remplacement
  $ancien = $Local + '.ancien'
  if (Test-Path -LiteralPath $ancien) { Remove-Item -LiteralPath $ancien -Recurse -Force }
  if (Test-Path -LiteralPath $Local) { Rename-Item -LiteralPath $Local -NewName (Split-Path -Leaf $ancien) }
  Rename-Item -LiteralPath $temp -NewName (Split-Path -Leaf $Local)
  $version = (Get-Content -LiteralPath (Join-Path $Local 'EMPREINTES-SHA256.txt') -TotalCount 1 -Encoding UTF8)
  Ecrire-Journal ('Copie locale mise à jour et contrôlée (' + $lignes.Count + ' fichiers) : ' + $version)
}

# Raccourci (Windows seulement)
if ($Raccourci -and $env:OS -eq 'Windows_NT') {
  $index = Join-Path $Local 'index.html'
  $edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
  $sh = New-Object -ComObject WScript.Shell
  $lnk = $sh.CreateShortcut($Raccourci)
  if (Test-Path -LiteralPath $edge) { $lnk.TargetPath = $edge; $lnk.Arguments = '--app="file:///' + ($index -replace '\\', '/') + '"' }
  else { $lnk.TargetPath = $index }
  $lnk.IconLocation = (Join-Path $Local 'img\icone.ico') + ',0'
  $lnk.Description = 'Suivi des mesures d''isolement et de contention (copie locale)'
  $lnk.Save()
}
exit 0
