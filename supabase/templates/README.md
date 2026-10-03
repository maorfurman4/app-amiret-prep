# Auth email templates (134+)

Branded Hebrew/RTL versions of the emails Supabase Auth sends. Supabase
does not read these files — they are the source of truth to paste into the
dashboard, so the wording stays reviewed and versioned.

| Dashboard template (Authentication → Emails → Templates) | Subject | File |
|---|---|---|
| **Confirm signup** | `אישור החשבון שלך ב־134+` | `confirm-signup.html` |
| **Reset password** | `איפוס הסיסמה ב־134+` | `reset-password.html` |

Both use `{{ .ConfirmationURL }}` (and the confirm email `{{ .Email }}`).
Keep that variable — it carries the app's `redirect_to`
(`/auth/callback?…&flow=signup|recovery`), so the link lands back in the app.

The logo is loaded from `https://amiret-prep.vercel.app/icons/icon-192.png`
(PNG on purpose: Gmail does not render SVG). If the production domain
changes, update it in both files.

## Sender name ("Supabase Auth <noreply@mail.app.supabase.io>")

The From name/address can only be changed with **custom SMTP**
(Authentication → Emails → SMTP Settings), e.g. Resend/Postmark with a domain
you own, sender name `134+`. The built-in Supabase mailer is also heavily
rate-limited (a handful of emails per hour for the whole project) and meant
for testing — real sign-ups will hit that limit, so custom SMTP is worth
setting up before launch.
