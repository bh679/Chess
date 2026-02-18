#!/usr/bin/env bash
# update-scores.sh
# Recalculates the Score field for all items in the Chess Roadmap project.
#
# Score = (Priority × 2) + Time Estimate + Complexity + Status Bonus + Dependency Bonus
#   - Items with Status "Done" get Score = 0
#   - Status bonus: Idea +0, Planned +1, Approved +2, In Development +3, Testing +4
#   - Dependency bonus: sum of base scores of all items that transitively depend
#     on this item (recursive — includes direct and indirect dependants)
#
# Range: 0 (Done) or 4+ (active items)
#
# Requires: gh CLI authenticated with project access (GH_TOKEN env var)

set -euo pipefail

PROJECT_ID="PVT_kwHOACbL3s4BPaw5"
SCORE_FIELD_ID="PVTF_lAHOACbL3s4BPaw5zg93YSY"

# --- Point mappings ---

priority_points() {
  case "$1" in
    "High")   echo 5 ;;
    "Medium") echo 3 ;;
    "Low")    echo 1 ;;
    *)        echo "" ;;
  esac
}

time_points() {
  case "$1" in
    "1-2 hours") echo 5 ;;
    "3-5 hours") echo 4 ;;
    "1 day")     echo 3 ;;
    "2-3 days")  echo 2 ;;
    "1 week+")   echo 1 ;;
    *)           echo "" ;;
  esac
}

complexity_points() {
  case "$1" in
    "Trivial") echo 5 ;;
    "Easy")    echo 4 ;;
    "Medium")  echo 3 ;;
    "Hard")    echo 2 ;;
    "Complex") echo 1 ;;
    *)         echo "" ;;
  esac
}

status_bonus() {
  case "$1" in
    "Idea")           echo 0 ;;
    "Planned")        echo 1 ;;
    "Approved")       echo 2 ;;
    "In Development") echo 3 ;;
    "Testing")        echo 4 ;;
    "Done")           echo -1 ;; # sentinel: score becomes 0
    *)                echo 0 ;;
  esac
}

# --- Fetch all items with field values (including Dependencies text) ---

echo "Fetching project items..."

ITEMS_JSON=$(gh api graphql -f query='
{
  user(login: "bh679") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on DraftIssue { title }
            ... on Issue { title }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
            }
          }
        }
      }
    }
  }
}')

ITEM_COUNT=$(echo "$ITEMS_JSON" | jq '.data.user.projectV2.items.nodes | length')
echo "Found $ITEM_COUNT items."

# --- Pass 1: Calculate base scores for all items ---
# Base score = (Priority × 2) + Time + Complexity + Status Bonus (no dependency bonus)

echo ""
echo "=== Pass 1: Calculating base scores ==="

# Arrays to store per-item data (indexed by position)
declare -a ITEM_IDS TITLES STATUSES BASE_SCORES CURRENT_SCORES DEPS_LIST IS_DONE IS_SKIPPED

for i in $(seq 0 $((ITEM_COUNT - 1))); do
  ITEM=$(echo "$ITEMS_JSON" | jq ".data.user.projectV2.items.nodes[$i]")
  ITEM_IDS[$i]=$(echo "$ITEM" | jq -r '.id')
  TITLES[$i]=$(echo "$ITEM" | jq -r '.content.title // "Unknown"')

  PRIORITY=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Priority") | .name // empty' 2>/dev/null || echo "")
  TIME_EST=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Time Estimate") | .name // empty' 2>/dev/null || echo "")
  COMPLEXITY=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Complexity") | .name // empty' 2>/dev/null || echo "")
  STATUSES[$i]=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Status") | .name // empty' 2>/dev/null || echo "")
  CURRENT_SCORES[$i]=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Score") | .number // empty' 2>/dev/null || echo "")
  DEPS_LIST[$i]=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Dependencies") | .text // empty' 2>/dev/null || echo "")

  IS_DONE[$i]=false
  IS_SKIPPED[$i]=false

  S=$(status_bonus "${STATUSES[$i]}")
  if [[ "$S" == "-1" ]]; then
    BASE_SCORES[$i]=0
    IS_DONE[$i]=true
    echo "  BASE: ${TITLES[$i]} = 0 (Done)"
    continue
  fi

  P=$(priority_points "$PRIORITY")
  T=$(time_points "$TIME_EST")
  C=$(complexity_points "$COMPLEXITY")

  if [[ -z "$P" || -z "$T" || -z "$C" ]]; then
    BASE_SCORES[$i]=0
    IS_SKIPPED[$i]=true
    echo "  SKIP: ${TITLES[$i]} (missing fields: Priority=$PRIORITY, Time=$TIME_EST, Complexity=$COMPLEXITY)"
    continue
  fi

  BASE_SCORES[$i]=$(( (P * 2) + T + C + S ))
  echo "  BASE: ${TITLES[$i]} = ${BASE_SCORES[$i]}"
done

# --- Pass 2: Calculate dependency bonus (recursive) ---
# For each item, find ALL items that transitively depend on it (direct + indirect).
# The dependency bonus = sum of base scores of all transitive dependants.
#
# Example: If C depends on B, and B depends on A, then A gets bonus from both B and C.
# Each dependant's base score is counted only once (no double-counting).

echo ""
echo "=== Pass 2: Calculating dependency bonuses (recursive) ==="

# Build direct dependants map: for each item i, which items directly depend on it?
# DIRECT_DEPENDANTS[i] = space-separated list of indices
declare -a DIRECT_DEPENDANTS
for i in $(seq 0 $((ITEM_COUNT - 1))); do
  DIRECT_DEPENDANTS[$i]=""
done

for j in $(seq 0 $((ITEM_COUNT - 1))); do
  if [[ "${IS_DONE[$j]}" == "true" || "${IS_SKIPPED[$j]}" == "true" ]]; then
    continue
  fi
  DEPS_TEXT="${DEPS_LIST[$j]}"
  if [[ -z "$DEPS_TEXT" ]]; then
    continue
  fi
  for i in $(seq 0 $((ITEM_COUNT - 1))); do
    if [[ $i -eq $j ]]; then
      continue
    fi
    if echo "$DEPS_TEXT" | grep -qF "${TITLES[$i]}"; then
      DIRECT_DEPENDANTS[$i]="${DIRECT_DEPENDANTS[$i]} $j"
    fi
  done
done

# Recursive function: collect all transitive dependants of item $1
# Uses a visited set (VISITED array) to avoid cycles and double-counting
declare -a VISITED
collect_dependants() {
  local idx=$1
  for dep_idx in ${DIRECT_DEPENDANTS[$idx]}; do
    if [[ "${VISITED[$dep_idx]}" == "1" ]]; then
      continue
    fi
    VISITED[$dep_idx]=1
    TRANSITIVE_DEPS="$TRANSITIVE_DEPS $dep_idx"
    # Recurse into this dependant's dependants
    collect_dependants "$dep_idx"
  done
}

declare -a DEP_BONUSES

for i in $(seq 0 $((ITEM_COUNT - 1))); do
  DEP_BONUSES[$i]=0

  if [[ "${IS_DONE[$i]}" == "true" || "${IS_SKIPPED[$i]}" == "true" ]]; then
    continue
  fi

  # Reset visited and collect all transitive dependants
  for v in $(seq 0 $((ITEM_COUNT - 1))); do
    VISITED[$v]=0
  done
  TRANSITIVE_DEPS=""
  collect_dependants "$i"

  # Sum base scores of all transitive dependants
  for dep_idx in $TRANSITIVE_DEPS; do
    DEP_BONUSES[$i]=$(( ${DEP_BONUSES[$i]} + ${BASE_SCORES[$dep_idx]} ))
    echo "  +${BASE_SCORES[$dep_idx]} to ${TITLES[$i]} (from ${TITLES[$dep_idx]})"
  done
done

# --- Pass 3: Write final scores ---

echo ""
echo "=== Pass 3: Writing final scores ==="

UPDATED=0
SKIPPED=0

for i in $(seq 0 $((ITEM_COUNT - 1))); do
  TITLE="${TITLES[$i]}"
  ITEM_ID="${ITEM_IDS[$i]}"
  CURRENT_SCORE="${CURRENT_SCORES[$i]}"

  # Done items: score = 0
  if [[ "${IS_DONE[$i]}" == "true" ]]; then
    if [[ "$CURRENT_SCORE" == "0" || "$CURRENT_SCORE" == "0.0" ]]; then
      echo "  OK:   $TITLE = 0 (Done, unchanged)"
      continue
    fi
    echo "  SET:  $TITLE = 0 (Done — was: ${CURRENT_SCORE:-unset})"
    gh api graphql -f query="mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: \"$PROJECT_ID\"
        itemId: \"$ITEM_ID\"
        fieldId: \"$SCORE_FIELD_ID\"
        value: { number: 0 }
      }) { projectV2Item { id } }
    }" > /dev/null
    UPDATED=$((UPDATED + 1))
    continue
  fi

  # Skipped items: missing fields
  if [[ "${IS_SKIPPED[$i]}" == "true" ]]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Final score = base + dependency bonus
  SCORE=$(( ${BASE_SCORES[$i]} + ${DEP_BONUSES[$i]} ))

  if [[ "$CURRENT_SCORE" == "$SCORE" || "$CURRENT_SCORE" == "$SCORE.0" ]]; then
    echo "  OK:   $TITLE = $SCORE (base: ${BASE_SCORES[$i]} + deps: ${DEP_BONUSES[$i]}, unchanged)"
    continue
  fi

  echo "  SET:  $TITLE = $SCORE (base: ${BASE_SCORES[$i]} + deps: ${DEP_BONUSES[$i]}, was: ${CURRENT_SCORE:-unset})"

  gh api graphql -f query="mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: \"$PROJECT_ID\"
      itemId: \"$ITEM_ID\"
      fieldId: \"$SCORE_FIELD_ID\"
      value: { number: $SCORE }
    }) { projectV2Item { id } }
  }" > /dev/null

  UPDATED=$((UPDATED + 1))
done

echo ""
echo "Done. Updated: $UPDATED, Skipped (missing fields): $SKIPPED"
