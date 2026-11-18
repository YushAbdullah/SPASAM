# SPASAM — Syafiq Aura Massage

Website for **Spa SAM (Syafiq Aura Massage)**: traditional Malay massage, bekam and body scrub for men in Chendering, Kuala Terengganu.

**Live site:** https://yushabdullah.github.io/SPASAM/

## What's here

| Path | What it is |
|---|---|
| `index.html` | The whole website: services, booking flow, FAQ, contact. One file, no build step. |
| `img/` | Photos used on the site |
| `brand/` | SAM logo files (SVG + PNG): horizontal, stacked, reversed, mark, app icon, favicon |

## How booking works

Customers pick a service, date, time and In-Call / Out-Call, then tap **Hantar via WhatsApp**. The site opens WhatsApp to Sam (011-6979 6259) with the booking message already written. Sam confirms, sends deposit details, and the customer replies with the receipt.

## Updating

Edit `index.html` (prices and services are in the `SVC` list near the bottom of the file) and push to the `gh-pages` branch. GitHub Pages republishes in about a minute.
