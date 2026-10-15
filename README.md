# Soully API

Flower shop API and EJS administration, built with Express, TypeScript and MongoDB.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and set the database URL and two distinct random secrets.
3. Start MongoDB and run `npm run start:dev`.
4. Open `http://localhost:3003/admin`. The first shop administrator is registered through `/admin/signup`.

Run `npm run check`, `npm test`, and `npm run build` for validation. The build copies the EJS templates and static files into `dist`. Run `npm run start:prod` from this directory after building.

Uploads are stored in `uploads/members` and `uploads/products`. Preserve these files alongside the database: image paths are stored in MongoDB and cannot be checked through source references alone.

The shop role is `SELLER` and its endpoint is `/member/seller`. Existing `RESTAURANT` database records and `/member/restaurant` requests remain compatible; responses normalize the role to `SELLER` without rewriting the database. Order processing records a status change; this project has no payment-provider integration. Catalog availability is checked at checkout; inventory reservation and payment confirmation need a transactional production workflow.

Do not include `.env`, `node_modules`, generated output or database uploads in a source submission.

## Verification

Run `npm run check`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`, and `npm run format:check`.

Integration tests start an isolated real MongoDB process and retain their temporary artifacts. They never load the existing database configuration. The first run downloads the official MongoDB binary and requires network access.

## Catalog and deployment

`GET /product/all` returns `{ result: Product[], pagination: { page, limit, total, totalPages } }`. Without a collection it lists all active products. Wedding categories use `WEDDING_BOUQUET`; legacy `WEDDING` requests and records remain readable. Restart the API and rebuild the frontend together after updating this response contract.

Set `CORS_ORIGIN` to the exact frontend origins. Authentication uses HTTP-only cookies, so the frontend must send credentials. Production cookies require HTTPS; configure `TRUST_PROXY=1` only behind a trusted reverse proxy. Use distinct random session and JWT secrets. Preserve the MongoDB database and uploads when deploying. No seed command is required for the existing catalog.
