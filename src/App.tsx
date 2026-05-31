import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { ViewPlugin, Decoration, MatchDecorator, EditorView, keymap, WidgetType } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { search } from '@codemirror/search'
import { insertTab, indentLess } from '@codemirror/commands'
import * as mathjs from 'mathjs'
import OpenAI from 'openai'
import GraphView from './GraphView'
import './App.css'

import { getFolderColor } from './utils'

const mdHighlighting = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: t.heading2, fontSize: '1.2em', fontWeight: 'bold' },
  { tag: t.heading3, fontSize: '1.1em', fontWeight: 'bold' },
  { tag: t.heading4, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.heading5, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.heading6, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#3b82f6', textDecoration: 'underline' },
  { tag: t.url, color: '#3b82f6' },
  { tag: t.processingInstruction, color: 'rgba(128,128,128,0.5)' },
  { tag: t.meta, color: 'rgba(128,128,128,0.5)' },
  { tag: t.punctuation, color: 'rgba(128,128,128,0.5)' }
])

// Custom Decorators for syntax highlighting
const numberMatcher = new MatchDecorator({
  regexp: /\b\d+(\.\d+)?\b/g,
  decoration: Decoration.mark({ class: 'cm-custom-number' })
})
const symbolMatcher = new MatchDecorator({
  regexp: /[+\-*/=^()]/g,
  decoration: Decoration.mark({ class: 'cm-custom-symbol' })
})
const aiMatcher = new MatchDecorator({
  regexp: /\u200B[\s\S]*?\u200C/g,
  decoration: Decoration.mark({ class: 'cm-custom-ai' })
})
const mathMatcher = new MatchDecorator({
  regexp: /\u200B.*/g, // matches zero-width space and everything after it
  decoration: Decoration.mark({ class: 'cm-custom-math' })
})

const numberPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: any) { this.decorations = numberMatcher.createDeco(view) }
    update(update: any) { this.decorations = numberMatcher.updateDeco(update, this.decorations) }
  }, { decorations: v => v.decorations }
)

const symbolPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: any) { this.decorations = symbolMatcher.createDeco(view) }
    update(update: any) { this.decorations = symbolMatcher.updateDeco(update, this.decorations) }
  }, { decorations: v => v.decorations }
)

const aiPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: any) { this.decorations = aiMatcher.createDeco(view) }
    update(update: any) { this.decorations = aiMatcher.updateDeco(update, this.decorations) }
  }, { decorations: v => v.decorations }
)

const mathPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: any) { this.decorations = mathMatcher.createDeco(view) }
    update(update: any) { this.decorations = mathMatcher.updateDeco(update, this.decorations) }
  }, { decorations: v => v.decorations }
)
class CopyWidget extends WidgetType {
  code: string;
  language: string;
  constructor(code: string, language: string) {
    super();
    this.code = code;
    this.language = language;
  }
  
  eq(other: CopyWidget) {
    return other.code === this.code && other.language === this.language;
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.className = "cm-copy-button";
    wrap.title = "Copy code";
    
    if (this.language) {
      const langSpan = document.createElement("sup");
      langSpan.textContent = this.language;
      langSpan.className = "cm-code-lang";
      wrap.appendChild(langSpan);
    }
    
    const iconSpan = document.createElement("span");
    // Standard copy icon (two offset rounded rectangles)
    iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    wrap.appendChild(iconSpan);
    
    wrap.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(this.code);
      const originalHtml = iconSpan.innerHTML;
      // Checkmark icon
      iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => {
        iconSpan.innerHTML = originalHtml;
      }, 2000);
    };
    return wrap;
  }
}

class VariableWidget extends WidgetType {
  value: string;
  constructor(value: string) { 
    super();
    this.value = value;
  }
  eq(other: VariableWidget) { return other.value === this.value }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = String(this.value);
    span.className = "cm-variable-pill";
    return span;
  }
}

const hideMarkdownPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) { this.decorations = this.buildDeco(view) }
    update(update: any) { 
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDeco(update.view) 
      }
    }
    
    buildDeco(view: EditorView) {
      const decos: { from: number, to: number, deco: Decoration }[] = []
      
      const selectionRanges = view.state.selection.ranges;
      const isCursorInMatch = (start: number, end: number) => {
        return selectionRanges.some((r: any) => r.from <= end && r.to >= start);
      }
      
      const linkRanges: {from: number, to: number}[] = [];
      const fullDoc = view.state.doc.toString();
      
      // Build variable scope (incorporate global variables)
      const scope: any = Object.assign({}, (window as any).__globalVariables || {});
      const reVar = /^\/var\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm;
      let varMatch;
      while ((varMatch = reVar.exec(fullDoc)) !== null) {
        const name = varMatch[1];
        try {
          scope[name] = mathjs.evaluate(varMatch[2], scope);
        } catch(e) {
          scope[name] = varMatch[2].trim();
        }
      }
      const scopeKeys = Object.keys(scope).sort((a, b) => b.length - a.length);
      
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        
        const reHighlight = /==(.*?)==/g
        let match
        while ((match = reHighlight.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (start + 2 <= end - 2) {
            if (!isCursorInMatch(start, end)) {
              decos.push({ from: start, to: start + 2, deco: Decoration.replace({}) })
              decos.push({ from: end - 2, to: end, deco: Decoration.replace({}) })
            }
            decos.push({ from: start + 2, to: end - 2, deco: Decoration.mark({ class: 'cm-custom-highlight' }) })
          }
        }


        const reList = /^(\s*)\*\s+/gm
        while ((match = reList.exec(text)) !== null) {
          const start = from + match.index + match[1].length
          const end = start + 1 // only the asterisk
          if (!isCursorInMatch(start, end + 1)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }
        
        // Handled by syntaxTree below
        
        const reHeading = /^#{1,6}\s+/gm
        while ((match = reHeading.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }
        
        const reLink = /\[(.*?)\]\((.*?)\)/g
        while ((match = reLink.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          linkRanges.push({ from: start, to: end });
          
          const textStart = start + 1
          const textEnd = start + 1 + match[1].length
          const urlStart = textEnd
          const urlEnd = end
          
          let isFile = false;
          let linkPath = match[2].trim();
          
          if (linkPath.startsWith('/file')) {
            isFile = true;
            linkPath = linkPath.substring(5).trim();
          } else if (linkPath.startsWith('/url')) {
            linkPath = linkPath.substring(4).trim();
          }

          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: textStart, deco: Decoration.replace({}) })
            decos.push({ from: urlStart, to: urlEnd, deco: Decoration.replace({}) })
          }

          if (isFile) {
            decos.push({ 
              from: textStart, 
              to: textEnd, 
              deco: Decoration.mark({ 
                class: 'cm-custom-file-link', 
                attributes: { 'data-path': linkPath, 'title': 'Open file: ' + linkPath } 
              }) 
            })
          } else {
            decos.push({ 
              from: textStart, 
              to: textEnd, 
              deco: Decoration.mark({ 
                class: 'cm-custom-clickable-link', 
                attributes: { 'data-url': linkPath, 'title': linkPath } 
              }) 
            })
          }
        }
        
        const reFile = /\/file\s+([^\s)\]]+)/g
        while ((match = reFile.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          
          if (linkRanges.some(r => r.from <= start && r.to >= end)) continue;
          
          const pathStart = start + match[0].indexOf(match[1])
          
          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: pathStart, deco: Decoration.replace({}) })
          }
          
          decos.push({ 
            from: pathStart, 
            to: end, 
            deco: Decoration.mark({ 
              class: 'cm-custom-file-link', 
              attributes: { 'data-path': match[1], 'title': 'Open file: ' + match[1] } 
            }) 
          })
        }
        
        // Variable rendering
        if (scopeKeys.length > 0) {
          const reKeys = new RegExp(`\\b(${scopeKeys.join('|')})\\b`, 'g');
          while ((match = reKeys.exec(text)) !== null) {
            const start = from + match.index;
            const end = start + match[0].length;
            const line = view.state.doc.lineAt(start);
            if (line.text.trim().startsWith('/var')) continue; // don't replace inside variable definitions!
            
            if (!isCursorInMatch(start, end)) {
              decos.push({ from: start, to: end, deco: Decoration.replace({ widget: new VariableWidget(scope[match[1]]) }) });
            } else {
              decos.push({ from: start, to: end, deco: Decoration.mark({ class: 'cm-variable-highlight' }) });
            }
          }
        }
      } // end of visibleRanges iteration
      
      // Traverse AST for Code Blocks
      syntaxTree(view.state).iterate({
        enter: (node) => {
          if (node.type.name === 'FencedCode') {
            let lang = '';
            let code = '';
            let startCodeMark = null;
            let endCodeMark = null;
            let codeInfo = null;
            
            let child = node.node.firstChild;
            while (child) {
              if (child.type.name === 'CodeInfo') {
                lang = view.state.doc.sliceString(child.from, child.to);
                codeInfo = child;
              }
              if (child.type.name === 'CodeText') code = view.state.doc.sliceString(child.from, child.to);
              if (child.type.name === 'CodeMark') {
                if (!startCodeMark) startCodeMark = child;
                else endCodeMark = child;
              }
              child = child.nextSibling;
            }
            
            const start = node.from;
            const end = node.to;
            
            if (!isCursorInMatch(start, end)) {
              if (startCodeMark) {
                const replaceTo = codeInfo ? codeInfo.to : startCodeMark.to;
                decos.push({ from: startCodeMark.from, to: replaceTo, deco: Decoration.replace({}) });
              }
              if (endCodeMark) {
                decos.push({ from: endCodeMark.from, to: endCodeMark.to, deco: Decoration.replace({}) });
              }
            } else {
              if (codeInfo && !isCursorInMatch(codeInfo.from, codeInfo.to)) {
                decos.push({ from: codeInfo.from, to: codeInfo.to, deco: Decoration.replace({}) });
              }
            }
            
            if (startCodeMark) {
              decos.push({ from: startCodeMark.from, to: startCodeMark.from, deco: Decoration.widget({ widget: new CopyWidget(code, lang), side: 1 }) });
            }
            
            const startLine = view.state.doc.lineAt(start).number;
            const endLine = view.state.doc.lineAt(end).number;
            for (let i = startLine; i <= endLine; i++) {
              const line = view.state.doc.line(i);
              let className = 'cm-code-block-line';
              if (i === startLine) className += ' cm-code-block-first';
              if (i === endLine) className += ' cm-code-block-last';
              decos.push({ from: line.from, to: line.from, deco: Decoration.line({ class: className }) });
            }
          }
          
          if (node.type.name === 'EmphasisMark' || node.type.name === 'StrongMark') {
            const parent = node.node.parent;
            if (parent) {
              const start = parent.from;
              const end = parent.to;
              if (!isCursorInMatch(start, end)) {
                decos.push({ from: node.from, to: node.to, deco: Decoration.replace({}) });
              }
            }
          }
        }
      });
      
      try {
        const ranges = decos.map(d => d.deco.range(d.from, d.to));
        return Decoration.set(ranges, true);
      } catch (e) {
        console.error("Decoration builder error:", e);
        return Decoration.none;
      }
    }
  }, { decorations: v => v.decorations }
)

interface Note {
  id: string
  content: string
  mtime: number
}

// Ensure electronAPI is typed
declare global {
  interface Window {
    electronAPI: any
  }
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [currentNoteIndex, setCurrentNoteIndex] = useState<number>(0)
  const [zoomLevel, setZoomLevel] = useState<number>(Number(localStorage.getItem('papercache-zoom')) || 1)
  const [themePreset, setThemePreset] = useState(localStorage.getItem('papercache-theme') || 'paper-light')
  const [fontFamily, setFontFamily] = useState(localStorage.getItem('papercache-font') || "'JetBrains Mono', monospace")
  const [showRulings, setShowRulings] = useState(localStorage.getItem('papercache-show-rulings') === 'true')
  const [bgType, setBgType] = useState(localStorage.getItem('papercache-bg-type') || 'preset')
  const [bgColor, setBgColor] = useState(localStorage.getItem('papercache-bg-color') || '#ffffff')
  const [bgImage, setBgImage] = useState(localStorage.getItem('papercache-bg-image') || '')
  
  const [textColor, setTextColor] = useState(localStorage.getItem('papercache-color-text') || '#333333')
  const [numColor, setNumColor] = useState(localStorage.getItem('papercache-color-num') || '#007acc')
  const [symColor, setSymColor] = useState(localStorage.getItem('papercache-color-sym') || '#c586c0')
  const [aiColor, setAiColor] = useState(localStorage.getItem('papercache-color-ai') || '#10b981')
  const [mathColor, setMathColor] = useState(localStorage.getItem('papercache-color-math') || '#f59e0b')

  // AI Config State
  const [apiKey, setApiKey] = useState(localStorage.getItem('papercache-apikey') || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(localStorage.getItem('papercache-baseurl') || 'https://api.openai.com/v1')
  const [apiModel, setApiModel] = useState(localStorage.getItem('papercache-model') || 'gpt-4o')
  const [aiSystemPrompt, setAiSystemPrompt] = useState(localStorage.getItem('papercache-system-prompt') || 'Please provide a short and concise answer.')

  const [showGraphView, setShowGraphView] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  
  const [showNoteSearch, setShowNoteSearch] = useState(false)
  const [noteSearchQuery, setNoteSearchQuery] = useState('')
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0)
  
  const editorRef = useRef<any>(null)

  const [showNoteActionMenu, setShowNoteActionMenu] = useState(false)
  const [showMainActionMenu, setShowMainActionMenu] = useState(false)
  const [actionMenuIndex, setActionMenuIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const notesRef = useRef(notes)
  useEffect(() => { notesRef.current = notes }, [notes])

  useEffect(() => {
    if (showNoteSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [showNoteSearch])

  // We don't save theme state to localStorage here anymore, Settings window does it and we listen via storage event.

  // Load notes initially
  useEffect(() => {
    async function loadNotes() {
      const loaded = await window.electronAPI.getNotes()
      if (loaded.length > 0) {
        setNotes(loaded)
      }
    }
    loadNotes()

    // Listen to storage events to update config if changed from Settings window
    const handleStorageChange = () => {
      setApiKey(localStorage.getItem('papercache-apikey') || '')
      setApiBaseUrl(localStorage.getItem('papercache-baseurl') || 'https://api.openai.com/v1')
      setApiModel(localStorage.getItem('papercache-model') || 'gpt-4o')
      setAiSystemPrompt(localStorage.getItem('papercache-system-prompt') || 'Please provide a short and concise answer.')
      
      setShowRulings(localStorage.getItem('papercache-show-rulings') === 'true')
      setThemePreset(localStorage.getItem('papercache-theme') || 'paper-light')
      setFontFamily(localStorage.getItem('papercache-font') || "'JetBrains Mono', monospace")
      setBgType(localStorage.getItem('papercache-bg-type') || 'preset')
      setBgColor(localStorage.getItem('papercache-bg-color') || '#ffffff')
      setBgImage(localStorage.getItem('papercache-bg-image') || '')
      
      setTextColor(localStorage.getItem('papercache-color-text') || '#333333')
      setNumColor(localStorage.getItem('papercache-color-num') || '#007acc')
      setSymColor(localStorage.getItem('papercache-color-sym') || '#c586c0')
      setAiColor(localStorage.getItem('papercache-color-ai') || '#10b981')
      setMathColor(localStorage.getItem('papercache-color-math') || '#f59e0b')
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    const handleOpenNote = (e: any) => {
      let path = e.detail.path;
      if (!path.endsWith('.md')) path += '.md';
      
      const index = notesRef.current.findIndex(n => n.id === path);
      if (index !== -1) {
        setCurrentNoteIndex(index);
      } else {
        const newNote = { id: path, content: '', mtime: Date.now() };
        window.electronAPI.saveNote(path, '');
        setNotes(prev => {
          const updated = [newNote, ...prev];
          setCurrentNoteIndex(0);
          return updated;
        });
      }
    };
    window.addEventListener('open-papercache-note', handleOpenNote);
    return () => window.removeEventListener('open-papercache-note', handleOpenNote);
  }, []);

  const activeNote = notes[currentNoteIndex] || { id: '', content: '' }
  const isAuto = /^\d+\.md$/.test(activeNote.id)
  const pathParts = activeNote.id.replace(/\.md$/, '').split('/')
  const fileName = pathParts.pop() || ''
  const displayTitle = isAuto ? (activeNote.content.split('\n')[0].trim() || 'New Note') : fileName

  const startRename = () => {
    setRenameValue(activeNote.id.replace(/\.md$/, ''))
    setIsRenaming(true)
  }

  const handleRenameSubmit = () => {
    setIsRenaming(false)
    if (renameValue && renameValue.trim() && renameValue !== displayTitle) {
      const newId = renameValue.trim() + '.md'
      window.electronAPI.renameNote(activeNote.id, newId)
      const updatedNotes = [...notes]
      updatedNotes[currentNoteIndex].id = newId
      setNotes(updatedNotes)
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  const handleEditorChange = useCallback((val: string, viewUpdate: any) => {
    const updatedNotes = [...notes]
    if (updatedNotes[currentNoteIndex]) {
      updatedNotes[currentNoteIndex].content = val
      setNotes(updatedNotes)
      window.electronAPI.saveNote(activeNote.id, val)
    }

    if (viewUpdate.transactions?.some((tr: any) => tr.docChanged)) {
      let docStr = viewUpdate.state.doc.toString()
      const head = viewUpdate.state.selection.main.head
      const line = viewUpdate.state.doc.lineAt(head)
      
      let modified = false;

      // Build variable scope (incorporate global variables)
      const scope: any = Object.assign({}, (window as any).__globalVariables || {});
      const reVar = /^\/var\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm;
      let match;
      while ((match = reVar.exec(docStr)) !== null) {
        const name = match[1];
        try {
          const val = mathjs.evaluate(match[2], scope);
          scope[name] = val;
        } catch(e) {
          scope[name] = match[2].trim();
        }
      }

      // Check the current active line for new calculation trigger
      if (line.text.endsWith('=')) {
        try {
          const expr = line.text.substring(0, line.text.length - 1).trim()
          if (expr) {
            const result = mathjs.evaluate(expr, scope)
            const newLineText = line.text + '\u200B' + result
            const before = docStr.substring(0, line.from)
            const after = docStr.substring(line.to)
            docStr = before + newLineText + after
            modified = true;
          }
        } catch (e) {}
      }

      // Re-evaluate ALL existing calculations in the document
      // Equation pattern: (expr) = \u200B(result)
      const reCalc = /^(.*?=\s*)\u200B(.*)$/gm;
      let newDocStr = '';
      let lastIndex = 0;
      let calcMatch;
      let calcModified = false;
      while ((calcMatch = reCalc.exec(docStr)) !== null) {
        const exprPart = calcMatch[1];
        const oldResult = calcMatch[2];
        const expr = exprPart.replace(/=$/, '').trim();
        if (expr) {
          try {
            const newResult = String(mathjs.evaluate(expr, scope));
            if (newResult !== oldResult) {
              newDocStr += docStr.substring(lastIndex, calcMatch.index) + exprPart + '\u200B' + newResult;
              lastIndex = reCalc.lastIndex;
              calcModified = true;
              continue;
            }
          } catch(e) {}
        }
      }
      
      if (calcModified) {
        newDocStr += docStr.substring(lastIndex);
        docStr = newDocStr;
        modified = true;
      }

      if (modified) {
        updatedNotes[currentNoteIndex].content = docStr;
        setNotes([...updatedNotes]);
        window.electronAPI.saveNote(activeNote.id, docStr);
      }
    }
  }, [notes, currentNoteIndex, activeNote.id])

  // Sync global variables whenever notes change
  useEffect(() => {
    const globals: any = {};
    const reVar = /^\/globvar\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm;
    notes.forEach(note => {
      let varMatch;
      while ((varMatch = reVar.exec(note.content)) !== null) {
        const name = varMatch[1];
        try {
          globals[name] = mathjs.evaluate(varMatch[2], globals);
        } catch(e) {
          globals[name] = varMatch[2].trim();
        }
      }
    });
    (window as any).__globalVariables = globals;
  }, [notes]);

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMainActionMenu) {
          e.preventDefault(); e.stopPropagation();
          setShowMainActionMenu(false)
          return
        }
        if (showNoteSearch) {
          e.preventDefault(); e.stopPropagation();
          setShowNoteSearch(false)
          return
        }
        if (showGraphView) {
          e.preventDefault(); e.stopPropagation();
          setShowGraphView(false)
          return
        }
      }
      
      // Settings Shortcut
      if (e.key.toLowerCase() === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        window.electronAPI.openSettings()
      }
      
      // Graph View Shortcut
      if (e.key.toLowerCase() === 'g' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowGraphView(prev => !prev)
      }
      
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const id = Date.now() + '.md'
        const newNote = { id, content: '', mtime: Date.now() }
        setNotes(prev => [newNote, ...prev])
        setCurrentNoteIndex(0)
        window.electronAPI.saveNote(id, '')
      }
      
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowNoteSearch(true)
        setNoteSearchQuery('')
        setSearchSelectedIndex(0)
      }

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowMainActionMenu(prev => !prev)
      }

      // Zoom Shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' || e.key === '-')) {
        e.preventDefault()
        setZoomLevel(prev => {
          const newZoom = e.key === '-' ? Math.max(0.5, prev - 0.1) : Math.min(3, prev + 0.1)
          localStorage.setItem('papercache-zoom', newZoom.toString())
          return newZoom
        })
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        setZoomLevel(1)
        localStorage.setItem('papercache-zoom', '1')
      }
    }

    // Sync global shortcut on load
    const shortcut = localStorage.getItem('papercache-shortcut-newnote') || 'CommandOrControl+Shift+N';
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', '', shortcut);
    }
    const toggleShortcut = localStorage.getItem('papercache-shortcut-toggle') || 'CommandOrControl+Shift+C';
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('toggle', '', toggleShortcut);
    }
    
    // Listen for global new note shortcut
    if (window.electronAPI.onTriggerNewNote) {
      window.electronAPI.onTriggerNewNote(() => {
        const id = Date.now() + '.md'
        const initialNote = { id, content: '', mtime: Date.now() }
        setNotes(prev => [initialNote, ...prev])
        window.electronAPI.saveNote(id, '')
        setCurrentNoteIndex(0)
      })
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
  }, [showMainActionMenu, showNoteSearch, showGraphView])

  const containerStyle: any = {
    '--font-family': fontFamily,
    '--text-color': textColor,
    '--custom-color-num': numColor,
    '--custom-color-sym': symColor,
    '--custom-color-ai': aiColor,
    '--custom-color-math': mathColor,
    zoom: zoomLevel,
  }

  if (bgType === 'color') {
    containerStyle['--bg-color'] = bgColor
    containerStyle.backgroundImage = 'none'
  } else if (bgType === 'image' && bgImage) {
    containerStyle.backgroundImage = `url(${bgImage})`
    containerStyle.backgroundSize = 'cover'
    containerStyle.backgroundPosition = 'center'
    containerStyle.backgroundRepeat = 'no-repeat'
  }

  const editorExtensions = useMemo(() => [
    EditorView.lineWrapping,
    Prec.highest(
      keymap.of([
        { key: 'Tab', preventDefault: true, run: insertTab },
        { key: 'Shift-Tab', preventDefault: true, run: indentLess },
        { key: 'Mod-h', run: (view) => {
          const selection = view.state.selection.main;
        if (!selection.empty) {
          const selectedText = view.state.doc.sliceString(selection.from, selection.to);
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: `==${selectedText}==` },
            selection: { anchor: selection.from + 2, head: selection.to + 2 }
          });
          return true;
        }
        return false;
      }},
      { key: 'Enter', run: (view) => {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const lineText = line.text.trim();
        const lowerLine = lineText.toLowerCase();
        if (lowerLine.startsWith('/ai')) {
          const prompt = lineText.substring(3).trim();
          if (!apiKey) {
            const errorText = '\n\u200BError - Set your OpenAI API key in settings\u200C\n';
            view.dispatch({ changes: { from: line.to, insert: errorText } });
            return true;
          }
          
          const thinkingText = '\n\u200B...\u200C\n';
          view.dispatch({ changes: { from: line.to, insert: thinkingText } });
          
          try {
            let finalBaseUrl = apiBaseUrl.trim();
            if (finalBaseUrl.endsWith('/chat/completions')) {
              finalBaseUrl = finalBaseUrl.replace('/chat/completions', '');
            }
            if (finalBaseUrl.endsWith('/')) {
              finalBaseUrl = finalBaseUrl.slice(0, -1);
            }
            
            const openai = new OpenAI({ 
              apiKey: apiKey.trim() || 'dummy', 
              baseURL: finalBaseUrl || undefined, 
              dangerouslyAllowBrowser: true 
            });
            
            const systemContent = aiSystemPrompt.trim();
            const messages: any[] = [];
            if (systemContent) {
              messages.push({ role: "system", content: systemContent });
            }
            messages.push({ role: "user", content: prompt });
            
            openai.chat.completions.create({
              model: apiModel.trim() || 'gpt-4o',
              messages: messages
            }).then(completion => {
              const response = completion.choices[0].message.content;
              const docStr = view.state.doc.toString();
              const finalVal = docStr.replace('\n\u200B...\u200C\n', '\n\u200B' + response + '\u200C\n');
              handleEditorChange(finalVal, {});
            }).catch(error => {
              const docStr = view.state.doc.toString();
              const errorVal = docStr.replace('\n\u200B...\u200C\n', '\n\u200BError - ' + error.message + '\u200C\n');
              handleEditorChange(errorVal, {});
            });
          } catch (err: any) {
            const docStr = view.state.doc.toString();
            const errorVal = docStr.replace('\n\u200B...\u200C\n', '\n\u200BSetup Error - ' + err.message + '\u200C\n');
            handleEditorChange(errorVal, {});
          }
          
          return true;
        }
        return false;
      }}
    ])
    ),
    search({ top: true }),
    markdown(), 
    syntaxHighlighting(mdHighlighting),
    numberPlugin, 
    symbolPlugin, 
    aiPlugin,
    mathPlugin,
    hideMarkdownPlugin,
    EditorView.domEventHandlers({
      mousedown: (event, _view) => {
        const target = event.target as HTMLElement;
        const webLink = target?.closest('.cm-custom-clickable-link');
        const fileLink = target?.closest('.cm-custom-file-link');
        
        if ((webLink || fileLink) && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          if (webLink) {
            const url = webLink.getAttribute('data-url');
            if (url) {
              let finalUrl = url;
              if (!/^https?:\/\//i.test(finalUrl)) {
                finalUrl = 'https://' + finalUrl;
              }
              window.electronAPI.openExternal(finalUrl);
            }
          } else if (fileLink) {
            const path = fileLink.getAttribute('data-path');
            if (path) {
              window.dispatchEvent(new CustomEvent('open-papercache-note', { detail: { path } }));
            }
          }
          return true;
        }
        return false;
      }
    })
  ], [apiKey, apiBaseUrl, apiModel, aiSystemPrompt, handleEditorChange]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (editorRef.current?.view && !editorRef.current.view.hasFocus) {
        editorRef.current.view.focus()
      }
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  const handleAppClick = () => {
    setShowMainActionMenu(false)
    if (editorRef.current?.view && !editorRef.current.view.hasFocus) {
      editorRef.current.view.focus()
    }
  }

  return (
    <div className={`app-container ${themePreset} ${showRulings ? 'show-rulings' : ''}`} style={containerStyle} onClick={handleAppClick}>
      <div className="drag-region">
        {isRenaming ? (
          <input 
            className="rename-input"
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="note-title" onClick={(e) => { e.stopPropagation(); startRename(); }} title="Click to rename">{displayTitle}</span>
        )}
      </div>

      {showNoteSearch && (() => {
        const filteredNotes = notes.filter(n => n.content.toLowerCase().includes(noteSearchQuery.toLowerCase()) || n.id.includes(noteSearchQuery));
        return (
          <div className="note-search-overlay" onClick={() => { setShowNoteSearch(false); setShowNoteActionMenu(false); }} onKeyDown={e => e.stopPropagation()}>
            <div 
              className="note-search-modal" 
              onClick={e => e.stopPropagation()}
              onKeyDown={(e) => {
                if (showNoteActionMenu) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActionMenuIndex(prev => Math.min(prev + 1, 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActionMenuIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const selNote = filteredNotes[searchSelectedIndex];
                    if (!selNote) return;
                    if (actionMenuIndex === 0) {
                      if (selNote.id.startsWith('commands/')) {
                        alert('Files in the commands folder cannot be deleted.');
                        setShowNoteActionMenu(false);
                        return;
                      }
                      if (confirm('Delete this note?')) {
                         window.electronAPI.deleteNote(selNote.id);
                         setNotes(prev => prev.filter(note => note.id !== selNote.id));
                         if (currentNoteIndex >= notes.length - 1) setCurrentNoteIndex(Math.max(0, notes.length - 2));
                         setShowNoteSearch(false);
                         setShowNoteActionMenu(false);
                      }
                    } else if (actionMenuIndex === 1) {
                      const blob = new Blob([selNote.content], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = selNote.id.split('/').pop() || selNote.id;
                      a.click();
                      URL.revokeObjectURL(url);
                      setShowNoteActionMenu(false);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowNoteActionMenu(false);
                  } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    setShowNoteActionMenu(false);
                  }
                  return;
                }

                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSearchSelectedIndex(prev => Math.min(prev + 1, filteredNotes.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSearchSelectedIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (showNoteActionMenu) return;
                  if (filteredNotes.length > 0) {
                    const selNote = filteredNotes[searchSelectedIndex];
                    const idx = notes.findIndex(note => note.id === selNote.id);
                    if (idx !== -1) setCurrentNoteIndex(idx);
                    setShowNoteSearch(false);
                  }
                } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (filteredNotes.length > 0) {
                    setShowNoteActionMenu(true);
                    setActionMenuIndex(0);
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowNoteSearch(false);
                }
              }}
            >
              <input 
                ref={searchInputRef}
                className="note-search-input"
                placeholder="Search notes by content..."
                value={noteSearchQuery}
                onChange={e => {
                  setNoteSearchQuery(e.target.value)
                  setSearchSelectedIndex(0)
                  setShowNoteActionMenu(false)
                }}
              />
              <div className="note-search-list">
                {filteredNotes.map((n, index) => {
                  const isAuto = /^\d+\.md$/.test(n.id)
                  const pathParts = n.id.replace(/\.md$/, '').split('/')
                  const fileName = pathParts.pop() || ''
                  const title = isAuto ? (n.content.split('\n')[0].trim() || 'New Note') : fileName
                  const isSelected = index === searchSelectedIndex;
                  return (
                    <div 
                      key={n.id} 
                      className={`note-search-item ${isSelected ? 'selected' : ''}`}
                      onMouseEnter={() => setSearchSelectedIndex(index)}
                      onClick={() => {
                        const idx = notes.findIndex(note => note.id === n.id)
                        if (idx !== -1) setCurrentNoteIndex(idx)
                        setShowNoteSearch(false)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSearchSelectedIndex(index);
                        setShowNoteActionMenu(true);
                        setActionMenuIndex(0);
                      }}
                    >
                      <div className="ns-left">
                        <span className="ns-title">{title}</span>
                        {pathParts.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getFolderColor(pathParts[0]) }} />
                            <span className="ns-folder">{pathParts.join(' / ')}</span>
                          </div>
                        )}
                      </div>
                      <span className="ns-date">{new Date(n.mtime).toLocaleDateString()}</span>
                      
                      {isSelected && showNoteActionMenu && (
                        <div className="note-action-menu" onClick={e => e.stopPropagation()}>
                          <button className={actionMenuIndex === 0 ? 'focused' : ''} onClick={(e) => {
                            e.stopPropagation();
                            if (n.id.startsWith('commands/')) {
                              alert('Files in the commands folder cannot be deleted.');
                              setShowNoteActionMenu(false);
                              return;
                            }
                            if (confirm('Delete this note?')) {
                               window.electronAPI.deleteNote(n.id);
                               setNotes(prev => prev.filter(note => note.id !== n.id));
                               if (currentNoteIndex >= notes.length - 1) setCurrentNoteIndex(Math.max(0, notes.length - 2));
                               setShowNoteSearch(false);
                               setShowNoteActionMenu(false);
                            }
                          }}>Delete</button>
                          <button className={actionMenuIndex === 1 ? 'focused' : ''} onClick={(e) => {
                            e.stopPropagation();
                            const blob = new Blob([n.content], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = n.id.split('/').pop() || n.id;
                            a.click();
                            URL.revokeObjectURL(url);
                            setShowNoteActionMenu(false);
                          }}>Export</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {showMainActionMenu && (
        <div style={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            gap: 12,
            padding: 12,
            background: bgType === 'color' ? bgColor : 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(128, 128, 128, 0.2)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            fontFamily: fontFamily
          }}>
           <button onClick={() => window.electronAPI.openSettings()} style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', fontSize: 14 }}>Settings</button>
           <button onClick={() => setShowNoteSearch(true)} style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', fontSize: 14 }}>Search</button>
           <button onClick={() => setShowGraphView(true)} style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', fontSize: 14 }}>Graph View</button>
           <button onClick={() => {
             const note = notes[currentNoteIndex];
             if (note) {
               const filename = note.id.split('/').pop() || 'note.md';
               window.electronAPI.exportNote(filename, note.content);
             }
           }} style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', fontSize: 14 }}>Export</button>
        </div>
      )}

      {showGraphView && (
        <GraphView
          notes={notes}
          onClose={() => setShowGraphView(false)}
          textColor={textColor}
          bgColor={bgColor}
          accentColor={numColor}
          onNodeClick={(nodeId) => {
            const index = notes.findIndex(n => n.id === nodeId);
            if (index !== -1) {
              setCurrentNoteIndex(index);
              setShowGraphView(false);
            }
          }}
        />
      )}

      <div className="editor-container">
        <CodeMirror
          ref={editorRef}
          value={activeNote.content}
          onChange={handleEditorChange}
          extensions={editorExtensions}
          theme={themePreset === 'grid-dark' || themePreset === 'blueprint' ? 'dark' : 'light'}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            highlightSpecialChars: false
          }}
        />
      </div>
    </div>
  )
}

export default App
