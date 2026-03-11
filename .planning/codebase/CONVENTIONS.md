# Coding Conventions

**Analysis Date:** 2026-03-11

## Naming Patterns

**Files:**
- `PascalCase.tsx` for React components such as `codex-switcher-origin/src/components/AddAccountModal.tsx`
- `camelCase.ts` for hooks/modules such as `codex-switcher-origin/src/hooks/useAccounts.ts`
- `index.ts` for barrel exports such as `codex-switcher-origin/src/components/index.ts`
- `snake_case.rs` for Rust modules such as `codex-switcher-origin/src-tauri/src/auth/token_refresh.rs`

**Functions:**
- Frontend event handlers use `handleXxx` names in `codex-switcher-origin/src/App.tsx` and modal components
- Loader/refresh/toggle helpers use `loadXxx`, `refreshXxx`, and `toggleXxx`
- Rust command/service functions use `snake_case` and descriptive verbs such as `switch_account` and `refresh_chatgpt_tokens`

**Variables:**
- Frontend local variables are `camelCase`
- Frontend constants are `UPPER_SNAKE_CASE`, e.g. `SECURITY_OPTIONS`
- Rust constants are `UPPER_SNAKE_CASE`

**Types:**
- TypeScript interfaces and aliases use `PascalCase`
- Frontend payload field names intentionally mirror Rust `snake_case` fields in `codex-switcher-origin/src/types/index.ts`
- Rust enums/structs use `PascalCase`

## Code Style

**Formatting:**
- TypeScript style is consistent with standard React/Vite formatting and 2-space indentation
- String literals mostly use double quotes in frontend source
- Rust code follows `rustfmt`-style formatting
- Tailwind utility classes are inlined inside JSX components

**Linting:**
- No ESLint or Prettier config detected
- No `lint` script in `codex-switcher-origin/package.json`
- TypeScript strictness is enforced via `codex-switcher-origin/tsconfig.json`

## Import Organization

**Order:**
1. External packages (`react`, Tauri packages)
2. Internal modules (`./hooks/useAccounts`, `../types`)
3. Type imports
4. Styles

**Grouping:**
- Blank lines usually separate external imports from local imports
- Relative imports are used everywhere; no path aliases detected

## Error Handling

**Patterns:**
- Frontend boundaries use `try/catch`, `console.error`, and sometimes rethrow
- Hook methods either throw raw errors upward or normalize UI state before rethrowing
- Rust command functions convert internal errors to `String` with `map_err(|e| e.to_string())`
- Internal Rust services use `anyhow::Result` and `Context` for richer failure causes

**Error Types:**
- No shared frontend/native error code contract exists
- UI messages are mostly inline string literals in `codex-switcher-origin/src/App.tsx` and modal components

## Logging

**Framework:**
- Frontend: `console.error`
- Rust: `println!`

**Patterns:**
- Logs are emitted at side-effect boundaries such as OAuth, usage requests, token refresh, and process handling
- No structured logging abstraction exists

## Comments

**When to Comment:**
- Module headers describe purpose, especially in Rust files such as `codex-switcher-origin/src-tauri/src/lib.rs`
- Comments explain intent around build/dev integration and security-sensitive helpers
- JSX comments are used to label major UI sections in `codex-switcher-origin/src/App.tsx`

**TODO Comments:**
- No stable TODO convention detected

## Function Design

**Size:**
- Frontend orchestrator functions in `src/App.tsx` are often large because the app is page-centric
- Rust modules prefer medium-sized focused functions, with helpers extracted for crypto, parsing, and storage

**Parameters / Returns:**
- Frontend callback props use Promise-returning handler signatures
- Rust service functions prefer explicit structs and `Result<T>` returns

## Module Design

**Exports:**
- React components are named exports; barrel exports are used for components
- Rust submodules are re-exported via `mod.rs` files

**Barrel Files:**
- `codex-switcher-origin/src/components/index.ts` is the main frontend barrel file
- No broad frontend feature barrels beyond components detected

---
*Convention analysis: 2026-03-11*
*Update when patterns change*
