---
name: devlog
description: Write the next devlog entry for this repo from git history since the last entry. Use when asked to "write a devlog", "add a devlog entry", or "log this session's work". Reads real diffs and real test output; never describes work it has not verified.
---

# Writing a devlog entry

A devlog is the project's own record of what actually happened, written for
other builders. It is not a changelog (that is `CHANGELOG.md`, and it is
written differently) and not a summary of intentions.

## Get the facts before writing a word

Run these. Do not write from memory or assumption.

```bash
ls devlogs/                                    # find the last entry and its number
git log --oneline -20                          # what landed
git log --stat <last-entry-commit>..HEAD       # what each commit touched
git diff <last-entry-commit>..HEAD -- <path>   # read the actual changes
git status --short                             # what is still uncommitted, i.e. in progress
npm test --workspace @stargaze/core            # real count, not a remembered one
```

If a previous entry exists, find where it left off — its own "what is next"
line and its date. Cover the work since then, not the whole project.

**Every claim in the entry must trace to something you ran or read.** If you
did not verify it, it does not go in. Work that is half-done is described as
half-done.

## Structure

150-400 words, first person, four beats, no headings needed:

1. What I set out to do
2. What actually happened — including what broke or surprised me
3. Where I am right now, mid-task, honestly
4. What is next

## Voice

Short sentences. Plain words. Write like a person typing a progress update to
other builders who already know what the project is.

- Do not open by re-explaining the project.
- No marketing, no "excited to share", no "leveraging", no "robust" or
  "seamless".
- Never use an adjective where a number would do: `1381"`, `118 tests`,
  `90" → 25"`, `57 KB gzipped`.
- Never mention an assistant, a prompt, a model, or any session history. This
  is the project's record, written by the person who owns it.

## What makes an entry worth reading

Lead with the specific and surprising, not the tidy summary. The best material
is a bug that produced a plausible-but-wrong answer:

- A magnetic model 24° out because IGRF wants Schmidt quasi-normalisation and
  the code used Gauss normalisation.
- An up-axis computed as `forward × right` instead of `right × forward`, which
  mirrors the whole sky and still passes an orthonormality check.
- Code that was correct, tested, and never actually called from the render path.

If the session produced something of that kind, that is the entry. If it did
not, say what was tedious instead. Do not manufacture drama.

Include real numbers: error budgets before and after, arcseconds, test counts,
payload sizes.

## Output

Save as `devlogs/NN-short-slug.md`, incrementing `NN` from the last entry,
with today's date as the first line (`# YYYY-MM-DD`).

Do not commit it. The author edits it into their own voice first.

Then offer, briefly:
- A one-line summary suitable for a Slack post.
- What screenshot or clip would best show the work, and what should be on
  screen in it.
- The exact command to capture it, if one exists.
