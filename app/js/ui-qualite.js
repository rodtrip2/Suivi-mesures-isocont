// SPDX-License-Identifier: EUPL-1.2
/*
 * Qualité et obligations annexes :
 *  - motif du recours et entretien après la mesure (facultatifs, nommés par l'établissement) ;
 *  - traces de surveillance pour les mesures hors CSI (option) ;
 *  - trame du rapport annuel (art. L. 3222-5-1, III) ;
 *  - export des données d'un patient (droit d'accès, art. 15 du RGPD) ;
 *  - durée de conservation et archive d'une année close.
 * Règles : model.js (optionsQualite, statistiquesAnnee, donneesPatient, auDelaConservation).
 */
(function () {
  'use strict';
  var SIC = self.SIC, U = SIC.ui, M = SIC.model, h = U.h;
  var MOTIFS_NON_REALISE = ['Refus du patient', 'État clinique ne le permettant pas', 'Sortie ou transfert du patient', 'Autre'];

  function telecharger(nom, lignes) {
    var csv = '﻿' + lignes.map(function (l) { return l.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: nom });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function jour(t) { return new Date(t).toLocaleDateString('fr-FR'); }

  // ------------------------------------------------------------ Saisie
  /** Liste déroulante du motif du recours (ou null si l'option est désactivée). */
  function champMotif(valeur) {
    var o = M.optionsQualite(U.config());
    if (!o.motifRecours) return null;
    var sel = h('select', {}, h('option', { value: '', text: '— Non renseigné —' }), o.motifsRecours.map(function (x) { return h('option', { value: x, text: x, selected: x === valeur }); }));
    var bloc = h('label', {}, 'Motif du recours (facultatif)', sel);
    bloc.valeur = function () { return sel.value; };
    return bloc;
  }

  function modaleEntretien(m) {
    var o = M.optionsQualite(U.config());
    var nom = 'ent-' + Math.random().toString(36).slice(2, 7);
    var rOui = h('input', { type: 'radio', name: nom, checked: !m.entretien || m.entretien.realise }), rNon = h('input', { type: 'radio', name: nom, checked: !!m.entretien && !m.entretien.realise });
    var quand = h('input', { type: 'datetime-local', value: U.versSaisie(m.entretien ? m.entretien.date : Date.now()) });
    var motif = h('select', {}, MOTIFS_NON_REALISE.map(function (x) { return h('option', { value: x, text: x, selected: m.entretien && m.entretien.motif === x }); }));
    var commentaire = h('input', { type: 'text', placeholder: 'Facultatif — le contenu de l’entretien reste dans le dossier du patient', value: m.entretien ? m.entretien.commentaire : '' });
    var blocMotif = h('label', {}, 'Motif', motif);
    function maj() { blocMotif.hidden = !rNon.checked; }
    rOui.addEventListener('change', maj); rNon.addEventListener('change', maj); maj();
    U.modale(o.nomEntretien, h('div', { class: 'pile' }, U.recapMesure(m),
      h('p', { class: 'muted', text: 'Traçabilité seulement (réalisé ou non, date) : le contenu de l’entretien est consigné dans le dossier du patient.' }),
      h('div', { class: 'pile serre' }, h('label', { class: 'case' }, rOui, h('span', { text: 'Réalisé' })), h('label', { class: 'case' }, rNon, h('span', { text: 'Non réalisé' }))),
      h('div', { class: 'grille-2' }, h('label', {}, 'Date et heure', quand), blocMotif),
      h('label', {}, 'Commentaire', commentaire)), [
      { texte: 'Annuler' },
      { texte: 'Enregistrer', classe: 'primaire', action: async function () {
        var t = U.depuisSaisie(quand.value);
        if (!isFinite(t) || t > Date.now() + 10 * 60000) throw new Error('Date invalide ou dans le futur.');
        await U.App.session.enregistrer('ENTRETIEN', { mesureId: m.id, realise: rOui.checked, date: t, motif: rNon.checked ? motif.value : '', commentaire: commentaire.value.trim() }, m.version);
        U.toast('Enregistré.');
      } }]);
  }

  /** Lignes du détail d'une mesure : motif du recours, entretien. */
  function detailMesure(m) {
    var o = M.optionsQualite(U.config()), lignes = [];
    if (m.motifRecours) lignes.push(h('div', { text: 'Motif du recours : ' + m.motifRecours }));
    if (m.entretien) lignes.push(h('div', { text: o.nomEntretien + ' : ' + (m.entretien.realise ? 'réalisé le ' + U.date(m.entretien.date) : 'non réalisé (' + m.entretien.motif + ')') + (m.entretien.commentaire ? ' — ' + m.entretien.commentaire : '') }));
    else if (o.entretien && typeof m.fin === 'number') lignes.push(h('div', { class: 'muted', text: o.nomEntretien + ' : non renseigné.' }));
    return lignes.length ? h('div', { class: 'recap' }, lignes) : null;
  }

  /** Mesures terminées depuis moins de 7 jours sans entretien renseigné (option active). */
  function entretiensARenseigner(maintenant) {
    var o = M.optionsQualite(U.config());
    if (!o.entretien) return [];
    return M.listeMesures(U.st()).filter(function (m) {
      return U.dansService(m) && typeof m.fin === 'number' && !m.entretien && maintenant - m.fin < 7 * 86400000 && !m.origine;
    }).sort(function (a, b) { return b.fin - a.fin; });
  }

  // ------------------------------------------------------------ Administration
  function panneauAdmin() {
    var o = M.optionsQualite(U.config());
    var cbMotif = h('input', { type: 'checkbox', checked: o.motifRecours });
    var motifs = h('textarea', { rows: 5 }, o.motifsRecours.join('\n'));
    var cbEnt = h('input', { type: 'checkbox', checked: o.entretien });
    var nomEnt = h('input', { type: 'text', value: o.nomEntretien, placeholder: 'Ex. : Débriefing post-isolement' });
    var cbSurv = h('input', { type: 'checkbox', checked: o.surveillanceHorsCSI });
    var duree = h('input', { type: 'number', min: 0, max: 100, value: o.conservationAns, class: 'champ-court' });
    var anArchive = h('input', { type: 'number', min: 2000, max: 2100, value: new Date().getFullYear() - 1, class: 'champ-court' });
    var depasses = M.auDelaConservation(U.st(), o.conservationAns, Date.now());
    return h('section', { class: 'panneau' }, h('h2', { text: 'Qualité, conservation et archivage' }),
      h('h3', { text: 'Motif du recours' }),
      h('label', { class: 'case' }, cbMotif, h('span', { text: 'Proposer le motif du recours dans la nouvelle mesure (facultatif pour l’agent ; repris dans les statistiques et le rapport annuel)' })),
      h('label', {}, 'Motifs proposés (un par ligne)', motifs),
      h('h3', { text: 'Entretien après la mesure' }),
      h('label', { class: 'case' }, cbEnt, h('span', { text: 'Tracer l’entretien après la mesure (réalisé ou non, date) — facultatif, recommandé par la HAS' })),
      h('label', {}, 'Nom utilisé dans l’établissement', nomEnt),
      h('h3', { text: 'Surveillance des mesures hors CSI' }),
      h('label', { class: 'case' }, cbSurv, h('span', { text: 'Tracer aussi les professionnels chargés de la surveillance des mesures hors CSI (onglet Surveillance CSI, registre pour les catégories B, D et E)' })),
      h('h3', { text: 'Durée de conservation et archive annuelle' }),
      h('p', { class: 'muted', text: 'La durée de conservation est fixée par l’établissement avec son DPO, en cohérence avec les règles du registre et du dossier médical. Le journal n’étant jamais modifié, l’outil ne supprime rien : il signale les patients dont la dernière mesure dépasse cette durée, à traiter selon la procédure validée par le DPO.' }),
      h('label', { class: 'en-ligne' }, 'Durée de conservation (années, 0 = non fixée)', duree),
      o.conservationAns ? h('div', { class: depasses.length ? 'alerte' : 'info', text: depasses.length ? depasses.length + ' patient(s) dont la dernière mesure s’est terminée il y a plus de ' + o.conservationAns + ' ans : ' + depasses.slice(0, 10).map(function (x) { return (x.patient.ipp ? 'IPP ' + x.patient.ipp : x.patient.nom) + ' (' + jour(x.derniereFin) + ')'; }).join(', ') + (depasses.length > 10 ? '…' : '') + '.' : 'Aucun patient au-delà de la durée de conservation.' }) : null,
      h('div', { class: 'actions gauche' }, h('label', { class: 'en-ligne' }, 'Archive de l’année', anArchive),
        h('button', { class: 'btn', type: 'button', onclick: function () { archiver(+anArchive.value); } }, 'Télécharger l’archive (CSV)')),
      h('small', { class: 'muted', text: 'L’archive réunit le registre de chaque service et les statistiques de l’année ; nominative (IPP), elle s’enregistre sur le réseau de l’établissement. Conservez aussi une copie du dossier de l’outil à la clôture de l’année.' }),
      U.boutonEnregistrer(async function () {
        var liste = motifs.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        if (cbMotif.checked && !liste.length) throw new Error('Indiquez au moins un motif du recours.');
        await U.enregistrerConfig([['qualite', { motifRecours: cbMotif.checked, motifsRecours: liste, entretien: cbEnt.checked, nomEntretien: nomEnt.value.trim(), surveillanceHorsCSI: cbSurv.checked, conservationAns: Math.max(0, Math.round(+duree.value || 0)) }]]);
      }));
  }

  function archiver(annee) {
    var etat = U.st(), maintenant = Date.now(), lignes = [];
    var svs = U.tousServices().map(function (x) { return x.code; });
    lignes.push(['Archive ' + annee + ' — ' + (U.etablissement() || '') + ' — éditée le ' + U.date(maintenant)]);
    svs.forEach(function (sv) {
      lignes.push([]); lignes.push(['Registre ' + U.libService(sv) + ' (' + sv + ') — ' + annee]);
      lignes.push(['N°', 'Catégorie', 'IPP', 'Âge', 'Mode', 'Début', 'Fin', 'Durée (h)', 'Lieu', 'Psychiatre', 'Professionnels']);
      M.registre(etat, sv, annee, maintenant).forEach(function (e) {
        lignes.push([e.numero || 'en cours', e.categorie, e.ipp, e.age, e.modeHospi, U.date(e.debut), e.fin ? U.date(e.fin) : 'en cours', e.dureeHeures.toFixed(2).replace('.', ','), e.lieu, e.psychiatre, e.professionnels.join(', ')]);
      });
    });
    var s = M.statistiquesAnnee(etat, svs, annee, maintenant);
    lignes.push([]); lignes.push(['Statistiques ' + annee + ' (ensemble des services)']);
    [['Mesures (entrées terminées)', s.mesures], ['Patients distincts', s.patients], ['Durée moyenne (h)', s.duree.moyenne], ['Heures de CSI', s.heuresCSI], ['Mainlevées JLD', s.jld.levee], ['Cycles avec une communication hors délai', s.jld.cyclesHorsDelai]]
      .forEach(function (l) { lignes.push([l[0], l[1] == null ? '' : String(Math.round(l[1] * 10) / 10).replace('.', ',')]); });
    Object.keys(s.categories).forEach(function (k) { lignes.push(['Catégorie ' + k, s.categories[k]]); });
    telecharger('archive_' + annee + '.csv', lignes);
    U.App.session.tracer('ARCHIVE', { libelle: 'Archive ' + annee + ' (registres et statistiques)' });
  }

  // ------------------------------------------------------------ Statistiques
  function tableau(titre, a, b) {
    var cles = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { cles[k] = 1; });
    var ks = Object.keys(cles).sort(function (x, y) { return (b[y] || 0) - (b[x] || 0); });
    return h('section', { class: 'panneau' }, h('h2', { text: titre }),
      ks.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
        h('tbody', {}, ks.map(function (k) { return h('tr', {}, h('td', { text: k }), h('td', { class: 'num', text: String(a[k] || 0) }), h('td', { class: 'num', text: String(b[k] || 0) })); })))) : h('div', { class: 'vide', text: 'Aucune donnée.' }));
  }

  function sectionsStats(a, b) {
    var o = M.optionsQualite(U.config()), res = [];
    var entA = { 'Réalisé': a.entretiens.realises, 'Non réalisé': a.entretiens.nonRealises, 'Non renseigné': a.entretiens.nonRenseignes };
    var entB = { 'Réalisé': b.entretiens.realises, 'Non réalisé': b.entretiens.nonRealises, 'Non renseigné': b.entretiens.nonRenseignes };
    res.push(h('p', { class: 'muted', text: 'Tableaux suivants : mesures débutées dans l’année (isolement et contention comptés séparément), colonnes ' + a.annee + ' puis ' + b.annee + '.' }));
    res.push(h('div', { class: 'deux-colonnes' },
      o.motifRecours || Object.keys(b.motifsRecours).some(function (k) { return k !== 'Non renseigné'; }) ? tableau('Motifs du recours', a.motifsRecours, b.motifsRecours) : null,
      tableau('Motifs de fin de mesure', a.motifsFin, b.motifsFin),
      o.entretien ? tableau(o.nomEntretien, entA, entB) : null));
    return res;
  }

  // ------------------------------------------------------------ Rapport annuel
  var CHAMPS_RAPPORT = [
    ['politique', 'Politique définie pour limiter le recours à l’isolement et à la contention', 'Ex. : prévention et désescalade, formation des équipes, alternatives (espace d’apaisement, chambre de soins…), organisation des renforts, analyse des situations…'],
    ['evaluation', 'Évaluation de la mise en œuvre de cette politique', 'Ex. : évolution des indicateurs, audits, retours d’expérience, entretiens après la mesure…'],
    ['actions', 'Actions prévues pour l’année suivante', ''],
    ['avis', 'Avis de la commission des usagers et du conseil de surveillance', 'Dates de présentation et avis rendus']
  ];

  function modaleRapport(svs, annee) {
    var etat = U.st(), maintenant = Date.now();
    var a = M.statistiquesAnnee(etat, svs, annee - 1, maintenant), b = M.statistiquesAnnee(etat, svs, annee, maintenant);
    var textes = ((U.config().rapportsAnnuels || {})[annee]) || {};
    var zones = {};
    var corps = h('div', { class: 'pile' },
      h('p', { class: 'muted', text: 'Article L. 3222-5-1, III : chaque année, l’établissement rend compte dans un rapport de ses pratiques d’isolement et de contention, de sa politique pour en limiter le recours et de l’évaluation de cette politique ; le rapport est soumis pour avis à la commission des usagers et au conseil de surveillance. Les chiffres sont repris de l’outil ; les textes sont à rédiger par l’établissement.' }),
      CHAMPS_RAPPORT.map(function (c) { zones[c[0]] = h('textarea', { rows: 4, placeholder: c[2] }, textes[c[0]] || ''); return h('label', {}, c[1], zones[c[0]]); }));
    function documentRapport() {
      var nf = function (v, u) { return v == null ? 'n.d.' : String(Math.round(v * 10) / 10).replace('.', ',') + (u || ''); };
      var ligne = function (l, x, y, u) { return h('tr', {}, h('td', { text: l }), h('td', { class: 'num', text: nf(x, u) }), h('td', { class: 'num', text: nf(y, u) })); };
      var titreSv = svs.length === 1 ? U.libService(svs[0]) : 'Ensemble des services';
      return h('article', { class: 'document-jld rapport-annuel' },
        h('h1', { text: 'Rapport annuel ' + annee + ' — isolement et contention' }),
        h('p', { text: (U.etablissement() || '') + ' — ' + titreSv + ' — article L. 3222-5-1, III du code de la santé publique' }),
        h('h2', { text: '1. Pratiques d’isolement et de contention' }),
        h('table', { class: 'stats' }, h('thead', {}, h('tr', {}, h('th', { text: 'Indicateur' }), h('th', { class: 'num', text: String(annee - 1) }), h('th', { class: 'num', text: String(annee) }))),
          h('tbody', {},
            (function () {
              // Unités de compte : l'unité principale choisie par l'établissement en tête
              var unites = {
                entrees: [ligne('Entrées du registre terminées', a.mesures, b.mesures), ligne('Durée moyenne d’une entrée', a.duree.moyenne, b.duree.moyenne, ' h')],
                sequences: [ligne('Séquences terminées', a.sequences.n, b.sequences.n), ligne('Durée moyenne d’une séquence', a.sequences.duree.moyenne, b.sequences.duree.moyenne, ' h'), ligne('Entrées du registre par séquence', a.sequences.entreesParSequence, b.sequences.entreesParSequence)],
                mesures: [ligne('Mesures d’isolement débutées (décompte du juge)', a.mesuresIsolement, b.mesuresIsolement), ligne('Mesures de contention débutées (décompte du juge)', a.mesuresContention, b.mesuresContention)]
              };
              var pr = M.optionsStats(U.config()).unitePrincipale;
              unites[pr][0].firstChild.appendChild(h('b', { text: ' (unité principale)' }));
              return [pr].concat(Object.keys(unites).filter(function (k) { return k !== pr; })).map(function (k) { return unites[k]; });
            })(),
            ligne('Patients distincts', a.patients, b.patients),
            ligne('Patients en hospitalisation complète (saisis)', a.patientsHC, b.patientsHC),
            ligne('Part des patients HC concernés', a.partPatientsHC == null ? null : a.partPatientsHC * 100, b.partPatientsHC == null ? null : b.partPatientsHC * 100, ' %'),
            ligne('Durée médiane d’une entrée', a.duree.mediane, b.duree.mediane, ' h'),
            ligne('Durée cumulée', a.duree.total, b.duree.total, ' h'),
            ligne('Heures d’utilisation des CSI', a.heuresCSI, b.heuresCSI, ' h'),
            ligne('Patients mineurs', a.patientsMineurs, b.patientsMineurs),
            ligne('Entrées concernant un patient en soins libres', a.soinsLibres, b.soinsLibres),
            ligne('Mainlevées par le JLD', a.jld.levee, b.jld.levee),
            ligne('Cycles avec une communication au JLD hors délai', a.jld.cyclesHorsDelai, b.jld.cyclesHorsDelai),
            Object.keys(b.categories).map(function (k) { return ligne('Catégorie ' + k + ' — ' + M.LIB_CATEGORIES[k], a.categories[k], b.categories[k]); }))),
        Object.keys(b.motifsRecours).some(function (k) { return k !== 'Non renseigné'; }) ? h('div', {}, h('h3', { text: 'Motifs du recours (' + annee + ')' }), h('ul', {}, Object.keys(b.motifsRecours).map(function (k) { return h('li', { text: k + ' : ' + b.motifsRecours[k] }); }))) : null,
        M.optionsQualite(U.config()).entretien ? h('p', { text: M.optionsQualite(U.config()).nomEntretien + ' (' + annee + ') : réalisé ' + b.entretiens.realises + ', non réalisé ' + b.entretiens.nonRealises + ', non renseigné ' + b.entretiens.nonRenseignes + '.' }) : null,
        U.methode.sectionMethode(svs, annee, b, true),
        CHAMPS_RAPPORT.map(function (c, i) { return h('div', {}, h('h2', { text: (i + 2) + '. ' + c[1] }), h('p', { class: 'texte-rapport', text: zones[c[0]].value.trim() || '(à compléter)' })); }));
    }
    var boutons = [{ texte: 'Fermer' },
      { texte: 'Imprimer / PDF', action: function () { U.imprimer(documentRapport()); return false; } }];
    if (U.App.session.peut('CONFIG')) boutons.push({ texte: 'Enregistrer les textes', classe: 'primaire', action: async function () {
      var tous = Object.assign({}, U.config().rapportsAnnuels || {}), v = {};
      CHAMPS_RAPPORT.forEach(function (c) { v[c[0]] = zones[c[0]].value.trim(); });
      tous[annee] = v;
      await U.enregistrerConfig([['rapportsAnnuels', tous]]);
      return false;
    } });
    U.modale('Rapport annuel ' + annee + ' (trame)', corps, boutons, { large: true });
  }

  // ------------------------------------------------------------ Droit d'accès
  function exporterPatient(p) {
    var d = M.donneesPatient(U.st(), p.id, Date.now());
    var o = M.optionsQualite(U.config());
    var lignes = [['Données concernant ' + (p.nom || '') + ' ' + (p.prenom || '') + ' — IPP ' + (p.ipp || '—') + ' — édité le ' + U.date(Date.now())], [],
      ['Fiche'], ['Nom', p.nom || ''], ['Prénom', p.prenom || ''], ['Date de naissance', p.naissance ? p.naissance.split('-').reverse().join('/') : ''], ['Protection juridique', p.protection || ''], ['Détenu', p.detenu ? 'oui' : 'non'], [],
      ['Modes d’hospitalisation'], ['Date', 'Mode']].concat((p.modes || []).map(function (x) { return [U.date(x.date), x.mode]; }), [[], ['Mesures'],
      ['Type', 'Début', 'Fin', 'Lieu', 'Psychiatre (début)', 'Psychiatre (fin)', 'Motif de fin', 'Motif du recours', 'Levées temporaires', 'Étapes JLD', 'Recours', 'Information du tiers', o.nomEntretien]]);
    d.mesures.forEach(function (m) {
      var jld = [];
      Object.keys(m.jld).forEach(function (c) { ['INFO', 'SAISINE', 'DECISION'].forEach(function (n) { var x = m.jld[c][n]; if (x) jld.push('cycle ' + c + ' ' + U.LIB_NATURE[n].toLowerCase() + ' ' + U.date(x.date) + (x.decision ? ' (' + (x.decision === 'LEVEE' ? 'mainlevée' : 'maintien') + ')' : '')); }); });
      lignes.push([m.type, U.date(m.debutInitial || m.debut), m.fin ? U.date(m.fin) : 'en cours', (m.segments || [{ lieu: m.lieu }]).map(function (s) { return s.lieu; }).join(' → '), m.psychiatreDebut, m.psychiatreFin, m.motifFin || '', m.motifRecours || '',
        (m.pauses || []).map(function (q) { return U.date(q.debut) + ' → ' + (q.reprise ? U.date(q.reprise) : 'prévue ' + U.date(q.reprisePrevue)); }).join(' ; '),
        jld.join(' ; '), (m.recours || []).map(U.parcours.libRecours).join(' ; '),
        (m.tiers || []).map(function (t) { return (U.LIB_TIERS[t.statut] || t.statut) + ' ' + U.date(t.date); }).join(' ; '),
        m.entretien ? (m.entretien.realise ? 'réalisé ' + U.date(m.entretien.date) : 'non réalisé') : '']);
    });
    lignes.push([]); lignes.push(['Entrées du registre']); lignes.push(['N°', 'Catégorie', 'Service', 'Début', 'Fin', 'Durée (h)', 'Mode']);
    d.registre.forEach(function (e) { lignes.push([e.numero || 'en cours', e.categorie, U.libService(e.service), U.date(e.debut), e.fin ? U.date(e.fin) : 'en cours', e.dureeHeures.toFixed(2).replace('.', ','), e.modeHospi]); });
    lignes.push([]); lignes.push(['Les noms des professionnels chargés de la surveillance ne sont pas communiqués (données concernant des tiers).']);
    telecharger('donnees_patient_' + (p.ipp || p.id) + '.csv', lignes);
    U.App.session.tracer('EXPORT_PATIENT', { libelle: 'Données de ' + ((p.nom || '') + ' ' + (p.prenom || '')).trim() + (p.ipp ? ' (IPP ' + p.ipp + ')' : '') + ' — droit d’accès' });
    U.toast('Export enregistré au journal.');
  }

  U.qualite = { champMotif: champMotif, modaleEntretien: modaleEntretien, detailMesure: detailMesure, entretiensARenseigner: entretiensARenseigner, panneauAdmin: panneauAdmin, sectionsStats: sectionsStats, modaleRapport: modaleRapport, exporterPatient: exporterPatient };
})();
