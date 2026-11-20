/*!
 * Metal Sourcing — shape geometry, shared by the browser and the Worker.
 * Dimensions are in inches. Each shape defines its inputs, its cross-section area
 * (for weight per foot) and a drawing: outline paths plus dimension lines.
 */

export const DENSITY = { aluminum: 0.0975 }; // lb / in³

export const SHAPES = {
	angle: {
		name: 'Angle', name_fr: 'Cornière',
		params: [['a', 'Leg A'], ['b', 'Leg B'], ['t', 'Thickness']],
		check: d => d.t > 0 && d.t < Math.min(d.a, d.b),
		area: d => d.t * (d.a + d.b - d.t),
		outline: d => [[[0, 0], [d.b, 0], [d.b, d.t], [d.t, d.t], [d.t, d.a], [0, d.a]]],
		dims: d => [
			{ from: [0, 0], to: [0, d.a], side: 'left', label: d.a },
			{ from: [0, 0], to: [d.b, 0], side: 'bottom', label: d.b },
			{ from: [d.b, 0], to: [d.b, d.t], side: 'right', label: d.t }
		],
		title: d => `${f(d.a)} × ${f(d.b)} × ${f(d.t)} angle`
	},
	channel: {
		name: 'Channel', name_fr: 'Profilé en U',
		params: [['h', 'Height'], ['b', 'Flange width'], ['tw', 'Web thickness'], ['tf', 'Flange thickness']],
		check: d => d.tw > 0 && d.tf > 0 && d.tw < d.b && 2 * d.tf < d.h,
		area: d => d.h * d.tw + 2 * (d.b - d.tw) * d.tf,
		outline: d => [[[0, 0], [d.b, 0], [d.b, d.tf], [d.tw, d.tf], [d.tw, d.h - d.tf], [d.b, d.h - d.tf], [d.b, d.h], [0, d.h]]],
		dims: d => [
			{ from: [0, 0], to: [0, d.h], side: 'left', label: d.h },
			{ from: [0, d.h], to: [d.b, d.h], side: 'top', label: d.b },
			{ from: [0, d.h / 2], to: [d.tw, d.h / 2], side: 'inside', label: d.tw },
			{ from: [d.b, 0], to: [d.b, d.tf], side: 'right', label: d.tf }
		],
		title: d => `${f(d.h)} × ${f(d.b)} channel`
	},
	tee: {
		name: 'Tee', name_fr: 'Té',
		params: [['b', 'Width'], ['h', 'Height'], ['t', 'Thickness']],
		check: d => d.t > 0 && d.t < d.b && d.t < d.h,
		area: d => d.b * d.t + (d.h - d.t) * d.t,
		outline: d => {
			const s = (d.b - d.t) / 2;
			return [[[s, 0], [s + d.t, 0], [s + d.t, d.h - d.t], [d.b, d.h - d.t], [d.b, d.h], [0, d.h], [0, d.h - d.t], [s, d.h - d.t]]];
		},
		dims: d => [
			{ from: [0, d.h], to: [d.b, d.h], side: 'top', label: d.b },
			{ from: [0, 0], to: [0, d.h], side: 'left', label: d.h },
			{ from: [d.b, d.h - d.t], to: [d.b, d.h], side: 'right', label: d.t }
		],
		title: d => `${f(d.b)} × ${f(d.h)} × ${f(d.t)} tee`
	},
	ibeam: {
		name: 'I-beam', name_fr: 'Poutre en I',
		params: [['h', 'Height'], ['b', 'Flange width'], ['tw', 'Web thickness'], ['tf', 'Flange thickness']],
		check: d => d.tw > 0 && d.tf > 0 && d.tw < d.b && 2 * d.tf < d.h,
		area: d => 2 * d.b * d.tf + (d.h - 2 * d.tf) * d.tw,
		outline: d => {
			const w = (d.b - d.tw) / 2;
			return [[[0, 0], [d.b, 0], [d.b, d.tf], [w + d.tw, d.tf], [w + d.tw, d.h - d.tf], [d.b, d.h - d.tf], [d.b, d.h], [0, d.h], [0, d.h - d.tf], [w, d.h - d.tf], [w, d.tf], [0, d.tf]]];
		},
		dims: d => [
			{ from: [0, 0], to: [0, d.h], side: 'left', label: d.h },
			{ from: [0, d.h], to: [d.b, d.h], side: 'top', label: d.b },
			{ from: [(d.b - d.tw) / 2, d.h / 2], to: [(d.b + d.tw) / 2, d.h / 2], side: 'inside', label: d.tw },
			{ from: [d.b, 0], to: [d.b, d.tf], side: 'right', label: d.tf }
		],
		title: d => `${f(d.h)} × ${f(d.b)} I-beam`
	},
	zbar: {
		name: 'Z-bar', name_fr: 'Profilé en Z',
		params: [['h', 'Height'], ['b', 'Flange width'], ['t', 'Thickness']],
		check: d => d.t > 0 && d.t < d.b && 2 * d.t < d.h,
		area: d => d.h * d.t + 2 * (d.b - d.t) * d.t,
		outline: d => [[[0, 0], [d.b, 0], [d.b, d.h - d.t], [2 * d.b - d.t, d.h - d.t], [2 * d.b - d.t, d.h], [d.b - d.t, d.h], [d.b - d.t, d.t], [0, d.t]]],
		dims: d => [
			{ from: [0, 0], to: [d.b, 0], side: 'bottom', label: d.b },
			{ from: [2 * d.b - d.t, 0], to: [2 * d.b - d.t, d.h], side: 'right', label: d.h },
			{ from: [0, 0], to: [0, d.t], side: 'left', label: d.t }
		],
		title: d => `${f(d.h)} × ${f(d.b)} × ${f(d.t)} Z-bar`
	},
	flat: {
		name: 'Flat bar', name_fr: 'Barre plate',
		params: [['w', 'Width'], ['t', 'Thickness']],
		check: d => d.w > 0 && d.t > 0,
		area: d => d.w * d.t,
		outline: d => [[[0, 0], [d.w, 0], [d.w, d.t], [0, d.t]]],
		dims: d => [
			{ from: [0, d.t], to: [d.w, d.t], side: 'top', label: d.w },
			{ from: [d.w, 0], to: [d.w, d.t], side: 'right', label: d.t }
		],
		title: d => `${f(d.t)} × ${f(d.w)} flat bar`
	},
	squarebar: {
		name: 'Square bar', name_fr: 'Barre carrée',
		params: [['a', 'Side']],
		check: d => d.a > 0,
		area: d => d.a * d.a,
		outline: d => [[[0, 0], [d.a, 0], [d.a, d.a], [0, d.a]]],
		dims: d => [{ from: [0, d.a], to: [d.a, d.a], side: 'top', label: d.a }],
		title: d => `${f(d.a)} square bar`
	},
	roundbar: {
		name: 'Round bar', name_fr: 'Barre ronde',
		params: [['d', 'Diameter']],
		check: d => d.d > 0,
		area: d => Math.PI * d.d * d.d / 4,
		circles: d => [{ cx: d.d / 2, cy: d.d / 2, r: d.d / 2 }],
		box: d => [d.d, d.d],
		dims: d => [{ from: [0, d.d], to: [d.d, d.d], side: 'top', label: d.d, prefix: 'Ø' }],
		title: d => `Ø${f(d.d)} round bar`
	},
	hexbar: {
		name: 'Hex bar', name_fr: 'Barre hexagonale',
		params: [['af', 'Across flats']],
		check: d => d.af > 0,
		area: d => 0.866025 * d.af * d.af,
		outline: d => {
			const s = d.af / Math.sqrt(3), w = 2 * s;
			return [[[s / 2, 0], [w - s / 2, 0], [w, d.af / 2], [w - s / 2, d.af], [s / 2, d.af], [0, d.af / 2]]];
		},
		dims: d => [{ from: [0, 0], to: [0, d.af], side: 'left', label: d.af }],
		title: d => `${f(d.af)} hex bar`
	},
	roundtube: {
		name: 'Round tube', name_fr: 'Tube rond',
		params: [['od', 'Outside diameter'], ['wall', 'Wall']],
		check: d => d.wall > 0 && 2 * d.wall < d.od,
		area: d => Math.PI / 4 * (d.od * d.od - Math.pow(d.od - 2 * d.wall, 2)),
		circles: d => [{ cx: d.od / 2, cy: d.od / 2, r: d.od / 2, hole: d.od / 2 - d.wall }],
		box: d => [d.od, d.od],
		dims: d => [
			{ from: [0, d.od], to: [d.od, d.od], side: 'top', label: d.od, prefix: 'Ø' },
			{ from: [d.od, d.od / 2], to: [d.od - d.wall, d.od / 2], side: 'inside', label: d.wall }
		],
		title: d => `Ø${f(d.od)} × ${f(d.wall)} round tube`
	},
	squaretube: {
		name: 'Square tube', name_fr: 'Tube carré',
		params: [['a', 'Side'], ['wall', 'Wall']],
		check: d => d.wall > 0 && 2 * d.wall < d.a,
		area: d => d.a * d.a - Math.pow(d.a - 2 * d.wall, 2),
		outline: d => [[[0, 0], [d.a, 0], [d.a, d.a], [0, d.a]], rect(d.wall, d.wall, d.a - 2 * d.wall, d.a - 2 * d.wall)],
		dims: d => [
			{ from: [0, d.a], to: [d.a, d.a], side: 'top', label: d.a },
			{ from: [d.a - d.wall, d.a / 2], to: [d.a, d.a / 2], side: 'inside', label: d.wall }
		],
		title: d => `${f(d.a)} × ${f(d.a)} × ${f(d.wall)} square tube`
	},
	recttube: {
		name: 'Rectangular tube', name_fr: 'Tube rectangulaire',
		params: [['a', 'Width'], ['b', 'Height'], ['wall', 'Wall']],
		check: d => d.wall > 0 && 2 * d.wall < Math.min(d.a, d.b),
		area: d => d.a * d.b - (d.a - 2 * d.wall) * (d.b - 2 * d.wall),
		outline: d => [[[0, 0], [d.a, 0], [d.a, d.b], [0, d.b]], rect(d.wall, d.wall, d.a - 2 * d.wall, d.b - 2 * d.wall)],
		dims: d => [
			{ from: [0, d.b], to: [d.a, d.b], side: 'top', label: d.a },
			{ from: [0, 0], to: [0, d.b], side: 'left', label: d.b },
			{ from: [d.a - d.wall, d.b / 2], to: [d.a, d.b / 2], side: 'inside', label: d.wall }
		],
		title: d => `${f(d.a)} × ${f(d.b)} × ${f(d.wall)} rectangular tube`
	}
};

function rect(x, y, w, h) {
	return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/* ------------------------------------------------------------------ numbers */

const FRACTIONS = [2, 4, 8, 16, 32, 64];

// 0.125 -> 1/8", 1.5 -> 1-1/2", 0.130 -> 0.130"
export function f(value) {
	const v = Number(value);

	if (!isFinite(v)) {
		return '';
	}

	const whole = Math.floor(v + 1e-9);
	const rest = v - whole;

	if (rest < 1e-6) {
		return whole + '"';
	}

	for (const den of FRACTIONS) {
		const num = Math.round(rest * den);

		if (Math.abs(rest - num / den) < 1e-4) {
			const g = gcd(num, den);
			const frac = num / g + '/' + den / g;

			return (whole ? whole + '-' : '') + frac + '"';
		}
	}

	return trim(v) + '"';
}

export function trim(v) {
	return String(Math.round(Number(v) * 10000) / 10000);
}

function gcd(a, b) {
	return b ? gcd(b, a % b) : a;
}

// "1-1/2", "1 1/2", "3/8", "0.125", "6.35mm" -> inches
export function parseLength(text) {
	let s = String(text ?? '').trim().toLowerCase().replace(/["”″]|in(ch(es)?)?$/g, '').trim();

	if (!s) {
		return NaN;
	}

	let mm = false;

	if (/mm$/.test(s)) {
		mm = true;
		s = s.replace(/mm$/, '').trim();
	}

	let value;
	const mixed = s.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
	const frac = s.match(/^(\d+)\/(\d+)$/);

	if (mixed) {
		value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
	} else if (frac) {
		value = Number(frac[1]) / Number(frac[2]);
	} else {
		value = Number(s.replace(',', '.'));
	}

	return mm ? value / 25.4 : value;
}

/* ------------------------------------------------------------------ profile maths */

export function normalize(shape, dims) {
	const def = SHAPES[shape];

	if (!def) {
		return null;
	}

	const out = {};

	for (const [key] of def.params) {
		const v = typeof dims[key] === 'number' ? dims[key] : parseLength(dims[key]);

		if (!(v > 0) || v > 48) {
			return null;
		}

		out[key] = Math.round(v * 10000) / 10000;
	}

	return def.check(out) ? out : null;
}

export function weightPerFoot(shape, dims) {
	return SHAPES[shape].area(dims) * DENSITY.aluminum * 12;
}

export function title(shape, dims) {
	return SHAPES[shape].title(dims);
}

// Key for exact duplicates: shape + dims rounded to a thousandth
export function dimKey(shape, dims) {
	return shape + ':' + SHAPES[shape].params.map(([k]) => (Math.round(dims[k] * 1000) / 1000).toFixed(3)).join('x');
}

// True when every dimension is within 1.5% (min 0.005") of the other profile's
export function similar(shape, a, b) {
	return SHAPES[shape].params.every(([k]) => Math.abs(a[k] - b[k]) <= Math.max(0.005, 0.015 * Math.max(a[k], b[k])));
}

/* ------------------------------------------------------------------ drawing */

export function drawing(shape, dims, opts = {}) {
	const def = SHAPES[shape];
	const size = opts.size || 320;
	const pad = opts.compact ? 6 : 58;
	const outlines = def.outline ? def.outline(dims) : [];
	const circles = def.circles ? def.circles(dims) : [];

	let w, h;

	if (def.box) {
		[w, h] = def.box(dims);
	} else {
		const pts = outlines.flat();
		w = Math.max(...pts.map(p => p[0]));
		h = Math.max(...pts.map(p => p[1]));
	}

	const scale = (size - 2 * pad) / Math.max(w, h);
	const ox = pad + ((size - 2 * pad) - w * scale) / 2;
	const oy = pad + ((size - 2 * pad) - h * scale) / 2;

	// y up in drawing space, y down in SVG
	const X = x => (ox + x * scale).toFixed(2);
	const Y = y => (oy + (h - y) * scale).toFixed(2);

	let body = '';

	if (outlines.length) {
		const d = outlines.map(poly => 'M' + poly.map(p => X(p[0]) + ' ' + Y(p[1])).join(' L') + ' Z').join(' ');
		body += `<path d="${d}" fill-rule="evenodd" class="ms-sec"/>`;
	}

	for (const c of circles) {
		const cx = X(c.cx), cy = Y(c.cy), r = (c.r * scale).toFixed(2);

		if (c.hole) {
			const hr = (c.hole * scale).toFixed(2);
			body += `<path class="ms-sec" fill-rule="evenodd" d="M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z M${cx - hr} ${cy} a${hr} ${hr} 0 1 0 ${2 * hr} 0 a${hr} ${hr} 0 1 0 ${-2 * hr} 0 Z"/>`;
		} else {
			body += `<circle class="ms-sec" cx="${cx}" cy="${cy}" r="${r}"/>`;
		}
	}

	if (!opts.compact) {
		for (const dim of def.dims(dims)) {
			body += dimension(dim, X, Y);
		}
	}

	const label = opts.label ? ` aria-label="${escapeAttr(opts.label)}"` : ' aria-hidden="true"';

	return `<svg class="ms-drawing" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img"${label}>${body}</svg>`;
}

function dimension(dim, X, Y) {
	const [x1, y1] = [Number(X(dim.from[0])), Number(Y(dim.from[1]))];
	const [x2, y2] = [Number(X(dim.to[0])), Number(Y(dim.to[1]))];
	const text = (dim.prefix || '') + f(dim.label);
	const gap = 26;
	let a, b, tx, ty, ext = '', anchor = 'middle', rotate = '';

	switch (dim.side) {
		case 'left':
			a = [x1 - gap, y1]; b = [x2 - gap, y2];
			ext = line(x1 - 4, y1, x1 - gap - 6, y1) + line(x2 - 4, y2, x2 - gap - 6, y2);
			tx = a[0] - 8; ty = (a[1] + b[1]) / 2; rotate = ` transform="rotate(-90 ${tx} ${ty})"`;
			break;
		case 'right':
			a = [x1 + gap, y1]; b = [x2 + gap, y2];
			ext = line(x1 + 4, y1, x1 + gap + 6, y1) + line(x2 + 4, y2, x2 + gap + 6, y2);
			tx = a[0] + 8; ty = (a[1] + b[1]) / 2; anchor = 'start';
			break;
		case 'top':
			a = [x1, y1 - gap]; b = [x2, y2 - gap];
			ext = line(x1, y1 - 4, x1, y1 - gap - 6) + line(x2, y2 - 4, x2, y2 - gap - 6);
			tx = (a[0] + b[0]) / 2; ty = a[1] - 8;
			break;
		case 'bottom':
			a = [x1, y1 + gap]; b = [x2, y2 + gap];
			ext = line(x1, y1 + 4, x1, y1 + gap + 6) + line(x2, y2 + 4, x2, y2 + gap + 6);
			tx = (a[0] + b[0]) / 2; ty = a[1] + 18;
			break;
		default: // inside: leader to the right of the measured span
			a = [x1, y1]; b = [x2, y2];
			tx = Math.max(x1, x2) + 10; ty = y1 + 4; anchor = 'start';
	}

	const arrows = `<line class="ms-dim" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" marker-start="url(#ms-arrow)" marker-end="url(#ms-arrow)"/>`;

	return `<g>${ext}${arrows}<text class="ms-dim-text" x="${tx}" y="${ty}" text-anchor="${anchor}"${rotate}>${escapeAttr(text)}</text></g>`;
}

function line(x1, y1, x2, y2) {
	return `<line class="ms-ext" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}

function escapeAttr(s) {
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

// Arrow marker, once per page
export const SVG_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><marker id="ms-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" class="ms-arrowhead"/></marker></defs></svg>';
