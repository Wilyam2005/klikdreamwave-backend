const db = require('../config/db');

// Mengambil semua pengaturan (Harga Sesi, Harga Print Extra, dll)
exports.getSettings = async (req, res) => {
    try {
        const [settings] = await db.query('SELECT * FROM settings');
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// Menyimpan atau Update pengaturan
exports.updateSetting = async (req, res) => {
    const { setting_key, setting_value, description } = req.body;

    try {
        // Query ini otomatis melakukan UPDATE jika setting_key sudah ada, atau INSERT jika belum ada
        await db.query(
            `INSERT INTO settings (setting_key, setting_value, description) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?, description = ?`,
            [setting_key, setting_value, description, setting_value, description]
        );
        res.status(200).json({ message: `Pengaturan ${setting_key} berhasil disimpan!` });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan pengaturan.' });
    }
};