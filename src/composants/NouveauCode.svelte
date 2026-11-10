<script lang="ts">
  // Choix d'un nouveau code en deux saisies identiques, avec indicateur de solidité (sans bloquer).
  import SaisieCode from './SaisieCode.svelte';

  let { occupe = false, erreur = '', aide = '', onchoisi }: { occupe?: boolean; erreur?: string; aide?: string; onchoisi: (code: string) => void } =
    $props();

  let premier = $state<string | null>(null);
  let different = $state('');
</script>

{#if premier === null}
  <SaisieCode
    titre="Choisissez votre code"
    aide={aide || '6 chiffres minimum. 8 chiffres ou plus sont conseillés.'}
    erreur={different || erreur}
    avecSolidite
    onvalider={(c) => {
      different = '';
      premier = c;
    }}
  />
{:else}
  <SaisieCode
    titre="Confirmez votre code"
    aide="Saisissez le même code une seconde fois."
    {erreur}
    {occupe}
    onvalider={(c) => {
      if (c === premier) return onchoisi(c);
      premier = null;
      different = 'Les deux codes sont différents. Recommencez.';
    }}
  />
{/if}
