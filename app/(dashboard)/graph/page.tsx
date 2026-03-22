import { GraphClient } from "@/components/graph/graph-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function GraphPage() {
  const user = await requirePageUser()
  const graph = repository.getGraph(user.id)
  return <GraphClient links={graph.links} nodes={graph.nodes} />
}
