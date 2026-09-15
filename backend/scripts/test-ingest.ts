import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from '../src/config/env.js';
import { EmailIngestionService } from '../src/services/email-ingestion.service.js';

async function testFetchAndIngest() {
  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: env.IMAP_SECURE,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    logger: false,
  });

  await client.connect();
  console.log('Connected to IMAP.');
  const lock = await client.getMailboxLock('INBOX');

  try {
    const unseenUids = await client.search({ seen: false }, { uid: true });
    console.log('Unseen UIDs found:', unseenUids ? (Array.isArray(unseenUids) ? unseenUids.length : typeof unseenUids) : 0);

    if (Array.isArray(unseenUids) && unseenUids.length > 0) {
      const targetUids = unseenUids.slice(-5);
      console.log('Target UIDs to process:', targetUids);

      const messageStream = client.fetch(targetUids, { source: true, uid: true }, { uid: true });

      for await (const msg of messageStream) {
        if (!msg.source) continue;

        console.log(`\nFetching UID: ${msg.uid}...`);
        const parsed = await simpleParser(msg.source);
        const fromAddress = parsed.from?.value?.[0]?.address;
        const fromName = parsed.from?.value?.[0]?.name || 'Customer';

        console.log({
          from: fromAddress,
          name: fromName,
          subject: parsed.subject,
          text: parsed.text?.substring(0, 100),
        });

        if (fromAddress) {
          try {
            const res = await EmailIngestionService.processInboundEmail({
              from: fromAddress,
              fromName,
              to: env.SUPPORT_EMAIL,
              subject: parsed.subject || '(No Subject)',
              body: parsed.text || 'No text content',
              html: typeof parsed.html === 'string' ? parsed.html : undefined,
              messageId: parsed.messageId,
              inReplyTo: parsed.inReplyTo,
            });
            console.log(`✅ Ingested successfully: Ticket #${res.ticket.ticketNumber} (${res.ticket.subject})`);
            await client.messageFlagsAdd([msg.uid], ['\\Seen'], { uid: true });
          } catch (ingestErr: any) {
            console.error('❌ Ingest error:', ingestErr);
          }
        }
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
  console.log('\nFinished.');
}

testFetchAndIngest().catch(console.error);
