# OpenCord

OpenCord is an open-source Discord competitor built on SpacetimeDB. There are no WebSockets in the stack. All realtime state and media (audio/video) moves through the database.

## Highlights

- Database-native realtime: no WebSocket server required
- Servers with categories plus text and voice channels
- Invite links and a join flow built into the UI
- Voice controls like mute and deafen
- SvelteKit frontend with a Rust SpacetimeDB module

## How It Works

OpenCord uses SpacetimeDB for everything that would normally be handled by a realtime gateway. State updates, presence, and even audio/video are modeled as database streams rather than WebSocket messages. The UI is a SvelteKit client that subscribes to those streams and renders a familiar chat experience.

## Project Structure

- `src/` SvelteKit frontend
- `spacetimedb/` Rust module compiled for SpacetimeDB
- `spacetime.json` and `spacetime.local.json` SpacetimeDB dev configuration

## Getting Started

Prerequisites:

- Node.js and npm
- SpacetimeDB CLI and a local SpacetimeDB instance

Steps:

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start SpacetimeDB and publish the module in `spacetimedb/` (see SpacetimeDB docs).
3. Run the web app:
   ```sh
   npm run dev
   ```

By default the project expects a database named `opencord` (configured in `spacetime.local.json`).

## Useful Scripts

- `npm run dev` Start the Vite dev server
- `npm run build` Build the production app
- `npm run preview` Preview the production build
- `npm run check` Type-check and lint with `svelte-check`

## Contributing

Issues and PRs are welcome. If you have ideas for new features or improvements, open an issue to discuss them or submit a pull request with a clear description of the change.
