# SnapShare Photo App: Scaling Plan

## 1. Assumptions

SnapShare is a photo-sharing application where users upload photos and view feeds from people they follow.

Given:
- Registered users: 10,000,000
- Daily active users (DAU): 10% of registered users
- Uploads per active user: 1 photo per day
- Feed views per active user: 50 per day
- Original photo size: 2 MB
- Thumbnail size: 50 KB
- Peak traffic multiplier: 5× average traffic

Assumptions:
- A day contains 86,400 seconds.
- A year contains 365 days.
- All daily active users upload one photo daily.
- Each uploaded photo generates one thumbnail.
- Peak traffic is five times the average rate.
- Storage calculations exclude replication overhead, backups, and metadata.

## 2. Capacity Estimates

### A. Daily Active Users

DAU = Registered users × 10%

DAU = 10,000,000 × 0.10

**DAU = 1,000,000 users**

### B. Daily Photo Uploads

Each active user uploads one photo per day.

Daily uploads = 1,000,000 × 1

**Daily uploads = 1,000,000 photos**

### C. Average Upload Rate

Average uploads per second = Daily uploads ÷ 86,400

= 1,000,000 ÷ 86,400

**Average upload rate ≈ 11.57 uploads/second**

### D. Peak Upload Rate

Peak upload rate = Average upload rate × 5

= 11.57 × 5

**Peak upload rate ≈ 57.87, or approximately 58 uploads/second**

The upload API and queue ingestion system should be designed to handle at least this estimated peak, with additional capacity for bursts, retries, and future growth. Actual production capacity should be validated through load testing.

### E. Average Feed Views

Daily feed views = DAU × Feed views per user

= 1,000,000 × 50

**Daily feed views = 50,000,000**

Average feed views per second = 50,000,000 ÷ 86,400

**Average feed views ≈ 579 views/second**

### F. Peak Feed Views

Peak feed views per second = Average feed views per second × 5

= 579 × 5

**Peak feed views ≈ 2,894 views/second**

This makes SnapShare a read-heavy application because feed views significantly exceed photo uploads. The system should prioritize efficient media delivery, caching, and scalable read operations.

### G. Annual Original Photo Storage

Daily original storage = 1,000,000 × 2 MB

= 2,000,000 MB = 2 TB per day, using decimal units.

Annual original storage = 2 TB × 365

**Annual original storage = 730 TB**

### H. Annual Thumbnail Storage

Assuming 50 KB per thumbnail:

Daily thumbnail storage = 1,000,000 × 50 KB

= 50,000,000 KB = 50 GB per day, using decimal units.

Annual thumbnail storage = 50 GB × 365

**Annual thumbnail storage = 18.25 TB**

### I. Total Annual Media Storage

Total annual media storage = Original photos + Thumbnails

= 730 TB + 18.25 TB

**Total annual media storage = 748.25 TB, approximately 750 TB**

This estimate excludes backups, replicas, abandoned uploads, and storage-system overhead. Object storage is appropriate for this volume because storing binary media in a relational database would increase database size, backup costs, and operational complexity.

## 3. Read-Heavy or Write-Heavy?

SnapShare is a **read-heavy system**.

Each active user generates approximately 50 feed views per day but only one photo upload per day. At the average rates calculated above, the system handles approximately 579 feed views per second and 11.57 uploads per second.

The architecture should therefore optimize read performance using:
- A content delivery network (CDN) for images and thumbnails.
- An application cache, such as Redis, for frequently accessed feed data and metadata.
- Database read replicas for read-heavy metadata queries.
- Object storage for original photos and generated thumbnails.
- Background workers for thumbnail generation so image processing does not delay upload requests.

The upload API must still support approximately 58 uploads per second during estimated peak traffic.

## 4. Architecture Diagram

```text
                         USERS
                           |
                           v
                    +--------------+
                    | CDN / Edge   |
                    | Image Cache  |
                    +--------------+
                           |
                           v
                    +--------------+
                    | Load Balancer|
                    +--------------+
                           |
                           v
                    +--------------+
                    | API Servers  |
                    | Upload/Feed  |
                    +--------------+
                      |          |
             Metadata |          | Upload Job
                      v          v
              +-------------+  +----------------+
              | Redis Cache |  | Message Queue  |
              +-------------+  +----------------+
                      |                 |
                      v                 v
              +-------------+   +----------------+
              | Database    |   | Thumbnail      |
              | Primary     |   | Workers        |
              +-------------+   +----------------+
                      |                 |
                      v                 v
              +-------------+   +----------------+
              | Read Replica|   | Object Storage |
              +-------------+   | Originals and  |
                                | Thumbnails     |
                                +----------------+
```

## 5. Component Explanations

### CDN / Edge Cache
The CDN serves frequently requested photos and thumbnails from geographically distributed edge locations. This reduces latency for users and decreases repeated requests reaching the application servers.

### Load Balancer
The load balancer distributes incoming API traffic across healthy application servers. It supports horizontal scaling and prevents a single server from becoming a bottleneck.

### API Servers
API servers authenticate users, validate upload requests, authorize access, manage photo metadata, generate upload authorization where appropriate, and serve feed requests. They should remain stateless so additional instances can be added during traffic spikes.

### Redis Cache
Redis stores frequently accessed feed data and metadata. It reduces repeated database queries and improves response times. Cache invalidation or expiration must be handled when relevant data changes.

### Database Primary
The relational database stores structured information such as users, photo metadata, ownership, captions, and relationships between users. The primary handles writes and maintains data consistency.

### Database Read Replica
Read replicas serve eligible read queries, reducing the load on the primary database. Replication lag must be considered when a user expects newly uploaded content to appear immediately.

### Message Queue
The queue stores background processing jobs until workers can process them. It absorbs bursts in upload traffic and separates the upload request from slower thumbnail-generation work.

### Thumbnail Workers
Background workers consume queued jobs, retrieve original images, generate appropriately sized thumbnails, and store the results. They should support retries and idempotent processing to handle failures safely.

### Object Storage
Object storage holds original photos and generated thumbnails. It is designed for large volumes of binary files and can scale independently of the relational database. The CDN can retrieve media from this storage through an appropriately secured origin configuration.

## 6. Step-by-Step Photo Upload Flow

1. **User submits a photo.** The client sends an authenticated upload request to the SnapShare API, including the photo and any associated metadata.

2. **Request validation.** An API server checks authentication, permissions, file type, file size, and applicable upload limits. Invalid requests are rejected with an appropriate error response.

3. **Upload authorization.** The API authorizes the upload. For large-scale deployments, it can issue a short-lived, restricted upload URL so the client can transfer the binary file directly to object storage.

4. **Original photo storage.** The client uploads the original photo to object storage. The system verifies that the upload completed successfully before marking the photo as ready for processing.

5. **Metadata persistence.** The application stores the photo's metadata, owner, storage key, and processing status in the relational database. It uses a reliable job-publication mechanism, such as a transactional outbox, where necessary to avoid losing processing jobs between database writes and queue publication.

6. **Thumbnail job creation.** The application publishes a thumbnail-generation job containing the photo identifier and storage key to the message queue. The queue acknowledges the job according to its delivery guarantees.

7. **Background processing.** A thumbnail worker consumes the job, retrieves the original image from object storage, validates it as needed, and generates a thumbnail of approximately 50 KB.

8. **Thumbnail storage.** The worker saves the generated thumbnail to object storage and records its storage key and processing status in the database. Failed jobs are retried according to a bounded retry policy, with persistent failures sent to a dead-letter queue.

9. **Photo becomes available.** Once required processing is complete, the application marks the photo as ready. Feed responses can include the thumbnail reference, while the CDN delivers the image efficiently to viewers.

10. **Client receives confirmation.** The user interface displays the upload or processing status. The application can show a pending state while the thumbnail is being generated and update the feed when the photo is ready.

This asynchronous workflow prevents thumbnail processing from blocking API servers and allows workers to scale independently during upload peaks.

## 7. Architectural Trade-offs

### Trade-off 1: Object Storage vs. Database Blob Storage

**Choice:** Store original photos and thumbnails in object storage, while keeping metadata in the relational database.

**Advantages:**
- Scales to hundreds of terabytes of media.
- Separates media storage costs from database compute and storage.
- Supports integration with CDNs.
- Simplifies independent lifecycle management and media retention.

**Disadvantages:**
- Requires coordination between database records and object-storage operations.
- Can leave orphaned files if uploads or metadata writes fail.
- Requires access controls, cleanup jobs, and lifecycle policies.

**Mitigation:** Use explicit upload states, reliable processing jobs, periodic orphan cleanup, and controlled access to stored media.

### Trade-off 2: Synchronous vs. Asynchronous Thumbnail Generation

**Choice:** Generate thumbnails asynchronously through a queue and background workers.

**Advantages:**
- Reduces upload-request latency.
- Absorbs bursts of incoming jobs.
- Allows workers to scale independently.
- Improves resilience when image processing is temporarily slow.

**Disadvantages:**
- Thumbnails may not be available immediately.
- Queues and workers introduce operational complexity.
- Jobs can fail, be delivered more than once, or accumulate during sustained peaks.

**Mitigation:** Use idempotent workers, bounded retries, dead-letter queues, queue-depth monitoring, and autoscaling based on processing backlog. Display a pending state until processing finishes.

## 8. Conclusion

SnapShare has approximately one million daily active users, one million daily uploads, an average upload rate of 11.57 photos per second, and an estimated peak upload rate of 58 photos per second. It serves approximately 579 feed views per second on average and 2,894 at peak.

At the estimated workload, original photos require about 730 TB of storage annually, while thumbnails require another 18.25 TB, for a total of approximately 748.25 TB before overhead.

A scalable design combines a CDN, load-balanced stateless API servers, Redis caching, relational database read replicas, object storage, and asynchronous thumbnail workers. This architecture addresses read-heavy traffic while allowing media processing to scale independently from user-facing requests.
