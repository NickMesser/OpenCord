import { browser } from '$app/environment';

function isTauri(): boolean {
	return browser && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let notificationPermissionGranted = false;

export async function initNotifications() {
	if (!isTauri()) return;
	try {
		const { isPermissionGranted, requestPermission } = await import(
			'@tauri-apps/plugin-notification'
		);
		notificationPermissionGranted = await isPermissionGranted();
		if (!notificationPermissionGranted) {
			const result = await requestPermission();
			notificationPermissionGranted = result === 'granted';
		}
	} catch {
		// Plugin not available (running in web mode)
	}
}

export async function sendNativeNotification(title: string, body: string) {
	if (!isTauri() || !notificationPermissionGranted) return;
	if (typeof document !== 'undefined' && document.hasFocus()) return;

	try {
		const { sendNotification } = await import('@tauri-apps/plugin-notification');
		sendNotification({ title, body });
	} catch {
		// Silently ignore
	}
}
