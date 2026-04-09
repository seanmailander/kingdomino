# Crown Overlay on Tiles — Design Spec

**Date:** 2026-04-09  
**Feature:** Display card value via crown overlay (NEXT #1 from docs/todos.md)

---

## Problem

Tiles in the `Tile` component receive a `value` prop (0–3 crown count) from card data but the value is ignored (`_value`). Players cannot see how many crowns a domino tile has without reading the rulebook.

---

## Goal

Render small crown icons (`♛`) overlaid on each tile that has crowns, one icon per crown value. Tiles with zero crowns show no overlay.

---

## Scope

- **In scope:** `Tile` component renders a crown overlay; CSS additions; one Storybook story for visual TDD.
- **Out of scope:** Crown display on the placed board (board tiles use a separate render path); animated crowns; alternative icon sources.

---

## Design

### Data Flow

No data-model changes required. The prop chain is already wired:

```
cards.ts  →  Card.tsx  →  Tile.tsx
  { tile, value }         value (currently ignored)
```

### Component Change: `Tile.tsx`

- Remove the `_value` underscore convention — read `value` actively.
- When `value > 0`, render an overlay `div` with `value` number of `♛` characters.
- When `value === 0` (or undefined), render nothing for the overlay.

```tsx
{value > 0 && (
  <div className="crown-overlay" aria-label={`${value} crown${value > 1 ? "s" : ""}`}>
    {"♛".repeat(value)}
  </div>
)}
```

The `aria-label` makes the overlay accessible and queryable in tests.

### CSS Change: `Card.css`

Add to `.card .tile`:
- `position: relative` — establishes stacking context for the overlay.

Add `.crown-overlay`:
- `position: absolute`
- Anchored bottom-center of the tile
- Dark semi-transparent background for contrast against any terrain
- White crown symbols, readable at 80×80px tile size

```css
.card .tile {
  /* existing: float: left; height: 80px; width: 80px; */
  position: relative;
}

.crown-overlay {
  position: absolute;
  bottom: 2px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 18px;
  line-height: 1;
  background: rgba(0, 0, 0, 0.45);
  color: #ffe066;
  pointer-events: none;
  border-radius: 0 0 3px 3px;
}
```

---

## Testing

### Storybook Visual TDD Story

Create `Tile.stories.tsx` in `packages/client/src/game/visuals/` with stories:

| Story | Tile | Crowns | Assertion |
|-------|------|--------|-----------|
| `NoCrowns` | `wood` | 0 | No element with role/aria matching "crown" present |
| `OneCrown` | `grain` | 1 | One `♛` visible |
| `TwoCrowns` | `water` | 2 | Two `♛` visible |
| `ThreeCrowns` | `mine` | 3 | Three `♛` visible |

Play functions assert via `aria-label` (`/1 crown/i`, `/2 crowns/i`, `/3 crowns/i`) or text content.

---

## Acceptance Criteria

1. A tile with `value={0}` renders no crown overlay.
2. A tile with `value={1}` renders one `♛` symbol.
3. A tile with `value={2}` renders two `♛` symbols.
4. A tile with `value={3}` renders three `♛` symbols.
5. Crown overlay does not intercept pointer events (cards remain clickable).
6. All Storybook story tests pass.
