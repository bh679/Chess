# Blog Index Page Template

This template governs how `Development-Blog.md` is structured in the wiki.

## Page Structure

```markdown
[[Home]] · Development Blog

# Development Blog

Weekly updates on the [Chess project](https://brennan.games/chess/), auto-generated every Monday by the blogging agent.

## [[Blog:-YYYY-MM-DD|Blog Post Title]]
YYYY-MM-DD — Chess
1-2 sentence abstract describing the key changes this week.

<!-- New posts are added above this line by the blogging agent -->
```

## Rules

- Each post entry uses an **H2 heading** with a wiki-link: `## [[Blog:-YYYY-MM-DD|Blog Post Title]]`
- Below the heading: the date and project name on one line (e.g. `2026-02-23 — Chess`)
- Below that: a 1-2 sentence abstract
- New posts are added **above** the `<!-- New posts are added above this line -->` comment
- Newest posts appear first (reverse chronological order)
