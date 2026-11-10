<script lang="ts">
  // Fiche compte : solde et raccourcis de saisie (Débit, Crédit, Virement), création et modification
  // (nom, type, solde et date de départ, principal), archivage.
  import { untrack } from 'svelte';
  import type { Depart } from './Saisie.svelte';
  import { afficherSolde, LIBELLES, lireSoldeDepart, normaliserPrincipal, TYPES, trierComptes, verifierType, type Compte } from '../lib/comptes';
  import { aujourdHui } from '../lib/dates';
  import { normaliserNom, NOM_MAX, verifierNom } from '../lib/noms';
  import { calculerSolde, verifierDepart } from '../lib/soldes';
  import type { OperationComplete } from '../lib/operations';

  let {
    compte,
    comptes,
    operations,
    retour,
    onenregistrer,
    onsaisir,
    onretour,
  }: {
    compte: Compte;
    comptes: Compte[];
    operations: OperationComplete[];
    retour: string;
    onenregistrer: (liste: Compte[]) => Promise<boolean>;
    /** Raccourci : ouvre la saisie avec ce compte déjà choisi. */
    onsaisir: (d: Depart) => void;
    onretour: () => void;
  } = $props();

  // Valeurs de départ du formulaire, lues une seule fois à l'ouverture (copie : rien n'est modifié avant « Enregistrer »).
  const { initial, nouveau, autresCourants } = untrack(() => ({
    initial: $state.snapshot(compte),
    nouveau: !comptes.some((c) => c.id === compte.id),
    autresCourants: trierComptes(comptes.filter((c) => c.id !== compte.id && c.type === 'courant' && !c.archive)),
  }));

  /** Type figé si le compte a déjà des virements (leurs deux écritures restent cohérentes). */
  const typeFige = untrack(() => verifierType(initial.id, initial.type, initial.type === 'tiers' ? 'courant' : 'tiers', operations));
  const solde = $derived(afficherSolde(initial.type, calculerSolde(initial, operations, aujourdHui())));

  let nom = $state(initial.nom);
  let type = $state(initial.type);
  let saisieSolde = $state(initial.soldeDepart ? (Math.abs(initial.soldeDepart) / 100).toFixed(2).replace('.', ',') : '');
  let negatif = $state(initial.soldeDepart < 0);
  let dateDepart = $state(initial.dateDepart);
  let principal = $state(initial.principal || !autresCourants.some((c) => c.principal));
  let erreur = $state('');
  let confirmerArchive = $state(false);
  let remplacant = $state(autresCourants[0]?.id ?? '');
  let occupe = $state(false);

  async function sauver(liste: Compte[], prefere?: string) {
    occupe = true;
    const ok = await onenregistrer(normaliserPrincipal(liste, prefere));
    occupe = false;
    if (ok) onretour();
  }

  function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    const lecture = lireSoldeDepart(saisieSolde, negatif);
    const message =
      verifierNom(nom, initial.id, comptes) ??
      verifierType(initial.id, initial.type, type, operations) ??
      (lecture.ok ? verifierDepart(initial.id, lecture.centimes, dateDepart, operations) : lecture.erreur);
    if (message || !lecture.ok) {
      erreur = message ?? '';
      return;
    }
    erreur = '';
    const modifie: Compte = { ...initial, nom: normaliserNom(nom), type, soldeDepart: lecture.centimes, dateDepart };
    void sauver([...comptes.filter((c) => c.id !== initial.id), modifie], principal && type === 'courant' ? initial.id : undefined);
  }

  function changerArchive(archive: boolean) {
    const liste = comptes.map((c) => (c.id === initial.id ? { ...c, archive } : c));
    void sauver(liste, archive && initial.principal ? remplacant || undefined : undefined);
  }
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ {retour}</button>
  </header>
  <h1 class="titre-fiche">{nouveau ? 'Nouveau compte' : initial.nom}</h1>
  {#if initial.archive}<p class="secondaire">Compte archivé : masqué partout, historique conservé.</p>{/if}

  {#if !nouveau && !initial.archive}
    <div class="resume carte">
      <p class="solde-actuel">
        <span class="secondaire">Solde</span>
        <strong class:negatif={solde.negatif}>{solde.texte}</strong>
      </p>
      <div class="raccourcis">
        <button type="button" class="bouton-discret debit" onclick={() => onsaisir({ compteId: initial.id, sens: 'debit' })}>Débit</button>
        <button type="button" class="bouton-discret credit" onclick={() => onsaisir({ compteId: initial.id, sens: 'credit' })}>Crédit</button>
        <button type="button" class="bouton-discret" onclick={() => onsaisir({ compteId: initial.id, mode: 'virement' })}>Virement</button>
      </div>
    </div>
  {/if}

  <form class="carte formulaire" onsubmit={enregistrer} novalidate>
    <label class="champ">
      <span>Nom</span>
      <input bind:value={nom} maxlength={NOM_MAX + 10} autocapitalize="characters" autocomplete="off" spellcheck="false" />
    </label>

    <fieldset class="champ">
      <legend>Type</legend>
      <div class="segments">
        {#each TYPES as t (t)}
          <label class="segment"><input type="radio" name="type" value={t} bind:group={type} disabled={!!typeFige && t !== initial.type} />{LIBELLES[t].un}</label>
        {/each}
      </div>
      {#if typeFige}<p class="aide secondaire">{typeFige}</p>{/if}
    </fieldset>

    <fieldset class="champ">
      <legend>Solde de départ</legend>
      <div class="solde">
        <div class="segments signe">
          <label class="segment"><input type="radio" name="signe" value={false} bind:group={negatif} aria-label="Positif" />+</label>
          <label class="segment"><input type="radio" name="signe" value={true} bind:group={negatif} aria-label="Négatif" />−</label>
        </div>
        <input bind:value={saisieSolde} inputmode="decimal" placeholder="0,00" aria-label="Montant du solde de départ" autocomplete="off" />
        <span class="secondaire">€</span>
      </div>
      {#if type === 'tiers'}
        <p class="aide secondaire">Solde positif : somme due au tiers · Solde négatif : somme due par le tiers</p>
      {/if}
    </fieldset>

    <label class="champ">
      <span>Date de départ</span>
      <input type="date" bind:value={dateDepart} required />
    </label>

    {#if type === 'courant' && !initial.archive}
      <label class="interrupteur">
        <span>
          Compte principal
          <small class="secondaire">
            {initial.principal ? 'Pour changer, activer cette option sur un autre compte courant.' : 'Proposé par défaut dans la saisie rapide.'}
          </small>
        </span>
        <input type="checkbox" role="switch" bind:checked={principal} disabled={initial.principal} />
      </label>
    {/if}

    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    <button type="submit" class="bouton" disabled={occupe}>Enregistrer</button>
  </form>

  {#if !nouveau}
    {#if initial.archive}
      <button type="button" class="bouton-discret action" disabled={occupe} onclick={() => changerArchive(false)}>Réactiver ce compte</button>
    {:else if !confirmerArchive}
      <button type="button" class="bouton-discret action" onclick={() => (confirmerArchive = true)}>Archiver ce compte…</button>
    {:else}
      <div class="carte confirmation" role="group" aria-label="Confirmer l'archivage">
        <p>Le compte sera masqué partout et son historique conservé. Il pourra être réactivé.</p>
        {#if initial.principal && autresCourants.length > 0}
          <label class="champ">
            <span>Nouveau compte principal</span>
            <select bind:value={remplacant}>
              {#each autresCourants as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
            </select>
          </label>
        {/if}
        <div class="boutons">
          <button type="button" class="bouton-discret" onclick={() => (confirmerArchive = false)}>Annuler</button>
          <button type="button" class="bouton" disabled={occupe} onclick={() => changerArchive(true)}>Archiver</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .resume {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
    padding: 14px 16px;
  }

  .solde-actuel {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0;
  }

  .solde-actuel strong {
    font-size: 1.375rem;
  }

  .raccourcis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .raccourcis .debit {
    color: var(--debit);
  }

  .raccourcis .credit {
    color: var(--credit);
  }

  .negatif {
    color: var(--debit);
  }

  .solde {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .signe {
    flex: none;
    width: 96px;
    font-size: 1.125rem;
  }

  .aide {
    margin: 2px 0 0;
    font-size: 0.8125rem;
  }

  .interrupteur {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 48px;
  }

  .interrupteur small {
    display: block;
    font-size: 0.8125rem;
  }

  .interrupteur input {
    flex: none;
    width: 28px;
    height: 28px;
    accent-color: var(--accent);
  }

</style>
