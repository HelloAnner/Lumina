"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import { Button } from "@/components/ui/button"

interface GraphNode {
  id: string
  title: string
  highlightCount: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
}

// 颜色配置 - 使用与主题一致的值
const colors = {
  node: "#A1A1AA",
  nodeStroke: "#111113",
  link: "#27272A",
  label: "#FAFAFA",
  labelMuted: "#71717A",
  highlight: "#E4E4E7"
}

export function GraphClient({
  nodes,
  links
}: {
  nodes: GraphNode[]
  links: GraphLink[]
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null)
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)

  const preparedNodes = useMemo(
    () => nodes.map((item) => ({ ...item })),
    [nodes]
  )

  const resetLayout = useCallback(() => {
    if (!simulationRef.current) return

    // 重新初始化节点位置
    preparedNodes.forEach((node) => {
      node.x = undefined
      node.y = undefined
      node.vx = undefined
      node.vy = undefined
    })

    simulationRef.current.alpha(1).restart()

    // 重置缩放
    if (ref.current) {
      const svg = d3.select(ref.current)
      svg.transition().duration(750).call(
        (d3.zoom() as any).transform,
        d3.zoomIdentity
      )
      transformRef.current = d3.zoomIdentity
    }
  }, [preparedNodes])

  useEffect(() => {
    if (!ref.current) return

    const width = ref.current.clientWidth || 1000
    const height = 640
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()

    // 创建主图层
    const layer = svg.append("g")

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        transformRef.current = event.transform
        layer.attr("transform", event.transform)
      })

    svg.call(zoom)

    // 初始化力导向模拟
    const simulation = d3
      .forceSimulation<GraphNode>(preparedNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => 120 / ((d.weight || 0.5) + 0.3))
      )
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) =>
        Math.min(16 + (d.highlightCount || 0) * 2, 28)
      ))

    simulationRef.current = simulation

    // 绘制连线
    const link = layer
      .selectAll<SVGLineElement, GraphLink>("line.link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", colors.link)
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d) => 0.5 + (d.weight || 0.5) * 2)

    // 绘制节点
    const node = layer
      .selectAll<SVGCircleElement, GraphNode>("circle.node")
      .data(preparedNodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", (d) => Math.min(6 + (d.highlightCount || 0) * 1.5, 18))
      .attr("fill", colors.node)
      .attr("stroke", colors.nodeStroke)
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        setHoveredNode(d.id)
        d3.select(this)
          .attr("fill", colors.highlight)
          .attr("stroke-width", 3)
      })
      .on("mouseout", function(event, d) {
        setHoveredNode(null)
        if (selectedNode !== d.id) {
          d3.select(this)
            .attr("fill", colors.node)
            .attr("stroke-width", 2)
        }
      })
      .on("click", function(event, d) {
        event.stopPropagation()
        setSelectedNode(d.id)
        // 重置所有节点样式
        node.attr("fill", colors.node).attr("stroke-width", 2)
        // 高亮选中节点
        d3.select(this)
          .attr("fill", colors.highlight)
          .attr("stroke-width", 3)
      })

    // 绘制标签
    const label = layer
      .selectAll<SVGTextElement, GraphNode>("text.label")
      .data(preparedNodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .text((d) => d.title)
      .attr("fill", colors.label)
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .attr("paint-order", "stroke")
      .attr("stroke", colors.nodeStroke)
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.8)
      .style("pointer-events", "none")
      .style("user-select", "none")

    // 绘制高亮数量标签（小圆点）
    const countLabel = layer
      .selectAll<SVGCircleElement, GraphNode>("circle.count-bg")
      .data(preparedNodes.filter(d => d.highlightCount > 0))
      .enter()
      .append("circle")
      .attr("class", "count-bg")
      .attr("r", 8)
      .attr("fill", colors.nodeStroke)
      .style("pointer-events", "none")

    const countText = layer
      .selectAll<SVGTextElement, GraphNode>("text.count-text")
      .data(preparedNodes.filter(d => d.highlightCount > 0))
      .enter()
      .append("text")
      .attr("class", "count-text")
      .text((d) => d.highlightCount)
      .attr("font-size", 8)
      .attr("fill", colors.label)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("pointer-events", "none")
      .style("user-select", "none")

    // 模拟更新位置
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node
        .attr("cx", (d) => d.x || 0)
        .attr("cy", (d) => d.y || 0)

      label
        .attr("x", (d) => (d.x || 0) + 12)
        .attr("y", (d) => (d.y || 0) + 3)

      countLabel
        .attr("cx", (d) => (d.x || 0) + 12)
        .attr("cy", (d) => (d.y || 0) - 12)

      countText
        .attr("x", (d) => (d.x || 0) + 12)
        .attr("y", (d) => (d.y || 0) - 12)
    })

    // 点击空白处取消选择
    svg.on("click", () => {
      setSelectedNode(null)
      node.attr("fill", colors.node).attr("stroke-width", 2)
    })

    return () => {
      simulation.stop()
      simulationRef.current = null
    }
  }, [links, preparedNodes])

  return (
    <div className="min-h-screen bg-base px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">知识图谱</h1>
          <p className="mt-1 text-sm text-muted">
            节点大小 = 划线数量，边宽 = 关联强度
            {selectedNode && (
              <span className="ml-2 text-foreground">
                · 已选中: {nodes.find(n => n.id === selectedNode)?.title}
              </span>
            )}
          </p>
        </div>
        <Button variant="secondary" onClick={resetLayout}>
          重置布局
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm">
        <svg
          ref={ref}
          className="h-[640px] w-full"
          style={{ cursor: hoveredNode ? "pointer" : "default" }}
        />
      </div>
      <div className="mt-4 flex items-center gap-6 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.node }} />
          <span>普通节点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.highlight }} />
          <span>高亮/悬停</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4" style={{ backgroundColor: colors.link }} />
          <span>关联强度</span>
        </div>
        <div className="ml-auto">
          共 {nodes.length} 个节点，{links.length} 条边
        </div>
      </div>
    </div>
  )
}
