<script lang="ts">
	import { tick } from 'svelte';

	let {
		x = 0,
		y = 0,
		visible = false,
		onselect = (_emoji: string) => {},
		onclose = () => {},
	}: {
		x?: number;
		y?: number;
		visible?: boolean;
		onselect?: (emoji: string) => void;
		onclose?: () => void;
	} = $props();

	const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
		{
			label: 'Smileys',
			emojis: ['😀','😂','🤣','😊','😍','🥰','😎','🤩','😏','😢','😭','😤','🤯','🥳','😴','🤔','🙄','😬','🫡','🫠']
		},
		{
			label: 'Gestures',
			emojis: ['👍','👎','👏','🙌','🤝','✌️','🤞','💪','🫶','🖐️']
		},
		{
			label: 'Hearts',
			emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥']
		},
		{
			label: 'Objects',
			emojis: ['🔥','⭐','💯','✅','❌','⚡','💀','👀','🎉','🚀']
		},
	];

	let pickerEl: HTMLDivElement | null = $state(null);
	let search = $state('');

	let filteredGroups = $derived(
		search.trim()
			? [{ label: 'Results', emojis: EMOJI_GROUPS.flatMap(g => g.emojis).filter(e => e.includes(search.trim())) }]
			: EMOJI_GROUPS
	);

	$effect(() => {
		if (visible && pickerEl) {
			tick().then(() => {
				if (!pickerEl) return;
				const rect = pickerEl.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				if (rect.right > vw) pickerEl.style.left = `${Math.max(4, vw - rect.width - 4)}px`;
				if (rect.bottom > vh) pickerEl.style.top = `${Math.max(4, vh - rect.height - 4)}px`;
			});
		}
	});

	function handleClickOutside(e: MouseEvent) {
		if (pickerEl && !pickerEl.contains(e.target as Node)) {
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
		bind:this={pickerEl}
		class="fixed z-[110] w-72 bg-[#111418] border border-[#1b2230] rounded-lg shadow-2xl overflow-hidden"
		style="left: {x}px; top: {y}px;"
	>
		<div class="p-2">
			<input
				type="text"
				bind:value={search}
				placeholder="Search emoji..."
				class="w-full bg-[#0b0d12] border border-[#1b2230] text-[#e9eefc] rounded-md px-2.5 py-1.5 text-sm outline-none placeholder-[#8b95a8] focus:border-[#5865f2]"
			/>
		</div>
		<div class="max-h-52 overflow-y-auto px-2 pb-2">
			{#each filteredGroups as group}
				{#if group.emojis.length > 0}
					<div class="text-[10px] uppercase tracking-wider text-[#8b95a8] font-semibold px-1 py-1 mt-1">{group.label}</div>
					<div class="grid grid-cols-8 gap-0.5">
						{#each group.emojis as emoji}
							<button
								onclick={() => { onselect(emoji); onclose(); }}
								class="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-[#5865f2]/20 transition-colors"
								title={emoji}
							>
								{emoji}
							</button>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/if}
