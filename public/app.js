import { SHAPES, drawing, normalize, weightPerFoot, title, f, trim } from './shapes.js';

/* ------------------------------------------------------------------ request list (this browser) */

const KEY = 'ms_request';
let memory = [];

function load() {
	try {
		const items = JSON.parse(localStorage.getItem(KEY) || '[]');
		return Array.isArray(items) ? items : [];
	} catch {
		return memory;
	}
}

function save(items) {
	memory = items;
	try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: memory only */ }
	updateCount();
}

function updateCount() {
	const n = load().length;
	document.querySelectorAll('[data-request-count]').forEach(el => { el.textContent = n; el.hidden = !n; });
}

updateCount();

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function specOf(form) {
	const data = new FormData(form);

	return {
		alloy: data.get('alloy') || '',
		finish: data.get('finish') || '',
		length: data.get('length') || '',
		quantity: Math.max(1, parseInt(data.get('quantity'), 10) || 1),
		note: (data.get('note') || '').toString().slice(0, 200)
	};
}

function added(form) {
	const note = form.querySelector('[data-added]');

	if (note) {
		note.hidden = false;
		note.focus?.();
	}
}

// Catalog profile pages
document.querySelectorAll('form[data-add-request]').forEach(form => {
	const item = JSON.parse(form.getAttribute('data-add-request'));

	if (item.custom) {
		return; // the builder handles it
	}

	form.addEventListener('submit', event => {
		event.preventDefault();
		save(load().concat([{ ...item, ...specOf(form), id: Date.now() }]));
		added(form);
	});
});

/* ------------------------------------------------------------------ custom profile builder */

const builder = document.querySelector('[data-builder]');

if (builder) {
	const config = JSON.parse(builder.getAttribute('data-builder'));
	const dimsForm = builder.querySelector('[data-dims]');
	const figure = builder.querySelector('[data-figure]');
	const weight = builder.querySelector('[data-weight]');
	const error = builder.querySelector('[data-error]');
	const matchBox = builder.querySelector('[data-matches]');
	const spec = builder.querySelector('form.ms-spec--custom');
	let shape = config.shape;
	let current = null;
	let timer = null;

	const params = new URLSearchParams(location.search);

	function renderInputs() {
		const start = config.defaults[shape];

		dimsForm.innerHTML = config.shapes[shape].params.map(([k, label]) => {
			const value = params.get(k) && params.get('shape') === shape ? params.get(k) : f(start[k]).replace('"', '');

			return `<label class="ms-field"><span>${esc(label)}</span><input name="${k}" value="${esc(value)}" inputmode="decimal" autocomplete="off" spellcheck="false"></label>`;
		}).join('');

		builder.querySelectorAll('[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shape === shape)));
		update();
	}

	function update() {
		const raw = Object.fromEntries(new FormData(dimsForm));
		const dims = normalize(shape, raw);

		current = dims;
		error.hidden = !!dims;
		spec.querySelector('button[type="submit"]').disabled = !dims;

		if (!dims) {
			return;
		}

		figure.innerHTML = drawing(shape, dims, { size: 380, label: title(shape, dims) });
		weight.innerHTML = `<b>${trim(weightPerFoot(shape, dims).toFixed(3))}</b> ${esc(config.text.lbft)} · ${esc(title(shape, dims))}`;

		const query = new URLSearchParams({ shape, ...Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, String(v)])) });
		history.replaceState(null, '', '/custom?' + query);

		clearTimeout(timer);
		timer = setTimeout(() => findMatches(query), 300);
	}

	async function findMatches(query) {
		try {
			const res = await fetch('/api/match?' + query);
			const data = await res.json();

			matchBox.innerHTML = (data.matches || []).map(p => `<a class="ms-card${p.exact ? ' ms-card--exact' : ''}" href="/p/${p.id}">
				<span class="ms-card__fig">${drawing(p.shape, p.dims, { compact: true, size: 120 })}</span>
				<span class="ms-card__body"><strong>${esc(p.title)}</strong><span class="ms-card__meta">${trim(p.weight.toFixed(3))} ${esc(config.text.lbft)} · ${p.mills} ${esc(config.text.mills.toLowerCase())}</span></span></a>`).join('')
				|| `<p class="ms-hint">${esc(config.text.none)}</p>`;
		} catch {
			matchBox.innerHTML = '';
		}
	}

	builder.querySelectorAll('[data-shape]').forEach(button => button.addEventListener('click', () => {
		shape = button.dataset.shape;
		renderInputs();
	}));

	dimsForm.addEventListener('input', update);

	spec.addEventListener('submit', async event => {
		event.preventDefault();

		if (!current) {
			return;
		}

		const button = spec.querySelector('button[type="submit"]');
		button.disabled = true;

		try {
			const res = await fetch('/api/profiles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shape, dims: current }) });
			const data = await res.json();

			if (!res.ok) throw new Error(data.error);

			save(load().concat([{ profile_id: data.id, shape, dims: current, title: title(shape, current), custom: !data.existing, ...specOf(spec), id: Date.now() }]));
			added(spec);
		} catch {
			error.hidden = false;
		} finally {
			button.disabled = false;
		}
	});

	renderInputs();
}

/* ------------------------------------------------------------------ request page */

const requestPage = document.querySelector('[data-request-page]');

if (requestPage) {
	const text = JSON.parse(requestPage.getAttribute('data-request-page'));
	const list = requestPage.querySelector('[data-request-items]');
	const form = requestPage.querySelector('[data-request-form]');
	const errorBox = requestPage.querySelector('[data-request-error]');

	function render() {
		const items = load().filter(i => SHAPES[i.shape]);

		form.hidden = !items.length;
		list.innerHTML = items.length ? items.map(i => `<article class="ms-item">
			<span class="ms-item__fig">${drawing(i.shape, i.dims, { compact: true, size: 72 })}</span>
			<div class="ms-item__body"><strong>${i.profile_id ? `<a href="/p/${i.profile_id}">${esc(i.title)}</a>` : esc(i.title)}</strong>
			<dl><dt>${esc(text.alloy)}</dt><dd>${esc(i.alloy)}</dd><dt>${esc(text.finish)}</dt><dd>${esc(i.finish)}</dd><dt>${esc(text.length)}</dt><dd>${esc(i.length)}</dd><dt>${esc(text.quantity)}</dt><dd>${i.quantity}</dd></dl>
			${i.note ? `<p class="ms-hint">${esc(i.note)}</p>` : ''}</div>
			<button type="button" class="ms-link ms-link--danger" data-remove="${i.id}">${esc(text.remove)}</button></article>`).join('')
			: `<p class="ms-empty">${esc(text.empty)}</p>`;
	}

	list.addEventListener('click', event => {
		const id = event.target.closest('[data-remove]')?.dataset.remove;

		if (id) {
			save(load().filter(i => String(i.id) !== id));
			render();
		}
	});

	form.addEventListener('submit', async event => {
		event.preventDefault();
		errorBox.hidden = true;

		const button = form.querySelector('button[type="submit"]');
		const payload = Object.fromEntries(new FormData(form));
		payload.items = load();
		button.disabled = true;

		try {
			const res = await fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
			const data = await res.json();

			if (!res.ok) throw new Error(data.error || 'error');

			save([]);
			requestPage.querySelector('.ms-request__grid').innerHTML = `<div class="ms-sent"><h2>${esc(text.sent_title)}</h2><p>${esc(text.sent.replace('%s', data.ref))}</p></div>`;
		} catch (e) {
			errorBox.textContent = e.message === 'contact' ? 'Please check your name and email.' : 'The request could not be sent. Please try again.';
			errorBox.hidden = false;
			button.disabled = false;
		}
	});

	render();
}
