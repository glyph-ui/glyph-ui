/**
 * Composer-Toggle: Pixel-Apfel über dem Senden-Button.
 * Idle: kein Kreis (wie Send-Raupe). An: mini-Raupe krabbelt auf Ellipse hinter dem Apfel.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useRef } from "react";
import { appleToggleLabel } from "../utils/vaultSearch.js";

/**
 * Pixel-Apfel, 16×16: runder Körper mit Kerbe oben, dünner senkrechter Stiel,
 * kleines Blatt am Stiel, Glanz oben links.
 *
 * Vorher war der Körper breiter als hoch (10×8) mit flacher Schulter und
 * schrägem Stiel — das liest sich als Paprika. Ein Apfel ist rund, hat oben
 * eine Kerbe, in der der Stiel sitzt, und ist mindestens so hoch wie breit.
 */
function PixelApple({ size = 16 }) {
  const s = 16;
  return (
    <svg
      className="composer-vault-apple"
      width={size}
      height={size}
      viewBox={`0 0 ${s} ${s}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Goldrand — NUR im An-Zustand sichtbar (CSS), und nur um den Körper.
          Das ist die An-Markierung; der Apfel bleibt in beiden Zuständen rot.
          Vorher wurde der Körper im An-Zustand aufgehellt (70 % Weiß) — das
          wirkte bei 16 px mit grünem Blatt und goldenem Stiel wie eine Zitrone.
          Wird zuerst gezeichnet, damit Stiel (x=7) und Blatt (x=9) darüber
          liegen und sauber aus dem Rand wachsen. */}
      <g className="composer-vault-apple-outline">
        <rect x={5} y={2} width={2} height={1} />
        <rect x={9} y={2} width={2} height={1} />
        <rect x={4} y={3} width={1} height={1} />
        <rect x={7} y={3} width={2} height={1} />
        <rect x={11} y={3} width={1} height={1} />
        <rect x={3} y={4} width={1} height={1} />
        <rect x={12} y={4} width={1} height={1} />
        <rect x={2} y={5} width={1} height={1} />
        <rect x={13} y={5} width={1} height={1} />
        <rect x={2} y={6} width={1} height={1} />
        <rect x={13} y={6} width={1} height={1} />
        <rect x={2} y={7} width={1} height={1} />
        <rect x={13} y={7} width={1} height={1} />
        <rect x={2} y={8} width={1} height={1} />
        <rect x={13} y={8} width={1} height={1} />
        <rect x={2} y={9} width={1} height={1} />
        <rect x={13} y={9} width={1} height={1} />
        <rect x={2} y={10} width={1} height={1} />
        <rect x={13} y={10} width={1} height={1} />
        <rect x={3} y={11} width={1} height={1} />
        <rect x={12} y={11} width={1} height={1} />
        <rect x={4} y={12} width={1} height={1} />
        <rect x={11} y={12} width={1} height={1} />
        <rect x={5} y={13} width={1} height={1} />
        <rect x={10} y={13} width={1} height={1} />
        <rect x={6} y={14} width={4} height={1} />
      </g>
      {/* Blatt — sitzt AM Stiel (x=8 grenzt an x=7) und steigt nach rechts oben.
          Ein frei schwebendes Blatt liest sich als Fremdkörper, kein Apfelblatt. */}
      <rect className="composer-vault-apple-leaf" x={8} y={2} width={2} height={1} />
      <rect className="composer-vault-apple-leaf" x={9} y={1} width={3} height={1} />
      {/* Stiel — dünn und senkrecht, sitzt in der Kerbe */}
      <rect className="composer-vault-apple-stem" x={7} y={1} width={1} height={3} />
      {/* Schultern — die Kerbe bleibt bei x=8 offen, darin sitzt der Stiel (x=7) */}
      <rect className="composer-vault-apple-body" x={5} y={3} width={2} height={1} />
      <rect className="composer-vault-apple-body" x={9} y={3} width={2} height={1} />
      {/* Runder Körper — höher als breit */}
      <rect className="composer-vault-apple-body" x={4} y={4} width={8} height={1} />
      <rect className="composer-vault-apple-body" x={3} y={5} width={10} height={6} />
      <rect className="composer-vault-apple-body" x={4} y={11} width={8} height={1} />
      <rect className="composer-vault-apple-body" x={5} y={12} width={6} height={1} />
      <rect className="composer-vault-apple-body" x={6} y={13} width={4} height={1} />
      {/* Schatten rechts unten */}
      <rect className="composer-vault-apple-shade" x={11} y={6} width={2} height={5} />
      <rect className="composer-vault-apple-shade" x={10} y={11} width={2} height={1} />
      <rect className="composer-vault-apple-shade" x={7} y={13} width={3} height={1} />
      {/* Glanz oben links — das Apfel-Erkennungszeichen */}
      <rect className="composer-vault-apple-shine" x={4} y={5} width={2} height={1} />
      <rect className="composer-vault-apple-shine" x={4} y={6} width={1} height={2} />
    </svg>
  );
}

export function VaultSearchToggle({
  on,
  disabled,
  onToggle,
  className = "",
}) {
  const btnRef = useRef(null);
  const orbitRef = useRef(null);

  useEffect(() => {
    if (!on) return undefined;
    const btn = btnRef.current;
    const orbit = orbitRef.current;
    if (!btn || !orbit) return undefined;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return undefined;

    // Ellipse so, dass die Steine den Apfel gerade streifen statt ihn zu
    // verdecken. Steine sind 6 px (Radius 3), der Apfel ist 16 px und sein
    // gezeichneter Umriss reicht 6 px nach links/rechts und 7 px nach
    // oben/unten. RX = 6+3 waere exakt auf der Kante, deckt aber die linke
    // Apfelkante zu; 10/11 laesst ~1 px Luft und liest sich als Raupe AUF dem
    // Rand. Vorher 11/15: die Raupe lief 3-5 px neben dem Apfel her und oben
    // ganz aus dem 24-px-Button heraus.
    const RX = 10;
    const RY = 11;
    // Drei Steine bei 38 Grad Abstand: auf ~66 px Umfang liegen sie ~7 px
    // auseinander und beruehren sich fast — das liest sich als eine Raupe.
    const TRAIL = [0, -38, -76];
    const stones = orbit.querySelectorAll(".composer-vault-stone");

    const place = (deg, nibblePx, nodDeg) => {
      TRAIL.forEach((off, i) => {
        const t = ((deg + off) * Math.PI) / 180;
        let x = RX * Math.sin(t);
        let y = -RY * Math.cos(t);
        if (i === 0 && nibblePx) {
          const len = Math.hypot(x, y) || 1;
          x -= (nibblePx * x) / len;
          y -= (nibblePx * y) / len;
        }
        const heading =
          (Math.atan2(RY * Math.sin(t), RX * Math.cos(t)) * 180) / Math.PI;
        const rot = i === 0 ? heading + nodDeg : heading;
        stones[i].style.transform =
          `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
      });
    };

    let raf = 0;
    let last = 0;
    let angle = 0;
    let mode = "crawl";
    let crawlLeft = 36 + Math.random() * 40;
    let pauseLeft = 0;
    let wiggleT = 0;
    let nod = 0;
    let nibble = 0;

    const step = (ts) => {
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
      last = ts;
      if (mode === "crawl") {
        const da = 9 * dt;
        angle = (angle + da) % 360;
        crawlLeft -= da;
        nod = 0;
        nibble = 0;
        if (crawlLeft <= 0) {
          mode = "pause";
          pauseLeft = 0.9 + Math.random() * 1.8;
          wiggleT = 0;
        }
      } else {
        pauseLeft -= dt;
        wiggleT += dt;
        nod = Math.sin(wiggleT * Math.PI * 3.2) * 18;
        nibble = (0.5 - 0.5 * Math.cos(wiggleT * Math.PI * 4.4)) * 2.2;
        if (pauseLeft <= 0) {
          mode = "crawl";
          crawlLeft = 28 + Math.random() * 55;
          nod = 0;
          nibble = 0;
        }
      }
      place(angle, nibble, nod);
      raf = requestAnimationFrame(step);
    };
    place(0, 0, 0);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      stones.forEach((el) => {
        el.style.transform = "";
      });
    };
  }, [on]);

  return (
    <div
      className={`composer-vault-hub${on ? " is-on" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        ref={btnRef}
        type="button"
        className={`composer-vault-btn${on ? " is-on" : ""}`}
        aria-pressed={on}
        aria-label={appleToggleLabel(on)}
        title={appleToggleLabel(on)}
        disabled={disabled}
        onClick={onToggle}
      >
        <span ref={orbitRef} className="composer-vault-orbit" aria-hidden="true">
          {/* Drei Steine: Kopf, Mittelstueck, Schwanz. Ein vierter Segmentstein
              machte die Raupe laenger als den Apfel hoch ist. */}
          <span className="composer-vault-slot composer-vault-slot--a">
            <i className="composer-vault-stone composer-vault-stone--head" />
          </span>
          <span className="composer-vault-slot composer-vault-slot--b">
            <i className="composer-vault-stone composer-vault-stone--mid" />
          </span>
          <span className="composer-vault-slot composer-vault-slot--c">
            <i className="composer-vault-stone composer-vault-stone--tail" />
          </span>
        </span>
        {/* 16 = 1:1 zum 16er-Raster (bei Retina 2x) — 18 skaliert mit 1.125
            und verwischt die Pixelkanten. */}
        <PixelApple size={16} />
      </button>
    </div>
  );
}
