<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchPreview,
		getYouTubeVideoId,
		getSiteBrandColor,
		type LinkPreviewData
	} from '$lib/link-preview';

	let { url }: { url: string } = $props();

	let preview = $state<LinkPreviewData | null>(null);
	let loading = $state(true);
	let error = $state(false);
	let imgError = $state(false);
	let faviconError = $state(false);

	let youtubeId = $derived(getYouTubeVideoId(url));
	let brandColor = $derived(getSiteBrandColor(url, preview?.themeColor));

	let displayHost = $derived((() => {
		try { return new URL(url).hostname.replace(/^www\./, ''); }
		catch { return ''; }
	})());

	onMount(async () => {
		try {
			preview = await fetchPreview(url);
			if (!preview) error = true;
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="mt-2 flex items-center gap-2 text-xs text-[#5f6b82]">
		<div class="w-3 h-3 border-2 border-[#5f6b82] border-t-transparent rounded-full animate-spin"></div>
		Loading preview...
	</div>
{:else if preview && !error}
	<div
		class="mt-2 max-w-[420px] rounded-lg overflow-hidden bg-[#111622] border border-[#1b2230]"
		style="border-left: 3px solid {brandColor};"
	>
		{#if preview.image && !imgError}
			{#if youtubeId}
				<a href={url} target="_blank" rel="noopener noreferrer" class="block relative group">
					<img
						src={preview.image}
						alt=""
						class="w-full h-auto object-cover"
						onerror={() => imgError = true}
					/>
					<div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
						<svg class="w-14 h-14 text-white/90 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
							<path d="M8 5v14l11-7z"/>
						</svg>
					</div>
				</a>
			{:else}
				<a href={url} target="_blank" rel="noopener noreferrer" class="block">
					<img
						src={preview.image}
						alt=""
						class="w-full max-h-[200px] object-cover"
						onerror={() => imgError = true}
					/>
				</a>
			{/if}
		{/if}

		<div class="p-3">
			<!-- Site name / favicon -->
			<div class="flex items-center gap-1.5 mb-1">
				{#if preview.favicon && !faviconError}
					<img
						src={preview.favicon}
						alt=""
						class="w-4 h-4 rounded-sm"
						onerror={() => faviconError = true}
					/>
				{/if}
				<span class="text-[11px] text-[#8b95a8] truncate">
					{preview.siteName || displayHost}
				</span>
			</div>

			<!-- Title -->
			{#if preview.title}
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					class="block text-sm font-semibold text-[#5b9cf4] hover:underline leading-snug mb-1 line-clamp-2"
				>
					{preview.title}
				</a>
			{/if}

			<!-- Description -->
			{#if preview.description}
				<p class="text-xs text-[#b0b8c8] leading-relaxed line-clamp-3">
					{preview.description}
				</p>
			{/if}

			<!-- Price (Steam, etc.) -->
			{#if preview.price}
				<div class="mt-2 inline-flex items-center gap-1.5 bg-[#1b2230] rounded px-2 py-1">
					<span class="text-xs font-semibold text-[#a4d64e]">{preview.price}</span>
				</div>
			{/if}
		</div>
	</div>
{/if}
