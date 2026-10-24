# Arbeitsanweisung: Betrieb des Verkaufssystems „Glyph für Kunden"

*Grundlage: [konzept-verkauf-a-bis-z.md](konzept-verkauf-a-bis-z.md) · [prozessablauf-verkauf.md](prozessablauf-verkauf.md) · Stand 2026-10-03*

## 1. Zweck

Sichert den störungsfreien und rechtssicheren Betrieb des bezahlten Kundenzugangs sowie die
vorschriftsmäßige Belegführung.

## 2. Geltungsbereich und Verantwortung

Gilt für den **Betreiber** (Verkaufsabrechnung, Support, Pflege). Der Kunde braucht keine Anleitung —
die Oberfläche führt ihn selbst.
**Verantwortlich:** Betreiber · **Vertretung:** benannte Vertrauensperson

## 3. Voraussetzungen

| Was | Wo |
|---|---|
| Zahlungskonto (Karte/Apple/Google über Anbieter) | Anbieter-Konto, Auszahlung eingerichtet |
| Freigaberegeln für Kundensuche | `~/.glyph-ui/web-scope.json` |
| Beleg-Ablage | `~/.glyph-ui/belege/` + `belege.csv` |
| Preise hinterlegt | Konzept-Blatt, Abschnitt E |

## 4. Regelmäßige Tätigkeiten

| Rhythmus | Tätigkeit |
|---|---|
| **Bei Bedarf** | Preise/Schwellen pflegen (nur mit Änderungseintrag im Konzept-Blatt) |
| **Monatlich** | `belege.csv` gegen Zahlungsanbieter-Abrechnung abgleichen (3 Minuten) |
| **Quartalsweise** | Auszug `belege.csv` an den Steuerberater |
| **Jährlich** | Belegordner archivieren (bleibt gespeichert: 10 Jahre) |

## 5. Arbeitsschritte

### 5.1 Support-Anfrage eines Kunden
1. Anfrage annehmen — **nach Zahlungsbeleg/Ticket fragen** (Datum, Betrag, Token).
2. Betrag in `belege.csv` gegenprüfen.
3. Sachverhalt klären **ohne Inhalte einzusehen** (sie sind gelöscht — es gibt nichts zu sehen).
4. Bei Abweichung: Erstattung über den Zahlungsanbieter, Beleg-Zeile mit „erstattet" vermerken.

### 5.2 Erstattung
1. Nur mit Ticket-Nummer erstatten.
2. Vollständig oder teilweise über den Zahlungsanbieter (Gebühren des Anbieters bleiben).
3. Beleg in `belege.csv` vermerken: `erstattet am JJJJ-MM-TT, Grund`.

### 5.3 Preise ändern
1. Neue Zahlen im [Konzept-Blatt](konzept-verkauf-a-bis-z.md) eintragen (Abschnitt E + Preistext).
2. Kurze Notiz: Datum, alter Wert, neuer Wert, Grund.
3. Anzeige/Abrechnung wirken mit der nächsten Sitzung.

## 6. Was niemals getan wird

- ❌ **Nie in Sitzungsinhalte schauen oder sie wiederherstellen** — sie existieren nicht mehr, das
  ist das Versprechen an den Kunden (und der Datenschutz-Punkt).
- ❌ Nie ohne Beleg erstatten.
- ❌ Nie Preise ohne Änderungseintrag ändern.

## 7. Störungen

| Störung | Handhabung |
|---|---|
| Kunde: „wurde doppelt bezahlt" | `belege.csv` prüfen → Erstattung über Anbieter (5.2) |
| Zahlung wird dauerhaft abgelehnt | Anbieter-Konto/Status prüfen; Kunde mit anderem Zahlungsmittel versuchen lassen |
| Beleg-Ablage schreibt nicht | `belege.csv` prüfen/Rechte; Tickets des Tages aus dem Anbieter-Konto nachtragen |
| Kundenkonto gesperrt/Chargeback | Anbieter-Ablauf folgen; Betrag in `belege.csv` vermerken |

## 8. Aufzeichnungen

| Aufzeichnung | Ort | Dauer |
|---|---|---|
| Beleg je Verkauf (Ticket) | `belege/JJJJ-MM/` | **10 Jahre** |
| Belegliste | `belege.csv` | **10 Jahre** |
| Änderungen an Preisen | Eintrag im Konzept-Blatt | dauerhaft |
| Sitzungsinhalte | — | **keine** |

## 9. Rechtliche Hinweise

- **Kleinbetragsbeleg** (bis 250 €) genügt; Pflichtangaben: Aussteller, Datum, Betrag (mit 19 % USt),
  Leistungskurzbeschreibung.
- **10 Jahre Aufbewahrung** (§147 AO / GoBD) — erfüllt durch die automatische Beleg-Ablage.
- Preise sind Endverbraucherpreise inkl. 19 % USt (Alternative: Kleinunternehmerregelung §19).

## 10. Revisionsstand

| Stand | Änderung | Autor |
|---|---|---|
| 2026-10-03 | Erstfassung zum Konzept „Glyph für Kunden" (A–Z) | A. Hubert |
