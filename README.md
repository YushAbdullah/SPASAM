# SPASAM — SAM Terapi (Syafiq Aura Massage)

Website for **SAM Terapi (Syafiq Aura Massage)**: traditional Malay massage, bekam and body scrub for men in Chendering, Kuala Terengganu.

**Live site:** https://yushabdullah.github.io/SPASAM/

## What's here

| Path | What it is |
|---|---|
| `index.html` | The whole website: services, booking flow, FAQ, contact. One file, no build step. |
| `img/` | Photos used on the site |
| `brand/` | SAM logo files (SVG + PNG): horizontal, stacked, reversed, mark, app icon, favicon |
| `config.js` | Paste the Google Apps Script web-app URL here to switch on automation |
| `apps-script/` | Booking backend for Google Apps Script (Sheet + Calendar + email + receipts) |
| `SETUP.md` | Step-by-step setup guide (Bahasa Melayu) |

## How booking works

1. Customer picks a service, a free date/time and In-Call / Out-Call (taken slots show as *Penuh*).
2. The booking is saved to the **Tempahan** Google Sheet and a **Google Calendar** event, and an email goes to syafiqaurawellness@gmail.com.
3. Customer pays the deposit (DuitNow QR / Maybank 1630 4662 3774) and uploads the receipt → saved to Google Drive and emailed to Sam.
4. Customer sends the pre-written booking message + receipt to Sam on WhatsApp (011-6979 6259).
5. Date changes stay in sync: website ("Tempahan saya") ↔ Sheet ↔ Calendar.

See **[SETUP.md](SETUP.md)** to switch the automation on. Without `apiUrl` in `config.js`, the site still works in WhatsApp-only mode.

## Updating

Edit `index.html` (prices and services are in the `SVC` list near the bottom of the file) and push to the `gh-pages` branch. GitHub Pages republishes in about a minute.
