#!/usr/bin/env bash
# update-scores.sh
# Recalculates the Score field for all items in the Chess Roadmap project.
#
# Score = (Priority × 2) + Time Estimate + Difficulty
# Range: 4 (Low, 1 week+, Complex) to 20 (High, 1-2 hours, Trivial)
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

difficulty_points() {
  case "$1" in
    "Trivial") echo 5 ;;
    "Easy")    echo 4 ;;
    "Medium")  echo 3 ;;
    "Hard")    echo 2 ;;
    "Complex") echo 1 ;;
    *)         echo "" ;;
  esac
}

# --- Fetch all items with field values ---

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
            }
          }
        }
      }
    }
  }
}')

# --- Process each item ---

ITEM_COUNT=$(echo "$ITEMS_JSON" | jq '.data.user.projectV2.items.nodes | length')
UPDATED=0
SKIPPED=0

echo "Found $ITEM_COUNT items. Calculating scores..."

for i in $(seq 0 $((ITEM_COUNT - 1))); do
  ITEM=$(echo "$ITEMS_JSON" | jq ".data.user.projectV2.items.nodes[$i]")
  ITEM_ID=$(echo "$ITEM" | jq -r '.id')
  TITLE=$(echo "$ITEM" | jq -r '.content.title // "Unknown"')

  # Extract field values
  PRIORITY=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Priority") | .name // empty' 2>/dev/null || echo "")
  TIME_EST=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Time Estimate") | .name // empty' 2>/dev/null || echo "")
  DIFFICULTY=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Difficulty") | .name // empty' 2>/dev/null || echo "")
  CURRENT_SCORE=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Score") | .number // empty' 2>/dev/null || echo "")

  # Map to points
  P=$(priority_points "$PRIORITY")
  T=$(time_points "$TIME_EST")
  D=$(difficulty_points "$DIFFICULTY")

  # Skip if any input is missing
  if [[ -z "$P" || -z "$T" || -z "$D" ]]; then
    echo "  SKIP: $TITLE (missing fields: Priority=$PRIORITY, Time=$TIME_EST, Difficulty=$DIFFICULTY)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Calculate score: (Priority × 2) + Time + Difficulty
  SCORE=$(( (P * 2) + T + D ))

  # Only update if score changed
  if [[ "$CURRENT_SCORE" == "$SCORE" || "$CURRENT_SCORE" == "$SCORE.0" ]]; then
    echo "  OK:   $TITLE = $SCORE (unchanged)"
    continue
  fi

  echo "  SET:  $TITLE = $SCORE (was: ${CURRENT_SCORE:-unset})"

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
