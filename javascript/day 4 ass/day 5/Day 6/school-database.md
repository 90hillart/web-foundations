# School Database Design

## 1. Overview

The school database manages students, courses, and enrolments. It records which students attend which courses and stores each student's grade for a course.

The database uses three tables: `students`, `courses`, and `enrolments`.

## 2. Tables and Entities

### Students

The `students` table stores student information.

- `student_id`: Primary key that uniquely identifies each student.
- `name`: The student's full name; required.
- `email`: The student's email address; required and unique.

The unique email constraint prevents two students from registering with the same email address.

### Courses

The `courses` table stores information about available courses.

- `course_id`: Primary key that uniquely identifies each course.
- `course_name`: The course's name; required.
- `description`: A description of the course, which is optional.

### Enrolments

The `enrolments` table records which student is taking which course.

- `enrolment_id`: Primary key for each enrolment.
- `student_id`: Foreign key referencing `students.student_id`.
- `course_id`: Foreign key referencing `courses.course_id`.
- `grade`: The student's grade for that course; optional until assigned.

The combination of `student_id` and `course_id` is unique. This prevents the same student from enrolling in the same course more than once.

## 3. Relationships

### One-to-Many: Students to Enrolments

One student can have multiple enrolment records because a student may take several courses. Each enrolment belongs to one student.

### One-to-Many: Courses to Enrolments

One course can have multiple enrolment records because many students may take the same course. Each enrolment belongs to one course.

### Many-to-Many: Students and Courses

Students and courses have a many-to-many relationship. A student can take many courses, and a course can have many students.

The `enrolments` table acts as a **join table** between `students` and `courses`. It breaks the many-to-many relationship into two one-to-many relationships. It also stores the grade, which belongs to a particular student's enrolment in a particular course.

## 4. Index

I would add an index on `enrolments(course_id)` to speed up queries that retrieve all students enrolled in a particular course and help with course-level enrolment reports.

Example:

```sql
CREATE INDEX idx_enrolments_course_id
ON enrolments(course_id);
```

The unique constraint on `(student_id, course_id)` already creates an index in SQLite that can help with lookups by student and course together.

## 5. SQL or NoSQL?

I would choose a **relational SQL database** for this school system. Students, courses, enrolments, and grades have clear relationships, and the data benefits from primary keys, foreign keys, unique constraints, and structured queries. SQL joins make it straightforward to retrieve courses for a student, list students in a course, and calculate enrolment totals. SQLite is suitable for this small assignment because it is lightweight and easy to run without a separate database server. A larger school system could use PostgreSQL or MySQL as its data and concurrency needs grow.
