const db = require('../config/db');

exports.createSession = async (req, res) => {
    const { session_code, frame_id, preset_id, voucher_id, total_price, status } = req.body;

    // Mulai transaction untuk memastikan sesi dan status voucher tersimpan bersamaan dengan aman
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO sessions (session_code, frame_id, preset_id, voucher_id, total_price, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                session_code,
                frame_id || null,
                preset_id || null,
                voucher_id || null,
                total_price || 0,
                status || 'pending'
            ]
        );

        // Jika ada penggunaan voucher, update kuota pemakaiannya (current_uses)
        if (voucher_id) {
            await connection.query(
                `UPDATE vouchers 
                 SET current_uses = current_uses + 1 
                 WHERE id = ?`,
                [voucher_id]
            );

            // Cek apakah kuota sudah maksimal, jika ya, matikan voucher (inactive)
            const [vouchers] = await connection.query('SELECT current_uses, max_uses FROM vouchers WHERE id = ?', [voucher_id]);
            if (vouchers.length > 0 && vouchers[0].max_uses > 0 && vouchers[0].current_uses >= vouchers[0].max_uses) {
                await connection.query('UPDATE vouchers SET status = "inactive" WHERE id = ?', [voucher_id]);
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Sesi dibuat', id: result.insertId });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal membuat session:", error);
        res.status(500).json({ message: 'Gagal membuat sesi photobooth' });
    } finally {
        connection.release();
    }
};

exports.updateSessionPreset = async (req, res) => {
    const { id } = req.params;
    const { preset_id } = req.body;

    try {
        await db.query('UPDATE sessions SET preset_id = ? WHERE id = ?', [preset_id, id]);
        res.status(200).json({ message: 'Preset filter berhasil diterapkan' });
    } catch (error) {
        console.error("Gagal update session preset:", error);
        res.status(500).json({ message: 'Gagal update filter ke sesi' });
    }
};
