# How to Document a New Module

> This guide is for AI coding agents. Follow it whenever you create a new module, feature, or system in this project.

---

## When to use this guide

- You are building a new module
- You are adding a major new system
- You are adding a significant feature complex enough to need its own doc

Do NOT create a new doc for small features, bug fixes, or minor additions to existing modules. Instead, update the existing module's doc.

---

## Step 1: Decide what type of doc to create

---

## Step 2: Write the doc

### For module docs (`/docs/*.md`)

Answer exactly these 5 questions. Use them as section headers.

```markdown
# [Module Name]

Related docs: [list related doc files]

## 1. What does this module do?

2-3 sentences. Plain language. What problem does it solve for the user?
No technical jargon. Write as if explaining to a non-developer.

## 2. How does the user interact with it?

Step-by-step user journey. What does the user see, click, and experience?
Describe the flow from start to finish.

Example:
1. User navigates to the module from the sidebar
2. User sees a list of existing [items]
3. User clicks "Create New" to start
4. User fills in [fields]
5. User publishes/saves/schedules

## 3. What data does it store?

List every data structure this module uses.
For each data structure, list the important fields in plain English.

## 4. What does it connect to?


## 5. What is the current status?

Be honest. List:
- What works fully
- What is partially built or has known issues
- What is planned but not started yet

---

Last scanned: [today's date]

---

## Rules

- **Under 150 lines** per doc file. If it's longer, you're including too much detail — split it or simplify.
- **No code** in any doc. Describe what things do, not how they're implemented.
- **Plain language only**. If a non-developer can't understand it, rewrite it.
- **Be accurate**. Only document what actually exists in the codebase right now. Don't describe planned features as if they're built.
- **Always include `Related docs:` at the top** of every new doc file.
- **Always include `Last scanned: [date]` at the bottom** of every new doc file.