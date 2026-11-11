# yinxwrld

A personal day-to-day workspace built with Next.js.

Today includes this week’s unfinished tasks with a “From this week’s list” tag. Use a task’s **More** menu to dismiss it for today, restore it from This week, or move a daily task to This week. Weekly tasks stay linked across views, and completing one finishes it for the week. Daily dismissal resets at midnight in Africa/Lagos.

Run `npm run test:planner` for the planner’s date, completion, conversion, and compatibility checks.

## Local development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `MONGODB_URI` in the ignored `.env.local` file to use the shared MongoDB workspace.

## Online setup

Connect this repository to Netlify. Netlify detects the Next.js App Router and configures its serverless runtime automatically. Follow [MONGODB_SETUP.md](./MONGODB_SETUP.md) to connect Atlas and set the server-side environment variables.
