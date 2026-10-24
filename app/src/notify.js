import nodemailer from 'nodemailer';

// Sends a plain-text alert for each pilot application over SMTP. Works with either
//   - the Google Workspace SMTP relay (smtp-relay.gmail.com:587, approved by server IP, no password), or
//   - a mailbox login (smtp.gmail.com:465 with SMTP_USER + an app password in SMTP_PASS).
export function createNotifier({ smtp, mail }) {
  if (!smtp.host || !mail.to.length || (smtp.user && !smtp.pass)) {
    console.warn('[notify] SMTP not fully configured (SMTP_HOST / LEAD_NOTIFY_TO, or SMTP_PASS for SMTP_USER) — email alerts disabled');
    return { leadReceived: async () => {} };
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: smtp.port !== 465, // never send in clear text
    name: smtp.ehloName || undefined,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  const from = mail.from || `"Bio Textile Solution UK" <${smtp.user}>`;

  return {
    async leadReceived(lead) {
      const text = [
        'New UK pilot application — Bio Textile Solution UK',
        '',
        `Name:      ${lead.name}`,
        `Company:   ${lead.company}`,
        `Email:     ${lead.email}`,
        `Category:  ${lead.category || '—'}`,
        `Volume:    ${lead.volume || '—'}`,
        `Specs:     ${lead.wantsSpecs ? 'Requested technical & compatibility specs' : '—'}`,
        `Received:  ${lead.createdAt}`,
        '',
        'Pilot objectives:',
        lead.message || '—',
      ].join('\n');

      await transport.sendMail({
        from,
        to: mail.to,
        replyTo: lead.email,
        subject: `Pilot application — ${lead.company}`,
        text,
      });
    },
  };
}
