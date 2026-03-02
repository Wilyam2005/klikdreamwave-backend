const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'klikdreamwave_super_secret_2026';

// Register Admin (Local)
exports.register = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role || 'operator']
        );
        res.status(201).json({ message: 'Admin berhasil didaftarkan!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mendaftarkan admin.' });
    }
};

// Login Admin (Local)
exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(401).json({ message: 'Username atau password salah!' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Username atau password salah!' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);

        res.status(200).json({
            message: 'Login berhasil!',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};