<script lang="ts">
  // Fiche échéance : libellé, compte, catégorie, sens, montant, fréquence, prochaine date, fin, dernière différente.
  // Modifier une échéance ne touche jamais aux opérations déjà validées. Suppression seulement si jamais validée.
  import { untrack } from 'svelte';
  import { trierCategories, type Categorie } from '../lib/categories';
  import { trierComptes, type Compte } from '../lib/comptes';
  import { estDateValide } from '../lib/dates';
  import { prochaine, rebaser, verifierEcheance, type Echeance, type Fin } from '../lib/echeances';
  import { lireMontant } from '../lib/montants';
  import { NOM_MAX, normaliserNom } from '../lib/noms';

  let {
    echeance,
    echeances,
    comptes,
    categories,
    onenregistrer,
    onsupprimer,
    onretour,
  }: {
    echeance: Echeance;
    echeances: Echeance[];
    comptes: Compte[];
    categories: Categorie[];
    onenregistrer: (e: Echeance) => Promise<boolean>;
    onsupprimer: (id: string) => Promise<boolean>;
    onretour: () => void;
  } = $props();

  // Lu une seule fois à l'ouverture : rien n'est modifié avant « Enregistrer ».
  const { initial, nouvelle } = untrack(() => ({ initial: $state.snapshot(echeance), nouvelle: !echeances.some((e) => e.id === echeance.id) }));
  const enCours = prochaine(initial);
  const texteMontant = (c: number | undefined) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');

  let nom = $state(initial.nom);
  let compteId = $state(initial.compteId);
  let categorieId = $state(initial.categorieId ?? '');
  let sens = $state(initial.sens);
  let sensChoisi = !nouvelle; // un sens choisi exprès n'est plus changé par la catégorie
  let montant = $state(texteMontant(initial.montant));
  let frequence = $state(initial.frequence);
  let date = $state(enCours?.date ?? initial.debut);
  let finType = $state(initial.fin.type);
  let restantes = $state(initial.fin.type === 'nombre' ? String(initial.fin.nombre - initial.prochaine) : '');
  let finDate = $state(initial.fin.type === 'date' ? initial.fin.date : '');
  let derniere = $state(initial.dernierMontant !== undefined);
  let dernierMontant = $state(texteMontant(initial.dernierMontant));
  let erreur = $state('');
  let confirmer = $state(false);
  let occupe = $state(false);

  const actifs = $derived(trierComptes(comptes.filter((c) => !c.archive || c.id === initial.compteId)));
  const choix = $derived(trierCategories(categories.filter((c) => !c.archive || c.id === initial.categorieId)));
  const typeCompte = $derived(comptes.find((c) => c.id === compteId)?.type);

  function choisirCategorie() {
    const c = categories.find((x) => x.id === categorieId);
    if (c && !sensChoisi) sens = c.sens;
  }

  async function terminer(action: Promise<boolean>) {
    occupe = true;
    const ok = await action;
    occupe = false;
    if (ok) onretour();
  }

  function enregistrer(e: SubmitEvent) {
    e.preventDefault();
    const m = lireMontant(montant);
    if (!m.ok) return void (erreur = m.erreur);
    const dm = derniere ? lireMontant(dernierMontant) : null;
    if (dm && !dm.ok) return void (erreur = `Dernière échéance : ${dm.erreur}`);
    if (!estDateValide(date)) return void (erreur = 'Date de la prochaine échéance invalide.');
    const n = Number(restantes);
    if (finType === 'nombre' && !(Number.isInteger(n) && n >= 1 && n <= 1200)) return void (erreur = 'Nombre d’échéances invalide (1 à 1 200).');
    // Changer la date ou la fréquence d'une échéance entamée : la prochaine devient la nouvelle échéance n° 0.
    const calendrierChange = !nouvelle && (date !== enCours?.date || frequence !== initial.frequence);
    let base: Echeance = { ...initial, frequence };
    base = calendrierChange || nouvelle ? rebaser(base, date) : base;
    const fin: Fin =
      finType === 'nombre' ? { type: 'nombre', nombre: base.prochaine + (Number.isInteger(n) ? n : 0) } : finType === 'date' ? { type: 'date', date: finDate } : { type: 'aucune' };
    const { categorieId: _c, dernierMontant: _d, ...reste } = base;
    const modifiee: Echeance = {
      ...reste,
      nom: normaliserNom(nom),
      compteId,
      ...(categorieId ? { categorieId } : {}),
      sens,
      montant: m.centimes,
      fin,
      ...(dm?.ok ? { dernierMontant: dm.centimes } : {}),
    };
    erreur = verifierEcheance(modifiee, typeCompte) ?? '';
    if (!erreur) void terminer(onenregistrer(modifiee));
  }
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Échéancier</button>
  </header>
  <h1 class="titre-fiche">{nouvelle ? 'Nouvelle échéance' : initial.nom}</h1>
  {#if initial.archive}<p class="secondaire">Échéance arrêtée : plus proposée, historique conservé.</p>{/if}

  <form class="carte formulaire" onsubmit={enregistrer} novalidate>
    <label class="champ">
      <span>Libellé</span>
      <input bind:value={nom} maxlength={NOM_MAX + 10} autocapitalize="characters" autocomplete="off" spellcheck="false" />
    </label>
    <label class="champ">
      <span>Compte</span>
      <select bind:value={compteId}>
        <option value="" disabled>Choisir…</option>
        {#each actifs as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
      </select>
    </label>
    <label class="champ">
      <span>Catégorie{typeCompte === 'tiers' ? ' (facultative)' : ''}</span>
      <select bind:value={categorieId} onchange={choisirCategorie}>
        <option value="" disabled={typeCompte !== 'tiers'}>{typeCompte === 'tiers' ? 'Aucune' : 'Choisir…'}</option>
        {#each choix as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
      </select>
    </label>
    <fieldset class="champ">
      <legend>Sens</legend>
      <div class="segments">
        <label class="segment"><input type="radio" name="sens" value="debit" bind:group={sens} onchange={() => (sensChoisi = true)} />Débit</label>
        <label class="segment"><input type="radio" name="sens" value="credit" bind:group={sens} onchange={() => (sensChoisi = true)} />Crédit</label>
      </div>
    </fieldset>
    <label class="champ">
      <span>Montant</span>
      <input bind:value={montant} inputmode="decimal" placeholder="0,00" autocomplete="off" />
    </label>
    <fieldset class="champ">
      <legend>Fréquence</legend>
      <div class="segments">
        <label class="segment"><input type="radio" name="frequence" value="mensuelle" bind:group={frequence} />Jour fixe du mois</label>
        <label class="segment"><input type="radio" name="frequence" value="28j" bind:group={frequence} />Toutes les 4 semaines</label>
      </div>
    </fieldset>
    <label class="champ">
      <span>Prochaine échéance</span>
      <input type="date" bind:value={date} />
    </label>
    <fieldset class="champ">
      <legend>Fin</legend>
      <div class="segments">
        <label class="segment"><input type="radio" name="fin" value="aucune" bind:group={finType} />Sans fin</label>
        <label class="segment"><input type="radio" name="fin" value="nombre" bind:group={finType} />Nombre</label>
        <label class="segment"><input type="radio" name="fin" value="date" bind:group={finType} />Date</label>
      </div>
    </fieldset>
    {#if finType === 'nombre'}
      <label class="champ">
        <span>Échéances restantes (la prochaine comprise)</span>
        <input bind:value={restantes} inputmode="numeric" autocomplete="off" />
      </label>
    {:else if finType === 'date'}
      <label class="champ">
        <span>Date de la dernière échéance</span>
        <input type="date" bind:value={finDate} />
      </label>
    {/if}
    {#if finType !== 'aucune'}
      <label class="case"><input type="checkbox" bind:checked={derniere} /> Dernière échéance d’un montant différent</label>
      {#if derniere}
        <label class="champ">
          <span>Montant de la dernière échéance</span>
          <input bind:value={dernierMontant} inputmode="decimal" placeholder="0,00" autocomplete="off" />
        </label>
      {/if}
    {/if}

    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    <button type="submit" class="bouton" disabled={occupe}>Enregistrer</button>
  </form>

  {#if !nouvelle}
    {#if initial.archive}
      <button type="button" class="bouton-discret action" disabled={occupe} onclick={() => terminer(onenregistrer({ ...initial, archive: false }))}>
        Reprendre cette échéance
      </button>
    {:else if !confirmer}
      <button type="button" class="bouton-discret action" onclick={() => (confirmer = true)}>
        {initial.prochaine === 0 ? 'Supprimer cette échéance…' : 'Arrêter cette échéance…'}
      </button>
    {:else}
      <div class="carte confirmation" role="group" aria-label="Confirmer">
        <p>
          {initial.prochaine === 0
            ? 'Cette échéance n’a jamais été validée : elle sera supprimée définitivement.'
            : 'Elle ne sera plus proposée. Les opérations déjà validées restent dans le carnet. Elle pourra être reprise.'}
        </p>
        <div class="boutons">
          <button type="button" class="bouton-discret" onclick={() => (confirmer = false)}>Annuler</button>
          <button
            type="button"
            class="bouton"
            disabled={occupe}
            onclick={() => terminer(initial.prochaine === 0 ? onsupprimer(initial.id) : onenregistrer({ ...initial, archive: true }))}
          >
            {initial.prochaine === 0 ? 'Supprimer' : 'Arrêter'}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .case {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }

  .case input {
    width: 22px;
    height: 22px;
    accent-color: var(--accent);
  }
</style>
