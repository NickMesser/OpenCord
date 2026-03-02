<script lang="ts">
	import { extractUrls } from '$lib/link-preview';
	import LinkPreview from './LinkPreview.svelte';

	let { text }: { text: string } = $props();

	interface Segment {
		type: 'text' | 'url';
		value: string;
	}

	let segments = $derived((() => {
		const urlRe = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
		const result: Segment[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = urlRe.exec(text)) !== null) {
			if (match.index > lastIndex) {
				result.push({ type: 'text', value: text.slice(lastIndex, match.index) });
			}
			result.push({ type: 'url', value: match[0] });
			lastIndex = urlRe.lastIndex;
		}

		if (lastIndex < text.length) {
			result.push({ type: 'text', value: text.slice(lastIndex) });
		}

		return result;
	})());

	let urls = $derived(extractUrls(text));
</script>

<p class="text-[#e9eefc] text-sm break-words whitespace-pre-wrap">{#each segments as seg}{#if seg.type === 'url'}<a href={seg.value} target="_blank" rel="noopener noreferrer" class="text-[#5b9cf4] hover:underline">{seg.value}</a>{:else}{seg.value}{/if}{/each}</p>

{#each urls as linkUrl (linkUrl)}
	<LinkPreview url={linkUrl} />
{/each}
