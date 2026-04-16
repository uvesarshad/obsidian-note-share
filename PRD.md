# Product Requirements Document (PRD)
# Obsidian Collaborative Cloud Plugin

**Version:** 1.0  
**Last Updated:** February 14, 2026  
**Status:** Draft  
**License:** Open Source (MIT)

---

## 1. Executive Summary

### 1.1 Product Overview
An open-source Obsidian plugin that adds real-time collaboration, end-to-end encrypted cloud sync, version history, and public publishing capabilities to Obsidian vaults.

### 1.2 Core Value Proposition
- Real-time collaborative editing within Obsidian's native interface
- Zero-knowledge end-to-end encryption for cloud storage
- Privacy-first alternative to proprietary sync solutions
- Granular permission controls for sharing and collaboration

### 1.3 Target Users
- Individual knowledge workers using Obsidian
- Teams collaborating on documentation/research
- Content creators publishing from Obsidian
- Privacy-conscious users requiring E2E encryption

---

## 2. Product Scope

### 2.1 In Scope
- Obsidian plugin (desktop and mobile)
- Backend API server
- Admin dashboard for user/plan management
- End-to-end encrypted cloud sync
- Real-time collaboration
- Version history and backups
- Vault configuration and plugin sync (Full Vault Backup)
- Public publishing system
- Payment integration
- User authentication system

### 2.2 Out of Scope (Future Versions)
- Native mobile apps (uses Obsidian mobile plugin)
- AI-powered features
- Third-party integrations (Zapier, etc.)
- Custom plugin marketplace

---

## 3. User Stories

### 3.1 Core User Flows

**As a solo user, I want to:**
- Sync my vault across devices with E2E encryption
- Access version history to restore previous note versions
- Selectively sync folders to different devices
- Publish notes publicly with custom themes

**As a collaborator, I want to:**
- Edit notes in real-time with team members
- See who's currently viewing/editing
- Share notes with granular permissions
- Track changes made by different users

**As a team admin, I want to:**
- Manage team member access
- View audit logs of document access
- Set storage limits per user
- Configure SSO for enterprise users

**As a system admin, I want to:**
- Manage user accounts and subscriptions
- Configure payment gateways
- Monitor system health
- Enable/disable features per plan tier

---

## 4. Functional Requirements

## 4.1 Authentication & User Management

### 4.1.1 User Registration
- Email + password registration
- Email verification required
- OAuth support (Google, GitHub)
- Password reset flow

### 4.1.2 User Profile
- Display name
- Email address
- Avatar upload
- API key generation for plugin auth
- 2FA/MFA support (TOTP)

### 4.1.3 Session Management
- JWT-based authentication
- Refresh token rotation
- Device management (view/revoke sessions)
- Auto-logout on inactivity (configurable)

---

## 4.2 Real-Time Collaboration

### 4.2.1 Collaborative Editing
- CRDT-based conflict resolution (using Yjs)
- Real-time text synchronization
- Sub-second latency for edits
- Graceful handling of network interruptions
- Offline editing with sync on reconnect

### 4.2.2 Presence Indicators
- Show active users in document
- Display user cursors with names/colors
- "Currently viewing" badge in file explorer
- Last seen timestamps

### 4.2.3 Conflict Resolution
- Automatic merge for non-conflicting changes
- Visual conflict markers for manual resolution
- Change attribution (who made what edit)
- Undo/redo preserves author context

---

## 4.3 Permission System

### 4.3.1 Share Link Types

**Public View**
- Anyone with link can view (read-only)
- No authentication required
- Optional password protection
- Expiration date support
- View count tracking

**Public Edit**
- Anyone with link can edit
- Requires account creation/login
- Track edits by user
- Revocable access

**Private Invite**
- Explicit email invitations only
- Role-based permissions (see 4.3.2)
- Approval workflow for requests

### 4.3.2 Permission Roles
- **Owner:** Full control, can delete, manage permissions
- **Editor:** Can edit content, cannot change permissions
- **Commenter:** Can add comments, cannot edit
- **Viewer:** Read-only access

### 4.3.3 Permission Management UI
- Share modal in plugin (right-click context menu)
- File explorer sidebar menu: "Share & Access Control"
- List current collaborators with roles
- Change/revoke permissions
- Copy share links
- Shared-state indicator on notes/folders and active note status
- Permission inheritance (folder → files)

---

## 4.4 Cloud Vault Sync (E2E Encrypted)

### 4.4.1 Encryption Architecture

**Client-Side Encryption**
- AES-256-GCM encryption
- Key derivation: PBKDF2 with user password
- Master key never leaves client
- Each vault has unique encryption key
- Metadata encryption separate from content

**Key Management**
- User generates encryption key on first sync
- Key stored locally (encrypted with password hash)
- Key backup via recovery phrase (12-word mnemonic)
- No server-side key storage (zero-knowledge)

### 4.4.2 Sync Logic
- File-level change detection (SHA-256 hashing)
- Differential sync (only changed blocks)
- Bidirectional sync (device ↔ cloud ↔ device)
- Conflict detection and resolution
- Sync queue with retry logic

### 4.4.3 Sync Status
- Visual indicators in Obsidian UI
  - ✅ Synced
  - 🔄 Syncing
  - ⚠️ Conflict
  - ❌ Error
- Sync log viewer
- Manual sync trigger
- Pause/resume sync

### 4.4.4 Storage Management
- Storage quota display
- Usage breakdown by file type
- Cleanup suggestions (duplicates, old versions)
- Storage upgrade prompts

### 4.4.5 Vault Configuration & Settings Sync (Vault Backup)
- Sync Obsidian settings, installed plugins, snippets, and themes (`.obsidian` directory)
- Independent toggle to sync configuration separately from standard note sync
- Automatic backups of the full vault configuration state
- Granular recovery for corrupted or misconfigured plugin settings

---

## 4.5 Selective Sync

### 4.5.1 Folder-Level Sync Rules
- Choose which folders sync to which devices
- Device profiles (Desktop: all, Mobile: work folder only)
- Exclusion patterns (.gitignore-style)
- Default sync rules for new folders

### 4.5.2 UI Components
- Folder context menu: "Sync settings"
- Device sync configuration screen
- Visual indicators (synced vs. local-only folders)
- Bulk selection for sync rules

---

## 4.6 Version History

### 4.6.1 Snapshot Creation
- Auto-snapshot on sync (configurable frequency)
- Manual snapshot creation
- Snapshot on significant changes (>100 chars)
- Retention policy by plan tier

### 4.6.2 Version Browsing
- Timeline view of document versions
- Side-by-side diff viewer
- Blame view (who changed what line)
- Filter by date range or author

### 4.6.3 Restoration
- Restore to specific version
- Restore as new file (preserve current)
- Partial restore (select lines to restore)
- Batch restore (multiple files)

---

## 4.7 Backup & Disaster Recovery

### 4.7.1 Automated Backups
- Full vault backup with user-configurable frequency (plan-dependent)
- Incremental backups between full backups
- Geo-redundant storage (multi-region)
- 7-day rolling retention (configurable by plan)

### 4.7.2 Manual Backup
- One-click "Backup Now" button
- Download vault as encrypted .zip
- Scheduled backup reminders
- Backup verification (integrity checks)

### 4.7.3 Restore Process
- Browse available backup snapshots
- Preview backup contents before restore
- Selective restore (choose files/folders)
- Full vault restore to new location

### 4.7.4 Plan-Based Backup Controls
- Admin can enable/disable full vault backup per subscription tier
- Admin can configure allowed user backup frequencies per tier
- Plugin enforces plan limits in backup settings UI and API validation
- Backup retention and restore windows are configurable by plan tier

---

## 4.8 Cross-Device File Management

### 4.8.1 File Upload
- Drag-and-drop file upload in plugin
- Mobile camera → instant upload
- Batch upload support
- Upload progress indicators

### 4.8.2 Attachment Optimization
- Automatic image compression (configurable quality)
- EXIF data stripping (privacy)
- Video thumbnail generation
- PDF preview rendering

### 4.8.3 Storage Limits
- Per-plan storage quotas
- File size limits (100MB per file on Pro)
- Attachment type restrictions (configurable)
- Low storage warnings

---

## 4.9 Smart Search & Indexing

### 4.9.1 Local Search Index
- Client-side full-text indexing (encrypted)
- Incremental index updates on file changes
- Index stored in plugin data folder
- Rebuild index command

### 4.9.2 Search Features
- Full-text search across vault
- Search by tags (#tag)
- Search by mentions (@person)
- Date range filtering
- File type filtering
- Case-sensitive option

### 4.9.3 Search UI
- Search modal (Ctrl/Cmd+Shift+F)
- Live results as you type
- Preview snippets with highlighting
- Jump to result in editor

---

## 4.10 Public Publish

### 4.10.1 Publishing Workflow
- Right-click note → "Publish to web"
- Choose publish site (if multiple)
- Configure page settings:
  - Custom slug
  - SEO metadata (title, description)
  - Social preview image
  - Password protection
  - Search indexing (allow/disallow)

### 4.10.2 Site Configuration
- Site name and description
- Custom domain support (CNAME)
- Theme selection (Light/Dark/Auto)
- Navigation menu builder
- Footer customization
- Analytics integration (Google Analytics, Plausible)

### 4.10.3 Publishing Features
- Markdown rendering with Obsidian syntax support
  - Wikilinks
  - Embeds
  - Callouts
  - Dataview (static rendering)
- Automatic sitemap generation
- RSS feed generation
- Mobile-responsive design
- Fast CDN delivery

### 4.10.4 Published Content Management
- View published pages list
- Unpublish/archive pages
- Update timestamps
- Bulk publish/unpublish
- Publishing history log

---

## 4.11 Payment & Subscription Management

### 4.11.1 Payment Gateways
- Stripe integration (primary)
- PayPal integration (secondary)
- Support for multiple currencies
- Invoice generation

### 4.11.2 Subscription Plans
- Free tier (limited features)
- Starter tier ($29/year)
- Pro tier ($69/year)
- Teams tier ($149/year)
- Custom enterprise pricing

### 4.11.3 Billing Features
- Subscription upgrade/downgrade
- Prorated billing
- Auto-renewal with email reminders
- Payment method management
- Billing history and invoices
- Tax calculation (VAT, GST)
- Refund processing

### 4.11.4 Plan Enforcement
- Feature gating by plan tier
- Storage quota enforcement
- Soft limits with upgrade prompts
- Grace period for expired subscriptions (7 days)

---

## 5. Admin Dashboard Requirements

### 5.1 Dashboard Overview

**Dashboard Home**
- Total users (active/inactive)
- Revenue metrics (MRR, ARR)
- Storage usage statistics
- Active collaborations count
- System health indicators

### 5.2 User Management

**User List View**
- Searchable/filterable user table
- Columns: Name, Email, Plan, Storage Used, Join Date, Status
- Bulk actions (export, email, suspend)
- User detail view

**User Detail Page**
- Profile information
- Current subscription details
- Storage usage breakdown
- Active devices/sessions
- Login history
- Support ticket history
- Manual subscription override
- Impersonate user (for debugging)
- Account actions (suspend, delete, reset password)

### 5.3 Plan Management

**Plan Configuration**
- Create/edit/delete plans
- Set plan features:
  - Storage limit
  - Max shared notes
  - Max collaborators per note
  - Version history retention
  - Publish sites limit
  - Team features toggle
  - API rate limits
  - Full vault backup availability
  - Allowed backup frequencies
  - Backup retention window
- Pricing configuration
- Feature flag toggles

**Feature Flags**
- Enable/disable features globally
- A/B testing support
- Gradual rollout controls
- Feature access by plan tier

### 5.4 Payment Management

**Payment Gateway Settings**
- Stripe API key configuration
- PayPal credentials
- Webhook endpoint setup
- Test mode toggle

**Transaction Log**
- All payment transactions
- Filter by status, date, plan
- Refund management
- Failed payment tracking
- Revenue reports

**Subscription Management**
- View all subscriptions
- Manually create subscriptions
- Override billing dates
- Apply discounts/coupons
- Cancel/reactivate subscriptions

### 5.5 Content Moderation

**Published Content Review**
- List all published sites
- Preview published pages
- Flag inappropriate content
- Unpublish content (with notice to user)
- Content report handling

**Abuse Prevention**
- Rate limiting configuration
- IP blocking
- Account flagging
- Automated abuse detection rules

### 5.6 Storage Management

**Storage Analytics**
- Total storage used
- Storage by plan tier
- Storage growth trends
- Top storage users
- Cleanup recommendations

**Storage Operations**
- Set global storage limits
- Purge old versions (bulk)
- Remove orphaned files
- Storage quota overrides

### 5.7 System Administration

**System Settings**
- Email templates configuration
- SMTP server settings
- Domain/URL configuration
- Backup retention policies
- Rate limiting rules
- Feature maintenance mode

**Monitoring & Logs**
- Server health metrics (CPU, RAM, disk)
- Database performance
- API response times
- Error logs with stack traces
- User activity logs
- Sync operation logs

**Support Tools**
- Send announcement emails
- In-app notification system
- Support ticket integration
- User feedback viewer

### 5.8 Analytics & Reporting

**User Analytics**
- User growth charts
- Churn rate analysis
- User engagement metrics
- Feature usage statistics

**Financial Reports**
- Revenue charts (daily/weekly/monthly)
- MRR/ARR tracking
- Customer lifetime value
- Payment method breakdown
- Refund rates

**Export Capabilities**
- CSV export for all data tables
- Custom report builder
- Scheduled report emails

---

## 6. Technical Architecture

### 6.1 System Components

**Frontend (Obsidian Plugin)**
- TypeScript
- Obsidian Plugin API
- Yjs (CRDT library)
- IndexedDB (local storage)

**Backend (API Server)**
- Node.js + Express
- WebSocket (Socket.io)
- PostgreSQL (metadata, users, permissions)
- Redis (sessions, presence, cache)
- S3-compatible storage (encrypted blobs)

**Admin Dashboard**
- React + Next.js
- TailwindCSS
- Recharts (analytics)
- Shadcn/ui components

### 6.2 Data Models

**User**
```typescript
{
  id: uuid
  email: string
  password_hash: string
  display_name: string
  avatar_url: string
  plan_tier: enum (free, starter, pro, teams)
  storage_used: bigint
  storage_limit: bigint
  created_at: timestamp
  last_login: timestamp
  mfa_enabled: boolean
  mfa_secret: string (encrypted)
}
```

**Vault**
```typescript
{
  id: uuid
  user_id: uuid (foreign key)
  name: string
  encryption_salt: string
  created_at: timestamp
  last_synced: timestamp
  storage_used: bigint
}
```

**VaultFile**
```typescript
{
  id: uuid
  vault_id: uuid (foreign key)
  file_path: string
  encrypted_content_url: string (S3)
  file_hash: string (SHA-256)
  file_size: bigint
  version: integer
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (soft delete)
}
```

**SharedDocument**
```typescript
{
  id: uuid
  file_id: uuid (foreign key)
  owner_id: uuid (foreign key)
  share_token: string (unique)
  permission_type: enum (public_view, public_edit, private)
  password_hash: string (nullable)
  expires_at: timestamp (nullable)
  view_count: integer
  created_at: timestamp
}
```

**DocumentPermission**
```typescript
{
  id: uuid
  shared_document_id: uuid (foreign key)
  user_id: uuid (foreign key, nullable for public)
  role: enum (owner, editor, commenter, viewer)
  granted_at: timestamp
  granted_by: uuid (foreign key)
}
```

**FileVersion**
```typescript
{
  id: uuid
  file_id: uuid (foreign key)
  version_number: integer
  encrypted_content_url: string (S3)
  author_id: uuid (foreign key)
  change_summary: text
  created_at: timestamp
  file_size: bigint
}
```

**Subscription**
```typescript
{
  id: uuid
  user_id: uuid (foreign key)
  plan_id: uuid (foreign key)
  status: enum (active, canceled, expired, trialing)
  current_period_start: timestamp
  current_period_end: timestamp
  stripe_subscription_id: string
  cancel_at_period_end: boolean
  created_at: timestamp
}
```

**Plan**
```typescript
{
  id: uuid
  name: string
  slug: string
  price_annual: decimal
  features: jsonb {
    storage_gb: integer
    max_shared_notes: integer
    max_collaborators: integer
    version_history_days: integer
    publish_sites: integer
    team_features: boolean
    sso_enabled: boolean
  }
  active: boolean
  created_at: timestamp
}
```

**PublishedSite**
```typescript
{
  id: uuid
  user_id: uuid (foreign key)
  name: string
  slug: string (unique)
  custom_domain: string (nullable)
  theme: enum (light, dark, auto)
  analytics_id: string (nullable)
  created_at: timestamp
}
```

**PublishedPage**
```typescript
{
  id: uuid
  site_id: uuid (foreign key)
  file_id: uuid (foreign key)
  slug: string
  seo_title: string
  seo_description: text
  password_hash: string (nullable)
  indexed: boolean
  published_at: timestamp
  last_updated: timestamp
}
```

### 6.3 API Endpoints

**Authentication**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
GET    /api/auth/me
```

**Vault Management**
```
GET    /api/vaults
POST   /api/vaults
GET    /api/vaults/:id
DELETE /api/vaults/:id
GET    /api/vaults/:id/files
POST   /api/vaults/:id/sync
```

**File Operations**
```
GET    /api/files/:id
POST   /api/files/upload
PUT    /api/files/:id
DELETE /api/files/:id
GET    /api/files/:id/versions
POST   /api/files/:id/restore/:version
```

**Collaboration**
```
WebSocket /ws/collab/:document_id
GET    /api/documents/:id/collaborators
POST   /api/documents/:id/share
PUT    /api/documents/:id/permissions
DELETE /api/documents/:id/share/:token
```

**Search**
```
POST   /api/search (body: { query, filters })
```

**Publishing**
```
GET    /api/publish/sites
POST   /api/publish/sites
GET    /api/publish/sites/:id/pages
POST   /api/publish/pages
PUT    /api/publish/pages/:id
DELETE /api/publish/pages/:id
```

**Subscriptions**
```
GET    /api/subscriptions/plans
GET    /api/subscriptions/current
POST   /api/subscriptions/checkout
POST   /api/subscriptions/upgrade
POST   /api/subscriptions/cancel
GET    /api/subscriptions/invoices
```

**Admin**
```
GET    /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
GET    /api/admin/stats
GET    /api/admin/plans
POST   /api/admin/plans
PUT    /api/admin/plans/:id
GET    /api/admin/payments
POST   /api/admin/payments/:id/refund
GET    /api/admin/logs
```

### 6.4 WebSocket Events

**Collaboration Events**
```javascript
// Client → Server
'doc:join' { documentId, userId }
'doc:update' { documentId, changes, version }
'cursor:update' { documentId, position, selection }

// Server → Client
'doc:sync' { documentId, content, version }
'doc:update' { documentId, changes, author }
'presence:join' { userId, displayName, color }
'presence:leave' { userId }
'cursor:update' { userId, position, selection }
'doc:conflict' { localVersion, serverVersion }
```

**Sync Events**
```javascript
// Client → Server
'sync:start' { vaultId, files: [{path, hash}] }
'sync:upload' { vaultId, file, encryptedContent }
'sync:download' { vaultId, filePath }

// Server → Client
'sync:status' { status, progress }
'sync:conflict' { filePath, localHash, remoteHash }
'sync:complete' { syncedFiles, errors }
```

### 6.5 Security Considerations

**Encryption**
- All vault data encrypted client-side before upload
- Master key derived from user password (PBKDF2, 100k iterations)
- Each file encrypted with unique IV (Initialization Vector)
- Metadata encrypted separately (allows searching without decrypting content)

**API Security**
- Rate limiting per endpoint (100 req/min for authenticated users)
- JWT access tokens (15 min expiry)
- Refresh tokens (30 day expiry, rotated on use)
- CORS configuration (whitelist Obsidian origins)
- Input validation and sanitization
- SQL injection protection (parameterized queries)
- XSS prevention (content security policy)

**Data Protection**
- TLS 1.3 for all connections
- HTTPS-only cookies (secure, httpOnly, sameSite)
- Password hashing (bcrypt, cost factor 12)
- Sensitive data logging redaction
- Regular security audits
- GDPR compliance (data export, deletion)

---

## 7. Non-Functional Requirements

### 7.1 Performance
- Sync latency: <2 seconds for files under 1MB
- Collaboration latency: <500ms for text edits
- API response time: <200ms (p95)
- Search results: <1 second for 10k notes
- Plugin startup time: <3 seconds

### 7.2 Scalability
- Support 10,000+ concurrent users
- Handle vaults up to 50GB
- Process 1,000+ sync operations/minute
- Database: 1M+ users, 100M+ files

### 7.3 Reliability
- 99.9% uptime SLA (for paid plans)
- Automated failover for critical services
- Data replication across 3 regions
- Automated backups every 6 hours
- Disaster recovery plan (RTO: 4 hours, RPO: 1 hour)

### 7.4 Usability
- Plugin setup in <5 minutes
- Zero-config sync (automatic after login)
- Clear error messages with recovery actions
- Comprehensive documentation
- In-app tooltips and guides

### 7.5 Compatibility
- Obsidian desktop: v1.0.0+
- Obsidian mobile (iOS/Android): v1.4.0+
- Browsers (admin dashboard): Chrome, Firefox, Safari, Edge (latest 2 versions)
- Operating systems: Windows 10+, macOS 11+, Linux (Ubuntu 20.04+)

---

## 8. User Interface Specifications

### 8.1 Obsidian Plugin UI

**Settings Tab**
- Account section:
  - Login/logout
  - Subscription status
  - Storage usage
- Sync settings:
  - Enable/disable sync
  - Selective sync folder picker
  - Sync frequency (real-time, hourly, manual)
  - Full vault backup toggle (when allowed by plan)
  - Full vault backup frequency selector (based on plan limits)
- Security settings:
  - View encryption key
  - Download recovery phrase
  - Enable 2FA
- Collaboration settings:
  - Default share permissions
  - Show/hide presence indicators

**Share Modal** (right-click context menu)
- Share link generation
- Permission selector (public view, public edit, private)
- Collaborator list with roles
- Copy link button
- Advanced options (password, expiration)
- Accessible from sidebar file/folder context menu ("Share & Access Control")
- Shared-state badge/indicator visible in file context and active note status

**Sync Status Bar**
- Icon with sync status (✅ 🔄 ⚠️ ❌)
- Click to open sync details panel
- Last sync timestamp
- Manual sync button

**Version History Panel**
- Timeline slider
- Diff viewer (side-by-side or inline)
- Restore button
- Author attribution

**Search Enhancement**
- Enhanced search modal (Ctrl/Cmd+Shift+F)
- Filter panel (tags, dates, authors)
- Result snippets with highlighting

### 8.2 Admin Dashboard UI

**Layout**
- Sidebar navigation:
  - Dashboard
  - Users
  - Plans
  - Payments
  - Content
  - Storage
  - Settings
  - Logs
- Top bar:
  - Search (users, transactions)
  - Notifications
  - Admin profile menu

**Dashboard Page**
- Metric cards (users, revenue, storage)
- Charts:
  - User growth (line chart)
  - Revenue trend (bar chart)
  - Storage usage (pie chart)
- Recent activity feed
- System health indicators

**User Management Page**
- Data table with filters:
  - Search by email/name
  - Filter by plan, status, join date
  - Sort by any column
- Bulk actions toolbar
- User detail modal/page
- Export to CSV

**Plan Management Page**
- Plan cards (visual overview)
- Create/edit plan form
- Feature toggle matrix
- Pricing calculator

**Payment Dashboard**
- Transaction table
- Revenue charts
- Refund management
- Failed payment alerts

---

## 9. Testing Requirements

### 9.1 Unit Testing
- All API endpoints (>80% coverage)
- Encryption/decryption functions (100% coverage)
- CRDT operations
- Permission logic

### 9.2 Integration Testing
- End-to-end sync workflows
- Collaboration scenarios (2+ users)
- Payment gateway integration
- Email delivery

### 9.3 Security Testing
- Penetration testing (pre-launch)
- Encryption audit
- Authentication flow testing
- Rate limiting verification

### 9.4 Performance Testing
- Load testing (1,000 concurrent users)
- Sync performance benchmarks
- Database query optimization
- CDN performance

### 9.5 Compatibility Testing
- Obsidian versions (last 3 releases)
- Operating systems (Windows, macOS, Linux)
- Mobile devices (iOS, Android)
- Browser compatibility (admin dashboard)

---

## 10. Documentation Requirements

### 10.1 User Documentation
- Getting started guide
- Installation instructions
- Sync setup walkthrough
- Collaboration guide
- Publishing tutorial
- FAQ
- Troubleshooting guide
- Video tutorials

### 10.2 Developer Documentation
- Architecture overview
- API reference
- Plugin development guide
- Self-hosting instructions
- Database schema documentation
- Contributing guidelines

### 10.3 Admin Documentation
- Admin dashboard guide
- User management procedures
- Payment processing guide
- Content moderation policies
- System maintenance procedures

---

## 11. Deployment & Operations

### 11.1 Deployment Strategy
- Staging environment for testing
- Blue-green deployment for zero downtime
- Automated deployment pipeline (CI/CD)
- Rollback procedures
- Database migration strategy

### 11.2 Monitoring
- Application performance monitoring (APM)
- Error tracking (Sentry)
- Uptime monitoring
- Log aggregation
- Alerting system (email, Slack)

### 11.3 Backup & Recovery
- Automated database backups (daily)
- S3 bucket versioning
- Backup verification tests
- Disaster recovery drills (quarterly)
- Data retention policies

### 11.4 Maintenance
- Security patches (within 48 hours)
- Dependency updates (monthly)
- Performance optimization (quarterly)
- Database cleanup (weekly)
- Scheduled maintenance windows

---

## 12. Open Source Considerations

### 12.1 Repository Structure
```
/plugin          # Obsidian plugin code
/server          # Backend API server
/admin           # Admin dashboard
/docs            # Documentation
/tests           # Test suites
/scripts         # Deployment scripts
/docker          # Docker configurations
```

### 12.2 Licensing
- Main codebase: MIT License
- Documentation: CC BY 4.0
- Contributor License Agreement (CLA) required

### 12.3 Community Guidelines
- Code of Conduct
- Contributing guidelines
- Issue templates
- Pull request templates
- Governance model

### 12.4 Self-Hosting Support
- Docker Compose setup
- Environment variable documentation
- Database initialization scripts
- Reverse proxy examples (nginx, Caddy)
- SSL certificate setup guide

---

## 13. Success Metrics

### 13.1 User Metrics
- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- User retention rate (30-day, 90-day)
- Churn rate
- Net Promoter Score (NPS)

### 13.2 Technical Metrics
- Sync success rate (target: >99%)
- Average sync latency
- Collaboration session duration
- Search query response time
- API error rate (target: <1%)

### 13.3 Business Metrics
- Conversion rate (free → paid)
- Monthly Recurring Revenue (MRR)
- Customer Lifetime Value (LTV)
- Customer Acquisition Cost (CAC)
- Payment success rate

### 13.4 Feature Adoption
- Collaboration feature usage
- Published sites created
- Version history restores
- Selective sync adoption
- Search query volume

---

## 14. Future Enhancements (Post-MVP)

### 14.1 Phase 2 Features
- Commenting system
- @mentions with notifications
- Real-time notifications (in-app, email, push)
- Advanced analytics (heatmaps, reading time)
- Template marketplace
- Folder-level sharing

### 14.2 Phase 3 Features
- Mobile-native apps (iOS, Android)
- Offline-first architecture improvements
- AI-powered features (suggestions, summaries)
- Third-party integrations (Zapier, Slack)
- Advanced team features (projects, workflows)
- Custom branding for published sites

### 14.3 Enterprise Features
- Self-hosted deployment options
- Advanced SSO (SAML, LDAP)
- Compliance certifications (SOC 2, ISO 27001)
- Custom SLAs
- Dedicated support
- White-label options

---

## 15. Appendices

### 15.1 Glossary
- **CRDT:** Conflict-free Replicated Data Type
- **E2E:** End-to-End (encryption)
- **JWT:** JSON Web Token
- **MRR:** Monthly Recurring Revenue
- **ARR:** Annual Recurring Revenue
- **SLA:** Service Level Agreement

### 15.2 References
- Obsidian Plugin API Documentation
- Yjs CRDT Library
- Stripe API Documentation
- Web Crypto API
- PostgreSQL Documentation

### 15.3 Revision History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-14 | Initial | First draft |

---

**End of PRD**
