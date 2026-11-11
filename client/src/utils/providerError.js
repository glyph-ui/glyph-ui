/**
 * Provider-Fehler lesbar machen.
 *
 * OpenRouter & Co. liefern bei 429/404 ein JSON im Fehlertext. Im Chat landete
 * das bisher als ein einziger „Fehler: HTTP … {…}“-Block. Hier wird daraus
 * eine kurze Ursache + Handlung; der Rohtext bleibt als aufklappbares Detail.
 *
 * Reine Anzeige — die gespeicherte Antwort bleibt unverändert.
 */

const HTTP_RE = /\bHTTP\s+(\d{3})\b/i;
const PRIVACY_URL = "https://openrouter.ai/settings/privacy";

/**
 * @param {string} raw
 * @returns {null | {
 *   kind: string,
 *   status: number,
 *   title: string,
 *   message: string,
 *   hint: string,
 *   link: string,
 *   linkLabel: string,
 *   model: string,
 *   details: string,
 * }}
 */
export function parseProviderError(raw) {
  const text = String(raw ?? "").trim();
  const http = HTTP_RE.exec(text);
  if (!text || !http) return null;
  // Nur echte Anbieter-/Proxy-Fehler, nicht beliebiger Text mit „HTTP 500“.
  if (
    !/von Modell|openrouter|rate.?limit|endpoints out of|guardrail|data policy|\{"error"/i.test(
      text,
    )
  ) {
    return null;
  }

  const status = Number(http[1]);
  const model =
    (text.match(/von Modell ['"]([^'"]+)['"]/i) || [])[1] ||
    (text.match(/"model"\s*:\s*"([^"]+)"/i) || [])[1] ||
    "";

  let payload = null;
  const brace = text.indexOf("{");
  if (brace >= 0) {
    try {
      payload = JSON.parse(text.slice(brace));
    } catch {
      payload = null;
    }
  }
  const inner =
    payload?.error && typeof payload.error === "object" ? payload.error : {};
  const meta =
    inner.metadata && typeof inner.metadata === "object" ? inner.metadata : {};
  const code = Number(inner.code) || status;
  const upstream = String(inner.message || "")
    .replace(/\s+/g, " ")
    .trim();
  // Der Rohtext zählt mit: die Engine kappt lange Provider-Fehler, dann ist
  // das JSON unvollständig und lässt sich nicht parsen. Ohne den Roh-Fallback
  // wäre ein Datenschutz-404 fälschlich "Modell nicht gefunden".
  const haystack = `${upstream} ${text}`;
  const policy =
    code === 404 &&
    ((Array.isArray(meta.ineligibility_reasons) &&
      meta.ineligibility_reasons.length > 0) ||
      /endpoints out of|guardrail|free model training|zdr violation|data policy|privacy/i.test(
        haystack,
      ));
  const invalidId =
    code === 400 && /not a valid model id|invalid model|unknown model/i.test(haystack);
  const noEndpoints =
    code === 404 && /no endpoints found for/i.test(haystack);

  const base = {
    status: code,
    model,
    details: text,
    link: "",
    linkLabel: "",
  };

  if (code === 429) {
    return {
      ...base,
      kind: "busy",
      title: "Modell gerade ausgelastet",
      message:
        "Der Anbieter nimmt im Gratis-Pool gerade keine weiteren Anfragen an. Bitte kurz warten und erneut senden.",
      hint: "Wenn das häufiger passiert: ein anderes Modell in Buch → Anbindung wählen.",
    };
  }

  if (policy) {
    return {
      ...base,
      kind: "policy",
      title: "Modell für dein Konto nicht freigegeben",
      message:
        "OpenRouter hat alle Anbieter dieses Modells ausgeschlossen, weil deine Datenschutz-Einstellungen strenger sind als deren Richtlinien.",
      hint: "Gratis-Modelle erlauben meist weder Zero Data Retention noch ein Verbot von Modell-Training.",
      link: PRIVACY_URL,
      linkLabel: "Datenschutz-Einstellungen öffnen",
    };
  }

  if (
    (code === 404 || code === 400) &&
    /support image|image input|image modality|vision|modality/i.test(upstream)
  ) {
    return {
      ...base,
      kind: "vision",
      title: "Modell kann keine Bilder lesen",
      message:
        "Das gewählte Modell verarbeitet nur Text. Der Screenshot wurde deshalb nicht an das Modell geschickt.",
      hint: "Für Bilder ein Vision-Modell wählen, z. B. nvidia/nemotron-3.5-super-vl:free (Buch → Anbindung).",
    };
  }

  if (code === 401 || code === 403) {
    return {
      ...base,
      kind: "auth",
      title: "Zugang abgelehnt",
      message:
        "Der API-Key ist ungültig oder hat keine Freigabe für dieses Modell.",
      hint: "Key und Modell in Buch → Anbindung prüfen.",
    };
  }

  if (code === 402) {
    return {
      ...base,
      kind: "balance",
      title: "Guthaben aufgebraucht",
      message:
        "Für dieses Modell ist beim Anbieter kein Guthaben mehr hinterlegt.",
      hint: "Guthaben prüfen oder ein Gratis-Modell wählen.",
    };
  }

  if (code >= 500) {
    return {
      ...base,
      kind: "upstream",
      title: "Anbieter gestört",
      message:
        "Der Modell-Anbieter meldet einen Serverfehler. Meist hilft ein neuer Versuch in ein paar Sekunden.",
      hint: "",
    };
  }

  if (invalidId) {
    return {
      ...base,
      kind: "invalid",
      title: "Modell-ID ungültig",
      message: model
        ? `„${model}“ existiert beim Anbieter nicht mehr (umbenannt oder entfernt).`
        : "Die Modell-ID ist beim Anbieter unbekannt.",
      hint: "In Buch → Anbindung ein anderes Modell wählen.",
    };
  }

  if (noEndpoints) {
    return {
      ...base,
      kind: "missing",
      title: "Kein Anbieter für dieses Modell",
      message: model
        ? `Für „${model}“ ist gerade kein Anbieter erreichbar.`
        : "Für dieses Modell ist gerade kein Anbieter erreichbar.",
      hint: "Kurz warten oder in Buch → Anbindung ein anderes Modell wählen.",
    };
  }

  if (code === 404) {
    return {
      ...base,
      kind: "missing",
      title: "Modell nicht gefunden",
      message: model
        ? `Der Anbieter kennt das Modell „${model}“ nicht (mehr).`
        : "Das gewählte Modell ist beim Anbieter nicht verfügbar.",
      hint: "In Buch → Anbindung ein anderes Modell wählen.",
    };
  }

  return {
    ...base,
    kind: "http",
    title: `Anfrage fehlgeschlagen (HTTP ${code})`,
    message: upstream
      ? upstream.slice(0, 240)
      : "Der Anbieter hat die Anfrage abgelehnt.",
    hint: "",
  };
}

/**
 * Einzeilige Fassung für das Banner. Nicht-Anbieter-Fehler bleiben unverändert.
 * @param {string} raw
 */
export function providerErrorSummary(raw) {
  const info = parseProviderError(raw);
  if (!info) return String(raw || "");
  return `${info.title} — ${info.message}`;
}
