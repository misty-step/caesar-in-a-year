#!/bin/bash
# verify-env.sh - Validate environment variables across all platforms
#
# Run: ./scripts/verify-env.sh [options]
# Options:
#   --local         Check local .env.local only
#   --vercel        Check Vercel environment (requires vercel CLI)
#   --convex        Check Convex environment (requires npx convex)
#   --prod-only     Only check production environments
#   --ci            Strict mode - exit 1 on any issue
#   --help          Show this help message
#
# Returns:
#   0 = All checks passed
#   1 = Critical issues found (app will fail)
#   2 = Configuration warnings

set -e

# --- Argument parsing ---
CHECK_LOCAL=false
CHECK_VERCEL=false
CHECK_CONVEX=false
PROD_ONLY=false
CI_MODE=false
SHOW_HELP=false

# Default: check all if no specific platform specified
NO_PLATFORM_SPECIFIED=true

for arg in "$@"; do
  case $arg in
    --local) CHECK_LOCAL=true; NO_PLATFORM_SPECIFIED=false ;;
    --vercel) CHECK_VERCEL=true; NO_PLATFORM_SPECIFIED=false ;;
    --convex) CHECK_CONVEX=true; NO_PLATFORM_SPECIFIED=false ;;
    --prod-only) PROD_ONLY=true ;;
    --ci) CI_MODE=true ;;
    --help) SHOW_HELP=true ;;
  esac
done

if [ "$NO_PLATFORM_SPECIFIED" = true ]; then
  CHECK_LOCAL=true
  CHECK_VERCEL=true
  CHECK_CONVEX=true
fi

if [ "$SHOW_HELP" = true ]; then
  head -16 "$0" | tail -14
  exit 0
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Environment Variable Verification                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# --- Format patterns for validation ---
# Pattern: "VAR_NAME:REGEX:HINT"
declare -a FORMAT_PATTERNS=(
  "STRIPE_SECRET_KEY:^sk_(test|live)_:Should start with sk_test_ or sk_live_"
  "STRIPE_WEBHOOK_SECRET:^whsec_:Should start with whsec_"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:^pk_(test|live)_:Should start with pk_test_ or pk_live_"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:^pk_(test|live)_:Should start with pk_test_ or pk_live_"
  "CLERK_SECRET_KEY:^sk_(test|live)_:Should start with sk_test_ or sk_live_"
  "CLERK_JWT_ISSUER_DOMAIN:^https://:Should be https:// URL"
  "CONVEX_WEBHOOK_SECRET:^[A-Za-z0-9+/=]{20,}$:Should be base64 or hex string (min 20 chars)"
  "GEMINI_API_KEY:^AI:Should start with AI"
)

# --- Helper functions ---
mask_value() {
  local value="$1"
  local len=${#value}
  if [ $len -le 8 ]; then
    echo "***"
  else
    echo "${value:0:8}...${value: -4}"
  fi
}

check_format() {
  local var_name="$1"
  local value="$2"

  for pattern_entry in "${FORMAT_PATTERNS[@]}"; do
    local pattern_var=$(echo "$pattern_entry" | cut -d: -f1)
    local regex=$(echo "$pattern_entry" | cut -d: -f2)
    local hint=$(echo "$pattern_entry" | cut -d: -f3-)

    if [ "$pattern_var" = "$var_name" ]; then
      if ! [[ "$value" =~ $regex ]]; then
        echo "    ⚠️  Invalid format: $hint"
        return 1
      fi
    fi
  done
  return 0
}

check_trailing_whitespace() {
  local value="$1"
  if [ "$value" != "$(echo -n "$value" | tr -d '\n\r')" ]; then
    echo "    ⚠️  Contains trailing whitespace or newlines!"
    return 1
  fi
  return 0
}

check_env_var() {
  local var_name="$1"
  local value="$2"
  local required="$3"

  if [ -z "$value" ]; then
    if [ "$required" = "required" ]; then
      echo "  ❌ $var_name - MISSING"
      ((ERRORS++))
      return 1
    else
      echo "  ⚠️  $var_name - not set (optional)"
      ((WARNINGS++))
      return 1
    fi
  fi

  local masked=$(mask_value "$value")
  local format_ok=true
  local whitespace_ok=true

  check_format "$var_name" "$value" || format_ok=false
  check_trailing_whitespace "$value" || whitespace_ok=false

  if [ "$format_ok" = false ]; then
    ((WARNINGS++))
  fi
  if [ "$whitespace_ok" = false ]; then
    ((ERRORS++))  # Trailing whitespace is a critical error
  fi

  if [ "$format_ok" = true ] && [ "$whitespace_ok" = true ]; then
    echo "  ✅ $var_name = $masked"
  else
    echo "  $var_name = $masked"
  fi
}

# --- Local Environment Check ---
if [ "$CHECK_LOCAL" = true ]; then
  echo "=== Local Environment (.env.local) ==="
  echo ""

  if [ -f .env.local ]; then
    # Source the file to get values (safely)
    set -a
    source .env.local 2>/dev/null || true
    set +a

    check_env_var "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "required"
    check_env_var "CLERK_SECRET_KEY" "$CLERK_SECRET_KEY" "required"
    check_env_var "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "required"
    check_env_var "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "required"
    check_env_var "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "required"
    check_env_var "STRIPE_PRICE_ID" "$STRIPE_PRICE_ID" "required"
    check_env_var "CONVEX_WEBHOOK_SECRET" "$CONVEX_WEBHOOK_SECRET" "required"
    check_env_var "GEMINI_API_KEY" "$GEMINI_API_KEY" "optional"
    check_env_var "NEXT_PUBLIC_CONVEX_URL" "$NEXT_PUBLIC_CONVEX_URL" "required"

    # Check for test vs live mode consistency
    echo ""
    echo "  Mode check:"
    if [[ "$STRIPE_SECRET_KEY" =~ ^sk_test_ ]] && [[ "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" =~ ^pk_test_ ]]; then
      echo "  ✅ Stripe: test mode"
    elif [[ "$STRIPE_SECRET_KEY" =~ ^sk_live_ ]] && [[ "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" =~ ^pk_live_ ]]; then
      echo "  ✅ Stripe: live mode"
    else
      echo "  ❌ Stripe key mode mismatch (test/live)"
      ((ERRORS++))
    fi

    if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_test_ ]]; then
      echo "  ✅ Clerk: test mode"
    elif [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_live_ ]]; then
      echo "  ✅ Clerk: live mode"
    fi

  else
    echo "  ❌ .env.local not found"
    ((ERRORS++))
  fi

  echo ""
fi

# --- Vercel Environment Check ---
if [ "$CHECK_VERCEL" = true ]; then
  echo "=== Vercel Environment ==="
  echo ""

  if command -v vercel &> /dev/null; then
    ENV_TYPE="production"
    if [ "$PROD_ONLY" = false ]; then
      ENV_TYPE="development"
    fi

    echo "  Checking $ENV_TYPE environment..."

    # Get env var list
    VERCEL_VARS=$(vercel env ls --environment=$ENV_TYPE 2>/dev/null | grep -E '^\s*\w' || echo "")

    if [ -z "$VERCEL_VARS" ]; then
      echo "  ⚠️  Unable to fetch Vercel env vars (run 'vercel login'?)"
      ((WARNINGS++))
    else
      # Check for required vars
      for var in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET CONVEX_WEBHOOK_SECRET CLERK_SECRET_KEY; do
        if echo "$VERCEL_VARS" | grep -q "$var"; then
          echo "  ✅ $var - set"
        else
          echo "  ❌ $var - MISSING"
          ((ERRORS++))
        fi
      done
    fi
  else
    echo "  ⚠️  Vercel CLI not installed - skipping"
    ((WARNINGS++))
  fi

  echo ""
fi

# --- Convex Environment Check ---
if [ "$CHECK_CONVEX" = true ]; then
  echo "=== Convex Environment ==="
  echo ""

  # Check dev
  if [ "$PROD_ONLY" = false ]; then
    echo "  [dev]"
    CONVEX_DEV_VARS=$(npx convex env list 2>/dev/null || echo "")

    if [ -z "$CONVEX_DEV_VARS" ]; then
      echo "  ⚠️  Unable to fetch Convex dev env"
      ((WARNINGS++))
    else
      for var in CLERK_JWT_ISSUER_DOMAIN CONVEX_WEBHOOK_SECRET; do
        if echo "$CONVEX_DEV_VARS" | grep -q "^$var="; then
          VALUE=$(echo "$CONVEX_DEV_VARS" | grep "^$var=" | cut -d= -f2-)
          MASKED=$(mask_value "$VALUE")
          echo "  ✅ $var = $MASKED"
        else
          echo "  ❌ $var - MISSING"
          ((ERRORS++))
        fi
      done
    fi
    echo ""
  fi

  # Check prod
  echo "  [prod]"
  CONVEX_PROD_VARS=$(npx convex env list --prod 2>/dev/null || echo "")

  if [ -z "$CONVEX_PROD_VARS" ]; then
    echo "  ⚠️  Unable to fetch Convex prod env"
    ((WARNINGS++))
  else
    for var in CLERK_JWT_ISSUER_DOMAIN CONVEX_WEBHOOK_SECRET; do
      if echo "$CONVEX_PROD_VARS" | grep -q "^$var="; then
        VALUE=$(echo "$CONVEX_PROD_VARS" | grep "^$var=" | cut -d= -f2-)
        MASKED=$(mask_value "$VALUE")
        echo "  ✅ $var = $MASKED"
      else
        echo "  ❌ $var - MISSING"
        ((ERRORS++))
      fi
    done
  fi

  echo ""
fi

# --- Cross-Platform Parity Check ---
if [ "$CHECK_LOCAL" = true ] && [ "$CHECK_CONVEX" = true ]; then
  echo "=== Cross-Platform Parity ==="
  echo ""

  # Check CONVEX_WEBHOOK_SECRET matches across platforms
  if [ -f .env.local ]; then
    LOCAL_SECRET=$(grep "^CONVEX_WEBHOOK_SECRET=" .env.local 2>/dev/null | cut -d= -f2- | tr -d '\n')
    CONVEX_SECRET=$(npx convex env list 2>/dev/null | grep "^CONVEX_WEBHOOK_SECRET=" | cut -d= -f2-)

    if [ -n "$LOCAL_SECRET" ] && [ -n "$CONVEX_SECRET" ]; then
      if [ "$LOCAL_SECRET" = "$CONVEX_SECRET" ]; then
        echo "  ✅ CONVEX_WEBHOOK_SECRET matches (local ↔ Convex dev)"
      else
        echo "  ❌ CONVEX_WEBHOOK_SECRET MISMATCH (local ≠ Convex dev)"
        echo "     Webhooks will silently fail!"
        ((ERRORS++))
      fi
    fi
  fi

  echo ""
fi

# --- Summary ---
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ FAILED: $ERRORS critical issue(s), $WARNINGS warning(s)"
  echo ""
  echo "Fix critical issues - app will fail without them!"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  PASSED with $WARNINGS warning(s)"
  if [ "$CI_MODE" = true ]; then
    echo "   (CI mode: treating warnings as failures)"
    exit 2
  fi
  exit 0
else
  echo "✅ PASSED: All environment checks passed"
  exit 0
fi
