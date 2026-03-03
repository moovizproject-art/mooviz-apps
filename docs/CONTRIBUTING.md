# Contributing to MOOVIZ

## Development Setup

### Prerequisites
- Node.js >= 18
- pnpm >= 9
- Firebase CLI (`npm install -g firebase-tools`)

### Getting Started
```bash
# Clone the repository
git clone https://github.com/your-org/mooviz.git
cd mooviz

# Install dependencies
pnpm install

# Start Firebase emulators
firebase emulators:start

# In another terminal, start the admin panel
pnpm dev:admin
```

### Environment Variables
Copy `.env.example` to `.env.local` in each app directory and fill in the values.
Never commit `.env.local` files.

## Coding Standards

### TypeScript
- Strict mode enabled in all workspaces
- No `any` types — use `unknown` and narrow with type guards
- Prefer interfaces over type aliases for object shapes
- Export types alongside their implementations

### React (Admin Panel)
- Functional components only
- Use React Query for server state, React context for UI state
- Tailwind CSS for styling — no inline styles or CSS modules
- Co-locate components with their pages when page-specific

### Commit Messages
Follow Conventional Commits:
```
feat(admin): add user KYC approval workflow
fix(functions): handle duplicate delivery assignment
docs: update API documentation
```

### Branch Naming
```
feature/short-description
fix/issue-number-description
chore/maintenance-task
```

## Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes with tests
3. Ensure `pnpm lint` and `pnpm test` pass
4. Open a PR against `develop`
5. Request review from at least one team member
6. Squash merge after approval

## Project Structure
```
mooviz/
  apps/admin/    — React admin dashboard
  apps/mobile/   — React Native mobile app
  functions/     — Firebase Cloud Functions
  shared/        — Shared types and utilities
  docs/          — Documentation and ADRs
```
