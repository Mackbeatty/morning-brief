import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const TIMEZONE = 'America/Toronto';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function getGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const userEmail = process.env.GMAIL_USER_EMAIL;

  if (!userEmail) {
    throw new Error('GMAIL_USER_EMAIL environment variable is required');
  }

  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
    subject: userEmail,
  });
}

async function fetchCalendarEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  // Convert back to ISO strings for the API
  const timeMin = new Date(
    startOfDay.toLocaleString('en-US', { timeZone: TIMEZONE }) + ' UTC'
  );
  const timeMax = new Date(
    endOfDay.toLocaleString('en-US', { timeZone: TIMEZONE }) + ' UTC'
  );

  // Build proper timezone-aware bounds
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
  const timeMinISO = `${todayStr}T00:00:00`;
  const timeMaxISO = `${todayStr}T23:59:59`;

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(`${timeMinISO}-04:00`).toISOString(), // ET offset (will be -05:00 in winter)
    timeMax: new Date(`${timeMaxISO}-04:00`).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: TIMEZONE,
  });

  return (res.data.items || []).map((event) => ({
    time: event.start.dateTime
      ? new Date(event.start.dateTime).toLocaleTimeString('en-US', {
          timeZone: TIMEZONE,
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'All day',
    title: event.summary || '(No title)',
    location: event.location || '',
  }));
}

async function fetchEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread newer_than:2d',
    maxResults: 10,
  });

  const messages = res.data.messages || [];
  const emails = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'METADATA',
      metadataHeaders: ['From', 'Subject'],
    });

    const headers = detail.data.payload?.headers || [];
    const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find((h) => h.name === 'Subject')?.value || '(No subject)';
    const snippet = detail.data.snippet || '';

    emails.push({
      from: from.replace(/<.*>/, '').trim(),
      subject,
      preview: snippet.substring(0, 120),
    });
  }

  return emails;
}

async function generateBrief(events, emails) {
  const anthropic = new Anthropic();

  const userMessage = `Here is my data for today's brief:

## Calendar Events (${events.length} total)
${
  events.length === 0
    ? 'No events today.'
    : events.map((e) => `- ${e.time}: ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n')
}

## Unread Emails (${emails.length} total)
${
  emails.length === 0
    ? 'No unread emails.'
    : emails.map((e) => `- From: ${e.from} | Subject: ${e.subject} | Preview: ${e.preview}`).join('\n')
}

Return a JSON object (and ONLY the JSON object, no markdown fences) with this exact structure:
{
  "summary": "2-3 sentence overview of the day",
  "events": [{"time": "...", "title": "...", "location": "..."}],
  "emails": [{"from": "...", "subject": "...", "preview": "...", "priority": "high|medium|low"}],
  "metrics": {"events_today": 0, "unread_emails": 0, "high_priority_emails": 0},
  "generated_at": "ISO timestamp"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:
      'You are a morning brief assistant for Mack, a 24-year-old Canadian starting as Head of IT at a mortgage tech company in May. Be direct, skip pleasantries, flag anything time-sensitive or important.',
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text.trim();

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned);
}

async function main() {
  console.log('Starting Morning Brief generation...');

  const auth = getGoogleAuth();

  console.log('Fetching calendar events...');
  const events = await fetchCalendarEvents(auth);
  console.log(`Found ${events.length} events today.`);

  console.log('Fetching emails...');
  const emails = await fetchEmails(auth);
  console.log(`Found ${emails.length} unread emails.`);

  console.log('Generating brief with Anthropic...');
  const brief = await generateBrief(events, emails);

  // Ensure generated_at is set
  brief.generated_at = brief.generated_at || new Date().toISOString();

  const outputPath = join(ROOT, 'brief.json');
  writeFileSync(outputPath, JSON.stringify(brief, null, 2));
  console.log(`Brief written to ${outputPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
