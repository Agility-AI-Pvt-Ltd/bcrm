# Graph Report - bcrm  (2026-08-15)

## Corpus Check
- 150 files · ~367,894 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 650 nodes · 1038 edges · 51 communities (39 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f89cdee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ComponentCard.tsx
- contactIntelligence.ts
- dependencies
- Calendar.tsx
- AppSidebar.tsx
- devDependencies
- ecommerce/page.tsx
- DashboardPlaceholder.tsx
- compilerOptions
- RecentOrders.tsx
- Badge.tsx
- PageBreadCrumb.tsx
- avatars/page.tsx
- images/page.tsx
- videos/page.tsx
- Changelog
- CampaignWorkspace.tsx
- ChatPage.tsx
- InboxPage.tsx
- bar-chart/page.tsx
- line-chart/page.tsx
- PropertiesPage.tsx
- SupportReplyPage.tsx
- SupportTicketsPage.tsx
- alerts/page.tsx
- 2. API Endpoints Reference
- .eslintrc.json
- Form.tsx
- RadioSm.tsx
- Pagination.tsx
- AvatarText.tsx
- eslint.config.mjs
- jsvectormap.d.ts
- next.config.ts
- svg.d.ts
- Pre-Implementation Checklist
- signup/page.tsx
- MultiSelect.tsx
- rules/graphify.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `ComponentCard()` - 24 edges
2. `apiFetch()` - 23 edges
3. `PageBreadcrumb()` - 22 edges
4. `useModal()` - 19 edges
5. `compilerOptions` - 16 edges
6. `Label()` - 14 edges
7. `LeadsPage()` - 13 edges
8. `Changelog` - 13 edges
9. `Badge()` - 11 edges
10. `Pre-Implementation Checklist` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AdminLayout()` --calls--> `useSidebar()`  [EXTRACTED]
  src/app/(admin)/layout.tsx → src/context/SidebarContext.tsx
- `Calendar()` --calls--> `useModal()`  [EXTRACTED]
  src/components/calendar/Calendar.tsx → src/hooks/useModal.ts
- `getContactDataset()` --calls--> `apiFetch()`  [EXTRACTED]
  src/lib/contactIntelligence.ts → src/lib/api.ts
- `listContacts()` --calls--> `apiFetch()`  [EXTRACTED]
  src/lib/contactIntelligence.ts → src/lib/api.ts
- `ContactsAssistantChat()` --calls--> `chatContactsAssistant()`  [EXTRACTED]
  src/components/campaigns/ContactsAssistantChat.tsx → src/lib/contactIntelligence.ts

## Import Cycles
- None detected.

## Communities (51 total, 12 thin omitted)

### Community 0 - "ComponentCard.tsx"
Cohesion: 0.05
Nodes (53): metadata, metadata, metadata, metadata, metadata, SignInForm(), ComponentCard(), ComponentCardProps (+45 more)

### Community 1 - "contactIntelligence.ts"
Cohesion: 0.06
Nodes (63): metadata, metadata, ContactsAssistantChat(), getOrCreateSessionId(), ContactsPage(), MergeMode, SourceMode, LeadsPage() (+55 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (49): apexcharts, autoprefixer, flatpickr, framer-motion, @fullcalendar/core, @fullcalendar/daygrid, @fullcalendar/interaction, @fullcalendar/list (+41 more)

### Community 3 - "Calendar.tsx"
Cohesion: 0.33
Nodes (3): metadata, Calendar(), CalendarEvent

### Community 4 - "AppSidebar.tsx"
Cohesion: 0.08
Nodes (24): AdminLayout(), metadata, outfit, GridShape(), ThemeToggleButton(), ThemeTogglerTwo(), SidebarContext, SidebarContextType (+16 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (38): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, postcss (+30 more)

### Community 6 - "ecommerce/page.tsx"
Cohesion: 0.10
Nodes (21): metadata, ChartTab(), CountryMap(), CountryMapProps, Marker, MarkerStyle, VectorMap, DemographicCard() (+13 more)

### Community 7 - "DashboardPlaceholder.tsx"
Cohesion: 0.09
Nodes (11): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+3 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 9 - "RecentOrders.tsx"
Cohesion: 0.14
Nodes (17): metadata, Product, RecentOrders(), tableData, BasicTableOne(), Order, tableData, Table() (+9 more)

### Community 10 - "Badge.tsx"
Cohesion: 0.25
Nodes (6): metadata, Badge(), BadgeColor, BadgeProps, BadgeSize, BadgeVariant

### Community 11 - "PageBreadCrumb.tsx"
Cohesion: 0.24
Nodes (5): metadata, metadata, BreadcrumbProps, PageBreadcrumb(), InboxDetailsPage()

### Community 12 - "avatars/page.tsx"
Cohesion: 0.25
Nodes (6): metadata, Avatar(), AvatarProps, sizeClasses, statusColorClasses, statusSizeClasses

### Community 13 - "images/page.tsx"
Cohesion: 0.31
Nodes (4): metadata, ResponsiveImage(), ThreeColumnImageGrid(), TwoColumnImageGrid()

### Community 14 - "videos/page.tsx"
Cohesion: 0.28
Nodes (5): metadata, VideosExample(), AspectRatio, YouTubeEmbed(), YouTubeEmbedProps

### Community 15 - "Changelog"
Cohesion: 0.06
Nodes (31): Breaking Changes, Changelog, Cloning the Repository, Components, Demos, Feature Comparison, Free Version, Installation (+23 more)

### Community 16 - "CampaignWorkspace.tsx"
Cohesion: 0.38
Nodes (4): metadata, CampaignWorkspace(), parseContacts(), sampleCampaigns

### Community 17 - "ChatPage.tsx"
Cohesion: 0.33
Nodes (4): metadata, ChatPage(), contacts, messages

### Community 18 - "InboxPage.tsx"
Cohesion: 0.40
Nodes (3): metadata, emails, InboxPage()

### Community 19 - "bar-chart/page.tsx"
Cohesion: 0.40
Nodes (3): metadata, BarChartOne(), ReactApexChart

### Community 20 - "line-chart/page.tsx"
Cohesion: 0.40
Nodes (3): metadata, LineChartOne(), ReactApexChart

### Community 21 - "PropertiesPage.tsx"
Cohesion: 0.40
Nodes (3): metadata, properties, PropertiesPage()

### Community 22 - "SupportReplyPage.tsx"
Cohesion: 0.40
Nodes (3): metadata, SupportReplyPage(), thread

### Community 23 - "SupportTicketsPage.tsx"
Cohesion: 0.40
Nodes (3): metadata, SupportTicketsPage(), tickets

### Community 24 - "alerts/page.tsx"
Cohesion: 0.40
Nodes (3): metadata, Alert(), AlertProps

### Community 25 - "2. API Endpoints Reference"
Cohesion: 0.08
Nodes (23): 1. Core Data Enums & Values, 1. List Pending Drafts, 1. Retrieve Priority Queue, 1. Retrieve Settings, 1. Upload Voice Note, 2. API Endpoints Reference, 2. Approve & Send Draft, 2. Get Recommended Channel (+15 more)

### Community 46 - "Pre-Implementation Checklist"
Cohesion: 0.17
Nodes (11): Cold-Calling & Follow-Up Workspace — Frontend (RealtyReach / EstateFlow), Final Go/No-Go, Pre-Implementation Checklist, Section A — API Contract Alignment, Section B — Lead State Model, Section C — Calling UX (Decide Before Building Any Call UI), Section D — Compliance Enforcement in UI, Section E — Async & Failure States (Real Behavior, Not Simulated) (+3 more)

### Community 48 - "MultiSelect.tsx"
Cohesion: 0.50
Nodes (3): MultiSelect(), MultiSelectProps, Option

## Knowledge Gaps
- **250 isolated node(s):** `extends`, `next/core-web-vitals`, `eslintConfig`, `jsvectormap`, `nextConfig` (+245 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PageBreadcrumb()` connect `PageBreadCrumb.tsx` to `ComponentCard.tsx`, `contactIntelligence.ts`, `Calendar.tsx`, `DashboardPlaceholder.tsx`, `RecentOrders.tsx`, `Badge.tsx`, `avatars/page.tsx`, `images/page.tsx`, `videos/page.tsx`, `ChatPage.tsx`, `InboxPage.tsx`, `bar-chart/page.tsx`, `line-chart/page.tsx`, `PropertiesPage.tsx`, `SupportReplyPage.tsx`, `SupportTicketsPage.tsx`, `alerts/page.tsx`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `Badge()` connect `Badge.tsx` to `contactIntelligence.ts`, `ecommerce/page.tsx`, `RecentOrders.tsx`, `PropertiesPage.tsx`, `SupportReplyPage.tsx`, `SupportTicketsPage.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `ComponentCard()` connect `ComponentCard.tsx` to `RecentOrders.tsx`, `avatars/page.tsx`, `images/page.tsx`, `videos/page.tsx`, `bar-chart/page.tsx`, `line-chart/page.tsx`, `alerts/page.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `extends`, `next/core-web-vitals`, `eslintConfig` to the rest of the system?**
  _250 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ComponentCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.054491899852724596 - nodes in this community are weakly interconnected._
- **Should `contactIntelligence.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05789473684210526 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._