-- Create database
CREATE DATABASE IF NOT EXISTS student_management_db;
USE student_management_db;

-- 1. Users Table (Handles authentication for Admin & Students)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'student') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Students Profile Table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    student_code VARCHAR(20) NOT NULL UNIQUE,
    phone VARCHAR(20),
    department VARCHAR(50) DEFAULT 'General Science',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_title VARCHAR(150) NOT NULL,
    credits INT NOT NULL DEFAULT 3,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Course Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_enrollment (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 5. Attendance Tracking Table
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    student_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('Present', 'Absent', 'Late') NOT NULL DEFAULT 'Present',
    UNIQUE KEY unique_daily_attendance (course_id, student_id, attendance_date),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ========================================================
-- SEED DATA (Default Admin Password: "AdminPassword123")
-- Hash generated using bcrypt (10 rounds)
-- ========================================================
INSERT INTO users (name, email, password_hash, role) VALUES 
('System Admin', 'admin@sms.com', '$2a$10$7Z2.Vd5x2jY6o0Lg9aI4iO1Veq2j0sX9I1vK1sM1M5bH3PqW0c02y', 'admin')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Courses
INSERT INTO courses (course_code, course_title, credits, description) VALUES
('CS101', 'Introduction to Computer Science', 3, 'Fundamentals of programming and computation'),
('DB201', 'Database Management Systems', 4, 'Relational model, SQL, normalization, and ACID properties'),
('NET301', 'Computer Networks & Security', 3, 'TCP/IP, routing, and modern network protocols')
ON DUPLICATE KEY UPDATE id=id;