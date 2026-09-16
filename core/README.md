# `@ticket-system/core`

Shared TypeScript code, types, constants, validation schemas, and utilities for the AI-Powered Ticket Management System frontend and backend.

## Overview

This workspace package provides a single source of truth for:
- **Types**: Ticket, User, Message, Pagination, API responses (`@core/types` or `@core`)
- **Constants**: Enums, status definitions, category labels, role labels (`@core/constants` or `@core`)
- **Validation Schemas**: Zod schemas for User and Ticket creation, updating, and filtering (`@core/schemas` or `@core`)
- **Utilities**: Ticket number formatting, string truncation, name initials, email normalization (`@core/utils` or `@core`)

---

## Directory Structure

```
core/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts               # Main barrel re-exporting all modules
    ├── types/                 # TypeScript interfaces & types
    │   ├── ticket.ts
    │   ├── user.ts
    │   ├── common.ts
    │   └── index.ts
    ├── constants/             # Enums & string constants
    │   ├── ticket.ts
    │   ├── user.ts
    │   └── index.ts
    ├── schemas/               # Zod validation schemas
    │   ├── ticket.ts
    │   ├── user.ts
    │   └── index.ts
    └── utils/                 # Shared helper functions
        ├── formatters.ts
        └── index.ts
```

---

## Usage in Backend & Frontend

Both the **backend** (Bun / Node) and **frontend** (Vite / React) are configured with the `@core` path alias and workspace linking.

### Importing from `@core`

```typescript
// Import all from root
import {
  TicketStatus,
  Priority,
  createUserSchema,
  formatTicketNumber,
  TICKET_STATUS_LABELS,
} from '@core';

// Or import from specific subpaths
import type { TicketItem, UserItem } from '@core/types';
import { createUserSchema } from '@core/schemas';
import { TICKET_STATUS_LABELS } from '@core/constants';
import { formatTicketNumber, getInitials } from '@core/utils';
```
