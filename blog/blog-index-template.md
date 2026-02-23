# Blog Index Page Template

This template governs how `Development-Blog.md` is structured in the wiki.

## Page Structure

```markdown
[[Home]] · Development Blog

# Development Blog

Weekly updates on the [Chess project](https://brennan.games/chess/), auto-generated every Monday by the blogging agent.

## [Blog Post Title](/bh679/chess-project/wiki/Blog:-Title-Slug)
YYYY-MM-DD — Chess
1-2 sentence abstract describing the key changes this week.

<!-- New posts are added above this line by the blogging agent -->
```

## Rules

- Each post entry uses an **H2 heading** with a markdown link: `## [Blog Post Title](/bh679/chess-project/wiki/Blog:-Title-Slug)`
- The URL path is `/bh679/chess-project/wiki/Blog:-<Title-Slug>` — an absolute path to the wiki page
- The link display text is the blog post title (no date, no subtitle)
- Below the heading: the date and project name on one line (e.g. `2026-02-23 — Chess`)
- Below that: a 1-2 sentence abstract
- New posts are added **above** the `<!-- New posts are added above this line -->` comment
- Newest posts appear first (reverse chronological order)
- Do NOT use `[[wiki-link]]` syntax for blog post links — it doesn't work reliably in H2 headings
