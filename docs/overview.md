# Obsidian Collaborative Cloud - V1 Overview

Last updated: April 18, 2026

## What this repo is

This repository currently targets a practical `v1` of Obsidian Collaborative Cloud: an Obsidian plugin plus supporting server and admin app for encrypted sync, real-time collaboration, sharing, version recovery, vault-configuration backup, and local smart search.

It is **not** the full product vision described in `temp/PRD.md`. That PRD remains a broader roadmap.

## V1 product scope

### Included in v1

- **Authentication**
  - Email/password login
  - Password reset flow
  - Email verification endpoint
  - MFA setup and verification

- **Encrypted Sync**
  - Client-side AES-256-GCM encryption
  - PBKDF2-derived vault key
  - SHA-256 file hashing
  - Automatic sync scheduling
  - Manual sync trigger
  - Sync pause/resume control
  - Sync status surface in the plugin

- **Real-Time Collaboration**
  - Yjs + Socket.io collaboration
  - Stable backend file IDs for document identity
  - Server-side socket authorization by file access

- **Sharing**
  - File and folder share actions from the plugin
  - Share access modal in the plugin
  - Shared notes view backed by server data
  - Share state indicator for the active file

- **Version History**
  - Server-backed version listing
  - Diff view against the current file
  - Restore a selected version into the active file

- **Vault Configuration Backup**
  - Encrypted `.obsidian` configuration backup and restore
  - Plan-aware backup preference enforcement
  - Admin backup policy controls by plan tier

- **Smart Search**
  - Local plugin-side search index
  - Full-text search across indexed vault files
  - Tag, mention, date-range, file-type, and case-sensitive filters
  - Rebuild-index command

- **Admin**
  - Basic stats dashboard
  - Paginated user list
  - Backup policy management

### Explicitly out of v1

- Public publishing
- Billing and payment gateways
- Subscription checkout lifecycle
- Enterprise SSO
- Broad analytics and reporting
- Content moderation workflows
- Remote or server-side search/indexing
- Native mobile-specific implementation work

## Current repository shape

- **`packages/plugin`**
  - Obsidian plugin code
  - collaboration, sync, sharing, version history, backup, and smart search

- **`packages/server`**
  - Express API server
  - PostgreSQL-backed metadata and permissions
  - Socket.io / Yjs collaboration transport

- **`packages/admin`**
  - Next.js admin UI
  - stats, users, and backup policy controls

- **`packages/shared`**
  - shared types/utilities

## Architecture summary

### Plugin

The plugin is the primary user surface. It is responsible for:

- deriving and holding the vault encryption key locally
- encrypting content before upload
- decrypting content after download or restore
- participating in real-time collaboration sessions
- maintaining a local search index
- exposing settings, sharing, history, and search UI

### Server

The server handles:

- auth and user metadata
- file metadata and encrypted payload storage
- shared-document metadata and permissions
- file version records
- backup preferences and admin policy enforcement
- collaboration socket authorization

### Admin

The admin app is intentionally narrow in `v1`. It supports:

- viewing top-level instance stats
- browsing users
- configuring backup policy by plan tier

## Important limitations in v1

- `v1` does **not** implement the full PRD.
- The current backup implementation is primarily aimed at `.obsidian` configuration recovery, not a full binary-safe vault archive format.
- Search is local to the plugin. There is no remote or encrypted shared search service.
- Payments, publishing, advanced admin operations, and enterprise features are deferred.
- Real Obsidian desktop runtime verification is still the key manual release gate.

## Technology choices

- **Plugin**: TypeScript, Obsidian Plugin API, CodeMirror 6, Yjs
- **Server**: Node.js, Express, Socket.io, PostgreSQL
- **Admin**: Next.js, React, TailwindCSS
- **Security**: AES-256-GCM, PBKDF2, JWT

## Storage model

Current `v1` behavior stores encrypted file/config payloads through the existing server/database-backed flow in this repo. The broader PRD discusses S3-compatible blob storage as part of the larger product vision, but that is not the current released architecture described by this document.

## Related docs

- `temp/PRD.md`: broader product vision
- `temp/v1-scope.md`: narrowed release scope
- `temp/project-finish-task-list.md`: larger remaining work outside the shipped `v1`
- `docs/local-start-flow-and-smoke-test.md`: local startup and smoke flow
