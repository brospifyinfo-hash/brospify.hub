// ─── Beispiel-Bewertungen ────────────────────────────────────────
// Platzhalter, um die Bewertungsseite im Aufbau zu sehen — nicht mehr.
//
// Jeder Eintrag trägt `isExample: true`. Daran hängt einiges:
//   • Auf der Website steht ein deutlich sichtbarer Hinweis, solange
//     Beispiele angezeigt werden, und jede Karte trägt ein Etikett.
//   • Die Bewertungs-Auszeichnung für Google (AggregateRating) wird
//     NICHT erzeugt, solange Beispiele dabei sind — eine erfundene
//     Durchschnittsnote im Suchergebnis wäre eine Falschangabe.
//   • Im Dashboard gibt es einen Knopf, der alle Beispiele auf einmal
//     löscht.
//
// So lässt sich die Seite gefüllt anschauen, ohne dass jemand die Texte
// für echte Kundenstimmen halten kann.

export interface ExampleReview {
  name: string;
  rating: number;
  text: string;
  /** Wie viele Tage vor heute — damit die Daten nie veralten. */
  daysAgo: number;
  source?: string;
}

export const EXAMPLE_REVIEWS: ExampleReview[] = [
  {
    name: "Lena K.",
    rating: 5,
    daysAgo: 18,
    source: "Google",
    text: "Ich war vorher bei zwei anderen Studios zur Beratung und hier war es das erste Mal so, dass jemand ehrlich gesagt hat, was an meiner Idee nicht funktioniert. Der Entwurf war danach besser als das, was ich mitgebracht hatte. Sitzung war ruhig, saubere Arbeit.",
  },
  {
    name: "Tobias M.",
    rating: 5,
    daysAgo: 34,
    source: "Google",
    text: "Erstes Tattoo mit 41. Die Beratung hat mir die Nervosität komplett genommen — es wurde nichts schöngeredet, auch nicht beim Preis. Der Unterarm ist top verheilt.",
  },
  {
    name: "Sandra P.",
    rating: 5,
    daysAgo: 52,
    text: "Cover-Up von einem alten Motiv, das ich seit Jahren versteckt habe. Ich hätte nicht gedacht, dass da noch was geht. Zwei Sitzungen, und jetzt trage ich wieder kurze Ärmel.",
  },
  {
    name: "Michael R.",
    rating: 4,
    daysAgo: 71,
    source: "Google",
    text: "Handwerklich richtig gut, die Linien sitzen sauber. Ein Stern Abzug nur, weil die Terminfindung etwas gedauert hat — dafür nimmt er sich dann aber auch wirklich Zeit.",
  },
  {
    name: "Jasmin B.",
    rating: 5,
    daysAgo: 96,
    text: "Feine Linien an der Rippe, also die unangenehmste Stelle überhaupt. Es wurde so oft Pause gemacht, wie ich gebraucht habe, ohne dass es genervt hat. Genau so stelle ich mir das vor.",
  },
];
