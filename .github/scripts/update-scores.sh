#!/usr/bin/env bash
# update-scores.sh
# Recalculates the Score field for all items in the Chess Roadmap project.
#
# Score = (Priority × 2) + Time Estimate + Complexity + Status Bonus
#   - Items with Status "Done" get Score = 0
#   - Status bonus: Idea +0, Planned +1, Approved +2, In Development +3, Testing +4
#
# Range: 0 (Done) or 4–24 (active items)
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
  COMPLEXITY=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Complexity") | .name // empty' 2>/dev/null || echo "")
  STATUS=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Status") | .name // empty' 2>/dev/null || echo "")
  CURRENT_SCORE=$(echo "$ITEM" | jq -r '.fieldValues.nodes[] | select(.field.name == "Score") | .number // empty' 2>/dev/null || echo "")

  # Check status bonus (Done = score 0)
  S=$(status_bonus "$STATUS")
  if [[ "$S" == "-1" ]]; then
    SCORE=0
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

  # Map to points
  P=$(priority_points "$PRIORITY")
  T=$(time_points "$TIME_EST")
  C=$(complexity_points "$COMPLEXITY")

  # Skip if any input is missing
  if [[ -z "$P" || -z "$T" || -z "$C" ]]; then
    echo "  SKIP: $TITLE (missing fields: Priority=$PRIORITY, Time=$TIME_EST, Complexity=$COMPLEXITY)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Calculate score: (Priority × 2) + Time + Complexity + Status Bonus
  SCORE=$(( (P * 2) + T + C + S ))

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
