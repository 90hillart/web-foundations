
-- ============================================
-- DAY 6 ASSIGNMENT: SCHOOL DATABASE
-- SQLite
-- ============================================

-- 1. CREATE TABLES

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    FOREIGN KEY (course_id)
        REFERENCES courses(course_id),

    UNIQUE (student_id, course_id)
);

-- Enable foreign key enforcement in SQLite.
PRAGMA foreign_keys = ON;


-- 2. INSERT SAMPLE STUDENTS

INSERT INTO students (student_id, name, email)
VALUES
    (1, 'Alice Wanjiku', 'alice@example.com'),
    (2, 'Brian Otieno', 'brian@example.com'),
    (3, 'Carol Njeri', 'carol@example.com'),
    (4, 'David Kiptoo', 'david@example.com');


-- 3. INSERT SAMPLE COURSES

INSERT INTO courses (course_id, course_name, description)
VALUES
    (1, 'Database Systems', 'Introduction to relational databases'),
    (2, 'Web Development', 'Building websites and web applications'),
    (3, 'Computer Networks', 'Networking fundamentals and protocols');


-- 4. INSERT SAMPLE ENROLMENTS

INSERT INTO enrolments
    (enrolment_id, student_id, course_id, grade)
VALUES
    (1, 1, 1, 'A'),
    (2, 1, 2, 'B'),
    (3, 2, 1, 'B'),
    (4, 2, 3, 'A'),
    (5, 3, 2, 'A');


-- ============================================
-- QUERY 1: ALL COURSES FOR ONE STUDENT
-- Example: Alice Wanjiku
-- ============================================

SELECT
    s.name AS student_name,
    c.course_name,
    e.grade
FROM students AS s
JOIN enrolments AS e
    ON s.student_id = e.student_id
JOIN courses AS c
    ON e.course_id = c.course_id
WHERE s.name = 'Alice Wanjiku';


-- ============================================
-- QUERY 2: ALL STUDENTS ON ONE COURSE
-- Example: Database Systems
-- ============================================

SELECT
    c.course_name,
    s.name AS student_name,
    e.grade
FROM courses AS c
JOIN enrolments AS e
    ON c.course_id = e.course_id
JOIN students AS s
    ON e.student_id = s.student_id
WHERE c.course_name = 'Database Systems';


-- ============================================
-- QUERY 3: NUMBER OF STUDENTS PER COURSE
-- Include courses with zero enrolments.
-- ============================================

SELECT
    c.course_name,
    COUNT(e.student_id) AS number_of_students
FROM courses AS c
LEFT JOIN enrolments AS e
    ON c.course_id = e.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;


-- ============================================
-- QUERY 4: STUDENTS WITH NO ENROLMENTS
-- ============================================

SELECT
    s.student_id,
    s.name,
    s.email
FROM students AS s
LEFT JOIN enrolments AS e
    ON s.student_id = e.student_id
WHERE e.student_id IS NULL;


-- ============================================
-- QUERY 5: UPDATE ONE ENROLMENT'S GRADE
-- Change Brian's Database Systems grade to A.
-- ============================================

UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2
  AND course_id = 1;

-- Verify the updated grade.
SELECT
    s.name AS student_name,
    c.course_name,
    e.grade
FROM enrolments AS e
JOIN students AS s
    ON e.student_id = s.student_id
JOIN courses AS c
    ON e.course_id = c.course_id
WHERE e.student_id = 2
  AND e.course_id = 1;
