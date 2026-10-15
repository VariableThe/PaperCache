import { Decoration, DecorationSet } from '@codemirror/view'
import { logger } from '../logger'

export function isCursorInMatch(
  selectionRanges: readonly { from: number; to: number }[],
  start: number,
  end: number
): boolean {
  return selectionRanges.some((r) => r.from <= end && r.to >= start)
}

export function safeDecorationSet(
  decos: { from: number; to: number; deco: Decoration }[],
  pluginName: string
): DecorationSet {
  try {
    const ranges = decos.map((d) => d.deco.range(d.from, d.to))
    return Decoration.set(ranges, true)
  } catch (e) {
    logger.error(`${pluginName} error:`, e)
    return Decoration.none
  }
}
