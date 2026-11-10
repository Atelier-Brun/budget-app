// Sauvegarde / restauration : format, contrôles, aller-retour. Données FICTIVES ; itérations réduites.
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { creerCoffre, ouvrirAvecCode, versB64 } from './coffre.ts';
import { genererDemo } from './demo.ts';
import { creerFichier, dechiffrerTout, lireFichier, nomFichier, valider, type Donnees } from './sauvegarde.ts';
import { chiffrer, versB64 as b64 } from './coffre.ts';
import { DONNEES, lireBrut, ouvrirBase, remplacer, type Clair } from './stockage.ts';

const JOUR = '2026-11-10';
const fictif = (): Donnees => ({ ...genererDemo(JOUR), meta: [{ cle: 'derniere-saisie' }] });

async function preparer() {
  const { coffre, cle, secours } = await creerCoffre('48021573', 1000);
  const db = await ouvrirBase('t', () => {}, undefined, new IDBFactory());
  const donnees = fictif();
  await remplacer(db, cle, donnees as unknown as Clair, coffre);
  const texte = await creerFichier(cle, coffre, await lireBrut(db), JOUR, false);
  return { coffre, cle, secours, donnees, texte, db };
}

describe('sauvegarde', () => {
  it('nom du fichier', () => {
    expect(nomFichier(JOUR, false)).toBe('budget-sauvegarde-2026-11-10.json');
    expect(nomFichier(JOUR, true)).toBe('budget-demo-sauvegarde-2026-11-10.json');
  });

  it('aller-retour : fichier → code → données identiques ; aucune donnée en clair dans le fichier', async () => {
    const { texte, donnees } = await preparer();
    // Les blocs base64 (chiffrés) sont retirés : ils peuvent contenir ces lettres par hasard.
    expect(texte.replace(/"[A-Za-z0-9+/=]{12,}"/g, '""')).not.toMatch(/FICTI|COURANT|EPARGNE|montant|nom/i);
    const f = lireFichier(texte);
    expect(f.date).toBe(JOUR);
    const lu = await dechiffrerTout(await ouvrirAvecCode(f.coffre, '48021573'), f.donnees, { date: f.date, chiffre: f.resume });
    const tri = (d: Donnees) => JSON.stringify(DONNEES.map((m) => d[m]).map((l: { id?: string; cle?: string }[]) => [...l].sort((a, b) => ((a.id ?? a.cle)! < (b.id ?? b.cle)! ? -1 : 1))));
    expect(tri(lu)).toBe(tri(donnees));
  });

  it('fichier étranger, abîmé ou trop récent : refus clair', async () => {
    const { texte } = await preparer();
    for (const t of ['', 'pas du json', '{}', '[]', JSON.stringify({ format: 'autre' }), texte.replace('"iv":"', '"iv":"!!')])
      expect(() => lireFichier(t)).toThrow('Fichier non reconnu');
    expect(() => lireFichier(texte.replace('"version":1', '"version":2'))).toThrow('version plus récente');
    expect(() => lireFichier(texte.replace('"iterations":1000', '"iterations":0'))).toThrow('Fichier non reconnu');
  });

  it('opération retirée ou enregistrement abîmé : refus, rien n’est proposé', async () => {
    const { texte, cle } = await preparer();
    const f = lireFichier(texte);
    const moins = { ...f.donnees, operations: f.donnees.operations.slice(1) };
    await expect(dechiffrerTout(cle, moins, { date: f.date, chiffre: f.resume })).rejects.toThrow('Contenu de la sauvegarde invalide');
    const abime = JSON.parse(texte);
    abime.donnees.comptes[0].d = versB64(new Uint8Array(40));
    const g = lireFichier(JSON.stringify(abime));
    await expect(dechiffrerTout(cle, g.donnees, { date: g.date, chiffre: g.resume })).rejects.toThrow('Contenu de la sauvegarde invalide');
  });

  it('contrôle du contenu : liens, bornes, types', () => {
    const d = fictif();
    expect(valider(d as unknown as Clair)).toBe(d);
    const casser: ((x: Donnees) => void)[] = [
      (x) => (x.operations[0]!.compteId = 'absent'),
      (x) => (x.operations[0]!.montant = -5),
      (x) => (x.operations[0]!.categorieId = 'absente'),
      (x) => (x.operations[0]!.note = 'x'.repeat(500)),
      (x) => (x.comptes[0]!.nom = ''),
      (x) => ((x.comptes[0] as { type: string }).type = 'autre'),
      (x) => (x.categories[0]!.sens = 'aucun' as 'debit'),
      (x) => x.comptes.push({ ...x.comptes[0]! }),
      (x) => ((x.meta as unknown[]).push(null)),
      (x) => ((x as unknown as { comptes: null }).comptes = null),
    ];
    for (const c of casser) {
      const x = structuredClone(fictif());
      c(x);
      expect(() => valider(x as unknown as Clair)).toThrow('Contenu de la sauvegarde invalide');
    }
  });
});

describe('compatibilité 0.3.0', () => {
  it('fichier de la 0.3.0 (sans échéancier, résumé sans échéances) : accepté, échéancier vide', async () => {
    const { texte, cle, donnees } = await preparer();
    const f = JSON.parse(texte);
    delete f.donnees.echeances;
    const { echeances: _, ...nb } = Object.fromEntries(DONNEES.map((m) => [m, f.donnees[m]?.length ?? 0]));
    const r = await chiffrer(cle, 'resume', JOUR, { date: JOUR, nb });
    f.resume = { iv: b64(r.iv), d: b64(r.d) };
    const lu = lireFichier(JSON.stringify(f));
    const d = await dechiffrerTout(cle, lu.donnees, { date: lu.date, chiffre: lu.resume });
    expect(d.echeances).toEqual([]);
    expect(d.operations).toHaveLength(donnees.operations.length);
  });

  it('échéance invalide ou liée à un compte absent : refus', () => {
    for (const casser of [(x: Donnees) => (x.echeances[0]!.compteId = 'absent'), (x: Donnees) => (x.echeances[0]!.prochaine = -1), (x: Donnees) => (x.echeances[0]!.montant = 0)]) {
      const x = structuredClone(fictif());
      casser(x);
      expect(() => valider(x as unknown as Clair)).toThrow('Contenu de la sauvegarde invalide');
    }
  });
});
