/**
 * Model-Felder für Graph / Anbindung.
 * Slash in der ID = Router-Slug (OpenRouter oder Orca); ohne Slash = Direct-ID.
 */

export const PROVIDER_MODES = ["direct", "openrouter", "hybrid", "local"];

/** Lokaler Kopf (Ternary Bonsai 2 27B) — Modell + Anzeigekürzel. */
export const LOCAL_MODEL_ID = "bonsai-2-27b-uncensored";
export const LOCAL_MODEL_LABEL = "27B";
export const LOCAL_HOST_DEFAULT = "http://127.0.0.1:8080/v1";

export function normalizeProvider(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "fallback") return "openrouter";
  if (PROVIDER_MODES.includes(v)) return v;
  return "hybrid";
}

/**
 * @param {object|null|undefined} bindings
 * @returns {string} gewünschter Provider-Modus (direct|openrouter|hybrid)
 */
export function providerOf(bindings) {
  return normalizeProvider(
    bindings?.provider || bindings?.providerActive || "hybrid",
  );
}

/**
 * Effektiver Hop eines Provider-Modus (für Anzeige/Vergleich):
 * hybrid → direct (off-peak) / openrouter (Peak).
 */
export function providerEffective(mode, opts = {}) {
  const m = normalizeProvider(mode);
  if (m !== "hybrid") return m;
  return opts.isPeak ? "openrouter" : "direct";
}

/**
 * Provider-Label für die Anzeige.
 * @param {string} mode
 * @param {{ isPeak?: boolean }} [opts]
 */
export function providerLabel(mode, opts = {}) {
  const m = normalizeProvider(mode);
  if (m === "direct") return "Direkt";
  if (m === "openrouter") return "Router";
  if (m === "local") return "Lokal";
  return opts.isPeak ? "Hybrid · Peak → Router" : "Hybrid";
}

/**
 * @param {object|null|undefined} bindings
 * @param {"agent"|"code"|string} absorb
 */
export function modelsForHead(bindings, absorb) {
  const shared = bindings?.models?.shared || {};
  const code = bindings?.models?.code || {};
  if (absorb === "code" && String(code.primary || "").trim()) {
    return {
      primary: String(code.primary).trim(),
      fallback: String(code.fallback || ""),
      source: "code",
    };
  }
  return {
    primary: String(shared.primary || "").trim(),
    fallback: String(shared.fallback || ""),
    source: "shared",
  };
}

/**
 * PUT /api/bindings body fragment. null = nicht speichern (leeres Agent-Primary).
 * @param {{ absorb?: string, primary?: string, fallback?: string }} input
 */
/**
 * Status after PUT /api/bindings pushed credentials to glyph-agent.
 * @param {{ ok?: boolean, applied?: boolean, error?: string } | null | undefined} apply
 * @returns {{ ok: boolean, text: string }}
 */
export function applyLiveStatus(apply) {
  if (apply && apply.ok && apply.applied) {
    return { ok: true, text: "Gespeichert · live am Agent." };
  }
  const reason = String(apply?.error || "").trim() || "offline";
  return {
    ok: false,
    text: `Gespeichert, Agent nahm es nicht: ${reason}`,
  };
}

/** °_Agent / ^_Code store models in bindings; Grok is CLI. */
export function isCloudModelProfile(profileId) {
  return profileId === "_tick" || profileId === "_code" || profileId === "glyph-agent";
}

/**
 * Model pill from GET /api/bindings. Polling is read-only;
 * POST /api/models/apply is connect / save / explicit click.
 *
 * @param {object} data
 * @param {string} profileId
 */
export function modelHudFromBindings(data = {}, profileId = "") {
  const active = data.modelsActive?.active || data.modelsActive?.shared;
  const desired = data.models?.shared;
  const code = data.modelsActive?.code || data.models?.code;
  const useCode =
    (profileId === "_tick" || profileId === "_code") && Boolean(code?.primary);
  const primary = useCode
    ? code.primary
    : active?.primary ||
      desired?.primary ||
      data.modelsActive?.shared?.primary ||
      "";
  const fb = useCode
    ? (code.fallback ?? "")
    : (active?.fallback ??
      desired?.fallback ??
      data.modelsActive?.shared?.fallback ??
      "");
  // Gewählter Modus pro Kopf — °_Agent: provider, ^_Code: code_provider.
  // Nicht der effektive Hop, damit Hybrid als aktiv erscheint (auch off-peak).
  const prov = normalizeProvider(
    useCode
      ? data.codeProvider ||
        data.codeProviderMode ||
        data.provider ||
        "hybrid"
      : data.provider ||
        data.providerActive ||
        data.modelsActive?.provider ||
        "hybrid",
  );
  const isPeak = Boolean(data.providerPeak || data.modelsActive?.provider_peak);
  // Lokaler Kopf: das Modell hängt am Provider-Modus, nicht am Cloud-Paar.
  const label =
    prov === "local"
      ? LOCAL_MODEL_LABEL
      : primary && fb
        ? `${primary} → ${fb}`
        : primary || "—";
  const liveLabel = String(data.modelsActive?.active?.label || "").trim();
  // Cloud nutzbar? Ohne Schlüssel kann kein Cloud-Modus antworten. Das ist die
  // einzige Cloud-Störung, die hier bekannt ist — ein Laufzeitfehler wie „kein
  // Guthaben" zeigt sich erst, wenn eine Anfrage scheitert.
  const cloudOk = Boolean(
    data.keys?.DIRECT_API_KEY?.set || data.keys?.OPENROUTER_API_KEY?.set,
  );
  return {
    kind: "openrouter",
    label,
    primary,
    fallback: fb || "",
    liveLabel,
    provider: prov,
    isPeak,
    cloudOk,
    mismatch: Boolean(data.modelsMismatch) || Boolean(data.providerMismatch),
  };
}

/** Slash in der ID = Router-Hop; ohne Slash = Direct. */
export function hopFromModelId(modelId) {
  return String(modelId || "").includes("/") ? "openrouter" : "direct";
}

export const DIRECT_HOST_DEFAULT = "https://api.deepseek.com";
export const ROUTER_HOST_OPENROUTER = "https://openrouter.ai/api/v1";
export const ROUTER_HOST_ORCA = "https://api.orcarouter.ai/v1";

/** Host without protocol/path, for the closed hop row. */
export function hostShort(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    return String(u.host || "").replace(/^www\./, "");
  } catch {
    return s.replace(/^https?:\/\//i, "").split("/")[0] || s;
  }
}

/**
 * Which named Router host this URL is.
 * @returns {"openrouter"|"orca"|"custom"}
 */
export function routerKind(url) {
  const host = hostShort(url);
  if (host === "openrouter.ai" || host === "api.openrouter.ai") return "openrouter";
  if (host === "api.orcarouter.ai" || host === "orcarouter.ai") return "orca";
  return "custom";
}

/** Hop pill on a model ID: Direct (no slash) / Router (slash). */
export function hopPill(modelId) {
  return hopFromModelId(modelId) === "direct" ? "Direct" : "Router";
}

/**
 * Closed-row facts for Direct or Router.
 * @param {object|null|undefined} bindings
 * @param {"direct"|"router"} hop
 */
export function hopRow(bindings, hop) {
  const which = hop === "router" ? "router" : "direct";
  if (which === "direct") {
    const rec = bindings?.settings?.DIRECT_API_URL;
    const host = String(rec?.value || "").trim() || DIRECT_HOST_DEFAULT;
    const key = bindings?.keys?.DIRECT_API_KEY;
    const live = Boolean(key?.set);
    return {
      id: "direct",
      label: "Direct",
      live,
      state: live ? "live" : "cut",
      host,
      hostShort: hostShort(host),
      source: rec?.source || "default",
      keySet: live,
      masked: key?.masked || "",
      keyId: "DIRECT_API_KEY",
      urlId: "DIRECT_API_URL",
    };
  }
  const rec = bindings?.settings?.OPENROUTER_URL;
  const host = String(rec?.value || "").trim() || ROUTER_HOST_OPENROUTER;
  const key = bindings?.keys?.OPENROUTER_API_KEY;
  const live = Boolean(key?.set);
  return {
    id: "router",
    label: "Router",
    live,
    state: live ? "live" : "cut",
    kind: routerKind(host),
    host,
    hostShort: hostShort(host),
    source: rec?.source || "default",
    keySet: live,
    masked: key?.masked || "",
    keyId: "OPENROUTER_API_KEY",
    urlId: "OPENROUTER_URL",
  };
}

export function buildModelsPatch({ absorb, primary, fallback } = {}) {
  const p = String(primary || "").trim();
  const fb = String(fallback || "").trim();
  if (absorb === "code") {
    if (!p) return { models: { code: null } };
    return { models: { code: { primary: p, fallback: fb } } };
  }
  if (!p) return null;
  return { models: { shared: { primary: p, fallback: fb } } };
}

export function buildProviderPatch(provider) {
  return { provider: normalizeProvider(provider) };
}
