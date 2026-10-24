# Konzept: Glyph für Kunden — von A (Anmeldung) bis Abschluss

*Stand 2026-10-03 · verbindliche Grundlage für Bau, Preise und Rechtstexte*

## 0. Grundpfeiler

1. **Kein Abo, kein Guthaben** — gezahlt wird nur, was verbraucht wird.
2. **Nichts wird gespeichert:** Der Inhalt lebt nur im Fenster des Kunden. Nach Abschluss ist alles gelöscht.
3. **Eine Sitzung = ein Arbeitstag** (8 Stunden), Pausen egal.
4. **Zwei Köpfe zur Auswahl:** API (Arbeit, mit Fundstellen) und 27B „Frecher Bonsai" (Spaß).
5. **Ein Satz für alles:** 2,00 € je 512k Token (≈ 3,91 € je 1 Mio. Token).

---

## A — Anmeldung

- Login mit **Kreditkarte / Apple Pay / Google Pay** (über einen Zahlungsanbieter, z. B. Stripe).
  Kein Konto, kein Passwort — der Zahlungsdienst ist die Identität.
- Beim Start: **kleine Autorisierung 0,50 €** — hält die Karte warm, kostet nichts und wird bei
  0 Verbrauch freigegeben.
- Die Sitzung gilt **8 Stunden ab Anmeldung**. Untätigkeit beendet sie nie (kein 30-Minuten-Müll).
- Im Fenster sichtbar: der **Zähler** (siehe D) und der Slot-Schalter **27B ⇄ API**.

## B — Beginn im Fenster

- Leerbild: „Womit kann ich helfen?" · „Screenshot **einfügen** · Datei **ziehen**".
- Schnellstart-Knöpfe mit **festen Texten** (keine Modell-Zufälle):
  **Was ist Glyph?** · **So arbeitest du** · **Befehle** · **Im Vault suchen** (setzt den Such-Modus).
- Quellen erscheinen als **Knöpfe** (WEB/PDF/MD) und öffnen das Seitenfenster. Gesperrte Webseiten
  kommen als Textansicht, „Browser" öffnet das Original.

## C — Chatten (die zwei Slots)

| Slot | Charakter | Kontextfenster | Leiste bis |
|---|---|---|---|
| **API** | Arbeit: Fragen zu AS/UWS/QM/BS, Suche in den angeschlossenen Wissenssammlungen **mit Fundstelle**, Berichte und Texte schreiben | 256k–1M (meist 1M) | 4,00 € (bei 1M) |
| **27B Frecher Bonsai** | Spaß: leichtes Gespräch, kurz und schnackelig | 128–256k (kurz!) | 0,50–1,00 € |

- **Jeder Wechsel erzeugt einen kurzen Begrüßungstext** (siehe Textbausteine): Der Kunde sieht den
  Wechsel — und es entsteht sofort Verbrauch, damit der Mindestsatz greift. Auch das Spaßmodell
  verdient also grundsätzlich etwas.
- Nach dem Rückwechsel läuft die gewohnte Verbrauchsabrechnung weiter.
- Dateien ziehen, Screenshots einfügen — alles geht ins Gespräch.

## D — Durchblick: der Zähler

Wachsende Leiste (gelb) mit **grauer Grenze beim Mindestbetrag**:

```
  0      0,50 €     1,00 €     2,00 €     4,00 €
  0k      128k       256k       512k       1024k
  |————— gelb wächst —————|———————— weiterwachsend ——————→
            ▲ graue Grenze = Mindestbetrag
```

- zeigt **Verbrauch in Token und Euro gleichzeitig**
- skaliert auf das Fenster des aktiven Slots (27B klein, API 1M)
- die Anzeige **hält nie an** — sie informiert nur

## E — Euro: die Abrechnung

| Situation | Rechnung |
|---|---|
| 0 Token verbraucht | **0,00 €** (Autorisierung wird ohne Einzug freigegeben) |
| Verbrauch unter 0,50 € | **0,50 € Mindestbetrag** (einmal je Sitzung — nicht je Wechsel) |
| darüber | tatsächlicher Verbrauch: **2,00 € je 512k Token** |
| Fensterende (1M) | höchstens **4,00 €** je Halt |

Orientierung: 128k ≈ 0,50 € · 256k ≈ 1,00 € · 512k ≈ 2,00 € · 1024k ≈ 4,00 €.
Zahlungsgebühren (~1,5 % + 0,25 €) sind im Preis enthalten — ein Aufschlag nach Zahlungsart ist unzulässig.

## F — Verlängerungshinweis (der Kreis)

- Alle **2,00 € Verbrauch** erscheint ein kurzer **Verlängerungshinweis** mit zwei Knöpfen:
  **„Weiter — 2 €"** (neue Stufe, ungestört weiter) und **„Zusammenfassen"** (Abschluss oder
  in eine neue Aufgabe für 2 € — die .md wird deren Anfang).
- Die Sitzung ist ein **geschlossener Kreis**: Arbeiten → Hinweis → Weiter → Arbeiten …
- **Nie mehr als 2,00 € ohne Klick.** Ob die Sitzung bei 2 € oder mehr endet, entscheidet der Kunde.


## M — Mitnehmen: die Sitzungs-Zusammenfassung

- **Jederzeit** per Knopf/Befehl **„Sitzung zusammenfassen"** — oder **automatisch beim Abschluss**.
- Anzeige im **Seitenfenster als .md** (wie erstellte Dateien, z. B. Betriebsanweisung):
  **Was hast du gemacht** (Aufgaben, Fundstellen, erstellte Texte) + **die wichtigsten Punkte**.
- **Download möglich** (freiwillig — wie beim Ticket).
- Warnhinweis darin/darunter:

  > Wenn du daran weiterarbeiten möchtest: lade diese Zusammenfassung herunter und füge sie in
  > deiner nächsten Sitzung wieder ein (Datei einfach hierher ziehen).
  >
  > **Bitte denke dran: Nach dem Abschluss ist deine Arbeit unwiderruflich gelöscht.**

## Z — Abschluss (Ende der Sitzung)

Genau drei Gründe beenden die Sitzung endgültig: **Fenster/Tab schließen** · **8 Stunden** · **Kontextgrenze erreicht (meist 1 Mio. Token)**.
Dann in dieser Reihenfolge:

1. **Abrechnung** des tatsächlichen Verbrauchs (0 € / 0,50 € / Verbrauch) — Teileinzug der Autorisierung(en).
2. **Ticket** (Kleinbetragsbeleg): „327k Token · 1,26 € · Karte" — der Kunde speichert es oder nicht.
3. **Zusammenfassung** (.md) ins Seitenfenster mit Warnhinweis — Download möglich.
4. **Löschen:** Gespräch, Zwischenstände, Fenster-Inhalt — alles weg. Der Beleg bleibt allein bei uns.

---

## Recht & Belege (die 10 Jahre)

- Jeder Verkauf erzeugt einen **Kleinbetragsbeleg** (bis 250 € zulässig, minimale Pflichtangaben).
- **Beleg-Ablage automatisch:** je Verkauf eine Datei + Zeile in `belege.csv` — das ist die
  10-Jahre-Aufbewahrung (GoBD), ganz ohne Handarbeit. Für den Steuerberater genügt ein Export.
- **19 % USt** sind in allen Preisen enthalten (wie vereinbart; bei Kleinunternehmerregelung
  nach §19 bliebe der Anteil zusätzlich).
- Datenschutz: Inhalte werden **nie** gespeichert; die Zahlungsanbieter sehen nur Betrag und Zahlungsmittel.

## Preistext für den Kunden (Kurzfassung)

> Kein Abo. Die Sitzung startet mit einer 0,50-€-Reservierung (kostet nichts). Abgerechnet wird nur,
> was du verbrauchst — mindestens 0,50 €, wenn du etwas gefragt hast; bei 0 Fragen 0 €. Ein volles
> Fenster (1 Mio. Token) kostet höchstens 4,00 € und fragt dann nach. Schließen = alles gelöscht —
> nimm deine Zusammenfassung mit, wenn du weiterarbeiten möchtest.

## Technik-Kette (Bausteine des Baus)

1. **Zahlung:** Autorisierung + Teileinzug (Stripe o. ä.) für Karte, Apple Pay, Google Pay.
2. **Zähler:** Token × Preis, live; wachsende Leiste mit grauer 0,50-€-Grenze; Fenstermaß je Slot.
3. **Kontext-Wächter:** 80 % → .md-Zusammenfassung → weiterarbeiten.
4. **Fenster-Halt** mit „Weitermachen?" (aktive Zahlung je Fenster).
5. **Wechsel-Texte** bei 27B ⇄ API (Begrüßung des jeweiligen Kopfes).
6. **Abschluss:** Abrechnung → Ticket → .md ins Seitenfenster (Warnhinweis) → Löschung.
7. **Beleg-Ablage:** `belege/` + `belege.csv` (10 Jahre, automatisch).
8. **Schutz:** serverseitige Freigabe je Kunde, Namens-Maske, keine Inhalts-Speicherung.

## Offene Punkte (klein)

- Zahlungsanbieter festlegen (Vorschlag: Stripe als Anker für Karte + Apple Pay + Google Pay).
- Mindestbetrag (0,50 € vorgesehen) und Fenster-Preis bestätigen.
- 27B: Kontextfenster später auf 32–64k anheben? (Aktuell 16k — für den Spaß-Slot ausreichend.)
- Rechtstexte (Impressum, AGB, Datenschutz): eure Vorlage, meine Anbindung.
