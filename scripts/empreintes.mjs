// SPDX-License-Identifier: EUPL-1.2
// Calcule l'empreinte SHA-256 de chaque fichier de app/ et écrit app/EMPREINTES-SHA256.txt.
// Usage : node scripts/empreintes.mjs   (à lancer avant chaque version publiée)
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const app = join(racine, 'app');
const sortie = join(app, 'EMPREINTES-SHA256.txt');
const version = /VERSION = '([^']+)'/.exec(readFileSync(join(app, 'js', 'version.js'), 'utf8'))[1];

function lister(dir) {
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? lister(p) : [p];
  });
}

const lignes = lister(app).filter((p) => p !== sortie).map((p) => {
  const h = createHash('sha256').update(readFileSync(p)).digest('hex').toUpperCase();
  return h + '  app/' + relative(app, p).split(sep).join('/');
});
writeFileSync(sortie, '# Suivi-mesures-isocont ' + version + ' — empreintes SHA-256 (format Get-FileHash, majuscules)\n' + lignes.join('\n') + '\n');
console.log(lignes.length + ' fichiers → ' + relative(racine, sortie));
