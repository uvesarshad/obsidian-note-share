# Local Start Flow And V1 Smoke Test

Last updated: April 18, 2026

This checklist is for the actual shipped `v1` scope:

- auth
- encrypted sync
- collaboration
- sharing
- version history
- vault configuration backup
- local smart search
- basic admin stats/users/backup policies

## 1. Preconditions

- [ ] Node.js and npm installed
- [ ] PostgreSQL is running
- [ ] `packages/server/.env` exists and includes:
  - [ ] `PORT=3008`
  - [ ] `DB_USER`
  - [ ] `DB_HOST`
  - [ ] `DB_NAME`
  - [ ] `DB_PASSWORD`
  - [ ] `DB_PORT`
  - [ ] `JWT_SECRET`
- [ ] Dependencies installed:

```powershell
npm.cmd install
```

- [ ] Database initialized:

```powershell
npm.cmd run init-db --workspace=@obsidian-collaborative/server
```

Expected result:
- [ ] `Database initialized successfully!`

Stop if any precondition fails.

## 2. Local Start Flow

### Terminal 1: Server

```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=@obsidian-collaborative/server
```

Pass criteria:
- [ ] server starts without fatal error
- [ ] console shows `Server is running on port 3008`

### Terminal 2: Admin

Default:

```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=@obsidian-collaborative/admin
```

If port `3000` is already in use:

```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=@obsidian-collaborative/admin -- -p 3010
```

Pass criteria:
- [ ] Next.js starts without fatal error
- [ ] admin login page loads on the selected port

### Terminal 3: Plugin watcher

```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=obsidian-collaborative-plugin
```

Pass criteria:
- [ ] watcher starts
- [ ] `packages/plugin/main.js` updates on source change

## 3. Obsidian Plugin Setup

- [ ] plugin exists in:
  - `<VaultPath>\.obsidian\plugins\obsidian-collaborative-plugin`
- [ ] `main.js` and `manifest.json` are present there, or the directory is a junction to `packages/plugin`
- [ ] Community Plugins enabled in Obsidian
- [ ] `Obsidian Collaborative Cloud` enabled in Obsidian

Optional junction:

```powershell
New-Item -ItemType Junction -Path "C:\path\to\Vault\.obsidian\plugins\obsidian-collaborative-plugin" -Target "E:\Projects\obsidian_plugin\packages\plugin"
```

## 4. Smoke Gates

Run gates in order.

### Gate A: Health And Reachability

- [ ] `GET http://localhost:3008/` succeeds
- [ ] admin login page loads

Quick checks:

```powershell
Invoke-WebRequest -Uri http://localhost:3008/
Invoke-WebRequest -Uri http://localhost:3000/login
```

If admin is on `3010`, use:

```powershell
Invoke-WebRequest -Uri http://localhost:3010/login
```

### Gate B: Auth And Roles

- [ ] register or login a normal user from plugin settings
- [ ] plugin shows signed-in status
- [ ] vault passphrase can be set or unlocked
- [ ] promote one user to admin in DB if needed:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

- [ ] admin can log in

### Gate C: Sync

- [ ] change a note and confirm automatic sync occurs when sync is enabled
- [ ] `Sync: ...` status updates in plugin
- [ ] `Sync Now` works from settings or command palette
- [ ] `Pause Sync` prevents automatic uploads
- [ ] excluded folders are not synced

### Gate D: Share And Collaboration

- [ ] open a note in Obsidian
- [ ] right-click file in sidebar and select `Share & Access Control`
- [ ] modal opens
- [ ] choose `private`, `public_view`, or `public_edit`
- [ ] success notice appears
- [ ] status bar shows:
  - `Share: <role> (<permission>)`
- [ ] `Shared Notes` view shows the shared note
- [ ] open the same note in a second client and verify collaboration connectivity if available

Optional API checks:
- [ ] `GET /api/files/shared` returns shared entries
- [ ] `GET /api/files/shared-status` returns `isShared: true` for the shared file

### Gate E: Version History

- [ ] open `Version History`
- [ ] versions load for a synced file
- [ ] `View Diff` works
- [ ] restore a version successfully overwrites the active file

### Gate F: Vault Configuration Backup

- [ ] `Backup Config` succeeds
- [ ] `Restore Config` succeeds on latest snapshot
- [ ] admin backup policy changes are reflected in plugin settings
- [ ] disallowed backup preference values are rejected by the API

### Gate G: Smart Search

- [ ] `Open Smart Search` command or ribbon action opens the modal
- [ ] results appear for a known phrase in the vault
- [ ] tag filtering works
- [ ] mention filtering works
- [ ] file-type filtering works
- [ ] rebuild index completes successfully
- [ ] opening a result opens the matching file

### Gate H: Admin Regression

- [ ] dashboard loads
- [ ] users page loads
- [ ] backup policies page loads
- [ ] no fatal runtime errors appear in server/admin/plugin consoles

## 5. Exit Criteria

Mark `v1` runtime smoke complete only when all are true:

- [ ] Gates A-H passed
- [ ] no blocker-severity issues remain open
- [ ] smoke notes recorded

## 6. Smoke Result Template

```md
Date:
Tester:
Branch/Commit:
Admin Port:

Gate A: PASS/FAIL
Gate B: PASS/FAIL
Gate C: PASS/FAIL
Gate D: PASS/FAIL
Gate E: PASS/FAIL
Gate F: PASS/FAIL
Gate G: PASS/FAIL
Gate H: PASS/FAIL

Blockers:
- none / list

Notes:
- ...
```
