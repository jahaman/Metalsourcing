/**
 * Metal Sourcing (metalsourcing.ca) — Cloudflare Worker.
 *
 * Public: catalog of aluminum profiles (one profile, many extruders' die numbers), search,
 * profile pages with alloy / length / finish choices, a custom-profile builder with a live
 * drawing, and a request list sent to us by email. No prices, shipping or payment.
 * Admin (/admin, password from the ADMIN_PASSWORD secret): requests, profiles and dies,
 * extruders, and the alloy / finish / length lists.
 */
import { ensureSchema } from './db.js';
import { translator } from './i18n.js';
import { json } from './html.js';
import * as site from './site.js';
import * as admin from './admin.js';
import * as api from './api.js';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '') || '/';

		try {
			await ensureSchema(env.DB);

			if (path === '/admin' || path.startsWith('/admin/')) {
				return await admin.handle(request, env, url, path);
			}

			if (path.startsWith('/api/')) {
				return await api.handle(request, env, url, path, ctx);
			}

			// Language: ?lang=fr|en sets a cookie, otherwise the cookie, otherwise the browser
			const asked = url.searchParams.get('lang');
			const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)lang=(en|fr)/);
			const browser = /^fr\b/i.test(request.headers.get('accept-language') || '') ? 'fr' : 'en';
			const lang = asked === 'fr' || asked === 'en' ? asked : (cookie ? cookie[1] : browser);
			const ctxSite = { env, url, path, lang, t: translator(lang) };

			let response = await site.handle(request, ctxSite);

			if (!response) {
				return env.ASSETS.fetch(request);
			}

			if (asked === 'fr' || asked === 'en') {
				response = new Response(response.body, response);
				response.headers.append('set-cookie', `lang=${asked}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
			}

			return response;
		} catch (error) {
			console.error(error);

			if (path.startsWith('/api/')) {
				return json({ error: 'Server error' }, 500);
			}

			return new Response('Something went wrong. Please try again in a moment.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
		}
	}
};
