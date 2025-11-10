import { Resend } from 'resend';

let client;

function getClient() {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  client = new Resend(apiKey);
  return client;
}

export async function sendEmail({ subject, html, text, to, from }) {
  const resend = getClient();
  const recipients = Array.isArray(to) ? to : [to];
  return resend.emails.send({
    from: from || process.env.RESEND_FROM_EMAIL || 'noreply@attendance.local',
    to: recipients,
    subject,
    html,
    text
  });
}

