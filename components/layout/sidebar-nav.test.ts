import test from "node:test"
import assert from "node:assert/strict"
import { buildSidebarPrefetchRoutes } from "./sidebar-nav"

test("buildSidebarPrefetchRoutes 会排除当前路由并保持导航顺序", () => {
  assert.deepEqual(buildSidebarPrefetchRoutes("/knowledge"), [
    "/library",
    "/articles",
    "/graph",
    "/scout",
    "/sources",
    "/publish",
    "/settings"
  ])
})
