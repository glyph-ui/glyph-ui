/**
 * ProviderErrorNotice — aufgeräumte Darstellung eines Anbieter-Fehlers.
 *
 * Statt „Fehler: HTTP 404 …“ mit rohem JSON: Ursache, Handlung und ein
 * aufklappbarer Technik-Block. Der Rohtext bleibt unverändert gespeichert.
 */
import { parseProviderError } from "../utils/providerError.js";

function ProviderErrorNotice({ raw = "", info = null }) {
  const data = info || parseProviderError(raw);
  if (!data) return null;
  return (
    <div
      className={`provider-error provider-error--${data.kind}`}
      role="alert"
      data-testid="provider-error"
    >
      <div className="provider-error-head">
        <span className="provider-error-icon" aria-hidden="true">
          !
        </span>
        <div className="provider-error-copy">
          <strong>{data.title}</strong>
          {data.message ? <p>{data.message}</p> : null}
          {data.model ? (
            <p className="provider-error-model">Modell: {data.model}</p>
          ) : null}
        </div>
      </div>
      {data.hint ? <p className="provider-error-hint">{data.hint}</p> : null}
      {data.link ? (
        <a
          className="provider-error-link"
          href={data.link}
          target="_blank"
          rel="noreferrer"
        >
          {data.linkLabel || data.link}
        </a>
      ) : null}
      <details className="provider-error-details">
        <summary>Technische Details</summary>
        <pre>{data.details}</pre>
      </details>
    </div>
  );
}

export { ProviderErrorNotice };
