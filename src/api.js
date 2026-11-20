import { SHAPES, normalize, dimKey, f } from '../public/shapes.js';
import { insertProfile } from './db.js';
import { matches } from './catalog.js';
import { json } from './html.js';
import { notifyRequest } from './mail.js';

export async function handle(request, env, url, path, ctx) {
	if (path === '/api/match' && request.method === 'GET') {
		return match(env, url);
	}

	if (path === '/api/profiles' && request.method === 'POST') {
		return createProfile(request, env);
	}

	if (path === '/api/requests' && request.method === 'POST') {
		return createRequest(request, env, ctx);
	}

	return json({ error: 'Not found' }, 404);
}

function readDims(shape, source) {
	if (!SHAPES[shape]) {
		return null;
	}

	const raw = {};

	for (const [k] of SHAPES[shape].params) {
		raw[k] = source[k];
	}

	return normalize(shape, raw);
}

// GET /api/match?shape=angle&a=2&b=2&t=0.125
async function match(env, url) {
	const shape = url.searchParams.get('shape');
	const dims = readDims(shape, Object.fromEntries(url.searchParams));

	if (!dims) {
		return json({ error: 'invalid' }, 400);
	}

	const rows = await matches(env.DB, shape, dims);

	return json({ key: dimKey(shape, dims), matches: rows.slice(0, 12).map(p => ({ id: p.id, title: p.title, shape: p.shape, dims: p.dims, weight: p.weight, mills: p.mills, exact: p.dim_key === dimKey(shape, dims) })) });
}

async function body(request) {
	try {
		return await request.json();
	} catch {
		return {};
	}
}

// POST /api/profiles {shape, dims, website} — a customer-drawn profile, saved for review
async function createProfile(request, env) {
	const data = await body(request);

	if (data.website) {
		return json({ error: 'rejected' }, 400);
	}

	const dims = readDims(data.shape, data.dims || {});

	if (!dims) {
		return json({ error: 'invalid' }, 400);
	}

	const existing = await env.DB.prepare(`SELECT id, status FROM profiles WHERE dim_key = ? AND status != 'rejected' ORDER BY status = 'public' DESC LIMIT 1`).bind(dimKey(data.shape, dims)).first();

	if (existing) {
		return json({ id: existing.id, existing: true });
	}

	const id = await insertProfile(env.DB, data.shape, dims, { status: 'pending', source: 'customer' });

	return json({ id, existing: false });
}

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

// POST /api/requests {name, company, email, phone, city, message, lang, items: [...]}
async function createRequest(request, env, ctx) {
	const data = await body(request);

	if (data.website) {
		return json({ error: 'rejected' }, 400);
	}

	const contact = {
		name: clean(data.name, 100),
		company: clean(data.company, 120),
		email: clean(data.email, 160).toLowerCase(),
		phone: clean(data.phone, 40),
		city: clean(data.city, 120),
		message: clean(data.message, 2000),
		lang: data.lang === 'fr' ? 'fr' : 'en'
	};

	if (!contact.name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) {
		return json({ error: 'contact' }, 400);
	}

	const items = [];

	for (const raw of Array.isArray(data.items) ? data.items.slice(0, 50) : []) {
		const dims = readDims(raw.shape, raw.dims || {});

		if (!dims) {
			continue;
		}

		let profileId = Number(raw.profile_id) || null;

		if (profileId) {
			const row = await env.DB.prepare(`SELECT id FROM profiles WHERE id = ? AND dim_key = ?`).bind(profileId, dimKey(raw.shape, dims)).first();
			profileId = row ? row.id : null;
		}

		items.push({
			profile_id: profileId,
			title: SHAPES[raw.shape].title(dims),
			shape: raw.shape,
			dims,
			alloy: clean(raw.alloy, 60),
			finish: clean(raw.finish, 80),
			length: clean(raw.length, 40),
			quantity: Math.max(1, Math.min(100000, parseInt(raw.quantity, 10) || 1)),
			note: clean(raw.note, 200)
		});
	}

	if (!items.length) {
		return json({ error: 'items' }, 400);
	}

	const ref = 'MS-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4).toUpperCase();

	const row = await env.DB.prepare(`INSERT INTO requests (ref, name, company, email, phone, city, message, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
		.bind(ref, contact.name, contact.company, contact.email, contact.phone, contact.city, contact.message, contact.lang).first();

	await env.DB.batch(items.map(i => env.DB.prepare(`INSERT INTO request_items (request_id, profile_id, title, shape, dims, alloy, finish, length, quantity, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		.bind(row.id, i.profile_id, i.title, i.shape, JSON.stringify(i.dims), i.alloy, i.finish, i.length, i.quantity, i.note)));

	ctx.waitUntil(notifyRequest(env, { id: row.id, ref, ...contact }, items, new URL(request.url).origin).catch(error => console.error('mail', error)));

	return json({ ref });
}

export { f };
