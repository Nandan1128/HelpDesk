import { ImapFlow } from 'imapflow';
import { env } from '../src/config/env.js';

async function inspect() {
  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: env.IMAP_SECURE,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    const status = await client.status('INBOX', { messages: true, unseen: true });
    console.log('📬 Mailbox Status:', status);

    const unseenUids = await client.search({ seen: false });
    console.log('🔍 Unseen message sequence numbers / UIDs:', unseenUids);

    console.log('\n📋 Last 5 messages in INBOX:');
    const count = status.messages || 0;
    if (count > 0) {
      const start = Math.max(1, count - 4);
      for await (const msg of client.fetch(`${start}:*`, { envelope: true, flags: true, uid: true })) {
        const envelope = msg.envelope;
        console.log({
          seq: msg.seq,
          uid: msg.uid,
          flags: msg.flags ? Array.from(msg.flags) : [],
          from: envelope?.from?.[0]?.address,
          fromName: envelope?.from?.[0]?.name,
          to: envelope?.to?.[0]?.address,
          subject: envelope?.subject,
          date: envelope?.date,
        });
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

inspect().catch(console.error);
