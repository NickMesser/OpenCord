import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';

const isDesktop = process.env.TAURI_ENV_PLATFORM !== undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: isDesktop
			? adapterStatic({ fallback: 'index.html' })
			: adapterNode()
	}
};

export default config;
