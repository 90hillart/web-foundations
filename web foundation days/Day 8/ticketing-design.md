# TicketHub — Ticketing System Design

## 1. Requirements

### Functional requirements

1. Users can register, log in, and manage their accounts.
2. Users can browse events, search by name or category, and view event details.
3. Users can view available, held, and sold seats for an event.
4. Users can temporarily hold available seats while completing checkout.
5. Users can pay for held seats and receive confirmed tickets.
6. Users can view their orders and tickets.
7. The system can expire unpaid holds and release seats automatically.
8. Administrators can create events, configure venues and seats, and monitor sales.

### Non-functional requirements

- **Speed:** Event listings and event details should normally load within 2 seconds. Seat availability requests should normally complete within 1 second, excluding slow external payment processing.
- **Correctness:** A seat must never be confirmed for two different orders. Payments and ticket creation must be handled reliably, even when requests are retried.
- **Fairness:** During a high-demand sale, users should enter through a controlled queue. Requests should be processed in a fair order, with rate limits and protections against automated purchasing. The system should not allow users to bypass the queue by repeatedly refreshing.
- **Availability:** Browsing should remain available during traffic spikes. If checkout becomes overloaded, the system should preserve booking correctness rather than accept unsafe purchases.
- **Scalability:** The application should add servers and workers to handle demand without requiring a complete redesign.
- **Security:** Use HTTPS, authenticated access, authorization checks, input validation, rate limiting, and secure payment-provider integration. Never store raw payment-card details.
- **Reliability:** Failed payments and expired holds should not leave seats permanently unavailable. Background jobs should retry safely.
- **Observability:** Record request latency, queue length, payment failures, hold expirations, and booking conflicts.

## 2. Traffic and capacity estimates

### Given assumptions

- Registered users: 2,000,000.
- Normal daily visitors: 50,000.
- Each normal-day visitor views 10 pages.
- Normal ticket sales: 5,000 per day.
- Big sale: 200,000 people attempt to buy 20,000 seats during the first 10 minutes.

These are planning estimates. Actual capacity should be validated with load tests, and page views are not assumed to be evenly distributed throughout the day.

### Normal-day traffic

**Page views per day**

50,000 visitors × 10 pages = 500,000 page views/day.

**Average page requests per second**

500,000 ÷ 86,400 seconds ≈ 5.8 page requests/second.

Assuming traffic peaks at 5 times the daily average:

5.8 × 5 ≈ 29 page requests/second.

**Average ticket sales rate**

5,000 tickets ÷ 86,400 seconds ≈ 0.058 tickets/second, or about 1 ticket every 17 seconds on average.

### Big-sale traffic

**Average arrival rate over 10 minutes**

200,000 people ÷ 600 seconds ≈ 333 purchase attempts/second.

This is the average rate during the sale window, not the maximum instantaneous burst. Real traffic may arrive in much sharper spikes.

**Seat supply and demand**

- Available seats: 20,000.
- Interested buyers: 200,000.
- Buyers per seat: 10.
- Maximum successful seat purchases: 20,000, assuming one seat per buyer for this estimate.
- At most 10% of interested buyers can obtain a seat.

**Illustrative checkout load**

If all 333 attempts/second reach the checkout service, the system must handle at least that average rate before accounting for retries, seat-map refreshes, and bursts. A queue should regulate how many users reach the transactional booking flow at once.

### Comparison

| Metric | Normal day | Big sale |
|---|---:|---:|
| Visitors / interested buyers | 50,000/day | 200,000 in 10 minutes |
| Page views / purchase attempts | 500,000 page views/day | About 333 purchase attempts/second on average |
| Estimated peak page traffic | About 29 requests/second | Potentially much higher; load-test required |
| Tickets available / sold | 5,000 sold/day | 20,000 seats available |
| Main challenge | Efficient everyday browsing | Fair admission, burst control, and correct seat allocation |

The big sale concentrates 200,000 people into 10 minutes. It must not be handled like ordinary daily traffic. TicketHub should serve cached event information at scale, while carefully limiting access to the seat-holding and payment workflow.

## 3. API design

All endpoints use HTTPS and JSON. Authenticated endpoints require a valid session or access token. IDs are illustrative.

| Method and endpoint | Purpose | Expected result |
|---|---|---|
| `GET /api/events` | Browse and search events; supports pagination and filters | `200 OK` with event list |
| `GET /api/events/{eventId}` | View event details, venue, date, and pricing | `200 OK` with event details |
| `GET /api/events/{eventId}/seats` | View seat availability and prices | `200 OK` with seat map data |
| `POST /api/seat-holds` | Temporarily hold one or more available seats | `201 Created` with hold ID and expiry |
| `POST /api/orders/{orderId}/payment` | Initiate or confirm payment through a payment provider | `202 Accepted` while processing, then a confirmed or failed status |
| `GET /api/me/tickets` | View the signed-in user's confirmed tickets | `200 OK` with ticket list |

The API should also support safe retries. For example, `POST /api/seat-holds` and payment initiation should accept an idempotency key so that repeating a request does not create duplicate holds or charge a customer twice.

### Example: hold seats

Request:

```http
POST /api/seat-holds
Authorization: Bearer <access-token>
Idempotency-Key: 8f31-example-key
Content-Type: application/json
```

```json
{
  "eventId": 42,
  "seatIds": [501, 502]
}
```

Successful response:

```json
{
  "holdId": "hold_123",
  "status": "HELD",
  "seatIds": [501, 502],
  "expiresAt": "2026-10-16T12:05:00Z"
}
```

If any requested seat is unavailable, the API returns `409 Conflict` and does not create a partial hold. The hold has a short expiry, for example five minutes, to avoid locking seats indefinitely.

Other useful responses include `400 Bad Request` for invalid input, `401 Unauthorized` for an unauthenticated request, `403 Forbidden` for an unauthorized action, `404 Not Found` for a missing event or order, and `429 Too Many Requests` when a client exceeds rate limits.

## 4. Data model

The core model uses four tables: `users`, `events`, `seats`, and `orders`. A separate `order_items` table supports orders containing multiple seats, while a `seat_holds` table records temporary reservations.

### Relationships

- One user can have many orders.
- One event has many seats.
- One order can contain many order items.
- Each order item refers to one seat.
- A seat can have only one confirmed order item at a time.
- A temporary hold belongs to one user and one seat; holds expire after a defined time.

### Example relational schema (PostgreSQL)

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    venue VARCHAR(200) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('DRAFT', 'ON_SALE', 'SOLD_OUT', 'CANCELLED'))
);

CREATE TABLE seats (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id),
    section VARCHAR(50) NOT NULL,
    seat_number VARCHAR(20) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD')),
    UNIQUE (event_id, section, seat_number),
    UNIQUE (id, event_id)
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    seat_id BIGINT NOT NULL REFERENCES seats(id),
    price_paid NUMERIC(10, 2) NOT NULL CHECK (price_paid >= 0),
    UNIQUE (seat_id)
);

CREATE TABLE seat_holds (
    id BIGSERIAL PRIMARY KEY,
    seat_id BIGINT NOT NULL REFERENCES seats(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    hold_token UUID NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED'))
);

CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_holds_expiry ON seat_holds(expires_at)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
```

The `UNIQUE (seat_id)` constraint on `order_items` is the final database safeguard against a seat appearing in two orders. In a production schema, the order lifecycle and ticket issuance must also be designed so that only paid orders issue valid tickets. Database constraints, transaction logic, and payment reconciliation work together; a status field alone is not sufficient.

## 5. Preventing double-booking

TicketHub uses a transactional database as the authority for seat ownership. The seat map shown in a browser may become stale, so the server must verify availability when a hold is requested.

### Seat-holding flow

1. The user joins the sale queue and receives permission to enter checkout.
2. The user selects seats and submits a hold request.
3. The application begins a database transaction.
4. It locks the requested seat rows using `SELECT ... FOR UPDATE`, in a consistent seat-ID order to reduce deadlocks.
5. It checks each seat's status and whether any existing hold is still active.
6. If every requested seat is available, it marks them as held and records the hold expiry. If any seat is unavailable, it rolls back the entire transaction.
7. It commits the transaction and returns the hold details.

Illustrative SQL:

```sql
BEGIN;

SELECT id, status
FROM seats
WHERE id IN (501, 502)
ORDER BY id
FOR UPDATE;

-- Application verifies that all seats are AVAILABLE
-- and have no unexpired active hold.
-- If any seat is unavailable, ROLLBACK.

UPDATE seats
SET status = 'HELD'
WHERE id IN (501, 502)
  AND status = 'AVAILABLE';

-- Application verifies that exactly two rows were updated.
-- Insert the corresponding active seat_holds records.

COMMIT;
```

The production implementation must handle expiry under the same locking protocol: an expired hold may be released and replaced only after the transaction has verified that it is truly expired. A background worker can clean up expired holds, but correctness must not depend on that worker running at the exact expiry time.

### Payment and confirmation

1. The customer pays through an external payment provider using the order's unique reference.
2. The server validates the provider's signed callback or queries the provider to confirm the payment. It must not trust a browser-only success message.
3. In a new database transaction, the server locks the order and its held seats, verifies that the hold is valid and belongs to that order, records the payment result, and confirms the order.
4. It converts the hold into a completed booking and issues tickets exactly once.
5. If payment fails or the hold expires before confirmation, the system follows a defined cancellation/refund process and releases seats safely.

Use unique payment-provider references and idempotent webhook processing to prevent duplicate charges or duplicate ticket issuance. If a payment succeeds after its hold has expired and another buyer has acquired the seat, the system must not steal the new buyer's seat; it should trigger a refund or manual reconciliation.

**Why this prevents double-booking:** row locks serialize competing hold attempts for the same seat. The database transaction ensures that the seat changes atomically, and the unique constraint on `order_items.seat_id` prevents a second confirmed order from owning the same seat even if application code has a bug. The seat's `HELD` status by itself is not enough without atomic transactions and database constraints.

## 6. Architecture and handling the big sale

### Architecture diagram

```text
                    Customers / Browsers
                            |
                         DNS + CDN
                            |
                 Web Application Firewall
                            |
                     Load Balancer
                            |
                +-----------+-----------+
                |                       |
           App Servers              Sale Queue
                |                       |
                |                Admission / Rate Limits
                |                       |
                +-----------+-----------+
                            |
                  Booking / Order Service
                            |
                +-----------+-----------+
                |                       |
          Redis Cache              Primary SQL DB
       Event details,             Transactions,
       short-lived data            seat locks,
                |                  unique constraints
                |                       |
                |                 Read Replica
                |
        Message Queue / Outbox
                |
         Background Workers
       Hold expiry, notifications,
       ticket generation, reconciliation
                |
       Payment Provider / Webhooks
```

### Component responsibilities

- **DNS and CDN:** Deliver static assets and cache public event information close to users. Seat availability and checkout decisions must not rely on stale CDN data.
- **Web Application Firewall:** Blocks common attacks and helps filter abusive traffic.
- **Load balancer:** Distributes requests across multiple stateless application servers and performs health checks.
- **Application servers:** Authenticate users, validate requests, enforce business rules, and call the booking service.
- **Sale queue:** Admits users at a controlled rate during popular sales. A fair, auditable queue and signed admission tokens reduce overload and discourage bypassing.
- **Redis cache:** Serves frequently read event details and other safe-to-cache data. The SQL database remains the source of truth for seat availability and bookings.
- **Primary SQL database:** Handles transactional seat holds, orders, payment results, and uniqueness constraints. It should be sized and tested for lock contention and peak write load.
- **Read replica:** Handles suitable read-heavy queries such as order history or event reporting. Reads that determine whether a seat can be purchased must use the authoritative transactional path.
- **Message queue and workers:** Process emails, ticket generation, hold cleanup, and payment reconciliation asynchronously. Jobs should be retryable and idempotent.
- **Payment provider:** Processes payments externally and notifies TicketHub through authenticated callbacks. TicketHub verifies payment status before confirming an order.

### How it survives the big sale

1. The CDN absorbs repeated requests for event pages and static files.
2. The queue limits how many of the 200,000 interested buyers reach checkout at once.
3. Stateless app servers scale horizontally as admitted traffic increases.
4. The booking service uses bounded connection pools, request timeouts, rate limits, and backpressure to protect the database.
5. Transactions and seat-level locking serialize competing purchases. A seat is never sold just because a cached seat map says it is available.
6. Notifications and other non-critical work run asynchronously, keeping checkout responsive.
7. Metrics and alerts monitor queue wait time, checkout latency, database locks, payment failures, and error rates. Load tests and rehearsed recovery plans establish realistic capacity before the event.

The queue improves fairness and protects the database, but it cannot guarantee every user will get a ticket. With 200,000 interested buyers for 20,000 seats, most users will be unsuccessful. TicketHub should clearly communicate queue position and sale status and avoid promising a seat until the transaction succeeds.

## 7. Trade-offs

### Trade-off 1: Strong consistency versus availability

Using transactional row locks and a single authoritative booking database can slow checkout under heavy contention. However, allowing independent servers to make seat-ownership decisions without coordination risks selling the same seat twice. TicketHub prioritizes correctness for seat allocation and may temporarily reject or delay purchases when the database is overloaded.

### Trade-off 2: Fair queue versus immediate access

A controlled queue adds waiting time and system complexity. Users may prefer instant access, but sending all 200,000 buyers directly to checkout could overwhelm the database and give an unfair advantage to clients that repeatedly retry. A transparent queue with rate limits offers more predictable and auditable admission.

### Trade-off 3: Cache speed versus freshness

Caching event descriptions and images reduces latency and database load. Caching seat availability too aggressively can mislead customers because another buyer may hold or purchase a seat moments later. TicketHub therefore caches public information but checks seat ownership inside the transactional booking flow.

### Trade-off 4: Automatic expiry versus customer experience

Short holds make seats available to other customers quickly, but users with slow networks or payment delays may lose a seat. A clearly displayed countdown, a reasonable hold duration, safe payment reconciliation, and clear refund handling balance fairness with usability.
