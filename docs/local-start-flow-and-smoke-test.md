# Local Start Flow + Strict Smoke Test Checklist

Last updated: February 27, 2026

## 1. Preconditions (Must pass before start)

- [ ] Node.js and npm installed (`node -v`, `npm -v`)
- [ ] PostgreSQL is running
- [ ] `packages/server/.env` exists and is valid:
  - [ ] `PORT=3008`
  - [ ] `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`
  - [ ] `JWT_SECRET` is set
- [ ] Dependencies installed at repo root:
  - Command: `npm.cmd install`
- [ ] DB schema initialized:
  - Command: `npm.cmd run init-db --workspace packages/server`
  - Expected: `Database initialized successfully!`

Stop if any precondition fails.

## 2. Local Start Flow (3 terminals)

## Terminal 1: Server

Command:
```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=@obsidian-collaborative/server
```

Pass criteria:
- [ ] Server starts with no fatal error
- [ ] Console shows `Server is running on port 3008`

## Terminal 2: Admin

Command:
```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=@obsidian-collaborative/admin
```

Pass criteria:
- [ ] Next.js dev server starts with no fatal error
- [ ] `http://localhost:3000` opens

## Terminal 3: Plugin watcher

Command:
```powershell
cd E:\Projects\obsidian_plugin
npm.cmd run dev --workspace=obsidian-collaborative-plugin
```

Pass criteria:
- [ ] Build watcher starts
- [ ] `packages/plugin/main.js` updates on source change

## Obsidian plugin install path

- [ ] Your vault has plugin folder path:
  - `<VaultPath>\.obsidian\plugins\obsidian-collaborative-plugin`
- [ ] Plugin files are available there (or junction to `E:\Projects\obsidian_plugin\packages\plugin`)
- [ ] In Obsidian, Community Plugins enabled
- [ ] `Obsidian Collaborative Cloud` plugin enabled

Optional junction command:
```powershell
New-Item -ItemType Junction -Path "C:\path\to\Vault\.obsidian\plugins\obsidian-collaborative-plugin" -Target "E:\Projects\obsidian_plugin\packages\plugin"
```

## 3. Strict Smoke Test Gates

Run gates in order. Do not continue on failed gate.

## Gate A: Health/API reachability

- [ ] `GET http://localhost:3008/` returns success text
- [ ] `GET http://localhost:3000/login` loads admin login page

Quick checks:
```powershell
Invoke-WebRequest -Uri http://localhost:3008/
Invoke-WebRequest -Uri http://localhost:3000/login
```

## Gate B: Auth and roles

- [ ] Register or login one normal user from plugin settings
- [ ] Confirm plugin shows authenticated status
- [ ] Promote one user to admin in DB:
```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```
- [ ] Admin can login at `http://localhost:3000/login`

## Gate C: Share & Access Control (new flow)

- [ ] Open a note in Obsidian
- [ ] Right-click file in sidebar and select `Share & Access Control`
- [ ] Enter permission value: `private` (or `public_view`, `public_edit`)
- [ ] Success notice appears
- [ ] Status bar shows share state:
  - expected format: `Share: <role> (<permission>)`
- [ ] Open `Shared Notes` view and verify note appears in list

API validation (optional):
- [ ] `GET /api/files/shared` returns at least one shared file entry
- [ ] `GET /api/files/shared-status?path=<note-path>` returns `isShared: true`

## Gate D: Backup policy enforcement (new flow)

- [ ] Admin opens `Backup Policies` page
- [ ] Edit a plan (for example `free`) and save:
  - `fullVaultBackupEnabled = false`
  - `allowedFrequencies = manual,daily`
- [ ] In plugin (user on that plan), settings reflect policy:
  - full vault backup toggle disabled if disallowed
  - backup frequency dropdown only shows allowed values
- [ ] Set allowed value (example: `daily`) and save successfully
- [ ] Try disallowed value via API and confirm validation fails (400)

## Gate E: Regression sanity

- [ ] File sync still uploads on modify when frequency and sync rules allow
- [ ] Admin dashboard (`/` and `/users`) still loads
- [ ] No fatal runtime errors in server/admin/plugin terminals

## 4. Exit Criteria (Release-ready smoke)

Mark release-ready only when all are true:

- [ ] Gates A-E all passed
- [ ] No blocker severity issues open
- [ ] Smoke results recorded (date, tester, pass/fail notes)

## 5. Smoke Result Template

```md
Date:
Tester:
Branch/Commit:

Gate A: PASS/FAIL
Gate B: PASS/FAIL
Gate C: PASS/FAIL
Gate D: PASS/FAIL
Gate E: PASS/FAIL

Blockers:
- none / list

Notes:
- ...
```
