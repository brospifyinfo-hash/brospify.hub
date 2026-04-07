"use client";

import { createContext, useContext, ReactNode } from "react";

const de = {
  nav: {
    home: "Home",
    charts: "Winning Charts",
    chats: "Community",
    seo: "SEO Audit",
    blog: "Blog-Wizard",
    legal: "Rechtstexte",
    themes: "Themes",
    profile: "Profil",
    admin: "Admin",
    logout: "Abmelden",
  },
  login: {
    title: "Managed Dropshipping Dashboard",
    errorNoEmail: "Keine E-Mail in deinem Google-Konto gefunden.",
    errorNoLicense: "Kein Lizenzschlüssel mit dieser E-Mail verknüpft.",
    errorServer: "Serverfehler. Bitte versuche es erneut.",
    errorInvalidKey: "Bitte gib deinen Lizenzschlüssel ein.",
    errorConnection: "Verbindungsfehler. Bitte versuche es erneut.",
    googleConnecting: "Verbinde...",
    googleButton: "Mit Google anmelden",
    divider: "oder",
    licenseLabel: "Lizenzschlüssel",
    licensePlaceholder: "Dein 32-stelliger Schlüssel",
    licenseButton: "Einloggen",
    footer: "\u00A9 2025 BrospifyHub. Alle Rechte vorbehalten.",
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
  tour: {
    welcome: "Willkommen bei BrospifyHub!",
    welcomeDesc: "Dein Managed Dropshipping Dashboard. Lass uns einen kurzen Rundgang machen.",
    stepNav: "Navigation",
    stepNavDesc: "Hier findest du alle wichtigen Bereiche deines Dashboards.",
    stepCharts: "Winning Charts",
    stepChartsDesc: "Entdecke die besten Dropshipping-Produkte mit Analysen & 1-Klick Import.",
    stepThemes: "Themes",
    stepThemesDesc: "Lade das optimierte Shopify-Theme herunter oder pushe es direkt.",
    stepProfile: "Profil",
    stepProfileDesc: "Verwalte dein Profil, Shopify-Verbindung und Firmendaten.",
    stepOf: "von",
    skip: "Überspringen",
    next: "Weiter",
    finish: "Los geht's!",
  },
};

type Translations = typeof de;

const I18nContext = createContext<Translations>(de);

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={de}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const t = useContext(I18nContext);
  return { t };
}
