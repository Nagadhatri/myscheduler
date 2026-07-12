export async function sendBookingStatusEmail({
  to,
  visitorName,
  status,
  remarks,
  ownerName,
  customHtml,
}: {
  to: string;
  visitorName: string;
  status: string;
  remarks?: string;
  ownerName: string;
  customHtml?: string;
}) {
  const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('GOOGLE_APPS_SCRIPT_WEBHOOK_URL is not set. Skipping email send.');
    return { success: false, error: 'Webhook URL not set' };
  }

  let subject = `Update on your meeting request with ${ownerName}`;
  
  if (status === 'New Request' || status === 'New Request from Unknown') {
    subject = `New Booking Request from ${visitorName}`;
  } else if (status === 'Accepted') {
    subject = `Meeting Accepted: ${ownerName}`;
  } else if (status === 'Cancelled' || status === 'Declined') {
    subject = `Meeting Declined: ${ownerName}`;
  } else if (status === 'Rescheduled') {
    subject = `Meeting Rescheduled: ${ownerName}`;
  } else if (status === 'Completed') {
    subject = `Meeting Completed: ${ownerName}`;
  }

  let actionText = '';
  if (status === 'Accepted') actionText = 'has accepted your meeting request.';
  else if (status === 'Cancelled' || status === 'Declined') actionText = 'has declined your meeting request.';
  else if (status === 'Rescheduled') actionText = 'has proposed to reschedule your meeting.';
  else if (status === 'Completed') actionText = 'has marked your meeting as completed.';
  else actionText = `has updated your meeting status to ${status}.`;

  const html = customHtml || `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Hello ${visitorName},</h2>
      <p style="color: #555; line-height: 1.5;">
        <strong>${ownerName}</strong> ${actionText}
      </p>
      ${remarks ? `
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #0070f3; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #333;">Remarks from ${ownerName}:</h4>
        <p style="margin: 0; color: #555;">${remarks}</p>
      </div>
      ` : ''}
      <p style="color: #888; font-size: 12px; margin-top: 40px;">
        This is an automated message from MyScheduler.
      </p>
    </div>
  `;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, body: html }),
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
