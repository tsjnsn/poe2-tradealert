# POE2 Trade Alert

A desktop application and Discord bot system that monitors Path of Exile 2 trade whispers and sends them to you via Discord DM. Built with SolidJS and NeutralinoJS.

![image](https://github.com/user-attachments/assets/f80fe22b-8bf4-4ac9-bc51-62aba3e134e8)


## Quick Start Guide

### 1. Download and Install

1. Go to the [Releases](https://github.com/tsjnsn/poe2-tradealert/releases) page and download the zip file for your operating system
2. Extract the zip file to any location on your computer, and run the executable - no installation required. Some metadata files will be created in the same directory as the executable.

### 2. Setup

1. Start the POE2 Trade Alert application
2. Click the "Login with Discord" button
3. Accept the Discord authorization request
4. You're all set! The bot will now be able to send you trade messages via DM
5. Test by receiving a trade message in-game, or using the `/test-message` command in the web console

### Need Help?

- Check the [Issues](https://github.com/tsjnsn/poe2-tradealert/issues) page for known problems
- Report bugs or request features through our GitHub issues

---

# Dev Notes

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
- A Discord account and developer application

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
- Bring-your-own-server available

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

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

Apache License 2.0 
