import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { estDansUnCadre } from './anti-iframe';

const cible = document.getElementById('app');
if (!cible) throw new Error('Élément #app introuvable');

// Dans un cadre (iframe) : on n'affiche rien.
export default estDansUnCadre() ? undefined : mount(App, { target: cible });
