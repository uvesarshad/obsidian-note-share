# Collaboration UX + Backup Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add share/access controls in the Obsidian sidebar flow, visible shared-state indication, and full-vault backup controls with user-set frequency plus admin plan-based enforcement.

**Architecture:** Extend server APIs to expose share metadata and backup policy enforcement; consume these APIs in the plugin settings/sidebar workflow; update product docs to reflect finalized requirements. Keep implementation incremental and test-first for policy logic.

**Tech Stack:** TypeScript, Express, PostgreSQL schema SQL, Obsidian Plugin API.

---

## TODO (Execution Order)

1. [x] Add docs requirements updates in `PRD.md` and `docs/overview.md`:
   - Sidebar share/access control menu.
   - Shared indicator on note/folder context (or active note status).
   - Full-vault backup with user-configurable frequency.
   - Admin control over backup capabilities by subscription plan.
2. [x] Add test coverage for backup policy validation and fallback behavior.
3. [x] Add server schema support for:
   - Plan backup policies.
   - Per-user backup preferences.
4. [x] Add server routes:
   - User backup preferences read/update (plan-aware validation).
   - Admin backup policy read/update.
   - File share creation/list/status for UI indicators.
5. [x] Wire plugin settings to backup policy APIs:
   - Show allowed frequencies by plan.
   - Allow full-vault backup toggle only when plan permits.
6. [x] Add plugin sidebar file-menu action:
   - “Share & Access Control” entry on file/folder context menu.
   - Trigger share API.
7. [x] Add shared-state indicator in plugin:
   - Active-file status showing shared/not-shared and role/permission.
8. [~] Run verification:
   - Type-check/build server and plugin.
   - Run added tests and report outputs.
