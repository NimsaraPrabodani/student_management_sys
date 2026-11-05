const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',            // Replace with your MySQL username
  password: '12345678',    // Replace with your MySQL password
  database: 'student_management_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;