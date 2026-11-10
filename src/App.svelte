<script lang="ts">
  // Coquille de l'app : base de données, écran courant, barre de navigation, bandeaux.
  // Navigation par état (aucune donnée dans l'URL).
  import { onMount } from 'svelte';
  import Barre from './composants/Barre.svelte';
  import Accueil from './ecrans/Accueil.svelte';
  import Carnet from './ecrans/Carnet.svelte';
  import Categories from './ecrans/Categories.svelte';
  import Comptes from './ecrans/Comptes.svelte';
  import FicheCategorie from './ecrans/FicheCategorie.svelte';
  import FicheCompte from './ecrans/FicheCompte.svelte';
  import Reglages from './ecrans/Reglages.svelte';
  import Saisie, { type Depart } from './ecrans/Saisie.svelte';
  import { ecrituresLiees } from './lib/carnet';
  import { nouvelleCategorie, type Categorie } from './lib/categories';
  import { nouveauCompte, type Compte } from './lib/comptes';
  import { aujourdHui } from './lib/dates';
  import { genererDemo } from './lib/demo';
  import type { OperationComplete } from './lib/operations';
  import { demanderPersistance, ecrire, lireTout, ouvrirBase, traduire } from './lib/stockage';
  import { enregistrerSW } from './sw-enregistrement';

  type Ecran =
    | { nom: 'accueil' }
    | { nom: 'carnet' }
    | { nom: 'reglages' }
    | { nom: 'comptes' }
    | { nom: 'compte'; compte: Compte; depuis: 'accueil' | 'comptes' }
    | { nom: 'categories' }
    | { nom: 'categorie'; categorie: Categorie };

  const demo: boolean = __DEMO__;
  let activer = $state<(() => void) | null>(null);
  let alerte = $state('');
  let db = $state<IDBDatabase | null>(null);
  let persistant = $state<boolean | null>(null);
  let comptes = $state<Compte[]>([]);
  let categories = $state<Categorie[]>([]);
  let operations = $state<OperationComplete[]>([]);
  let ecran = $state<Ecran>({ nom: 'accueil' });
  let saisie = $state(false);
  /** Modification depuis le carnet : l'opération, ou les deux écritures du virement. */
  let edition = $state<OperationComplete[] | null>(null);
  /** Saisie ouverte depuis une fiche compte (compte, type, sens déjà choisis). */
  let depart = $state<Depart>({});
  /** Derniers comptes utilisés, proposés par défaut (magasin « meta », écrit avec l'opération). */
  let dernier = $state<{ compteId?: string; versId?: string }>({});
  let message = $state('');
  let minuterie: ReturnType<typeof setTimeout> | undefined;

  async function charger(base: IDBDatabase) {
    let meta: { cle: string; compteId?: string; versId?: string }[];
    [comptes, categories, operations, meta] = await Promise.all([
      lireTout<Compte>(base, 'comptes'),
      lireTout<Categorie>(base, 'categories'),
      lireTout<OperationComplete>(base, 'operations'),
      lireTout<{ cle: string; compteId?: string; versId?: string }>(base, 'meta'),
    ]);
    const d = meta.find((m) => m.cle === 'derniere-saisie');
    dernier = { ...(d?.compteId ? { compteId: d.compteId } : {}), ...(d?.versId ? { versId: d.versId } : {}) };
  }

  /** Une écriture « tout ou rien » dans la base, puis relecture : l'écran montre toujours ce qui est enregistré. */
  async function modifier(magasins: string[], travail: (tx: IDBTransaction) => void): Promise<boolean> {
    if (!db) return false;
    try {
      const base = db;
      await ecrire(base, magasins, travail);
      await charger(base);
      return true;
    } catch (e) {
      alerte = traduire(e).message;
      return false;
    }
  }

  const enregistrerComptes = (liste: Compte[]) =>
    modifier(['comptes'], (tx) => {
      for (const c of liste) tx.objectStore('comptes').put($state.snapshot(c));
    });

  /** Démo uniquement : remplace tout le contenu de la base démo par des données fictives neuves. */
  function remplirDemo(): Promise<boolean> {
    if (!demo) return Promise.resolve(false); // garde-fou : jamais dans la base réelle
    const d = genererDemo(aujourdHui());
    return modifier(['comptes', 'categories', 'operations'], (tx) => {
      for (const m of ['comptes', 'categories', 'operations'] as const) {
        const magasin = tx.objectStore(m);
        magasin.clear();
        for (const x of d[m]) magasin.put(x);
      }
    });
  }

  function annoncer(texte: string) {
    message = texte;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => (message = ''), 2500);
  }

  /**
   * Une opération ou les deux écritures d'un virement : une seule transaction, tout ou rien.
   * En modification, les anciennes écritures sont retirées dans la même transaction.
   */
  async function validerOperation(ops: OperationComplete[]): Promise<boolean> {
    const anciennes = edition ?? [];
    const ok = await modifier(['operations', 'meta'], (tx) => {
      const magasin = tx.objectStore('operations');
      for (const op of anciennes) magasin.delete(op.id);
      for (const op of ops) magasin.add(op);
      // Nouvelle saisie : retenir les comptes utilisés (virement : départ = Débit, arrivée = Crédit).
      if (!anciennes.length && ops[0]) {
        const versId = ops[1]?.compteId ?? dernier.versId;
        tx.objectStore('meta').put({ cle: 'derniere-saisie', compteId: ops[0].compteId, ...(versId ? { versId } : {}) });
      }
    });
    if (ok) {
      fermerSaisie();
      if (anciennes.length) annoncer('Modification enregistrée');
      else {
        aller({ nom: 'accueil' });
        annoncer(ops.length > 1 ? 'Virement enregistré' : 'Opération enregistrée');
      }
    }
    return ok;
  }

  /** Suppression confirmée : l'opération, ou les deux écritures du virement, ensemble. */
  async function supprimerOperation(): Promise<boolean> {
    const anciennes = edition ?? [];
    const ok = await modifier(['operations'], (tx) => {
      for (const op of anciennes) tx.objectStore('operations').delete(op.id);
    });
    if (ok) {
      fermerSaisie();
      annoncer(anciennes.length > 1 ? 'Virement supprimé' : 'Opération supprimée');
    }
    return ok;
  }

  function fermerSaisie() {
    saisie = false;
    edition = null;
    depart = {};
  }

  function ouvrirSaisie(d: Depart = {}) {
    message = '';
    edition = null;
    depart = d;
    saisie = true;
  }

  function aller(e: Ecran) {
    ecran = e;
    message = ''; // le message de confirmation ne doit jamais masquer l'écran suivant
    window.scrollTo(0, 0);
  }

  const ouvrir = (depuis: 'accueil' | 'comptes') => (id: string) => {
    const compte = comptes.find((c) => c.id === id);
    if (compte) aller({ nom: 'compte', compte, depuis });
  };
  const creer = (depuis: 'accueil' | 'comptes') => () => aller({ nom: 'compte', compte: nouveauCompte(), depuis });
  const ouvrirCategorie = (id: string) => {
    const categorie = categories.find((c) => c.id === id);
    if (categorie) aller({ nom: 'categorie', categorie });
  };

  onMount(() => {
    enregistrerSW((f) => (activer = f));
    // Bases séparées : la démo ne lit ni n'écrit jamais la base réelle.
    ouvrirBase(demo ? 'budget-demo' : 'budget', () => {
      db = null;
      alerte = 'BUDGET a été mis à jour dans une autre fenêtre : rechargez l’app.';
    })
      .then(async (base) => {
        db = base;
        await charger(base);
        if (demo && comptes.length + categories.length + operations.length === 0) await remplirDemo();
        persistant = await demanderPersistance();
      })
      .catch((e: unknown) => (alerte = traduire(e).message));
  });
</script>

{#if demo}
  <div class="bandeau demo" role="note">DÉMO – données fictives</div>
{:else}
  <!-- Retiré à l'étape 3 (chiffrement + sauvegarde validés). -->
  <div class="bandeau travail" role="note">Version de travail : aucune donnée réelle avant l’activation du chiffrement</div>
{/if}

{#if alerte}
  <p class="alerte" role="alert">{alerte}</p>
{/if}

<main>
  {#if ecran.nom === 'accueil'}
    <Accueil {comptes} {operations} onouvrir={ouvrir('accueil')} oncreer={creer('accueil')} />
  {:else if ecran.nom === 'carnet'}
    <Carnet
      {comptes}
      {categories}
      {operations}
      onouvrir={(op) => {
        message = '';
        edition = ecrituresLiees(op, operations);
        saisie = true;
      }}
    />
  {:else if ecran.nom === 'reglages'}
    <Reglages
      {persistant}
      oncomptes={() => aller({ nom: 'comptes' })}
      oncategories={() => aller({ nom: 'categories' })}
      onreinitialiser={demo ? remplirDemo : null}
    />
  {:else if ecran.nom === 'comptes'}
    <Comptes {comptes} onouvrir={ouvrir('comptes')} oncreer={creer('comptes')} onretour={() => aller({ nom: 'reglages' })} />
  {:else if ecran.nom === 'categories'}
    <Categories
      {categories}
      onouvrir={ouvrirCategorie}
      oncreer={() => aller({ nom: 'categorie', categorie: nouvelleCategorie() })}
      onretour={() => aller({ nom: 'reglages' })}
    />
  {:else if ecran.nom === 'categorie'}
    {#key ecran.categorie.id}
      <FicheCategorie
        categorie={ecran.categorie}
        {categories}
        {operations}
        onenregistrer={(c) => modifier(['categories'], (tx) => void tx.objectStore('categories').put($state.snapshot(c)))}
        onsupprimer={(id) => modifier(['categories'], (tx) => void tx.objectStore('categories').delete(id))}
        onretour={() => aller({ nom: 'categories' })}
      />
    {/key}
  {:else}
    {@const depuis = ecran.depuis}
    {#key ecran.compte.id}
      <FicheCompte
        compte={ecran.compte}
        {comptes}
        {operations}
        retour={depuis === 'accueil' ? 'Accueil' : 'Comptes'}
        onenregistrer={enregistrerComptes}
        onsaisir={ouvrirSaisie}
        onretour={() => aller({ nom: depuis })}
      />
    {/key}
  {/if}
</main>

<Barre
  actif={ecran.nom === 'accueil' || ecran.nom === 'carnet' ? ecran.nom : ecran.nom === 'compte' && ecran.depuis === 'accueil' ? 'accueil' : 'reglages'}
  onaller={(o) => aller({ nom: o })}
  onplus={() => ouvrirSaisie()}
/>

{#if saisie}
  <Saisie
    {comptes}
    {categories}
    {operations}
    {depart}
    {dernier}
    existant={edition}
    onvalider={validerOperation}
    onsupprimer={edition ? supprimerOperation : null}
    onfermer={fermerSaisie}
    oncreercompte={() => {
      fermerSaisie();
      creer('accueil')();
    }}
    oncreercategorie={() => {
      fermerSaisie();
      aller({ nom: 'categorie', categorie: nouvelleCategorie() });
    }}
  />
{/if}

{#if message}
  <p class="toast" role="status">{message}</p>
{/if}

{#if activer}
  <div class="maj" role="status">
    <span>Nouvelle version disponible</span>
    <button type="button" onclick={activer}>Mettre à jour</button>
  </div>
{/if}

<style>
  .bandeau {
    position: sticky;
    top: 0;
    z-index: 3;
    padding: calc(env(safe-area-inset-top) + 6px) 16px 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: center;
  }

  .demo {
    background: var(--accent);
    color: var(--fond);
  }

  .travail {
    background: var(--surface-2);
    color: var(--accent);
    box-shadow: 0 1px 0 rgb(200 169 126 / 0.35);
  }

  /* Sous un bandeau, l'écran n'a plus à éviter l'encoche lui-même. */
  .bandeau ~ main :global(.ecran) {
    padding-top: 12px;
  }

  main {
    display: flex;
    flex: 1;
  }

  .alerte {
    margin: 12px 16px 0;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--surface-1);
    box-shadow: var(--ombre);
    text-align: center;
  }

  .toast {
    position: fixed;
    inset: auto 0 calc(var(--barre) + 16px);
    z-index: 4;
    width: fit-content;
    margin: 0 auto;
    padding: 12px 18px;
    border-radius: 14px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: var(--ombre);
    color: var(--credit);
    font-weight: 600;
    animation: entree 180ms ease-out;
  }

  .maj {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(var(--barre) + 12px);
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 16px;
    border-radius: 16px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: var(--ombre);
    font-size: 0.9375rem;
    animation: entree 180ms ease-out;
  }

  .maj button {
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 12px;
    background: var(--accent);
    color: var(--fond);
    font-weight: 600;
  }

  @keyframes entree {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
</style>
