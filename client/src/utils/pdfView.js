/** CSS-Maßstab einer PDF-Seite: 100 % füllt die Fensterbreite, nicht den Rahmen. */
export function pageDrawScale(containerWidth, pageWidthAt1, zoomPercent) {
  const box = Number(containerWidth) || 0;
  const page = Number(pageWidthAt1) || 0;
  const zoom = Number(zoomPercent) || 100;
  if (box <= 0 || page <= 0) return 1;
  return (box / page) * (zoom / 100);
}
