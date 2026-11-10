// Données FICTIVES uniquement. fake-indexeddb : IndexedDB conforme à la norme, pour les tests seulement.
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  demanderPersistance,
  ecrire,
  ErreurStockage,
  lireTout,
  MIGRATIONS,
  ouvrirBase,
  traduire,
  type Migration,
} from './stockage.ts';

let fabrique: IDBFactory;
beforeEach(() => {
  fabrique = new IDBFactory(); // base vierge à chaque test
});

const ouvrir = (migrations: readonly Migration[] = MIGRATIONS, surObsolete = () => {}) =>
  ouvrirBase('test', surObsolete, migrations, fabrique);

const codeDe = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: unknown) => (e instanceof ErreurStockage ? e.code : 'autre'),
  );

const v1: Migration = (db) => {
  db.createObjectStore('a', { keyPath: 'id' });
};
const v2: Migration = (_db, tx) => {
  // migration fictive : transforme les données existantes sans rien supprimer
  const magasin = tx.objectStore('a');
  const req = magasin.getAll();
  req.onsuccess = () => {
    for (const x of req.result as { id: string; n: number }[]) magasin.put({ ...x, double: x.n * 2 });
  };
};
const casse: Migration = () => {
  throw new Error('migration fictive en échec');
};

describe('ouvrirBase', () => {
  it('v1 : crée les 4 magasins', async () => {
    const db = await ouvrir(MIGRATIONS.slice(0, 1));
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames].sort()).toEqual(['categories', 'comptes', 'meta', 'operations']);
    db.close();
  });

  it('applique seulement les migrations manquantes, données existantes conservées', async () => {
    const espion = vi.fn(v1);
    let db = await ouvrir([espion]);
    await ecrire(db, ['a'], (tx) => {
      tx.objectStore('a').put({ id: 'x', n: 21 });
      tx.objectStore('a').put({ id: 'y', n: 5 });
    });
    db.close();

    db = await ouvrir([espion, v2]);
    expect(db.version).toBe(2);
    expect(espion).toHaveBeenCalledTimes(1);
    expect(await lireTout(db, 'a')).toEqual([
      { id: 'x', n: 21, double: 42 },
      { id: 'y', n: 5, double: 10 },
    ]);
    db.close();
  });

  it('migration en échec : tout est annulé, version et données intactes', async () => {
    let db = await ouvrir([v1]);
    await ecrire(db, ['a'], (tx) => void tx.objectStore('a').put({ id: 'x', n: 1 }));
    db.close();

    expect(await codeDe(ouvrir([v1, casse]))).toBe('migration');

    db = await ouvrir([v1]);
    expect(db.version).toBe(1);
    expect(await lireTout(db, 'a')).toEqual([{ id: 'x', n: 1 }]);
    db.close();
  });

  it('base plus récente que le code : refus clair, rien d’effacé', async () => {
    const db = await ouvrir([v1, v2]);
    db.close();
    expect(await codeDe(ouvrir([v1]))).toBe('trop-recente');
  });

  it('nouvelle version demandée ailleurs : l’ancienne connexion se ferme et prévient', async () => {
    const surObsolete = vi.fn();
    await ouvrir([v1], surObsolete);
    const db = await ouvrir([v1, v2]); // réussit car l'ancienne connexion s'est fermée
    expect(surObsolete).toHaveBeenCalledOnce();
    expect(db.version).toBe(2);
    db.close();
  });

  it('bloquée par une connexion qui ne se ferme pas : erreur claire, connexion tardive refermée', async () => {
    const brute = await new Promise<IDBDatabase>((ok) => {
      const r = fabrique.open('test', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('a', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
    });
    expect(await codeDe(ouvrir([v1, v2]))).toBe('bloquee');
    brute.close(); // l'ouverture se termine en arrière-plan, puis est refermée
    await new Promise((r) => setTimeout(r, 20));
    const db = await ouvrir([v1, v2]);
    expect(db.version).toBe(2);
    db.close();
  });
});

describe('ecrire', () => {
  it('tout ou rien : une erreur au milieu annule aussi ce qui précède', async () => {
    const db = await ouvrir([v1]);
    await ecrire(db, ['a'], (tx) => void tx.objectStore('a').add({ id: 'x', n: 1 }));
    const code = await codeDe(
      ecrire(db, ['a'], (tx) => {
        tx.objectStore('a').add({ id: 'y', n: 2 });
        tx.objectStore('a').add({ id: 'x', n: 3 }); // doublon → échec
      }),
    );
    expect(code).toBe('doublon');
    expect(await lireTout(db, 'a')).toEqual([{ id: 'x', n: 1 }]);
    db.close();
  });

  it('exception dans le travail : rien n’est écrit', async () => {
    const db = await ouvrir([v1]);
    const code = await codeDe(
      ecrire(db, ['a'], (tx) => {
        tx.objectStore('a').put({ id: 'y', n: 2 });
        throw new Error('fictive');
      }),
    );
    expect(code).toBe('inconnue');
    expect(await lireTout(db, 'a')).toEqual([]);
    db.close();
  });

  it('lecture d’un magasin inexistant : erreur', async () => {
    const db = await ouvrir([v1]);
    await expect(lireTout(db, 'absent')).rejects.toThrow();
    db.close();
  });
});

describe('traduire', () => {
  it('messages clairs selon l’erreur du navigateur, sans détail technique', () => {
    expect(traduire(new DOMException('x', 'QuotaExceededError')).code).toBe('plein');
    expect(traduire(new DOMException('x', 'ConstraintError')).message).toBe('Déjà enregistré : rien n’a été modifié.');
    expect(traduire(new DOMException('x', 'VersionError')).code).toBe('trop-recente');
    expect(traduire(null).code).toBe('inconnue');
    const e = traduire(new DOMException('détail interne', 'UnknownError'));
    expect(e.message).toBe('Erreur de stockage. Rien n’a été effacé.');
    expect(traduire(e)).toBe(e);
  });
});

describe('demanderPersistance', () => {
  const stockage = (persisted: boolean, persist: boolean | 'erreur') =>
    ({
      persisted: vi.fn(async () => persisted),
      persist: vi.fn(async () => {
        if (persist === 'erreur') throw new Error('fictive');
        return persist;
      }),
    }) as unknown as StorageManager;

  it('déjà persistant : ne redemande pas', async () => {
    const s = stockage(true, false);
    expect(await demanderPersistance(s)).toBe(true);
    expect(s.persist).not.toHaveBeenCalled();
  });
  it('demande, accordée ou refusée', async () => {
    expect(await demanderPersistance(stockage(false, true))).toBe(true);
    expect(await demanderPersistance(stockage(false, false))).toBe(false);
  });
  it('non disponible ou en erreur : faux, sans planter', async () => {
    expect(await demanderPersistance(undefined)).toBe(false);
    expect(await demanderPersistance({} as StorageManager)).toBe(false);
    expect(await demanderPersistance(stockage(false, 'erreur'))).toBe(false);
  });
});

describe('stockage chiffré (0.3.0)', async () => {
  const { creerCoffre } = await import('./coffre.ts');
  const { copierInterne, COPIES_MAX, ecrireChiffre, lireBrut, lireChiffre, remplacer } = await import('./stockage.ts');

  it('v2 puis v3 : ajoutent coffre, copies, échéances sans toucher aux données v1', async () => {
    const db1 = await ouvrir(MIGRATIONS.slice(0, 1));
    await ecrire(db1, ['comptes'], (tx) => void tx.objectStore('comptes').put({ id: 'a', nom: 'FICTIF' }));
    db1.close();
    const db = await ouvrir();
    expect([...db.objectStoreNames].sort()).toEqual(['categories', 'coffre', 'comptes', 'copies', 'echeances', 'meta', 'operations']);
    expect(await lireTout(db, 'comptes')).toEqual([{ id: 'a', nom: 'FICTIF' }]);
    db.close();
  });

  it('chiffrement initial des données 0.2.0, puis écriture/lecture chiffrées ; tout ou rien', async () => {
    const db = await ouvrir();
    await ecrire(db, ['comptes', 'meta'], (tx) => {
      tx.objectStore('comptes').put({ id: 'a', nom: 'COMPTE FICTIF' });
      tx.objectStore('meta').put({ cle: 'derniere-saisie', compteId: 'a' });
    });
    const { coffre, cle } = await creerCoffre('48021573', 1000);
    const clair = { comptes: await lireTout<object>(db, 'comptes'), categories: [], operations: [], meta: await lireTout<object>(db, 'meta'), echeances: [] };
    await remplacer(db, cle, clair, coffre);
    const brut = await lireBrut(db);
    expect(Object.keys(brut.comptes[0]!).sort()).toEqual(['d', 'id', 'iv']);
    expect(JSON.stringify(brut)).not.toContain('FICTIF');
    expect(await lireChiffre(db, cle, 'comptes')).toEqual([{ id: 'a', nom: 'COMPTE FICTIF' }]);
    expect(await lireChiffre(db, cle, 'meta')).toEqual([{ cle: 'derniere-saisie', compteId: 'a' }]);
    expect((await lireTout(db, 'coffre'))[0]).toMatchObject({ cle: 'coffre', iterations: 1000 });

    await ecrireChiffre(db, cle, ['comptes'], (tx) => {
      tx.objectStore('comptes').add({ id: 'b', nom: 'B' });
      tx.objectStore('comptes').delete('a');
    });
    expect(await lireChiffre(db, cle, 'comptes')).toEqual([{ id: 'b', nom: 'B' }]);
    // doublon → tout est annulé
    await expect(
      ecrireChiffre(db, cle, ['comptes'], (tx) => {
        tx.objectStore('comptes').add({ id: 'c', nom: 'C' });
        tx.objectStore('comptes').add({ id: 'b', nom: 'B2' });
      }),
    ).rejects.toThrow();
    await expect(ecrireChiffre(db, cle, ['comptes'], () => { throw new Error('fictive'); })).rejects.toBeInstanceOf(ErreurStockage);
    await expect(ecrireChiffre(db, cle, ['comptes'], (tx) => tx.objectStore('comptes').put({ nom: 'sans id' }))).rejects.toThrow();
    await ecrireChiffre(db, cle, ['comptes'], (tx) => tx.objectStore('comptes').clear());
    expect(await lireChiffre(db, cle, 'comptes')).toEqual([]);
    db.close();
  });

  it(`copies internes : contenu brut chiffré, ${COPIES_MAX} plus récentes gardées`, async () => {
    const db = await ouvrir();
    const { coffre, cle } = await creerCoffre('48021573', 1000);
    await remplacer(db, cle, { comptes: [{ id: 'a', nom: 'X' }], categories: [], operations: [], meta: [], echeances: [] }, coffre);
    for (let i = 1; i <= 9; i++) await copierInterne(db, new Date(Date.UTC(2026, 10, i)));
    const copies = await lireTout<{ id: string; donnees: { comptes: unknown[] } }>(db, 'copies');
    expect(copies.map((c) => c.id.slice(0, 10))).toEqual(['03', '04', '05', '06', '07', '08', '09'].map((j) => `2026-11-${j}`));
    expect(copies[0]!.donnees.comptes).toEqual((await lireBrut(db)).comptes);
    db.close();
  });
});

describe('mise à jour 0.3.0 → 0.4.0', async () => {
  const { creerCoffre } = await import('./coffre.ts');
  const { copierAvantMigration, lireChiffre, remplacer, lireBrut } = await import('./stockage.ts');

  it('copie interne AVANT la migration, puis données chiffrées v2 relues sans perte en v3', async () => {
    const v2 = MIGRATIONS.slice(0, 2);
    const db2 = await ouvrir(v2);
    const { coffre, cle } = await creerCoffre('48021573', 1000);
    const clair = { comptes: [{ id: 'a', nom: 'FICTIF' }], categories: [{ id: 'k', nom: 'K' }], operations: [{ id: 'o', compteId: 'a' }], meta: [{ cle: 'derniere-saisie', compteId: 'a' }] };
    // Écriture exactement comme la 0.3.0 (sans magasin echeances).
    await ecrire(db2, ['coffre'], (tx) => void tx.objectStore('coffre').put(coffre));
    const { sceller } = await import('./stockage.ts');
    for (const [m, l] of Object.entries(clair)) {
      const s = await Promise.all(l.map((v) => sceller(cle, m, v)));
      await ecrire(db2, [m], (tx) => s.forEach((v) => tx.objectStore(m).put(v)));
    }
    const avant = await lireBrut(db2);
    expect(avant.echeances).toEqual([]); // magasin absent en v2 : lu comme vide
    db2.close();

    expect(await copierAvantMigration('test', MIGRATIONS.length, fabrique)).toBe(true);
    const db = await ouvrir();
    expect(db.version).toBe(3);
    const copies = await lireTout<{ donnees: Record<string, unknown[]> }>(db, 'copies');
    expect(copies).toHaveLength(1);
    expect(copies[0]!.donnees['operations']).toEqual(avant.operations);
    for (const [m, l] of Object.entries(clair)) expect(await lireChiffre(db, cle, m as 'comptes')).toEqual(l);
    expect(await lireChiffre(db, cle, 'echeances')).toEqual([]);
    expect(await copierAvantMigration('test', MIGRATIONS.length, fabrique)).toBe(false); // déjà à jour : rien
    await remplacer(db, cle, { ...clair, echeances: [{ id: 'e' }] });
    expect(await lireChiffre(db, cle, 'echeances')).toEqual([{ id: 'e' }]);
    db.close();
  });

  it('pas de copie si la base n’existe pas encore ou n’a pas de copies (v1)', async () => {
    expect(await copierAvantMigration('absente', MIGRATIONS.length, fabrique)).toBe(false);
    expect([...(await fabrique.databases())].map((d) => d.name)).not.toContain('absente');
    const db1 = await ouvrir(MIGRATIONS.slice(0, 1));
    db1.close();
    expect(await copierAvantMigration('test', MIGRATIONS.length, fabrique)).toBe(false);
  });
});
