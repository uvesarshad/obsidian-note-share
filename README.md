# Obsidian Collaborative Cloud

This monorepo contains the current `v1` code for Obsidian Collaborative Cloud:

- an Obsidian plugin
- a Node.js/Express API server
- a Next.js admin dashboard
- a shared package for common types

The repository is scoped to the collaboration/sync/search/admin core. It does not currently include the full long-range product vision from `temp/PRD.md`.

## V1 scope

### Included
- email/password auth
- MFA setup and verification
- client-side encrypted sync
- real-time collaboration
- file and folder sharing
- version history diff and restore
- encrypted `.obsidian` configuration backup
- local smart search and indexing
- basic admin stats, users, and backup policy controls

### Not included
- public publishing
- payment gateways and billing
- enterprise SSO
- broad analytics/reporting
- server-side search/indexing

## Repository structure

- `packages/plugin`: Obsidian plugin
- `packages/server`: Express API server + Socket.io collaboration server
- `packages/admin`: Next.js admin dashboard
- `packages/shared`: shared types/utilities
- `docs`: product and runtime docs
- `temp`: scope notes, PRD, and working project docs

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the PostgreSQL database:

```sql
CREATE DATABASE obsidian_collab;
```

3. Configure `packages/server/.env` with:

```env
PORT=3008
DB_USER=...
DB_HOST=...
DB_NAME=obsidian_collab
DB_PASSWORD=...
DB_PORT=5432
JWT_SECRET=...
```

4. Initialize the schema:

```bash
npm run init-db --workspace=@obsidian-collaborative/server
```

5. Optional admin-role migration:

```bash
npx ts-node packages/server/scripts/migrate-admin.ts
```

## Local development

### Server

```bash
npm run dev --workspace=@obsidian-collaborative/server
```

Default URL: `http://localhost:3008`

### Admin

```bash
npm run dev --workspace=@obsidian-collaborative/admin
```

Default URL: `http://localhost:3000`

If port `3000` is already occupied, run:

```bash
npm run dev --workspace=@obsidian-collaborative/admin -- -p 3010
```

### Plugin watcher

```bash
npm run dev --workspace=obsidian-collaborative-plugin
```

This rebuilds `packages/plugin/main.js` on change.

## Plugin installation during development

Point your Obsidian vault plugin folder at `packages/plugin`, or copy the built plugin files into:

```text
<VaultPath>\.obsidian\plugins\obsidian-collaborative-plugin
```

Minimum required plugin artifacts:
- `main.js`
- `manifest.json`

Optional Windows junction:

```powershell
New-Item -ItemType Junction -Path "C:\path\to\Vault\.obsidian\plugins\obsidian-collaborative-plugin" -Target "E:\Projects\obsidian_plugin\packages\plugin"
```

## Validation

Workspace validation:

```bash
npm run build
npm run test
```

Package-specific plugin build:

```bash
npm run build --workspace packages/plugin
```

## Current plugin capabilities

### Collaboration and sharing
- real-time collaborative editing
- active-file share status
- share/access modal for files and folders
- shared notes view

### Sync and backup
- encrypted upload/download
- automatic sync scheduling
- manual sync command
- sync pause/resume
- vault configuration backup and restore

### Search and recovery
- local smart search index
- search by text, tags, mentions, date range, file type, and case sensitivity
- version history diff and restore

## Current limitations

- The backup flow is currently aimed at vault configuration recovery, not a full binary-safe vault archive format.
- Search is local to the plugin. There is no remote search service.
- Real Obsidian runtime validation is still required before a release is called done.

## Related docs

- `docs/overview.md`
- `docs/local-start-flow-and-smoke-test.md`
- `temp/v1-scope.md`
- `temp/project-finish-task-list.md`
- `temp/PRD.md`
