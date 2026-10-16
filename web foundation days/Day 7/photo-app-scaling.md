# SnapShare Photo App Scaling Plan

## 1. Assumptions and Daily Active Users

SnapShare is a photo-sharing application where users upload photos and view feeds containing photos from people they follow.

### Given facts

- Registered users: 10,000,000
- Daily active users (DAU): 10% of registered users
- Photos uploaded per active user per day: 1
- Feed pages viewed per active user per day: 50
- Average original photo size: 2 MB
- Thumbnail size per photo: 50 KB
- Days per year: 365
- Peak traffic multiplier: 5 times the average
- For estimates, a day contains 86,400 seconds.
- Each uploaded photo creates one thumbnail, and every original photo and thumbnail is retained for one year.
- Storage estimates exclude replication, backups, metadata, and storage overhead.

### Calculate daily active users

DAU = Registered users × Daily active percentage

DAU = 10,000,000 × 0.10

**Daily active users = 1,000,000**

Therefore, SnapShare has approximately one million active users each day.

## 2. Traffic and Storage Calculations

### A. Photo uploads per second

Each daily active user uploads one photo per day.

Daily uploads = 1,000,000 × 1

Daily uploads = 1,000,000 photos

Average uploads per second:

1,000,000 ÷ 86,400 = 11.57

**Average upload rate ≈ 11.6 photos per second.**

### B. Feed views per second

Each active user views 50 feed pages per day.

Daily feed views = 1,000,000 × 50

Daily feed views = 50,000,000 feed pages

Average feed views per second:

50,000,000 ÷ 86,400 = 578.70

**Average feed view rate ≈ 579 feed pages per second.**

Peak feed views use a 5× multiplier:

578.70 × 5 = 2,893.52

**Peak feed view rate ≈ 2,894 feed pages per second.**

The architecture should handle this peak load without becoming unavailable or excessively slow.

### C. Photo storage per year

Original photo storage per day:

1,000,000 × 2 MB = 2,000,000 MB = 2,000 GB = 2 TB

Original photo storage per year:

2 TB × 365 = 730 TB

Thumbnail storage per day:

1,000,000 × 50 KB = 50,000,000 KB ≈ 50 GB

Thumbnail storage per year:

50 GB × 365 = 18,250 GB = 18.25 TB

Total annual storage:

730 TB + 18.25 TB = 748.25 TB

**Estimated storage required per year = 748.25 TB**, using decimal units, before replication, backups, metadata, and overhead.

This is approximately 0.75 petabytes per year. Storage requirements will continue to grow if old photos are retained.

## 3. Is SnapShare Read-Heavy or Write-Heavy?

SnapShare is a **read-heavy system** because users view 50 feed pages per day but upload only one photo per day.

Daily feed views: 50,000,000

Daily uploads: 1,000,000

This represents approximately 50 feed views for every photo upload, although one feed page may display multiple photos.

The design should prioritize fast feed delivery using a CDN, caching, database read replicas, and scalable application servers. Photo uploads must still be reliable, but the much higher read traffic should receive particular attention.

## 4. Why Photos Should Not Be Stored Inside the Database

Original photos and thumbnails should be stored in **object storage**, not directly inside the relational database.

Storing large image files in the database would increase database size, backups, and restore times, while consuming resources needed for queries and transactions.

Object storage is designed to store large files reliably and economically, scale to very large capacity, and work with a CDN for fast delivery. The database should store photo metadata, such as the photo ID, owner ID, caption, upload time, and object-storage key or URL.

## 5. Architecture Diagram

                         +-------------------+
                         |       Users       |
                         +---------+---------+
                                   |
                      +------------v------------+
                      |           CDN           |
                      | Cached photos/thumbnails|
                      +------------+------------+
                                   |
                      +------------v------------+
                      |      Load Balancer      |
                      +------------+------------+
                                   |
                 +-----------------+-----------------+
                 |                 |                 |
          +------v------+   +------v------+   +------v------+
          | App Server 1|   | App Server 2|   | App Server N|
          +------+------+   +------+------+   +------+------+
                 |                 |                 |
                 +-----------------+-----------------+
                                   |
                      +------------+------------+
                      |                         |
               +------v------+          +-------v--------+
               |    Cache    |          |    Database    |
               | Redis       |          | Primary DB     |
               +-------------+          +-------+--------+
                                                |
                                       +--------v--------+
                                       |   Read Replica  |
                                       +-----------------+

 App servers upload original photos to object storage:
                 +---------------------------+
                 |       Object Storage      |
                 | Original photos           |
                 | Generated thumbnails      |
                 +-------------+-------------+
                               ^
                               |
                       +-------+--------+
                       |  Queue / Jobs  |
                       +-------+--------+
                               ^
                               |
                       +-------+--------+
                       | Thumbnail Worker|
                       | Creates 50 KB   |
                       | thumbnails      |
                       +----------------+
```

The queue receives thumbnail-generation jobs from the application servers, and workers process those jobs asynchronously. The worker reads the original image from object storage and writes the generated thumbnail back to object storage.

## 6. Components and the Problems They Solve

1. **CDN:** Delivers cached photos and thumbnails from locations closer to users, reducing latency and origin-server traffic.
2. **Load balancer:** Distributes incoming requests across application servers to prevent one server from becoming overloaded.
3. **Application servers:** Handle user requests, authentication, uploads, feed generation, and business logic.
4. **Cache (Redis):** Stores frequently accessed feed data and metadata in memory to reduce repeated database queries.
5. **Primary database:** Stores user information, photo metadata, relationships, captions, and other transactional data.
6. **Database read replica:** Serves read queries such as feed metadata requests, reducing the read workload on the primary database.
7. **Object storage:** Holds original photos and thumbnails as files, providing scalable and durable storage.
8. **Queue:** Buffers thumbnail-generation jobs so image processing can happen asynchronously without delaying the upload response.
9. **Thumbnail worker:** Processes queued jobs, generates smaller images, and stores thumbnails in object storage.

## 7. Step-by-Step Photo Upload Flow

1. A user selects a photo and submits it through the application.
2. The load balancer forwards the upload request to an available application server.
3. The application server authenticates the user and validates the file type, file size, and upload permissions.
4. The original photo is uploaded to object storage, where it receives a storage key.
5. The application server saves photo metadata and the storage key in the primary database.
6. The application server places a thumbnail-generation job on the queue.
7. The server confirms the successful upload to the user once the original photo and required metadata have been safely saved and the job has been queued.
8. A thumbnail worker retrieves the job from the queue.
9. The worker reads the original photo from object storage and creates a smaller thumbnail.
10. The worker uploads the thumbnail to object storage and updates its status or metadata in the database if needed.
11. When users view the photo in a feed, the application retrieves feed metadata from the cache or a database read replica.
12. The CDN serves the thumbnail or original photo, fetching it from object storage when the requested file is not already cached.

If thumbnail processing fails, the job should be retried with limits and monitored so the original photo remains available while the thumbnail is regenerated.

## 8. Trade-Offs

### Trade-off 1: Caching versus data freshness

Caching feed data reduces database load and improves response times. However, cached information may become stale after a user uploads a photo or changes a relationship. Cache invalidation and expiration policies are needed to balance freshness and performance.

### Trade-off 2: Asynchronous processing versus immediate availability

A queue allows uploads to finish without waiting for thumbnail generation, improving responsiveness and absorbing traffic spikes. However, thumbnails may not be available immediately, and the system must handle failed jobs, retries, and delayed processing.

### Trade-off 3: Read replicas versus consistency

Read replicas improve read capacity and protect the primary database from heavy feed traffic. However, replication lag can cause users to see recently uploaded photos or updated metadata later than expected. Critical read-after-write operations may need to use the primary database.

### Trade-off 4: CDN performance versus storage and invalidation complexity

A CDN reduces latency and repeated requests to object storage. However, cached images may take time to expire or invalidate, and the CDN adds configuration and operational complexity.

## 9. Conclusion

SnapShare has approximately 1 million daily active users, 11.6 average photo uploads per second, 579 average feed views per second, and a peak of approximately 2,894 feed views per second. Its original photos and thumbnails require an estimated 748.25 TB of storage each year.

A scalable solution combines a CDN, load balancer, horizontally scalable application servers, Redis caching, a primary database with a read replica, object storage, and an asynchronous queue with thumbnail workers. This design prioritizes read performance while keeping photo uploads reliable and image processing scalable.