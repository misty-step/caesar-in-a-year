#!/bin/bash
# lint-tokens.sh - Check for raw color classes that should use semantic tokens
#
# Run: ./scripts/lint-tokens.sh
# Returns exit code 1 if violations found

set -e

echo "Checking for raw color class violations..."
echo ""

# Patterns to check (raw Tailwind color classes)
VIOLATIONS=0

# Check for raw slate/gray/zinc colors (should use text-*, bg-*, border-*)
echo "=== Raw gray-scale colors (use bg-surface, text-text-*, border-border) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E 'bg-(slate|gray|zinc|neutral|stone)-[0-9]+|text-(slate|gray|zinc|neutral|stone)-[0-9]+|border-(slate|gray|zinc|neutral|stone)-[0-9]+' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for raw tyrian colors (should use accent-*)
echo ""
echo "=== Raw tyrian colors (use accent, accent-hover, accent-faint) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E '(bg|text|border|ring|shadow)-tyrian' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for raw laurel colors (should use success, celebration)
echo ""
echo "=== Raw laurel colors (use success, celebration) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E '(bg|text|border|ring)-laurel' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for raw terracotta colors (should use warning)
echo ""
echo "=== Raw terracotta colors (use warning, warning-faint) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E '(bg|text|border|ring)-terracotta' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for raw ink colors (should use text-text-primary/secondary/muted)
echo ""
echo "=== Raw ink colors (use text-text-primary, text-text-secondary, etc) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E 'text-ink(?!-)' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi
if grep -rn --include="*.tsx" --include="*.ts" -E 'text-ink-(light|muted|faint)' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi
if grep -rn --include="*.tsx" --include="*.ts" -E 'bg-ink' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for raw parchment colors (should use bg-background, bg-surface)
echo ""
echo "=== Raw parchment colors (use bg-background, bg-surface) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E 'bg-parchment' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for h-screen (should use h-dvh)
echo ""
echo "=== h-screen usage (use h-dvh for mobile viewport) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E '\bh-screen\b' app/ components/ lib/ 2>/dev/null; then
  VIOLATIONS=1
fi

# Check for w-X h-X patterns (should use size-X)
echo ""
echo "=== w-X h-X patterns (consider size-X for squares) ==="
if grep -rn --include="*.tsx" --include="*.ts" -E 'w-[0-9]+ h-[0-9]+' app/ components/ lib/ 2>/dev/null; then
  echo "(Note: not all are violations, review for equal dimensions)"
fi

echo ""
if [ $VIOLATIONS -eq 1 ]; then
  echo "VIOLATIONS FOUND - Please use semantic tokens instead of raw colors"
  echo ""
  echo "Token Reference:"
  echo "  bg-parchment       → bg-background"
  echo "  bg-slate-*         → bg-surface"
  echo "  text-ink           → text-text-primary"
  echo "  text-ink-light     → text-text-secondary"
  echo "  text-ink-muted     → text-text-muted"
  echo "  text-ink-faint     → text-text-faint"
  echo "  border-slate-*     → border-border"
  echo "  text-tyrian-*      → text-accent"
  echo "  bg-tyrian-*        → bg-accent"
  echo "  text-laurel-*      → text-success / text-celebration"
  echo "  text-terracotta-*  → text-warning"
  echo "  h-screen           → h-dvh"
  exit 1
else
  echo "All clear - no raw color class violations detected"
  exit 0
fi
