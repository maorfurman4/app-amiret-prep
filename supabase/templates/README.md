# Auth email templates (134+)

Branded Hebrew/RTL versions of the emails Supabase Auth sends, styled to match
the login/signup screen (paper background, the bare 134+ mark above a white
card, 24px/800 heading, full-width 48px navy button, sage reassurance line,
soft info box). Supabase does not read these files — they are the reviewed,
versioned source to paste into the dashboard.

| Dashboard template (Authentication → Emails → Templates) | Subject | File |
|---|---|---|
| **Confirm signup** | `אישור החשבון שלך ב־‎134+‎` | `confirm-signup.html` |
| **Reset password** | `איפוס הסיסמה ב־‎134+‎` | `reset-password.html` |

The subjects contain invisible left-to-right marks around `134+` (copy them as
is) — without them an RTL inbox shows the brand as `+134`. The HTML uses
`&#8206;134+&#8206;` for the same reason.

Both templates use `{{ .ConfirmationURL }}` (and the confirm email
`{{ .Email }}`). Keep that variable — it carries the app's `redirect_to`
(`/auth/callback?…&flow=signup|recovery`), so the link lands back in the app.

## Email-safety rules these follow
- Table layout, every style inline (Gmail drops `<style>`), no SVG.
- Logo: `https://amiret-prep.vercel.app/email/brand-mark.png` (the BrandLogo
  mark rendered at 3x on the paper color, `public/email/brand-mark.png`).
  **Deploy it before pasting the templates**, or the logo will 404.
- Heebo is linked for clients that load web fonts (Apple Mail/iOS); others
  fall back to Arial.
- Outlook gets a VML rounded button inside `<!--[if mso]>` comments. If the
  template engine strips comments, Outlook still gets the regular link button.
- Light only (`color-scheme: light`) — email dark modes are inconsistent.

## Sender name ("Supabase Auth <noreply@mail.app.supabase.io>")

The From name/address can only be changed with **custom SMTP**
(Authentication → Emails → SMTP Settings), e.g. Resend/Postmark with a domain
you own, sender name `134+`. The built-in Supabase mailer is also heavily
rate-limited (a handful of emails per hour for the whole project) and meant
for testing — real sign-ups will hit that limit, so custom SMTP is worth
setting up before launch.
