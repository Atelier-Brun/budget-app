// Stockage IndexedDB natif : base versionnée, migrations appliquées dans l'ordre, écritures « tout ou rien ».
// Règle absolue : aucune migration n'efface de données ; une migration qui échoue annule tout (version inchangée).
import { chiffrer, dechiffrer, type Chiffre } from './coffre.ts';

export type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

/** Migration n° i : passe la base de la version i à la version i + 1. Ne jamais modifier une migration publiée. */
export const MIGRATIONS: readonly Migration[] = [
  // v1 (0.1.3) : magasins de base, clés = identifiants crypto.randomUUID().
  (db) => {
    db.createObjectStore('comptes', { keyPath: 'id' });
    db.createObjectStore('categories', { keyPath: 'id' });
    db.createObjectStore('operations', { keyPath: 'id' });
    db.createObjectStore('meta', { keyPath: 'cle' });
  },
  // v2 (0.3.0) : coffre (clés enfermées, essais) et copies internes. Ne touche à aucune donnée existante.
  (db) => {
    db.createObjectStore('coffre', { keyPath: 'cle' });
    db.createObjectStore('copies', { keyPath: 'id' });
  },
  // v3 (0.4.0) : échéancier. Ne touche à aucune donnée existante.
  (db) => {
    db.createObjectStore('echeances', { keyPath: 'id' });
  },
];

export type CodeErreur = 'bloquee' | 'trop-recente' | 'migration' | 'plein' | 'doublon' | 'inconnue';

/** Erreur au message fixe, montrable tel quel : ne contient jamais de donnée. */
export class ErreurStockage extends Error {
  constructor(
    readonly code: CodeErreur,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<CodeErreur, string> = {
  bloquee: 'BAARA est ouvert dans une autre fenêtre avec une ancienne version : fermez-la puis rouvrez l’app.',
  'trop-recente': 'Ces données viennent d’une version plus récente de BAARA : mettez l’app à jour. Rien n’a été effacé.',
  migration: 'La mise à jour des données a échoué : rien n’a été modifié.',
  plein: 'Espace de stockage plein sur l’appareil : libérez de la place. Rien n’a été effacé.',
  doublon: 'Déjà enregistré : rien n’a été modifié.',
  inconnue: 'Erreur de stockage. Rien n’a été effacé.',
};

const erreur = (code: CodeErreur) => new ErreurStockage(code, MESSAGES[code]);

/** Traduit une erreur du navigateur en erreur au message clair. */
export function traduire(e: unknown): ErreurStockage {
  if (e instanceof ErreurStockage) return e;
  const nom = (e as { name?: unknown } | null)?.name;
  return erreur(nom === 'VersionError' ? 'trop-recente' : nom === 'QuotaExceededError' ? 'plein' : nom === 'ConstraintError' ? 'doublon' : 'inconnue');
}

/**
 * Ouvre (et met à jour si besoin) la base. surObsolete est appelé si une version plus récente
 * de l'app demande la base ailleurs : la connexion est alors fermée pour la laisser passer.
 */
export function ouvrirBase(
  nom: string,
  surObsolete: () => void,
  migrations: readonly Migration[] = MIGRATIONS,
  fabrique: IDBFactory = indexedDB,
): Promise<IDBDatabase> {
  return new Promise((ok, echec) => {
    let abandon = false;
    let migrationEchouee = false;
    const req = fabrique.open(nom, migrations.length);
    req.onupgradeneeded = (e) => {
      const tx = req.transaction!;
      try {
        for (let v = e.oldVersion; v < migrations.length; v++) migrations[v]!(req.result, tx);
      } catch {
        migrationEchouee = true;
        tx.abort();
      }
    };
    req.onblocked = () => {
      abandon = true;
      echec(erreur('bloquee'));
    };
    req.onerror = () => echec(migrationEchouee ? erreur('migration') : traduire(req.error));
    req.onsuccess = () => {
      const db = req.result;
      if (abandon) return db.close(); // ouverture arrivée trop tard : déjà signalée comme bloquée
      db.onversionchange = () => {
        db.close();
        surObsolete();
      };
      ok(db);
    };
  });
}

/**
 * Écriture « tout ou rien » : résolue seulement quand tout est enregistré (complete),
 * rejetée et entièrement annulée à la moindre erreur.
 */
export function ecrire(db: IDBDatabase, magasins: string[], travail: (tx: IDBTransaction) => void): Promise<void> {
  return new Promise((ok, echec) => {
    // durability « strict » : confirmation après écriture sur le disque (ignorée si non gérée).
    const tx = db.transaction(magasins, 'readwrite', { durability: 'strict' });
    tx.oncomplete = () => ok();
    tx.onabort = () => echec(traduire(tx.error));
    try {
      travail(tx);
    } catch (e) {
      tx.abort();
      echec(traduire(e));
    }
  });
}

/** Lit tout le contenu d'un magasin. */
export function lireTout<T>(db: IDBDatabase, magasin: string): Promise<T[]> {
  return new Promise((ok, echec) => {
    const req = db.transaction(magasin).objectStore(magasin).getAll();
    req.onsuccess = () => ok(req.result as T[]);
    req.onerror = () => echec(traduire(req.error));
  });
}

/** Demande que les données ne soient jamais effacées par le navigateur. Vrai si c'est accordé. */
export async function demanderPersistance(storage: StorageManager | undefined = navigator.storage): Promise<boolean> {
  if (!storage?.persist) return false;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}

// ——— Données chiffrées (0.3.0) ———
// Magasins de données : chaque enregistrement est stocké { clé, iv, d } (seule la clé, un UUID ou un nom
// technique, reste lisible). Le coffre (clés enfermées, essais) et les copies (déjà chiffrées) sont à part.

export const DONNEES = ['comptes', 'categories', 'operations', 'meta', 'echeances'] as const;
export type Magasin = (typeof DONNEES)[number];
export type Scelle = Chiffre & { id?: string; cle?: string };
export type Brut = Record<Magasin, Scelle[]>;
export type Clair = Record<Magasin, object[]>;

const champCle = (m: string) => (m === 'meta' ? 'cle' : 'id');

/** Ce que voit un travail d'écriture : les actions sont notées, chiffrées, puis rejouées dans une seule transaction. */
export interface Tx {
  objectStore(nom: string): { put(v: object): void; add(v: object): void; delete(k: string): void; clear(): void };
}

export async function sceller(cle: CryptoKey, magasin: string, valeur: object): Promise<Scelle> {
  const champ = champCle(magasin);
  const id = (valeur as Record<string, unknown>)[champ];
  if (typeof id !== 'string') throw erreur('inconnue');
  return { [champ]: id, ...(await chiffrer(cle, magasin, id, valeur)) };
}

/** Écriture chiffrée « tout ou rien » : le chiffrement (asynchrone) a lieu avant d'ouvrir la transaction. */
export async function ecrireChiffre(db: IDBDatabase, cle: CryptoKey, magasins: string[], travail: (tx: Tx) => void): Promise<void> {
  type Action = { m: string; a: 'put' | 'add' | 'delete' | 'clear'; v?: unknown };
  const actions: Action[] = [];
  try {
    travail({
      objectStore: (m) => ({
        put: (v) => void actions.push({ m, a: 'put', v }),
        add: (v) => void actions.push({ m, a: 'add', v }),
        delete: (k) => void actions.push({ m, a: 'delete', v: k }),
        clear: () => void actions.push({ m, a: 'clear' }),
      }),
    });
  } catch (e) {
    throw traduire(e);
  }
  const pretes = await Promise.all(
    actions.map(async (x) => (x.a === 'put' || x.a === 'add' ? { ...x, v: await sceller(cle, x.m, x.v as object) } : x)),
  );
  await ecrire(db, magasins, (tx) => {
    for (const x of pretes) {
      const s = tx.objectStore(x.m);
      if (x.a === 'clear') s.clear();
      else if (x.a === 'delete') s.delete(x.v as string);
      else s[x.a](x.v);
    }
  });
}

export async function lireChiffre<T>(db: IDBDatabase, cle: CryptoKey, magasin: Magasin): Promise<T[]> {
  const champ = champCle(magasin);
  const brut = await lireTout<Scelle>(db, magasin);
  return Promise.all(brut.map((r) => dechiffrer<T>(cle, magasin, r[champ] as string, r)));
}

/** Données brutes (chiffrées) ; un magasin absent (base d'une version précédente) est lu comme vide. */
export async function lireBrut(db: IDBDatabase): Promise<Brut> {
  const listes = await Promise.all(DONNEES.map((m) => (db.objectStoreNames.contains(m) ? lireTout<Scelle>(db, m) : [])));
  return Object.fromEntries(DONNEES.map((m, i) => [m, listes[i]])) as Brut;
}

/**
 * Remplace toutes les données par `donnees` (chiffrées avec `cle`) en une seule transaction.
 * Sert au chiffrement initial (données 0.2.0 en clair) et à la restauration. `coffre` : nouveau coffre à enregistrer.
 */
export async function remplacer(db: IDBDatabase, cle: CryptoKey, donnees: Clair, coffre?: object): Promise<void> {
  const scelles = await Promise.all(DONNEES.map((m) => Promise.all(donnees[m].map((v) => sceller(cle, m, v)))));
  await ecrire(db, [...DONNEES, 'coffre'], (tx) => {
    DONNEES.forEach((m, i) => {
      const s = tx.objectStore(m);
      s.clear();
      for (const v of scelles[i]!) s.put(v);
    });
    if (coffre) tx.objectStore('coffre').put(coffre);
  });
}

export const COPIES_MAX = 7;
export interface Copie {
  /** Date et heure ISO : l'ordre alphabétique est l'ordre chronologique. */
  id: string;
  donnees: Brut;
}

/**
 * Avant toute migration : ouvre la base dans sa version actuelle (sans la migrer) et y fait une copie interne,
 * si elle a déjà des copies (v2 et plus, donc chiffrée). Aucune erreur ici n'empêche l'ouverture normale.
 */
export async function copierAvantMigration(nom: string, version = MIGRATIONS.length, fabrique: IDBFactory = indexedDB): Promise<boolean> {
  let db: IDBDatabase | null = null;
  try {
    // Version actuelle lue sans ouvrir : base absente ou déjà à jour → rien à faire, rien n'est créé.
    const actuelle = (await fabrique.databases()).find((d) => d.name === nom)?.version ?? 0;
    if (actuelle === 0 || actuelle >= version) return false;
    db = await new Promise<IDBDatabase>((ok, ko) => {
      const req = fabrique.open(nom, actuelle); // même version : jamais de migration ici
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ko(req.error);
      req.onblocked = () => ko(new Error('bloquée'));
    });
    if (!db.objectStoreNames.contains('copies')) return false;
    await copierInterne(db);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/** Copie interne des données (déjà chiffrées) ; seules les COPIES_MAX plus récentes sont gardées. */
export async function copierInterne(db: IDBDatabase, maintenant = new Date()): Promise<void> {
  const [donnees, copies] = await Promise.all([lireBrut(db), lireTout<Copie>(db, 'copies')]);
  const id = maintenant.toISOString();
  const anciennes = [...copies.map((c) => c.id), id].sort().slice(0, -COPIES_MAX);
  await ecrire(db, ['copies'], (tx) => {
    const s = tx.objectStore('copies');
    s.put({ id, donnees });
    for (const k of anciennes) s.delete(k);
  });
}
