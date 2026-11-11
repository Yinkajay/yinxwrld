# MongoDB setup

The workspace uses the official MongoDB Node.js driver from server routes. MongoDB credentials stay on the server; the browser talks only to `/api/workspace`.

## Configure Atlas

1. In Atlas, create a database user with read and write access to the `yinxwrld` database.
2. In **Network Access**, add your current IP for local development. For the Netlify deployment you chose, add `0.0.0.0/0` because standard Netlify Functions do not have a fixed outbound IP. This allows connection attempts from any IP, so keep the database user limited to the `yinxwrld` database and give it a unique, strong password.
3. In **Connect**, choose **JavaScript** and **Node.js Driver**, then copy the connection string. That is the right choice even though this app's source files use TypeScript; the official Node.js driver works from TypeScript.

## Configure this project

The ignored `.env.local` file is ready. Fill in `MONGODB_URI` with the Atlas connection string and set `WORKSPACE_PASSWORD` to a unique passphrase with at least 16 characters. `WORKSPACE_SESSION_SECRET` has already been generated locally. Leave `MONGODB_DB` as `yinxwrld`, or set it to the database name you chose in Atlas.

If the database password contains reserved URI characters, URL encode it before putting it into the connection string. Keep `.env.local` private and restart the Next.js server after changing it.

For your online host, add the same four variables in its server environment settings. Do not prefix them with `NEXT_PUBLIC_`. The MongoDB API is behind the password session and rejects requests without a valid session.

## Deploy on Netlify

Netlify detects the Next.js app and runs its Next.js adapter automatically; the App Router and API route handlers run on Netlify's serverless functions. No `netlify.toml` or manually pinned Next.js adapter is needed. The repository includes `.nvmrc` to keep the build and function runtime on Node.js 22, which meets the MongoDB driver requirement.

Connect the repository in the Netlify dashboard and use the detected Next.js build settings (`next build`, `.next`). Add `MONGODB_URI`, `MONGODB_DB`, `WORKSPACE_PASSWORD`, and `WORKSPACE_SESSION_SECRET` under **Project configuration → Environment variables**. Keep them server-only, enable the **Builds** and **Functions** scopes, and restrict them to the **Production** deploy context. Deploy previews will then remain unable to sign in or write to the production workspace.

Netlify's standard Functions use changing outbound IP addresses, so this setup uses the `0.0.0.0/0` Atlas entry you approved. Atlas still requires the database user's credentials, and that user should only have read/write access to the `yinxwrld` database.

## Existing browser data and sync behavior

The first browser that connects imports its saved workspace if MongoDB does not have one yet. After that, MongoDB is the shared copy and each browser keeps an offline cache. Changes made while MongoDB is unavailable are marked locally and uploaded when the connection returns. A successful delete is saved as part of the full workspace snapshot, so removed items stay removed.

If two devices edit at once, the most recently saved full workspace snapshot wins. This is intended for one person using the workspace across devices; it does not merge simultaneous edits item by item.

## Move existing browser data into MongoDB

If you already have tasks saved in this browser on your local app, configure `.env.local` first, run the local app, and sign in there before opening the Netlify site. When Atlas is empty, the local app uploads its saved browser workspace to MongoDB. Then the Netlify site will load that same copy after you sign in. Browser storage is separate for `localhost` and the Netlify domain, so opening the online site first will not see the local browser copy.
