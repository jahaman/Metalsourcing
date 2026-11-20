import { SVG_DEFS } from '../public/shapes.js';

export function e(value) {
	return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function html(body, init = {}) {
	return new Response(body, {
		status: init.status || 200,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) }
	});
}

export function json(data, status = 200) {
	return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export function redirect(location, headers = {}) {
	return new Response(null, { status: 303, headers: { location, ...headers } });
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">';

/**
 * Public page shell.
 */
export function page({ t, lang, title, description = '', body, active = '', query = '' }) {
	const other = lang === 'fr' ? 'en' : 'fr';
	const nav = [['/catalog', t('nav_catalog'), 'catalog'], ['/custom', t('nav_custom'), 'custom']];

	return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title ? title + ' · Metal Sourcing' : 'Metal Sourcing — ' + t('tagline'))}</title>
<meta name="description" content="${e(description || t('hero_lead'))}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${FONTS}
<link rel="stylesheet" href="/app.css">
</head>
<body>
${SVG_DEFS}
<a class="ms-skip" href="#main">Skip to content</a>
<header class="ms-header">
  <div class="ms-wrap ms-header__row">
    <a href="/" class="ms-logo" aria-label="Metal Sourcing home">${logo()}<span><b>Metal</b>Sourcing<small>${e(t('tagline'))}</small></span></a>
    <form class="ms-search" action="/search" role="search">
      <input type="search" name="q" value="${e(query)}" placeholder="${e(t('search_placeholder'))}" aria-label="${e(t('search'))}">
      <button type="submit">${e(t('search'))}</button>
    </form>
    <nav class="ms-nav" aria-label="Main">
      ${nav.map(([href, label, key]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${e(label)}</a>`).join('')}
      <a href="/request" class="ms-nav__request"${active === 'request' ? ' aria-current="page"' : ''}>${e(t('nav_request'))} <span class="ms-count" data-request-count>0</span></a>
      <a href="?lang=${other}" class="ms-lang" hreflang="${other}">${other.toUpperCase()}</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="ms-footer">
  <div class="ms-wrap ms-footer__row">
    <div><a href="/" class="ms-logo ms-logo--small">${logo()}<span><b>Metal</b>Sourcing</span></a><p>${e(t('footer_note'))}</p></div>
    <div class="ms-footer__links"><a href="/catalog">${e(t('nav_catalog'))}</a><a href="/custom">${e(t('nav_custom'))}</a><a href="/request">${e(t('nav_request'))}</a><a href="https://www.alustock.ca/" rel="noopener">alustock.ca</a></div>
  </div>
</footer>
<script type="module" src="/app.js"></script>
</body>
</html>`;
}

export function logo() {
	return '<svg class="ms-logo__mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" class="ms-logo__bg"/><path d="M10 29V11h5v13h15v5z" class="ms-logo__fg"/><path d="M19 11h11v4H19z" class="ms-logo__ac"/></svg>';
}

/**
 * Admin page shell.
 */
export function adminPage({ title, body, active = '', flash = '' }) {
	const nav = [['/admin', 'Dashboard', 'dashboard'], ['/admin/requests', 'Requests', 'requests'], ['/admin/profiles', 'Profiles', 'profiles'], ['/admin/manufacturers', 'Extruders', 'manufacturers'], ['/admin/options', 'Options', 'options']];

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${e(title)} · Metal Sourcing admin</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${FONTS}
<link rel="stylesheet" href="/app.css">
</head>
<body class="ms-admin">
${SVG_DEFS}
<header class="ms-admin__bar">
  <div class="ms-wrap ms-admin__row">
    <a href="/admin" class="ms-logo ms-logo--small">${logo()}<span><b>Metal</b>Sourcing <em>admin</em></span></a>
    <nav aria-label="Admin">${nav.map(([href, label, key]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <div class="ms-admin__end"><a href="/" target="_blank" rel="noopener">View site</a><form method="post" action="/admin/logout"><button class="ms-link">Sign out</button></form></div>
  </div>
</header>
<main class="ms-wrap ms-admin__main">
${flash ? `<div class="ms-flash" role="status">${e(flash)}</div>` : ''}
${body}
</main>
<script type="module" src="/admin.js"></script>
</body>
</html>`;
}
