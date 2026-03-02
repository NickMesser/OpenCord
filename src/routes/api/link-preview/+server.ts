import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 512_000;
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

const BROWSER_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface OgData {
	url: string;
	title?: string;
	description?: string;
	image?: string;
	siteName?: string;
	favicon?: string;
	price?: string;
	themeColor?: string;
}

function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractMeta(html: string, origin: string): OgData {
	const data: OgData = { url: origin };

	const meta = (property: string): string | undefined => {
		const re = new RegExp(
			`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
			'i'
		);
		const match = html.match(re);
		if (match) return decodeHtmlEntities(match[1]);
		const reReverse = new RegExp(
			`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
			'i'
		);
		const m2 = html.match(reReverse);
		return m2 ? decodeHtmlEntities(m2[1]) : undefined;
	};

	data.title = meta('og:title') || meta('twitter:title');
	if (!data.title) {
		const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
		if (titleMatch) data.title = decodeHtmlEntities(titleMatch[1].trim());
	}

	data.description = meta('og:description') || meta('twitter:description') || meta('description');
	data.image = meta('og:image') || meta('twitter:image') || meta('twitter:image:src');
	data.siteName = meta('og:site_name');
	data.themeColor = meta('theme-color');

	if (data.image && !data.image.startsWith('http')) {
		try {
			data.image = new URL(data.image, origin).href;
		} catch { /* ignore */ }
	}

	try {
		const u = new URL(origin);
		data.favicon = `${u.origin}/favicon.ico`;
	} catch { /* ignore */ }

	const iconMatch = html.match(
		/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']*)["']/i
	);
	if (iconMatch?.[1]) {
		try {
			data.favicon = new URL(iconMatch[1], origin).href;
		} catch { /* ignore */ }
	}

	if (origin.includes('store.steampowered.com')) {
		const priceMatch = html.match(
			/<div class="game_purchase_price[^"]*"[^>]*>([^<]*)<\/div>/i
		) || html.match(
			/<div class="discount_final_price[^"]*"[^>]*>([^<]*)<\/div>/i
		);
		if (priceMatch?.[1]) {
			data.price = priceMatch[1].trim();
		}
	}

	return data;
}

function buildHeaders(targetUrl: string): Record<string, string> {
	const h: Record<string, string> = {
		'User-Agent': BROWSER_UA,
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.9',
		'Accept-Encoding': 'identity',
		'Cache-Control': 'no-cache',
		Pragma: 'no-cache'
	};

	if (targetUrl.includes('store.steampowered.com')) {
		h['Cookie'] = 'birthtime=0; wants_mature_content=1; lastagecheckage=1-0-2000; Steam_Language=english';
	}

	return h;
}

// Server-side in-memory cache to avoid refetching the same URL repeatedly
const serverCache = new Map<string, { data: OgData | null; ts: number }>();
const SERVER_CACHE_TTL = 60 * 60 * 1000;

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return json({ error: 'Missing url parameter' }, { status: 400 });
	}

	let parsed: URL;
	try {
		parsed = new URL(targetUrl);
	} catch {
		return json({ error: 'Invalid URL' }, { status: 400 });
	}

	if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
		return json({ error: 'Protocol not allowed' }, { status: 400 });
	}

	const cached = serverCache.get(targetUrl);
	if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) {
		if (!cached.data) return json({ error: 'No metadata found' }, { status: 404 });
		return json(cached.data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
	}

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

		const resp = await fetch(targetUrl, {
			signal: controller.signal,
			headers: buildHeaders(targetUrl),
			redirect: 'follow'
		});

		clearTimeout(timer);

		if (!resp.ok) {
			return json({ error: `Upstream returned ${resp.status}` }, { status: 502 });
		}

		const contentType = resp.headers.get('content-type') ?? '';
		if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
			return json({ error: 'Not an HTML page' }, { status: 422 });
		}

		const html = (await resp.text()).slice(0, MAX_HTML_BYTES);
		const data = extractMeta(html, targetUrl);

		if (!data.title && !data.description && !data.image) {
			serverCache.set(targetUrl, { data: null, ts: Date.now() });
			return json({ error: 'No metadata found' }, { status: 404 });
		}

		serverCache.set(targetUrl, { data, ts: Date.now() });

		return json(data, {
			headers: { 'Cache-Control': 'public, max-age=3600' }
		});
	} catch (e: any) {
		if (e?.name === 'AbortError') {
			return json({ error: 'Request timed out' }, { status: 504 });
		}
		return json({ error: 'Failed to fetch URL' }, { status: 502 });
	}
};
