import os

def fix_file(filepath, replacements):
    with open(filepath, "r") as f:
        code = f.read()
    for old, new in replacements:
        code = code.replace(old, new)
    with open(filepath, "w") as f:
        f.write(code)

fix_file("src/hooks/useNoteStorage.ts", [
    ("import { Note } from '../store/useAppStore'", "import type { Note } from '../store/useAppStore'"),
    ("note.content", "note?.content || ''")
])

fix_file("src/hooks/useReminders.ts", [
    ("body: label,", "body: label || '',")
])

fix_file("src/hooks/useVariables.ts", [
    ("const name = varMatch[1]", "const name = varMatch[1]!"),
    ("globals[name] = mathjs.evaluate(varMatch[2]", "globals[name] = mathjs.evaluate(varMatch[2]!"),
    ("globals[name] = varMatch[2].trim()", "globals[name] = varMatch[2]!.trim()")
])

fix_file("src/lib/editor/plugins.ts", [
    ("const name = match[1]", "const name = match[1]!"),
    ("mathjs.evaluate(match[2]", "mathjs.evaluate(match[2]!"),
    ("scope[name] = match[2].trim()", "scope[name] = match[2]!.trim()"),
    ("const targetStr = match[4]", "const targetStr = match[4] || ''"),
    ("const targetMs = new Date(targetStr).getTime()", "const targetMs = targetStr ? new Date(targetStr).getTime() : 0"),
    ("const label = match[3]", "const label = match[3] || ''"),
    ("const exprPart = calcMatch[1]", "const exprPart = calcMatch[1]!"),
    ("const oldResult = calcMatch[2]", "const oldResult = calcMatch[2]!"),
    ("console.log(e)", ""),
    ("const url = match[1]", "const url = match[1]!"),
    ("const path = match[1]", "const path = match[1]!"),
    ("const isDone = match[1] ===", "const isDone = match[1]! ==="),
    ("text.slice(match.index + 2, match.index + match[0].length - 2)", "text.slice(match.index + 2, match.index + match[0]!.length - 2)")
])

fix_file("src/utils.ts", [
    ("const lastPart = parts.pop()", "const lastPart = parts.pop() || ''"),
    ("parts.length > 0", "parts && parts.length > 0")
])

fix_file("src/utils.test.ts", [
    ("const lastPart = parts.pop()", "const lastPart = parts.pop() || ''")
])

fix_file("src/App.tsx", [
    ("const name = match[1]", "const name = match[1]!"),
    ("mathjs.evaluate(match[2]", "mathjs.evaluate(match[2]!"),
    ("scope[name] = match[2].trim()", "scope[name] = match[2]!.trim()"),
    ("const exprPart = calcMatch[1]", "const exprPart = calcMatch[1]!"),
    ("const oldResult = calcMatch[2]", "const oldResult = calcMatch[2]!"),
    ("const filename = note.id.replace", "const filename = note?.id.replace"),
    ("note.content.split", "note?.content.split"),
    ("selNote.id", "selNote?.id"),
    ("selNote.content", "selNote?.content")
])

fix_file("src/components/RemindersPage.tsx", [
    ("const label = match[3]", "const label = match[3] || ''")
])

fix_file("src/GraphView.tsx", [
    ("targetId: match[1]", "targetId: match[1]!")
])

