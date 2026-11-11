# MongoDB setup

The workspace uses the official MongoDB Node.js driver from server routes. MongoDB credentials stay on the server; the browser talks only to `/api/workspace`.

## Configure Atlas

1. In Atlas, create a database user with read and write access to the `yinxwrld` database.
2. In **Network Access**, add your current IP for local development. For the Netlify deployment you chose, add `0.0.0.0/0` because standard Netlify Functions do not have a fixed outbound IP. This allows connection attempts from any IP, so keep the database user limited to the `yinxwrld` database and give it a unique, strong password.
3. In **Connect**, choose **JavaScript** and **Node.js Driver**, then copy the connection string. That is the right choice even though this app's source files use TypeScript; the official Node.js driver works from TypeScript.

## Configure this project

Set `MONGODB_URI` in the ignored `.env.local` file to the Atlas connection string. Leave `MONGODB_DB` as `yinxwrld`, or set it to the database name you chose in Atlas.

If the database password contains reserved URI characters, URL encode it before putting it into the connection string. Keep `.env.local` private and restart the Next.js server after changing it.

For your online host, add `MONGODB_URI` and `MONGODB_DB` in its server environment settings. Do not prefix them with `NEXT_PUBLIC_`.

This version has no sign in. Anyone who can reach the site can read, change, or delete the workspace through its API. Keep private or sensitive information out of it until sign in is restored or the site is otherwise restricted.

## Deploy on Netlify

Netlify detects the Next.js app and runs its Next.js adapter automatically; the App Router and API route handlers run on Netlify's serverless functions. No `netlify.toml` or manually pinned Next.js adapter is needed. The repository includes `.nvmrc` to keep the build and function runtime on Node.js 22, which meets the MongoDB driver requirement.

Connect the repository in the Netlify dashboard and use the detected Next.js build settings (`next build`, `.next`). Add `MONGODB_URI` and `MONGODB_DB` under **Project configuration → Environment variables**. Keep them server-only and enable the **Builds** and **Functions** scopes.

Netlify's standard Functions use changing outbound IP addresses, so this setup uses the `0.0.0.0/0` Atlas entry you approved. Atlas still requires the database user's credentials, and that user should only have read/write access to the `yinxwrld` database.

## Workspace storage and sync behavior

MongoDB is the only ongoing persistent store. The browser does not keep an offline workspace copy. If MongoDB is unavailable, the app shows a connection message and does not save edits on that device. Retry after the database connection is restored.

When the updated app first opens, it imports the old browser-saved workspace into MongoDB, merging records if MongoDB already has a workspace. Once the import succeeds, it removes the old browser copy. This migration only sees data saved for the same site origin and browser; `localhost` and the Netlify site have separate browser storage.

If two devices edit at once, the most recently saved full workspace snapshot wins. This is intended for one person using the workspace across devices; it does not merge simultaneous edits item by item.
