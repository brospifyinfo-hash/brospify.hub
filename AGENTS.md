<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Der KI-Support-Bot lernt IMMER mit (Pflicht)

`src/lib/app-knowledge.ts` (`APP_KNOWLEDGE`) ist die Single Source of Truth für den KI-Support-Bot (`/api/ai-chat`). Der Bot darf NUR aus diesem Wissen antworten.

**Regel:** Jede Änderung am Hub, die für Nutzer sichtbar ist, MUSS im selben Change auch in `app-knowledge.ts` nachgezogen werden — der Bot muss jeden aktuellen Detail-Stand kennen. Das gilt für:
- neue / entfernte / umbenannte Tools oder Seiten (inkl. geänderter Pfade/Routen),
- geänderte Credit-Kosten (immer synchron mit `src/lib/credit-costs.ts` halten),
- geändertes Credit-Modell, Abo/Preise, Umfragen-Belohnungen,
- geänderte Flows (z. B. Hintergrund-Generierung, Auto-Speichern in die Mediathek),
- alles, was ein Kunde fragen könnte ("wo ist X", "wie geht Y", "was kostet Z", "warum passiert W").

Wer ein Feature anfasst, ohne das Bot-Wissen anzupassen, hinterlässt einen Bug: der Bot gibt dann veraltete/falsche Auskunft. Also: Feature ändern → `app-knowledge.ts` im gleichen Commit aktualisieren. Im Zweifel lieber zu detailliert dokumentieren.
