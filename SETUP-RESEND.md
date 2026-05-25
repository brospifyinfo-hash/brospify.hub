# Resend-Setup für Brospify (Hub + Shop)

Diese Anleitung verbindet **brospify.com** (Shop) und **brospifyhub.com**
(Hub) mit Resend, damit drei Mail-Flows funktionieren:

| Flow | FROM | TO | Trigger |
|------|------|----|---------|
| Lizenz-Mail nach Kauf | `noreply@brospify.com` | Kunde | Shopify-Webhook → `/api/shopify/webhook` |
| Neues Ticket | `noreply@brospifyhub.com` | `brospify.info@gmail.com` | Kunde drückt „Ticket erstellen" |
| Credits niedrig | `noreply@brospifyhub.com` | `brospify.info@gmail.com` | Guthaben < 200 |

---

## ⏱ Zeitaufwand: ~20 Min einmalig

| Schritt | Wer | Dauer |
|--------|-----|-------|
| 1. Resend-Account + API-Key | Du | 3 Min |
| 2. brospify.com bei Resend verifizieren | Du (DNS-Records setzen) | 5 Min + DNS-Propagation |
| 3. brospifyhub.com bei Resend verifizieren | Du (DNS-Records setzen) | 5 Min + DNS-Propagation |
| 4. Vercel-Env-Vars setzen | Ich (sobald du `vercel login` gemacht hast) | 1 Min |
| 5. Redeploy + Test | Ich | 4 Min |

---

## Schritt 1 — Resend-Account + API-Key (DU, 3 Min)

1. https://resend.com → **Sign up** (Gmail-Login geht).
2. Einmal eingeloggt: links im Menü **API Keys** → **Create API Key**.
   - Name: `Brospify Hub Production`
   - Permission: **Sending access** (nicht Full Access)
   - Domain: **All Domains** (wir verifizieren gleich beide)
3. Den Key **JETZT kopieren** — er wird nur einmal angezeigt.
   Format: `re_XXXXXXXXXXXXXXXXXXXXXX`
4. Speicher ihn kurz im Notizblock — gibst ihn mir gleich.

---

## Schritt 2 — brospify.com verifizieren (DU, 5 Min)

1. In Resend: **Domains** → **Add Domain** → `brospify.com` → Region: **EU (Frankfurt)** (DSGVO-konform).
2. Resend zeigt dir **DNS-Records** an (siehst aus wie):
   ```
   TXT   send.brospify.com    "v=spf1 include:amazonses.com ~all"
   TXT   resend._domainkey    "p=MIGfMA0GCSqGSIb3..."  (DKIM, lang)
   MX    send.brospify.com    feedback-smtp.eu-west-1.amazonses.com   (Prio 10)
   TXT   _dmarc.brospify.com  "v=DMARC1; p=none;"
   ```
3. Diese Records gehst du **bei deinem Domain-Registrar** für brospify.com eintragen:
   - **Shopify** (falls Domain dort): Settings → Domains → brospify.com → **DNS Settings** → Add record
   - **GoDaddy / IONOS / Strato** etc.: DNS-Verwaltung der Domain
4. Bei Resend dann **Verify DNS Records** drücken. Bei manchen Records dauert es 2–10 Min bis grün.
5. **Wichtig:** Wenn der DKIM-Record zu lang ist, splitte ihn NICHT manuell — die meisten Registrare nehmen ihn am Stück.

---

## Schritt 3 — brospifyhub.com verifizieren (DU, 5 Min)

Exakt das gleiche wie Schritt 2, nur mit `brospifyhub.com`:

1. Resend → **Domains** → **Add Domain** → `brospifyhub.com` → EU.
2. Die 4 DNS-Records bei deinem Registrar für brospifyhub.com eintragen.
3. **Verify DNS Records** drücken.

Beide Domains müssen am Ende **grün/Verified** sein, sonst lehnt Resend den Versand ab.

---

## Schritt 4 — Vercel-Env-Vars (ICH, sobald du `vercel login` machst)

Sobald Schritt 1–3 fertig sind, mach **EINMAL** in deinem Terminal:

```bash
vercel login
```

→ Browser öffnet sich → Login bestätigen → fertig.

Dann sagst du mir hier im Chat einfach **„login fertig, hier ist der Resend-Key: re_XXX"** — ich erledige:

```bash
vercel env add RESEND_API_KEY production
vercel env add RESEND_API_KEY preview
vercel env add RESEND_API_KEY development

vercel env add RESEND_FROM_EMAIL production
# Value: noreply@brospify.com

vercel env add RESEND_ADMIN_FROM_EMAIL production
# Value: noreply@brospifyhub.com

vercel --prod   # Redeploy mit den neuen Env-Vars
```

---

## Schritt 5 — Verifikation (ICH, 4 Min)

1. Ich öffne `https://brospifyhub.com/admin` → **System-Status** → checke ob alle 3 Resend-Vars grün stehen.
2. Ich öffne `https://brospifyhub.com/admin` → **API-Guthaben** → Resend-Card muss „Konfiguriert" + Guthaben zeigen.
3. Test-Ticket erstellen (via `/email-support` oder Ticket-Modal) → Mail muss bei `brospify.info@gmail.com` ankommen, FROM = `noreply@brospifyhub.com`.
4. Test-Lizenz-Mail: ich kann sie über `/api/admin/test-email` triggern (mache ich, sobald wir am Punkt sind).

---

## Was sich am Code geändert hat

- `src/lib/email.ts`: `sendViaResend()` nimmt jetzt optional einen `from`-Override.
- `sendAdminTicketAlert()` + `sendAdminLowCreditsAlert()` → nutzen `RESEND_ADMIN_FROM_EMAIL` (Fallback: `RESEND_FROM_EMAIL`).
- `sendLicenseEmail()` → nutzt weiter `RESEND_FROM_EMAIL` (= brospify.com).
- `src/app/api/email-support/route.ts` → nutzt jetzt auch den Admin-FROM.
- `system-status` zeigt beide Vars an.
- `.env.example` dokumentiert beide.

→ **Solange `RESEND_ADMIN_FROM_EMAIL` nicht gesetzt ist**, fällt der Code transparent auf `RESEND_FROM_EMAIL` zurück. Du kannst also auch erstmal **nur brospify.com** verifizieren und brospifyhub.com später nachreichen — nichts bricht.

---

## Häufige Fehler

| Symptom | Ursache | Fix |
|---------|---------|-----|
| `RESEND_FROM_EMAIL not configured` | Env-Var nicht in Vercel Production gesetzt | Schritt 4 wiederholen + Redeploy |
| `Domain is not verified` (HTTP 403) | DNS-Records noch nicht propagiert | 10 Min warten, dann nochmal **Verify** drücken |
| Mail kommt nicht an, aber `sent: true` | Spam-Ordner | Nach **„brospify"** im Spam suchen, „Kein Spam" markieren |
| Reply geht ins Leere | `reply_to` fehlt | Ticket-Mail: Kunde hat keine Mail in Session → kein `reply_to`. Normal. |
