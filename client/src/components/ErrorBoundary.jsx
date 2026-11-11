import { Component } from "react";

/**
 * Fehlergrenze fuer den App-Baum.
 *
 * Vorher stuerzte ein Render-Fehler (z. B. React wollte einen DOM-Knoten
 * entfernen, den ein Fremd-Code schon ersetzt hatte) die komplette Seite:
 * React haengte den Baum ab, die Seite blieb weiss. Jetzt erscheint eine
 * lesbare Meldung statt eines leeren Fensters — und der Neuladen-Knopf
 * bringt die App zurueck.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      console.error("Glyph: Render-Fehler", error, info?.componentStack);
    } catch {
      /* ignore */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="fatal-error" role="alert">
        <h2 className="fatal-error-title">Glyph konnte nicht weiterlaufen</h2>
        <p className="fatal-error-text">
          Ein Fehler beim Zeichnen der Oberfläche hat die Sitzung angehalten.
          Meist hilft ein Neuladen — deine Nachrichten und der Vault-Stand
          bleiben erhalten.
        </p>
        <pre className="fatal-error-detail">
          {String(error?.message || error).slice(0, 400)}
        </pre>
        <button
          type="button"
          className="fatal-error-reload"
          onClick={() => window.location.reload()}
        >
          Neu laden
        </button>
      </div>
    );
  }
}
