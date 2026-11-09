// Stockage IndexedDB natif : base versionnée, migrations appliquées dans l'ordre, écritures « tout ou rien ».
// Règle absolue : aucune migration n'efface de données ; une migration qui échoue annule tout (version inchangée).

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
];

export type CodeErreur = 'bloquee' | 'trop-recente' | 'migration' | 'plein' | 'inconnue';

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
  bloquee: 'BUDGET est ouvert dans une autre fenêtre avec une ancienne version : fermez-la puis rouvrez l’app.',
  'trop-recente': 'Ces données viennent d’une version plus récente de BUDGET : mettez l’app à jour. Rien n’a été effacé.',
  migration: 'La mise à jour des données a échoué : rien n’a été modifié.',
  plein: 'Espace de stockage plein sur l’appareil : libérez de la place. Rien n’a été effacé.',
  inconnue: 'Erreur de stockage. Rien n’a été effacé.',
};

const erreur = (code: CodeErreur) => new ErreurStockage(code, MESSAGES[code]);

/** Traduit une erreur du navigateur en erreur au message clair. */
export function traduire(e: unknown): ErreurStockage {
  if (e instanceof ErreurStockage) return e;
  const nom = (e as { name?: unknown } | null)?.name;
  return erreur(nom === 'VersionError' ? 'trop-recente' : nom === 'QuotaExceededError' ? 'plein' : 'inconnue');
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
