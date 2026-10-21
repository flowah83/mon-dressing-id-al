/**
 * A light tap on a range control can nudge it. Only a real drag, or the keyboard,
 * should leave the felt temperature.
 */
export function sliderChangeIsDeliberate(input: {
  pointerActive: boolean;
  pointerMovedPx: number;
}): boolean {
  if (!input.pointerActive) return true;
  return input.pointerMovedPx >= 8;
}
