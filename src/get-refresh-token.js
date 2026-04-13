/**
 * One-time helper script to obtain a Google OAuth2 refresh token.
 *
 * Usage:
 *   1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file
 *   2. Run: node src/get-refresh-token.js
 *   3. Open the URL printed in your browser and sign in with your Google account
 *   4. Paste the authorization code back into the terminal
 *   5. Copy the refresh token into your .env file and GitHub Actions secrets
 */

import { google } from 'googleapis';
import { createInterface } from 'readline';
import { config } from 'dotenv';

config();

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob',
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in with your Google account and grant access.');
console.log('3. Copy the authorization code and paste it below.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Authorization code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\nYour refresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\nAdd this as GOOGLE_REFRESH_TOKEN in your .env file and GitHub Actions secrets.\n');
  } catch (err) {
    console.error('Error exchanging code for tokens:', err.message);
    process.exit(1);
  }
});
