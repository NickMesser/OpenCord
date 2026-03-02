<script lang="ts">
	import { tick } from 'svelte';

	interface MenuItem {
		label: string;
		icon?: string;
		action: () => void;
		danger?: boolean;
		separator?: boolean;
	}

	let {
		x = 0,
		y = 0,
		items = [],
		visible = false,
		onclose = () => {},
	}: {
		x?: number;
		y?: number;
		items?: MenuItem[];
		visible?: boolean;
		onclose?: () => void;
	} = $props();

	let menuEl: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (visible && menuEl) {
			tick().then(() => {
				if (!menuEl) return;
				const rect = menuEl.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				if (rect.right > vw) menuEl.style.left = `${Math.max(4, vw - rect.width - 4)}px`;
				if (rect.bottom > vh) menuEl.style.top = `${Math.max(4, vh - rect.height - 4)}px`;
			});
		}
	});

	function handleClickOutside(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	$effect(() => {
		if (visible) {
			document.addEventListener('click', handleClickOutside, true);
			document.addEventListener('keydown', handleKeydown, true);
			return () => {
				document.removeEventListener('click', handleClickOutside, true);
				document.removeEventListener('keydown', handleKeydown, true);
			};
		}
	});
</script>

{#if visible}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={menuEl}
		class="fixed z-[100] min-w-[180px] py-1.5 bg-[#111418] border border-[#1b2230] rounded-lg shadow-2xl"
		style="left: {x}px; top: {y}px;"
	>
		{#each items as item}
			{#if item.separator}
				<div class="my-1 mx-2 border-t border-[#1b2230]"></div>
			{:else}
				<button
					onclick={() => { item.action(); onclose(); }}
					class="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors
						{item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[#e9eefc] hover:bg-[#5865f2]'}"
				>
					{#if item.icon}
						<span class="text-base leading-none w-5 text-center">{item.icon}</span>
					{/if}
					{item.label}
				</button>
			{/if}
		{/each}
	</div>
{/if}
