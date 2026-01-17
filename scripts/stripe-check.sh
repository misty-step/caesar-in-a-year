#!/bin/bash
# stripe-check.sh - Validate Stripe configuration before deployment
#
# Run: ./scripts/stripe-check.sh
# Options:
#   --local-only    Skip Stripe CLI validation (env vars only)
#   --ci            Exit 1 on warnings (strict mode for CI)
#
# Returns:
#   0 = All checks passed
#   1 = Critical issues found (checkout will fail)
#   2 = Warnings only (--ci mode treats as failure)

set -e

LOCAL_ONLY=false
CI_MODE=false

for arg in "$@"; do
  case $arg in
    --local-only) LOCAL_ONLY=true ;;
    --ci) CI_MODE=true ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║               Stripe Configuration Audit                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# --- Helper functions ---
check_env() {
  local var_name=$1
  local required=$2
  local value="${!var_name}"

  if [ -z "$value" ]; then
    if [ "$required" = "required" ]; then
      echo "  ❌ $var_name - MISSING (required)"
      ((ERRORS++))
    else
      echo "  ⚠️  $var_name - not set (optional)"
      ((WARNINGS++))
    fi
    return 1
  else
    # Mask value for display
    local masked="${value:0:8}..."
    echo "  ✅ $var_name = $masked"
    return 0
  fi
}

# --- Phase 1: Environment Variables ---
echo "=== Environment Variables ==="
echo ""

check_env "STRIPE_SECRET_KEY" "required"
check_env "STRIPE_PRICE_ID" "required"
check_env "STRIPE_WEBHOOK_SECRET" "required"
check_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "required"
check_env "CONVEX_WEBHOOK_SECRET" "required"

echo ""

# --- Phase 2: Code Quality Checks ---
echo "=== Code Quality ==="
echo ""

# Check for hardcoded keys
echo "  Checking for hardcoded keys..."
if grep -rq 'sk_test_\|sk_live_\|pk_test_\|pk_live_\|whsec_' --include="*.ts" --include="*.tsx" app/ convex/ lib/ src/ 2>/dev/null; then
  echo "  ❌ Hardcoded Stripe keys found in code!"
  ((ERRORS++))
else
  echo "  ✅ No hardcoded keys"
fi

# Check webhook verification exists
echo "  Checking webhook signature verification..."
if grep -rq 'constructEvent\|webhooks\.construct' --include="*.ts" app/ 2>/dev/null; then
  echo "  ✅ Webhook signature verification found"
else
  echo "  ❌ Missing webhook signature verification!"
  ((ERRORS++))
fi

echo ""

# --- Phase 3: Stripe CLI Validation ---
if [ "$LOCAL_ONLY" = false ] && command -v stripe &> /dev/null; then
  echo "=== Stripe CLI Validation ==="
  echo ""

  # Validate price ID exists
  if [ -n "$STRIPE_PRICE_ID" ]; then
    echo "  Validating price ID..."
    if stripe prices retrieve "$STRIPE_PRICE_ID" &>/dev/null; then
      PRICE_INFO=$(stripe prices retrieve "$STRIPE_PRICE_ID" 2>/dev/null)
      AMOUNT=$(echo "$PRICE_INFO" | grep -o '"unit_amount": [0-9]*' | grep -o '[0-9]*')
      CURRENCY=$(echo "$PRICE_INFO" | grep -o '"currency": "[^"]*"' | cut -d'"' -f4)
      INTERVAL=$(echo "$PRICE_INFO" | grep -o '"interval": "[^"]*"' | cut -d'"' -f4)
      echo "  ✅ Price exists: \$$((AMOUNT/100)).$((AMOUNT%100))/$INTERVAL ($currency)"
    else
      echo "  ❌ Price ID does not exist in Stripe!"
      ((ERRORS++))
    fi
  fi

  # Check webhook endpoints
  echo "  Checking webhook endpoints..."
  WEBHOOK_COUNT=$(stripe webhook_endpoints list --limit 10 2>/dev/null | grep -c '"id":' || echo "0")
  if [ "$WEBHOOK_COUNT" -gt 0 ]; then
    echo "  ✅ $WEBHOOK_COUNT webhook endpoint(s) configured"

    # Check for duplicates
    DUPLICATE_COUNT=$(stripe webhook_endpoints list --limit 10 2>/dev/null | grep '"url":' | sort | uniq -d | wc -l)
    if [ "$DUPLICATE_COUNT" -gt 0 ]; then
      echo "  ⚠️  Duplicate webhook URLs detected"
      ((WARNINGS++))
    fi
  else
    echo "  ⚠️  No webhook endpoints configured"
    ((WARNINGS++))
  fi

  echo ""
else
  if [ "$LOCAL_ONLY" = false ]; then
    echo "=== Stripe CLI Validation ==="
    echo "  ⚠️  Stripe CLI not available - skipping API validation"
    echo ""
    ((WARNINGS++))
  fi
fi

# --- Summary ---
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ FAILED: $ERRORS critical issue(s), $WARNINGS warning(s)"
  echo ""
  echo "Fix critical issues before deploying - checkout will fail!"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  PASSED with $WARNINGS warning(s)"
  if [ "$CI_MODE" = true ]; then
    echo "   (CI mode: treating warnings as failures)"
    exit 2
  fi
  exit 0
else
  echo "✅ PASSED: All Stripe configuration checks passed"
  exit 0
fi
