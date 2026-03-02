const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'klikdreamwave_super_secret_2026';

const verifyToken = (req, res, next) => {
    // Ambil token dari header request
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan!' });
    }

    try {
        // Format token biasanya "Bearer [token_acak]", kita pisahkan untuk ambil tokennya saja
        const token = authHeader.split(' ')[1];

        // Verifikasi token
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; // Simpan data user (admin) ke request untuk dipakai nanti

        next(); // Token aman, izinkan lanjut ke controller!
    } catch (error) {
        res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa!' });
    }
};

module.exports = verifyToken;