/**
 * 书籍默认封面图案
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import React from "react"

export interface BookCoverPalette {
  bg: string
  surface: string
  accent: string
  accentSoft: string
  accentGlow: string
  line: string
}

export const BOOK_COVER_PALETTES: BookCoverPalette[] = [
  {
    bg: "#131316",
    surface: "#1A1B20",
    accent: "#9A84F7",
    accentSoft: "#9A84F724",
    accentGlow: "#C4B5FD14",
    line: "#E7DDCF20"
  },
  {
    bg: "#151816",
    surface: "#1B211D",
    accent: "#8AA58D",
    accentSoft: "#8AA58D22",
    accentGlow: "#CDE3CF14",
    line: "#DDE4D720"
  },
  {
    bg: "#171514",
    surface: "#211D1B",
    accent: "#B69674",
    accentSoft: "#B6967422",
    accentGlow: "#E5CCB314",
    line: "#E8DDD320"
  },
  {
    bg: "#141519",
    surface: "#1B1E25",
    accent: "#7F92B7",
    accentSoft: "#7F92B722",
    accentGlow: "#C3D2EC12",
    line: "#DBE3F320"
  },
  {
    bg: "#171618",
    surface: "#222025",
    accent: "#A28799",
    accentSoft: "#A2879922",
    accentGlow: "#DEC9D614",
    line: "#E7DDE320"
  }
]

type CoverMotif = "orbit" | "bands" | "frame" | "column"

export interface BookCoverArtSpec {
  palette: BookCoverPalette
  motif: CoverMotif
  layers: Array<Record<string, number | string>>
}

/**
 * 构建稳定可复现的封面图案规格
 */
export function buildBookCoverArtSpec(
  title: string,
  coverVariant = 0
): BookCoverArtSpec {
  const seed = hashTitle(title) + coverVariant * 17
  const palette =
    BOOK_COVER_PALETTES[seed % BOOK_COVER_PALETTES.length]
  const motifIndex = seed % 4
  const motif: CoverMotif = ["orbit", "bands", "frame", "column"][motifIndex] as CoverMotif

  if (motif === "orbit") {
    return {
      palette,
      motif,
      layers: [
        { inset: 18 + (seed % 10), size: 108 + (seed % 16) },
        { x: 58 + (seed % 20), y: 34 + (seed % 16), size: 52 + (seed % 18) },
        { x: 28 + (seed % 18), y: 116 + (seed % 12), w: 76 + (seed % 24) }
      ]
    }
  }

  if (motif === "bands") {
    return {
      palette,
      motif,
      layers: [
        { top: 34 + (seed % 10), width: 74 + (seed % 18) },
        { top: 72 + (seed % 14), width: 118 + (seed % 26) },
        { top: 116 + (seed % 12), width: 92 + (seed % 20) }
      ]
    }
  }

  if (motif === "frame") {
    return {
      palette,
      motif,
      layers: [
        { inset: 18 + (seed % 8) },
        { inset: 34 + (seed % 10) },
        { left: 34 + (seed % 18), height: 86 + (seed % 20) }
      ]
    }
  }

  return {
    palette,
    motif,
    layers: [
      { left: 30 + (seed % 12), height: 128 + (seed % 18) },
      { left: 68 + (seed % 12), height: 92 + (seed % 20) },
      { left: 106 + (seed % 10), height: 146 + (seed % 16) },
      { size: 54 + (seed % 16), x: 70 + (seed % 18), y: 44 + (seed % 16) }
    ]
  }
}

/**
 * 纯图案占位封面
 */
export function PatternBookCoverArt({
  title,
  coverVariant = 0
}: {
  title: string
  coverVariant?: number
}) {
  const spec = buildBookCoverArtSpec(title, coverVariant)

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-cover-motif={spec.motif}
      style={{
        background: `radial-gradient(circle at 22% 18%, ${spec.palette.accentGlow} 0%, transparent 38%), linear-gradient(180deg, ${spec.palette.surface} 0%, ${spec.palette.bg} 100%)`
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0) 38%)"
        }}
      />
      {spec.motif === "orbit" ? renderOrbit(spec) : null}
      {spec.motif === "bands" ? renderBands(spec) : null}
      {spec.motif === "frame" ? renderFrame(spec) : null}
      {spec.motif === "column" ? renderColumn(spec) : null}
      <div
        className="absolute left-4 right-4 top-4 h-px"
        style={{ background: spec.palette.line }}
      />
      <div
        className="absolute bottom-4 left-4 h-px w-16"
        style={{ background: spec.palette.accentSoft }}
      />
    </div>
  )
}

function renderOrbit(spec: BookCoverArtSpec) {
  const [ring, orb, band] = spec.layers
  return (
    <>
      <div
        className="absolute rounded-full border"
        style={{
          inset: Number(ring.inset),
          borderColor: spec.palette.line
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          left: Number(orb.x),
          top: Number(orb.y),
          width: Number(orb.size),
          height: Number(orb.size),
          background: `radial-gradient(circle at 35% 35%, ${spec.palette.accent} 0%, ${spec.palette.accentSoft} 58%, transparent 100%)`
        }}
      />
      <div
        className="absolute h-px"
        style={{
          left: Number(band.x),
          bottom: Number(band.y),
          width: Number(band.w),
          background: spec.palette.accentSoft
        }}
      />
    </>
  )
}

function renderBands(spec: BookCoverArtSpec) {
  return (
    <>
      {spec.layers.map((layer, index) => (
        <div
          key={`band-${index}`}
          className="absolute left-5 h-px"
          style={{
            top: Number(layer.top),
            width: Number(layer.width),
            background: index === 1 ? spec.palette.accent : spec.palette.line
          }}
        />
      ))}
      <div
        className="absolute inset-y-6 right-7 w-px"
        style={{ background: spec.palette.line }}
      />
    </>
  )
}

function renderFrame(spec: BookCoverArtSpec) {
  const [outer, inner, bar] = spec.layers
  return (
    <>
      <div
        className="absolute rounded-[18px] border"
        style={{
          inset: Number(outer.inset),
          borderColor: spec.palette.line
        }}
      />
      <div
        className="absolute rounded-[14px] border"
        style={{
          inset: Number(inner.inset),
          borderColor: spec.palette.accentSoft
        }}
      />
      <div
        className="absolute bottom-8 w-px"
        style={{
          left: Number(bar.left),
          height: Number(bar.height),
          background: `linear-gradient(180deg, transparent 0%, ${spec.palette.accent} 35%, ${spec.palette.accentSoft} 100%)`
        }}
      />
    </>
  )
}

function renderColumn(spec: BookCoverArtSpec) {
  const [left, middle, right, orb] = spec.layers
  const columns = [left, middle, right]
  return (
    <>
      {columns.map((layer, index) => (
        <div
          key={`column-${index}`}
          className="absolute bottom-5 w-[14px] rounded-full"
          style={{
            left: Number(layer.left),
            height: Number(layer.height),
            background: index === 1 ? spec.palette.line : spec.palette.accentSoft
          }}
        />
      ))}
      <div
        className="absolute rounded-full"
        style={{
          left: Number(orb.x),
          top: Number(orb.y),
          width: Number(orb.size),
          height: Number(orb.size),
          background: `radial-gradient(circle, ${spec.palette.accentSoft} 0%, transparent 72%)`
        }}
      />
    </>
  )
}

function hashTitle(title: string) {
  let hash = 5381
  for (let index = 0; index < title.length; index += 1) {
    hash = ((hash << 5) + hash) ^ title.charCodeAt(index)
  }
  return Math.abs(hash)
}
