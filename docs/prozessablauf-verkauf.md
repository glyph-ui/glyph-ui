# Prozessablauf „Kunden-Sitzung" (Verkauf)

*Grundlage: [konzept-verkauf-a-bis-z.md](konzept-verkauf-a-bis-z.md) · Stand 2026-10-03*

## 1. Zweck

Regelt den vollständigen Ablauf einer bezahlten Glyph-Sitzung – von der Anmeldung bis zur
Beendigung – inklusive Abrechnung, Beleg und Löschung.

## 2. Geltungsbereich

Öffentliche Web-Fläche (glyph-ui.com) für zahlende Kunden. Gilt für beide Köpfe
(**API** = Arbeit, **27B „Frecher Bonsai"** = Spaß). Nicht betroffen: der eigene Schreibtisch-Betrieb.

## 3. Verantwortlichkeiten

| Rolle | Verantwortung |
|---|---|
| **Kunde** | Sitzung beginnen/enden, Fragen stellen, „Weitermachen?" bestätigen, Zusammenfassung/Ticket mitnehmen |
| **System** | Zähler, Fenster-Wächter, Abrechnung, Ticket, Zusammenfassung, Löschung, Beleg-Ablage |
| **Betreiber** | Zahlungskonto führen, Beleg-Ablage aufbewahren, Preise pflegen, Support leisten — **ohne Einsicht in Inhalte** |

## 4. Auslöser

Start der Sitzung durch den Kunden (Anmeldung mit Zahlungsmittel).

## 5. Ablauf

| # | Schritt | ausführend | Regel | Aufzeichnung |
|---|---|---|---|---|
| 1 | **Anmeldung** mit Kreditkarte / Apple Pay / Google Pay | Kunde + System | kein Konto, kein Passwort | — |
| 2 | **Autorisierung 0,50 €** (Reservierung, kostenlos) | System | sichert die spätere Zahlung | Zahlungsbeleg des Anbieters |
| 3 | **Sitzung startet**: 8 Stunden, Pausen egal | System | kein Abmelden bei Untätigkeit | — |
| 4 | **Slot wählen** (27B ⇄ API); jeder Wechsel erzeugt einen kurzen Begrüßungstext | Kunde + System | Wechsel-Text = Verbrauch → Mindestsatz greift | — |
| 5 | **Arbeiten**: Chatten, suchen, schreiben; Zähler zeigt Verbrauch (Token + Euro) | Kunde | Quellen als Knöpfe, Fundstellen mit Beleg | — |
| 6 | **2,00 € erreicht** → kurzes **Pop-up mit zwei Knöpfen** | System | **nie mehr als 2,00 € ohne Klick** | — |
| 7 | Knopf **„Weiter — 2 €"** → neue Stufe, ungestört weiterarbeiten | Kunde | Zahlungsbeleg | — |
| 8 | Knopf **„Zusammenfassen"** → entweder **Abschluss** oder **in neue Aufgabe (2 €)**: die .md wird zum Anfang der neuen Aufgabe | Kunde | Überblick bleibt erhalten | — |
| 9 | **Ende (endgültig)**: Fenster/Tab zu · **8 Stunden** · **Kontextgrenze erreicht (meist 1 Mio. Token)** | Kunde/System | genau diese drei Gründe | — |
| 10 | **Abrechnung**: 0 € bei 0 Token · sonst mind. 0,50 € · sonst Verbrauch (2,00 € je 512k) | System | Mindestsatz **einmal je Sitzung** | **Ticket** |
| 11 | **Ticket** (Kleinbetragsbeleg) + automatische **Beleg-Ablage** | System | 10 Jahre aufzubewahren (GoBD) | `belege/` + `belege.csv` |
| 12 | **Zusammenfassung** (.md) ins Seitenfenster mit Warnhinweis, Download möglich | System | Kunde kann mitnehmen, sonst Verlust | nur bei Kunde |
| 13 | **Löschen**: Gespräch, Zwischenstände, Fensterinhalt | System | unwiderruflich; gespeichert bleibt nur der Beleg | — |

## 6. Abrechnungsregeln

| Situation | Betrag |
|---|---|
| 0 Token verbraucht | 0,00 € (Autorisierung ohne Einzug freigegeben) |
| Verbrauch vorhanden, unter 0,50 € | 0,50 € (Mindestbetrag) |
| darüber | Verbrauch × 2,00 €/512k Token (≈ 3,91 €/1 Mio.) |
| Fensterende (1M Token) | höchstens 4,00 € je Halt |

19 % USt sind enthalten. Zahlungsgebühren sind im Preis enthalten (kein Aufschlag nach Zahlungsart).

## 7. Ausnahmen und Sonderfälle

| Fall | Handhabung |
|---|---|
| Zahlung wird abgelehnt | Sitzung startet nicht; kurze Meldung, erneuter Versuch |
| „Weitermachen?" ohne Zahlung / abgebrochen | Sitzung endet geordnet (Schritt 9–13) |
| 0 Token bei Sitzungsende | 0,00 € — kein Ticket-Betrag, Autorisierung wird freigegeben |
| Doppelpreisung behauptet | Beleg in `belege.csv` gegenprüfen; Erstattung über den Zahlungsanbieter, Beleg mit Vermerk „erstattet" |
| Modell/Ausfall im Fenster | Sitzung bleibt offen; der Zähler zählt nur tatsächlichen Verbrauch |
| Absturz des Kunden-Rechners | Sitzung endet durch die 8-Stunden-Grenze; Inhalt war nur im Fenster → **verloren** (Hinweis ist Teil des Warnhinweises) |

## 8. Aufzeichnungen und Aufbewahrung

| Aufzeichnung | Ort | Aufbewahrung |
|---|---|---|
| Ticket/Beleg je Verkauf | `belege/JJJJ-MM/` + `belege.csv` | **10 Jahre** (automatisch) |
| Gesprächs-/Sitzungsinhalte | — | **keine** (werden gelöscht) |
| Zusammenfassung (.md) | nur beim Kunden (Download) | — |

## 9. Verwandte Unterlagen

- [ablaufdiagramm-verkauf.svg](ablaufdiagramm-verkauf.svg) — Ablaufdiagramm (druckfähig)
- [arbeitsanweisung-verkauf.md](arbeitsanweisung-verkauf.md) — Arbeitsanweisung für den Betrieb
- [konzept-verkauf-a-bis-z.md](konzept-verkauf-a-bis-z.md) — Konzept mit Preisen und Texten
