import { useMemo, useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import * as THREE from 'three'
import * as d3 from 'd3-force'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { getFolderColor } from './utils'

const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

const nodePositionsCache = new Map<string, { x: number; y: number }>()

interface GraphViewProps {
  notes: { id: string; content: string; mtime: number }[]
  onClose: () => void
  onNodeClick: (nodeId: string) => void
  textColor: string
  bgColor: string
  accentColor: string
}

interface GraphNode {
  id: string
  name: string
  val: number
  folder: string
  x?: number
  y?: number
  z?: number
}

interface GraphLink {
  source: string
  target: string
}

function buildFolderCentroids(folderNames: string[]): Map<string, { cx: number; cy: number }> {
  const centroids = new Map<string, { cx: number; cy: number }>()
  const n = folderNames.length
  if (n === 0) return centroids
  const radius = 60
  folderNames.forEach((folder, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    centroids.set(folder, {
      cx: radius * Math.cos(angle),
      cy: radius * Math.sin(angle),
    })
  })
  return centroids
}

declare module 'react-force-graph-3d' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ForceGraphMethods<NodeType = {}, LinkType = {}> {
    graphData(): { nodes: NodeType[]; links: LinkType[] }
  }
}

export default function GraphView({
  notes,
  onClose,
  onNodeClick,
  textColor,
  bgColor,
  accentColor,
}: GraphViewProps) {
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined)

  const draggedNodesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let raf: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ctrls: any = null
    const setup = () => {
      const fg = fgRef.current
      if (!fg) {
        raf = requestAnimationFrame(setup)
        return
      }
      ctrls = fg.controls()
      if (!ctrls) {
        raf = requestAnimationFrame(setup)
        return
      }
      ctrls.enableRotate = false
      ctrls.enablePan = true
      ctrls.enableZoom = true
      ctrls.mouseButtons = { LEFT: 2, MIDDLE: 1, RIGHT: null }
      ctrls.touches = { ONE: 1, TWO: 2 }
      ctrls.zoomSpeed = 6
      ctrls.panSpeed = 0.15
      ctrls.update()
      fg.cameraPosition({ x: 0, y: 0, z: 500 })
      setTimeout(() => fg.zoomToFit(400, 50), 300)
    }
    raf = requestAnimationFrame(setup)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    // Snapshot ref at effect-run time so the cleanup reads a stable value
    // (avoids the react-hooks/exhaustive-deps stale-ref warning)
    const fg = fgRef.current
    return () => {
      if (!fg) return
      const data = fg.graphData()
      if (!data || !data.nodes) return
      data.nodes.forEach((node: GraphNode) => {
        if (node.x != null && node.y != null) {
          nodePositionsCache.set(node.id, { x: node.x, y: node.y })
        }
      })
    }
  }, [])

  const handleNodeDragEnd = useCallback((node: GraphNode) => {
    draggedNodesRef.current.add(node.id)
  }, [])

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = notes.map((n) => {
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
      const cached = nodePositionsCache.get(n.id)
      return { id: n.id, name: title, val: 1, folder, x: cached?.x, y: cached?.y }
    })

    const links: GraphLink[] = []
    const nodeIds = new Set(nodes.map((n) => n.id))

    notes.forEach((note) => {
      const re = /\]\(\/file\s+([^)]+)\)/g
      let match
      while ((match = re.exec(note.content)) !== null) {
        let targetId = match[1]
        if (!targetId.endsWith('.md')) targetId += '.md'
        if (nodeIds.has(targetId)) {
          links.push({ source: note.id, target: targetId })
        }
      }
    })

    return { nodes, links }
  }, [notes])

  useEffect(() => {
    let attempts = 0
    const id = setInterval(() => {
      const fg = fgRef.current
      if (!fg) {
        attempts++
        if (attempts > 20) clearInterval(id)
        return
      }
      clearInterval(id)

      const folders = Array.from(new Set(graphData.nodes.map((n) => n.folder).filter(Boolean)))
      const centroids = buildFolderCentroids(folders)

      fg.d3Force('centerX', d3.forceX<GraphNode>(0).strength(0.008))
      fg.d3Force('centerY', d3.forceY<GraphNode>(0).strength(0.008))
      fg.d3Force(
        'folderX',
        d3
          .forceX<GraphNode>((node) => {
            const c = centroids.get(node.folder)
            return c ? c.cx : 0
          })
          .strength((node) => (node.folder && !draggedNodesRef.current.has(node.id) ? 0.008 : 0))
      )
      fg.d3Force(
        'folderY',
        d3
          .forceY<GraphNode>((node) => {
            const c = centroids.get(node.folder)
            return c ? c.cy : 0
          })
          .strength((node) => (node.folder && !draggedNodesRef.current.has(node.id) ? 0.008 : 0))
      )
      fg.d3Force('charge')?.strength(-120)
      fg.d3Force('collision', d3.forceCollide<GraphNode>(22))
      fg.d3ReheatSimulation()
    }, 50)
    return () => clearInterval(id)
  }, [graphData])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick(node.id)
    },
    [onNodeClick]
  )

  // Search
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const searchResults = useMemo(() => {
    if (!showSearch) return []
    return graphData.nodes.filter((n) => fuzzyMatch(n.name, searchQuery))
  }, [searchQuery, showSearch, graphData.nodes])

  const focusOnNode = useCallback((nodeId: string) => {
    const fg = fgRef.current
    if (!fg) return
    const node = fg.graphData().nodes.find((n: GraphNode) => n.id === nodeId)
    if (!node || node.x == null || node.y == null) return
    fg.cameraPosition({ x: node.x, y: node.y, z: 120 }, { x: node.x, y: node.y, z: 0 }, 400)
  }, [])

  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const color = node.folder ? getFolderColor(node.folder) : accentColor
      const group = new THREE.Group()

      const geometry = new THREE.CircleGeometry(12, 32)
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      const circle = new THREE.Mesh(geometry, material)
      circle.position.z = 1
      group.add(circle)

      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 256, 64)
      const displayName = node.name.length > 20 ? node.name.slice(0, 17) + '…' : node.name
      ctx.fillStyle = textColor
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayName, 128, 32)
      const tex = new THREE.CanvasTexture(canvas)
      const labelMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
      const label = new THREE.Sprite(labelMat)
      label.scale.set(36, 9, 1)
      label.position.set(0, -15, 0)
      label.renderOrder = 2
      group.add(label)

      return group
    },
    [accentColor, textColor]
  )

  function fuzzyMatch(text: string, query: string): boolean {
    const t = text.toLowerCase()
    const q = query.toLowerCase().trim()
    if (!q) return false
    let qi = 0
    for (const ch of t) {
      if (ch === q[qi]) qi++
      if (qi === q.length) return true
    }
    return false
  }

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSearchIndex((i) => Math.min(i + 1, searchResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSearchIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && searchResults[searchIndex]) {
        const node = searchResults[searchIndex]
        focusOnNode(node.id)
      }
    },
    [searchResults, searchIndex, focusOnNode]
  )

  useEffect(() => {
    if (showSearch && searchRef.current) searchRef.current.focus()
  }, [showSearch])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      } else if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false)
          setSearchQuery('')
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showSearch])

  return (
    <>
      <style>{`@keyframes graph-fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
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
          animation: 'graph-fade-in 0.25s ease',
        }}
      >
        <div
          style={{
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${textColor}22`,
            position: 'relative',
            zIndex: 2,
            gap: 12,
          }}
        >
          {showSearch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search notes…"
                style={{
                  flex: 1,
                  background: `${textColor}11`,
                  border: `1px solid ${textColor}33`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: textColor,
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: 12, color: textColor, opacity: 0.5, whiteSpace: 'nowrap' }}>
                {searchResults.length > 0
                  ? `${searchIndex + 1}/${searchResults.length}`
                  : searchQuery
                    ? '0 matches'
                    : ''}
              </span>
            </div>
          ) : (
            <h2 style={{ margin: 0, color: textColor, fontWeight: 700, fontFamily: 'inherit' }}>
              Graph View
              <sup
                style={{
                  fontSize: 10,
                  marginLeft: 6,
                  opacity: 0.45,
                  fontWeight: 400,
                  verticalAlign: 'super',
                }}
              >
                WebGL
              </sup>
            </h2>
          )}
          <button
            onClick={() => {
              if (showSearch) {
                setShowSearch(false)
                setSearchQuery('')
              } else {
                onClose()
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: textColor,
              cursor: 'pointer',
              fontSize: '14px',
              opacity: 0.7,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {showSearch ? 'Esc' : 'Close (Esc)'}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense
            fallback={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: textColor,
                  opacity: 0.5,
                }}
              >
                Loading graph…
              </div>
            }
          >
            <ForceGraph3D
              ref={fgRef}
              graphData={graphData}
              numDimensions={2}
              nodeLabel="name"
              nodeColor={(node) =>
                (node as GraphNode).folder
                  ? getFolderColor((node as GraphNode).folder)
                  : accentColor
              }
              linkColor={() => `${textColor}55`}
              backgroundColor={bgColor}
              onNodeClick={handleNodeClick as (node: object) => void}
              onNodeDragEnd={handleNodeDragEnd as (node: object) => void}
              nodeThreeObject={nodeThreeObject}
              nodeRelSize={6}
              linkWidth={1.5}
              linkOpacity={0.6}
              enableNodeDrag={true}
              enableNavigationControls={true}
              showNavInfo={false}
            />
          </Suspense>
        </div>
      </div>
    </>
  )
}
