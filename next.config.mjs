/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "25mb"
    },
    optimizePackageImports: [
      "lucide-react",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/pm",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "d3-force",
      "d3-selection",
      "d3-zoom"
    ]
  },
  output: "standalone",
  reactStrictMode: false
}

export default nextConfig
