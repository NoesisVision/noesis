# Tech Stack

## Frontend

- **React 19** — UI framework
- **Tailwind CSS** — utility-first styling
- **shadcn/ui (Base UI)** — component library, using Base UI primitives (default since July 2026)
- **Shadcnblocks** — pre-built blocks and page layouts (sidebars, app shells, dashboards) on the shadcn token contract; includes Kibo UI for heavy app components (Kanban, Gantt, AI elements)
- **tweakcn** — visual theme editor for shadcn; using the **Claude** preset theme (warm terracotta/cream, Anthropic style): `npx shadcn@latest add https://tweakcn.com/r/themes/claude.json`
- **TanStack Router** — type-safe file-based routing
- **TanStack Query** — server state, data fetching and caching
- **TanStack Form** — type-safe form state and validation
- **TanStack Table** — headless data tables, used via the shadcn data-table pattern (Base UI variant)
- **TanStack Store** — framework-agnostic reactive client state store
- **React Flow** — node-based canvas / flow editor
- **Y.js** — CRDT for realtime collaboration
- **BlockNote** — Notion-style rich text editor with Yjs collaboration support
