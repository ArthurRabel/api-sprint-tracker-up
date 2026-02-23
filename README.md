# Sprint Tracker Up API

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ArthurRabel/api-sprint-tracker-up)
![Version](https://img.shields.io/badge/version-1.0.0--alpha-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-green)
![Node](https://img.shields.io/badge/node-22-brightgreen)

**Sprint Tracker Up** is a production-grade REST API for agile project management, built with **NestJS** and **TypeScript**. It provides a complete Kanban board system with lists, tasks, role-based access control, multi-provider authentication (Local, Google, Microsoft, LDAP), and real-time updates via WebSocket.

Originally an evolutionary fork of the Sprint Tracker project (IESB Bay Area), the codebase was fully redesigned around a **Modular Monolith** architecture — prioritizing strict module isolation, event-driven communication, and horizontal scalability through **BullMQ** background processing. The API also supports Trello board imports, S3-compatible file storage, and automated email notifications.

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [LDAP Setup (Optional)](#ldap-setup-optional)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Architecture

The system adopts a **Modular Monolith** architecture built with NestJS. The central focus is the **separation of concerns** through isolated business domains, ensuring that the logic for Boards, Tasks, Users, and other modules does not overlap.

**Core principles:**

- **Decoupling** — Modules remain independent with strictly controlled interactions.
- **Event-Driven Communication** — `EventEmitter2` for async, decoupled inter-module messaging.
- **Repository Pattern** — Each module encapsulates Prisma data access through its own repository.
- **Type Safety** — The `any` type is strictly prohibited in the `/src` directory.
- **Clean Controllers** — All Swagger/OpenAPI decorators are abstracted into `.docs.ts` files.

> For the full architecture specification, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Features

### Core

- **Kanban Board Management** — Create boards with lists and tasks following a Kanban-style workflow.
- **Task Lifecycle** — Granular control over task status (TODO → IN_PROGRESS → DONE → ARCHIVED), assignment, labels, due dates, and position ordering.
- **Board Membership & Roles** — Role-based access control (ADMIN, MEMBER, OBSERVER) with invitation system and notifications.
- **Multi-Provider Authentication** — Support for **Local (Email/Password)**, **Google OAuth2**, **Microsoft OAuth**, and **LDAP**.
- **Analytics & Reporting** — Progress metrics and dashboards for monitoring board and task performance.

### Infrastructure

- **Asynchronous Processing** — BullMQ with Valkey for background job processing (e.g., Trello data import), keeping the API responsive under load.
- **Scalable File Storage** — S3-compatible storage (AWS S3 / MinIO) for user avatars and attachments.
- **Trello Migration** — Specialized JSON parser for importing boards, lists, and tasks directly from Trello exports.
- **Real-Time Communication** — WebSocket gateways for live updates and event broadcasting.
- **Email Notifications** — Templated email service with Handlebars for board invitations and password resets.
- **Health Monitoring** — Built-in health check endpoint at `/health-check`.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | NestJS (Node.js 22) |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL 18 |
| **ORM** | Prisma |
| **Cache & Queues** | Valkey + BullMQ |
| **Storage** | S3-Compatible (AWS S3 / MinIO) |
| **Auth** | Passport.js, JWT, Argon2 |
| **API Docs** | OpenAPI (Swagger + Scalar) |
| **Testing** | Jest, Supertest |
| **Containerization** | Docker (multi-stage build) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **Docker** (for PostgreSQL or full stack)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start a PostgreSQL container:**
   ```bash
   docker run --name dev-database \
     -e POSTGRES_PASSWORD=password_postgres \
     -e POSTGRES_USER=user_postgres \
     -d -p 5432:5432 postgres:18-alpine
   ```

3. **Create the `.env` file** based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

   > [!IMPORTANT]
   > The database credentials in `.env` must match the ones used when creating the PostgreSQL container.

4. **Apply database migrations:**
   ```bash
   npx prisma migrate dev
   ```

5. **Start the development server:**
   ```bash
   npm run start:dev
   ```

6. **Access the API docs** at [http://localhost:3000/docs](http://localhost:3000/docs).

## Environment Variables

Create a `.env` file from the example template. The key configuration groups are:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `PORT` | API server port | `3000` |
| `JWT_SECRET` | Secret for access token signing | — |
| `JWT_RESET_SECRET` | Secret for password reset tokens | — |
| `ENABLE_EMAIL` | Enable email notification service | `false` |
| `ENABLE_DATABASE_IN_MEMORY` | Enable Valkey/Redis for BullMQ | `false` |
| `ENABLE_GOOGLE_OAUTH` | Enable Google OAuth2 provider | `false` |
| `ENABLE_MICROSOFT_OAUTH` | Enable Microsoft OAuth provider | `false` |
| `ENABLE_LDAP_OAUTH` | Enable LDAP authentication | `false` |
| `S3_*` | S3-compatible storage configuration | — |

> See [.env.example](.env.example) for the full list of variables.

---

## API Documentation

Once running, interactive API documentation is available at:

- **Scalar UI** — [http://localhost:3000/docs](http://localhost:3000/docs)

All endpoints are documented using OpenAPI/Swagger decorators abstracted into `.docs.ts` files for each module.

---

## Testing

The project follows a strict testing strategy:

- **Unit Tests** (`*.spec.ts`) — For services and processors only. All dependencies are mocked.
- **E2E Tests** (`*.e2e-spec.ts`) — For controllers only. Tests the full request-response lifecycle.

```bash
# Run unit tests
npm run test

# Run unit tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

---

## LDAP Setup (Optional)

1. **Start an OpenLDAP container:**
   ```bash
   docker run --name openldap --detach \
     -p 389:389 -p 636:636 \
     -e LDAP_DOMAIN="example.com" \
     -e LDAP_ORGANISATION="My Company" \
     -e LDAP_ADMIN_PASSWORD="your_secure_password" \
     osixia/openldap:latest
   ```

2. **Create a user LDIF file** (`user_create.ldif`):
   ```ldif
   dn: uid=55566677788,ou=users,dc=example,dc=com
   objectClass: inetOrgPerson
   objectClass: organizationalPerson
   cn: Test User LDAP
   sn: LDAP
   uid: 55566677788
   mail: test.ldap@company.com
   description: testuser
   ```

3. **Copy the file into the container and create the user:**
   ```bash
   docker cp user_create.ldif openldap:/tmp/user_create.ldif

   docker exec -it openldap ldapadd -x -H ldap:// \
     -D "cn=admin,dc=example,dc=com" \
     -w your_secure_password \
     -f /tmp/user_create.ldif
   ```

4. **Configure LDAP in `.env`:**
   ```dotenv
   ENABLE_LDAP_OAUTH=true
   LDAP_URL=ldap://localhost:389
   LDAP_ADMIN_DN=cn=admin,dc=example,dc=com
   LDAP_ADMIN_PASSWORD=your_secure_password
   LDAP_USER_BASE_DN=ou=users,dc=example,dc=com
   ```

---

## Project Structure

```
src/
├── analysis/        # Analytics & reporting module
├── auth/            # Authentication (Local, OAuth, LDAP, JWT)
├── board/           # Board management (CRUD, members, invites)
├── common/          # Shared enums, interfaces, and utilities
├── infrastructure/  # Cross-cutting: Prisma, S3, Email, Events, Health
├── integrations/    # External integrations (Trello import)
├── list/            # List management (Kanban columns)
├── middleware/      # HTTP middleware (logging)
├── task/            # Task management (CRUD, status, labels)
└── user/            # User management (profile, avatar)

test/
├── e2e/             # End-to-end tests (controller integration)
├── fixtures/        # Test data factories
├── helpers/         # Test utilities
└── types/           # Test type definitions

docs/
├── ARCHITECTURE.md  # Full architecture specification
└── INTRODUCTION.md  # Project introduction and overview
```

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our commit conventions, branch naming strategy, code style guidelines, and pull request process.

---

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE.md](LICENSE.md) file for details.
