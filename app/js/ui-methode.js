// SPDX-License-Identifier: EUPL-1.2
/*
 * Méthode des statistiques : séquences (entrées regroupées selon une tolérance réglable), unités de compte,
 * règles de calcul en vigueur et changements datés relus au journal, comparaison avant / après un changement,
 * méthode utilisée avant l'outil. Règles : model.js (optionsStats, sequences, reglesCalcul, changementsMethode).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  function n(v) { return v == null ? 'n.d.' : nf.format(v); }
  function hrs(v) { return v == null ? 'n.d.' : nf.format(Math.round(v * 10) / 10) + ' h'; }
  function libTol(min) { return !min ? 'continu (entrées qui se touchent)' : min < 60 ? min + ' min' : (min / 60) + ' h'; }

  /** Lignes des indicateurs de séquences : [libellé, N-1, N, format]. */
  function lignesSequences(a, b) {
    return [
      ['Séquences terminées', a.sequences.n, b.sequences.n, n],
      ['Patients distincts', a.sequences.patients, b.sequences.patients, n],
      ['Entrées du registre par séquence (moyenne)', a.sequences.entreesParSequence, b.sequences.entreesParSequence, n],
      ['Durée moyenne d’une séquence', a.sequences.duree.moyenne, b.sequences.duree.moyenne, hrs],
      ['Durée médiane', a.sequences.duree.mediane, b.sequences.duree.mediane, hrs],
      ['Durée maximale', a.sequences.duree.max, b.sequences.duree.max, hrs],
      ['Durée cumulée', a.sequences.duree.total, b.sequences.duree.total, hrs]
    ];
  }

  function texteUnites(config) {
    var o = M.optionsStats(config);
    return 'Trois unités de compte : les entrées du registre (catégories A à E ; une contention en CSI forme une entrée C, l’isolement avant et après forme des entrées A), ' +
      'les mesures au sens du juge (isolement et contention comptés séparément) et les séquences (entrées d’un même patient qui se suivent avec un écart de ' + libTol(o.toleranceMinutes) + ' au plus, ' +
      'qui correspondent à un épisode continu). Unité principale retenue par l’établissement : ' + M.UNITES_STATS[o.unitePrincipale].toLowerCase() + '.';
  }

  function sectionSequences(a, b) {
    var comp = {};
    Object.keys(a.sequences.composition).concat(Object.keys(b.sequences.composition)).forEach(function (k) { comp[k] = 1; });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Séquences' }),
      h('p', { class: 'muted', text: 'Une séquence regroupe les entrées du registre d’un même patient qui se suivent (écart de ' + libTol(M.optionsStats(U.config()).toleranceMinutes) + ' au plus), tous services confondus. Sa durée est la somme de ses entrées. Le nombre d’entrées par séquence montre l’effet du découpage du registre.' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Indicateur' }), h('th', { class: 'num', text: String(a.annee) }), h('th', { class: 'num', text: String(b.annee) }))),
        h('tbody', {}, lignesSequences(a, b).map(function (l) { return h('tr', {}, h('td', { text: l[0] }), h('td', { class: 'num', text: l[3](l[1]) }), h('td', { class: 'num', text: l[3](l[2]) })); }),
          Object.keys(comp).map(function (k) { return h('tr', {}, h('td', { text: 'dont ' + k.toLowerCase() }), h('td', { class: 'num', text: String(a.sequences.composition[k] || 0) }), h('td', { class: 'num', text: String(b.sequences.composition[k] || 0) })); })))));
  }

  /**
   * Encadré « Méthode de calcul » : règles en vigueur, changements de l'année et de la précédente (avec
   * comparaison chiffrée si l'option est active), méthode utilisée avant l'outil. Chaque mention s'affiche
   * selon le choix de l'établissement.
   */
  function sectionMethode(svs, annee, b, pourRapport) {
    var etat = U.st(), cfg = U.config(), o = M.optionsStats(cfg), maintenant = Date.now();
    var changements = M.changementsMethode(etat, new Date(annee - 1, 0, 1).getTime(), Infinity);
    var blocs = [];
    blocs.push(h('p', { text: texteUnites(cfg) }));
    if (o.mentions.regles) blocs.push(h('div', {}, h('b', { text: 'Règles de calcul en vigueur' }), h('ul', {}, M.reglesCalcul(cfg).map(function (r) { return h('li', { text: r }); }))));
    if (o.mentions.changements && changements.length) {
      blocs.push(h('div', {}, h('b', { text: 'Changements de règles depuis le 1er janvier ' + (annee - 1) }),
        h('ul', {}, changements.map(function (c) { return h('li', { text: U.date(c.date) + ' — ' + c.textes.join(' ; ') + (pourRapport ? '' : ' (' + U.App.session.nomAuteur(c.by) + ')') }); })),
        h('p', { class: 'muted', text: 'Les deux années sont recalculées avec les règles actuelles (sauf la règle des soins somatiques, enregistrée à chaque départ) : elles restent comparables entre elles, mais pas forcément avec des chiffres publiés avant ces changements.' })));
    }
    if (o.mentions.comparaison && changements.length) {
      var dernier = changements[changements.length - 1], surcharge = {};
      surcharge[dernier.cle] = dernier.avant;
      var x = M.statistiquesAvec(etat, surcharge, svs, annee, maintenant);
      var lignes = [['Entrées du registre', b.mesures, x.mesures, n], ['Séquences', b.sequences.n, x.sequences.n, n], ['Durée moyenne d’une entrée', b.duree.moyenne, x.duree.moyenne, hrs],
        ['Durée cumulée', b.duree.total, x.duree.total, hrs], ['Heures de CSI', b.heuresCSI, x.heuresCSI, hrs], ['Durée moyenne d’une séquence', b.sequences.duree.moyenne, x.sequences.duree.moyenne, hrs]];
      blocs.push(h('div', {}, h('b', { text: 'Comparaison ' + annee + ' : règles actuelles et règle d’avant le ' + U.date(dernier.date).slice(0, 10) + ' (' + dernier.textes.join(' ; ') + ')' }),
        h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
          h('thead', {}, h('tr', {}, h('th', { text: 'Indicateur' }), h('th', { class: 'num', text: 'Règles actuelles' }), h('th', { class: 'num', text: 'Règle antérieure' }))),
          h('tbody', {}, lignes.map(function (l) { return h('tr', {}, h('td', { text: l[0] }), h('td', { class: 'num', text: l[3](l[1]) }), h('td', { class: 'num', text: l[3](l[2]) })); })))),
        lignes.every(function (l) { return l[3](l[1]) === l[3](l[2]); }) ? h('p', { class: 'muted', text: 'Aucun écart sur ces indicateurs pour ' + annee + ' (les mesures concernées par ce changement ne sont peut-être pas encore terminées).' }) : null));
    }
    if (o.mentions.methodeAnterieure) {
      var ma = [annee - 1, annee].filter(function (an) { return String(o.methodesAnterieures[an] || '').trim(); });
      if (ma.length) blocs.push(h('div', {}, h('b', { text: 'Méthode de comptage avant l’outil' }), ma.map(function (an) { return h('p', { class: 'texte-rapport', text: an + ' : ' + o.methodesAnterieures[an] }); })));
    }
    return h('section', { class: 'panneau methode-stats' }, h(pourRapport ? 'h2' : 'h2', { text: 'Méthode de calcul' }), blocs);
  }

  /** Lignes CSV de la méthode (règles, changements, méthode antérieure) selon les mentions choisies. */
  function lignesCSV(annee) {
    var cfg = U.config(), o = M.optionsStats(cfg), res = [[], ['Méthode de calcul'], [texteUnites(cfg)]];
    if (o.mentions.regles) M.reglesCalcul(cfg).forEach(function (r) { res.push(['Règle en vigueur', r]); });
    if (o.mentions.changements) M.changementsMethode(U.st(), new Date(annee - 1, 0, 1).getTime(), Infinity).forEach(function (c) { res.push(['Changement le ' + U.date(c.date), c.textes.join(' ; ')]); });
    if (o.mentions.methodeAnterieure) [annee - 1, annee].forEach(function (an) { if (String(o.methodesAnterieures[an] || '').trim()) res.push(['Méthode avant l’outil ' + an, o.methodesAnterieures[an]]); });
    return res;
  }

  // ------------------------------------------------------------ Administration
  function panneauAdmin() {
    var o = M.optionsStats(U.config());
    var tol = h('select', {}, M.TOLERANCES_SEQUENCE.map(function (t) { return h('option', { value: t, text: libTol(t), selected: t === o.toleranceMinutes }); }));
    var nomU = 'unite-' + Math.random().toString(36).slice(2, 7);
    var radios = Object.keys(M.UNITES_STATS).map(function (k) { return { k: k, r: h('input', { type: 'radio', name: nomU, checked: o.unitePrincipale === k }) }; });
    var cbs = {};
    var LIB_M = { regles: 'Règles de calcul en vigueur', changements: 'Changements de règles datés (année et année précédente)', comparaison: 'Comparaison chiffrée avec la règle antérieure au dernier changement', methodeAnterieure: 'Méthode de comptage utilisée avant l’outil' };
    Object.keys(LIB_M).forEach(function (k) { cbs[k] = h('input', { type: 'checkbox', checked: !!o.mentions[k] }); });
    var cbCol = h('input', { type: 'checkbox', checked: o.colonneSequences });
    var methodes = Object.assign({}, o.methodesAnterieures);
    var anCour = new Date().getFullYear();
    [anCour - 1, anCour].forEach(function (an) { if (!(an in methodes)) methodes[an] = ''; });
    var zoneM = h('div', { class: 'pile' });
    function dessinerM() {
      U.vider(zoneM);
      Object.keys(methodes).sort().forEach(function (an) {
        var t = h('textarea', { rows: 2, placeholder: 'Ex. : une mesure = un épisode continu, contention incluse ; durées en heures réelles…', oninput: function () { methodes[an] = t.value; } }, methodes[an] || '');
        zoneM.appendChild(h('label', {}, 'Année ' + an, t));
      });
    }
    dessinerM();
    var nouvelAn = h('input', { type: 'number', min: 2000, max: 2100, value: anCour - 2, class: 'champ-court' });
    return h('section', { class: 'panneau' }, h('h2', { text: 'Méthode des statistiques' }),
      h('p', { class: 'muted', text: 'Le registre découpe finement les mesures (une contention pendant un isolement donne plusieurs entrées), ce qui peut augmenter le nombre de mesures par rapport aux pratiques antérieures de l’établissement. Les séquences regroupent ces entrées en épisodes continus ; les mentions expliquent les règles de calcul et leurs changements.' }),
      h('label', {}, 'Regrouper en une séquence les entrées d’un même patient séparées de', tol),
      h('div', {}, h('div', { class: 'etiquette', text: 'Unité principale du rapport annuel' }), h('div', { class: 'pile serre' }, radios.map(function (x) { return h('label', { class: 'case' }, x.r, h('span', { text: M.UNITES_STATS[x.k] })); }))),
      h('div', {}, h('div', { class: 'etiquette', text: 'Mentions affichées sous les statistiques, dans le rapport annuel et l’export' }), h('div', { class: 'pile serre' }, Object.keys(LIB_M).map(function (k) { return h('label', { class: 'case' }, cbs[k], h('span', { text: LIB_M[k] })); }))),
      h('label', { class: 'case' }, cbCol, h('span', { text: 'Colonne « Séquences » dans l’onglet Patients' })),
      h('div', {}, h('div', { class: 'etiquette', text: 'Méthode de comptage utilisée avant l’outil (par année, facultatif)' }), zoneM,
        h('div', { class: 'actions gauche' }, h('label', { class: 'en-ligne' }, 'Autre année', nouvelAn), h('button', { class: 'btn petit', type: 'button', onclick: function () { if (!(nouvelAn.value in methodes)) { methodes[nouvelAn.value] = ''; dessinerM(); } } }, 'Ajouter'))),
      U.boutonEnregistrer(async function () {
        var m = {}, mentions = {};
        Object.keys(methodes).forEach(function (an) { if (String(methodes[an] || '').trim()) m[an] = String(methodes[an]).trim(); });
        Object.keys(cbs).forEach(function (k) { mentions[k] = cbs[k].checked; });
        await U.enregistrerConfig([['statsMethode', { toleranceMinutes: +tol.value, unitePrincipale: radios.filter(function (x) { return x.r.checked; })[0].k, colonneSequences: cbCol.checked, mentions: mentions, methodesAnterieures: m }]]);
      }));
  }

  function resumeConfig(v) {
    var o = M.optionsStats({ statsMethode: v });
    return 'séquences : ' + libTol(o.toleranceMinutes) + ', unité principale : ' + M.UNITES_STATS[o.unitePrincipale].toLowerCase() + ', mentions : ' +
      (Object.keys(o.mentions).filter(function (k) { return o.mentions[k]; }).join(', ') || 'aucune') + (Object.keys(o.methodesAnterieures).length ? ', méthode antérieure renseignée pour ' + Object.keys(o.methodesAnterieures).join(', ') : '');
  }

  U.methode = { lignesSequences: lignesSequences, sectionSequences: sectionSequences, sectionMethode: sectionMethode, lignesCSV: lignesCSV, panneauAdmin: panneauAdmin, resumeConfig: resumeConfig, texteUnites: texteUnites, libTol: libTol };
})();
