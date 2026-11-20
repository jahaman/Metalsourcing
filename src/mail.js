/**
 * New-request e-mail through Cloudflare Email Routing (send_email binding "MAILER").
 * Needs MAIL_FROM (an address on metalsourcing.ca) and MAIL_TO (a verified destination);
 * without them requests are still saved and listed in the admin.
 */
import { EmailMessage } from 'cloudflare:email';

export async function notifyRequest(env, request, items, origin) {
	if (!env.MAILER || !env.MAIL_FROM || !env.MAIL_TO) {
		return;
	}

	const lines = items.map((i, n) => `${n + 1}. ${i.title} — ${i.quantity} pcs, ${[i.alloy, i.finish, i.length].filter(Boolean).join(', ')}${i.profile_id ? '' : ' (custom)'}${i.note ? `\n   Note: ${i.note}` : ''}`);

	const text = [
		`New request ${request.ref}`,
		'',
		`Name: ${request.name}`,
		request.company && `Company: ${request.company}`,
		`Email: ${request.email}`,
		request.phone && `Phone: ${request.phone}`,
		request.city && `City: ${request.city}`,
		'',
		...lines,
		'',
		request.message && `Message:\n${request.message}\n`,
		`Open in admin: ${origin}/admin/requests/${request.id}`
	].filter(line => typeof line === 'string').join('\n').replace(/\n{3,}/g, '\n\n');

	const subject = `Request ${request.ref} — ${request.company || request.name}`;
	const raw = [
		`From: Metal Sourcing <${env.MAIL_FROM}>`,
		`To: ${env.MAIL_TO}`,
		`Reply-To: ${request.email.replace(/[\r\n<>]/g, '')}`,
		`Subject: =?UTF-8?B?${b64(subject)}?=`,
		`Message-ID: <${crypto.randomUUID()}@${env.MAIL_FROM.split('@')[1]}>`,
		`Date: ${new Date().toUTCString()}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=utf-8',
		'Content-Transfer-Encoding: base64',
		'',
		b64(text).replace(/.{76}/g, '$&\r\n')
	].join('\r\n');

	await env.MAILER.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, raw));
}

function b64(text) {
	const bytes = new TextEncoder().encode(text);
	let bin = '';

	bytes.forEach(b => { bin += String.fromCharCode(b); });

	return btoa(bin);
}
