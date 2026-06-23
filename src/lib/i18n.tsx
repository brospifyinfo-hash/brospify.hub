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
    finish: "Los geht's!",
    stepOf: "von",
    welcome: "Willkommen in deinem Hub!",
    welcomeDesc: "Hier verwaltest du dein komplettes Dropshipping-Business. Ein kurzer Rundgang durch die wichtigsten Bereiche.",
    drop: "Produkt-Drop",
    dropDesc: "Zieh per Zufalls-Generator dein nächstes Winning-Produkt — mit echten Marktdaten, Margen-Analyse und Ad-Strategie.",
    tools: "KI-Tools",
    toolsDesc: "AI Studio für Produktfotos, Background Remover, Image Upscaler, Video Scout und der AI E-Mail-Generator — alles an einem Ort.",
    library: "Mediathek",
    libraryDesc: "Alle generierten Bilder und E-Mails werden hier automatisch gespeichert — auch wenn du den Tab schließt.",
    community: "Community",
    communityDesc: "Tausch dich mit anderen Brospify-Mitgliedern aus, stell Fragen und teile deine Erfolge.",
    credits: "Credits",
    creditsDesc: "Jede KI-Aktion kostet Credits. Du startest mit 1500 und bekommst alle 28 Tage 1000 dazu.",
    support: "Support",
    supportDesc: "Unser KI-Support-Bot „Brospi“ hilft dir rund um die Uhr. Kommst du nicht weiter, meldest du dein Problem direkt.",
    profile: "Profil",
    profileDesc: "Verwalte deinen Namen, deine Sprache, dein Abo und deine Firmendaten.",
    finishTitle: "Fertig!",
    finishDesc: "Du kennst jetzt die wichtigsten Bereiche. Viel Erfolg mit deinem Store!",
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
    finish: "Let's go!",
    stepOf: "of",
    welcome: "Welcome to your Hub!",
    welcomeDesc: "This is where you run your entire dropshipping business. Here's a quick tour of the key areas.",
    drop: "Product Drop",
    dropDesc: "Draw your next winning product with the random generator — with real market data, margin analysis and ad strategy.",
    tools: "AI Tools",
    toolsDesc: "AI Studio for product photos, Background Remover, Image Upscaler, Video Scout and the AI email generator — all in one place.",
    library: "Library",
    libraryDesc: "Every generated image and email is saved here automatically — even if you close the tab.",
    community: "Community",
    communityDesc: "Connect with other Brospify members, ask questions and share your wins.",
    credits: "Credits",
    creditsDesc: "Every AI action costs credits. You start with 1500 and get 1000 more every 28 days.",
    support: "Support",
    supportDesc: "Our AI support bot \"Brospi\" helps you around the clock. If you're stuck, you can report your issue directly.",
    profile: "Profile",
    profileDesc: "Manage your name, language, subscription and company details.",
    finishTitle: "All set!",
    finishDesc: "You now know the key areas. Good luck with your store!",
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
