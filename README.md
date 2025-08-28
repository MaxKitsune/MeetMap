# MeetMap

A Next.js application for tracking relationships, places, and memories on an interactive map. Built with TypeScript, Prisma, PostgreSQL, and MapLibre GL.

## Key Features

- 🗺️ Interactive map visualization of people and diary entries
- 👥 Relationship management with customizable tags
- 📝 Diary entries with image attachments and location data
- ⏳ Timeline view of relationships and events
- 🔍 Global search across people, diary entries and places

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 
- **Mapping**: MapLibre GL with Positron basemap
- **Search**: Integrated place search with MapTiler/Nominatim

## Quick Start

```bash
# Clone repository and install dependencies
git clone https://github.com/MaxKitsune/MeetMap
npm install

# Copy example env and configure
cp .env.example .env

# Start PostgreSQL database
docker-compose up -d

# Setup database and seed initial data
npm run db:setup

# Start development server
npm run dev
```

## Project Structure

- app - Next.js app router and API routes
- components - React components organized by feature
- lib - Shared utilities and configuration
- prisma - Database schema and migrations

## Features

- **Map View**: Visualize people and diary entries geographically
- **Timeline**: View relationships and events chronologically
- **People**: Manage relationships with tags and location data
- **Diary**: Record entries with images, people tags, and places
- **Global Search**: Find content across all features

## License

MIT

## Additional information

This is a pre-release. The Design or features are subject to change.
The project was coded mostly with an LLM and is almost entirely AI generated.
