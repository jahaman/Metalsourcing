import { SHAPES, parseLength, similar, normalize, dimKey } from '../public/shapes.js';
import { parseProfile } from './db.js';

export async function shapeCounts(db) {
	const rows = (await db.prepare(`SELECT shape, COUNT(*) AS n FROM profiles WHERE status = 'public' GROUP BY shape`).all()).results;

	return Object.fromEntries(rows.map(r => [r.shape, r.n]));
}

export async function listProfiles(db, { shape = '', status = 'public', limit = 500 } = {}) {
	const where = [];
	const args = [];

	if (status) { where.push('p.status = ?'); args.push(status); }
	if (shape) { where.push('p.shape = ?'); args.push(shape); }

	const rows = (await db.prepare(`SELECT p.*, (SELECT COUNT(DISTINCT manufacturer_id) FROM dies d WHERE d.profile_id = p.id) AS mills
		FROM profiles p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.shape, p.weight LIMIT ${Number(limit)}`).bind(...args).all()).results;

	return rows.map(parseProfile).sort(byDims);
}

function byDims(a, b) {
	if (a.shape !== b.shape) {
		return a.shape < b.shape ? -1 : 1;
	}

	for (const [k] of SHAPES[a.shape]?.params || []) {
		if (a.dims[k] !== b.dims[k]) {
			return a.dims[k] - b.dims[k];
		}
	}

	return 0;
}

export async function getProfile(db, id) {
	const profile = parseProfile(await db.prepare(`SELECT * FROM profiles WHERE id = ?`).bind(id).first());

	if (!profile) {
		return null;
	}

	profile.dies = (await db.prepare(`SELECT d.*, m.name AS maker, m.slug AS maker_slug FROM dies d JOIN manufacturers m ON m.id = d.manufacturer_id
		WHERE d.profile_id = ? ORDER BY m.sort, m.name, d.die_number`).bind(id).all()).results;

	return profile;
}

export async function options(db, all = false) {
	const rows = (await db.prepare(`SELECT * FROM options ${all ? '' : 'WHERE active = 1'} ORDER BY kind, sort, id`).all()).results;
	const out = { alloy: [], finish: [], length: [] };

	rows.forEach(r => (out[r.kind] = out[r.kind] || []).push(r));

	return out;
}

export async function manufacturers(db, activeOnly = true) {
	return (await db.prepare(`SELECT m.*, (SELECT COUNT(*) FROM dies d WHERE d.manufacturer_id = m.id) AS dies FROM manufacturers m ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, name`).all()).results;
}

/**
 * Existing profiles of the same shape within tolerance of these dimensions (exact first).
 */
export async function matches(db, shape, dims, { includePending = false } = {}) {
	const rows = (await db.prepare(`SELECT p.*, (SELECT COUNT(DISTINCT manufacturer_id) FROM dies d WHERE d.profile_id = p.id) AS mills FROM profiles p
		WHERE p.shape = ? AND p.status ${includePending ? "IN ('public','pending')" : "= 'public'"}`).bind(shape).all()).results.map(parseProfile);
	const key = dimKey(shape, dims);

	return rows.filter(p => similar(shape, p.dims, dims)).sort((a, b) => (b.dim_key === key) - (a.dim_key === key));
}

/* ------------------------------------------------------------------ search */

const SHAPE_WORDS = [
	['roundtube', /\b(round\s*tube|tube\s*rond|pipe|tuyau)\b/],
	['squaretube', /\b(square\s*tube|tube\s*carr[ée]|sq\s*tube)\b/],
	['recttube', /\b(rect(angular)?\s*tube|tube\s*rect)\b/],
	['roundbar', /\b(round\s*bar|rod|barre\s*ronde)\b/],
	['squarebar', /\b(square\s*bar|barre\s*carr[ée])\b/],
	['hexbar', /\b(hex(agon(al)?)?)\b/],
	['flat', /\b(flat(\s*bar)?|barre\s*plate|plat)\b/],
	['ibeam', /\b(i[\s-]?beam|poutre)\b/],
	['zbar', /\b(z[\s-]?bar|zee)\b/],
	['channel', /\b(channel|u[\s-]?channel|profil[ée] en u)\b/],
	['tee', /\b(tee|t[\s-]?bar|t[ée])\b/],
	['angle', /\b(angle|corni[èe]re|l[\s-]?angle)\b/],
	['roundtube', /\btube\b/]
];

export function parseQuery(q) {
	const text = String(q || '').toLowerCase();
	let shape = '';

	for (const [key, re] of SHAPE_WORDS) {
		if (re.test(text)) { shape = key; break; }
	}

	// Numbers: 2, 1/8, 1-1/2, 0.125, 6.35mm — separated by x, ×, spaces
	const numbers = [];
	const tokens = text.replace(/[×*]/g, ' x ').match(/\d+(?:[.,]\d+)?(?:[\s-]\d+\/\d+|\/\d+)?\s*(?:mm|")?/g) || [];

	for (const token of tokens) {
		const value = parseLength(token.trim().replace(/"$/, ''));

		if (value > 0 && value < 48) {
			numbers.push(value);
		}
	}

	return { shape, numbers };
}

export async function search(db, q) {
	const { shape, numbers } = parseQuery(q);
	const words = String(q || '').toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/\d/.test(w));
	const rows = await listProfiles(db, { shape, limit: 2000 });

	const scored = rows.map(p => {
		const values = SHAPES[p.shape].params.map(([k]) => p.dims[k]);
		let score = shape ? 2 : 0;
		let hit = 0;

		for (const n of numbers) {
			if (values.some(v => Math.abs(v - n) <= Math.max(0.005, 0.015 * v))) { hit++; }
		}

		if (numbers.length) {
			if (!hit) { return null; }
			score += hit * 3 - (numbers.length - hit) * 2;
		}

		if (!shape && !numbers.length) {
			const hay = (p.title + ' ' + SHAPES[p.shape].name + ' ' + SHAPES[p.shape].name_fr).toLowerCase();
			if (!words.some(w => hay.includes(w))) { return null; }
			score += 1;
		}

		return { p, score };
	}).filter(Boolean);

	scored.sort((a, b) => b.score - a.score || byDims(a.p, b.p));

	return { shape, numbers, results: scored.slice(0, 60).map(s => s.p) };
}

export { normalize };
