# SynapseLab Backend API

A production-grade, secure, and highly scalable SaaS backend designed for web-based cognitive science and behavioral experiments. Built with Node.js, Express, TypeScript, PostgreSQL, Prisma, Redis, and BullMQ.

## Features

- **Robust Identity & Access Management**: Role-Based Access Control (Admin, Researcher, Participant), secure Argon2/Bcrypt password hashing, and JWT-based session management with HTTP-only cookies.
- **Experiment Engine**: Full lifecycle management (Draft, Published, Paused, Closed). Immutable versioning configuration that locks trials, logic, and randomization once an experiment is published.
- **Eligibility & Quality Systems**: Automated server-side participant eligibility evaluation (age, ratings, attempts) and integrated participant rating tracking with reviewable researcher quality flags.
- **High-Throughput Ingestion**: Idempotent batch-event ingestion endpoints designed for reliable event tracking with minimal latency.
- **Background Jobs**: BullMQ and Redis for offloading heavy processing tasks, like generating and streaming deep CSV/Excel/JSON export datasets.
- **Automated Analytics**: On-the-fly computational aggregation (Mean RT, Median RT, Standard Deviation, Accuracy) partitioned by experiment conditions.

## Tech Stack

- **Runtime**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Caching & Queues**: Redis, BullMQ
- **Security**: Helmet, Express Rate Limit, HPP, CORS, Zod (Schema Validation)
- **Tooling**: Jest, Supertest, Docker, Swagger UI (OpenAPI)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Docker & Docker Compose (for spinning up Postgres & Redis locally)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```
   *(Update `.env` with your specific database/redis credentials if you aren't using the default Docker config)*

4. **Start Infrastructure:**
   Start the PostgreSQL and Redis containers using Docker Compose:
   ```bash
   docker compose up -d
   ```

5. **Database Migration & Seeding:**
   Run Prisma migrations to set up the database schema and populate it with initial realistic seed data:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

### Running the Application

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## API Documentation

Once the server is running, the complete OpenAPI documentation (Swagger UI) is available at:

- **Local:** [http://localhost:4000/api/v1/docs](http://localhost:4000/api/v1/docs)

## Testing

Run the test suite using Jest:

```bash
npm test
```
*(Note: Tests currently expect an active database and Redis connection defined in your `.env` file.)*

## Architecture & Code Structure

- `/src/common`: Shared middleware (auth, validate, rate-limit), error definitions, and utilities.
- `/src/config`: Environment configurations, Database, and Redis setup.
- `/src/modules`: The core business logic organized by domain (auth, users, experiments, sessions, quality, exports).
- `/src/workers`: BullMQ background job workers.
- `/prisma`: Database schema definition and seed scripts.
- `/tests`: Integration and unit tests.

## Security Considerations

- The backend acts as the authoritative source of truth. It never trusts client-submitted eligibility, attempt limits, or experiment metadata.
- All identifiers are UUIDs to prevent enumeration.
- Immutable experiment versioning ensures historical data integrity. 

## License
MIT License
