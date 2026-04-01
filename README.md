<p align="center">
  <img src="docs/lumina-hero.png" width="420" alt="Lumina — Turn every highlight into knowledge" />
</p>

<p align="center">
  <strong>An intelligent reading knowledge base that turns book highlights into cross-book viewpoint articles using AI.</strong>
</p>

<p align="center">
  <a href="https://github.com/HelloAnner/Lumina/blob/main/LICENSE"><img src="https://img.shields.io/github/license/HelloAnner/Lumina?style=flat-square&color=8B5CF6" alt="License" /></a>
  <a href="https://github.com/HelloAnner/Lumina/stargazers"><img src="https://img.shields.io/github/stars/HelloAnner/Lumina?style=flat-square&color=8B5CF6" alt="Stars" /></a>
  <a href="https://github.com/HelloAnner/Lumina/issues"><img src="https://img.shields.io/github/issues/HelloAnner/Lumina?style=flat-square" alt="Issues" /></a>
  <a href="https://github.com/HelloAnner/Lumina/pulls"><img src="https://img.shields.io/github/issues-pr/HelloAnner/Lumina?style=flat-square" alt="PRs" /></a>
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#docker-deployment">Docker</a> &middot;
  <a href="#tech-stack">Tech Stack</a> &middot;
  <a href="#contributing">Contributing</a> &middot;
  <a href="#license">License</a>
</p>

---

## Features

- **Library** — Upload PDF/EPUB books, browse a visual bookshelf, manage your collection
- **Reader** — In-browser reading with multi-color highlighting, annotations, and reading progress
- **AI Explain** — Select any text to get instant AI-powered explanations via streaming SSE
- **Aggregation Engine** — Highlights are vectorized and auto-clustered into structured viewpoint articles
- **Knowledge Graph** — Interactive D3.js force-directed graph connecting viewpoints across books
- **Publish** — Export to Markdown / PDF / HTML, push to Webhook or KMS targets on schedule
- **BYOK** — Bring Your Own Key: use your own AI models, zero platform cost

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Local Development

```bash
npm install
make dev
```

`make dev` 会先启动 PostgreSQL、Redis、MinIO，再在宿主机运行 Next.js 开发服务器。  
前端页面、`app/api`、`src/server` 的修改都会通过热更新反映到最新效果。

Open [http://localhost:20261](http://localhost:20261).

Demo account:

| Email | Password |
|---|---|
| `demo@lumina.local` | `lumina123` |

## Docker Deployment

Single command to spin up the full stack:

```bash
make start
```

Open [http://localhost:20261](http://localhost:20261).

All data is persisted under `data/` in the repo root:

| Directory | Contents |
|---|---|
| `data/app` | Application data |
| `data/postgres` | PostgreSQL data |
| `data/redis` | Redis persistence |
| `data/minio` | MinIO object storage |

### Resource Requirements

The default Compose config targets ~100 concurrent users:

| Service | CPU | Memory |
|---|---|---|
| App | 2 | 2 GB |
| PostgreSQL | 2 | 2 GB |
| Redis | 1 | 512 MB |
| MinIO | 1 | 1 GB |

Recommended host: **4C / 8 GB** minimum.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| API | Hono |
| Database | PostgreSQL 16 + pgvector |
| Cache & Queue | Redis, BullMQ |
| Object Storage | MinIO |
| AI | Vercel AI SDK (OpenAI-compatible) |
| Visualization | D3.js |
| Auth | JWT (RS256) |

## Verification

```bash
npm run lint
npm run build
npm run verify
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
