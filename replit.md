# SwiftShip — Logistics Management System

## Overview

Full-stack logistics delivery management system for a Nepal-based courier company (Kathmandu, Lalitpur, Bhaktapur districts). Built as a pnpm workspace monorepo.

## Architecture

- **Frontend**: React + Vite (`artifacts/logistics`) at preview path `/`
- **Backend API**: Express 5 (`artifacts/api-server`) on port 8080, routes at `/api/*`
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **API Client**: Generated via Orval from OpenAPI spec (`lib/api-client-react`)
- **Monorepo tool**: pnpm workspaces
- **Node.js**: 24, TypeScript 5.9

## Features

- **Role-based access**: admin, manager, vendor, rider, staff
- **Order lifecycle**: new → assigned → picked → out_for_delivery → delivered/failed/returned
- **Duplicate detection**: phone + 2+ matching fields within 48h, confidence scoring
- **Bulk order entry**: spreadsheet-style multi-row form with inline validation
- **COD/Payment release**: vendor balance tracking, payment request workflow
- **Stock management**: per-vendor product tracking with opening/received/delivered/returned/damaged counts
- **Support tickets**: threaded messaging system with categories and priorities
- **Audit logs**: full action history for admin
- **Analytics dashboard**: order trends chart (Recharts), station performance, rider leaderboard
- **Notifications**: in-app notification system

## Branding

- Primary color: Red `#dc2626` (Tailwind `red-600`)
- White sidebar text on red background
- Professional logistics SaaS aesthetic

## Demo Credentials

| Role    | Email                        | Password    |
|---------|------------------------------|-------------|
| Admin   | admin@swiftship.com          | Admin@123   |
| Manager | manager@swiftship.com        | Manager@123 |
| Vendor1 | vendor1@swiftship.com        | Vendor@123  |
| Vendor2 | vendor2@swiftship.com        | Vendor@123  |
| Rider1  | rider1@swiftship.com         | Rider@123   |
| Rider2  | rider2@swiftship.com         | Rider@123   |

## Key Packages

- `artifacts/logistics` — React frontend (port 8081/24024)
- `artifacts/api-server` — Express API server (port 8080)
- `lib/db` — Drizzle ORM schema + client
- `lib/api-spec` — OpenAPI YAML spec + codegen config
- `lib/api-client-react` — Generated TanStack Query hooks
- `scripts` — Seeding utilities

## Key Commands

- `pnpm run typecheck` — typecheck all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed demo data

## Database Schema (13 tables)

`users`, `stations`, `vendors`, `riders`, `orders`, `order_comments`, `order_status_history`, `stock`, `bank_accounts`, `payment_requests`, `tickets`, `ticket_messages`, `notifications`, `audit_logs`

## Auth

- SHA256 + salt password hashing
- Base64 token with `{userId, role, iat}`
- Token stored in `localStorage` as `authToken`
- Bearer token sent via `Authorization` header on all API requests
