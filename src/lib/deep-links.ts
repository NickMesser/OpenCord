import { browser } from '$app/environment';
import { goto } from '$app/navigation';

function isTauri(): boolean {
	return browser && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let initialized = false;

export async function initDeepLinks() {
	if (!isTauri() || initialized) return;
	initialized = true;

	try {
		const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
		await onOpenUrl((urls: string[]) => {
			for (const raw of urls) {
				handleDeepLink(raw);
			}
		});
	} catch {
		// Plugin not available
	}
}

function handleDeepLink(raw: string) {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'opencord:') return;

		// opencord://invite/<code> -> /invite/<code>
		const path = url.pathname.replace(/^\/\//, '/');
		const host = url.host;

		if (host === 'invite' || path.startsWith('/invite/')) {
			const code = host === 'invite' ? path.replace(/^\//, '') : path.replace('/invite/', '');
			if (code) {
				goto(`/invite/${code}`);
			}
		} else {
			const fullPath = host ? `/${host}${path}` : path;
			if (fullPath && fullPath !== '/') {
				goto(fullPath);
			}
		}
	} catch {
		// Invalid URL, ignore
	}
}
