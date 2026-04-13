# Morning Brief

An AI-powered daily brief that fetches your Gmail and Google Calendar data, generates a personalized summary using the Anthropic API, and publishes it to a GitHub Pages web app you can open on any device.

Runs automatically every morning at 7am ET via GitHub Actions.

## How It Works

1. GitHub Actions triggers the script on schedule (7am ET daily)
2. The script authenticates with Google APIs using a service account
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

### 3. Create a Service Account

1. Go to **APIs & Services > Credentials** in the left sidebar
2. Click **+ Create Credentials** at the top, then select **Service account**
3. Give it a name like `morning-brief-sa` and click **Create and Continue**
4. Skip the optional "Grant this service account access" step (click **Continue**)
5. Skip the optional "Grant users access" step (click **Done**)
6. You'll be taken back to the Credentials page. Click on the service account you just created
7. Go to the **Keys** tab
8. Click **Add Key > Create new key**
9. Select **JSON** and click **Create**
10. A JSON file will download to your computer. Keep this safe — you'll need its contents for GitHub Actions secrets

### 4. Set Up Domain-Wide Delegation (Google Workspace)

If you're using a Google Workspace account (company/organization email), you need domain-wide delegation so the service account can read your Gmail and Calendar:

1. On the service account details page, go to the **Details** tab
2. Under **Advanced settings**, find and expand **Domain-wide delegation**
3. Click **Enable domain-wide delegation** (you may need to configure the OAuth consent screen first — choose "Internal" if prompted)
4. Copy the **Client ID** (a long number) from the service account details page
5. Go to [Google Workspace Admin Console](https://admin.google.com/) (you need admin access)
6. Navigate to **Security > Access and data control > API controls**
7. Click **Manage Domain-wide Delegation**
8. Click **Add new**
9. Paste the **Client ID** you copied
10. In the **OAuth Scopes** field, enter these two scopes (comma-separated):
    ```
    https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/calendar.readonly
    ```
11. Click **Authorize**

**If you're using a personal Gmail account (not Workspace):** Domain-wide delegation won't work. Instead, you'll need to use OAuth2 credentials. Consider using a Google Workspace account, or modify the script to use OAuth2 with a refresh token.

### 5. Share Your Calendar with the Service Account (Alternative to Domain-Wide Delegation)

If you don't have Google Workspace admin access, you can share your calendar directly:

1. Open [Google Calendar](https://calendar.google.com/)
2. Find your calendar in the left sidebar, click the three dots next to it, then **Settings and sharing**
3. Scroll to **Share with specific people or groups**
4. Click **+ Add people and groups**
5. Paste the service account email (found on the service account details page, looks like `morning-brief-sa@your-project.iam.gserviceaccount.com`)
6. Set permission to **See all event details**
7. Click **Send**

Note: This only covers Calendar. For Gmail, you need domain-wide delegation.

### 6. Add GitHub Actions Secrets

1. Go to your GitHub repository
2. Click **Settings** (tab at the top of the repo)
3. In the left sidebar, click **Secrets and variables > Actions**
4. Click **New repository secret** and add each of the following:

| Secret Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com/)) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The entire contents of the JSON key file you downloaded in Step 3 |
| `GMAIL_USER_EMAIL` | The email address whose Gmail and Calendar the service account should access (your email) |

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

3. For `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the entire contents of your service account JSON key file as a single line.

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

- **"GMAIL_USER_EMAIL environment variable is required"**: Make sure you've added the `GMAIL_USER_EMAIL` secret in GitHub Actions settings.
- **403 errors from Google APIs**: The service account doesn't have permission. Check that domain-wide delegation is set up correctly, or that you've shared your calendar with the service account email.
- **"Delegation denied" errors**: The OAuth scopes in the admin console don't match what the script requests. Make sure both `gmail.readonly` and `calendar.readonly` scopes are authorized.
- **Empty brief.json**: Check the GitHub Actions logs for errors. The Anthropic API key might be invalid, or the Google credentials might not be set up correctly.
- **GitHub Pages shows "No brief available yet"**: The workflow hasn't run yet, or `brief.json` hasn't been pushed. Trigger a manual run from the Actions tab.
