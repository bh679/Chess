# Blog Post Guidelines

These guidelines govern how the blogging agent writes each weekly blog post.

## Structure

1. Breadcrumb line: `[[Home]] · [[Development-Blog]] · Post Title`
2. H1 title — sharp and descriptive
3. Link to relevant project(s): `[Chess](https://brennan.games/chess/) | [GitHub](https://github.com/bh679/chess-client)`

## Headings (H2)

- Tell the full story in the headings, as short as possible
- Short, sharp, and to the point
- Use subheadings (H3) the same way if needed

## For Every Heading Section

- A short paragraph (1-5 sentences max) OR concise bullet points — no fluff
- Include an image every second heading (use `![alt](URL)` with relevant screenshots or diagrams if available)
- Bullet points are good to show extent of content — link to feature wiki docs where relevant
- **Feature links MUST use absolute markdown links** — do NOT use `[[wiki-link]]` syntax for feature pages, it breaks on GitHub wikis (wrong URL, wrong display text)
  - ✅ Correct: `[Chess Board](/bh679/chess-project/wiki/Feature:-Chess-Board)`
  - ❌ Wrong: `[[Feature:-Chess-Board|Chess Board]]` — the `Feature:-` prefix gets stripped from the URL
- End each section with a relevant call to action when appropriate

## Paragraphs

1-5 sentences only. Keep short, engaging, and to the point. No fluff.

## Ending

End the whole blog with a call to action:
- "Try the latest here: [brennan.games/chess](https://brennan.games/chess/)"
- Identify a target audience this should be shared with

## Format Rules

- NO YAML frontmatter — this is a wiki page
- Wiki page filename: `Blog:-<Title-Slug>.md` — use the blog post title as a hyphenated slug (e.g. `Blog:-User-Accounts-Are-Live.md`)
- Do NOT include dates in the filename

## Link Rules

| Link type | Correct format | Wrong format |
|-----------|---------------|-------------|
| Breadcrumb (Home, Development-Blog) | `[[Home]]`, `[[Development-Blog]]` | — |
| Feature docs | `[Display Text](/bh679/chess-project/wiki/Feature:-Name)` | `[[Feature:-Name\|Display Text]]` |
| Index H2 links | `## [Title](/bh679/chess-project/wiki/Blog:-Slug)` | `## [[Blog:-Slug\|Title]]` |
| External links | `[text](https://url)` | — |

**Key rule:** Anything with a `Feature:-` prefix in the wiki page name MUST use an absolute markdown link. The `[[wiki-link]]` syntax silently strips `Feature:-` from the URL.

## Template

```markdown
[[Home]] · [[Development-Blog]] · Post Title Here

# Sharp Descriptive Title

[Chess](https://brennan.games/chess/) | [GitHub](https://github.com/bh679/chess-client)

## Heading Tells the Full Story
Short paragraph. 1-5 sentences max.

## Another Section With Image
![description](image-url)
- Concise bullet points
- [Feature Name](/bh679/chess-project/wiki/Feature:-Feature-Name) — description of the feature

## Coming Up
What's next.

---
**Try the latest:** [brennan.games/chess](https://brennan.games/chess/)
Share this with [target audience].
```
