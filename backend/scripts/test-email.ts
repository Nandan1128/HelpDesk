import { EmailService } from '../src/services/email.service.js';
import { env } from '../src/config/env.js';

async function main() {
  console.log('----------------------------------------------------');
  console.log('🚀 Testing Email Configuration');
  console.log('----------------------------------------------------');
  console.log(`Current EMAIL_PROVIDER: ${env.EMAIL_PROVIDER}`);
  console.log(`Configured EMAIL_USER:   ${env.EMAIL_USER || '(none)'}`);
  console.log('----------------------------------------------------');

  if (env.EMAIL_PROVIDER !== 'mock') {
    console.log('🔍 Verifying SMTP connection...');
    const verification = await EmailService.verifyConnection();
    console.log(verification.message);

    if (!verification.success) {
      console.error('\n❌ SMTP Verification failed. Please check your EMAIL_USER and EMAIL_PASS in .env');
      process.exit(1);
    }
  }

  const targetEmail = process.argv[2] || env.EMAIL_USER || env.ADMIN_EMAIL;
  console.log(`\n📤 Sending test email to: ${targetEmail}`);

  const result = await EmailService.sendEmail({
    to: targetEmail,
    subject: '🧪 Ticket AI - Test Email Notification',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb;">🎉 Email Integration Successful!</h2>
        <p>This email confirms that your Ticket AI application can send emails using <strong>${env.EMAIL_PROVIDER}</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
  });

  if (result.success) {
    console.log('\n✅ Email sent successfully!');
    console.log(`Message ID: ${result.messageId}`);
  } else {
    console.error('\n❌ Failed to send email:', result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
