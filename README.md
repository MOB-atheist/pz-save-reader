# PZ Manager

A small manager for Project Zomboid save data: view vehicles and players from your game DBs, export to CSV/Excel/JSON, and configure save paths.

## Tech stack

- **Backend:** Node.js, Express, SQLite (game DBs + local cache)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives), React Router
- **Export:** SheetJS (xlsx) for Excel export

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Development**

   **Option A – one command (recommended):**

   ```bash
   npm run start
   ```

   This starts both the API server (port 3000) and the Vite dev server (port 5173). Open **http://localhost:5173** in your browser.

   **Option B – two terminals:**

   - Terminal 1 – API server (port 3000):

     ```bash
     npm run server
     ```

   - Terminal 2 – Vite dev server (proxies `/api` to the Node server):

     ```bash
     npm run dev
     ```

   - Open the app at **http://localhost:5173**.

3. **Production build**

   ```bash
   npm run build
   npm run server
   ```

   The server will serve the built app from `dist/` and use client-side routing for `/vehicles`, `/players`, and `/settings`. If `dist/` does not exist, it falls back to the legacy `public/` static files.

## Scripts

| Script     | Description                                      |
| ---------- | ------------------------------------------------ |
| `start`    | Run API + Vite dev server together (development) |
| `dev`      | Start Vite dev server only                       |
| `server`   | Start Express API server only                     |
| `build`    | TypeScript build + Vite production               |
| `preview`  | Preview production build (Vite)                   |

## Configuration

- API port is read from `config.js` (default `3000`).
- Optional env: `VITE_API_URL` for the frontend when the app is served from a different origin (e.g. empty string for same-origin / proxy).

## Troubleshooting

**`[vite] http proxy error: /api/...` with `ECONNREFUSED`**

The frontend proxies `/api` to `http://localhost:3000`. This error means nothing is listening on port 3000 when the app calls the API.

- **If using `npm run start`:** The script starts the API first and waits for it (up to 60s) before starting Vite. If the API fails to start (e.g. config or DB error), Vite still starts and you’ll see this error. Check the first terminal for server errors.
- **Fix:** In a separate terminal run `npm run server` and confirm you see the server listening (e.g. “PZ Manager running at http://localhost:3000”). Leave it running, then use `npm run dev` in another terminal and open http://localhost:5173.
- If the API uses a different port (e.g. via `config.js` or `PORT`), ensure Vite’s proxy matches (see `vite.config.ts`).
