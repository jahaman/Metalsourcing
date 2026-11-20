import { SHAPES, drawing, f, trim } from '../public/shapes.js';
import { e, html, page } from './html.js';
import { shapeCounts, listProfiles, getProfile, options, manufacturers, search } from './catalog.js';

const DEFAULT_DIMS = {
	angle: { a: 2, b: 2, t: 0.125 }, channel: { h: 3, b: 1.5, tw: 0.17, tf: 0.26 }, tee: { b: 2, h: 2, t: 0.25 },
	ibeam: { h: 4, b: 2.31, tw: 0.17, tf: 0.29 }, zbar: { h: 1.5, b: 1, t: 0.125 }, flat: { w: 2, t: 0.25 },
	squarebar: { a: 1 }, roundbar: { d: 1 }, hexbar: { af: 1 }, roundtube: { od: 1.5, wall: 0.125 },
	squaretube: { a: 2, wall: 0.125 }, recttube: { a: 3, b: 1.5, wall: 0.125 }
};

export async function handle(request, c) {
	const { path } = c;

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return null;
	}

	if (path === '/') return home(c);
	if (path === '/catalog') return catalog(c);
	if (path === '/search') return searchPage(c);
	if (path === '/custom') return custom(c);
	if (path === '/request') return requestPage(c);

	const m = path.match(/^\/p\/(\d+)(?:-[\w-]*)?$/);

	if (m) return profilePage(c, Number(m[1]));

	return null;
}

const shapeName = (c, shape) => c.lang === 'fr' ? SHAPES[shape].name_fr : SHAPES[shape].name;

function slug(text) {
	return String(text).toLowerCase().replace(/["]/g, 'in').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function profileUrl(p) {
	return `/p/${p.id}-${slug(p.title)}`;
}

function shapeIcon(shape) {
	return drawing(shape, DEFAULT_DIMS[shape], { compact: true, size: 64 });
}

function card(c, p) {
	return `<a class="ms-card" href="${profileUrl(p)}">
  <span class="ms-card__fig">${drawing(p.shape, p.dims, { compact: true, size: 120 })}</span>
  <span class="ms-card__body">
    <span class="ms-card__shape">${e(shapeName(c, p.shape))}${p.source === 'customer' ? ` <em class="ms-badge">${e(c.t('custom_badge'))}</em>` : ''}</span>
    <strong>${e(p.title.replace(/ [a-z -]+$/i, ''))}</strong>
    <span class="ms-card__meta">${trim(p.weight.toFixed(3))} ${e(c.t('lbft'))} · ${p.mills || 0} ${e(c.t('mills').toLowerCase())}</span>
  </span>
</a>`;
}

/* ------------------------------------------------------------------ home */

async function home(c) {
	const { t } = c;
	const counts = await shapeCounts(c.env.DB);
	const mills = await manufacturers(c.env.DB);

	const shapes = Object.keys(SHAPES).map(key => `<a class="ms-shape" href="/catalog?shape=${key}">
    <span class="ms-shape__icon">${shapeIcon(key)}</span>
    <span class="ms-shape__name">${e(shapeName(c, key))}</span>
    <span class="ms-shape__count">${e(t('profiles_count', counts[key] || 0))}</span>
  </a>`).join('');

	const body = `
<section class="ms-hero">
  <div class="ms-wrap ms-hero__grid">
    <div>
      <p class="ms-eyebrow">${e(t('tagline'))}</p>
      <h1>${e(t('hero_title'))}</h1>
      <p class="ms-lead">${e(t('hero_lead'))}</p>
      <div class="ms-actions"><a class="ms-btn ms-btn--primary" href="/catalog">${e(t('hero_cta_catalog'))}</a><a class="ms-btn" href="/custom">${e(t('hero_cta_custom'))}</a></div>
    </div>
    <div class="ms-hero__art" aria-hidden="true">${drawing('channel', { h: 3, b: 1.5, tw: 0.17, tf: 0.26 }, { size: 360 })}</div>
  </div>
</section>
<section class="ms-section ms-wrap">
  <h2>${e(t('shapes'))}</h2>
  <div class="ms-shapes">${shapes}</div>
</section>
<section class="ms-section ms-wrap ms-how">
  <h2>${e(t('how_title'))}</h2>
  <ol class="ms-steps"><li>${e(t('how_1'))}</li><li>${e(t('how_2'))}</li><li>${e(t('how_3'))}</li></ol>
</section>
<section class="ms-section ms-wrap">
  <div class="ms-band">
    <div><h2>${e(t('stock_title'))}</h2><p>${e(t('stock_lead'))}</p></div>
    <a class="ms-btn ms-btn--primary" href="https://www.alustock.ca/" rel="noopener">${e(t('stock_cta'))}</a>
  </div>
  <p class="ms-mills"><span>${e(t('mills'))}:</span> ${mills.map(m => `<b>${e(m.name)}</b>`).join(' · ')}</p>
</section>`;

	return html(page({ ...c, title: '', body }));
}

/* ------------------------------------------------------------------ catalog */

async function catalog(c) {
	const { t } = c;
	const shape = SHAPES[c.url.searchParams.get('shape')] ? c.url.searchParams.get('shape') : '';
	const counts = await shapeCounts(c.env.DB);
	const profiles = await listProfiles(c.env.DB, { shape });

	const tabs = [`<a href="/catalog"${!shape ? ' aria-current="page"' : ''}>${e(t('all_shapes'))}</a>`]
		.concat(Object.keys(SHAPES).filter(k => counts[k]).map(k => `<a href="/catalog?shape=${k}"${shape === k ? ' aria-current="page"' : ''}>${e(shapeName(c, k))} <span>${counts[k]}</span></a>`)).join('');

	const body = `
<section class="ms-wrap ms-section">
  <h1>${e(shape ? shapeName(c, shape) : t('nav_catalog'))}</h1>
  <nav class="ms-tabs" aria-label="${e(t('shapes'))}">${tabs}</nav>
  <div class="ms-cards">${profiles.map(p => card(c, p)).join('') || `<p>${e(t('no_results'))}</p>`}</div>
  <p class="ms-hint">${e(t('sample_note'))} <a href="/custom${shape ? '?shape=' + shape : ''}">${e(t('nav_custom'))} →</a></p>
</section>`;

	return html(page({ ...c, title: shape ? shapeName(c, shape) : t('nav_catalog'), body, active: 'catalog' }));
}

async function searchPage(c) {
	const { t } = c;
	const q = (c.url.searchParams.get('q') || '').slice(0, 120);
	const { results, shape } = q ? await search(c.env.DB, q) : { results: [], shape: '' };

	const body = `
<section class="ms-wrap ms-section">
  <h1>${e(t('results_for', q))}</h1>
  <div class="ms-cards">${results.map(p => card(c, p)).join('')}</div>
  ${results.length ? '' : `<p class="ms-empty">${e(t('no_results'))}</p>`}
  <p><a class="ms-btn" href="/custom${shape ? '?shape=' + shape : ''}">${e(t('hero_cta_custom'))}</a></p>
</section>`;

	return html(page({ ...c, title: t('results_for', q), body, query: q }));
}

/* ------------------------------------------------------------------ profile */

function optionSelect(name, label, rows) {
	return `<label class="ms-field"><span>${e(label)}</span><select name="${name}">${rows.map(r => `<option>${e(r.label)}</option>`).join('')}</select></label>`;
}

export function specForm(c, opts, profileJson) {
	const { t } = c;

	return `<form class="ms-spec" data-add-request='${e(profileJson)}'>
  <h2>${e(t('configure'))}</h2>
  ${optionSelect('alloy', t('alloy'), opts.alloy)}
  ${optionSelect('finish', t('finish'), opts.finish)}
  ${optionSelect('length', t('length'), opts.length)}
  <label class="ms-field"><span>${e(t('quantity'))}</span><input type="number" name="quantity" value="1" min="1" max="100000" required></label>
  <label class="ms-field"><span>${e(t('note'))}</span><input type="text" name="note" maxlength="200"></label>
  <button class="ms-btn ms-btn--primary" type="submit">${e(t('add_request'))}</button>
  <p class="ms-added" data-added hidden>${e(t('added'))} — <a href="/request">${e(t('nav_request'))} →</a></p>
</form>`;
}

async function profilePage(c, id) {
	const { t } = c;
	const p = await getProfile(c.env.DB, id);

	if (!p || p.status === 'rejected') {
		return html(page({ ...c, title: 'Not found', body: `<section class="ms-wrap ms-section"><h1>Not found</h1><p><a href="/catalog">${e(t('nav_catalog'))}</a></p></section>` }), { status: 404 });
	}

	const opts = await options(c.env.DB);
	const def = SHAPES[p.shape];
	const dims = def.params.map(([k, label]) => `<tr><th>${e(label)}</th><td>${f(p.dims[k])}</td><td class="ms-mono">${trim(p.dims[k])}" · ${trim(p.dims[k] * 25.4)} mm</td></tr>`).join('');
	const dies = p.dies.length ? `<table class="ms-table"><thead><tr><th>${e(t('mills'))}</th><th>${e(t('die_number'))}</th></tr></thead><tbody>${p.dies.map(d => `<tr><td>${e(d.maker)}</td><td class="ms-mono">${e(d.die_number)}</td></tr>`).join('')}</tbody></table>`
		: `<p class="ms-hint">${e(t('matches_none'))}</p>`;
	const item = JSON.stringify({ profile_id: p.id, shape: p.shape, dims: p.dims, title: p.title });

	const body = `
<section class="ms-wrap ms-section">
  <nav class="ms-crumbs"><a href="/catalog">${e(t('nav_catalog'))}</a> / <a href="/catalog?shape=${p.shape}">${e(shapeName(c, p.shape))}</a></nav>
  <div class="ms-profile">
    <div class="ms-profile__fig">${drawing(p.shape, p.dims, { size: 420, label: p.title })}</div>
    <div class="ms-profile__info">
      <h1>${e(p.title)}</h1>
      ${p.status === 'pending' ? `<p class="ms-badge ms-badge--warn">${e(t('pending_badge'))}</p>` : ''}
      <p class="ms-weight"><span>${e(t('weight'))}</span> <b>${trim(p.weight.toFixed(3))}</b> ${e(t('lbft'))} <small>(${trim((p.weight * 1.48816).toFixed(3))} kg/m)</small></p>
      <h2>${e(t('dimensions'))}</h2>
      <table class="ms-table ms-table--dims"><tbody>${dims}</tbody></table>
      <h2>${e(t('dies'))}</h2>
      ${dies}
      ${p.alustock_url ? `<p><a class="ms-btn ms-btn--stock" href="${e(p.alustock_url)}" rel="noopener">${e(t('buy_stock'))}</a></p>` : ''}
    </div>
    ${specForm(c, opts, item)}
  </div>
</section>`;

	return html(page({ ...c, title: p.title, description: `${p.title} — ${p.dies.length} ${t('dies').toLowerCase()}`, body, active: 'catalog' }));
}

/* ------------------------------------------------------------------ custom builder */

async function custom(c) {
	const { t } = c;
	const shape = SHAPES[c.url.searchParams.get('shape')] ? c.url.searchParams.get('shape') : 'angle';
	const opts = await options(c.env.DB);
	const shapes = Object.keys(SHAPES).map(k => `<button type="button" class="ms-shape ms-shape--pick" data-shape="${k}" aria-pressed="${k === shape}"><span class="ms-shape__icon">${shapeIcon(k)}</span><span class="ms-shape__name">${e(shapeName(c, k))}</span></button>`).join('');
	const config = { shapes: Object.fromEntries(Object.entries(SHAPES).map(([k, d]) => [k, { params: d.params, name: shapeName(c, k) }])), defaults: DEFAULT_DIMS, shape, text: { invalid: t('invalid_dims'), lbft: t('lbft'), none: t('matches_none'), mills: t('mills') } };

	const body = `
<section class="ms-wrap ms-section" data-builder='${e(JSON.stringify(config))}'>
  <h1>${e(t('custom_title'))}</h1>
  <p class="ms-lead">${e(t('custom_lead'))}</p>
  <div class="ms-shapes ms-shapes--pick" role="group" aria-label="${e(t('shape'))}">${shapes}</div>
  <div class="ms-builder">
    <form class="ms-builder__dims" data-dims novalidate></form>
    <div class="ms-builder__fig"><div data-figure></div><p class="ms-weight" data-weight></p><p class="ms-error" data-error hidden>${e(t('invalid_dims'))}</p></div>
  </div>
  <div class="ms-builder__matches"><h2>${e(t('matches_title'))}</h2><div class="ms-cards" data-matches></div></div>
  ${specForm(c, opts, JSON.stringify({ custom: true })).replace('class="ms-spec"', 'class="ms-spec ms-spec--custom"').replace(e(t('add_request')), e(t('save_custom')))}
</section>`;

	return html(page({ ...c, title: t('custom_title'), body, active: 'custom' }));
}

/* ------------------------------------------------------------------ request list */

async function requestPage(c) {
	const { t } = c;
	const text = { remove: t('remove'), empty: t('request_empty'), sent: t('sent_lead'), sent_title: t('sent_title'), alloy: t('alloy'), finish: t('finish'), length: t('length'), quantity: t('quantity') };

	const body = `
<section class="ms-wrap ms-section ms-request" data-request-page='${e(JSON.stringify(text))}'>
  <h1>${e(t('request_title'))}</h1>
  <div class="ms-request__grid">
    <div data-request-items></div>
    <form class="ms-request__form" data-request-form>
      <h2>${e(t('request_details'))}</h2>
      <label class="ms-field"><span>${e(t('name'))} *</span><input name="name" required maxlength="100" autocomplete="name"></label>
      <label class="ms-field"><span>${e(t('company'))}</span><input name="company" maxlength="120" autocomplete="organization"></label>
      <label class="ms-field"><span>${e(t('email'))} *</span><input name="email" type="email" required maxlength="160" autocomplete="email"></label>
      <label class="ms-field"><span>${e(t('phone'))}</span><input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>
      <label class="ms-field"><span>${e(t('city'))}</span><input name="city" maxlength="120" autocomplete="address-level2"></label>
      <label class="ms-field"><span>${e(t('message'))}</span><textarea name="message" rows="4" maxlength="2000"></textarea></label>
      <label class="ms-hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label>
      <input type="hidden" name="lang" value="${c.lang}">
      <button class="ms-btn ms-btn--primary" type="submit">${e(t('send_request'))}</button>
      <p class="ms-error" data-request-error hidden></p>
    </form>
  </div>
</section>`;

	return html(page({ ...c, title: t('request_title'), body, active: 'request' }));
}
