# Startup and usage guide

1. Install Node.js 20 or newer and have a MongoDB database.
2. Open a terminal in `backend` and run `npm ci`.
3. Copy `backend/.env.example` to `backend/.env`. Fill in `MONGODB_URI`, a private `ADMIN_KEY`, and the organizer's `EMAIL_USER`. For local emails, set `EMAIL_APP_PASSWORD` to that Gmail account's app password. Keep `.env` private.
4. Run `npm start` from `backend`, then open `http://localhost:5000`. Admin is `/admin.html`, all pass history is `/history.html`, and the gate scanner is `/scanner.html`. All three use the same admin key.
5. Run `npm test` from `backend` to check the project.

## Use the booking system

1. A guest opens `/booking.html`, chooses a pass, pays the organizer's UPI ID, and uploads a payment screenshot (JPG, PNG, or WEBP; 3 MB maximum). The guest and organizer receive booking emails when mail is configured.
2. The organizer opens `/admin.html` with `ADMIN_KEY`, checks the payment proof, then accepts or rejects the booking. Accepting sends the QR pass to the guest.
3. Use `/history.html` to search all passes, review payment and email status, see delivery errors, and retry an eligible failed email. Use `/scanner.html` at the gate to check a verified QR pass.

## Deploy on Render

Push the project to a private Git repository. Create a Render web service from the repository root, or use `render.yaml`. Build command: `cd backend && npm ci`. Start command: `cd backend && npm start`. Set `MONGODB_URI`, `ADMIN_KEY`, `EMAIL_USER`, `RESEND_API_KEY`, and `RESEND_FROM` in Render, and use `/api/health` as the health check. Leave **Root Directory** blank so the backend can serve `frontend`.

Render Free blocks Gmail SMTP, so it needs a Resend account and a `RESEND_FROM` address on a verified domain. Locally, the Gmail app password can send booking emails and verified passes. If no working mail provider is configured, bookings still save and the admin page shows failed email status for retry.

## Deploy on Netlify or Vercel

Connect the **whole project folder** as a Git repository (or upload its ZIP through a workflow that builds functions). Keep the site root at the repository root. The included `netlify.toml` and `vercel.json` publish the frontend and run the booking API as a function. Set `MONGODB_URI`, `ADMIN_KEY`, `EMAIL_USER`, `RESEND_API_KEY`, and `RESEND_FROM` in that host's environment settings; use a sender address on a verified Resend domain. Set Node.js 20 or newer. Check `/api/health` after deployment; it should show `success: true` and `emailConfigured: true`.

Do **not** deploy only the `frontend` folder as a static site: bookings, admin actions, and email need the included API function. Payment proofs are stored in MongoDB, so they survive function restarts. Keep screenshots at 3 MB or less. Netlify and Vercel have function size and run-time limits; test a real booking and both email deliveries on the chosen host before taking payments.

Before accepting real payments, confirm that the UPI ID in `backend/server.js` and `frontend/booking.html`, plus `frontend/assets/payment-qr.png`, all belong to the intended organizer. Update all three together if payment details change.
