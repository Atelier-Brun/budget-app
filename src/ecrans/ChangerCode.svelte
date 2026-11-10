<script lang="ts">
  // Changer le code : code actuel exigé, puis nouveau code. Seule l'enveloppe de la clé change : rien à rechiffrer.
  import NouveauCode from '../composants/NouveauCode.svelte';
  import SaisieCode from '../composants/SaisieCode.svelte';
  import { changerCode, ErreurCoffre, type Coffre } from '../lib/coffre';

  let { coffre, onenregistrer, onretour }: { coffre: Coffre; onenregistrer: (c: Coffre) => Promise<boolean>; onretour: () => void } = $props();

  let actuel = $state<string | null>(null);
  let occupe = $state(false);
  let erreur = $state('');

  async function nouveau(code: string) {
    if (actuel === null) return;
    occupe = true;
    erreur = '';
    try {
      const c = await changerCode(coffre, { code: actuel }, code);
      if (await onenregistrer(c)) return;
    } catch (e) {
      // Code actuel faux : on le redemande.
      if (e instanceof ErreurCoffre) {
        actuel = null;
        erreur = 'Code actuel incorrect.';
      }
    }
    occupe = false;
  }
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Réglages</button>
  </header>
  <h1 class="titre-fiche">Changer le code</h1>
  {#if actuel === null}
    <SaisieCode titre="Code actuel" {erreur} onvalider={(c) => ((erreur = ''), (actuel = c))} />
  {:else}
    <NouveauCode {occupe} {erreur} onchoisi={nouveau} />
  {/if}
</div>
