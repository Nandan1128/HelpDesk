import { ImapListenerService } from '../src/services/imap-listener.service.js';
import { env } from '../src/config/env.js';

async function main() {
  console.log('----------------------------------------------------');
  console.log('📬 Checking Gmail Inbox for New Support Emails');
  console.log('----------------------------------------------------');
  console.log(`IMAP Host:     ${env.IMAP_HOST}:${env.IMAP_PORT}`);
  console.log(`Account Email: ${env.EMAIL_USER}`);
  console.log('----------------------------------------------------');

  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    console.error('❌ EMAIL_USER or EMAIL_PASS is missing in .env');
    process.exit(1);
  }

  // Look back up to 2 hours for manual test runs
  ImapListenerService.startTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

  console.log('🔍 Connecting to Gmail IMAP and fetching unread emails...\n');
  const results = await ImapListenerService.pollOnce();

  if (results.length === 0) {
    console.log('✨ No new unread support emails found in your inbox.');
  } else {
    console.log(`\n🎉 Processed ${results.length} email(s):`);
    for (const item of results) {
      console.log(` - From: ${item.from}`);
      console.log(`   Subject: "${item.subject}"`);
      console.log(`   Action: ${item.action}${item.ticketNumber ? ` -> Ticket #${item.ticketNumber}` : ''}`);
      if (item.error) {
        console.log(`   Error: ${item.error}`);
      }
      console.log('   ---');
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error polling emails:', err);
  process.exit(1);
});
