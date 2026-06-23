"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

// ─────────────────────────────────────────────────────────────────
// Zweisprachige Oberfläche (Deutsch / Englisch).
//
// `de` ist die Quell-Sprache und definiert die Form (`Translations`).
// `en` MUSS exakt dieselben Keys haben — TypeScript erzwingt das über
// die `: Translations`-Annotation. Neue UI-Strings IMMER in BEIDEN
// Wörterbüchern ergänzen.
//
// Die Sprachwahl wird in localStorage (`hub-lang`) gehalten, damit sie
// schon VOR dem Login (Login-/Onboarding-Seite) verfügbar ist, und
// zusätzlich serverseitig im Profil (`language`) gespeichert, damit sie
// geräteübergreifend erhalten bleibt.
// ─────────────────────────────────────────────────────────────────

export type Locale = "de" | "en";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export const LANG_STORAGE_KEY = "hub-lang";

const de = {
  common: {
    de: "Deutsch",
    en: "English",
    language: "Sprache",
    back: "Zurück",
    next: "Weiter",
    skip: "Überspringen",
    finish: "Los geht's!",
    save: "Speichern",
    cancel: "Abbrechen",
    continue: "Weiter",
    loading: "Lädt…",
    close: "Schließen",
  },
  nav: {
    home: "Home",
    charts: "Produkt-Drop",
    chats: "Community",
    library: "Mediathek",
    seo: "SEO Audit",
    blog: "Blog-Wizard",
    legal: "Rechtstexte",
    themes: "Themes",
    codeBlocks: "Code-Blöcke",
    coaching: "Coaching",
    emails: "Emails",
    profile: "Profil",
    admin: "Admin",
    aiSupport: "AI Support",
    logout: "Abmelden",
  },
  login: {
    title: "Managed Dropshipping Dashboard",
    errorNoEmail: "Keine E-Mail in deinem Google-Konto gefunden.",
    errorNoLicense: "Kein Lizenzschlüssel mit dieser E-Mail verknüpft.",
    errorServer: "Serverfehler. Bitte versuche es erneut.",
    errorInvalidKey: "Bitte gib deinen Lizenzschlüssel ein.",
    errorConnection: "Verbindungsfehler. Bitte versuche es erneut.",
    googleConnecting: "Verbinde…",
    googleButton: "Mit Google anmelden",
    divider: "oder",
    licenseLabel: "Lizenzschlüssel",
    licensePlaceholder: "Lizenzschlüssel eingeben",
    licenseButton: "Einloggen",
    rememberMe: "Angemeldet bleiben",
    footer: "Alle Rechte vorbehalten.",
    signInHeading: "Anmelden",
    signInSub: "Mit Google oder deinem Lizenzschlüssel.",
    intro: "Melde dich an, um zu deinem Dashboard zu gelangen.",
    helpToggle: "Hilfe bei der Anmeldung",
    noAccess: "Noch keinen Zugang?",
    getAccess: "Hol dir Zugang →",
  },
  onboarding: {
    // Schritt 1 — Profil
    welcomeTitle: "Willkommen bei Brospify",
    welcomeSub: "Lass uns dein Konto in 30 Sekunden einrichten.",
    nameLabel: "Wie sollen wir dich nennen?",
    namePlaceholder: "Dein Name",
    nameHint: "Wird in deinem Profil angezeigt.",
    langLabel: "Sprache",
    rememberMe: "Angemeldet bleiben",
    rememberHint: "Du bleibst auf diesem Gerät eingeloggt.",
    step1Cta: "Weiter",
    // Schritt 2 — Google
    googleTitle: "Mit Google verbinden",
    googleSub: "Verbinde dein Google-Konto, damit du dich künftig per Klick anmelden kannst — ganz ohne Lizenzschlüssel.",
    googleButton: "Mit Google anmelden",
    googleSkip: "Überspringen",
    googleConnecting: "Verbinde…",
    stepOf: "von",
  },
  tour: {
    skip: "Tour überspringen",
    next: "Weiter",
    back: "Zurück",
    finish: "Fertig",
    stepOf: "von",
    welcome: "Willkommen in deinem Hub! 👋",
    welcomeDesc: "Ich zeig dir in 30 Sekunden, wo was ist und welches Tool wofür da ist. Tippe auf „Weiter“.",
    heroDrop: "Produkt-Drop",
    heroDropDesc: "Dein wichtigster Button: Ein Klick zieht ein zufälliges Winning-Produkt — mit Marktdaten, Marge, Zielgruppe & Ad-Strategie. 50 Credits pro Zug.",
    toolVideo: "Video Scout",
    toolVideoDesc: "Findet zu deinem Produkt die meistgesehenen echten Videos (TikTok, Reels, Shorts) — nach Views sortiert. Perfekt für deine Ad-Creatives.",
    toolEmail: "AI Email Generator",
    toolEmailDesc: "Erstellt fertige Shopify-E-Mails (Bestellbestätigung, Versand …) per KI — mit Code zum Einfügen.",
    toolStudio: "AI Studio",
    toolStudioDesc: "Macht aus einem einfachen Produktfoto ein professionelles Werbebild — mit Szene, Licht & Hintergrund deiner Wahl.",
    toolBg: "Background Remover",
    toolBgDesc: "Stellt dein Produkt sauber frei (transparenter Hintergrund) — präzise, auch bei Haaren & feinen Kanten.",
    toolUpscale: "Image Upscaler",
    toolUpscaleDesc: "Rechnet unscharfe Bilder auf gestochen scharfe 4×-HD-Auflösung hoch.",
    credits: "Deine Credits",
    creditsDesc: "Jede KI-Aktion kostet Credits. Hier siehst du dein Guthaben live — ein Klick führt zum Aufladen. Du startest mit 1500.",
    account: "Profil & Konto",
    accountDesc: "Über dein Avatar-Menü kommst du zu Profil, Mediathek, Abo, Sprache und Support.",
    finishTitle: "Fertig — los geht's! 🚀",
    finishDesc: "Du kennst jetzt die wichtigsten Bereiche. Mein Tipp: Starte mit einem Produkt-Drop. Viel Erfolg!",
  },
  news: {
    badge: "News",
    video: "Video",
    empty: "Noch keine News.",
  },
  profile: {
    title: "Einstellungen",
    subtitle: "Verwalte dein Profil und deine Shop-Verbindung.",
    saved: "Änderungen gespeichert",
    googleLinked: "Google verknüpft",
    activeSub: "Aktives Abo",
    plan: "Tarif",
    aiCredits: "KI-Credits",
    shop: "Shop",
    active: "Aktiv",
    linkGoogle: "Google-Konto verknüpfen",
    shopifyTitle: "Shopify API",
    shopConnected: "Verbunden",
    shopNotConnected: "Nicht verbunden",
    clientId: "Client-ID",
    clientSecret: "Client Secret",
    shopDomain: "Shop Domain",
    shopDomainHint: "Wird beim Setup automatisch gesetzt.",
    legalTitle: "Rechtsdaten",
    legalDesc: "Deine Firmendaten für automatische Rechtstexte.",
    displayName: "Anzeigename",
    language: "Sprache",
    companyName: "Firmenname",
    owner: "Inhaber",
    street: "Straße",
    zip: "PLZ",
    city: "Stadt",
    country: "Land",
    email: "E-Mail",
    phone: "Telefon",
    vatId: "USt-IdNr.",
    tradeRegister: "Handelsregister",
    save: "Speichern",
    aiUsage: "KI-Nutzung diesen Monat",
    aiRemaining: "übrig",
    aiLimitReached: "Limit erreicht",
  },
};

type Translations = typeof de;

const en: Translations = {
  common: {
    de: "Deutsch",
    en: "English",
    language: "Language",
    back: "Back",
    next: "Next",
    skip: "Skip",
    finish: "Let's go!",
    save: "Save",
    cancel: "Cancel",
    continue: "Continue",
    loading: "Loading…",
    close: "Close",
  },
  nav: {
    home: "Home",
    charts: "Product Drop",
    chats: "Community",
    library: "Library",
    seo: "SEO Audit",
    blog: "Blog Wizard",
    legal: "Legal",
    themes: "Themes",
    codeBlocks: "Code Blocks",
    coaching: "Coaching",
    emails: "Emails",
    profile: "Profile",
    admin: "Admin",
    aiSupport: "AI Support",
    logout: "Log out",
  },
  login: {
    title: "Managed Dropshipping Dashboard",
    errorNoEmail: "No email found in your Google account.",
    errorNoLicense: "No license key is linked to this email.",
    errorServer: "Server error. Please try again.",
    errorInvalidKey: "Please enter your license key.",
    errorConnection: "Connection error. Please try again.",
    googleConnecting: "Connecting…",
    googleButton: "Sign in with Google",
    divider: "or",
    licenseLabel: "License key",
    licensePlaceholder: "Enter license key",
    licenseButton: "Log in",
    rememberMe: "Keep me signed in",
    footer: "All rights reserved.",
    signInHeading: "Sign in",
    signInSub: "With Google or your license key.",
    intro: "Sign in to access your dashboard.",
    helpToggle: "Need help signing in?",
    noAccess: "No access yet?",
    getAccess: "Get access →",
  },
  onboarding: {
    welcomeTitle: "Welcome to Brospify",
    welcomeSub: "Let's set up your account in 30 seconds.",
    nameLabel: "What should we call you?",
    namePlaceholder: "Your name",
    nameHint: "Shown in your profile.",
    langLabel: "Language",
    rememberMe: "Keep me signed in",
    rememberHint: "You'll stay logged in on this device.",
    step1Cta: "Continue",
    googleTitle: "Connect with Google",
    googleSub: "Link your Google account so you can sign in with one click next time — no license key needed.",
    googleButton: "Sign in with Google",
    googleSkip: "Skip",
    googleConnecting: "Connecting…",
    stepOf: "of",
  },
  tour: {
    skip: "Skip tour",
    next: "Next",
    back: "Back",
    finish: "Done",
    stepOf: "of",
    welcome: "Welcome to your Hub! 👋",
    welcomeDesc: "Let me show you in 30 seconds where everything is and what each tool does. Tap “Next”.",
    heroDrop: "Product Drop",
    heroDropDesc: "Your most important button: one click draws a random winning product — with market data, margin, audience & ad strategy. 50 credits per draw.",
    toolVideo: "Video Scout",
    toolVideoDesc: "Finds the most-viewed real videos for your product (TikTok, Reels, Shorts), sorted by views. Perfect for your ad creatives.",
    toolEmail: "AI Email Generator",
    toolEmailDesc: "Generates ready-made Shopify emails (order confirmation, shipping …) with AI — including the code to paste in.",
    toolStudio: "AI Studio",
    toolStudioDesc: "Turns a simple product photo into a professional ad image — with the scene, lighting & background of your choice.",
    toolBg: "Background Remover",
    toolBgDesc: "Cleanly cuts out your product (transparent background) — precise, even with hair & fine edges.",
    toolUpscale: "Image Upscaler",
    toolUpscaleDesc: "Upscales blurry images to crisp 4× HD resolution.",
    credits: "Your Credits",
    creditsDesc: "Every AI action costs credits. See your balance live here — one click to top up. You start with 1500.",
    account: "Profile & Account",
    accountDesc: "Your avatar menu takes you to your profile, library, subscription, language and support.",
    finishTitle: "All set — let's go! 🚀",
    finishDesc: "You now know the key areas. My tip: start with a product drop. Good luck!",
  },
  news: {
    badge: "News",
    video: "Video",
    empty: "No news yet.",
  },
  profile: {
    title: "Settings",
    subtitle: "Manage your profile and shop connection.",
    saved: "Changes saved",
    googleLinked: "Google linked",
    activeSub: "Active subscription",
    plan: "Plan",
    aiCredits: "AI credits",
    shop: "Shop",
    active: "Active",
    linkGoogle: "Link Google account",
    shopifyTitle: "Shopify API",
    shopConnected: "Connected",
    shopNotConnected: "Not connected",
    clientId: "Client ID",
    clientSecret: "Client Secret",
    shopDomain: "Shop domain",
    shopDomainHint: "Set automatically during setup.",
    legalTitle: "Legal data",
    legalDesc: "Your company details for automatic legal texts.",
    displayName: "Display name",
    language: "Language",
    companyName: "Company name",
    owner: "Owner",
    street: "Street",
    zip: "ZIP",
    city: "City",
    country: "Country",
    email: "Email",
    phone: "Phone",
    vatId: "VAT ID",
    tradeRegister: "Trade register",
    save: "Save",
    aiUsage: "AI usage this month",
    aiRemaining: "remaining",
    aiLimitReached: "Limit reached",
  },
};

const DICTS: Record<Locale, Translations> = { de, en };

interface I18nValue {
  t: Translations;
  lang: Locale;
  setLang: (l: Locale) => void;
}

const I18nContext = createContext<I18nValue>({
  t: de,
  lang: "de",
  setLang: () => {},
});

function readStoredLang(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return v === "de" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>("de");

  // Sprachwahl nach dem Mount aus localStorage holen (vermeidet Hydration-
  // Mismatch: Server rendert immer „de", Client gleicht danach ab).
  useEffect(() => {
    const stored = readStoredLang();
    if (stored && stored !== lang) setLangState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Locale) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {}
    try {
      document.documentElement.lang = l;
    } catch {}
  }, []);

  return (
    <I18nContext.Provider value={{ t: DICTS[lang], lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
