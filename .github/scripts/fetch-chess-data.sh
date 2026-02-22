#!/usr/bin/env bash
# fetch-chess-data.sh
# Collects project board data, recent commits, and merged PRs for the
# weekly chess blog agent. Covers both chess-client and chess-api repos.
# Writes a single JSON file to /tmp/chess-blog-data.json.
#
# Requires: gh CLI authenticated with project access (GH_TOKEN env var)

set -euo pipefail

OUTPUT="/tmp/chess-blog-data.json"
SEVEN_DAYS_AGO=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
TODAY=$(date -u +%Y-%m-%d)

echo "=== Fetching Chess Blog Data ==="
echo "Date range: $SEVEN_DAYS_AGO to now"

# --- 1. Project board items via GraphQL ---
echo "Fetching project board..."

PROJECT_BOARD=$(gh api graphql -f query='
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

# Transform project board into a simpler structure
ITEMS=$(echo "$PROJECT_BOARD" | jq '[
  .data.user.projectV2.items.nodes[] |
  {
    title: .content.title,
    status: ([.fieldValues.nodes[] | select(.field.name == "Status") | .name] | first // null),
    priority: ([.fieldValues.nodes[] | select(.field.name == "Priority") | .name] | first // null),
    categories: ([.fieldValues.nodes[] | select(.field.name == "Categories") | .name] | first // null),
    score: ([.fieldValues.nodes[] | select(.field.name == "Score") | .number] | first // null),
    complexity: ([.fieldValues.nodes[] | select(.field.name == "Complexity") | .name] | first // null),
    time_estimate: ([.fieldValues.nodes[] | select(.field.name == "Time Estimate") | .name] | first // null)
  }
]')

ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
echo "Found $ITEM_COUNT project board items."

# Summary by status
STATUS_SUMMARY=$(echo "$ITEMS" | jq '[.[] | select(.status != null)] | group_by(.status) | map({key: .[0].status, value: length}) | from_entries')

# --- 2. Recent commits on main (chess-client) ---
echo "Fetching chess-client commits..."

CLIENT_COMMITS=$(git log --since="$SEVEN_DAYS_AGO" --format='{"hash": "%h", "subject": "%s", "author": "%an", "date": "%aI"}' origin/main 2>/dev/null | jq -s '.' 2>/dev/null || echo '[]')
CLIENT_COMMIT_COUNT=$(echo "$CLIENT_COMMITS" | jq 'length')
echo "Found $CLIENT_COMMIT_COUNT chess-client commits."

# --- 3. Recent commits (chess-api) ---
echo "Fetching chess-api commits..."

API_COMMITS=$(gh api "repos/bh679/chess-api/commits?since=$SEVEN_DAYS_AGO&per_page=30" --jq '[.[] | {hash: .sha[0:7], subject: .commit.message, author: .commit.author.name, date: .commit.author.date}]' 2>/dev/null || echo '[]')
API_COMMIT_COUNT=$(echo "$API_COMMITS" | jq 'length')
echo "Found $API_COMMIT_COUNT chess-api commits."

# --- 4. Merged PRs (both repos) ---
echo "Fetching merged PRs..."

CLIENT_PRS=$(gh pr list --repo bh679/chess-client --state merged --json number,title,mergedAt,author --limit 20 2>/dev/null || echo '[]')
CLIENT_PRS=$(echo "$CLIENT_PRS" | jq --arg since "$SEVEN_DAYS_AGO" '[.[] | select(.mergedAt >= $since)]')
CLIENT_PR_COUNT=$(echo "$CLIENT_PRS" | jq 'length')

API_PRS=$(gh pr list --repo bh679/chess-api --state merged --json number,title,mergedAt,author --limit 20 2>/dev/null || echo '[]')
API_PRS=$(echo "$API_PRS" | jq --arg since "$SEVEN_DAYS_AGO" '[.[] | select(.mergedAt >= $since)]')
API_PR_COUNT=$(echo "$API_PRS" | jq 'length')

echo "Found $CLIENT_PR_COUNT chess-client PRs and $API_PR_COUNT chess-api PRs."

# --- 5. Closed issues ---
echo "Fetching closed issues..."

CLOSED_ISSUES=$(gh issue list --repo bh679/chess-client --state closed --json number,title,closedAt --limit 20 2>/dev/null || echo '[]')
CLOSED_ISSUES=$(echo "$CLOSED_ISSUES" | jq --arg since "$SEVEN_DAYS_AGO" '[.[] | select(.closedAt >= $since)]')
ISSUE_COUNT=$(echo "$CLOSED_ISSUES" | jq 'length')
echo "Found $ISSUE_COUNT closed issues in the last 7 days."

# --- 6. Previous state ---
echo "Reading previous state..."

if [ -f "blog/state.json" ]; then
  PREVIOUS_STATE=$(cat blog/state.json)
  LAST_RUN=$(echo "$PREVIOUS_STATE" | jq -r '.last_run // "never"')
  echo "Previous state found (last run: $LAST_RUN)"
else
  PREVIOUS_STATE='{"last_run": null, "project_board_snapshot": {"items": []}}'
  echo "No previous state found — first run."
fi

# --- Compose output ---
echo "Writing output to $OUTPUT..."

jq -n \
  --arg date "$TODAY" \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson items "$ITEMS" \
  --argjson status_summary "$STATUS_SUMMARY" \
  --argjson client_commits "$CLIENT_COMMITS" \
  --argjson api_commits "$API_COMMITS" \
  --argjson client_prs "$CLIENT_PRS" \
  --argjson api_prs "$API_PRS" \
  --argjson closed_issues "$CLOSED_ISSUES" \
  --argjson previous_state "$PREVIOUS_STATE" \
  '{
    generated_at: $generated_at,
    date: $date,
    project_board: {
      items: $items,
      summary: {
        total: ($items | length),
        by_status: $status_summary
      }
    },
    chess_client: {
      recent_commits: $client_commits,
      merged_prs: $client_prs
    },
    chess_api: {
      recent_commits: $api_commits,
      merged_prs: $api_prs
    },
    closed_issues: $closed_issues,
    previous_state: $previous_state
  }' > "$OUTPUT"

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT"
echo "Items: $ITEM_COUNT | Client commits: $CLIENT_COMMIT_COUNT | API commits: $API_COMMIT_COUNT | Client PRs: $CLIENT_PR_COUNT | API PRs: $API_PR_COUNT | Issues: $ISSUE_COUNT"
