# yinxwrld

A personal day-to-day workspace built with Next.js.

Today includes this week’s unfinished tasks with a “From this week’s list” tag. Use a task’s **More** menu to dismiss it for today, restore it from This week, or move a daily task to This week. Weekly tasks stay linked across views, and completing one finishes it for the week. Daily dismissal resets at midnight in Africa/Lagos.

Run `npm run test:planner` for the planner’s date, completion, conversion, and compatibility checks.

## Recurring tasks

Choose **Repeat** when adding or editing a task: **Every day**, **Weekdays**, or **Every week**. In Today, weekly repeats return on the same weekday; in This week, they return in each new weekly list. Dates follow Africa/Lagos.

Each occurrence has its own status and history. New occurrences are created when the workspace loads or refreshes, including at a day boundary while the app is open. Missed dates are not backfilled. Schedules and occurrences are stored in the shared MongoDB workspace, using the existing revision retries to prevent duplicates across devices.

Editing an occurrence updates its title, category, and schedule for future repeats without rewriting previous occurrences. **Delete this occurrence** removes only that occurrence. **Stop repeating**, available in More and the collapsed Repeating tasks section, keeps existing tasks and stops future ones. Moving a repeating daily occurrence to This week moves only that occurrence; its future daily schedule continues.

See [TODO.md](./TODO.md) for the planned private journal and other future work.

## Local development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `MONGODB_URI` in the ignored `.env.local` file to use the shared MongoDB workspace.

## Online setup

Connect this repository to Netlify. Netlify detects the Next.js App Router and configures its serverless runtime automatically. Follow [MONGODB_SETUP.md](./MONGODB_SETUP.md) to connect Atlas and set the server-side environment variables.
