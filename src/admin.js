import { SHAPES, drawing, f, trim, normalize, dimKey, weightPerFoot, title as shapeTitle } from '../public/shapes.js';
import { e, html, redirect, adminPage, logo } from './html.js';
import { insertProfile, parseProfile } from './db.js';
import { getProfile, manufacturers, options, matches } from './catalog.js';
import { profileUrl } from './site.js';

const COOKIE = 'ms_admin';
const SESSION_DAYS = 7;
const STATUSES = ['new', 'in progress', 'quoted', 'closed'];

/* ------------------------------------------------------------------ session */

async function hmac(secret, text) {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));

	return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function same(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function signedIn(request, env) {
	const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([a-f0-9]{64})`));

	if (!m || !env.ADMIN_PASSWORD || Number(m[1]) < Date.now()) {
		return false;
	}

	return same(m[2], await hmac(env.ADMIN_PASSWORD, 'admin:' + m[1]));
}

async function form(request) {
	const data = await request.formData();
	const out = {};

	for (const [k, v] of data) {
		out[k] = typeof v === 'string' ? v.trim() : v;
	}

	return out;
}

/* ------------------------------------------------------------------ router */

export async function handle(request, env, url, path) {
	if (path === '/admin/login') {
		return login(request, env);
	}

	if (!(await signedIn(request, env))) {
		return redirect('/admin/login');
	}

	const post = request.method === 'POST';
	const flash = url.searchParams.get('ok') || '';
	const db = env.DB;
	let m;

	if (path === '/admin/logout' && post) {
		return redirect('/admin/login', { 'set-cookie': `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
	}

	if (path === '/admin') return dashboard(db, flash);
	if (path === '/admin/requests') return requestsList(db, url, flash);
	if ((m = path.match(/^\/admin\/requests\/(\d+)$/))) return post ? requestSave(db, request, Number(m[1])) : requestView(db, Number(m[1]), flash);
	if (path === '/admin/profiles') return profilesList(db, url, flash);
	if (path === '/admin/profiles/new') return post ? profileSave(db, request, 0) : profileEdit(db, 0, flash, url);
	if ((m = path.match(/^\/admin\/profiles\/(\d+)$/))) return post ? profileSave(db, request, Number(m[1])) : profileEdit(db, Number(m[1]), flash, url);
	if ((m = path.match(/^\/admin\/profiles\/(\d+)\/dies$/)) && post) return dieSave(db, request, Number(m[1]));
	if (path === '/admin/manufacturers') return post ? manufacturerSave(db, request) : manufacturersPage(db, flash);
	if (path === '/admin/options') return post ? optionSave(db, request) : optionsPage(db, flash);

	return html(adminPage({ title: 'Not found', body: '<h1>Not found</h1>' }), { status: 404 });
}

/* ------------------------------------------------------------------ login */

async function login(request, env) {
	let error = '';

	if (!env.ADMIN_PASSWORD) {
		error = 'The admin password is not set yet. In Cloudflare: Workers & Pages → metalsourcing → Settings → Variables and Secrets → add a Secret named ADMIN_PASSWORD, then reload.';
	} else if (request.method === 'POST') {
		const data = await form(request);

		if (same(await hmac('cmp', String(data.password || '')), await hmac('cmp', env.ADMIN_PASSWORD))) {
			const expires = Date.now() + SESSION_DAYS * 86400000;
			const cookie = `${COOKIE}=${expires}.${await hmac(env.ADMIN_PASSWORD, 'admin:' + expires)}; Path=/admin; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;

			return redirect('/admin', { 'set-cookie': cookie });
		}

		await new Promise(r => setTimeout(r, 800));
		error = 'Wrong password.';
	}

	return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Sign in · Metal Sourcing admin</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head>
<body class="ms-admin ms-login"><main><form method="post" class="ms-login__box">
<a href="/" class="ms-logo">${logo()}<span><b>Metal</b>Sourcing <em>admin</em></span></a>
${error ? `<p class="ms-error">${e(error)}</p>` : ''}
${env.ADMIN_PASSWORD ? `<label class="ms-field"><span>Password</span><input type="password" name="password" required autofocus autocomplete="current-password"></label><button class="ms-btn ms-btn--primary">Sign in</button>` : ''}
</form></main></body></html>`, { status: error && request.method === 'POST' ? 401 : 200 });
}

/* ------------------------------------------------------------------ dashboard */

async function dashboard(db, flash) {
	const n = async sql => (await db.prepare(sql).first('n')) || 0;
	const stats = [
		['New requests', await n(`SELECT COUNT(*) AS n FROM requests WHERE status = 'new'`), '/admin/requests?status=new'],
		['Profiles awaiting review', await n(`SELECT COUNT(*) AS n FROM profiles WHERE status = 'pending'`), '/admin/profiles?status=pending'],
		['Public profiles', await n(`SELECT COUNT(*) AS n FROM profiles WHERE status = 'public'`), '/admin/profiles'],
		['Dies', await n(`SELECT COUNT(*) AS n FROM dies`), '/admin/manufacturers']
	];
	const latest = (await db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM request_items i WHERE i.request_id = r.id) AS items FROM requests r ORDER BY r.id DESC LIMIT 8`).all()).results;
	const pending = (await db.prepare(`SELECT * FROM profiles WHERE status = 'pending' ORDER BY id DESC LIMIT 8`).all()).results.map(parseProfile);

	const body = `<h1>Dashboard</h1>
<div class="ms-stats">${stats.map(([label, value, href]) => `<a href="${href}" class="ms-stat"><b>${value}</b><span>${label}</span></a>`).join('')}</div>
<div class="ms-admin__cols">
  <section><h2>Latest requests</h2>${requestTable(latest)}</section>
  <section><h2>Customer profiles to review</h2>${pending.length ? `<ul class="ms-list">${pending.map(p => `<li><a href="/admin/profiles/${p.id}">${drawing(p.shape, p.dims, { compact: true, size: 40 })} ${e(p.title)}</a></li>`).join('')}</ul>` : '<p class="ms-hint">Nothing to review.</p>'}</section>
</div>`;

	return html(adminPage({ title: 'Dashboard', body, active: 'dashboard', flash }));
}

/* ------------------------------------------------------------------ requests */

function requestTable(rows) {
	if (!rows.length) return '<p class="ms-hint">No requests yet.</p>';

	return `<table class="ms-table ms-table--admin"><thead><tr><th>Ref</th><th>Date</th><th>Customer</th><th>Items</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr>
<td><a href="/admin/requests/${r.id}" class="ms-mono">${e(r.ref)}</a></td><td>${e(r.created_at.slice(0, 16))}</td><td>${e(r.company || r.name)}<br><small>${e(r.email)}</small></td><td>${r.items}</td><td><span class="ms-status ms-status--${e(r.status.replace(' ', '-'))}">${e(r.status)}</span></td></tr>`).join('')}</tbody></table>`;
}

async function requestsList(db, url, flash) {
	const status = STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : '';
	const rows = (await db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM request_items i WHERE i.request_id = r.id) AS items FROM requests r ${status ? 'WHERE status = ?' : ''} ORDER BY r.id DESC LIMIT 200`).bind(...(status ? [status] : [])).all()).results;
	const tabs = [['', 'All']].concat(STATUSES.map(s => [s, s])).map(([s, label]) => `<a href="/admin/requests${s ? '?status=' + encodeURIComponent(s) : ''}"${s === status ? ' aria-current="page"' : ''}>${e(label)}</a>`).join('');

	return html(adminPage({ title: 'Requests', active: 'requests', flash, body: `<h1>Requests</h1><nav class="ms-tabs">${tabs}</nav>${requestTable(rows)}` }));
}

async function requestView(db, id, flash) {
	const r = await db.prepare(`SELECT * FROM requests WHERE id = ?`).bind(id).first();

	if (!r) return html(adminPage({ title: 'Not found', body: '<h1>Not found</h1>' }), { status: 404 });

	const items = (await db.prepare(`SELECT i.*, p.status AS profile_status FROM request_items i LEFT JOIN profiles p ON p.id = i.profile_id WHERE i.request_id = ? ORDER BY i.id`).bind(id).all()).results;

	const rows = items.map(i => {
		const dims = JSON.parse(i.dims);
		const link = i.profile_id ? `<a href="/admin/profiles/${i.profile_id}">${e(i.title)}</a>${i.profile_status === 'pending' ? ' <span class="ms-badge ms-badge--warn">pending</span>' : ''}` : `${e(i.title)} <span class="ms-badge">custom</span>`;

		return `<tr><td class="ms-fig-cell">${drawing(i.shape, dims, { compact: true, size: 48 })}</td><td>${link}<br><small class="ms-mono">${SHAPES[i.shape].params.map(([k, l]) => `${l}: ${f(dims[k])}`).join(' · ')}</small></td><td>${e(i.alloy)}</td><td>${e(i.finish)}</td><td>${e(i.length)}</td><td>${i.quantity}</td><td>${e(i.note)}</td></tr>`;
	}).join('');

	const body = `<nav class="ms-crumbs"><a href="/admin/requests">Requests</a></nav>
<h1>Request <span class="ms-mono">${e(r.ref)}</span></h1>
<div class="ms-admin__cols">
  <section class="ms-panel">
    <h2>Customer</h2>
    <dl class="ms-dl"><dt>Name</dt><dd>${e(r.name)}</dd><dt>Company</dt><dd>${e(r.company) || '—'}</dd><dt>Email</dt><dd><a href="mailto:${e(r.email)}?subject=${encodeURIComponent('Your request ' + r.ref)}">${e(r.email)}</a></dd><dt>Phone</dt><dd>${e(r.phone) || '—'}</dd><dt>City</dt><dd>${e(r.city) || '—'}</dd><dt>Language</dt><dd>${e(r.lang)}</dd><dt>Received</dt><dd>${e(r.created_at)} UTC</dd></dl>
    ${r.message ? `<h3>Message</h3><p class="ms-pre">${e(r.message)}</p>` : ''}
  </section>
  <form method="post" class="ms-panel">
    <h2>Follow-up</h2>
    <label class="ms-field"><span>Status</span><select name="status">${STATUSES.map(s => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="ms-field"><span>Internal notes</span><textarea name="admin_notes" rows="5">${e(r.admin_notes)}</textarea></label>
    <button class="ms-btn ms-btn--primary">Save</button>
  </form>
</div>
<h2>Items</h2>
<table class="ms-table ms-table--admin"><thead><tr><th></th><th>Profile</th><th>Alloy</th><th>Finish</th><th>Length</th><th>Qty</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;

	return html(adminPage({ title: 'Request ' + r.ref, active: 'requests', flash, body }));
}

async function requestSave(db, request, id) {
	const data = await form(request);
	const status = STATUSES.includes(data.status) ? data.status : 'new';

	await db.prepare(`UPDATE requests SET status = ?, admin_notes = ? WHERE id = ?`).bind(status, String(data.admin_notes || '').slice(0, 5000), id).run();

	return redirect(`/admin/requests/${id}?ok=Saved`);
}

/* ------------------------------------------------------------------ profiles */

async function profilesList(db, url, flash) {
	const status = ['public', 'pending', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : '';
	const shape = SHAPES[url.searchParams.get('shape')] ? url.searchParams.get('shape') : '';
	const where = [];
	const args = [];

	if (status) { where.push('p.status = ?'); args.push(status); }
	if (shape) { where.push('p.shape = ?'); args.push(shape); }

	const rows = (await db.prepare(`SELECT p.*, (SELECT GROUP_CONCAT(m.name || ' ' || d.die_number, ', ') FROM dies d JOIN manufacturers m ON m.id = d.manufacturer_id WHERE d.profile_id = p.id) AS die_list
		FROM profiles p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.status = 'pending' DESC, p.shape, p.weight LIMIT 500`).bind(...args).all()).results.map(parseProfile);

	const filters = `<form class="ms-filters"><select name="status" onchange="this.form.submit()"><option value="">All statuses</option>${['public', 'pending', 'rejected'].map(s => `<option${s === status ? ' selected' : ''}>${s}</option>`).join('')}</select>
<select name="shape" onchange="this.form.submit()"><option value="">All shapes</option>${Object.entries(SHAPES).map(([k, d]) => `<option value="${k}"${k === shape ? ' selected' : ''}>${d.name}</option>`).join('')}</select>
<a class="ms-btn ms-btn--primary" href="/admin/profiles/new">Add profile</a></form>`;

	const table = `<table class="ms-table ms-table--admin"><thead><tr><th></th><th>Profile</th><th>lb/ft</th><th>Dies</th><th>Source</th><th>Status</th></tr></thead><tbody>${rows.map(p => `<tr>
<td class="ms-fig-cell">${drawing(p.shape, p.dims, { compact: true, size: 40 })}</td><td><a href="/admin/profiles/${p.id}">${e(p.title)}</a></td><td>${trim(p.weight.toFixed(3))}</td><td><small>${e(p.die_list || '—')}</small></td><td>${e(p.source)}</td><td><span class="ms-status ms-status--${e(p.status)}">${e(p.status)}</span></td></tr>`).join('')}</tbody></table>`;

	return html(adminPage({ title: 'Profiles', active: 'profiles', flash, body: `<h1>Profiles <small>${rows.length}</small></h1>${filters}${table}` }));
}

async function profileEdit(db, id, flash, url) {
	const p = id ? await getProfile(db, id) : null;

	if (id && !p) return html(adminPage({ title: 'Not found', body: '<h1>Not found</h1>' }), { status: 404 });

	const shape = p ? p.shape : (SHAPES[url.searchParams.get('shape')] ? url.searchParams.get('shape') : 'angle');
	const makers = await manufacturers(db, false);
	const similarRows = p ? (await matches(db, p.shape, p.dims, { includePending: true })).filter(x => x.id !== p.id) : [];

	const shapeField = p ? `<p><b>${e(SHAPES[shape].name)}</b> <input type="hidden" name="shape" value="${shape}"></p>`
		: `<label class="ms-field"><span>Shape</span><select name="shape" onchange="location='/admin/profiles/new?shape='+this.value">${Object.entries(SHAPES).map(([k, d]) => `<option value="${k}"${k === shape ? ' selected' : ''}>${d.name}</option>`).join('')}</select></label>`;

	const dimFields = SHAPES[shape].params.map(([k, label]) => `<label class="ms-field"><span>${e(label)} (in)</span><input name="dim_${k}" value="${p ? trim(p.dims[k]) : ''}" required inputmode="decimal" placeholder="e.g. 1-1/2 or 0.125"></label>`).join('');

	const dies = p ? `<section class="ms-panel">
  <h2>Die numbers</h2>
  ${p.dies.length ? `<table class="ms-table"><thead><tr><th>Extruder</th><th>Die no.</th><th>Notes</th><th></th></tr></thead><tbody>${p.dies.map(d => `<tr><td>${e(d.maker)}</td><td class="ms-mono">${e(d.die_number)}</td><td>${e(d.notes)}</td><td><form method="post" action="/admin/profiles/${p.id}/dies"><input type="hidden" name="delete" value="${d.id}"><button class="ms-link ms-link--danger">Remove</button></form></td></tr>`).join('')}</tbody></table>` : '<p class="ms-hint">No dies yet.</p>'}
  <form method="post" action="/admin/profiles/${p.id}/dies" class="ms-inline-form">
    <select name="manufacturer_id" required>${makers.map(m => `<option value="${m.id}">${e(m.name)}</option>`).join('')}</select>
    <input name="die_number" placeholder="Die no." required maxlength="40">
    <input name="notes" placeholder="Notes (optional)" maxlength="120">
    <button class="ms-btn">Add die</button>
  </form>
</section>` : '';

	const similarBlock = similarRows.length ? `<section class="ms-panel ms-panel--warn"><h2>Similar profiles</h2><p class="ms-hint">Same shape within 1.5% on every dimension — merge the dies into one profile and reject the duplicate.</p><ul class="ms-list">${similarRows.map(x => `<li><a href="/admin/profiles/${x.id}">${e(x.title)}</a> <span class="ms-status ms-status--${x.status}">${x.status}</span></li>`).join('')}</ul></section>` : '';

	const body = `<nav class="ms-crumbs"><a href="/admin/profiles">Profiles</a></nav>
<h1>${p ? e(p.title) : 'Add profile'}</h1>
<div class="ms-admin__cols">
  <form method="post" class="ms-panel">
    ${shapeField}
    <div class="ms-grid2">${dimFields}</div>
    <label class="ms-field"><span>Status</span><select name="status">${['public', 'pending', 'rejected'].map(s => `<option${(p ? p.status : 'public') === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="ms-field"><span>alustock.ca product link (optional)</span><input name="alustock_url" type="url" value="${e(p?.alustock_url || '')}" placeholder="https://www.alustock.ca/..."></label>
    <label class="ms-field"><span>Notes</span><textarea name="notes" rows="3">${e(p?.notes || '')}</textarea></label>
    ${p ? `<p class="ms-hint">Source: ${e(p.source)} · added ${e(p.created_at)}${p.submitted_email ? ' · ' + e(p.submitted_email) : ''}</p>` : ''}
    <div class="ms-actions"><button class="ms-btn ms-btn--primary">Save</button>${p ? `<a class="ms-btn" href="${profileUrl(p)}" target="_blank" rel="noopener">View on site</a>` : ''}</div>
  </form>
  <div>
    ${p ? `<div class="ms-panel ms-panel--fig">${drawing(p.shape, p.dims, { size: 320 })}<p class="ms-weight"><b>${trim(p.weight.toFixed(3))}</b> lb/ft</p></div>` : ''}
    ${similarBlock}
  </div>
</div>
${dies}`;

	return html(adminPage({ title: p ? p.title : 'Add profile', active: 'profiles', flash, body }));
}

async function profileSave(db, request, id) {
	const data = await form(request);
	const shape = SHAPES[data.shape] ? data.shape : null;
	const raw = {};

	for (const [k] of SHAPES[shape || 'angle'].params) raw[k] = data['dim_' + k];

	const dims = shape ? normalize(shape, raw) : null;

	if (!dims) {
		return redirect(`/admin/profiles/${id || 'new'}?ok=${encodeURIComponent('Check the dimensions — they don\'t make a valid ' + (SHAPES[shape]?.name || 'shape').toLowerCase())}`);
	}

	const status = ['public', 'pending', 'rejected'].includes(data.status) ? data.status : 'public';
	const link = /^https:\/\/(www\.)?alustock\.ca\//.test(data.alustock_url || '') ? data.alustock_url : '';

	if (!id) {
		const newId = await insertProfile(db, shape, dims, { status, source: 'admin', alustock_url: link, notes: data.notes || '' });

		return redirect(`/admin/profiles/${newId}?ok=Profile added — now add its die numbers`);
	}

	await db.prepare(`UPDATE profiles SET dims = ?, dim_key = ?, title = ?, weight = ?, status = ?, alustock_url = ?, notes = ? WHERE id = ?`)
		.bind(JSON.stringify(dims), dimKey(shape, dims), shapeTitle(shape, dims), Math.round(weightPerFoot(shape, dims) * 1000) / 1000, status, link, String(data.notes || '').slice(0, 2000), id).run();

	return redirect(`/admin/profiles/${id}?ok=Saved`);
}

async function dieSave(db, request, profileId) {
	const data = await form(request);

	if (data.delete) {
		await db.prepare(`DELETE FROM dies WHERE id = ? AND profile_id = ?`).bind(Number(data.delete), profileId).run();

		return redirect(`/admin/profiles/${profileId}?ok=Die removed`);
	}

	const number = String(data.die_number || '').slice(0, 40);

	if (number) {
		await db.prepare(`INSERT OR IGNORE INTO dies (profile_id, manufacturer_id, die_number, notes) VALUES (?, ?, ?, ?)`).bind(profileId, Number(data.manufacturer_id), number, String(data.notes || '').slice(0, 120)).run();
	}

	return redirect(`/admin/profiles/${profileId}?ok=Die added`);
}

/* ------------------------------------------------------------------ extruders */

async function manufacturersPage(db, flash) {
	const rows = await manufacturers(db, false);

	const body = `<h1>Extruders</h1>
<p class="ms-hint">One profile can have dies from many extruders. Inactive extruders are hidden on the site.</p>
<table class="ms-table ms-table--admin"><thead><tr><th>Name</th><th>Province</th><th>Website</th><th>Order</th><th>Active</th><th>Dies</th><th></th></tr></thead><tbody>
${rows.map(m => `<tr><td colspan="7"><form method="post" class="ms-row-form"><input type="hidden" name="id" value="${m.id}">
<input name="name" value="${e(m.name)}" required aria-label="Name"><input name="province" value="${e(m.province)}" maxlength="20" aria-label="Province" class="ms-w-s">
<input name="website" value="${e(m.website)}" type="url" aria-label="Website" placeholder="https://"><input name="sort" value="${m.sort}" type="number" class="ms-w-s" aria-label="Order">
<label class="ms-check"><input type="checkbox" name="active" value="1"${m.active ? ' checked' : ''}> active</label><span class="ms-w-s">${m.dies}</span><button class="ms-btn">Save</button></form></td></tr>`).join('')}
</tbody></table>
<h2>Add an extruder</h2>
<form method="post" class="ms-inline-form"><input name="name" placeholder="Name" required><input name="province" placeholder="Province" class="ms-w-s"><input name="website" type="url" placeholder="https://"><button class="ms-btn ms-btn--primary">Add</button></form>`;

	return html(adminPage({ title: 'Extruders', active: 'manufacturers', flash, body }));
}

async function manufacturerSave(db, request) {
	const data = await form(request);
	const name = String(data.name || '').slice(0, 100);
	const website = /^https?:\/\//.test(data.website || '') ? data.website.slice(0, 200) : '';

	if (!name) return redirect('/admin/manufacturers');

	if (data.id) {
		await db.prepare(`UPDATE manufacturers SET name = ?, province = ?, website = ?, sort = ?, active = ? WHERE id = ?`)
			.bind(name, String(data.province || '').slice(0, 20), website, Number(data.sort) || 0, data.active ? 1 : 0, Number(data.id)).run();
	} else {
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-3);
		await db.prepare(`INSERT INTO manufacturers (name, slug, province, website, sort) VALUES (?, ?, ?, ?, 99)`).bind(name, slug, String(data.province || '').slice(0, 20), website).run();
	}

	return redirect('/admin/manufacturers?ok=Saved');
}

/* ------------------------------------------------------------------ options */

async function optionsPage(db, flash) {
	const all = await options(db, true);
	const titles = { alloy: 'Alloys / tempers', finish: 'Finishes', length: 'Lengths' };

	const body = `<h1>Options</h1><p class="ms-hint">These are the choices customers see on every profile.</p>
<div class="ms-admin__cols ms-admin__cols--3">${Object.keys(titles).map(kind => `<section class="ms-panel"><h2>${titles[kind]}</h2>
<ul class="ms-list">${(all[kind] || []).map(o => `<li class="${o.active ? '' : 'ms-muted'}"><form method="post" class="ms-row-form"><input type="hidden" name="id" value="${o.id}"><input name="label" value="${e(o.label)}" aria-label="Label"><input name="sort" type="number" value="${o.sort}" class="ms-w-s" aria-label="Order"><label class="ms-check"><input type="checkbox" name="active" value="1"${o.active ? ' checked' : ''}> on</label><button class="ms-btn">Save</button></form></li>`).join('')}</ul>
<form method="post" class="ms-inline-form"><input type="hidden" name="kind" value="${kind}"><input name="label" placeholder="Add…" required><button class="ms-btn ms-btn--primary">Add</button></form></section>`).join('')}</div>`;

	return html(adminPage({ title: 'Options', active: 'options', flash, body }));
}

async function optionSave(db, request) {
	const data = await form(request);
	const label = String(data.label || '').slice(0, 80);

	if (data.id) {
		await db.prepare(`UPDATE options SET label = ?, sort = ?, active = ? WHERE id = ?`).bind(label, Number(data.sort) || 0, data.active ? 1 : 0, Number(data.id)).run();
	} else if (label && ['alloy', 'finish', 'length'].includes(data.kind)) {
		await db.prepare(`INSERT INTO options (kind, label, sort) VALUES (?, ?, 99)`).bind(data.kind, label).run();
	}

	return redirect('/admin/options?ok=Saved');
}
