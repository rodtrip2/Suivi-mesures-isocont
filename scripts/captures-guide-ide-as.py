# SPDX-License-Identifier: EUPL-1.2
"""Captures d'écran du guide pratique IDE / AS (kit/08), en mode démonstration, données fictives.

Prérequis : python3 -m pip install playwright pillow ; serveur local lancé à la racine du dépôt :
    python3 -m http.server 8765
Usage     : python3 scripts/captures-guide-ide-as.py   (images écrites dans kit/images/guide-ide-as/)
Puis      : python3 scripts/kit-pdf.py
"""
import time, sys, re, os, pathlib, subprocess
from playwright.sync_api import sync_playwright
RACINE = pathlib.Path(__file__).resolve().parent.parent
OUT = str(RACINE / 'kit' / 'images' / 'guide-ide-as'); os.makedirs(OUT, exist_ok=True); errs = []
def local(a, h):  # date locale décalée de h heures, format datetime-local
    return a.evaluate("(h) => { const d = new Date(Date.now() + h * 3600e3); d.setSeconds(0, 0); const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }", h)
def champ(d, texte, sel='select, input, textarea'):
    return d.locator('label').filter(has_text=re.compile('^' + re.escape(texte) + r'(?![ a-zéèàù’(])')).locator(sel).first
def shot(loc, nom):
    (loc.page if hasattr(loc, 'page') else loc).evaluate("document.querySelectorAll('.toast').forEach(t => t.remove()); if (document.activeElement && document.activeElement.blur) document.activeElement.blur()")
    loc.screenshot(path=OUT + '/' + nom + '.png'); print('capture', nom)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--lang=fr'], env=dict(os.environ, LANG='fr_FR.UTF-8', LANGUAGE='fr', LC_ALL='fr_FR.UTF-8'))
    ctx = b.new_context(viewport={'width': 1366, 'height': 1180}, locale='fr-FR', timezone_id='Europe/Paris', color_scheme='light', device_scale_factor=1.5, accept_downloads=True)
    a = ctx.new_page(); a.on('pageerror', lambda e: errs.append(str(e))); a.on('dialog', lambda d: d.accept())
    a.goto('http://localhost:8765/app/')
    a.get_by_role('button', name='Mode démonstration (données fictives)').click()
    a.get_by_label('Nom affiché').fill('Cadre Démo'); a.get_by_label('Identifiant').fill('cadre')
    a.get_by_label('Mot de passe (12 caractères minimum)').fill('motdepasse-demo'); a.get_by_label('Confirmation').fill('motdepasse-demo')
    a.get_by_label('Charger des données fictives de démonstration').check()
    a.get_by_role('button', name='Initialiser le dossier').click()
    a.wait_for_selector('.code-secours', timeout=60000)
    a.get_by_label('J’ai noté').check(); a.get_by_role('button', name='Continuer').click()
    a.wait_for_selector('.indicateurs'); time.sleep(2)
    # Compte IDE fictif (mot de passe déjà personnel, pour éviter l'étape de changement)
    a.evaluate("""async () => { const s = SIC.ui.App.session;
      await s.creerCompte({ nom: 'Alex IDE (fictif)', login: 'alex.ide', motDePasse: 'motdepasse-ide-demo', roles: ['IDE'], services: ['U1'] });
      await s.modifierCoffre(async (coffre, comptes) => { comptes.find(c => c.login === 'alex.ide').mdpProvisoire = false; }); }""")
    a.get_by_role('button', name='Verrouiller').click(); time.sleep(1)
    a.get_by_label('Identifiant').fill('alex.ide'); a.get_by_label('Mot de passe', exact=True).fill('motdepasse-ide-demo')
    shot(a.locator('main, #app').first, '01-connexion')
    a.get_by_role('button', name='Se connecter').click(); time.sleep(3)
    if a.locator('button', has_text='Données réelles').count(): a.locator('button', has_text='Données réelles').first.click(); time.sleep(2)
    a.wait_for_selector('.indicateurs'); time.sleep(1)
    shot(a, '02-tableau-de-bord')
    print('OK connexion')
    # ---------------- Nouvelle mesure
    a.locator('nav.onglets button', has_text='Mesures').click(); time.sleep(1)
    a.get_by_role('button', name='+ Nouvelle mesure').click(); time.sleep(0.8)
    d = a.locator('dialog')
    champ(d, 'Patient').select_option(label='+ Nouveau patient'); time.sleep(0.3)
    champ(d, 'IPP').fill('900210'); champ(d, 'Nom').fill('HOTEL (fictif)'); champ(d, 'Prénom').fill('Lou')
    champ(d, 'Date de naissance (obligatoire)').fill('1988-05-12')
    champ(d, "Mode d'hospitalisation").select_option(index=0)
    champ(d, 'Type de mesure').select_option('Isolement')
    d.locator('input[type=datetime-local]').first.fill(local(a, -5))
    psy = d.locator('label', has_text='Psychiatre décisionnaire').locator('select'); psy.select_option(index=1)
    champ(d, 'Lieu').select_option(index=0); time.sleep(0.5)
    shot(d, '03-nouvelle-mesure')
    d.get_by_role('button', name='Enregistrer').click(); time.sleep(2)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    shot(a, '04-liste-mesures')
    ligne = a.locator('tr', has_text='HOTEL (fictif)').first
    # ---------------- Pause et reprise
    ligne.get_by_role('button', name='Pause').click(); time.sleep(0.8)
    d = a.locator('dialog')
    d.locator('input[type=datetime-local]').first.fill(local(a, -2))
    champ(d, 'Motif').select_option(index=1)
    psy = d.locator('label', has_text='Psychiatre décisionnaire').locator('select')
    if psy.count(): psy.select_option(index=1)
    time.sleep(0.4); shot(d, '05-pause')
    d.get_by_role('button', name='Enregistrer la pause').click(); time.sleep(2)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    shot(a.locator('tr', has_text='HOTEL (fictif)').first, '06-ligne-en-pause')
    a.locator('tr', has_text='HOTEL (fictif)').first.get_by_role('button', name='Reprise').click(); time.sleep(0.8)
    d = a.locator('dialog'); d.locator('input[type=datetime-local]').first.fill(local(a, -1)); time.sleep(0.3)
    shot(d, '07-reprise')
    d.get_by_role('button', name='Enregistrer la reprise').click(); time.sleep(2)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    # ---------------- Tiers
    a.locator('tr', has_text='HOTEL (fictif)').first.get_by_role('button', name='Tiers').click(); time.sleep(0.8)
    d = a.locator('dialog'); print('tiers labels:', d.locator('label').all_inner_texts()[:12])
    champ(d, 'Résultat').select_option(index=0)
    q = champ(d, 'Tiers (qualité)')
    try: q.select_option(index=1)
    except Exception: q.fill('Conjoint (fictif)')
    champ(d, 'Psychiatre ayant informé').select_option(index=1); time.sleep(0.3)
    shot(d, '08-tiers')
    d.get_by_role('button', name='Enregistrer').click(); time.sleep(2)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    # ---------------- Décompte
    a.locator('tr', has_text='HOTEL (fictif)').first.get_by_role('button', name='Décompte').click(); time.sleep(1.5)
    d = a.locator('dialog'); shot(d, '09-decompte')
    with a.expect_download() as dl: d.get_by_role('button', name='Enregistrer en PDF').click()
    dl.value.save_as(OUT + '/decompte.pdf'); print('pdf', dl.value.suggested_filename)
    d.get_by_role('button', name='Fermer').last.click(); time.sleep(0.5)
    # ---------------- JLD
    a.locator('nav.onglets button', has_text='JLD').click(); time.sleep(1)
    shot(a, '10-onglet-jld')
    a.locator('tr', has_text='HOTEL (fictif)').first.get_by_role('button', name='Saisir un envoi ou une décision').click(); time.sleep(0.8)
    d = a.locator('dialog'); print('jld labels:', d.locator('label').all_inner_texts()[:12])
    champ(d, 'Nature').select_option(index=0)
    d.locator('input[type=datetime-local]').first.fill(local(a, 0)); time.sleep(0.3)
    shot(d, '11-envoi-jld')
    d.get_by_role('button', name='Enregistrer').click(); time.sleep(2)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    shot(a.locator('tr', has_text='HOTEL (fictif)').first, '12-envoi-trace')
    # ---------------- Surveillance
    a.locator('nav.onglets button', has_text='Surveillance').click(); time.sleep(1)
    shot(a, '13-surveillance')
    a.locator('main button', has_text='Ajouter').first.click(); time.sleep(0.8)
    d = a.locator('dialog'); print('surv labels:', d.locator('label').all_inner_texts()[:8])
    champ(d, 'Nom').fill('Alex IDE (fictif)')
    if champ(d, 'Fonction').count():
        f = champ(d, 'Fonction')
        try: f.select_option(label='IDE')
        except Exception: f.fill('IDE')
    time.sleep(0.3); shot(d, '14-professionnel')
    d.get_by_role('button', name='Enregistrer', exact=True).click(); time.sleep(1.5)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    # ---------------- Fin
    a.locator('nav.onglets button', has_text='Mesures').click(); time.sleep(1)
    a.locator('tr', has_text='HOTEL (fictif)').first.get_by_role('button', name='Fin').click(); time.sleep(0.8)
    d = a.locator('dialog'); print('fin labels:', d.locator('label').all_inner_texts()[:8])
    d.locator('input[type=datetime-local]').first.fill(local(a, 0))
    psy = d.locator('label', has_text='Psychiatre décisionnaire').locator('select')
    if psy.count(): psy.select_option(index=1)
    if champ(d, 'Motif de fin').count(): champ(d, 'Motif de fin').select_option(index=0)
    time.sleep(0.3); shot(d, '15-fin')
    d.get_by_role('button', name='Enregistrer la fin').click(); time.sleep(2)
    print('erreurs:', a.locator('dialog .erreur').all_inner_texts())
    shot(a.locator('tr', has_text='HOTEL (fictif)').first, '16-ligne-terminee')
    # ---------------- Détail : proposer une correction
    a.locator('tr', has_text='HOTEL (fictif)').first.get_by_role('button', name='Détail').click(); time.sleep(0.8)
    shot(a.locator('dialog'), '17-detail')
    b.close()
print('ERRORS:', errs)

# Post-traitement : page du PDF du décompte, recadrages, compression
from PIL import Image, ImageChops
subprocess.run(['pdftoppm', '-r', '110', '-png', '-f', '1', '-l', '1', '-singlefile', OUT + '/decompte.pdf', OUT + '/18-decompte-pdf'], check=True)
os.remove(OUT + '/decompte.pdf')
for f in sorted(pathlib.Path(OUT).glob('*.png')):
    im = Image.open(f).convert('RGB')
    if f.stem == '01-connexion':   # carte de connexion seule
        diff = ImageChops.difference(im, Image.new('RGB', im.size, im.getpixel((5, im.height - 5)))).convert('L').point(lambda v: 255 if v > 12 else 0)
        b = diff.crop((0, 80, im.width, im.height)).getbbox(); im = im.crop((max(0, b[0] - 30), b[1] + 50, min(im.width, b[2] + 30), b[3] + 110))
    elif f.stem in ('02-tableau-de-bord', '04-liste-mesures', '10-onglet-jld', '13-surveillance'):   # vide sous le contenu
        diff = ImageChops.difference(im, Image.new('RGB', im.size, im.getpixel((im.width // 2, im.height - 3)))).convert('L').point(lambda v: 255 if v > 12 else 0)
        im = im.crop((0, 0, im.width, min(im.height, diff.getbbox()[3] + 24)))
    if im.width > 1600: im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
print('images :', OUT)
