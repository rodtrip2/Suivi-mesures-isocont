// SPDX-License-Identifier: EUPL-1.2
// Services par compte, lots, registre, statistiques, décompte JLD : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

const H = 3600 * 1000;
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
let n = 0;
const evt = (type, data, extra) => Object.assign({ id: 'e' + String(++n).padStart(5, '0'), at: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString(), by: 'u1', type, data }, extra || {});

test('Services visibles : affectés pour un agent, tous pour un administrateur', () => {
  const config = { services: [{ code: 'A' }, { code: 'B' }, { code: 'C' }] };
  assert.deepEqual(M.servicesDe({ roles: ['IDE'], services: ['B', 'Z'] }, config), ['B']);
  assert.deepEqual(M.servicesDe({ roles: ['CADRE'], services: [] }, config), []);
  assert.deepEqual(M.servicesDe({ roles: ['CADRE', 'ADMIN'], services: ['A'] }, config), ['A', 'B', 'C']);
});

test('Lot : ses saisies sont appliquées, annulables une à une ou en bloc', () => {
  const l = evt('LOT', { evenements: [
    { type: 'PATIENT', data: { patientId: 'P1', nom: 'X' } },
    { type: 'MESURE_DEBUT', data: { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 2, 1, 8), csi: true } },
    { type: 'MESURE_FIN', data: { mesureId: 'M1', fin: local(2026, 2, 1, 20) } }
  ] });
  let st = M.reduire([l]);
  assert.equal(st.mesures.M1.fin, local(2026, 2, 1, 20));
  assert.equal(st.journal.length, 1);
  st = M.reduire([l, evt('ANNULATION', { cible: l.id + '.00002' })]);
  assert.equal(st.mesures.M1.fin, null);
  st = M.reduire([l, evt('ANNULATION', { cible: l.id })]);
  assert.equal(Object.keys(st.mesures).length, 0);
});

function base() {
  return [
    evt('PATIENT', { patientId: 'P1', naissance: '2010-06-01' }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2025, 1, 1) }),
    evt('PATIENT', { patientId: 'P2' }),
    evt('MODE_HOSPI', { patientId: 'P2', mode: 'SL', date: local(2025, 1, 1) }),
    evt('MESURE_DEBUT', { mesureId: 'I1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('MESURE_FIN', { mesureId: 'I1', fin: local(2026, 3, 2, 8) }),
    evt('MESURE_DEBUT', { mesureId: 'C1', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: local(2026, 3, 1, 10), csi: true }),
    evt('MESURE_FIN', { mesureId: 'C1', fin: local(2026, 3, 1, 14) }),
    evt('MESURE_DEBUT', { mesureId: 'B1', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 2, 10, 9), csi: false }),
    evt('MESURE_FIN', { mesureId: 'B1', fin: local(2026, 2, 10, 15) }),
    evt('TIERS', { mesureId: 'I1', cycle: 1, statut: 'INFORME', informateur: 'PSYCHIATRE', date: local(2026, 3, 1, 9) }),
    evt('MESURE_DEBUT', { mesureId: 'I2', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 5, 1, 8), csi: true })
  ];
}

test('Registre : numérotation dans l\'ordre des fins, à la suite du registre antérieur ; entrées en cours sans numéro', () => {
  const st = M.reduire(base().concat([evt('CONFIG', { cle: 'compteursRegistre', valeur: { U1: { 2026: 40 } } })]));
  const reg = M.registre(st, 'U1', 2026, local(2026, 5, 2));
  assert.deepEqual(reg.map(e => e.numero), ['B41', 'A42', 'C43', 'A44', '']);
});

test('Statistiques annuelles : mesures, patients, durées, CSI, soins libres, mineurs, tiers', () => {
  const st = M.reduire(base().concat([evt('STATS', { service: 'U1', annee: 2026, hc: 100, ssc: 40 })]));
  const s = M.statistiquesAnnee(st, ['U1'], 2026, local(2026, 5, 2));
  assert.equal(s.mesures, 4);
  assert.equal(s.enCours, 1);
  assert.equal(s.patients, 2);
  assert.equal(s.patientsIsolement, 2);
  assert.equal(s.patientsContention, 1);
  assert.equal(s.duree.total, 6 + 2 + 4 + 18);
  assert.equal(s.heuresCSI, 24);
  assert.equal(s.soinsLibres, 1);
  assert.equal(s.patientsMineurs, 1);
  assert.equal(s.partPatientsHC, 0.02);
  assert.deepEqual(s.categories, { A: 2, B: 1, C: 1, D: 0, E: 0 });
  assert.equal(s.tiers.INFORME, 1);
  assert.equal(s.mois[2].mesures, 3);
});

test('Décompte JLD : mesure antérieure sur 15 jours puis segments de 24 h avec cumul', () => {
  const evts = [
    evt('MESURE_DEBUT', { mesureId: 'A', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 9, 25, 8), csi: true }),
    evt('MESURE_FIN', { mesureId: 'A', fin: local(2026, 9, 26, 2) }),
    evt('MESURE_DEBUT', { mesureId: 'B', patientId: 'P', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 10, 1, 8), csi: true })
  ];
  const st = M.reduire(evts);
  const d = M.decompte(st, st.mesures.B, local(2026, 10, 3, 20));
  assert.equal(d.cumulAvant, 18);
  assert.deepEqual(d.lignes.map(l => Math.round(l.duree)), [18, 24, 24, 12]);
  assert.deepEqual(d.lignes.map(l => Math.round(l.cumul)), [18, 42, 66, 78]);
  assert.equal(d.lignes[3].statut, 'EN COURS');
  assert.equal(d.total, 78);
});

test('Cumuls patient et niveau de vigilance', () => {
  const st = M.reduire(base());
  const c = M.cumulsPatient(st, 'P2', local(2026, 5, 3, 8));
  assert.equal(c.iso48, 48);
  assert.equal(c.niveau, 'rouge');
});

test('Postes de surveillance propres à un service', () => {
  const st = M.reduire(base().concat([evt('CONFIG', { cle: 'periodesService', valeur: { U1: [{ code: 'J', libelle: 'Jour', debut: '07:00', fin: '19:00' }, { code: 'N', libelle: 'Nuit', debut: '19:00', fin: '07:00' }] } })]));
  const postes = M.postesSurveillance(st, 'U1', local(2026, 5, 2, 12), 2);
  assert.ok(postes.length >= 3);
  assert.ok(postes.every(p => p.periode === 'J' || p.periode === 'N'));
});

test('Chaînage : une saisie supprimée du dossier est signalée', () => {
  const a = evt('PATIENT', { patientId: 'P1' });
  const b = evt('PATIENT', { patientId: 'P2' }, { prec: a.id });
  const c = evt('PATIENT', { patientId: 'P3' }, { prec: b.id });
  assert.equal(M.reduire([a, b, c]).manquants.length, 0);
  const st = M.reduire([a, c]);
  assert.deepEqual(st.manquants.map(x => x.manque), [b.id]);
});

test('Pause (levée temporaire) : ne termine pas la mesure, ne décale pas les échéances, reprise tracée', () => {
  const d0 = local(2026, 3, 1, 8);
  const debut = evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0, csi: true });
  const sans = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut]);
  const echSans = M.suiviJLD(sans, sans.mesures.M1, d0 + 30 * H);

  const pause = evt('PAUSE', { mesureId: 'M1', debut: d0 + 4 * H, reprisePrevue: d0 + 5 * H, psychiatre: 'Dr X (fictif)', motif: 'Repas' }, { base: 1 });
  let st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause]);
  const m = st.mesures.M1;
  assert.equal(m.fin, null);
  assert.ok(M.pauseEnCours(m, d0 + 4.5 * H));
  assert.equal(M.pauseEnCours(m, d0 + 4.5 * H).depassee, false);
  assert.equal(M.pauseEnCours(m, d0 + 6 * H).depassee, true);          // reprise prévue passée, non confirmée
  assert.equal(M.pauseEnCours(m, d0 + 3 * H), null);                    // avant la pause
  assert.equal(M.dureeHeures(m, d0 + 6 * H), 6);                        // la durée continue de courir
  const echAvec = M.suiviJLD(st, m, d0 + 30 * H);
  assert.equal(echAvec.info.echeance, echSans.info.echeance);
  assert.equal(echAvec.saisine.echeance, echSans.saisine.echeance);

  // Reprise : clôt la pause désignée
  const reprise = evt('REPRISE', { mesureId: 'M1', pause: pause.id, date: d0 + 5.25 * H }, { base: 2 });
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, reprise]);
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 6 * H), null);
  assert.equal(M.dureePausesHeures(st.mesures.M1, d0 + 10 * H), 1.25);
  assert.equal(st.conflits.length, 0);

  // Fin pendant la pause : la pause s'arrête à la fin de la mesure
  const fin = evt('MESURE_FIN', { mesureId: 'M1', fin: d0 + 4 * H }, { base: 2 });
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, fin]);
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 6 * H), null);
  assert.equal(M.dureePausesHeures(st.mesures.M1, d0 + 10 * H), 0);

  // Annulation de la pause
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, evt('ANNULATION', { cible: pause.id })]);
  assert.equal(st.mesures.M1.pauses.length, 0);

  // Deux pauses saisies en même temps par deux agents : conflit à arbitrer
  const concurrente = evt('PAUSE', { mesureId: 'M1', debut: d0 + 4 * H, reprisePrevue: d0 + 6 * H }, { base: 1, by: 'u2' });
  st = M.reduire([evt('PATIENT', { patientId: 'P1' }), debut, pause, concurrente]);
  assert.equal(st.conflits.length, 1);
  assert.equal(st.mesures.M1.pauses.length, 1);

  // Droits : IDE, AS et cadre ; pas la secrétaire
  assert.ok(M.peut(['AS'], 'PAUSE') && M.peut(['IDE'], 'REPRISE') && M.peut(['CADRE'], 'PAUSE'));
  assert.ok(!M.peut(['SECRETAIRE'], 'PAUSE'));
});

test('Option : pauses retranchées des décomptes et échéances reportées d’autant', () => {
  const d0 = local(2026, 4, 1, 8);
  const evts = (cfg) => [
    evt('CONFIG', { cle: 'pauses', valeur: cfg }),
    evt('CONFIG', { cle: 'services', valeur: [{ code: 'U1', libelle: 'U1' }] }),
    evt('PATIENT', { patientId: 'P1' }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2026, 1, 1) }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0, csi: true, lieu: 'CSI 1' }),
    evt('PAUSE', { mesureId: 'M1', debut: d0 + 4 * H, reprisePrevue: d0 + 6 * H }, { base: 1 }),
    evt('REPRISE', { mesureId: 'M1', date: d0 + 6 * H }, { base: 2 })
  ];
  const sans = M.reduire(evts({ retrancher: false }));
  const avec = M.reduire(evts({ retrancher: true }));
  const t = d0 + 20 * H;
  assert.equal(M.dureeHeures(sans.mesures.M1, t, sans.config), 20);
  assert.equal(M.dureeHeures(avec.mesures.M1, t, avec.config), 18);
  assert.equal(M.cumulsPatient(avec, 'P1', t).iso15, 18);
  const eSans = M.suiviJLD(sans, sans.mesures.M1, t), eAvec = M.suiviJLD(avec, avec.mesures.M1, t);
  assert.equal(eAvec.info.echeance - eSans.info.echeance, 2 * H);           // 48 h décomptées = début + 50 h
  assert.equal(eAvec.saisine.echeance - eSans.saisine.echeance, 2 * H);
  // Décompte et registre
  const dc = M.decompte(avec, avec.mesures.M1, t);
  assert.equal(dc.total, 18);
  // La pause interrompt le décompte : ligne de pause non décomptée, puis reprise
  assert.deepEqual(dc.lignes.map(l => [l.n, l.type, l.duree, l.cumul]), [['1.1', 'mesure', 4, 4], ['', 'pause', 2, 4], ['1.2', 'mesure', 14, 18]]);
  assert.match(dc.lignes[1].commentaire, /Durée déduite, non ajoutée au cumul/);
  assert.match(dc.lignes[2].commentaire, /Reprise de la mesure après levée temporaire/);
  const dcSans = M.decompte(sans, sans.mesures.M1, t);
  assert.equal(dcSans.lignes.length, 1);
  assert.match(dcSans.lignes[0].commentaire, /dont levée temporaire de 12:00 à 14:00, non déduite \(comptée dans le cumul\)/);
  // Registre : durée réelle par défaut (déduction limitée aux délais JLD), pauses listées
  const r = M.registre(avec, 'U1', 2026, t)[0];
  assert.equal(r.dureeHeures, 20);
  assert.deepEqual(r.pauses, [[d0 + 4 * H, d0 + 6 * H]]);
  // « Partout » : registre et statistiques hors pauses
  const partout = M.reduire(evts({ retrancher: true, portee: 'partout' }));
  assert.equal(M.registre(partout, 'U1', 2026, t)[0].dureeHeures, 18);
  assert.equal(M.registre(partout, 'U1', 2026, t)[0].dureeReelleHeures, 20);
  // Mesure suivante : le cumul des 15 jours tient compte de la pause retranchée
  const suite = evts({ retrancher: true }).concat([
    evt('MESURE_FIN', { mesureId: 'M1', fin: d0 + 20 * H }, { base: 3 }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0 + 30 * H, csi: true })
  ]);
  const st2 = M.reduire(suite);
  assert.equal(M.suiviJLD(st2, st2.mesures.M2, d0 + 31 * H).cumulAvant, 18);
});

test('Option : pause non reprise retranchée jusqu’à la reprise prévue seulement ; reprise automatique', () => {
  const d0 = local(2026, 5, 1, 8);
  const evts = (cfg) => [
    evt('CONFIG', { cle: 'pauses', valeur: cfg }),
    evt('PATIENT', { patientId: 'P1' }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: d0, csi: true }),
    evt('PAUSE', { mesureId: 'M1', debut: d0 + 2 * H, reprisePrevue: d0 + 3 * H }, { base: 1 })
  ];
  let st = M.reduire(evts({ retrancher: true }));
  const m = st.mesures.M1;
  assert.deepEqual(M.exclusions(m, d0 + 2.5 * H, st.config), [[d0 + 2 * H, d0 + 2.5 * H]]);   // pause en cours : jusqu'à maintenant
  assert.deepEqual(M.exclusions(m, d0 + 10 * H, st.config), [[d0 + 2 * H, d0 + 3 * H]]);    // reprise non saisie : plafonnée à l'heure prévue
  assert.ok(M.pauseEnCours(m, d0 + 10 * H, st.config).depassee);                                 // sans reprise automatique : à confirmer

  st = M.reduire(evts({ repriseAuto: true }));
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 2.5 * H, st.config).depassee, false);
  assert.equal(M.pauseEnCours(st.mesures.M1, d0 + 3 * H, st.config), null);                     // reprise automatique
  assert.ok(M.repriseAutomatique(st.mesures.M1, st.mesures.M1.pauses[0], d0 + 4 * H, st.config));
  assert.equal(M.dureePausesHeures(st.mesures.M1, d0 + 10 * H, st.config), 1);
  assert.equal(M.dureeHeures(st.mesures.M1, d0 + 10 * H, st.config), 10);                          // non retranchée par défaut

  // Seuils réglables, plafonnés à 48 h ; l'alerte reste sous le refus
  assert.deepEqual([M.optionsPauses({}).alerteHeures, M.optionsPauses({}).refusHeures], [12, 48]);
  assert.equal(M.optionsPauses({ pauses: { refusHeures: 72 } }).refusHeures, 48);
  assert.equal(M.optionsPauses({ pauses: { alerteHeures: 30, refusHeures: 24 } }).alerteHeures, 24);
});

test('Masque du décompte JLD : défaut, établissement, service, anciens réglages', () => {
  const d = M.masqueDecompte({}, 'U1');
  assert.deepEqual(d.colonnes, M.COLONNES_DECOMPTE);
  assert.equal(d.propre, false);
  assert.equal(d.sections.total, true);
  const config = { decompte: {
    '*': { entete: 'CH (fictif)', identite: ['patient', 'ipp'], sections: { jld: true } },
    U1: { titreIsolement: 'Isolement — U1', colonnes: ['Cumul', 'Debut', 'Inconnue'], sections: { cycle: false } },
    U2: { titreIsolement: '', masquer: ['N', 'Commentaire'] }        // ancien format (import V1.3)
  } };
  const u1 = M.masqueDecompte(config, 'U1');
  assert.equal(u1.propre, true);
  assert.equal(u1.titreIsolement, 'Isolement — U1');
  assert.equal(u1.entete, 'CH (fictif)');                              // hérité de l'établissement
  assert.deepEqual(u1.identite, ['patient', 'ipp']);
  assert.deepEqual(u1.colonnes, ['Cumul', 'Debut']);                   // ordre conservé, colonne inconnue écartée
  assert.equal(u1.sections.jld, true);
  assert.equal(u1.sections.cycle, false);
  assert.equal(u1.sections.total, true);
  const u2 = M.masqueDecompte(config, 'U2');
  assert.equal(u2.titreIsolement, M.MASQUE_DEFAUT.titreIsolement);     // titre vide : titre par défaut
  assert.deepEqual(u2.colonnes, ['Debut', 'Fin', 'Duree', 'Cumul', 'Statut']);
  assert.equal(M.masqueDecompte(config, 'U3').propre, false);
});

test('Masque du décompte : date d’édition et auteur séparés, ancien réglage commun repris, marges et fond', () => {
  const d = M.masqueDecompte({}, 'U1');
  assert.equal(d.sections.dateEdition, true); assert.equal(d.sections.auteur, true);
  assert.equal(d.sections.editeur, undefined);
  const ancien = M.masqueDecompte({ decompte: { '*': { sections: { editeur: false } } } }, 'U1');
  assert.equal(ancien.sections.dateEdition, false); assert.equal(ancien.sections.auteur, false);
  const sep = M.masqueDecompte({ decompte: { '*': { sections: { auteur: false } } } }, 'U1');
  assert.equal(sep.sections.dateEdition, true); assert.equal(sep.sections.auteur, false);
  const cfg = { imagesDecompte: { img1: { nom: 'courrier.png', donnees: 'data:image/jpeg;base64,AA' } }, decompte: { U1: { fond: 'img1', marges: { haut: 45, gauche: 200 } }, U2: { fond: 'absente' } } };
  const u1 = M.masqueDecompte(cfg, 'U1');
  assert.equal(u1.fond, 'img1');
  assert.deepEqual(u1.marges, { haut: 45, droite: 15, bas: 15, gauche: 80 });
  assert.equal(M.masqueDecompte(cfg, 'U2').fond, '');                 // image supprimée : pas de fond
});

test('Masque du décompte : format des durées en heures, en jours ou les deux', () => {
  const d = M.masqueDecompte({}, 'U1');
  assert.deepEqual([d.formatDuree, d.formatCumul], ['j', 'j']);              // présentation inchangée par défaut
  const m = M.masqueDecompte({ decompte: { U1: { formatDuree: 'h', formatCumul: 'hj' }, U2: { formatCumul: 'x' } } }, 'U1');
  assert.deepEqual([m.formatDuree, m.formatCumul], ['h', 'hj']);
  assert.equal(M.masqueDecompte({ decompte: { U2: { formatCumul: 'x' } } }, 'U2').formatCumul, 'j');
});

test('Options des pauses : activation, portée de la déduction', () => {
  assert.equal(M.optionsPauses({}).active, true);
  assert.equal(M.optionsPauses({ pauses: { active: false } }).active, false);
  assert.equal(M.optionsPauses({ pauses: { active: false, retrancher: true } }).active, true);   // déduites : fonction forcément active
  assert.equal(M.optionsPauses({ pauses: { retrancher: true } }).portee, 'jld');
  assert.equal(M.optionsPauses({ pauses: { retrancher: true } }).deduireRegistre, false);
  assert.equal(M.optionsPauses({ pauses: { retrancher: true, portee: 'partout' } }).deduireRegistre, true);
  assert.equal(M.optionsPauses({ pauses: { retrancher: false, portee: 'partout' } }).deduireRegistre, false);
  assert.equal(M.optionsPauses({ pauses: { active: false } }).colonneRegistre, false);
});

test('Registre : identifiant (IPP) et âge exigés par l’article L. 3222-5-1', () => {
  const st = M.reduire([
    evt('CONFIG', { cle: 'services', valeur: [{ code: 'U1', libelle: 'U1' }] }),
    evt('PATIENT', { patientId: 'P1', ipp: '900001', naissance: '2009-06-15' }),
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 6, 14, 10), csi: true, lieu: 'CSI 1' }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 6, 14, 20) })
  ]);
  const e = M.registre(st, 'U1', 2026, local(2026, 7, 1))[0];
  assert.equal(e.ipp, '900001');
  assert.equal(e.age, 16);                                              // 17 ans le lendemain
});

test('Registre pour communication (CADA) : occultations et numéros de remplacement', () => {
  const evts = [
    evt('CONFIG', { cle: 'services', valeur: [{ code: 'U1', libelle: 'U1' }] }),
    evt('PATIENT', { patientId: 'P1', ipp: '900001', naissance: '1980-01-01' }),
    evt('PATIENT', { patientId: 'P2', ipp: '900002', naissance: '2010-01-01' }),
    evt('MODE_HOSPI', { patientId: 'P1', mode: 'SDT', date: local(2026, 1, 1) }),
    evt('MODE_HOSPI', { patientId: 'P2', mode: 'SL mineur', date: local(2026, 1, 1) })
  ];
  [['M1', 'P1', 2, 'Dr A (fictif)'], ['M2', 'P2', 3, 'Dr B (fictif)'], ['M3', 'P1', 4, 'Dr A (fictif)']].forEach(([id, p, j, psy]) => {
    evts.push(evt('MESURE_DEBUT', { mesureId: id, patientId: p, service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, j, 8), csi: true, lieu: 'CSI 1', psychiatre: psy }));
    evts.push(evt('MESURE_FIN', { mesureId: id, fin: local(2026, 3, j, 18) }));
  });
  evts.push(evt('PROFESSIONNEL', { service: 'U1', date: '2026-03-02', periode: 'M', nom: 'Agent A (fictif)', fonction: 'IDE' }));
  evts.push(evt('PROFESSIONNEL', { service: 'U1', date: '2026-03-02', periode: 'M', nom: 'Agent B (fictif)', fonction: 'IDE' }));
  evts.push(evt('PROFESSIONNEL', { service: 'U1', date: '2026-03-04', periode: 'M', nom: 'Agent B (fictif)', fonction: 'IDE' }));
  const st = M.reduire(evts);
  const fmt = { date: t => 'D' + new Date(t).getDate() + 'h' + new Date(t).getHours(), jour: t => 'D' + new Date(t).getDate(), mois: () => 'mars', duree: h => h + 'h' };
  const texte = r => JSON.stringify(r.lignes);
  // Par défaut : rien d'identifiant
  let r = M.registreCommunicable(st, 'U1', 2026, local(2026, 12, 1), {}, fmt);
  assert.deepEqual(r.colonnes, ['N°', 'Catégorie', 'Mineur', "Mode d'hospitalisation", 'Début', 'Fin', 'Durée', 'Levées temporaires']);
  assert.ok(!/9000|Dr |Agent/.test(texte(r)));
  assert.deepEqual(r.lignes.map(l => l[2]), ['non', 'oui', 'non']);
  assert.equal(r.lignes[0][4], 'D2');                                    // date sans l'heure
  // Numéros de remplacement, cohérents dans le document
  r = M.registreCommunicable(st, 'U1', 2026, local(2026, 12, 1), { patient: 'numero', psychiatre: 'numero', professionnels: 'numero', age: 'tranche', dates: 'mois' }, fmt);
  const col = n => r.colonnes.indexOf(n);
  assert.deepEqual(r.lignes.map(l => l[col('Patient')]), ['Patient 1', 'Patient 2', 'Patient 1']);
  assert.deepEqual(r.lignes.map(l => l[col('Psychiatre')]), ['Psychiatre 1', 'Psychiatre 2', 'Psychiatre 1']);
  assert.equal(r.lignes[0][col('Professionnels chargés de la surveillance')], 'IDE 1, IDE 2');
  assert.equal(r.lignes[2][col('Professionnels chargés de la surveillance')], 'IDE 2');
  assert.equal(r.lignes[1][col('Tranche d’âge')], 'moins de 18 ans');
  assert.ok(!/9000|Dr |Agent/.test(texte(r)));
  // Fonction seule, psychiatre générique, mode réduit
  r = M.registreCommunicable(st, 'U1', 2026, local(2026, 12, 1), { psychiatre: 'generique', professionnels: 'fonction', mode: 'contrainte' }, fmt);
  assert.equal(r.lignes[0][r.colonnes.indexOf('Psychiatre')], 'Psychiatre');
  assert.equal(r.lignes[0][r.colonnes.indexOf('Professionnels chargés de la surveillance')], '2 IDE');
  assert.deepEqual(r.lignes.map(l => l[r.colonnes.indexOf('Soins sans consentement')]), ['oui', 'non', 'oui']);
});

test('Décompte : statut de la mesure sur toutes ses tranches, numérotation mesure.tranche, tranche réglable', () => {
  const d0 = local(2026, 9, 1, 8);
  const st = M.reduire([
    evt('PATIENT', { patientId: 'P1' }),
    evt('MESURE_DEBUT', { mesureId: 'A', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0 - 100 * H, csi: true }),
    evt('MESURE_FIN', { mesureId: 'A', fin: d0 - 90 * H }),
    evt('MESURE_DEBUT', { mesureId: 'B', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0, csi: true })
  ]);
  const t = d0 + 40 * H;
  let dc = M.decompte(st, st.mesures.B, t);
  assert.deepEqual(dc.lignes.map(l => [l.n, l.statut]), [['1', 'TERMINÉE'], ['2.1', 'EN COURS'], ['2.2', 'EN COURS']]);
  assert.match(dc.lignes[2].commentaire, /Suite de la même mesure \(tranche 2\)/);
  assert.equal(dc.tranches, true);
  dc = M.decompte(st, st.mesures.B, t, { tranche: 12 });
  assert.deepEqual(dc.lignes.map(l => l.n), ['1', '2.1', '2.2', '2.3', '2.4']);
  dc = M.decompte(st, st.mesures.B, t, { tranche: 0 });
  assert.deepEqual(dc.lignes.map(l => [l.n, l.duree]), [['1', 10], ['2', 40]]);
  // Mesure terminée : toutes ses tranches sont terminées ; référence antérieure à la fin : en cours
  const st2 = M.reduire(st.journal.concat([evt('MESURE_FIN', { mesureId: 'B', fin: d0 + 30 * H })]));
  assert.ok(M.decompte(st2, st2.mesures.B, t).lignes.slice(1).every(l => l.statut === 'TERMINÉE'));
  assert.ok(M.decompte(st2, st2.mesures.B, d0 + 26 * H).lignes.slice(1).every(l => l.statut === 'EN COURS'));
  // Masque : tranches par type
  assert.deepEqual([M.masqueDecompte({}, 'U1').trancheIsolement, M.masqueDecompte({}, 'U1').trancheContention], [24, 12]);
  assert.equal(M.masqueDecompte({ decompte: { U1: { trancheIsolement: 0 } } }, 'U1').trancheIsolement, 0);
});

test('Décompte : lignes de la mesure actuelle repérées, réglage de mise en évidence', () => {
  const d0 = local(2026, 9, 1, 8);
  const st = M.reduire([
    evt('PATIENT', { patientId: 'P1' }),
    evt('MESURE_DEBUT', { mesureId: 'A', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0 - 100 * H, csi: true }),
    evt('MESURE_FIN', { mesureId: 'A', fin: d0 - 90 * H }),
    evt('MESURE_DEBUT', { mesureId: 'B', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: d0, csi: true })
  ]);
  assert.deepEqual(M.decompte(st, st.mesures.B, d0 + 30 * H).lignes.map(l => l.actuelle), [false, true, true]);
  assert.equal(M.masqueDecompte({}, 'U1').miseEnEvidence, 'aucune');
  assert.equal(M.masqueDecompte({ decompte: { U1: { miseEnEvidence: 'les-deux' } } }, 'U1').miseEnEvidence, 'les-deux');
  assert.equal(M.masqueDecompte({ decompte: { U1: { miseEnEvidence: 'x' } } }, 'U1').miseEnEvidence, 'aucune');
});
