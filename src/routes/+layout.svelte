<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initDeepLinks } from '$lib/deep-links';

	let { children } = $props();

	onMount(() => {
		initDeepLinks();
	});
</script>

<svelte:head>
	<title>OpenCord</title>
</svelte:head>

{@render children()}
