# Obsidian Collaborative Cloud - Architecture Overview

The **Obsidian Collaborative Cloud** is an open-source ecosystem designed to bring real-time collaboration, end-to-end encrypted sync, and group publishing to Obsidian.

## What has been done

We have established the core foundation of the platform:

- **Monorepo Architecture**: A robust structure using `npm` workspaces dividing the project into `plugin`, `server`, `admin`, and `shared` packages.
- **Backend Infrastructure**:
    - Node.js/Express server with PostgreSQL for metadata storage.
    - JWT-based authentication system.
    - Admin-specific routes and middleware for system management.
- **Real-time Collaboration**:
    - Integrated **Yjs** CRDTs with **Socket.io** for sub-second latency editing.
    - Server-side document persistence and room management.
- **E2E Encryption & Sync**:
    - Client-side **AES-256-GCM** encryption (zero-knowledge).
    - Differential file sync logic ensuring server-side data is always encrypted.
- **Admin Dashboard**:
    - Next.js web application for managing users.
    - Real-time system statistics (total users, storage used, etc.).
- **Developer Experience**:
    - Comprehensive `README.md` and `CONTRIBUTING.md`.
    - Automated database initialization and migration scripts.

### Recently implemented (February 27, 2026)

- **Sidebar Sharing & Access Control (plugin + server)**:
    - File context menu action: `Share & Access Control`.
    - Share APIs: `POST /api/files/share`, `GET /api/files/shared`, `GET /api/files/shared-status`.
    - Active note share indicator in plugin status bar (`not shared` or `role + permission`).
    - Shared notes view now reads server data instead of mock entries.
- **Plan-based Full Vault Backup Controls (plugin + server + admin)**:
    - User preference APIs: `GET/PUT /api/backup/preferences`.
    - Admin plan policy APIs: `GET/PUT /api/admin/backup-policies/:planTier`.
    - New schema tables: `plan_backup_policies`, `user_backup_preferences`.
    - Plugin settings now enforce plan-limited full-vault backup and allowed frequencies.
- **Database updates applied**:
    - Schema updated and initialized via `npm run init-db --workspace packages/server`.

## Roadmap (Next Steps)

Based on the [PRD.md](../PRD.md), the following features are planned:

### Phase 1: Advanced Collaboration & Permissions
- **Presence Indicators**: Visual cues for who is currently viewing/editing a note.
- **Granular Permissions**: Private invites, public-view links, and role-based access (Owner vs. Editor).
- **Conflict UI**: Visual markers for resolving complex edit conflicts.
- **Folder-level share flow**: Extend current file-level share UX to full folder inheritance flow.
- **Richer shared-state visibility**: Add explicit badge indicators in sidebar note/folder rows.

### Phase 2: Knowledge Management
- **Selective Sync**: Folder-level rules to control which files sync to which devices.
- **Backup execution engine**: Scheduled full-vault backup jobs and retention enforcement by plan.
- **Version History**: Timeline view of document versions with side-by-side diffing and one-click restores.
- **Smart Search**: Client-side encrypted full-text indexing for cross-vault search.

### Phase 3: Ecosystem Expansion
- **Public Publishing**: One-click "Publish to Web" for notes with custom theme support and SEO metadata.
- **Payment Integration**: Stripe/PayPal/Razorpay hooks for subscription tiers (Free, Pro, Teams).
- **Mobile Support**: Ensuring full compatibility with the Obsidian mobile app.

## Project Structure

- **`packages/plugin`**: The Obsidian plugin (client-side).
- **`packages/server`**: Node.js/Express backend with WebSockets.
- **`packages/admin`**: Next.js Admin Dashboard.
- **`packages/shared`**: Shared types and utilities.

## Tech Stack

- **Frontend**: Obsidian API, CodeMirror 6, React (Admin), TailwindCSS.
- **Backend**: Node.js, Express, Socket.io, Yjs.
- **Database**: PostgreSQL (metadata), S3-compatible (encrypted blobs).
- **Security**: AES-256-GCM, PBKDF2, JWT.

---

Last updated: February 27, 2026
