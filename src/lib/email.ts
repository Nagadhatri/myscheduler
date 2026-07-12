import { Resend } from 'resend';

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

// The default sender email address
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

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
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Email not sent.");
    return;
  }

  let subject = `Update on your meeting request with ${ownerName}`;
  let actionText = '';

  if (status === 'Accepted') {
    subject = `Meeting Accepted: ${ownerName}`;
    actionText = 'has accepted your meeting request.';
  } else if (status === 'Cancelled' || status === 'Declined') {
    subject = `Meeting Declined: ${ownerName}`;
    actionText = 'has declined your meeting request.';
  } else if (status === 'Rescheduled') {
    subject = `Meeting Rescheduled: ${ownerName}`;
    actionText = 'has proposed to reschedule your meeting.';
  } else if (status === 'Completed') {
    subject = `Meeting Completed: ${ownerName}`;
    actionText = 'has marked your meeting as completed.';
  } else {
    actionText = `has updated your meeting status to ${status}.`;
  }

  const html = `
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
    const data = await resend.emails.send({
      from: `MyScheduler <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html: customHtml || html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email via Resend:", error);
    return { success: false, error };
  }
}
