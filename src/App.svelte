<script lang="ts">
  // Coquille de l'app : base de données, accès (code, verrouillage), écran courant, barre de navigation, bandeaux.
  // Navigation par état (aucune donnée dans l'URL). La clé de données n'existe qu'en mémoire, app déverrouillée.
  import { onMount } from 'svelte';
  import Barre from './composants/Barre.svelte';
  import Logo from './composants/Logo.svelte';
  import type { Restaure } from './composants/Restauration.svelte';
  import AValider from './ecrans/AValider.svelte';
  import ChangerCode from './ecrans/ChangerCode.svelte';
  import Echeancier from './ecrans/Echeancier.svelte';
  import FicheEcheance from './ecrans/FicheEcheance.svelte';
  import Pointage from './ecrans/Pointage.svelte';
  import Creation from './ecrans/Creation.svelte';
  import Deverrouillage from './ecrans/Deverrouillage.svelte';
  import Sauvegarde from './ecrans/Sauvegarde.svelte';
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
  import { ErreurCoffre, type Coffre } from './lib/coffre';
  import { ajouterJours, aujourdHui, formaterDate } from './lib/dates';
  import { genererDemo } from './lib/demo';
  import { aValider, idOperation, type Echeance, type Occurrence } from './lib/echeances';
  import { CORRECTION, pointageDu } from './lib/pointage';
  import { prevoir } from './lib/previsionnel';
  import { calculerSolde, verifierOperation } from './lib/soldes';
  import type { OperationComplete } from './lib/operations';
  import { ErreurSauvegarde } from './lib/sauvegarde';
  import {
    copierAvantMigration,
    copierInterne,
    demanderPersistance,
    DONNEES,
    ecrire,
    ecrireChiffre,
    lireChiffre,
    lireTout,
    ouvrirBase,
    remplacer,
    traduire,
    type Clair,
    type Tx,
  } from './lib/stockage';
  import { enregistrerSW } from './sw-enregistrement';

  type Ecran =
    | { nom: 'accueil' }
    | { nom: 'carnet' }
    | { nom: 'reglages' }
    | { nom: 'comptes' }
    | { nom: 'compte'; compte: Compte; depuis: 'accueil' | 'comptes' }
    | { nom: 'categories' }
    | { nom: 'categorie'; categorie: Categorie }
    | { nom: 'code' }
    | { nom: 'sauvegarde' }
    | { nom: 'avalider' }
    | { nom: 'pointage' }
    | { nom: 'echeancier' }
    | { nom: 'echeance'; echeance: Echeance };

  /** Verrouillage automatique après 2 min sans geste (et dès que l'app passe en arrière-plan). */
  const INACTIVITE = 2 * 60 * 1000;

  const demo: boolean = __DEMO__;
  let activer = $state<(() => void) | null>(null);
  let alerte = $state('');
  let db = $state<IDBDatabase | null>(null);
  let etat = $state<'chargement' | 'creation' | 'verrouille' | 'ouvert'>('chargement');
  let cle = $state.raw<CryptoKey | null>(null);
  let coffre = $state.raw<Coffre | null>(null);
  /** Données 0.2.0 présentes en clair avant la création du code. */
  let avecDonnees = $state(false);
  let masque = $state(false);
  let dernierGeste = Date.now();
  /** Date de la dernière sauvegarde externe (magasin « meta », chiffré). */
  let derniere = $state<string | null>(null);
  let persistant = $state<boolean | null>(null);
  let comptes = $state<Compte[]>([]);
  let categories = $state<Categorie[]>([]);
  let operations = $state<OperationComplete[]>([]);
  let echeances = $state<Echeance[]>([]);
  /** Date du dernier pointage (magasin « meta », chiffré). */
  let dernierPointage = $state<string | null>(null);
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

  /** Messages fixes, sans donnée ni détail technique. */
  const messageErreur = (e: unknown) => (e instanceof ErreurCoffre || e instanceof ErreurSauvegarde ? e.message : traduire(e).message);

  async function charger(base: IDBDatabase, k: CryptoKey) {
    type Meta = { cle: string; compteId?: string; versId?: string; date?: string };
    const [c, cat, ops, meta, ech] = await Promise.all([
      lireChiffre<Compte>(base, k, 'comptes'),
      lireChiffre<Categorie>(base, k, 'categories'),
      lireChiffre<OperationComplete>(base, k, 'operations'),
      lireChiffre<Meta>(base, k, 'meta'),
      lireChiffre<Echeance>(base, k, 'echeances'),
    ]);
    if (cle !== k) return; // verrouillée entre-temps : rien ne doit réapparaître
    [comptes, categories, operations, echeances] = [c, cat, ops, ech];
    dernierPointage = meta.find((m) => m.cle === 'pointage')?.date ?? null;
    const d = meta.find((m) => m.cle === 'derniere-saisie');
    dernier = { ...(d?.compteId ? { compteId: d.compteId } : {}), ...(d?.versId ? { versId: d.versId } : {}) };
    derniere = meta.find((m) => m.cle === 'sauvegarde-externe')?.date ?? null;
  }

  /** Une écriture chiffrée « tout ou rien » dans la base, puis relecture : l'écran montre toujours ce qui est enregistré. */
  async function modifier(magasins: string[], travail: (tx: Tx) => void): Promise<boolean> {
    if (!db || !cle) return false;
    const [base, k] = [db, cle];
    try {
      await ecrireChiffre(base, k, magasins, travail);
      await charger(base, k);
      return true;
    } catch (e) {
      alerte = messageErreur(e);
      return false;
    }
  }

  async function ouvrirSession(k: CryptoKey, c: Coffre) {
    if (!db) return;
    [cle, coffre, alerte] = [k, c, ''];
    dernierGeste = Date.now();
    try {
      await charger(db, k);
      if (demo && comptes.length + categories.length + operations.length === 0) await remplirDemo();
      etat = 'ouvert';
    } catch (e) {
      cle = null;
      alerte = messageErreur(e);
    }
  }

  /** Verrouillage : la clé et toutes les données quittent la mémoire, l'écran est remplacé. */
  function verrouiller() {
    [cle, comptes, categories, operations, echeances, dernier, derniere, dernierPointage] = [null, [], [], [], [], {}, null, null];
    fermerSaisie();
    [ecran, message, etat] = [{ nom: 'accueil' }, '', 'verrouille'];
  }

  /** Premier code : les données 0.2.0 (en clair) sont chiffrées et le coffre écrit, en une seule transaction. */
  async function terminerCreation(c: Coffre, k: CryptoKey): Promise<boolean> {
    if (!db) return false;
    const base = db;
    try {
      const listes = await Promise.all(DONNEES.map((m) => lireTout<object>(base, m)));
      await remplacer(base, k, Object.fromEntries(DONNEES.map((m, i) => [m, listes[i]])) as Clair, c);
      await ouvrirSession(k, c);
      return true;
    } catch (e) {
      alerte = messageErreur(e);
      return false;
    }
  }

  /** Installation neuve depuis une sauvegarde : données et coffre du fichier. */
  async function installer(r: Restaure): Promise<boolean> {
    if (!db || !r.coffre) return false;
    try {
      await remplacer(db, r.cle, r.donnees, r.coffre);
      await ouvrirSession(r.cle, r.coffre);
      return true;
    } catch (e) {
      alerte = messageErreur(e);
      return false;
    }
  }

  /** Restauration (app déverrouillée) : copie de secours, puis remplacement chiffré avec la clé actuelle. */
  async function restaurer(r: Restaure): Promise<boolean> {
    if (!db || !cle) return false;
    const [base, k] = [db, cle];
    try {
      await copierInterne(base);
      await remplacer(base, k, r.donnees);
      await charger(base, k);
      aller({ nom: 'accueil' });
      annoncer('Restauration terminée');
      return true;
    } catch (e) {
      alerte = messageErreur(e);
      return false;
    }
  }

  async function enregistrerCoffre(c: Coffre): Promise<boolean> {
    if (!db) return false;
    try {
      await ecrire(db, ['coffre'], (tx) => void tx.objectStore('coffre').put(c));
      coffre = c;
      aller({ nom: 'reglages' });
      annoncer('Code modifié');
      return true;
    } catch (e) {
      alerte = messageErreur(e);
      return false;
    }
  }

  /**
   * Validation d'une échéance : l'opération (identifiant fixe : une seconde validation est refusée par la base)
   * et l'avancement de l'échéance, dans une seule transaction.
   */
  async function validerEcheance(e: Echeance, o: Occurrence, montant: number, date: string): Promise<string | null> {
    const compte = comptes.find((c) => c.id === e.compteId);
    const op: OperationComplete = {
      id: idOperation(e, o),
      compteId: e.compteId,
      ...(e.categorieId ? { categorieId: e.categorieId } : {}),
      date,
      sens: e.sens,
      montant,
      note: e.nom,
    };
    const refus = compte ? verifierOperation(op, compte) : 'Compte introuvable.';
    if (refus) return refus;
    const ok = await modifier(['operations', 'echeances'], (tx) => {
      tx.objectStore('operations').add(op);
      tx.objectStore('echeances').put({ ...$state.snapshot(e), prochaine: o.n + 1 });
    });
    if (ok) annoncer('Échéance validée');
    return ok ? null : alerte;
  }

  async function ignorerEcheance(e: Echeance, o: Occurrence): Promise<boolean> {
    const ok = await modifier(['echeances'], (tx) => tx.objectStore('echeances').put({ ...$state.snapshot(e), prochaine: o.n + 1 }));
    if (ok) annoncer('Échéance ignorée');
    return ok;
  }

  /** Pointage : une opération CORRECTION par écart (catégorie créée au besoin) et la date, en une transaction. */
  async function validerPointage(reels: Map<string, number>): Promise<string | null> {
    const jour = aujourdHui();
    const existante = categories.find((c) => c.nom === CORRECTION);
    const nouvelle: Categorie | null = existante ? null : { id: crypto.randomUUID(), nom: CORRECTION, sens: 'debit', archive: false };
    const categorieId = (existante ?? nouvelle)!.id;
    const ops: OperationComplete[] = [];
    for (const [id, reel] of reels) {
      const compte = comptes.find((c) => c.id === id);
      if (!compte) continue;
      const ecart = reel - calculerSolde(compte, operations, jour);
      if (ecart === 0) continue;
      const op: OperationComplete = { id: crypto.randomUUID(), compteId: id, categorieId, date: jour, sens: ecart > 0 ? 'credit' : 'debit', montant: Math.abs(ecart), note: 'Pointage' };
      const refus = verifierOperation(op, compte);
      if (refus) return `${compte.nom} : ${refus}`;
      ops.push(op);
    }
    const ok = await modifier(['operations', 'categories', 'meta'], (tx) => {
      if (nouvelle && ops.length) tx.objectStore('categories').put(nouvelle);
      for (const op of ops) tx.objectStore('operations').add(op);
      tx.objectStore('meta').put({ cle: 'pointage', date: jour });
    });
    if (!ok) return alerte;
    aller({ nom: 'accueil' });
    annoncer(ops.length ? `Pointage enregistré : ${ops.length} correction${ops.length > 1 ? 's' : ''}` : 'Pointage enregistré : aucun écart');
    return null;
  }

  const previsions = $derived(prevoir(comptes, operations, echeances, aujourdHui()));
  const nbAValider = $derived(echeances.filter((e) => aValider(e, aujourdHui())).length);

  const noterSauvegarde = (date: string) => modifier(['meta'], (tx) => tx.objectStore('meta').put({ cle: 'sauvegarde-externe', date }));

  const rappel = $derived(
    etat === 'ouvert' && ecran.nom === 'accueil' && comptes.length > 0 && (!derniere || ajouterJours(derniere, 7) < aujourdHui()),
  );

  function visibilite() {
    masque = document.visibilityState === 'hidden';
    if (masque && etat === 'ouvert') verrouiller();
  }

  const enregistrerComptes = (liste: Compte[]) =>
    modifier(['comptes'], (tx) => {
      for (const c of liste) tx.objectStore('comptes').put($state.snapshot(c));
    });

  /** Démo uniquement : remplace tout le contenu de la base démo par des données fictives neuves. */
  function remplirDemo(): Promise<boolean> {
    if (!demo) return Promise.resolve(false); // garde-fou : jamais dans la base réelle
    const d = genererDemo(aujourdHui());
    return modifier(['comptes', 'categories', 'operations', 'echeances'], (tx) => {
      for (const m of ['comptes', 'categories', 'operations', 'echeances'] as const) {
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
    const horloge = setInterval(() => {
      if (etat === 'ouvert' && Date.now() - dernierGeste >= INACTIVITE) verrouiller();
    }, 5000);
    // Bases séparées : la démo ne lit ni n'écrit jamais la base réelle.
    const nomBase = demo ? 'budget-demo' : 'budget';
    // Copie interne des données (déjà chiffrées) avant toute migration, puis ouverture (et migration).
    copierAvantMigration(nomBase).then(() =>
    ouvrirBase(nomBase, () => {
      db = null;
      alerte = 'BUDGET a été mis à jour dans une autre fenêtre : rechargez l’app.';
    })
      .then(async (base) => {
        db = base;
        const c = (await lireTout<Coffre>(base, 'coffre')).find((x) => x.cle === 'coffre');
        if (c) {
          coffre = c;
          etat = 'verrouille';
          // Copie interne (données déjà chiffrées) à chaque ouverture.
          await copierInterne(base).catch((e: unknown) => (alerte = traduire(e).message));
        } else {
          avecDonnees = (await Promise.all(DONNEES.map((m) => lireTout(base, m)))).some((l) => l.length > 0);
          etat = 'creation';
        }
        persistant = await demanderPersistance();
      })
      .catch((e: unknown) => (alerte = traduire(e).message)));
    return () => clearInterval(horloge);
  });
</script>

<svelte:document onvisibilitychange={visibilite} />
<svelte:window onpointerdowncapture={() => (dernierGeste = Date.now())} onkeydowncapture={() => (dernierGeste = Date.now())} />

{#if demo}
  <div class="bandeau demo" role="note">DÉMO – données fictives</div>
{/if}

{#if alerte}
  <p class="alerte" role="alert">{alerte}</p>
{/if}

{#if etat === 'creation' && db}
  <main><Creation {demo} {avecDonnees} onterminer={terminerCreation} onrestaurer={installer} /></main>
{:else if etat === 'verrouille' && db && coffre}
  <main><Deverrouillage {db} {coffre} {demo} onouvert={ouvrirSession} /></main>
{:else if etat === 'ouvert'}
{#if rappel}
  <div class="rappel carte" role="note">
    <p>{derniere ? `Dernière sauvegarde externe : le ${formaterDate(derniere)}.` : 'Aucune sauvegarde externe.'}</p>
    <button type="button" class="bouton" onclick={() => aller({ nom: 'sauvegarde' })}>Sauvegarder</button>
  </div>
{/if}

<main>
  {#if ecran.nom === 'accueil'}
    <Accueil
      {comptes}
      {operations}
      {previsions}
      {nbAValider}
      pointage={pointageDu(dernierPointage, aujourdHui())}
      onouvrir={ouvrir('accueil')}
      oncreer={creer('accueil')}
      onavalider={() => aller({ nom: 'avalider' })}
      onpointage={() => aller({ nom: 'pointage' })}
    />
  {:else if ecran.nom === 'avalider'}
    <AValider {echeances} {comptes} onvalider={validerEcheance} onignorer={ignorerEcheance} onretour={() => aller({ nom: 'accueil' })} />
  {:else if ecran.nom === 'pointage'}
    <Pointage {comptes} {operations} dernier={dernierPointage} onvalider={validerPointage} onretour={() => aller({ nom: 'accueil' })} />
  {:else if ecran.nom === 'echeancier'}
    <Echeancier
      {echeances}
      {comptes}
      onouvrir={(id) => {
        const e = echeances.find((x) => x.id === id);
        if (e) aller({ nom: 'echeance', echeance: e });
      }}
      oncreer={() =>
        aller({
          nom: 'echeance',
          echeance: {
            id: crypto.randomUUID(),
            nom: '',
            compteId: comptes.find((c) => c.principal && !c.archive)?.id ?? '',
            sens: 'debit',
            montant: 0,
            frequence: 'mensuelle',
            debut: aujourdHui(),
            fin: { type: 'aucune' },
            prochaine: 0,
            archive: false,
          },
        })}
      onretour={() => aller({ nom: 'reglages' })}
    />
  {:else if ecran.nom === 'echeance'}
    {#key ecran.echeance.id}
      <FicheEcheance
        echeance={ecran.echeance}
        {echeances}
        {comptes}
        {categories}
        onenregistrer={(e) => modifier(['echeances'], (tx) => tx.objectStore('echeances').put($state.snapshot(e)))}
        onsupprimer={(id) => modifier(['echeances'], (tx) => tx.objectStore('echeances').delete(id))}
        onretour={() => aller({ nom: 'echeancier' })}
      />
    {/key}
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
      {derniere}
      {dernierPointage}
      oncomptes={() => aller({ nom: 'comptes' })}
      onecheancier={() => aller({ nom: 'echeancier' })}
      onpointage={() => aller({ nom: 'pointage' })}
      oncategories={() => aller({ nom: 'categories' })}
      oncode={() => aller({ nom: 'code' })}
      onsauvegarde={() => aller({ nom: 'sauvegarde' })}
      onverrouiller={verrouiller}
      onreinitialiser={demo ? remplirDemo : null}
    />
  {:else if ecran.nom === 'code'}
    {#if coffre}<ChangerCode {coffre} onenregistrer={enregistrerCoffre} onretour={() => aller({ nom: 'reglages' })} />{/if}
  {:else if ecran.nom === 'sauvegarde'}
    {#if db && cle && coffre}
      <Sauvegarde
        {db}
        {cle}
        {coffre}
        {demo}
        {derniere}
        onsauvegarde={noterSauvegarde}
        onrestaurer={restaurer}
        onretour={() => aller({ nom: 'reglages' })}
      />
    {/if}
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
  actif={ecran.nom === 'accueil' || ecran.nom === 'carnet'
    ? ecran.nom
    : (ecran.nom === 'compte' && ecran.depuis === 'accueil') || ecran.nom === 'avalider' || ecran.nom === 'pointage'
      ? 'accueil'
      : 'reglages'}
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
{/if}

{#if activer}
  <div class="maj" role="status">
    <span>Nouvelle version disponible</span>
    <button type="button" onclick={activer}>Mettre à jour</button>
  </div>
{/if}

{#if masque}
  <div class="masque" aria-hidden="true"><Logo taille={72} /></div>
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

  .rappel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 12px 16px 0;
    padding: 10px 10px 10px 16px;
    font-size: 0.9375rem;
  }

  .rappel p {
    margin: 0;
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
