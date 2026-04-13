#!/usr/bin/env node

/**
 * One-time setup script to obtain a Google OAuth2 refresh token.
 *
 * Prerequisites:
 *   - npm install (googleapis and dotenv must be installed)
 *   - .env file with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 *     (or pass the path to your OAuth client JSON: node scripts/get-token.js path/to/client_secret.json)
 *
 * What it does:
 *   1. Starts a temporary local HTTP server on port 3000
 *   2. Opens your browser to Google's OAuth consent screen
 *   3. After you approve, Google redirects back to localhost
 *   4. The script exchanges the auth code for tokens and prints your refresh token
 *   5. The server shuts down automatically
 *
 * Store the refresh token as the GOOGLE_REFRESH_TOKEN GitHub Actions secret.
 */

import { google } from 'googleapis';
import { createServer } from 'http';
import { URL } from 'url';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { exec } from 'child_process';

config();

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

// ---------------------------------------------------------------------------
// Resolve client credentials: either from a JSON file arg or from .env
// ---------------------------------------------------------------------------
function getCredentials() {
  const jsonPath = process.argv[2];

  if (jsonPath) {
    const absPath = resolve(jsonPath);
    if (!existsSync(absPath)) {
      console.error(`File not found: ${absPath}`);
      process.exit(1);
    }

    const raw = JSON.parse(readFileSync(absPath, 'utf-8'));
    // Google's downloaded JSON nests credentials under "installed" or "web"
    const creds = raw.installed || raw.web || raw;
    return { clientId: creds.client_id, clientSecret: creds.client_secret };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      'Missing credentials. Either:\n' +
        '  • Pass the downloaded OAuth client JSON: node scripts/get-token.js path/to/client_secret.json\n' +
        '  • Or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env\n',
    );
    process.exit(1);
  }

  return { clientId, clientSecret };
}

// ---------------------------------------------------------------------------
// Open a URL in the default browser (cross-platform)
// ---------------------------------------------------------------------------
function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log('\nCould not open browser automatically. Open this URL manually:\n');
      console.log(url);
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const { clientId, clientSecret } = getCredentials();

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authorization denied</h1><p>You can close this tab.</p>');
    console.error(`\nAuthorization denied: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>Missing authorization code</h1>');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<h1 style="font-family:system-ui;color:#1a1a1a">&#10003; Authorization successful</h1>' +
        '<p style="font-family:system-ui;color:#6b6b6b">You can close this tab and return to your terminal.</p>',
    );

    console.log('\n' + '='.repeat(60));
    console.log('  REFRESH TOKEN (copy this)');
    console.log('='.repeat(60) + '\n');
    console.log(tokens.refresh_token);
    console.log('\n' + '='.repeat(60));
    console.log('\nNext steps:');
    console.log('  1. Add to .env:  GOOGLE_REFRESH_TOKEN=<token above>');
    console.log('  2. Add as GitHub Actions secret: GOOGLE_REFRESH_TOKEN');
    console.log('  3. Run `npm start` to test locally\n');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Token exchange failed</h1><pre>' + err.message + '</pre>');
    console.error('\nFailed to exchange code for tokens:', err.message);
  }

  server.close();
});

server.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│  Google OAuth2 Token Setup                  │');
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│  Callback server listening on port ${PORT}     │`);
  console.log('│  Opening browser for authorization...       │');
  console.log('└─────────────────────────────────────────────┘\n');

  openBrowser(authUrl);
});
