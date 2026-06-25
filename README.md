# Blood Donation App

A mobile-first blood donation booking app for LASUTH (Lagos State University Teaching Hospital, Ikeja). Donors can learn about donation, chat with an FAQ assistant, book a slot, and receive a confirmation email.

## Quick start

1. Open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
```

2. Complete the [Google Apps Script setup](#email-setup-google-apps-script) below to enable confirmation emails.

3. Paste your deployed Web App URL into `GAS_WEB_APP_URL` in `index.html`.

## Features

- Home screen with donate / learn-more flows
- FAQ page with expandable questions
- Donor Assistant chatbot (keyword-based answers)
- Booking form with age validation (18–60) and 30-day scheduling
- Thank-you page with pre-donation reminders
- Email confirmation via Google Apps Script + Gmail

## Email setup (Google Apps Script)

### 1. Create the script project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Delete any default code in `Code.gs`.
3. Copy the entire contents of [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) into the editor.
4. (Optional) Set `CLINIC_REPLY_TO` at the top of `Code.gs` to a clinic inbox address.
5. Click **Save** and name the project (e.g. `Blood Donation Email`).

### 2. Authorize Gmail

1. In the editor, select `doGet` from the function dropdown and click **Run**.
2. Approve the permissions when prompted (Gmail send access is required).
3. Check **Executions** if anything fails.

### 3. Deploy as a Web App

1. Click **Deploy** → **New deployment**.
2. Click the gear icon → choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, authorize if asked, then copy the **Web app URL** (ends in `/exec`).

### 4. Connect the frontend

In `index.html`, replace the placeholder:

```javascript
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

### 5. Test

1. Open the deployed Web App URL in a browser — you should see a JSON health check.
2. Submit a test booking in the app with your own email.
3. Check inbox (and spam) for the confirmation email.

## API contract

The frontend sends a `POST` with `Content-Type: text/plain` and a JSON body:

```json
{
  "name": "Ademola Oladotun Ayoola",
  "age": 28,
  "gender": "Male",
  "phone": "0803 123 4567",
  "email": "donor@example.com",
  "dateLabel": "Mon, 30 Jun 2025",
  "time": "10am",
  "hospital": "Lagos State University Teaching Hospital, Ikeja",
  "previous": "No",
  "notes": ""
}
```

Success response:

```json
{ "status": "success" }
```

Error response:

```json
{ "status": "error", "message": "..." }
```

## Project structure

```
frontend/
├── index.html                 # Full app (HTML, CSS, JS)
├── google-apps-script/
│   ├── Code.gs                # Gmail email backend
│   └── appsscript.json        # Apps Script manifest
└── README.md
```

## Notes

- Emails are sent from the Google account that deploys the script.
- A copy of each booking is also emailed to that same account for clinic records.
- Redeploy the Web App after changing `Code.gs` (Deploy → Manage deployments → Edit → New version).
