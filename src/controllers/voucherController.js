const db = require('../config/db');

// 1. [ADMIN] Membuat Voucher Baru
exports.createVoucher = async (req, res) => {
    // discount_type: 'percentage', 'nominal', atau 'free_session'
    const { code, discount_type, discount_value, max_uses, valid_from, valid_until } = req.body;

    try {
        const [result] = await db.query(
            `INSERT INTO vouchers (code, discount_type, discount_value, max_uses, valid_from, valid_until) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [code.toUpperCase(), discount_type, discount_value, max_uses || 1, valid_from || null, valid_until || null]
        );
        res.status(201).json({ message: 'Voucher berhasil dibuat!', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Kode voucher sudah ada, gunakan kode lain.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan server saat membuat voucher.' });
    }
};

// 2. [ADMIN] Melihat Semua Voucher
exports.getAllVouchers = async (req, res) => {
    try {
        const [vouchers] = await db.query('SELECT * FROM vouchers ORDER BY created_at DESC');
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// 3. [USER/KIOSK] Memvalidasi Voucher yang Diinput Pengunjung
exports.validateVoucher = async (req, res) => {
    const { code } = req.body;

    if (!code) return res.status(400).json({ message: 'Kode voucher wajib diisi.' });

    try {
        const [vouchers] = await db.query('SELECT * FROM vouchers WHERE code = ?', [code.toUpperCase()]);

        if (vouchers.length === 0) {
            return res.status(404).json({ message: 'Voucher tidak ditemukan.' });
        }

        const voucher = vouchers[0];

        // A. Cek Status Aktif/Blacklist
        if (voucher.status !== 'active') {
            return res.status(400).json({ message: 'Voucher sudah tidak aktif.' });
        }

        // B. Cek Batas Penggunaan (Kuota)
        if (voucher.max_uses > 0 && voucher.current_uses >= voucher.max_uses) {
            return res.status(400).json({ message: 'Kuota voucher sudah habis.' });
        }

        // C. Cek Tanggal Berlaku (Jika diset)
        const now = new Date();
        if (voucher.valid_from && new Date(voucher.valid_from) > now) {
            return res.status(400).json({ message: 'Voucher belum bisa digunakan.' });
        }
        if (voucher.valid_until && new Date(voucher.valid_until) < now) {
            return res.status(400).json({ message: 'Voucher sudah kadaluarsa.' });
        }

        // Jika semua lolos, kirimkan data diskon ke Frontend
        res.status(200).json({
            message: 'Voucher valid!',
            voucher_id: voucher.id,
            discount_type: voucher.discount_type,
            discount_value: voucher.discount_value
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat memvalidasi voucher.' });
    }
};

// 4. [ADMIN] Update Voucher
exports.updateVoucher = async (req, res) => {
    const { id } = req.params;
    const { code, discount_type, discount_value, max_uses } = req.body;

    try {
        await db.query(
            `UPDATE vouchers SET code = ?, discount_type = ?, discount_value = ?, max_uses = ? WHERE id = ?`,
            [code.toUpperCase(), discount_type, discount_value, max_uses, id]
        );
        res.status(200).json({ message: 'Voucher berhasil diupdate.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Kode voucher sudah ada, gunakan kode lain.' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// 5. [ADMIN] Delete Voucher
exports.deleteVoucher = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`DELETE FROM vouchers WHERE id = ?`, [id]);
        res.status(200).json({ message: 'Voucher berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// 6. [ADMIN] Toggle Status Voucher
exports.toggleVoucherStatus = async (req, res) => {
    const { id } = req.params;
    try {
        // Ambil status saat ini
        const [vouchers] = await db.query('SELECT status FROM vouchers WHERE id = ?', [id]);
        if (vouchers.length === 0) return res.status(404).json({ message: 'Voucher tidak ditemukan.' });

        const newStatus = vouchers[0].status === 'active' ? 'inactive' : 'active';
        await db.query('UPDATE vouchers SET status = ? WHERE id = ?', [newStatus, id]);

        res.status(200).json({ message: `Status diubah menjadi ${newStatus}.`, newStatus });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};