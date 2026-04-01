import dynamic from "next/dynamic"
import { requirePageUser } from "@/src/server/lib/session"
import { cachedRepo } from "@/src/server/repositories/cached"

const GraphClient = dynamic(
  () => import("@/components/graph/graph-client").then((m) => m.GraphClient),
  { ssr: false }
)

export default async function GraphPage() {
  const user = await requirePageUser()
  const graph = await cachedRepo.getGraph(user.id)
  return <GraphClient links={graph.links} nodes={graph.nodes} />
}
