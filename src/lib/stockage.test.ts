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
    const db = await ouvrir();
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
    expect(code).toBe('inconnue');
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
