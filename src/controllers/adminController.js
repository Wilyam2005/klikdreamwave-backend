const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mengambil seluruh admin
exports.getAllAdmins = async (req, res) => {
    try {
        const [admins] = await db.query('SELECT id, username, role, last_login, created_at FROM admin_users ORDER BY id DESC');
        res.status(200).json(admins);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil data admin.' });
    }
};

// Membuat admin baru
exports.createAdmin = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        // Cek apakah username sudah ada
        const [existing] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ message: 'Username sudah digunakan.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role || 'operator']
        );
        res.status(201).json({ message: 'Admin berhasil dibuat!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal membuat admin baru.' });
    }
};

// Mengubah password atau role admin (Update)
exports.updateAdmin = async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;

    try {
        const [admins] = await db.query('SELECT * FROM admin_users WHERE id = ?', [id]);
        if (admins.length === 0) return res.status(404).json({ message: 'Admin tidak ditemukan!' });

        let updateQuery = 'UPDATE admin_users SET username = ?, role = ?';
        let queryParams = [username, role];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery += ', password_hash = ?';
            queryParams.push(hashedPassword);
        }

        updateQuery += ' WHERE id = ?';
        queryParams.push(id);

        await db.query(updateQuery, queryParams);
        res.status(200).json({ message: 'Data admin berhasil diperbarui!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal memperbarui admin.' });
    }
};

// Menghapus admin
exports.deleteAdmin = async (req, res) => {
    const { id } = req.params;

    try {
        // Jangan biarkan menghapus admin id = 1 (super admin default, asumsi)
        if (id == 1) return res.status(403).json({ message: 'Tidak diizinkan menghapus Super Administrator!' });

        await db.query('DELETE FROM admin_users WHERE id = ?', [id]);
        res.status(200).json({ message: 'Admin berhasil dihapus!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menghapus admin.' });
    }
};
