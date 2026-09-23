import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SensorNode, LayerConfig } from '../types'
import { useTheme } from '../context/ThemeContext'

const PANEL1_PILLARS = [
  { x: 130, y: 165 }, { x: 162, y: 165 }, { x: 194, y: 165 }, { x: 226, y: 165 },
  { x: 130, y: 198 }, { x: 162, y: 198 }, { x: 194, y: 198 }, { x: 226, y: 198 },
  { x: 130, y: 231 }, { x: 162, y: 231 }, { x: 194, y: 231 }, { x: 226, y: 231 },
  { x: 130, y: 264 }, { x: 162, y: 264 }, { x: 194, y: 264 },
]

const PANEL2_PILLARS = [
  { x: 410, y: 130 }, { x: 450, y: 130 }, { x: 490, y: 130 }, { x: 530, y: 130 }, { x: 570, y: 130 }, { x: 610, y: 130 },
  { x: 410, y: 164 }, { x: 450, y: 164 }, { x: 490, y: 164 }, { x: 530, y: 164 }, { x: 570, y: 164 }, { x: 610, y: 164 },
  { x: 410, y: 198 }, { x: 450, y: 198 }, { x: 490, y: 198 }, { x: 530, y: 198 }, { x: 570, y: 198 }, { x: 610, y: 198 },
  { x: 410, y: 232 }, { x: 450, y: 232 }, { x: 490, y: 232 }, { x: 530, y: 232 }, { x: 570, y: 232 },
  { x: 410, y: 266 }, { x: 450, y: 266 }, { x: 490, y: 266 }, { x: 530, y: 266 },
]

const MAP_CENTER: L.LatLngExpression = [23.7405, 86.4205]
const MAP_BOUNDS = { west: 86.39, east: 86.45, south: 23.715, north: 23.765 }

interface Props {
  nodes: SensorNode[]
  selectedNode: number | null
  onSelectNode: (id: number) => void
  activePanel: string
}

function toLatLng(x = 0, y = 0): [number, number] {
  const clampedX = Math.max(0, Math.min(800, x))
  const clampedY = Math.max(0, Math.min(360, y))
  return [
    MAP_BOUNDS.north - (clampedY / 360) * (MAP_BOUNDS.north - MAP_BOUNDS.south),
    MAP_BOUNDS.west + (clampedX / 800) * (MAP_BOUNDS.east - MAP_BOUNDS.west),
  ]
}

function toPixelBounds(x: number, y: number, width: number, height: number): L.LatLngBoundsExpression {
  return [toLatLng(x - width / 2, y + height / 2), toLatLng(x + width / 2, y - height / 2)]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatMetric(value: number | null | undefined, suffix = ''): string {
  return value == null ? '—' : `${value}${suffix}`
}

export default function GISMap({ nodes, selectedNode, onSelectNode, activePanel }: Props) {
  const { colors } = useTheme()
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)
  const [layers, setLayers] = useState<LayerConfig>({ heatmap: true, pillars: true, vectors: true, grid: true })

  const RISK_COLOR: Record<string, string> = {
    LOW: colors.riskLow,
    MEDIUM: colors.riskMedium,
    HIGH: colors.riskHigh,
  }

  useEffect(() => {
    if (!mapElementRef.current) return

    if (!mapRef.current) {
      const map = L.map(mapElementRef.current, {
        center: MAP_CENTER,
        zoom: 14,
        minZoom: 12,
        maxZoom: 19,
        zoomControl: false,
        attributionControl: true,
      })

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapRef.current = map
      overlayRef.current = L.layerGroup().addTo(map)
    }

    const map = mapRef.current
    const overlay = overlayRef.current
    if (!map || !overlay) return

    map.invalidateSize()
    overlay.clearLayers()
    const p1Active = activePanel === 'All' || activePanel === 'Panel 1'
    const p2Active = activePanel === 'All' || activePanel === 'Panel 2'
    const add = (layer: L.Layer) => overlay.addLayer(layer)

    if (layers.grid) {
      for (const x of [0, 160, 320, 480, 640, 800]) {
        add(L.polyline([toLatLng(x, 0), toLatLng(x, 360)], {
          color: '#dce7ea', opacity: 0.38, weight: 1, dashArray: '3 7', interactive: false,
        }))
      }
      for (const y of [0, 90, 180, 270, 360]) {
        add(L.polyline([toLatLng(0, y), toLatLng(800, y)], {
          color: '#dce7ea', opacity: 0.38, weight: 1, dashArray: '3 7', interactive: false,
        }))
      }
      for (const [index, x] of [0, 160, 320, 480, 640, 800].entries()) {
        add(L.marker(toLatLng(x, 352), {
          icon: L.divIcon({ className: 'sensora-map-coordinate', html: `E${562000 + index * 200}`, iconAnchor: [0, 0] }),
          interactive: false,
        }))
      }
      for (const [index, y] of [0, 90, 180, 270].entries()) {
        add(L.marker(toLatLng(4, y), {
          icon: L.divIcon({ className: 'sensora-map-coordinate', html: `N${2340 + (3 - index) * 100}`, iconAnchor: [0, 0] }),
          interactive: false,
        }))
      }
    }

    add(L.polygon([
      toLatLng(78, 88), toLatLng(294, 70), toLatLng(318, 295), toLatLng(93, 310),
    ], {
      color: p1Active ? colors.accent : '#dce7ea',
      weight: p1Active ? 2 : 1,
      dashArray: '9 5',
      fillColor: colors.accent,
      fillOpacity: p1Active ? 0.12 : 0.03,
    }))
    add(L.polygon([
      toLatLng(365, 70), toLatLng(648, 58), toLatLng(670, 312), toLatLng(384, 322),
    ], {
      color: p2Active ? RISK_COLOR.HIGH : '#dce7ea',
      weight: p2Active ? 2 : 1,
      dashArray: '9 5',
      fillColor: RISK_COLOR.HIGH,
      fillOpacity: p2Active ? 0.12 : 0.03,
    }))

    const addPanelLabel = (point: [number, number], title: string, subtitle: string, color: string) => {
      add(L.marker(point, {
        icon: L.divIcon({
          className: 'sensora-panel-label',
          html: `<strong style="color:${color}">${title}</strong><span>${subtitle}</span>`,
          iconAnchor: [0, 0],
        }),
        interactive: false,
      }))
    }
    addPanelLabel(toLatLng(155, 64), 'Panel 1', 'DEPILLARED · 36 mo · LOW RISK', p1Active ? colors.accent : colors.textMuted)
    addPanelLabel(toLatLng(488, 52), 'Panel 2', 'DEPILLARED · 18 mo · HIGH RISK', p2Active ? RISK_COLOR.HIGH : colors.textMuted)

    if (layers.heatmap) {
      for (const [radius, opacity] of [[1050, 0.055], [720, 0.08], [410, 0.11]] as const) {
        add(L.circle(toLatLng(518, 192), {
          radius, color: RISK_COLOR.HIGH, weight: 0, fillColor: RISK_COLOR.HIGH, fillOpacity: opacity, interactive: false,
        }))
      }
      for (const [radius, opacity] of [[660, 0.04], [410, 0.075]] as const) {
        add(L.circle(toLatLng(186, 210), {
          radius, color: RISK_COLOR.MEDIUM, weight: 0, fillColor: RISK_COLOR.MEDIUM, fillOpacity: opacity, interactive: false,
        }))
      }
    }

    if (layers.pillars) {
      PANEL1_PILLARS.forEach(pillar => add(L.rectangle(toPixelBounds(pillar.x, pillar.y, 24, 18), {
        color: RISK_COLOR.LOW, weight: 1, opacity: p1Active ? 0.8 : 0.2, fill: false,
        dashArray: '3 2', interactive: false, className: `sensora-pillar ${p1Active ? '' : 'is-muted'}`,
      })))
      PANEL2_PILLARS.forEach((pillar, index) => add(L.rectangle(toPixelBounds(pillar.x, pillar.y, 24, 18), {
        color: index < 18 ? RISK_COLOR.HIGH : RISK_COLOR.MEDIUM, weight: 1, opacity: p2Active ? 0.85 : 0.2,
        fill: false, dashArray: '3 2', interactive: false, className: `sensora-pillar ${p2Active ? '' : 'is-muted'}`,
      })))
    }

    if (layers.vectors) {
      nodes.filter(node => node.risk !== 'LOW' && node.displacement != null).forEach(node => {
        const active = activePanel === 'All' || node.panel === activePanel
        const displacement = node.displacement || 0
        const start = toLatLng(node.gisX, node.gisY)
        const end = toLatLng(node.gisX + displacement * 0.28, node.gisY + displacement * 0.22)
        add(L.polyline([start, end], {
          color: RISK_COLOR[node.risk], weight: 3, opacity: active ? 0.95 : 0.18, dashArray: '7 4', interactive: false,
        }))
        add(L.circleMarker(end, {
          radius: 3, color: RISK_COLOR[node.risk], fillColor: RISK_COLOR[node.risk],
          fillOpacity: active ? 1 : 0.2, weight: 1, interactive: false,
        }))
      })
    }

    nodes.forEach(node => {
      const isActivePanel = activePanel === 'All' || node.panel === activePanel
      const isSelected = selectedNode === node.id
      const color = RISK_COLOR[node.risk]
      const marker = L.marker(toLatLng(node.gisX, node.gisY), {
        icon: L.divIcon({
          className: 'sensora-node-icon',
          html: `<span class="sensora-node-dot" style="--node-color:${color};--node-size:${isSelected ? 16 : 12}px"></span><span class="sensora-node-label">${escapeHtml(node.label)}</span>`,
          iconSize: [130, 24],
          iconAnchor: [7, 12],
        }),
        opacity: isActivePanel ? 1 : 0.2,
        title: node.label,
      })

      marker.bindTooltip([
        `<strong>${escapeHtml(node.label)} · ${escapeHtml(node.panel)} (${node.status.toUpperCase()})</strong>`,
        `Risk: ${node.risk} · Tilt: ${formatMetric(node.tilt, '°')}`,
        `Vib: ${formatMetric(node.vibration)} · Soil: ${formatMetric(node.soilMoisture, '%')} · Temp: ${formatMetric(node.temp, '°C')}`,
        `Updated: ${node.lastUpdate ?? 0}s ago`,
      ].join('<br />'), {
        direction: 'top', offset: [0, -10], className: 'sensora-node-tooltip', opacity: isActivePanel ? 1 : 0.5,
      })
      marker.on('click', () => {
        if (isActivePanel) onSelectNode(node.id)
      })
      add(marker)
    })

    const selected = nodes.find(node => node.id === selectedNode)
    if (selected && (activePanel === 'All' || selected.panel === activePanel)) {
      map.panTo(toLatLng(selected.gisX, selected.gisY), { animate: false })
    }
  }, [activePanel, colors, layers, nodes, onSelectNode, selectedNode])

  useEffect(() => () => {
    mapRef.current?.remove()
    mapRef.current = null
    overlayRef.current = null
  }, [])

  return (
    <div className="flex flex-col h-full rounded-md overflow-hidden" style={{
      background: colors.bgCanvas, border: `1px solid ${colors.borderPrimary}`, boxShadow: colors.shadowSm,
    }}>
      <div className="flex flex-wrap items-center justify-between px-3 py-2 shrink-0 gap-2" style={{
        borderBottom: `1px solid ${colors.borderPrimary}`, background: colors.bgCardSubtle,
      }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif', color: colors.accent }}>GIS MAP</span>
          <span style={{ color: colors.textMuted, fontSize: '10px' }}>—</span>
          <span style={{ color: colors.textMuted, fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px' }}>{activePanel} · Satellite & Sensors</span>
          {activePanel !== 'All' && <span style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', fontWeight: 600,
            color: colors.accent, background: colors.accentBg, border: `1px solid ${colors.accentBorder}`,
            padding: '1px 6px', borderRadius: '3px',
          }}>FILTER: {activePanel}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {(['heatmap', 'pillars', 'vectors', 'grid'] as (keyof LayerConfig)[]).map(key => (
            <label key={key} className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" checked={layers[key]} onChange={() => setLayers(previous => ({ ...previous, [key]: !previous[key] }))} className="w-3 h-3" style={{ accentColor: colors.accent }} />
              <span className="text-[10px] capitalize font-medium" style={{ color: colors.textSecondary, fontFamily: 'IBM Plex Mono, monospace' }}>{key}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={mapElementRef} className="sensora-leaflet-map absolute inset-0" />
        <div className="absolute left-3 bottom-3 z-[500] rounded-md border border-white/40 bg-slate-950/75 px-2.5 py-1.5 text-[9px] font-mono text-white shadow-lg pointer-events-none">
          <div className="font-bold tracking-wider text-emerald-300">SATELLITE · JHARIA COALFIELD</div>
          <div className="mt-0.5 text-white/70">WORLD IMAGERY · UTM ZONE 44N · WGS84</div>
        </div>
      </div>
    </div>
  )
}