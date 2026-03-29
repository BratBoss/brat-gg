# Security headers for brat.gg

This document defines the canonical security-header policy for brat.gg.

## Philosophy

brat.gg should stay:

- static
- host-agnostic
- security-first
- not dependent on Vercel as the source of truth

That means the policy is defined here in the repo.

The preferred enforcement method is **real HTTP response headers** applied by the host serving the site.

## Current site shape

At the time of writing, brat.gg is a small static site with:

- no JavaScript
- no iframes
- no forms
- no external fonts
- one local stylesheet
- self-hosted images and icons
- a local web manifest
- normal external links in page content, but no browser-side cross-origin fetches

This allows a strict CSP.

## Canonical header set

### Content-Security-Policy

Use this exact policy unless the site’s resource model changes:

```text
default-src 'self';
script-src 'none';
style-src 'self';
img-src 'self';
font-src 'self';
connect-src 'none';
object-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none';
manifest-src 'self'
```

### Companion headers

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Opener-Policy: same-origin
```

## Why this policy is strict

- `script-src 'none'` because brat.gg does not currently need JavaScript
- `connect-src 'none'` because the site does not make browser-side network calls
- `form-action 'none'` because the site has no forms
- `base-uri 'none'` is stricter than allowing a base URL at all
- `frame-ancestors 'none'` blocks embedding the site in frames
- `img-src 'self'` allows only same-origin images; do not add `data:` or external domains unless required by a real site change

## When this policy must be reviewed

Review this file before deploying any change that introduces:

- JavaScript
- inline scripts or inline styles
- external fonts
- external images or embeds
- forms
- browser-side fetch/XHR/WebSocket calls
- framing requirements

If a new feature requires loosening the policy, loosen only the specific directive needed and document why.

## Verification checklist

After applying these headers at the host layer, verify:

- `/`
- `/journal.html`
- `/gallery.html`
- `/links.html`
- `/401.html`
- `/403.html`
- `/404.html`
- `/500.html`

Also verify:

- stylesheet loads
- gallery images load
- favicon and touch icons load
- manifest loads
- no CSP errors appear in the browser console

## Vercel example

Vercel is only an example deployment target here, not the canonical source of truth.

If deploying on Vercel, add the header set in `vercel.json` with a catch-all route.

Example:

```json
{
  "rewrites": [
    {
      "source": "/.well-known/security.txt",
      "destination": "/security.txt"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; manifest-src 'self'"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Cross-Origin-Resource-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

## Maintenance rule

Do not loosen this policy “just in case.”

Start strict. Only loosen what the site demonstrably needs.
