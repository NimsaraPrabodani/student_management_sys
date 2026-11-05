const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const JWT_SECRET = 'sms_super_secret_jwt_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware: Verify JWT and Roles
const authenticateToken = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authentication required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Invalid or expired token' });
      if (roles.length > 0 && !roles.includes(user.role)) {
        return res.status(403).json({ message: 'Access denied: Unauthorized role' });
      }
      req.user = user;
      next();
    });
  };
};

// ================= AUTH ROUTES =================

// Register Student
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, department, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "student")',
      [name, email, hashedPassword]
    );

    const studentCode = 'STU-' + Math.floor(100000 + Math.random() * 900000);
    await conn.query(
      'INSERT INTO students (user_id, student_code, phone, department) VALUES (?, ?, ?, ?)',
      [userResult.insertId, studentCode, phone || null, department || 'General Science']
    );

    await conn.commit();
    res.status(201).json({ message: 'Registration successful! Please log in.' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
});

// Login (Admin or Student)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, s.id AS student_id, s.student_code 
       FROM users u 
       LEFT JOIN students s ON u.id = s.user_id 
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, student_id: user.student_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        student_code: user.student_code
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= ADMIN DASHBOARD METRICS =================
app.get('/api/admin/metrics', authenticateToken(['admin']), async (req, res) => {
  try {
    const [[{ totalStudents }]] = await db.query('SELECT COUNT(*) AS totalStudents FROM students');
    const [[{ totalCourses }]] = await db.query('SELECT COUNT(*) AS totalCourses FROM courses');
    const [[{ totalAttendance }]] = await db.query('SELECT COUNT(*) AS totalAttendance FROM attendance');

    res.json({ totalStudents, totalCourses, totalAttendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= COURSE MANAGEMENT =================

// List Courses
app.get('/api/courses', async (req, res) => {
  try {
    const [courses] = await db.query('SELECT * FROM courses ORDER BY id DESC');
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Course (Admin only)
app.post('/api/courses', authenticateToken(['admin']), async (req, res) => {
  const { course_code, course_title, credits, description } = req.body;
  if (!course_code || !course_title) {
    return res.status(400).json({ message: 'Course code and title are required' });
  }

  try {
    await db.query(
      'INSERT INTO courses (course_code, course_title, credits, description) VALUES (?, ?, ?, ?)',
      [course_code, course_title, credits || 3, description || '']
    );
    res.status(201).json({ message: 'Course created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Course (Admin only)
app.delete('/api/courses/:id', authenticateToken(['admin']), async (req, res) => {
  try {
    await db.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= STUDENT MANAGEMENT =================
app.get('/api/students', authenticateToken(['admin']), async (req, res) => {
  try {
    const [students] = await db.query(`
      SELECT s.id, s.student_code, s.department, s.phone, u.name, u.email, u.created_at
      FROM students s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.id DESC
    `);
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= ATTENDANCE TRACKING =================

// Mark/Update Attendance (Admin only)
app.post('/api/attendance', authenticateToken(['admin']), async (req, res) => {
  const { course_id, student_id, attendance_date, status } = req.body;
  if (!course_id || !student_id || !attendance_date || !status) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    await db.query(`
      INSERT INTO attendance (course_id, student_id, attendance_date, status)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `, [course_id, student_id, attendance_date, status]);

    res.json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Attendance Records
app.get('/api/attendance', authenticateToken(['admin', 'student']), async (req, res) => {
  const { course_id, student_id } = req.query;
  try {
    let sql = `
      SELECT a.id, a.attendance_date, a.status, c.course_title, c.course_code, u.name as student_name, s.student_code
      FROM attendance a
      JOIN courses c ON a.course_id = c.id
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Students can only see their own attendance
    if (req.user.role === 'student') {
      sql += ' AND s.id = ?';
      params.push(req.user.student_id);
    } else {
      if (student_id) {
        sql += ' AND s.id = ?';
        params.push(student_id);
      }
      if (course_id) {
        sql += ' AND c.id = ?';
        params.push(course_id);
      }
    }

    sql += ' ORDER BY a.attendance_date DESC LIMIT 100';

    const [records] = await db.query(sql, params);
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});