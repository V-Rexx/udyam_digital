# Udyam Digital

A phone-first journey that takes a small business owner from "what do I need?" to a tracked order, in their language, for the fictional operator Accel Business. Built for YTL Hackathon 2026, Enterprise Track A. All data is synthetic.

## Run it

You need Node 20+ and MongoDB (local, Atlas, or `docker compose up -d`).

```bash
npm install && npm run install:all
cp .env.example server/.env        # add GEMINI_API_KEY, and a real OPS_TOKEN
npm run build && npm start         # http://localhost:4000
```

During development, `npm run dev` gives you hot reload at http://localhost:5173.

| Where | What |
|---|---|
| `/` | The owner's journey |
| `/track` | Order tracker: order number plus mobile |
| `/ops` | Back office (password is `OPS_TOKEN`): handed-over leads ranked by propensity, orders, metrics |

Before you record or present, with `GEMINI_API_KEY` set, run `npm run check:llm --prefix server`. It holds six real conversations with the live model and prints PASS or FAIL.

To put it online (judges can then open it on their phones, and camera and voice get the HTTPS they need): create a free MongoDB Atlas cluster, push this repo to GitHub, then in Render choose New > Blueprint and pick the repo. `render.yaml` and the `Dockerfile` do the rest. Fill in `MONGODB_URI`, `GEMINI_API_KEY` and `DATA_KEY` when asked.

Test the phone view on a real phone: run `npm run dev`, then open `http://<your-laptop-ip>:5173` on the same Wi-Fi. Camera capture and voice input may need HTTPS on a phone; deploying gives you that, and the specimen picker works without either.

Without `GEMINI_API_KEY` the advisor runs on a scripted fallback, which is enough to test the flow but is not the GenAI advisor the brief asks for.

The OTP is a real flow: the server generates a code, stores only a keyed hash, and allows 5 minutes, 5 tries and one resend every 30 seconds. The order is refused without it. With no SMS provider set, demo mode shows the code on screen; set `SMS_API_URL` to send real SMS. With `DEMO_MODE=false` and no provider, no code is issued.

## How it is built, and why

```
React PWA  →  Express API  →  MongoDB
                  ├─ Rules engine (eligibility, dependencies, price)
                  ├─ Advisor (Gemini LLM + scripted fallback)
                  ├─ Smart KYC (OCR, registries, validation)
                  └─ Orders and back office
```

**The LLM never chooses a product or a price.** It reads what the owner says and explains the result. `server/src/engine/recommend.js` decides, using only `product_catalogue.csv`. A reply containing a rupee figure the engine did not produce is thrown away and replaced by a template. So prompt injection, or a model having a bad day, cannot sell an ineligible bundle or invent a price. Every order is checked again on the server before it is placed.

**The app is a web app, not a Play Store app.** A link from an ad or WhatsApp starts straight away, with nothing to install, and every extra step loses leads in a funnel that activates 7%.

**OCR runs on our server, not a cloud API.** Identity documents never leave, and photos stay in memory and are dropped after reading. A GSTIN that fails its checksum is read again at other scales: a misread changes between readings, a wrong number does not. That is how it separates a bad photo from a bad GSTIN.

**One journey document and one consent log.** That is all the database needs. Consent is append-only, so it survives as evidence.

| File | What it does |
|---|---|
| `server/src/engine/recommend.js` | Segment, eligibility, bundle, price, toggles, routing |
| `server/src/advisor/index.js` | What to ask next, and how a message becomes a bundle |
| `server/src/advisor/llm.js` | The only file that calls the LLM, with its guard rails |
| `server/src/advisor/extract.js` | Reads answers from text with no LLM |
| `server/src/advisor/copy.js`, `locales.js` | Advisor text in all 10 languages |
| `client/src/i18n.js`, `client/src/locales/` | Screen text in all 10 languages |
| `server/src/kyc/validate.js` | Every KYC rule, and the verdict |
| `server/src/kyc/ocr.js`, `parse.js`, `gstin.js` | Reading, field extraction, checksum and OCR repair |
| `server/src/routes/journey.js` | The owner's API, with consent enforced |
| `server/src/lib/privacy.js` | Masking, scrubbing, encryption |
| `analysis/leads_analysis.py` | Every number in the business case |

## Decisions you may be asked about

- **Price within the catalogue band:** micro pays the floor because price is its top objection and it accepts 32% of quotes. Others pay the midpoint, which is close to where past deals landed (48% of the band on average).
- **Contract length:** the longest minimum in the bundle. This matched all 368 past deals.
- **Udyam is not mandatory:** the catalogue never needs it and 46% of leads have none. It is asked for, and can be declined.
- **GST lookup replaces the certificate:** if the registry confirms the number, the owner need not upload it, which is less data and less friction.
- **Cancelled or suspended GSTIN:** GST-only products are blocked, but the owner can continue with the rest. A GSTIN that fails its checksum cannot.
- **Quantities:** defaults come from business size, and the owner can change them on the bill.

## Docs

`docs/` holds the demo video and script, business case, architecture diagram and `JUDGE_QA.md`, the questions judges are likely to ask.

## Tests

```bash
npm test     # needs MongoDB; set TEST_MONGODB_URI if it is not on the default port
```

- All 5,000 lead profiles through the engine: no bundle breaks a catalogue rule, and the segment classifier matches every lead.
- All 47 specimen documents through real OCR and validation.
- 17 advisor conversations typed in plain words, in `test/scenarios.test.js`. These are our guesses at what judges will try; their real list is private.
- Full journey through the API, including a fake LLM that invents prices, returns broken JSON and fails.

`node server/scripts/kyc_report.mjs` prints the KYC result for K01 to K12.

## Gemini tier

The free tier is fine for this demo, because all the data is synthetic and identifiers are scrubbed before any call. It is not for real customers: Google's terms let it use free-tier prompts to improve its products, and people may read them. Real use needs the paid tier.

## What is mocked or missing

Mocked: GSTIN and Udyam lookups (CSV-backed, as the brief asks), SMS delivery until a provider is set, UPI payment, fibre feasibility (the owner is asked), and order progress (moved by hand in `/ops`).

Not built: DigiLocker, a WhatsApp front end.

Languages: every screen and advisor message is in English, Hindi, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Tamil and Telugu, and `test/locales.test.js` fails if a string goes missing. Product names and terms like GST and UPI stay in English, and the back office is English only. Free text in a regional language is understood best with the LLM on; without it, the advisor reads yes/no, numbers and city names but not full sentences. The translations were not reviewed by native speakers, and that should happen before real use.
