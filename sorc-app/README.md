# SORC RPG - Cloudflare Workers Backend

Complete backend replacement for Firebase using Cloudflare Workers, D1, and R2.

## Files in This Folder

### Configuration
- **wrangler.toml** - Cloudflare Workers config (D1 & R2 bindings)
- **package.json** - Node.js dependencies
- **tsconfig.json** - TypeScript compiler options
- **.gitignore** - Ignore node_modules and build files

### Backend
- **src/index.ts** - Main Worker with all API endpoints
  - Auth (register, signin)
  - Forums (threads, posts, likes)
  - Profiles (get, update)
  - Characters (create, list)
  - Fellowships (requests)

### Database
- **schema.sql** - D1 database schema (all tables)

## Quick Start

### 1. Install & Deploy
```bash
git add .
git commit -m "Update all files to use Cloudflare API instead of Firebase"
git push
