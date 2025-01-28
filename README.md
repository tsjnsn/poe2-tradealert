# POE2 Trade Alert Discord Bot

A Discord bot that monitors Path of Exile 2 trade whispers and sends them to you via Discord DM.

## Features

- Monitors POE2 client.txt for trade whispers
- Real-time Discord DM notifications
- Secure Discord OAuth authentication
- Support for multiple users

## Setup

1. Create a Discord Application:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the bot token
   - Under OAuth2 > General, copy the Client ID and Client Secret
   - Add redirect URL: `http://localhost:5050/auth/callback`

2. Configure the environment:
   - Copy `.env.example` to `.env`
   - Fill in your Discord credentials
   - Update the POE2 log path if necessary

3. Install dependencies:
   ```bash
   # Install pnpm if you haven't already
   npm install -g pnpm

   # Install project dependencies
   pnpm install
   ```

4. Start the bot:
   ```bash
   pnpm start
   ```

## Usage

1. Visit `http://localhost:5050/auth` to link your Discord account
2. The bot will now send you Discord DMs whenever you receive trade whispers in POE2
3. To stop the bot, press Ctrl+C in the terminal

## Testing

You can test the log monitoring functionality without setting up Discord:

1. Start the test monitor:
   ```bash
   pnpm test:monitor
   ```

2. Simulate trade messages:
   ```bash
   pnpm test:message
   ```

3. Scan existing log file:
   ```bash
   pnpm test:scan
   ```
   This will scan your entire Client.txt file and show:
   - All trade messages that would be detected
   - Detailed breakdown of each trade (timestamp, player, item, price)
   - Summary statistics (total messages, unique players, time range)

The test monitor will display any trade messages it detects in the console. You can run `test:message` multiple times to simulate different trade requests, or manually add messages to the log file.

## Development

To run the bot in development mode with auto-reload:
```bash
pnpm dev
```

## Requirements

- Node.js 16.x or higher
- pnpm (install with `npm install -g pnpm`)
- A Discord account
- Path of Exile 2 installed

## License

MIT 
