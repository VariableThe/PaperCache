import { useMemo, useCallback, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

import { getFolderColor } from './utils'

interface GraphViewProps {
  notes: { id: string; content: string; mtime: number }[]
  onClose: () => void
  onNodeClick: (nodeId: string) => void
  textColor: string
  bgColor: string
  accentColor: string
}

export default function GraphView({
  notes,
  onClose,
  onNodeClick,
  textColor,
  bgColor,
  accentColor,
}: GraphViewProps) {
  // Parse links
  const graphData = useMemo(() => {
    const nodes = notes.map((n) => {
      const isAuto = /^\d+\.md$/.test(n.id)
      let title = n.id.replace(/\.md$/, '')
      const folder = n.id.includes('/') ? n.id.split('/')[0] : ''

      if (isAuto) {
        title =
          n.content
            .split('\n')[0]
            .trim()
            .replace(/^#+\s*/, '') || 'New Note'
      }
      return { id: n.id, name: title, val: 1, folder }
    })

    const links: { source: string; target: string }[] = []
    const nodeIds = new Set(nodes.map((n) => n.id))

    notes.forEach((note) => {
      // Find links like `](/file id)` or `](/file id.md)`
      const re = /\]\(\/file\s+([^)]+)\)/g
      let match
      while ((match = re.exec(note.content)) !== null) {
        let targetId = match[1]
        if (!targetId.endsWith('.md')) targetId += '.md'

        // Only add link if target exists
        if (nodeIds.has(targetId)) {
          links.push({
            source: note.id,
            target: targetId,
          })
        }
      }
    })

    return { nodes, links }
  }, [notes])

  const handleNodeClick = useCallback(
    (node: { id: string; name: string; val: number; folder: string }) => {
      onNodeClick(node.id)
    },
    [onNodeClick]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: bgColor,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${textColor}22`,
        }}
      >
        <h2 style={{ margin: 0, color: textColor, fontWeight: 700, fontFamily: 'inherit' }}>
          Graph View
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: textColor,
            cursor: 'pointer',
            fontSize: '14px',
            opacity: 0.7,
            fontFamily: 'inherit',
          }}
        >
          Close (Esc)
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="name"
          nodeColor={() => accentColor}
          linkColor={() => `${textColor}44`}
          backgroundColor={bgColor}
          onNodeClick={handleNodeClick}
          nodeRelSize={6}
          linkWidth={2}
          nodeCanvasObject={(
            node: { id: string; name: string; val: number; folder: string; x?: number; y?: number },
            ctx,
            globalScale
          ) => {
            const label = node.name
            const fontSize = 12 / globalScale
            ctx.font = `${fontSize}px Sans-Serif`

            ctx.beginPath()
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false)
            ctx.fillStyle = node.folder ? getFolderColor(node.folder) : accentColor
            ctx.fill()

            if (globalScale >= 1.5) {
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = textColor
              ctx.fillText(label, node.x as number, (node.y as number) + 10)
            }
          }}
        />
      </div>
    </div>
  )
}
