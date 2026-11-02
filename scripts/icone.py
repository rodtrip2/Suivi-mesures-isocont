# SPDX-License-Identifier: EUPL-1.2
"""Icône de l'application (raccourci Windows, onglet du navigateur) : app/img/icone.ico (16 à 256 px) et PNG.

Carré vert de l'outil, lettres « IC » (isolement, contention) et arc d'horloge (suivi des durées).
Usage : python3 scripts/icone.py   (Pillow requis)
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / 'app' / 'img'
VERT, VERT_CLAIR, BLANC, ACCENT = (31, 95, 91), (46, 125, 118), (255, 255, 255), (178, 223, 216)
POLICE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def dessiner(n, petit=False):
    """Icône de n pixels, dessinée à 8x puis réduite (bords nets)."""
    f = 8; t = n * f
    im = Image.new('RGBA', (t, t), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    marge = 0 if petit else round(t * 0.04)
    r = round(t * (0.18 if petit else 0.22))
    # Fond : carré arrondi, léger dégradé vertical
    fond = Image.new('RGBA', (t, t))
    for y in range(t):
        k = y / t
        c = tuple(round(VERT_CLAIR[i] * (1 - k) + VERT[i] * k) for i in range(3)) + (255,)
        ImageDraw.Draw(fond).line([(0, y), (t, y)], fill=c)
    masque = Image.new('L', (t, t), 0)
    ImageDraw.Draw(masque).rounded_rectangle([marge, marge, t - marge - 1, t - marge - 1], radius=r, fill=255)
    im.paste(fond, (0, 0), masque)
    d = ImageDraw.Draw(im)
    if not petit:
        # Arc d'horloge (3/4 de tour) et repère de départ, en clair
        e = round(t * 0.075); b = [round(t * 0.14), round(t * 0.14), round(t * 0.86), round(t * 0.86)]
        d.arc(b, start=-90, end=180, fill=ACCENT + (255,), width=e)
        cx, cy = t / 2, b[1] + e / 2
        d.ellipse([cx - e * 0.85, cy - e * 0.85, cx + e * 0.85, cy + e * 0.85], fill=BLANC + (255,))
    # Lettres « IC »
    taille = round(t * (0.62 if petit else 0.40))
    police = ImageFont.truetype(POLICE, taille)
    x0, y0, x1, y1 = d.textbbox((0, 0), 'IC', font=police)
    d.text(((t - (x1 - x0)) / 2 - x0, (t - (y1 - y0)) / 2 - y0), 'IC', font=police, fill=BLANC + (255,))
    return im.resize((n, n), Image.LANCZOS)


def main():
    SORTIE.mkdir(exist_ok=True)
    tailles = [16, 24, 32, 48, 64, 128, 256]
    images = {n: dessiner(n, petit=n <= 32) for n in tailles}
    images[256].save(SORTIE / 'icone.ico', sizes=[(n, n) for n in tailles], append_images=[images[n] for n in tailles[:-1]])
    images[256].save(SORTIE / 'icone-256.png')
    images[32].save(SORTIE / 'icone-32.png')
    dessiner(512).save(SORTIE / 'icone-512.png')
    print('ok', SORTIE)


if __name__ == '__main__':
    main()
