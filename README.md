# OpenCord

OpenCord is an open-source Discord competitor built with SvelteKit and SpacetimeDB. SpacetimeDB acts as both the database and the realtime backend over WebSockets, so there is no separate API server or message broker to manage. All state, auth, messaging, and media streaming flow through a single Rust module running inside SpacetimeDB.

## Features

### Messaging
- Text channels with a 2000-character limit
- Message deletion (admins can delete any message)
- Emoji reactions grouped by type
- Link previews with Open Graph, YouTube, and Steam support

### Servers and Channels
- Create and delete servers
- Categories with collapsible text and voice channels
- Role system with owner, admin, and member tiers
- Invite links with optional max-use limits
- Join-via-code flow built into the UI

### Voice and Video
- Real-time voice chat in server channels and DMs
- Webcam video and screen sharing via JPEG frame streaming
- Mute, deafen, input/output gain controls, and a talking indicator

### Direct Messages
- One-on-one DMs with user search
- End-to-end encryption (ECDH P-256 + AES-GCM, ephemeral keys per message)
- Voice and video calls inside DM threads

### User Profiles
- Display name, status, avatar, and banner
- Avatar and banner uploads (JPEG, PNG, GIF, WebP up to 10 MB)
- Online/away/DND/offline presence

### Mobile
- Responsive layout with slide-in sidebars for server, channel, and member lists

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Svelte 5 + SvelteKit 2 |
| Styling | Tailwind CSS 4 |
| Build | Vite 7 |
| Backend / Database | SpacetimeDB (Rust module) |
| Deployment | SvelteKit adapter-node |

## How It Works

The SvelteKit client connects to SpacetimeDB over WebSockets and subscribes to tables. When a reducer writes or updates a row, every subscribed client receives the change automatically. Audio and video frames are modeled as SpacetimeDB event tables, letting media stream through the same connection without a separate signaling server.

## Project Structure

- `src/` SvelteKit frontend
- `spacetimedb/` Rust module compiled for SpacetimeDB
- `spacetime.json` and `spacetime.local.json` SpacetimeDB dev configuration

## Getting Started

Prerequisites:

- Node.js and npm
- SpacetimeDB CLI

Steps:

1. Install dependencies:
   ```sh
   npm install
   ```
2. Publish the module (see [SpacetimeDB docs](https://spacetimedb.com/docs)):
   ```sh
   spacetime publish opencord --module-path ./spacetimedb
   ```
3. Run the web app:
   ```sh
   npm run dev
   ```

By default the project expects a database named `opencord` (configured in `.env`).

## Useful Scripts

- `npm run dev` Start the Vite dev server
- `npm run build` Build the production app
- `npm run preview` Preview the production build
- `npm run check` Type-check and lint with `svelte-check`

## Contributing

Issues and PRs are welcome. If you have ideas for new features or improvements, open an issue to discuss them or submit a pull request with a clear description of the change.
