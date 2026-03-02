export interface LinkPreviewData {
	url: string;
	title?: string;
	description?: string;
	image?: string;
	siteName?: string;
	favicon?: string;
	price?: string;
	themeColor?: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

const cache = new Map<string, { data: LinkPreviewData | null; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const inflight = new Map<string, Promise<LinkPreviewData | null>>();

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function extractUrls(text: string): string[] {
	const matches = text.match(URL_REGEX);
	if (!matches) return [];
	const seen = new Set<string>();
	return matches.filter((u) => {
		if (seen.has(u)) return false;
		seen.add(u);
		return true;
	});
}

async function fetchPreviewViaTauri(url: string): Promise<LinkPreviewData | null> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<LinkPreviewData>('link_preview', { targetUrl: url });
}

async function fetchPreviewViaApi(url: string): Promise<LinkPreviewData | null> {
	const resp = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
	if (!resp.ok) return null;
	return resp.json();
}

export async function fetchPreview(url: string): Promise<LinkPreviewData | null> {
	const cached = cache.get(url);
	if (cached && Date.now() - cached.ts < CACHE_TTL) {
		return cached.data;
	}

	const existing = inflight.get(url);
	if (existing) return existing;

	const FAIL_TTL = 30_000;

	const p = (async () => {
		try {
			const data = isTauri()
				? await fetchPreviewViaTauri(url)
				: await fetchPreviewViaApi(url);
			if (!data) {
				cache.set(url, { data: null, ts: Date.now() - CACHE_TTL + FAIL_TTL });
				return null;
			}
			cache.set(url, { data, ts: Date.now() });
			return data;
		} catch {
			cache.set(url, { data: null, ts: Date.now() - CACHE_TTL + FAIL_TTL });
			return null;
		} finally {
			inflight.delete(url);
		}
	})();

	inflight.set(url, p);
	return p;
}

export function getYouTubeVideoId(url: string): string | null {
	try {
		const u = new URL(url);
		if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
		if (u.hostname.includes('youtube.com') && u.searchParams.has('v'))
			return u.searchParams.get('v');
	} catch { /* ignore */ }
	return null;
}

export function getSiteBrandColor(url: string, themeColor?: string): string {
	if (themeColor) return themeColor;
	try {
		const host = new URL(url).hostname;
		if (host.includes('youtube.com') || host === 'youtu.be') return '#FF0000';
		if (host.includes('steampowered.com') || host.includes('steamcommunity.com')) return '#1b2838';
		if (host.includes('github.com')) return '#8b5cf6';
		if (host.includes('twitter.com') || host.includes('x.com')) return '#1d9bf0';
		if (host.includes('reddit.com')) return '#FF4500';
		if (host.includes('twitch.tv')) return '#9146FF';
		if (host.includes('spotify.com')) return '#1DB954';
	} catch { /* ignore */ }
	return '#5865f2';
}
