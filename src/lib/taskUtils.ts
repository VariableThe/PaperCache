export function normalizeDateString(dateStr: string | null): string | null {
  if (!dateStr) return null
  const match = /^(\d{2})-(\d{2})-(\d{4})(.*)$/.exec(dateStr)
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}${match[4]}`
  }
  return dateStr
}

export function getTaskPrefixRegex(): RegExp {
  return /\/(task(?:-done)?)(?:\s+\(((?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}) \d{2}:\d{2})\))?\s+/g
}

export function getFullTaskLineRegex(global: boolean = true): RegExp {
  const dateRe = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})'
  const reStr = `\\/(task(?:-done)?)(?:\\s+\\((${dateRe} \\d{2}:\\d{2})\\))?\\s+(.*?)(?:\\s+@\\s+(${dateRe}(?:\\s+\\d{2}:\\d{2}(?::\\d{2})?)?))?[ \\t]*$`
  return new RegExp(reStr, global ? 'gm' : '')
}

export function parseAllTasks(content: string) {
  const tasks = []
  const reRem = getFullTaskLineRegex(true)
  let match

  while ((match = reRem.exec(content)) !== null) {
    tasks.push({
      matchIndex: match.index,
      matchLength: match[0].length,
      isDone: match[1] === 'task-done',
      creationDate: normalizeDateString(match[2] || null),
      label: match[3] || '',
      targetStr: normalizeDateString(match[4] || null),
    })
  }
  return tasks
}
