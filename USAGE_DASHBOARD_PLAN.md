# Usage Dashboard Plan for claude-run

## Overview

Add a comprehensive usage dashboard to claude-run that displays token usage over time, per-thread metrics, and estimated costs based on Claude API pricing.

---

## Current State Analysis

### Token Data Already Available

The codebase already stores token usage data in the `ConversationMessage.message.usage` field:

```typescript
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
```

This data is present in assistant messages within `.jsonl` session files but is **not currently displayed** in the UI.

### Tech Stack
- **Backend**: Hono.js REST API + SSE streaming
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Storage**: JSONL files in `~/.claude/projects/`

---

## Claude API Pricing (January 2026)

### Standard Pricing (per million tokens)

| Model | Input | Output |
|-------|-------|--------|
| Claude Haiku 3 | $0.25 | $1.25 |
| Claude Haiku 3.5 | $0.80 | $4.00 |
| Claude Haiku 4.5 | $1.00 | $5.00 |
| Claude Sonnet 4 | $3.00 | $15.00 |
| Claude Sonnet 4.5 | $3.00 | $15.00 |
| Claude Opus 4 | $15.00 | $75.00 |
| Claude Opus 4.5 | $5.00 | $25.00 |

### Cache Pricing
- **Cache writes**: 1.25x base input price (5-min cache) or 2x (1-hour cache)
- **Cache reads**: 0.1x base input price (up to 90% savings)

### Batch API
- 50% discount on all tokens for 24-hour async processing

---

## Proposed Architecture

### Phase 1: Data Layer (Backend)

#### New Types (`api/storage.ts`)

```typescript
export interface SessionUsage {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  messageCount: number;
  model?: string;
  estimatedCost: number;
  firstMessageAt: string;
  lastMessageAt: string;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalEstimatedCost: number;
  sessionCount: number;
  messageCount: number;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
  byDate: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
  byProject: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    sessionCount: number;
  }>;
}

export interface TimeRange {
  start?: string; // ISO date
  end?: string;   // ISO date
}
```

#### New Functions (`api/storage.ts`)

```typescript
// Calculate usage for a single session
export async function getSessionUsage(sessionId: string): Promise<SessionUsage | null>;

// Aggregate usage across all sessions with optional filters
export async function getUsageSummary(options?: {
  timeRange?: TimeRange;
  project?: string;
}): Promise<UsageSummary>;

// Get daily usage for charting
export async function getDailyUsage(days?: number): Promise<Array<{
  date: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  sessionCount: number;
}>>;
```

#### Cost Calculation Utility (`api/pricing.ts`)

```typescript
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWriteMultiplier: number;
  cacheReadMultiplier: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-5-20251101': { inputPerMillion: 5, outputPerMillion: 25, ... },
  'claude-sonnet-4-5-20251101': { inputPerMillion: 3, outputPerMillion: 15, ... },
  'claude-haiku-4-5-20251101': { inputPerMillion: 1, outputPerMillion: 5, ... },
  // Legacy models
  'claude-opus-4-20251014': { inputPerMillion: 15, outputPerMillion: 75, ... },
  // ... etc
};

export function calculateCost(usage: TokenUsage, model?: string): number;
export function formatCost(cents: number): string;
```

### Phase 2: API Endpoints (`api/server.ts`)

```typescript
// Get usage summary with optional filters
app.get('/api/usage/summary', async (c) => {
  const timeRange = c.req.query('timeRange'); // 'day' | 'week' | 'month' | 'all'
  const project = c.req.query('project');
  return c.json(await getUsageSummary({ timeRange, project }));
});

// Get usage for a specific session
app.get('/api/usage/session/:id', async (c) => {
  return c.json(await getSessionUsage(c.req.param('id')));
});

// Get daily usage for charts
app.get('/api/usage/daily', async (c) => {
  const days = parseInt(c.req.query('days') || '30');
  return c.json(await getDailyUsage(days));
});

// Get per-session usage list (for table view)
app.get('/api/usage/sessions', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const sortBy = c.req.query('sortBy') || 'cost'; // 'cost' | 'tokens' | 'date'
  return c.json(await getSessionsWithUsage({ limit, offset, sortBy }));
});
```

### Phase 3: Frontend Components

#### Recommended Chart Library: **Recharts**

Recharts is the best fit for this project because:
- Built specifically for React (no D3 wrapper)
- Simple API that matches React component patterns
- Good documentation and community support
- Handles SVG rendering well for <100 data points (perfect for usage charts)
- 24.8K GitHub stars, actively maintained

Install: `pnpm add recharts`

#### Component Structure

```
web/components/
├── usage/
│   ├── usage-dashboard.tsx      # Main dashboard container
│   ├── usage-summary-cards.tsx  # KPI cards (total tokens, cost, etc.)
│   ├── usage-chart.tsx          # Time-series line/area chart
│   ├── usage-by-model.tsx       # Pie/bar chart by model
│   ├── usage-by-project.tsx     # Bar chart by project
│   ├── session-usage-table.tsx  # Sortable table of sessions
│   └── usage-filters.tsx        # Time range & project filters
```

#### Dashboard Layout (Best Practices Applied)

Following dashboard design best practices:
- **5-7 primary KPIs** at the top (total tokens, cost, sessions, avg per session)
- **Visual hierarchy**: Most important metrics at top-left
- **Consistent card layout** for charts
- **Color as signal**: Use brand colors, highlight color for attention, reserved color for cost/alerts
- **Filters above content** with clear labels

```
┌─────────────────────────────────────────────────────────────┐
│  Usage Dashboard                        [Time Range ▼] [Project ▼]  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Total    │ │ Total    │ │ Est.     │ │ Sessions │      │
│  │ Input    │ │ Output   │ │ Cost     │ │          │      │
│  │ 1.2M     │ │ 450K     │ │ $12.50   │ │ 47       │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                            │
│  ┌─────────────────────────────────────────────────┐      │
│  │           Token Usage Over Time                  │      │
│  │  [Area chart with input/output stacked]          │      │
│  │                                                  │      │
│  └─────────────────────────────────────────────────┘      │
│                                                            │
│  ┌──────────────────────┐ ┌──────────────────────┐        │
│  │  Usage by Model      │ │  Usage by Project    │        │
│  │  [Pie/Donut chart]   │ │  [Horizontal bars]   │        │
│  └──────────────────────┘ └──────────────────────┘        │
│                                                            │
│  ┌─────────────────────────────────────────────────┐      │
│  │  Session Details                    [Sort: Cost ▼]│      │
│  │  ┌──────────────────────────────────────────┐  │      │
│  │  │ Session Name │ Tokens │ Cost │ Date      │  │      │
│  │  ├──────────────┼────────┼──────┼───────────┤  │      │
│  │  │ Fix bug...   │ 45.2K  │ $0.52│ Today     │  │      │
│  │  │ Add feature..│ 123K   │ $1.23│ Yesterday │  │      │
│  │  └──────────────────────────────────────────┘  │      │
│  └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Integration with Existing UI

#### Option A: New Tab/View (Recommended)

Add a tab or navigation element to switch between "Conversations" and "Usage":

```tsx
// In app.tsx
const [view, setView] = useState<'conversations' | 'usage'>('conversations');

return (
  <div>
    <nav>
      <button onClick={() => setView('conversations')}>Conversations</button>
      <button onClick={() => setView('usage')}>Usage</button>
    </nav>
    {view === 'conversations' ? (
      <SessionList ... />
    ) : (
      <UsageDashboard />
    )}
  </div>
);
```

#### Option B: Sidebar Panel

Add a collapsible usage summary panel in the sidebar below the session list.

#### Option C: Session-Level Usage

Add token usage badges to each session in the list and a detailed breakdown in the session view header.

**Recommendation**: Implement Option A (dedicated tab) with elements of Option C (session badges).

### Phase 5: Per-Message Token Display

Add subtle token indicators to message blocks:

```tsx
// In message-block.tsx
{message.message?.usage && (
  <span className="text-xs text-gray-500">
    {formatTokens(message.message.usage.input_tokens + message.message.usage.output_tokens)}
  </span>
)}
```

---

## Implementation Tasks

### Backend Tasks
1. [ ] Create `api/pricing.ts` with model pricing constants and cost calculation
2. [ ] Add `getSessionUsage()` function to storage.ts
3. [ ] Add `getUsageSummary()` function with aggregation logic
4. [ ] Add `getDailyUsage()` function for time-series data
5. [ ] Add new API endpoints: `/api/usage/summary`, `/api/usage/session/:id`, `/api/usage/daily`
6. [ ] Add caching layer for usage calculations (expensive to compute on every request)

### Frontend Tasks
7. [ ] Install Recharts: `pnpm add recharts`
8. [ ] Create `UsageDashboard` container component
9. [ ] Create `UsageSummaryCards` component (KPI cards)
10. [ ] Create `UsageChart` component (time-series with Recharts)
11. [ ] Create `UsageByModel` pie/donut chart
12. [ ] Create `UsageByProject` horizontal bar chart
13. [ ] Create `SessionUsageTable` sortable table
14. [ ] Create `UsageFilters` component (time range, project dropdowns)
15. [ ] Add navigation to switch between Conversations and Usage views
16. [ ] Add token badges to session list items
17. [ ] Add token summary to session header

### Polish & Performance
18. [ ] Add loading states for dashboard components
19. [ ] Implement responsive design for mobile
20. [ ] Add export functionality (CSV download)
21. [ ] Add data refresh mechanism (SSE or polling)
22. [ ] Performance optimization: lazy load dashboard, virtualize large tables

---

## File Changes Summary

### New Files
- `api/pricing.ts` - Cost calculation utilities
- `web/components/usage/usage-dashboard.tsx`
- `web/components/usage/usage-summary-cards.tsx`
- `web/components/usage/usage-chart.tsx`
- `web/components/usage/usage-by-model.tsx`
- `web/components/usage/usage-by-project.tsx`
- `web/components/usage/session-usage-table.tsx`
- `web/components/usage/usage-filters.tsx`

### Modified Files
- `api/storage.ts` - Add usage calculation functions
- `api/server.ts` - Add usage API endpoints
- `web/app.tsx` - Add view navigation
- `web/components/session-list.tsx` - Add token badges
- `web/components/session-view.tsx` - Add usage summary to header
- `package.json` - Add recharts dependency

---

## Design Best Practices Applied

Based on research from [Yellowfin](https://www.yellowfinbi.com/blog/key-dashboard-design-principles-analytics-best-practice), [DataCamp](https://www.datacamp.com/tutorial/dashboard-design-tutorial), [Toptal](https://www.toptal.com/designers/data-visualization/dashboard-design-best-practices), and [Grafana](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/):

1. **5-second rule**: Key metrics visible at a glance
2. **5-7 primary KPIs**: Not overwhelming users
3. **Visual hierarchy**: Most important data top-left
4. **Consistent card layout**: Uniform chart treatment
5. **Color as signal**: Brand colors + highlight for attention + reserved for cost
6. **Filters above content**: Easy to find and use
7. **Group related items**: Token metrics together, cost metrics together
8. **Appropriate time frames**: Daily for monitoring, weekly/monthly for trends
9. **Avoid clutter**: Progressive disclosure through drill-down
10. **Accessibility**: Color-blind friendly with icons/patterns as backup

---

## Chart Library Justification

**Recharts** selected based on research from [LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2025/), [DEV Community](https://dev.to/basecampxd/top-7-react-chart-libraries-for-2026-features-use-cases-and-benchmarks-412c), and [Embeddable](https://embeddable.com/blog/react-chart-libraries):

- ✅ Built for React (not a D3 wrapper)
- ✅ Simple, declarative API
- ✅ Excellent documentation
- ✅ Active community (24.8K GitHub stars)
- ✅ Works with CSS/styled-components
- ✅ Perfect for dashboard use case (<100 data points per chart)
- ⚠️ Not ideal for 5000+ data points (not our use case)

Alternatives considered:
- **Victory**: More modular but heavier learning curve
- **Visx**: Too low-level for this use case
- **Chart.js**: Not React-native
- **Unovis**: Newer, less documentation

---

## Cost Estimation Example

For a typical Claude Code session using Opus 4.5:
- Input: 50,000 tokens @ $5/million = $0.25
- Output: 15,000 tokens @ $25/million = $0.375
- **Total: $0.625 per session**

With cache hits (90% savings on repeated prompts):
- Cache reads: 45,000 tokens @ $0.50/million = $0.0225
- Fresh input: 5,000 tokens @ $5/million = $0.025
- **Effective input cost: $0.0475** (81% savings)

---

## Future Enhancements (Out of Scope)

- Budget alerts and notifications
- Cost forecasting based on trends
- Team/org usage aggregation
- API key usage tracking
- Comparison with previous periods
- PDF/image export of charts
