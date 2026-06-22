# Our Philosophy

### 1. **Your Thoughts Are Ephemeral**
A scratchpad shouldn't feel like a database. PaperCache is designed for the temporary, the messy, and the in-between. It spawns when you need it, vanishes when you're done, and respects the fleeting nature of brainstorming. We believe in tools that feel like an extension of your mind, not a filing cabinet.

### 2. **Active > Passive**
Most note-taking apps are passive: you write text, and it sits there. PaperCache is **active**. It evaluates your math in real-time, queries AI inline, links your notes automatically, and visualizes your knowledge graph. We believe your notes should *work for you*, not just store your words.

### 3. **Zero Friction is Non-Negotiable**
If a tool slows you down, you won't use it. That's why PaperCache:
- Spawns exactly where your mouse cursor is
- Uses **0% CPU when idle** (truly zero, not "low")
- Hides markdown syntax when you aren't editing
- Vanishes the moment you click away
- Loads heavy dependencies (like `mathjs`) only when needed

We believe performance is a feature, not an optimization.

### 4. **Developers Think Differently**
You don't just write prose; you write code, equations, and structured data. PaperCache is built for the developer brain:
- Reactive variables (`/var x = 5`)
- Inline AI with context injection (`/ctx`)
- Implicit folder organization (`projects/PaperCache.md`)
- Knowledge graph visualization

We believe productivity tools should match how you *actually* think, not how a product manager thinks you should think.

### 5. **Open Source is the Only Ethical Choice**
Your personal workflow shouldn't be locked behind a paywall or a SaaS subscription. PaperCache is:
- **100% free** (no "Pro" tier, no feature gating)
- **Open source** (audit the code, contribute, fork it)
- **Self-hosted** (your data never leaves your machine)
- **Cross-platform** (macOS, Windows, Linux)

We believe transparency and accessibility aren't features; they're responsibilities.

### 6. **AI Should Be Invisible, Not Intrusive**
Most apps bolt on a chatbot sidebar and call it "AI-powered." PaperCache integrates AI **inline**, where you're already working:
- Type `/ai <prompt>` and get an answer right in your document
- Use `/ctx <prompt>` to automatically include your entire note as context
- Your API keys are encrypted with Electron's `safeStorage`

We believe AI should augment your workflow, not interrupt it.

### 7. **Opinionated Design is Kind**
We don't try to be everything to everyone. PaperCache makes specific, intentional choices:
- No complex plugin system (we ship what works)
- No cloud sync (your data is yours)
- No WYSIWYG editor (you get raw text speed with rendered readability)

We believe saying "no" to feature creep is how you build tools that respect your users' time.

### 8. **Engineering Rigor Matters, Even for "Simple" Apps**
PaperCache is version `0.2.10`, but it has:
- CI/CD pipelines with automated testing
- Zustand state management with slice-subscriptions
- Lazy-loaded heavy dependencies
- Debounced reactive evaluations
- Power throttling via `powerMonitor` API

We believe "just a scratchpad" is no excuse for sloppy code. Every line is written with the same rigor as a production SaaS app.

---

### The Bottom Line
**PaperCache exists because we refuse to compromise.** We refuse to accept that Electron apps must be bloated. We refuse to accept that scratchpads must be dumb. We refuse to accept that productivity tools must be expensive or closed-source.

This is a tool built by a developer, for developers, with an obsession for performance, privacy, and polish. It's the scratchpad we always wanted but could never find—so we built it ourselves.
