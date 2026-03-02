const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const db = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CORS — Izinkan domain klikdreamwave.com
// ==========================================
app.use(cors({
    origin: [
        'https://klikdreamwave.com',
        'http://localhost:5000',
        'http://localhost:5173',
    ],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// STATIC FILES — Uploads (foto/video hasil sesi)
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// DAFTAR ROUTES API
// ==========================================
const authRoutes = require('./src/routes/authRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const frameRoutes = require('./src/routes/frameRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const photoRoutes = require('./src/routes/photoRoutes');
const printRoutes = require('./src/routes/printRoutes');
const videoRoutes = require('./src/routes/videoRoutes');
const voucherRoutes = require('./src/routes/voucherRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/frames', frameRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/print', printRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sessions', require('./src/routes/sessionRoutes'));
app.use('/api/presets', require('./src/routes/presetRoutes'));
app.use('/api/admins', require('./src/routes/adminRoutes'));

// ==========================================
// SERVE FRONTEND REACT (dari folder public/)
// ==========================================
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// Semua route non-API → kembalikan index.html (React SPA)
// Catatan: Express 5 butuh named wildcard /*splat (bukan bare *)
app.get('/*splat', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    res.sendFile(indexFile, (err) => {
        if (err) {
            res.status(200).send('API Klikdreamwave Photobooth Berjalan! 🚀');
        }
    });
});

// ==========================================
// JALANKAN SERVER
// ==========================================
const printWorker = require('./src/services/printWorker');

app.listen(PORT, () => {
    console.log(`✅ Server berjalan di port ${PORT}`);
    console.log(`🌐 URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}`);

    // Print Worker hanya dijalankan di Windows (kiosk fisik)
    if (process.platform === 'win32') {
        printWorker.startWorker();
        console.log('🖨️ Print Worker aktif (Windows mode)');
    } else {
        console.log('ℹ️ Print Worker dinonaktifkan (Linux/Hosting mode)');
    }
});

// ✅ Wajib untuk serverless deployment (Vercel)
module.exports = app;