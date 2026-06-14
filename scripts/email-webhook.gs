/**
 * Google Apps Script Webhook for MyScheduler
 * 
 * Instructions:
 * 1. Go to script.google.com and create a new project.
 * 2. Paste this code.
 * 3. Deploy > New deployment > Select type: Web app.
 * 4. Execute as: Me. Who has access: Anyone.
 * 5. Copy the Web app URL and set it as GOOGLE_APPS_SCRIPT_WEBHOOK_URL in your .env.local
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Extract parameters
    const { to, subject, body } = data;
    
    if (!to || !subject || !body) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required fields: to, subject, body'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Send email using GmailApp
    GmailApp.sendEmail(to, subject, "", {
      htmlBody: body
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Email sent successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
