
# Library Books REST API

## Overview

This API manages books in a library. It supports listing books, retrieving a single book, creating books, updating books, deleting books, and filtering books by author.

Base URL: `/api`

## 1. List All Books

- **Method:** GET
- **Path:** `/api/books`
- **Description:** Returns a list of all books in the library.
- **Example request body:** None required.
- **Success status:** `200 OK`

## 2. Get a Single Book

- **Method:** GET
- **Path:** `/api/books/{bookId}`
- **Description:** Returns the details of a book identified by its ID.
- **Example request body:** None required.
- **Success status:** `200 OK`

Example path: `/api/books/12`

## 3. Create a Book

- **Method:** POST
- **Path:** `/api/books`
- **Description:** Creates a new book in the library.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "9780385474542",
    "publishedYear": 1958
  }
````

* **Success status:** `201 Created`

## 4. Update a Book

* **Method:** PUT

* **Path:** `/api/books/{bookId}`

* **Description:** Replaces the editable details of an existing book.

* **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "9780385474542",
    "publishedYear": 1958
  }
  ```

* **Success status:** `200 OK`

## 5. Delete a Book

* **Method:** DELETE
* **Path:** `/api/books/{bookId}`
* **Description:** Deletes the specified book from the library.
* **Example request body:** None required.
* **Success status:** `204 No Content`

## 6. List Books by Author

* **Method:** GET
* **Path:** `/api/books?author={authorName}`
* **Description:** Returns books written by the specified author. The author query parameter filters the results.
* **Example request body:** None required.
* **Example request:** `/api/books?author=Chinua%20Achebe`
* **Success status:** `200 OK`

## Error Responses

### 400 Bad Request

Returned when the request contains invalid data or required fields are missing.

Example: Creating a book without a title or author.

```json
{
  "error": "Title and author are required."
}
```

### 404 Not Found

Returned when the requested book does not exist.

Example: Requesting `GET /api/books/9999` when book `9999` is not in the library.

```json
{
  "error": "Book not found."
}

