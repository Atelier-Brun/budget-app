<script lang="ts" module>
  import type { Sens as SensDepart } from '../lib/soldes';
  /** Ouverture depuis une fiche compte : compte, type de saisie et sens déjà choisis. */
  export interface Depart {
    mode?: 'operation' | 'virement';
    compteId?: string;
    sens?: SensDepart;
  }
</script>

<script lang="ts">
  // Saisie unique : opération (Débit/Crédit, dépôt/retrait sur un tiers) ou virement, mêmes gestes pour tous les comptes.
  // Opération : montant au pavé → catégorie (propose le sens) → Valider. Virement : montant → Depuis → Vers → Valider.
  // Aperçu du solde avant → après ; dernier compte utilisé proposé ; modification et suppression depuis le carnet.
  import { untrack } from 'svelte';
  import Pave from '../composants/Pave.svelte';
  import { retrouverVirement } from '../lib/carnet';
  import { trierCategories, type Categorie } from '../lib/categories';
  import { afficherSolde, LIBELLES, TYPES, trierComptes, type Compte } from '../lib/comptes';
  import { aujourdHui } from '../lib/dates';
  import { formaterMontant, taper } from '../lib/montants';
  import { apercuSolde, NOTE_MAX, preparerOperation, preparerVirement, type OperationComplete } from '../lib/operations';
  import type { Operation, Sens } from '../lib/soldes';

  let {
    comptes,
    categories,
    operations,
    existant = null,
    depart = {},
    dernier = {},
    onvalider,
    onsupprimer = null,
    onfermer,
    oncreercompte,
    oncreercategorie,
  }: {
    comptes: Compte[];
    categories: Categorie[];
    operations: OperationComplete[];
    /** Modification : l'opération, ou les deux écritures du virement (du carnet). */
    existant?: OperationComplete[] | null;
    /** Ouverture depuis une fiche compte : compte, type de saisie et sens déjà choisis. */
    depart?: Depart;
    /** Derniers comptes utilisés (proposés par défaut). */
    dernier?: { compteId?: string; versId?: string };
    /** Une opération, ou les deux écritures d'un virement (enregistrées ensemble ou pas du tout). */
    onvalider: (ops: OperationComplete[]) => Promise<boolean>;
    onsupprimer?: (() => Promise<boolean>) | null;
    onfermer: () => void;
    oncreercompte: () => void;
    oncreercategorie: () => void;
  } = $props();

  // Valeurs et listes figées à l'ouverture du panneau. En modification, le compte et la catégorie
  // d'origine restent proposés même s'ils ont été archivés depuis.
  const { initial, actifs, actives, virement, d, der } = untrack(() => {
    const garder = (archive: boolean, id: string) => !archive || !!existant?.some((o) => o.compteId === id || o.categorieId === id);
    return {
      initial: existant?.[0],
      actifs: trierComptes(comptes.filter((c) => garder(c.archive, c.id))),
      actives: trierCategories(categories.filter((c) => garder(c.archive, c.id))),
      virement: existant?.[0]?.virementId ? retrouverVirement(existant) : null,
      d: { ...depart },
      der: { ...dernier },
    };
  });
  const modification = !!initial;
  const incoherent = !!initial?.virementId && !virement;
  const existe = (id: string | undefined) => (id && actifs.some((c) => c.id === id) ? id : undefined);
  const groupes = TYPES.map((t) => ({ t, liste: actifs.filter((c) => c.type === t) })).filter((g) => g.liste.length > 0);

  let mode = $state<'operation' | 'virement'>(initial?.virementId ? 'virement' : (d.mode ?? 'operation'));
  // Par défaut : compte de la fiche, sinon dernier compte utilisé, sinon le principal.
  const compteInitial =
    virement?.depuisId ?? initial?.compteId ?? existe(d.compteId) ?? existe(der.compteId) ?? actifs.find((c) => c.principal)?.id ?? actifs[0]?.id ?? '';
  let compteId = $state(compteInitial);
  let versId = $state(virement?.versId ?? (existe(der.versId) !== compteInitial ? (existe(der.versId) ?? '') : ''));
  let categorieId = $state(initial?.categorieId ?? '');
  let montant = $state(initial?.montant ?? 0);
  let sens = $state<Sens>(initial?.sens ?? d.sens ?? 'debit');
  /** Sens choisi exprès (raccourci de la fiche ou touche Débit/Crédit) : la catégorie ne le change plus. */
  let sensChoisi = $state(!!initial || !!d.sens);
  let date = $state(initial?.date ?? aujourdHui());
  let note = $state(initial?.note ?? '');
  let erreur = $state('');
  let occupe = $state(false);
  let confirmer = $state(false);

  const compte = $derived(actifs.find((c) => c.id === compteId));
  const vers = $derived(actifs.find((c) => c.id === versId));

  /** Aperçu avant → après pour chaque compte touché (au moins un montant saisi). */
  const apercus = $derived.by(() => {
    if (montant <= 0 || !compte) return [];
    const ajout = (c: Compte, s: Sens): Operation => ({ compteId: c.id, date, sens: s, montant });
    const touches: [Compte, Sens][] = mode === 'virement' ? (vers && vers.id !== compte.id ? [[compte, 'debit'], [vers, 'credit']] : []) : [[compte, sens]];
    return touches.map(([c, s]) => {
      const { avant, apres } = apercuSolde(c, operations, existant ?? [], [ajout(c, s)], aujourdHui());
      return { c, avant: afficherSolde(c.type, avant), apres: afficherSolde(c.type, apres) };
    });
  });

  /** Depuis et Vers jamais identiques : choisir l'autre compte les échange. */
  function choisir(cote: 'depuis' | 'vers', id: string) {
    if (cote === 'depuis') {
      if (id === versId) versId = compteId;
      compteId = id;
    } else {
      if (id === compteId) compteId = versId;
      versId = id;
    }
  }

  function inverser() {
    [compteId, versId] = [versId || compteId, compteId];
  }

  /** Clavier physique (ordinateur, clavier Bluetooth) : chiffres et retour arrière, hors des champs texte. */
  function clavier(e: KeyboardEvent) {
    if (e.key === 'Escape') return onfermer();
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (/^[0-9]$/.test(e.key)) montant = taper(montant, e.key);
    else if (e.key === 'Backspace') montant = taper(montant, 'effacer');
  }

  async function valider(e: SubmitEvent) {
    e.preventDefault();
    const r =
      mode === 'virement'
        ? preparerVirement({ depuis: compte, vers, montant, date, note })
        : preparerOperation({ compte, categorie: actives.find((c) => c.id === categorieId), montant, sens, date, note });
    if (!r.ok) {
      erreur = r.erreur;
      return;
    }
    erreur = '';
    occupe = true;
    await onvalider('operations' in r ? r.operations : [r.operation]);
    occupe = false;
  }

  async function supprimer() {
    occupe = true;
    await onsupprimer?.();
    occupe = false;
  }
</script>

<svelte:window onkeydown={clavier} />

{#snippet comptesGroupes()}
  {#each groupes as g (g.t)}
    <optgroup label={LIBELLES[g.t].section}>
      {#each g.liste as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
    </optgroup>
  {/each}
{/snippet}

<div class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-saisie">
  <header class="haut">
    <button type="button" class="retour" onclick={onfermer}>Annuler</button>
    <h2 id="titre-saisie">
      {modification ? (mode === 'virement' ? 'Modifier le virement' : 'Modifier l’opération') : mode === 'virement' ? 'Nouveau virement' : 'Nouvelle opération'}
    </h2>
    <span></span>
  </header>

  {#if incoherent}
    <div class="carte vide">
      <p>Ce virement est incomplet : il peut seulement être supprimé, puis saisi à nouveau.</p>
    </div>
  {:else if !modification && actifs.length > 0}
    <div class="segments mode" role="radiogroup" aria-label="Type de saisie">
      <label class="segment"><input type="radio" name="mode" value="operation" bind:group={mode} onchange={() => (erreur = '')} />Opération</label>
      <label class="segment"><input type="radio" name="mode" value="virement" bind:group={mode} onchange={() => (erreur = '')} />Virement</label>
    </div>
  {/if}

  {#if incoherent}
    <!-- seule la suppression est proposée, plus bas -->
  {:else if actifs.length === 0}
    <div class="carte vide">
      <p>Aucun compte actif. Un compte est nécessaire pour saisir une opération.</p>
      <button type="button" class="bouton" onclick={oncreercompte}>Créer un compte</button>
    </div>
  {:else if mode === 'operation' && actives.length === 0 && !actifs.some((c) => c.type === 'tiers')}
    <div class="carte vide">
      <p>Aucune catégorie active. Une catégorie est nécessaire pour saisir une opération.</p>
      <button type="button" class="bouton" onclick={oncreercategorie}>Créer une catégorie</button>
    </div>
  {:else if mode === 'virement' && actifs.length < 2}
    <div class="carte vide">
      <p>Deux comptes actifs sont nécessaires pour un virement.</p>
      <button type="button" class="bouton" onclick={oncreercompte}>Créer un compte</button>
    </div>
  {:else}
    <form class="formulaire" onsubmit={valider} novalidate>
      <output class="montant" class:vide={montant === 0} aria-label="Montant" aria-live="polite">{formaterMontant(montant)}</output>
      <Pave bind:montant />

      {#if mode === 'virement'}
        <div class="sens-virement">
          <label class="champ">
            <span>Depuis (Débit)</span>
            <select value={compteId} onchange={(e) => choisir('depuis', e.currentTarget.value)}>{@render comptesGroupes()}</select>
          </label>
          <button type="button" class="inverser" aria-label="Inverser Depuis et Vers" onclick={inverser} disabled={!versId}>⇅</button>
          <label class="champ">
            <span>Vers (Crédit)</span>
            <select value={versId} onchange={(e) => choisir('vers', e.currentTarget.value)}>
              <option value="" disabled>Choisir le compte d’arrivée</option>
              {@render comptesGroupes()}
            </select>
          </label>
        </div>
      {:else}
        <label class="champ">
          <span>Compte</span>
          <select bind:value={compteId}>{@render comptesGroupes()}</select>
        </label>

        <fieldset class="champ">
          <legend>Sens</legend>
          <div class="segments">
            <label class="segment debit"><input type="radio" name="sens" value="debit" bind:group={sens} onchange={() => (sensChoisi = true)} />Débit</label>
            <label class="segment credit"><input type="radio" name="sens" value="credit" bind:group={sens} onchange={() => (sensChoisi = true)} />Crédit</label>
          </div>
        </fieldset>

        {#if actives.length > 0 || compte?.type === 'tiers'}
          <fieldset class="champ">
            <legend>Catégorie{compte?.type === 'tiers' ? ' (facultative pour un tiers)' : ''}</legend>
            <div class="pastilles">
              {#if compte?.type === 'tiers'}
                <label class="pastille"><input type="radio" name="categorie" value="" bind:group={categorieId} />Aucune</label>
              {/if}
              {#each actives as c (c.id)}
                <label class="pastille">
                  <input type="radio" name="categorie" value={c.id} bind:group={categorieId} onchange={() => sensChoisi || (sens = c.sens)} />{c.nom}
                </label>
              {/each}
            </div>
          </fieldset>
        {/if}
      {/if}

      <label class="champ">
        <span>Date</span>
        <input type="date" bind:value={date} required />
      </label>
      <label class="champ">
        <span>Note (facultative)</span>
        <input bind:value={note} maxlength={NOTE_MAX + 10} autocomplete="off" />
      </label>

      <!-- Toujours visible en bas : aperçu du solde, message, Valider. -->
      <div class="pied">
        {#if apercus.length}
          <ul class="apercu" aria-label="Aperçu du solde">
            {#each apercus as a (a.c.id)}
              <li>
                <span class="nom">{a.c.nom}</span>
                <span><span class:negatif={a.avant.negatif}>{a.avant.texte}</span> → <strong class:negatif={a.apres.negatif}>{a.apres.texte}</strong></span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
        <button type="submit" class="bouton valider" disabled={occupe}>{modification ? 'Enregistrer' : 'Valider'}</button>
      </div>
    </form>
  {/if}

  {#if modification && onsupprimer}
    <div class="suppression">
      {#if !confirmer}
        <button type="button" class="bouton-discret action" onclick={() => (confirmer = true)}>
          {initial?.virementId ? 'Supprimer ce virement…' : 'Supprimer cette opération…'}
        </button>
      {:else}
        <div class="carte confirmation" role="alertdialog" aria-labelledby="question-suppression">
          <p id="question-suppression">
            {initial?.virementId ? 'Supprimer ce virement ? Ses deux écritures seront supprimées.' : 'Supprimer cette opération ?'} Cette action
            est définitive.
          </p>
          <div class="boutons">
            <button type="button" class="bouton-discret" onclick={() => (confirmer = false)}>Annuler</button>
            <button type="button" class="bouton" disabled={occupe} onclick={supprimer}>Supprimer</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .feuille {
    position: fixed;
    inset: 0;
    z-index: 5;
    overflow-y: auto;
    padding: calc(env(safe-area-inset-top) + 8px) 16px calc(env(safe-area-inset-bottom) + 24px);
    background: var(--fond);
    animation: monter 200ms ease-out;
  }

  .haut {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 44px;
    margin-bottom: 4px;
  }

  .haut .retour {
    justify-self: start;
    margin-left: -6px;
  }

  h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .mode,
  .suppression {
    max-width: 40rem;
    margin: 0 auto 12px;
  }

  .vide {
    display: grid;
    gap: 14px;
    padding: 20px;
    text-align: center;
  }

  .vide p {
    margin: 0;
  }

  .formulaire {
    max-width: 40rem;
    margin: 0 auto;
    padding: 0;
  }

  .montant {
    display: block;
    padding: 4px 0;
    font-size: 2.75rem;
    font-weight: 600;
    text-align: center;
  }

  .montant.vide {
    color: var(--texte-2);
  }

  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pastille {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 22px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: 0 1px 0 rgb(242 232 218 / 0.06) inset, 0 2px 6px rgb(0 0 0 / 0.4);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pastille:has(input:checked) {
    background: linear-gradient(180deg, #d6b98f, var(--accent));
    color: var(--fond);
  }

  .pastille:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .pastille input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .pied {
    position: sticky;
    bottom: calc(-24px - env(safe-area-inset-bottom));
    display: grid;
    gap: 10px;
    margin: 0 -16px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgb(26 20 16 / 0), var(--fond) 30%);
  }

  .pied .erreur {
    margin: 0;
    text-align: center;
  }

  .valider {
    width: 100%;
    min-height: 56px;
    font-size: 1.0625rem;
  }

  @keyframes monter {
    from {
      opacity: 0.6;
      transform: translateY(24px);
    }
  }

  .sens-virement {
    display: grid;
    gap: 8px;
  }

  .inverser {
    justify-self: center;
    width: 44px;
    height: 44px;
    border: 1px solid rgb(242 232 218 / 0.22);
    border-radius: 50%;
    background: var(--surface-1);
    color: var(--accent);
    font-size: 1.25rem;
  }

  .segment.debit:has(input:checked) {
    color: var(--debit);
  }

  .segment.credit:has(input:checked) {
    color: var(--credit);
  }

  .apercu {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-1);
    list-style: none;
    font-size: 0.875rem;
  }

  .apercu li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .apercu .nom {
    color: var(--texte-2);
    overflow-wrap: anywhere;
  }

  .negatif {
    color: var(--debit);
  }
</style>
