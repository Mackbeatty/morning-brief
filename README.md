# Morning Brief

An AI-powered daily brief that fetches your Gmail and Google Calendar data, generates a personalized summary using the Anthropic API, and publishes it to a GitHub Pages web app you can open on any device.

Runs automatically every morning at 7am ET via GitHub Actions.

## How It Works

1. GitHub Actions triggers the script on schedule (7am ET daily)
2. The script authenticates with Google APIs using OAuth2 (refresh token)
3. It fetches today's calendar events and recent unread emails
4. All data is sent to Claude (Anthropic API) to generate a structured brief
5. The result is written to `brief.json` and committed back to the repo
6. GitHub Pages serves `docs/index.html`, which reads `brief.json` and renders your brief

## Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page, then click **New Project**
3. Name it something like `morning-brief`, then click **Create**
4. Wait for the project to be created, then select it from the project dropdown

### 2. Enable Gmail and Calendar APIs

1. In the Google Cloud Console, go to **APIs & Services > Library** (or search "API Library" in the top search bar)
2. Search for **Gmail API**, click on it, then click **Enable**
3. Go back to the API Library, search for **Google Calendar API**, click on it, then click **Enable**

### 3. Configure the OAuth Consent Screen

1. In the Google Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Select **External** as the user type, then click **Create**
3. Fill in the required fields:
   - **App name**: `Morning Brief`
   - **User support email**: your email address
   - **Developer contact email**: your email address
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
6. Find and check these two scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
7. Click **Update**, then **Save and Continue**
8. On the **Test users** page, click **+ Add Users**
9. Enter your Gmail address and click **Add**, then **Save and Continue**
10. Click **Back to Dashboard**

> **Note:** The app will stay in "Testing" mode, which is fine — only your account needs access. Test users can use the app indefinitely without needing to publish it.

### 4. Create OAuth2 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **+ Create Credentials** at the top, then select **OAuth client ID**
3. For **Application type**, select **Web application** (not Desktop app)
4. Name it `Morning Brief`
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   http://localhost:3000/callback
   ```
6. Click **Create**
7. A dialog will show your **Client ID** and **Client Secret** — copy both and save them somewhere safe (or download the JSON)
8. Click **OK**

### 5. Get Your Refresh Token

You can provide credentials either via `.env` or by passing the downloaded JSON file directly.

**Option A — Using the downloaded client JSON (easiest):**

1. Clone this repo and install dependencies:
   ```bash
   git clone https://github.com/<your-username>/morning-brief.git
   cd morning-brief
   npm install
   ```
2. Run the token script, passing the JSON file Google gave you when you created the OAuth client:
   ```bash
   node scripts/get-token.js path/to/client_secret_XXXX.json
   ```

**Option B — Using `.env`:**

1. Clone and install (same as above)
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and fill in your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Step 4
4. Run:
   ```bash
   npm run get-token
   ```

**Either way, the script will:**

1. Start a temporary local server on port 3000
2. Open your browser to Google's consent screen
3. After you sign in and approve, Google redirects back to `localhost:3000/callback`
4. The script exchanges the code for tokens and prints your **refresh token** in the terminal
5. Copy the refresh token and save it — you'll need it for `.env` and GitHub Actions secrets

> **Important:** This refresh token does not expire as long as the app stays in "Testing" mode and you don't revoke access. Keep it secret.

### 6. Add GitHub Actions Secrets

1. Go to your GitHub repository
2. Click **Settings** (tab at the top of the repo)
3. In the left sidebar, click **Secrets and variables > Actions**
4. Click **New repository secret** and add each of the following:

| Secret Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com/)) |
| `GOOGLE_CLIENT_ID` | The OAuth2 Client ID from Step 4 |
| `GOOGLE_CLIENT_SECRET` | The OAuth2 Client Secret from Step 4 |
| `GOOGLE_REFRESH_TOKEN` | The refresh token you obtained in Step 5 |

### 7. Enable GitHub Pages

1. Go to your GitHub repository's **Settings**
2. In the left sidebar, click **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, select `main` and set the folder to `/docs`
5. Click **Save**
6. Your brief will be available at `https://<your-username>.github.io/morning-brief/`

### 8. Test with a Manual Run

1. Go to your GitHub repository
2. Click the **Actions** tab
3. In the left sidebar, click **Morning Brief**
4. Click **Run workflow** (dropdown on the right)
5. Select the `main` branch and click the green **Run workflow** button
6. Wait for the workflow to complete (usually 30-60 seconds)
7. Check `brief.json` in your repo — it should now contain your brief
8. Visit your GitHub Pages URL to see the rendered brief

## Local Development

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. If you haven't already, run `npm run get-token` to get your refresh token (see Step 5 above).

4. Run the script:
   ```bash
   npm start
   ```

5. Open `docs/index.html` in your browser to see the rendered brief.

## Project Structure

```
morning-brief/
├── .github/workflows/
│   └── morning-brief.yml   ← GitHub Actions workflow (daily cron + manual)
├── scripts/
│   └── get-token.js         ← One-time setup: obtain OAuth2 refresh token
├── src/
│   └── brief.js             ← Main script: fetches data, calls Anthropic, writes JSON
├── docs/
│   └── index.html           ← GitHub Pages frontend (vanilla HTML/CSS/JS)
├── brief.json               ← Output: the generated brief (committed by Actions)
├── package.json
├── .env.example
└── README.md
```

## Troubleshooting

- **"GOOGLE_REFRESH_TOKEN environment variable is required"**: Make sure you've added all three Google secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) in GitHub Actions settings.
- **401 or "invalid_grant" errors**: Your refresh token may have been revoked. Re-run `npm run get-token` to get a new one and update the secret.
- **403 errors from Google APIs**: The OAuth consent screen scopes may not include Gmail or Calendar. Go back to the consent screen setup and make sure both `gmail.readonly` and `calendar.readonly` scopes are added.
- **"Access blocked: This app's request is invalid"**: You may not have added your email as a test user in the OAuth consent screen. Go to **APIs & Services > OAuth consent screen > Test users** and add your Gmail address.
- **Empty brief.json**: Check the GitHub Actions logs for errors. The Anthropic API key might be invalid, or the Google credentials might not be set up correctly.
- **GitHub Pages shows "No brief available yet"**: The workflow hasn't run yet, or `brief.json` hasn't been pushed. Trigger a manual run from the Actions tab.
