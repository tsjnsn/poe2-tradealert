# POE2 Trade Alert

A desktop application and Discord bot system that monitors Path of Exile 2 trade whispers and sends them to you via Discord DM. Built with SolidJS, NeutralinoJS, and Discord.js.

## Architecture

The project consists of two main components:

- **Desktop Client** (NeutralinoJS + SolidJS):
  - Modern UI built with SolidJS and TailwindCSS
  - Native file system access to monitor POE2's client.txt
  - Real-time trade message parsing and notification system

- **Discord Bot Server** (Node.js):
  - Express.js server for Discord OAuth authentication
  - Discord.js bot for sending DM notifications
  - Secure user authentication and session management

## Prerequisites

- Node.js 16 or higher
- pnpm 8 or higher
- A Discord account and application
- Path of Exile 2 installed

## Discord Application Setup

1. Create a Discord Application:
   - Visit the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Navigate to the "Bot" section and create a bot
   - Enable necessary Privileged Gateway Intents
   - Copy the bot token
   - Under OAuth2 > General, copy the Client ID and Client Secret
   - Add redirect URL: `http://localhost:5050/auth/callback`

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install:all
   ```

3. Configure the server:
   - Copy `server/.env.example` to `server/.env`
   - Fill in your Discord credentials:
     ```
     DISCORD_CLIENT_ID=your_client_id
     DISCORD_CLIENT_SECRET=your_client_secret
     DISCORD_BOT_TOKEN=your_bot_token
     ```

## Development

Run the development servers:

```bash
# Start the Discord bot server
pnpm dev:server

# In another terminal, start the client
pnpm dev:client
```

## Building for Production

```bash
# Build the client
cd client
pnpm build

# Start the server
cd ../server
pnpm start
```

## Features

- Real-time monitoring of POE2 trade whispers
- Secure Discord authentication and DM notifications
- Modern desktop UI with system tray integration
- Multi-user support
- Trade message parsing and formatting
- Session persistence

## Tech Stack

- **Client**:
  - SolidJS for UI
  - NeutralinoJS for desktop integration
  - TailwindCSS for styling
  - TypeScript for type safety
  - Vite for building

- **Server**:
  - Node.js
  - Express.js
  - Discord.js
  - JWT for authentication

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

Apache License 2.0 
