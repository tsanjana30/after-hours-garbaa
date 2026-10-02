# After-Hours Garba booking system

The Express service in `backend/` serves both the API and the pages in `frontend/`. The admin dashboard is `/admin.html`; `/history.html` shows every pass, payment decision, email status, last email error, and payment proof.

## Run locally

1. In `backend/`, install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and fill in the settings.
3. Start the service with `npm start` and open `http://localhost:5000`.

`MONGODB_URI` is required for bookings. `ADMIN_KEY` protects the admin page's API. `EMAIL_USER` is the organizer's inbox. For local email delivery, set `EMAIL_APP_PASSWORD` to that Gmail account's app password; the server uses Gmail SMTP when no Resend sender is configured. For Render Free, set `RESEND_API_KEY` and `RESEND_FROM` instead. `RESEND_FROM` must be an address on a domain verified in Resend; the Resend test sender is not suitable for customer delivery.

## Render

The root `render.yaml` defines a web service that keeps the repository root available, runs `cd backend && npm ci` to build, runs `cd backend && npm start` to serve the app, and checks `/api/health`. Set all five secret settings listed in the Blueprint in Render. If an existing Render service is managed outside the Blueprint, leave its Root Directory blank and apply the same commands and environment variables in that service's settings. The server needs access to the sibling `frontend/` folder at runtime. Render Free blocks outbound SMTP ports, so Gmail app-password delivery is for local use or hosts that allow SMTP.

The health check returns 503 until MongoDB connects, and reports whether email is configured. New payment screenshots are stored with booking records so they remain available after a Render restart. Older bookings still use their original disk screenshots if those files are present.

At submission, the customer gets a pending-verification email and the organizer gets a notice to review the booking in the admin page. The verified QR pass is sent to the customer after the organizer verifies payment. The admin page shows booking email status, can retry failed booking notifications, and can resend a verified pass by ticket ID if its first email failed.

## Netlify and Vercel

Deploy the repository root with the included `netlify.toml` or `vercel.json`. Both hosts serve the frontend and run the same Express API as a function. Set `MONGODB_URI`, `ADMIN_KEY`, `EMAIL_USER`, `RESEND_API_KEY`, and `RESEND_FROM` in the host environment. Use a sender on a verified Resend domain. See `startup guide.md` for short setup and usage steps. Uploads are limited to 3 MB so booking requests fit Vercel's function payload limit.
