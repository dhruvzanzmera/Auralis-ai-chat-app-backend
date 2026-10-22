# Auralis backend

Express/Mongoose API for Auralis authentication, user-owned conversations, Groq generation, usage analytics, and administration. For complete application architecture, frontend setup, deployment notes, API details, and test commands, see the [project README](../README.md).

## Quick start

1. Use Node.js 20.19+ or 22.12+ and start MongoDB.
2. If `.env` does not exist, copy `.env.example` to `.env`; configure `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, `GROQ_API_KEY`, and the frontend origin in `CLIENT_URLS`.
3. Configure SMTP if password reset email should be available. For Gmail, use
   `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`; set
   `SMTP_USER` to the full sending mailbox, `SMTP_PASSWORD` to its Google
   app password, and `SMTP_FROM` to that same mailbox. For another provider,
   use its SMTP host and credentials. Delivery failures are logged by SMTP
   error code; reset endpoints intentionally return a generic response to
   avoid revealing whether an email address has an account.
4. Install dependencies and configure the administrator:

   ```powershell
   npm install
   ```

   Set `ADMIN_EMAIL` in `.env` to promote an existing account at startup, or set
   `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` to create an administrator
   if that email does not yet exist. After MongoDB connects, the backend checks
   these settings and seeds the administrator before listening. If `ADMIN_EMAIL`
   is unset, startup continues without seeding an administrator.

   To seed or promote the administrator manually without starting the API, run:

   ```powershell
   npm run seed:admin
   ```

5. Start the API:

   ```powershell
   npm run dev
   ```

Usage timestamps and reports are UTC. Prompt text is excluded unless `RETAIN_USAGE_PROMPTS=true`. The Groq request timeout is configured with `GROQ_TIMEOUT_MS`.

## Test

```powershell
npm test
```
