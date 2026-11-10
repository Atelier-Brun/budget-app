<script lang="ts">
  // Fiche catégorie : nom et sens par défaut ; suppression si jamais utilisée, sinon archivage.
  import { untrack } from 'svelte';
  import { estInutilisee, type Categorie } from '../lib/categories';
  import { normaliserNom, NOM_MAX, verifierNom } from '../lib/noms';

  let {
    categorie,
    categories,
    operations,
    onenregistrer,
    onsupprimer,
    onretour,
  }: {
    categorie: Categorie;
    categories: Categorie[];
    operations: readonly { categorieId?: string }[];
    onenregistrer: (c: Categorie) => Promise<boolean>;
    onsupprimer: (id: string) => Promise<boolean>;
    onretour: () => void;
  } = $props();

  // Lu une seule fois à l'ouverture : rien n'est modifié avant « Enregistrer ».
  const { initial, nouvelle, inutilisee } = untrack(() => ({
    initial: $state.snapshot(categorie),
    nouvelle: !categories.some((c) => c.id === categorie.id),
    inutilisee: estInutilisee(categorie.id, operations),
  }));

  let nom = $state(initial.nom);
  let sens = $state(initial.sens);
  let erreur = $state('');
  let confirmer = $state(false);
  let occupe = $state(false);

  async function terminer(action: Promise<boolean>) {
    occupe = true;
    const ok = await action;
    occupe = false;
    if (ok) onretour();
  }

  function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    erreur = verifierNom(nom, initial.id, categories) ?? '';
    if (!erreur) void terminer(onenregistrer({ ...initial, nom: normaliserNom(nom), sens }));
  }
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Catégories</button>
  </header>
  <h1 class="titre-fiche">{nouvelle ? 'Nouvelle catégorie' : initial.nom}</h1>
  {#if initial.archive}<p class="secondaire">Catégorie archivée : masquée à la saisie, historique conservé.</p>{/if}

  <form class="carte formulaire" onsubmit={enregistrer} novalidate>
    <label class="champ">
      <span>Nom</span>
      <input bind:value={nom} maxlength={NOM_MAX + 10} autocapitalize="characters" autocomplete="off" spellcheck="false" />
    </label>

    <fieldset class="champ">
      <legend>Sens proposé à la saisie</legend>
      <div class="segments">
        <label class="segment"><input type="radio" name="sens" value="debit" bind:group={sens} />Débit</label>
        <label class="segment"><input type="radio" name="sens" value="credit" bind:group={sens} />Crédit</label>
      </div>
      <p class="aide secondaire">Modifiable lors de chaque saisie.</p>
    </fieldset>

    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    <button type="submit" class="bouton" disabled={occupe}>Enregistrer</button>
  </form>

  {#if !nouvelle}
    {#if initial.archive}
      <button type="button" class="bouton-discret action" disabled={occupe} onclick={() => terminer(onenregistrer({ ...initial, archive: false }))}>
        Réactiver cette catégorie
      </button>
    {:else if !confirmer}
      <button type="button" class="bouton-discret action" onclick={() => (confirmer = true)}>
        {inutilisee ? 'Supprimer cette catégorie…' : 'Archiver cette catégorie…'}
      </button>
    {:else}
      <div class="carte confirmation" role="group" aria-label="Confirmer">
        <p>
          {inutilisee
            ? 'Cette catégorie n’a jamais été utilisée : elle sera supprimée définitivement.'
            : 'Cette catégorie a déjà été utilisée : elle sera masquée à la saisie et son historique conservé. Elle pourra être réactivée.'}
        </p>
        <div class="boutons">
          <button type="button" class="bouton-discret" onclick={() => (confirmer = false)}>Annuler</button>
          <button
            type="button"
            class="bouton"
            disabled={occupe}
            onclick={() => terminer(inutilisee ? onsupprimer(initial.id) : onenregistrer({ ...initial, archive: true }))}
          >
            {inutilisee ? 'Supprimer' : 'Archiver'}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .aide {
    margin: 2px 0 0;
    font-size: 0.8125rem;
  }
</style>
