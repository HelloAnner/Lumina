"use client"

import { useEffect, useMemo, useRef } from "react"
import * as d3 from "d3"
import { Button } from "@/components/ui/button"

interface GraphNode {
  id: string
  title: string
  highlightCount: number
}

interface GraphLink {
  source: string
  target: string
  weight: number
}

export function GraphClient({
  nodes,
  links
}: {
  nodes: GraphNode[]
  links: GraphLink[]
}) {
  const ref = useRef<SVGSVGElement>(null)

  const preparedNodes = useMemo(
    () => nodes.map((item) => ({ ...item })),
    [nodes]
  )

  useEffect(() => {
    if (!ref.current) {
      return
    }
    const width = ref.current.clientWidth || 1000
    const height = 640
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    const layer = svg.append("g")
    const simulation = d3
      .forceSimulation(preparedNodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(links)
          .id((item: any) => item.id)
          .distance((item: any) => 160 / (item.weight + 0.2))
      )
      .force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((item: any) => 22 + item.highlightCount))

    const link = layer
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (item) => 0.5 + item.weight * 3)

    const node = layer
      .selectAll("circle")
      .data(preparedNodes)
      .enter()
      .append("circle")
      .attr("r", (item) => Math.min(8 + item.highlightCount * 2.5, 32))
      .attr("fill", "var(--color-secondary)")
      .attr("stroke", "var(--color-surface)")
      .attr("stroke-width", 2)

    const label = layer
      .selectAll("text")
      .data(preparedNodes)
      .enter()
      .append("text")
      .text((item) => item.title)
      .attr("fill", "var(--color-foreground)")
      .attr("font-size", 11)
      .attr("font-weight", 500)

    simulation.on("tick", () => {
      link
        .attr("x1", (item: any) => item.source.x)
        .attr("y1", (item: any) => item.source.y)
        .attr("x2", (item: any) => item.target.x)
        .attr("y2", (item: any) => item.target.y)

      node.attr("cx", (item: any) => item.x).attr("cy", (item: any) => item.y)
      label
        .attr("x", (item: any) => item.x + 14)
        .attr("y", (item: any) => item.y + 4)
    })

    svg.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 2]).on("zoom", (event) => {
        layer.attr("transform", event.transform)
      })
    )

    return () => {
      simulation.stop()
    }
  }, [links, preparedNodes])

  return (
    <div className="min-h-screen bg-base px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">知识图谱</h1>
          <p className="mt-1 text-sm text-muted">节点大小 = 划线数量，边宽 = 关联强度</p>
        </div>
        <Button variant="secondary">重置布局</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm">
        <svg ref={ref} className="h-[640px] w-full" />
      </div>
    </div>
  )
}
