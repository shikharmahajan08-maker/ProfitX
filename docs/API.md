# API

All procedures are exposed through the scaffold's tRPC endpoint under `/api/trpc`. Authentication is provided by the Manus OAuth/session middleware. Procedures marked **protected** require an authenticated server context.

## Authentication

### `auth.me` — query

- **Auth:** optional
- **Input:** none
- **Response:** current user identity or `null`. Passwords and auth secrets are never returned.
- **Errors:** none for an unauthenticated request.

### `auth.logout` — mutation

- **Auth:** optional
- **Input:** none
- **Response:** `{ success: true }`
- **Errors:** cookie/session infrastructure errors are handled by the server boundary.

### `account.bootstrap` — query

- **Auth:** protected
- **Input:** none
- **Response:** `{ user, initialVirtualCash, dataMode }`
- **Errors:** `UNAUTHORIZED` if no session exists.

## Market data

### `market.search` — query

- **Auth:** public
- **Input:** `{ query?: string, sector?: string }`
- **Response:** provider-neutral stock quote records with symbol, company, sector, quote, range, volume, and market cap fields.
- **Errors:** input validation for overlong query or sector values.

### `market.quote` — query

- **Auth:** public
- **Input:** `{ symbol: string }`
- **Response:** one stock record or `undefined` when the symbol is not in the current provider.
- **Errors:** invalid symbol format.

### `market.history` — query

- **Auth:** public
- **Input:** `{ symbol: string, range: "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y" }`
- **Response:** `{ date, price }[]`
- **Errors:** invalid symbol or range format.

### `market.sectors` — query

- **Auth:** public
- **Input:** none
- **Response:** sorted string array of supported sectors.

## News

### `news.list` — query

- **Auth:** public
- **Input:** `{ sector?: string }` or omitted
- **Response:** development news items with title, description, source, sector, publication label, and related symbol.
- **Errors:** input validation errors.

## Trading

### `trading.validate` — mutation

- **Auth:** protected
- **Input:** `{ symbol: string, side: "BUY" | "SELL", quantity: number }`
- **Response:** `{ valid: true, symbol, side, quantity, price, estimatedTotal }`
- **Errors:** `UNAUTHORIZED`, invalid quantity, unavailable symbol, or provider errors.

The local preview store executes the browser acceptance flow. The next backend milestone should connect this validated contract to an atomic database transaction that creates an order, transaction, holding update, and cash update together.

## Error shape

The frontend surfaces human-readable messages. Production errors should follow the project convention and avoid stack traces, SQL messages, secrets, or password material.

```json
{ "success": false, "message": "Insufficient virtual cash for this order." }
```
