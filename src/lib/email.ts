export async function sendEmailWebhook({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('GOOGLE_APPS_SCRIPT_WEBHOOK_URL is not set. Skipping email send.');
    return { success: false, error: 'Webhook URL not set' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, body }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to send email via webhook', error);
    return { success: false, error: String(error) };
  }
}
