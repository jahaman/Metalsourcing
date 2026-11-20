/**
 * D1 schema and sample data. The Worker creates its tables on first use (no migration step in the
 * build), and loads the sample catalog when the profile table is empty.
 */
import { normalize, weightPerFoot, title, dimKey } from '../public/shapes.js';

const SCHEMA_VERSION = '1';

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
	`CREATE TABLE IF NOT EXISTS manufacturers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		website TEXT DEFAULT '',
		province TEXT DEFAULT '',
		active INTEGER NOT NULL DEFAULT 1,
		sort INTEGER NOT NULL DEFAULT 0
	)`,
	`CREATE TABLE IF NOT EXISTS profiles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		shape TEXT NOT NULL,
		dims TEXT NOT NULL,
		dim_key TEXT NOT NULL,
		title TEXT NOT NULL,
		weight REAL NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'public',
		source TEXT NOT NULL DEFAULT 'catalog',
		alustock_url TEXT DEFAULT '',
		notes TEXT DEFAULT '',
		submitted_email TEXT DEFAULT '',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`,
	`CREATE INDEX IF NOT EXISTS profiles_shape ON profiles (shape, status)`,
	`CREATE INDEX IF NOT EXISTS profiles_key ON profiles (dim_key)`,
	`CREATE TABLE IF NOT EXISTS dies (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		profile_id INTEGER NOT NULL,
		manufacturer_id INTEGER NOT NULL,
		die_number TEXT NOT NULL,
		notes TEXT DEFAULT '',
		UNIQUE (profile_id, manufacturer_id, die_number)
	)`,
	`CREATE INDEX IF NOT EXISTS dies_profile ON dies (profile_id)`,
	`CREATE TABLE IF NOT EXISTS options (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		kind TEXT NOT NULL,
		label TEXT NOT NULL,
		sort INTEGER NOT NULL DEFAULT 0,
		active INTEGER NOT NULL DEFAULT 1
	)`,
	`CREATE TABLE IF NOT EXISTS requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ref TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		company TEXT DEFAULT '',
		email TEXT NOT NULL,
		phone TEXT DEFAULT '',
		city TEXT DEFAULT '',
		message TEXT DEFAULT '',
		status TEXT NOT NULL DEFAULT 'new',
		admin_notes TEXT DEFAULT '',
		lang TEXT DEFAULT 'en',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`,
	`CREATE TABLE IF NOT EXISTS request_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_id INTEGER NOT NULL,
		profile_id INTEGER,
		title TEXT NOT NULL,
		shape TEXT NOT NULL,
		dims TEXT NOT NULL,
		alloy TEXT DEFAULT '',
		finish TEXT DEFAULT '',
		length TEXT DEFAULT '',
		quantity INTEGER NOT NULL DEFAULT 1,
		note TEXT DEFAULT ''
	)`,
	`CREATE INDEX IF NOT EXISTS items_request ON request_items (request_id)`
];

// Sample data only — die numbers are placeholders ("S-…") until the real catalogs are loaded.
const MANUFACTURERS = [
	['Extrudex', 'extrudex', '', ''],
	['Can Art Aluminum Extrusion', 'canart', '', ''],
	['Signature Aluminum', 'signature', '', '']
];

const SAMPLE_PROFILES = [
	['angle', { a: 1, b: 1, t: 0.125 }, [['extrudex', 'S-EX-1001'], ['canart', 'S-CA-2101'], ['signature', 'S-SG-3001']]],
	['angle', { a: 1.5, b: 1.5, t: 0.125 }, [['extrudex', 'S-EX-1002'], ['signature', 'S-SG-3002']]],
	['angle', { a: 2, b: 2, t: 0.125 }, [['extrudex', 'S-EX-1003'], ['canart', 'S-CA-2103'], ['signature', 'S-SG-3003']]],
	['angle', { a: 2, b: 2, t: 0.25 }, [['canart', 'S-CA-2104']]],
	['angle', { a: 3, b: 2, t: 0.1875 }, [['extrudex', 'S-EX-1005']]],
	['channel', { h: 2, b: 1, tw: 0.125, tf: 0.125 }, [['extrudex', 'S-EX-1101'], ['canart', 'S-CA-2201']]],
	['channel', { h: 3, b: 1.5, tw: 0.17, tf: 0.26 }, [['signature', 'S-SG-3101']]],
	['channel', { h: 4, b: 1.75, tw: 0.25, tf: 0.25 }, [['canart', 'S-CA-2203'], ['signature', 'S-SG-3102']]],
	['tee', { b: 2, h: 2, t: 0.25 }, [['extrudex', 'S-EX-1201']]],
	['tee', { b: 1.5, h: 1.5, t: 0.125 }, [['canart', 'S-CA-2301'], ['signature', 'S-SG-3201']]],
	['ibeam', { h: 4, b: 2.31, tw: 0.17, tf: 0.29 }, [['signature', 'S-SG-3301']]],
	['zbar', { h: 1.5, b: 1, t: 0.125 }, [['extrudex', 'S-EX-1301']]],
	['flat', { w: 2, t: 0.25 }, [['extrudex', 'S-EX-1401'], ['canart', 'S-CA-2401']]],
	['flat', { w: 3, t: 0.125 }, [['signature', 'S-SG-3401']]],
	['squarebar', { a: 1 }, [['canart', 'S-CA-2501']]],
	['roundbar', { d: 0.75 }, [['extrudex', 'S-EX-1501']]],
	['hexbar', { af: 1 }, [['signature', 'S-SG-3501']]],
	['roundtube', { od: 1.5, wall: 0.125 }, [['extrudex', 'S-EX-1601'], ['signature', 'S-SG-3601']]],
	['roundtube', { od: 2, wall: 0.065 }, [['canart', 'S-CA-2601']]],
	['squaretube', { a: 1, wall: 0.0625 }, [['extrudex', 'S-EX-1701'], ['canart', 'S-CA-2701'], ['signature', 'S-SG-3701']]],
	['squaretube', { a: 2, wall: 0.125 }, [['extrudex', 'S-EX-1702'], ['signature', 'S-SG-3702']]],
	['recttube', { a: 2, b: 1, wall: 0.125 }, [['canart', 'S-CA-2801'], ['signature', 'S-SG-3801']]],
	['recttube', { a: 4, b: 2, wall: 0.125 }, [['extrudex', 'S-EX-1801']]]
];

const OPTIONS = {
	alloy: ['6063-T5', '6063-T52', '6063-T6', '6061-T6', '6005A-T61', '6082-T6'],
	finish: ['Mill finish', 'Clear anodized', 'Black anodized', 'Bronze anodized', 'Powder coat (RAL on request)'],
	length: ["12'", "16'", "20'", "24'", 'Cut to length']
};

let ready = null;

/**
 * Creates the tables (once per isolate) and the sample data on an empty database.
 */
export function ensureSchema(db) {
	if (!ready) {
		ready = (async () => {
			const version = await db.prepare(`SELECT value FROM meta WHERE key = 'schema'`).first('value').catch(() => null);

			if (version !== SCHEMA_VERSION) {
				await db.batch(SCHEMA.map(sql => db.prepare(sql)));
				await db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)`).bind(SCHEMA_VERSION).run();
			}

			const count = await db.prepare(`SELECT COUNT(*) AS n FROM profiles`).first('n');

			if (!count) {
				await seed(db);
			}
		})().catch(error => {
			ready = null;
			throw error;
		});
	}

	return ready;
}

async function seed(db) {
	const stmts = [];

	MANUFACTURERS.forEach(([name, slug, website, province], i) => {
		stmts.push(db.prepare(`INSERT OR IGNORE INTO manufacturers (name, slug, website, province, sort) VALUES (?, ?, ?, ?, ?)`).bind(name, slug, website, province, i));
	});

	for (const [kind, labels] of Object.entries(OPTIONS)) {
		labels.forEach((label, i) => stmts.push(db.prepare(`INSERT INTO options (kind, label, sort) VALUES (?, ?, ?)`).bind(kind, label, i)));
	}

	await db.batch(stmts);

	const makers = Object.fromEntries((await db.prepare(`SELECT id, slug FROM manufacturers`).all()).results.map(r => [r.slug, r.id]));

	for (const [shape, raw, dies] of SAMPLE_PROFILES) {
		const dims = normalize(shape, raw);
		const id = await insertProfile(db, shape, dims, { source: 'catalog', notes: 'Sample data' });

		await db.batch(dies.map(([slug, number]) => db.prepare(`INSERT OR IGNORE INTO dies (profile_id, manufacturer_id, die_number) VALUES (?, ?, ?)`).bind(id, makers[slug], number)));
	}
}

export async function insertProfile(db, shape, dims, extra = {}) {
	const row = await db.prepare(`INSERT INTO profiles (shape, dims, dim_key, title, weight, status, source, alustock_url, notes, submitted_email)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
		.bind(shape, JSON.stringify(dims), dimKey(shape, dims), title(shape, dims), Math.round(weightPerFoot(shape, dims) * 1000) / 1000,
			extra.status || 'public', extra.source || 'catalog', extra.alustock_url || '', extra.notes || '', extra.email || '')
		.first();

	return row.id;
}

export function parseProfile(row) {
	return row ? { ...row, dims: JSON.parse(row.dims) } : null;
}
