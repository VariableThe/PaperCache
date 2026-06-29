import { useMemo, useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import * as THREE from 'three'
import * as d3 from 'd3-force'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { getFolderColor } from './utils'

const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

const FOLDER_CENTROID_RADIUS = 60
const CAMERA_Z_POSITION = 500
const ZOOM_TO_FIT_DURATION_MS = 400
const ZOOM_TO_FIT_PADDING = 50
const ZOOM_TO_FIT_DELAY_MS = 300
const FORCE_CHARGE_STRENGTH = -120
const COLLISION_RADIUS = 22
const FOLDER_ATTRACTION_STRENGTH = 0.008
const MAX_ATTEMPTS = 20
const ATTEMPT_INTERVAL_MS = 50
const GRAPH_Z_INDEX = 1000
const LABEL_CANVAS_WIDTH = 256
const LABEL_CANVAS_HEIGHT = 64
const LABEL_SPRITE_SCALE_X = 36
const LABEL_SPRITE_SCALE_Y = 9
const LABEL_SPRITE_SCALE_Z = 1
const NODE_REL_SIZE = 6
const LINK_WIDTH = 1.5
const LINK_OPACITY = 0.6
const FOCUS_CAMERA_Z = 120
const FOCUS_ANIMATION_DURATION_MS = 400
const NODE_RADIUS = 12
const LABEL_FONT_SIZE = 20
const MAX_NAME_LENGTH = 20

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
  const radius = FOLDER_CENTROID_RADIUS
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
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>(null)

  const draggedNodesRef = useRef<Set<string>>(new Set())
  const graphDataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })

  interface GraphControls {
    enableRotate: boolean
    enablePan: boolean
    enableZoom: boolean
    mouseButtons: Record<string, number | null>
    touches: Record<string, number>
    zoomSpeed: number
    panSpeed: number
    update: () => void
  }

  useEffect(() => {
    let raf: number
    let ctrls: GraphControls | null = null
    const setup = () => {
      const fg = fgRef.current
      if (!fg || typeof fg.controls !== 'function') {
        raf = requestAnimationFrame(setup)
        return
      }
      ctrls = fg.controls() as GraphControls
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
      if (typeof fg.cameraPosition === 'function') {
        fg.cameraPosition({ x: 0, y: 0, z: CAMERA_Z_POSITION })
      }
      setTimeout(() => {
        if (fg && typeof fg.zoomToFit === 'function')
          fg.zoomToFit(ZOOM_TO_FIT_DURATION_MS, ZOOM_TO_FIT_PADDING)
      }, ZOOM_TO_FIT_DELAY_MS)
    }
    raf = requestAnimationFrame(setup)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const fg = fgRef.current
    return () => {
      const data = fg && typeof fg.graphData === 'function' ? fg.graphData() : graphDataRef.current
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
      const folder = n.id.includes('/') ? n.id.split('/')[0]! : ''

      if (isAuto) {
        title =
          n.content
            .split('\n')[0]!
            .trim()
            .replace(/^#+\s*/, '') || 'New Note'
      }
      const cached = nodePositionsCache.get(n.id)
      return { id: n.id, name: title, val: 1, folder, x: cached?.x, y: cached?.y }
    })

    const links: GraphLink[] = []
    const nodeIds = new Set(nodes.map((n) => n.id))

    notes.forEach((note) => {
      const targets = new Set<string>()

      const reFile = /\]\(\/file\s+([^)]+)\)/g
      let match
      while ((match = reFile.exec(note.content)) !== null) {
        let targetId = match[1]!.trim().replace(/\\/g, '/')
        if (!targetId.endsWith('.md')) targetId += '.md'
        targets.add(targetId)
      }

      const reMd = /\]\(([^)]+\.md)\)/g
      while ((match = reMd.exec(note.content)) !== null) {
        let targetId = match[1]!.trim().replace(/\\/g, '/')
        if (targetId.startsWith('./')) targetId = targetId.slice(2)
        if (targetId.startsWith('/')) targetId = targetId.slice(1)
        targets.add(targetId)
      }

      const reWiki = /\[\[([^\]]+)\]\]/g
      while ((match = reWiki.exec(note.content)) !== null) {
        let targetId = match[1]!.split('|')[0]!.trim().replace(/\\/g, '/')
        if (!targetId.endsWith('.md')) targetId += '.md'
        targets.add(targetId)
      }

      targets.forEach((targetId) => {
        if (nodeIds.has(targetId) && targetId !== note.id) {
          links.push({ source: note.id, target: targetId })
        }
      })
    })

    return { nodes, links }
  }, [notes])

  useEffect(() => {
    graphDataRef.current = graphData
  }, [graphData])

  useEffect(() => {
    let attempts = 0
    let timeoutId: number | null = null

    const attemptForceSetup = () => {
      const fg = fgRef.current
      if (!fg || typeof fg.d3Force !== 'function') {
        attempts++
        if (attempts <= MAX_ATTEMPTS) {
          timeoutId = window.setTimeout(attemptForceSetup, ATTEMPT_INTERVAL_MS)
        }
        return
      }

      const folders = Array.from(new Set(graphData.nodes.map((n) => n.folder).filter(Boolean)))
      const centroids = buildFolderCentroids(folders)

      fg.d3Force('centerX', d3.forceX<GraphNode>(0).strength(FOLDER_ATTRACTION_STRENGTH))
      fg.d3Force('centerY', d3.forceY<GraphNode>(0).strength(FOLDER_ATTRACTION_STRENGTH))
      fg.d3Force(
        'folderX',
        d3
          .forceX<GraphNode>((node) => {
            const c = centroids.get(node.folder)
            return c ? c.cx : 0
          })
          .strength((node) =>
            node.folder && !draggedNodesRef.current.has(node.id) ? FOLDER_ATTRACTION_STRENGTH : 0
          )
      )
      fg.d3Force(
        'folderY',
        d3
          .forceY<GraphNode>((node) => {
            const c = centroids.get(node.folder)
            return c ? c.cy : 0
          })
          .strength((node) =>
            node.folder && !draggedNodesRef.current.has(node.id) ? FOLDER_ATTRACTION_STRENGTH : 0
          )
      )
      fg.d3Force('charge')?.strength(FORCE_CHARGE_STRENGTH)
      fg.d3Force('collision', d3.forceCollide<GraphNode>(COLLISION_RADIUS))
      if (typeof fg.d3ReheatSimulation === 'function') {
        fg.d3ReheatSimulation()
      }
    }

    timeoutId = window.setTimeout(attemptForceSetup, ATTEMPT_INTERVAL_MS)
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
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
    if (!fg || typeof fg.graphData !== 'function' || typeof fg.cameraPosition !== 'function') return
    const node = fg.graphData()?.nodes?.find((n: GraphNode) => n.id === nodeId)
    if (!node || node.x == null || node.y == null) return
    fg.cameraPosition(
      { x: node.x, y: node.y, z: FOCUS_CAMERA_Z },
      { x: node.x, y: node.y, z: 0 },
      FOCUS_ANIMATION_DURATION_MS
    )
  }, [])

  const nodeThreeObject = useCallback(
    (node: object) => {
      const gNode = node as GraphNode
      const color = gNode.folder ? getFolderColor(gNode.folder) : accentColor
      const group = new THREE.Group()

      const geometry = new THREE.CircleGeometry(NODE_RADIUS, 32)
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      const circle = new THREE.Mesh(geometry, material)
      circle.position.z = 1
      group.add(circle)

      const canvas = document.createElement('canvas')
      canvas.width = LABEL_CANVAS_WIDTH
      canvas.height = LABEL_CANVAS_HEIGHT
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 256, 64)
      const displayName =
        gNode.name.length > MAX_NAME_LENGTH
          ? gNode.name.slice(0, MAX_NAME_LENGTH - 3) + '…'
          : gNode.name
      ctx.fillStyle = textColor
      ctx.font = `bold ${LABEL_FONT_SIZE}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayName, LABEL_CANVAS_WIDTH / 2, LABEL_CANVAS_HEIGHT / 2)
      const tex = new THREE.CanvasTexture(canvas)
      const labelMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
      const label = new THREE.Sprite(labelMat)
      label.scale.set(LABEL_SPRITE_SCALE_X, LABEL_SPRITE_SCALE_Y, LABEL_SPRITE_SCALE_Z)
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
          zIndex: GRAPH_Z_INDEX,
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
              ref={fgRef as never}
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
              onNodeClick={(node: object) => handleNodeClick(node as GraphNode)}
              onNodeDragEnd={(node: object) => handleNodeDragEnd(node as GraphNode)}
              nodeThreeObject={nodeThreeObject}
              nodeRelSize={NODE_REL_SIZE}
              linkWidth={LINK_WIDTH}
              linkOpacity={LINK_OPACITY}
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
