# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup    # Install dependencies, generate Prisma client, run migrations
npm run dev      # Start development server with Turbopack (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm test         # Run Vitest tests
npm run db:reset # Reset database (destructive)
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

## Architecture

UIGen is an AI-powered React component generator. Users describe components in chat, and AI generates code that renders in a live preview.

### Core Flow

1. User sends message → ChatContext → `/api/chat` route
2. AI responds with tool calls (`str_replace_editor`, `file_manager`) that modify the virtual file system
3. FileSystemContext updates trigger PreviewFrame re-render
4. JSX transformer compiles files to blob URLs with import maps, renders in sandboxed iframe

### Key Modules

- **Virtual File System** ([src/lib/file-system.ts](src/lib/file-system.ts)): In-memory file system. No files are written to disk. Supports create, read, update, delete, rename operations.

- **File System Context** ([src/lib/contexts/file-system-context.tsx](src/lib/contexts/file-system-context.tsx)): React context wrapping VirtualFileSystem. Handles tool calls from AI and triggers UI updates via `refreshTrigger`.

- **Chat Context** ([src/lib/contexts/chat-context.tsx](src/lib/contexts/chat-context.tsx)): Wraps Vercel AI SDK's `useChat`. Serializes file system state on each request so AI has current file contents.

- **JSX Transformer** ([src/lib/transform/jsx-transformer.ts](src/lib/transform/jsx-transformer.ts)): Uses Babel standalone to compile JSX/TSX to ES modules. Creates import maps with blob URLs. Third-party imports resolve to esm.sh.

- **Preview Frame** ([src/components/preview/PreviewFrame.tsx](src/components/preview/PreviewFrame.tsx)): Renders compiled code in sandboxed iframe with Tailwind CDN. Entry point is `/App.jsx`.

### AI Tools

The AI uses two tools defined in [src/lib/tools/](src/lib/tools/):

- `str_replace_editor`: View, create, replace strings in, or insert into files
- `file_manager`: Rename or delete files/directories

### Data Model

Prisma with SQLite ([prisma/schema.prisma](prisma/schema.prisma)):
- `User`: email/password auth
- `Project`: stores serialized messages and file system state as JSON strings

### Authentication

JWT-based auth in [src/lib/auth.ts](src/lib/auth.ts). Sessions stored in httpOnly cookies. Middleware protects `/api/projects` and `/api/filesystem` routes.

### Mock Provider

When `ANTHROPIC_API_KEY` is not set, [src/lib/provider.ts](src/lib/provider.ts) uses a mock provider that returns static component code for testing without API costs.

## Conventions

- Generated components must have `/App.jsx` as entry point with default export
- Use `@/` import alias for local files (e.g., `@/components/Counter`)
- Style with Tailwind CSS, not inline styles
- Components use React 19 with automatic JSX runtime
