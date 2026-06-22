import path from 'node:path'
import fs from 'node:fs'

export function initializeOnboarding(NOTES_DIR: string, COMMANDS_DIR: string) {
  function writeCommandFile(name: string, content: string) {
    const filePath = path.join(COMMANDS_DIR, name)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content)
    }
  }

  writeCommandFile(
    'basics.md',
    `# Basics\n\n- **Zoom**: \`Cmd + +\` to zoom in, \`Cmd + -\` to zoom out, \`Cmd + 0\` to reset.\n- **New Note**: \`Cmd + N\` from anywhere when app is running.\n- **Note Search**: \`Cmd + P\` to search across all your notes.\n- **Main Menu**: \`Cmd + K\` to open the action menu.\n- **Export Note**: \`Cmd + E\` to export the current note as markdown.\n- **Graph View**: \`Cmd + G\` to see how your notes connect.\n- **Highlight**: \`Cmd + H\` to highlight selected text.\n- **Cancel/Close**: Press \`Esc\` to exit modals.\n\n## Global Shortcuts\n- **Toggle Visibility**: \`Cmd+Shift+C\` from anywhere on your OS to hide or show PaperCache.\n- **Global New Note**: \`Cmd+Shift+N\` to spawn a new floating note anywhere.\n- **Settings**: \`Cmd+Shift+S\` to open the settings panel.\n\n*Example use:* Press \`Cmd+K\` right now, select "Settings", and set your global hotkey!\n\nNext: [Folders](/file commands/folders.md)\n`
  )

  writeCommandFile(
    'folders.md',
    `# Folders\n\nOrganize your notes by using a \`/\` in the note title.\nFolders automatically receive a unique color identifier in the Graph View and Search list.\n\n*Example use:*\nIf you rename this note (click the title at the top left) to \`projects/PaperCache.md\`, it will automatically be placed inside a \`projects\` folder!\n\nNext: [Variables](/file commands/variables.md)\n`
  )

  writeCommandFile(
    'variables.md',
    `# Variables & Math\n\nPaperCache is a smart scratchpad. You can define variables and write math equations that auto-calculate.\n\n**Local Variables:** (Only works in this note)\n/var x = 10\n\n*Example use:* Type \`x * 3 =\` below and watch it calculate!\nx * 3 = \u200B30\n\n**Global Variables:** (Works across ALL your notes)\n/globvar API_KEY = "sk-123"\n\n*Example use:* Just type API_KEY anywhere and see it highlight when your cursor leaves the word!\nAPI_KEY\n\nNext: [Markdown & Code](/file commands/markdown.md)\n`
  )

  writeCommandFile(
    'markdown.md',
    `# Markdown & Code\n\nPaperCache supports full markdown with seamless inline editing.\n\n## Highlighting\nSelect text and press \`Cmd+H\` to highlight it.\n*Example use:* ==This text is highlighted!==\n\n## Code Snippets\nYou can write code snippets inside triple backticks \`\`\` and specify the language name right after the backticks for syntax highlighting.\n*Example use:*\n\`\`\`javascript\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\n\`\`\`\n*(Tip: Click the copy button in the top right of the code block to copy its contents!)*\n\n## Horizontal Rules\nType \`---\` on a new line to create a beautiful horizontal divider.\n*Example use:*\n\n---\n\n## Inline AI Assistance\nTo use the AI, first grab a free API key from [OpenRouter](https://openrouter.ai/keys) and paste it into Settings (\`Cmd+Shift+S\`).\n\nType \`/ai <prompt>\` and press enter to summon an AI assistant directly into your document.\nYou can also type \`/ctx <prompt>\` to automatically include the entire note's text in your prompt! AI responses are highlighted with a distinct background so you can easily distinguish them from your own writing.\n*Example use:*\n\`/ai Write a python function to reverse a string\`\n\nNext: [Formats & Colors](/file commands/formats.md)\n`
  )

  writeCommandFile(
    'formats.md',
    `# Formats & Colors\n\nPaperCache automatically recognizes and highlights common formats so you can easily spot them in your notes.\n\n## Colors\nType any hex color, and it will be highlighted with a matching pill! You can click the small colored circle inside the pill to quickly copy the hex code to your clipboard.\n*Example use:* #D97757 or #3B82F6 or #10B981\n\n## Dates & Times\nDates and times are also highlighted to help you keep track of your schedule.\n*Example use:* \nMeeting on 31-05-2024 at 14:30.\n\nNext: [Tags](/file commands/tags.md)\n`
  )

  writeCommandFile(
    'tags.md',
    `# Tags\n\nYou can tag your notes anywhere by typing an exclamation mark followed by a word (e.g., !important or !work).\n\n*Example use:*\nThis is a note about a !project. \n\nWhen you open the search menu (\`Cmd+P\`), you'll see all your unique tags at the top. Click any tag to instantly filter your notes!\n\nNext: [Tasks](/file commands/tasks.md)\n\n[Back to Welcome](/file Welcome.md)\n`
  )

  writeCommandFile(
    'tasks.md',
    `# Tasks & Reminders\n\nStay on top of your work by using tasks!\n\nType \`/task\` to create a new task.\nIf you want to set a deadline, just type \` @ \` followed by a time shorthand after the task.\n*Example use:*\n/task Buy groceries @ 2h\n\nPaperCache understands shorthands like \`2d\`, \`3h45m\`, \`tmrw\`, or even exact dates like \`31-12-2024 15:00\`.\nOnce you set a task, press \`Cmd+T\` (or \`Ctrl+T\`) to open the Tasks Page and see everything that's due!\nOverdue tasks will automatically highlight in red.\n\nNext: [Ready](/file commands/ready.md)\n\n[Back to Welcome](/file Welcome.md)\n`
  )

  writeCommandFile(
    'ready.md',
    `# Ready to get started?\n\nYou're all set to use PaperCache! Start jotting down your thoughts, creating folders, and exploring the capabilities.\n\n[Back to Welcome](/file Welcome.md)\n`
  )

  const welcomePath = path.join(NOTES_DIR, 'Welcome.md')
  let shouldWriteWelcome = true
  if (fs.existsSync(welcomePath)) {
    const content = fs.readFileSync(welcomePath, 'utf-8')
    if (content.includes('[7. Tasks]')) {
      shouldWriteWelcome = false
    }
  }

  if (shouldWriteWelcome) {
    fs.writeFileSync(
      welcomePath,
      `# Welcome to PaperCache!\n\nPaperCache is your intelligent, minimalist markdown scratchpad. \n\nTo navigate, use **Cmd + Click** (or **Ctrl + Click**) on any internal link. You can look at all the files in the order you want!\n\nHere's an interactive checkbox to try out right now:\n/check I am learning PaperCache!\n\nTry Cmd+Clicking these to learn the ropes:\n- [1. Basics](/file commands/basics.md)\n- [2. Folders](/file commands/folders.md)\n- [3. Variables](/file commands/variables.md)\n- [4. Markdown & Code](/file commands/markdown.md)\n- [5. Formats & Colors](/file commands/formats.md)\n- [6. Tags](/file commands/tags.md)\n- [7. Tasks](/file commands/tasks.md)\n\n*(Press \`Cmd+K\` at any time to open the main menu!)*\n`,
    )

    const now = new Date()
    fs.utimesSync(welcomePath, now, new Date(now.getTime() + 10000))
  }
}
