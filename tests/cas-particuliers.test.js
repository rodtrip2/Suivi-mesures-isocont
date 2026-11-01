// SPDX-License-Identifier: EUPL-1.2
// Cas particuliers : 48 h après une mainlevée, fusion de fiches, mesure débutée ailleurs : npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/js/model.js');

const H = 3600 * 1000;
const local = (a, mo, j, h, mi) => new Date(a, mo - 1, j, h || 0, mi || 0).getTime();
let n = 0;
const evt = (type, data) => ({ id: 'e' + String(++n).padStart(5, '0'), at: new Date(local(2026, 3, 1, 12) + n * 1000).toISOString(), by: 'u1', type, data });

function patient(id, mode, extra) {
  return [evt('PATIENT', Object.assign({ patientId: id, nom: 'NOM' + id }, extra || {})), evt('MODE_HOSPI', { patientId: id, mode: mode || 'SDT', date: local(2026, 1, 1) })];
}

test('Mainlevée : nouvelle mesure dans les 48 h signalée, information du JLD due sans délai', () => {
  const evts = patient('P1').concat([
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('JLD', { mesureId: 'M1', cycle: 1, nature: 'DECISION', decision: 'LEVEE', date: local(2026, 3, 3, 14) }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 3, 15) }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 4, 10), csi: true }),
    evt('MESURE_DEBUT', { mesureId: 'M3', patientId: 'P1', service: 'U1', typeMesure: 'Contention', debut: local(2026, 3, 4, 11), csi: true })
  ]);
  let st = M.reduire(evts);
  assert.equal(M.mainleveeRecente(st, 'P1', 'Isolement', local(2026, 3, 5, 13)).date, local(2026, 3, 3, 14));
  assert.equal(M.mainleveeRecente(st, 'P1', 'Isolement', local(2026, 3, 5, 15)), null);   // 48 h écoulées
  const j = M.suiviJLD(st, st.mesures.M2, local(2026, 3, 4, 12));
  assert.ok(j.apresMainlevee);
  assert.equal(j.info.echeance, local(2026, 3, 4, 10));
  assert.equal(j.info.statut, 'depasse');
  assert.ok(M.apresMainlevee(st, st.mesures.M3));                       // par défaut : toute nouvelle mesure
  // Réglages : même type seulement ; échéance non avancée
  st = M.reduire(evts.concat([evt('CONFIG', { cle: 'casParticuliers', valeur: { mainleveeType: 'meme', mainleveeInfoSansDelai: false } })]));
  assert.equal(M.apresMainlevee(st, st.mesures.M3), null);
  assert.notEqual(M.suiviJLD(st, st.mesures.M2, local(2026, 3, 4, 12)).info.echeance, local(2026, 3, 4, 10));
});

test('Fusion de fiches : mesures, modes et identité rattachés ; cumul recalculé ; annulable', () => {
  const evts = patient('P1', 'SDT', { ipp: '900', naissance: '1990-05-01' }).concat(patient('P2', 'SDT', { nom: 'NOMP1', naissance: '1990-05-01' }), [
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 2, 8) }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 5, 8), csi: true })
  ]);
  let st = M.reduire(evts);
  assert.equal(M.suiviJLD(st, st.mesures.M2, local(2026, 3, 5, 9)).cumulAvant, 0);
  assert.deepEqual(M.doublonsPossibles(st, st.patients.P2, 'P2').map((x) => x.patient.id), ['P1']);
  const f = evt('FUSION', { garde: 'P1', absorbe: 'P2', motif: 'doublon' });
  st = M.reduire(evts.concat([f, evt('MODE_HOSPI', { patientId: 'P2', mode: 'SDRE', date: local(2026, 3, 6) })]));
  assert.equal(st.patients.P2, undefined);
  assert.equal(st.mesures.M2.patientId, 'P1');
  assert.equal(M.suiviJLD(st, st.mesures.M2, local(2026, 3, 5, 9)).cumulAvant, 24);   // la mesure de P1 compte désormais
  assert.equal(st.patients.P1.fusionnes[0].id, 'P2');
  assert.equal(M.modeA(st, 'P1', local(2026, 3, 7)), 'SDRE');                          // saisie ultérieure sur l'ancienne fiche redirigée
  st = M.reduire(evts.concat([f, evt('ANNULATION', { cible: f.id })]));
  assert.equal(st.mesures.M2.patientId, 'P2');
  assert.ok(M.peut(['CADRE'], 'FUSION'));
  assert.ok(!M.peut(['IDE'], 'FUSION'));
});

test('Mesure débutée ailleurs : délais JLD depuis la décision initiale, registre depuis l’arrivée', () => {
  const evts = patient('P1').concat([
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 2, 8), debutInitial: local(2026, 3, 1, 20), lieuInitial: 'Urgences (fictif)', csi: true }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 3, 8) })
  ]);
  const st = M.reduire(evts);
  const j = M.suiviJLD(st, st.mesures.M1, local(2026, 3, 2, 9));
  assert.equal(j.info.echeance, local(2026, 3, 1, 20) + 48 * H);
  assert.equal(j.debutService, local(2026, 3, 2, 8));
  const reg = M.registre(st, 'U1', 2026, local(2026, 4, 1));
  assert.equal(reg.length, 1);
  assert.equal(Math.round(reg[0].dureeHeures), 24);                                    // partie du service seulement
  const d = M.decompte(st, st.mesures.M1, local(2026, 3, 4), { tranche: 0 });
  const lignes = d.lignes.filter((l) => l.type === 'mesure');
  assert.equal(lignes.length, 2);
  assert.match(lignes[0].commentaire, /Urgences \(fictif\)/);
  assert.match(lignes[1].commentaire, /Arrivée dans le service/);
  assert.equal(Math.round(lignes[1].cumul), 36);
});

// ------------------------------------------------------------------ Lot 2
function mesureIso(id, debut, extra) {
  return evt('MESURE_DEBUT', Object.assign({ mesureId: id, patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: debut, csi: true, lieu: 'CSI 1' }, extra || {}));
}

test('Transfert entre services : une seule mesure pour le JLD, répartie au registre', () => {
  const evts = patient('P1').concat([
    mesureIso('M1', local(2026, 3, 1, 8)),
    evt('TRANSFERT', { mesureId: 'M1', date: local(2026, 3, 2, 8), service: 'U2', lieu: 'CSI A', csi: true }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 2, 20) })
  ]);
  const st = M.reduire(evts);
  assert.equal(st.mesures.M1.service, 'U2');
  const r1 = M.registre(st, 'U1', 2026, local(2026, 4, 1)), r2 = M.registre(st, 'U2', 2026, local(2026, 4, 1));
  assert.equal(r1.length, 1); assert.equal(Math.round(r1[0].dureeHeures), 24); assert.equal(r1[0].numero, 'A1');
  assert.equal(r2.length, 1); assert.equal(Math.round(r2[0].dureeHeures), 12); assert.equal(r2[0].lieu, 'CSI A');
  const j = M.suiviJLD(st, st.mesures.M1, local(2026, 3, 2, 9));
  assert.equal(j.info.echeance, local(2026, 3, 3, 8));                         // 48 h depuis le début, transfert sans effet
});

test('Soins somatiques : poursuite (service ou registre dédié) et suspension', () => {
  const base = (mode, extra) => patient('P1').concat([
    mesureIso('M1', local(2026, 3, 1, 8)),
    evt('SOMATIQUE', Object.assign({ mesureId: 'M1', date: local(2026, 3, 1, 20), lieu: 'Urgences (fictif)', mode: mode }, extra || {})),
    evt('SOMATIQUE_RETOUR', { mesureId: 'M1', date: local(2026, 3, 2, 8) }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 2, 20) })
  ]);
  let st = M.reduire(base('poursuite-service'));
  let r = M.registre(st, 'U1', 2026, local(2026, 4, 1));
  assert.deepEqual(r.map((e) => e.categorie + Math.round(e.dureeHeures)), ['A12', 'B12', 'A12']);
  assert.equal(st.mesures.M1.lieu, 'CSI 1');                                   // retour au lieu d'avant
  st = M.reduire(base('poursuite-registre', { serviceRegistre: 'SOMA' }));
  assert.deepEqual(M.registre(st, 'U1', 2026, local(2026, 4, 1)).map((e) => Math.round(e.dureeHeures)), [12, 12]);
  assert.deepEqual(M.registre(st, 'SOMA', 2026, local(2026, 4, 1)).map((e) => e.categorie + Math.round(e.dureeHeures)), ['B12']);
  st = M.reduire(base('suspension'));
  assert.equal(M.registre(st, 'U1', 2026, local(2026, 4, 1)).length, 2);
  assert.equal(Math.round(M.dureeHeures(st.mesures.M1, local(2026, 4, 1), st.config)), 24);
  assert.equal(M.suiviJLD(st, st.mesures.M1, local(2026, 3, 2, 9)).info.echeance, local(2026, 3, 3, 20));   // reportée de 12 h
});

test('Recours : décision de levée sur saisine du patient ou en appel = mainlevée', () => {
  const evts = patient('P1').concat([
    mesureIso('M1', local(2026, 3, 1, 8)),
    evt('RECOURS', { mesureId: 'M1', nature: 'SAISINE', auteur: 'Patient', date: local(2026, 3, 1, 12) }),
    evt('RECOURS', { mesureId: 'M1', nature: 'DECISION', decision: 'MAINTIEN', date: local(2026, 3, 1, 18) }),
    evt('RECOURS', { mesureId: 'M1', nature: 'APPEL', auteur: 'Avocat', date: local(2026, 3, 1, 20) }),
    evt('RECOURS', { mesureId: 'M1', nature: 'DECISION_APPEL', decision: 'LEVEE', date: local(2026, 3, 2, 10) }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 2, 11) }),
    mesureIso('M2', local(2026, 3, 3, 9))
  ]);
  const st = M.reduire(evts);
  assert.equal(st.mesures.M1.recours.length, 4);
  assert.ok(st.mesures.M1.leveeJLD);
  assert.equal(M.apresMainlevee(st, st.mesures.M2).recours, 'DECISION_APPEL');
  assert.ok(M.MOTIFS_FIN.indexOf('Décès') >= 0);
});

test('Décompte : la suspension interrompt le tableau sans s’ajouter au cumul', () => {
  const evts = patient('P1').concat([
    mesureIso('M1', local(2026, 3, 1, 8)),
    evt('SOMATIQUE', { mesureId: 'M1', date: local(2026, 3, 1, 20), lieu: 'Urgences (fictif)', mode: 'suspension' }),
    evt('SOMATIQUE_RETOUR', { mesureId: 'M1', date: local(2026, 3, 2, 8) }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 2, 20) })
  ]);
  const st = M.reduire(evts);
  const d = M.decompte(st, st.mesures.M1, local(2026, 3, 3), { tranche: 0 });
  assert.deepEqual(d.lignes.map((l) => l.statut), ['TERMINÉE', 'SUSPENDUE', 'TERMINÉE']);
  assert.equal(Math.round(d.lignes[2].cumul), 24);
  assert.match(d.lignes[2].commentaire, /Retour dans le service/);
});

// ------------------------------------------------------------------ Lot 3
test('Correction proposée par l’IDE : en attente, puis validée ou refusée par le cadre', () => {
  const debutEvts = patient('P1').concat([mesureIso('M1', local(2026, 3, 1, 8))]);
  const prop = evt('PROPOSITION', { mesureId: 'M1', champs: { debut: local(2026, 3, 1, 7) }, motif: 'heure mal saisie' });
  const base = debutEvts.concat([prop]);
  let st = M.reduire(base);
  assert.equal(M.propositionsEnAttente(st).length, 1);
  assert.equal(st.mesures.M1.debut, local(2026, 3, 1, 8));               // pas appliquée tant que non validée
  st = M.reduire(base.concat([evt('CORRECTION', { mesureId: 'M1', champs: { debut: local(2026, 3, 1, 7) }, motif: 'validée', proposition: prop.id })]));
  assert.equal(st.mesures.M1.debut, local(2026, 3, 1, 7));
  assert.equal(st.propositions[prop.id].statut, 'acceptee');
  assert.equal(M.propositionsEnAttente(st).length, 0);
  st = M.reduire(base.concat([evt('REFUS_PROPOSITION', { mesureId: 'M1', proposition: prop.id, motif: 'heure exacte' })]));
  assert.equal(st.propositions[prop.id].statut, 'refusee');
  assert.equal(st.mesures.M1.debut, local(2026, 3, 1, 8));
  assert.ok(M.peut(['IDE'], 'PROPOSITION') && !M.peut(['IDE'], 'CORRECTION') && M.peut(['CADRE'], 'REFUS_PROPOSITION'));
});

test('Patient détenu : déclencheur d’alerte', () => {
  const st = M.reduire(patient('P1', 'SDRE', { detenu: true }).concat([
    evt('CONFIG', { cle: 'alertes', valeur: [{ id: 'd', active: true, declencheur: 'detenu', nature: 'rappel' }] }),
    mesureIso('M1', local(2026, 3, 1, 8))]));
  assert.equal(st.patients.P1.detenu, true);
  assert.deepEqual(M.alertesMesure(st, st.mesures.M1).map((r) => r.id), ['d']);
  assert.match(M.alertesConfig(st.config)[0].message, /L\. 3214-1/);
});

// ------------------------------------------------------------------ Lot 4
test('Qualité : motif du recours, entretien après la mesure, motifs de fin dans les statistiques', () => {
  const evts = patient('P1').concat([
    mesureIso('M1', local(2026, 3, 1, 8), { motifRecours: 'Agitation avec mise en danger' }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 1, 20), motif: 'Décision médicale' }),
    evt('ENTRETIEN', { mesureId: 'M1', date: local(2026, 3, 2, 10), realise: true }),
    mesureIso('M2', local(2026, 3, 5, 8)),
    evt('MESURE_FIN', { mesureId: 'M2', fin: local(2026, 3, 5, 20), motif: 'Fugue (fictif)' })
  ]);
  const st = M.reduire(evts);
  assert.equal(st.mesures.M1.entretien.realise, true);
  const s = M.statistiquesAnnee(st, ['U1'], 2026, local(2026, 6, 1));
  assert.equal(s.motifsRecours['Agitation avec mise en danger'], 1);
  assert.equal(s.motifsRecours['Non renseigné'], 1);
  assert.deepEqual(s.entretiens, { realises: 1, nonRealises: 0, nonRenseignes: 1 });
  assert.equal(s.motifsFin.Fugue, 1);
  assert.equal(M.optionsQualite({}).nomEntretien, 'Entretien après la mesure');
  assert.equal(M.optionsQualite({ qualite: { nomEntretien: 'Débriefing post-isolement' } }).nomEntretien, 'Débriefing post-isolement');
});

test('Surveillance hors CSI : postes à compléter et professionnels au registre (option)', () => {
  const evts = patient('P1').concat([
    evt('MESURE_DEBUT', { mesureId: 'M1', patientId: 'P1', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: false, lieu: 'Chambre 4' }),
    evt('MESURE_FIN', { mesureId: 'M1', fin: local(2026, 3, 1, 12) }),
    evt('PROFESSIONNEL', { service: 'U1', date: '2026-03-01', periode: 'M', nom: 'Agent X (fictif)', fonction: 'IDE' })
  ]);
  let st = M.reduire(evts);
  assert.equal(M.postesSurveillance(st, 'U1', local(2026, 3, 1, 13), 2).length, 0);
  assert.equal(M.registre(st, 'U1', 2026, local(2026, 4, 1))[0].professionnels.length, 0);
  st = M.reduire(evts.concat([evt('CONFIG', { cle: 'qualite', valeur: { surveillanceHorsCSI: true } })]));
  assert.equal(M.postesSurveillance(st, 'U1', local(2026, 3, 1, 13), 2).length, 1);
  assert.deepEqual(M.registre(st, 'U1', 2026, local(2026, 4, 1))[0].professionnels, ['Agent X (fictif) (IDE)']);
});

test('Droit d’accès et conservation', () => {
  const evts = patient('P1').concat(patient('P2'), [
    mesureIso('M1', local(2020, 3, 1, 8)), evt('MESURE_FIN', { mesureId: 'M1', fin: local(2020, 3, 1, 20) }),
    evt('MESURE_DEBUT', { mesureId: 'M2', patientId: 'P2', service: 'U1', typeMesure: 'Isolement', debut: local(2026, 3, 1, 8), csi: true })
  ]);
  const st = M.reduire(evts);
  const d = M.donneesPatient(st, 'P1', local(2026, 4, 1));
  assert.equal(d.mesures.length, 1); assert.equal(d.registre.length, 1);
  assert.deepEqual(M.auDelaConservation(st, 5, local(2026, 4, 1)).map((x) => x.patient.id), ['P1']);
  assert.deepEqual(M.auDelaConservation(st, 0, local(2026, 4, 1)), []);
});
