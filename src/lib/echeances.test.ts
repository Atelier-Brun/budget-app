// Échéancier, prévisionnel, pointage. Données FICTIVES.
import { describe, expect, it } from 'vitest';
import type { Compte } from './comptes.ts';
import { aValider, dateOccurrence, idOperation, occurrence, occurrencesJusqua, prochaine, rebaser, verifierEcheance, type Echeance } from './echeances.ts';
import { pointageDu } from './pointage.ts';
import { finDeMois, prevoir } from './previsionnel.ts';
import type { Operation } from './soldes.ts';

const ech = (x: Partial<Echeance> = {}): Echeance => ({
  id: 'e1', nom: 'LOYER FICTIF', compteId: 'c1', categorieId: 'k1', sens: 'debit', montant: 50_000,
  frequence: 'mensuelle', debut: '2026-01-31', fin: { type: 'aucune' }, prochaine: 0, archive: false, ...x,
});

/** Échéance sans catégorie (compte tiers). */
const sansCategorie = (): Echeance => {
  const e = ech();
  delete e.categorieId;
  return e;
};

describe('échéances', () => {
  it('jour fixe : 31 → dernier jour du mois, années bissextiles', () => {
    const e = ech();
    expect([0, 1, 2, 3, 12, 13].map((n) => dateOccurrence(e, n))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2027-01-31', '2027-02-28']);
    expect(dateOccurrence(ech({ debut: '2028-01-30' }), 1)).toBe('2028-02-29');
  });

  it('toutes les 4 semaines : +28 jours', () => {
    const e = ech({ frequence: '28j', debut: '2026-12-20' });
    expect([0, 1, 2].map((n) => dateOccurrence(e, n))).toEqual(['2026-12-20', '2027-01-17', '2027-02-14']);
  });

  it('fin par nombre ou par date ; dernière échéance de montant différent', () => {
    const e = ech({ fin: { type: 'nombre', nombre: 3 }, dernierMontant: 12_345 });
    expect([0, 1, 2].map((n) => occurrence(e, n)!.montant)).toEqual([50_000, 50_000, 12_345]);
    expect(occurrence(e, 3)).toBeNull();
    const d = ech({ debut: '2026-11-05', fin: { type: 'date', date: '2027-01-05' }, dernierMontant: 1 });
    expect(occurrencesJusqua(d, '2030-01-01').map((o) => [o.date, o.montant])).toEqual([['2026-11-05', 50_000], ['2026-12-05', 50_000], ['2027-01-05', 1]]);
    expect(occurrence(ech(), -1)).toBeNull();
  });

  it('à valider : seulement à partir du jour J, retards dans l’ordre, jamais si arrêtée', () => {
    const e = ech({ debut: '2026-11-12' });
    expect(aValider(e, '2026-11-11')).toBeNull();
    expect(aValider(e, '2026-11-12')).toEqual({ n: 0, date: '2026-11-12', montant: 50_000 });
    expect(aValider({ ...e, prochaine: 1 }, '2027-01-20')!.date).toBe('2026-12-12');
    expect(occurrencesJusqua({ ...e, prochaine: 1 }, '2027-01-20')).toHaveLength(2);
    expect(aValider({ ...e, archive: true }, '2027-01-20')).toBeNull();
    expect(prochaine({ ...e, archive: true })).toBeNull();
    expect(prochaine({ ...e, prochaine: 2 })!.date).toBe('2027-01-12');
  });

  it('identifiant d’opération fixe (une seule validation possible)', () => {
    expect(idOperation(ech(), { date: '2026-11-12' })).toBe('ech-e1-2026-11-12');
  });

  it('rebaser : la prochaine devient n° 0, nombre restant conservé', () => {
    const e = ech({ debut: '2026-01-10', fin: { type: 'nombre', nombre: 12 }, prochaine: 10 });
    const r = rebaser(e, '2026-11-15');
    expect(r).toMatchObject({ debut: '2026-11-15', prochaine: 0, fin: { type: 'nombre', nombre: 2 } });
    expect(rebaser(ech(), '2026-02-01')).toMatchObject({ debut: '2026-02-01', prochaine: 0 });
    expect(rebaser(ech({ prochaine: 3 }), '2026-02-01').fin).toEqual({ type: 'aucune' });
  });

  it('contrôles clairs', () => {
    expect(verifierEcheance(ech(), 'courant')).toBeNull();
    expect(verifierEcheance(sansCategorie(), 'tiers')).toBeNull();
    expect(verifierEcheance(sansCategorie(), 'courant')).toBe('Catégorie obligatoire.');
    const cas: [Partial<Echeance>, string | undefined, string][] = [
      [{ nom: '' }, 'courant', 'Libellé obligatoire.'],
      [{ nom: 'X'.repeat(31) }, 'courant', 'Libellé : 30'],
      [{}, undefined, 'Compte obligatoire.'],
      [{ montant: 0 }, 'courant', 'Montant invalide.'],
      [{ debut: '2026-02-30' }, 'courant', 'invalide'],
      [{ fin: { type: 'nombre', nombre: 0 } }, 'courant', 'Nombre d’échéances invalide'],
      [{ fin: { type: 'date', date: '2025-01-01' } }, 'courant', 'Date de fin invalide'],
      [{ dernierMontant: 100 }, 'courant', 'une fin (nombre ou date) est nécessaire'],
      [{ fin: { type: 'nombre', nombre: 2 }, dernierMontant: -1 }, 'courant', 'dernière échéance invalide'],
    ];
    for (const [x, type, msg] of cas) expect(verifierEcheance(ech(x), type)).toContain(msg);
  });
});

describe('prévisionnel', () => {
  const compte = (x: Partial<Compte>): Compte => ({ id: 'c1', nom: 'C', type: 'courant', soldeDepart: 100_00, dateDepart: '2026-11-01', archive: false, principal: true, ...x });
  const op = (x: Partial<Operation>): Operation => ({ compteId: 'c1', date: '2026-11-05', sens: 'debit', montant: 10_00, ...x });

  it('fin de mois', () => {
    expect(finDeMois('2026-11-10')).toBe('2026-11-30');
    expect(finDeMois('2028-02-03')).toBe('2028-02-29');
  });

  it('solde du jour + opérations futures + échéances non validées (retards aujourd’hui) ; point bas et alerte', () => {
    const p = prevoir(
      [compte({}), compte({ id: 't', type: 'tiers', soldeDepart: 0 }), compte({ id: 'a', archive: true })],
      [op({}), op({ date: '2026-11-20', sens: 'credit', montant: 200_00 }), op({ date: '2026-12-02', montant: 999_00 })],
      [ech({ montant: 150_00, debut: '2026-11-15' }), ech({ id: 'e2', montant: 5_00, debut: '2026-11-01', frequence: '28j' }), ech({ id: 'e3', compteId: 't', debut: '2026-11-12', montant: 1_00 })],
      '2026-11-10',
    );
    // 100 − 10 = 90 aujourd'hui ; retard −5 (aujourd'hui) → 85 ; 15/11 −150 → −65 ; 20/11 +200 → 135 ; 29/11 −5 → 130
    expect(p.get('c1')).toEqual({ fin: 130_00, min: -65_00, dateMin: '2026-11-15', alerte: true });
    expect(p.get('t')).toEqual({ fin: -1_00, min: -1_00, dateMin: '2026-11-12', alerte: false }); // tiers : jamais d'alerte
    expect(p.has('a')).toBe(false);
  });

  it('même jour : débit compté avant crédit (prudent) ; sans événement : solde du jour', () => {
    const p = prevoir([compte({ soldeDepart: 0 })], [op({ date: '2026-11-20', sens: 'credit', montant: 60_00 }), op({ date: '2026-11-20', montant: 40_00 })], [], '2026-11-10');
    expect(p.get('c1')).toMatchObject({ fin: 20_00, min: -40_00, alerte: true });
    expect(prevoir([compte({})], [], [], '2026-11-10').get('c1')).toEqual({ fin: 100_00, min: 100_00, dateMin: '2026-11-10', alerte: false });
  });
});

describe('pointage', () => {
  it('rappel du vendredi au dimanche, masqué si pointage fait depuis le lundi', () => {
    expect(pointageDu(null, '2026-11-12')).toBe(false); // jeudi : jamais
    expect(pointageDu('2026-11-06', '2026-11-16')).toBe(false); // lundi : jamais, même en retard
    expect(pointageDu(null, '2026-11-13')).toBe(true); // vendredi
    expect(pointageDu('2026-11-06', '2026-11-14')).toBe(true); // samedi, dernier pointage la semaine d'avant
    expect(pointageDu('2026-11-08', '2026-11-15')).toBe(true); // dimanche ; le 08 était le dimanche précédent
    expect(pointageDu('2026-11-09', '2026-11-15')).toBe(false); // fait le lundi de la semaine
    expect(pointageDu('2026-11-11', '2026-11-13')).toBe(false); // fait le mercredi
    expect(pointageDu('2026-11-13', '2026-11-13')).toBe(false); // fait le jour même
    expect(pointageDu(null, '2026-12-31')).toBe(false); // jeudi, changement de mois
    expect(pointageDu('2026-12-27', '2027-01-01')).toBe(true); // vendredi, changement d'année
    expect(pointageDu('2026-12-28', '2027-01-01')).toBe(false);
  });
});
