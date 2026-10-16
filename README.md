# Soully API

Flower shop API and EJS administration, built with Express, TypeScript and MongoDB.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and set the database URL and two distinct random secrets.
3. Start MongoDB and run `npm run start:dev`.
4. Open `http://localhost:3003/admin`. The first shop administrator is registered through `/admin/signup`.

Run `npm run check`, `npm test`, and `npm run build` for validation. The build copies the EJS templates and static files into `dist`. Run `npm run start:prod` from this directory after building.

Uploads are stored in `uploads/members` and `uploads/products`. Preserve these files alongside the database: image paths are stored in MongoDB and cannot be checked through source references alone.

The shop role is `SELLER` and its endpoint is `/member/seller`. Existing `RESTAURANT` database records and `/member/restaurant` requests remain compatible; responses normalize the role to `SELLER` without rewriting the database. Order processing records a status change; this project has no payment-provider integration. Inventory is decremented atomically when a pending order is confirmed (PAUSE → PROCESS). Duplicate confirmations and concurrent orders cannot oversell. Cancelling a pending order or finishing an already confirmed order does not change stock. MongoDB Atlas or a replica set is required; standalone MongoDB is rejected on server startup. Real payment-provider confirmation is a separate integration.

Do not include `.env`, `node_modules`, generated output or database uploads in a source submission.

## Verification

Run `npm run check`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`, and `npm run format:check`.

Integration tests start an isolated real MongoDB process and retain their temporary artifacts. They never load the existing database configuration. The first run downloads the official MongoDB binary and requires network access.

## Catalog and deployment

`GET /product/all` returns `{ result: Product[], pagination: { page, limit, total, totalPages } }`. Without a collection it lists all active products. Wedding categories use `WEDDING_BOUQUET`; legacy `WEDDING` requests and records remain readable. Restart the API and rebuild the frontend together after updating this response contract.

Set `CORS_ORIGIN` to the exact frontend origins. Authentication uses HTTP-only cookies, so the frontend must send credentials. Production cookies require HTTPS; configure `TRUST_PROXY=1` only behind a trusted reverse proxy. Use distinct random session and JWT secrets. Preserve the MongoDB database and uploads when deploying. No seed command is required for the existing catalog.

## VPS production configuration

Production requires `NODE_ENV=production`, an HTTPS `CORS_ORIGIN`, valid `MONGO_URL`, two different random secrets of at least 32 characters, and an absolute persistent `UPLOAD_ROOT`. Startup fails when these requirements are missing. `COOKIE_SAME_SITE=lax` is appropriate for the same-origin VPS deployment. Both session and member cookies use Secure/HttpOnly and consistent logout options. Set `TRUST_PROXY=1` only behind the documented trusted proxy. `/health` reports database connectivity without credentials. Deployment templates and the server-audit limitations are included in the release's deploy directory.

## Inventory confirmation

Stock is not reserved by browsing, adding to cart, or creating a PAUSE order. Confirmation updates the owned order, all product quantities and member points in one MongoDB transaction. If any active product has insufficient stock, the entire transaction aborts with HTTP 409 and the order stays PAUSE. Existing historical PROCESS/FINISH orders are not retroactively deducted. The UI says Confirm Order; no real payment is collected.
