// SPDX-License-Identifier: EUPL-1.2
// Recopie le script kit/outils/miroir-robocopy.ps1 dans app/js/outils-robocopy.js, pour que l'assistant
// d'installation de l'outil (Administration → Sauvegardes et exports) l'intègre aux commandes qu'il prépare.
// Usage : node scripts/outils-js.mjs   (après toute modification du script ; un test vérifie la concordance)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const script = readFileSync(join(racine, 'kit', 'outils', 'miroir-robocopy.ps1'), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
if (/^'@/m.test(script)) throw new Error("Le script contient une ligne commençant par '@ : il ne peut pas être intégré dans une chaîne PowerShell.");
const sortie = join(racine, 'app', 'js', 'outils-robocopy.js');
writeFileSync(sortie, '// SPDX-License-Identifier: EUPL-1.2\n// Fichier produit par scripts/outils-js.mjs à partir de kit/outils/miroir-robocopy.ps1 : ne pas modifier à la main.\n' +
  '(self.SIC = self.SIC || {}).scriptRobocopy = ' + JSON.stringify(script) + ';\n');
console.log('kit/outils/miroir-robocopy.ps1 → app/js/outils-robocopy.js (' + script.length + ' caractères)');
