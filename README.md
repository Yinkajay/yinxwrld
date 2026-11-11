# yinxwrld

A personal day-to-day workspace built with Next.js.

## Local development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `MONGODB_URI` and `WORKSPACE_PASSWORD` in the ignored `.env.local` file before signing in. The session secret is already generated there.

## Online setup

Connect this repository to Netlify. Netlify detects the Next.js App Router and configures its serverless runtime automatically. Follow [MONGODB_SETUP.md](./MONGODB_SETUP.md) to connect Atlas and set the server-side environment variables.
