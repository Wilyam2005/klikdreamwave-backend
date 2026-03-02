const db = require('../config/db');

// 1. Mendaftarkan foto ke dalam antrian print (Dipanggil saat user selesai foto)
exports.addToQueue = async (req, res) => {
    const { session_id, file_path } = req.body;

    // Validasi input
    if (!session_id || !file_path) {
        return res.status(400).json({ message: 'session_id dan file_path wajib diisi!' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO print_queue (session_id, file_path, status, retry_count) VALUES (?, ?, ?, ?)',
            [session_id, file_path, 'queued', 0]
        );
        res.status(201).json({ 
            message: 'Foto berhasil masuk antrian print!', 
            queue_id: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan server saat memasukkan ke antrian.' });
    }
};

// 2. Mengambil 1 antrian paling atas yang belum dicetak (Dipanggil oleh Local Service Windows)
exports.getPendingQueue = async (req, res) => {
    try {
        // Ambil status 'queued' ATAU 'failed' tapi yang retry_count-nya masih di bawah 3
        const [queue] = await db.query(
            "SELECT * FROM print_queue WHERE status = 'queued' OR (status = 'failed' AND retry_count < 3) ORDER BY created_at ASC LIMIT 1"
        );
        
        if (queue.length === 0) {
            return res.status(200).json({ message: 'Tidak ada antrian print.' });
        }

        res.status(200).json(queue[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil data antrian.' });
    }
};

// 3. Mengupdate status print (Dipanggil setelah mesin DNP selesai nge-print atau gagal)
exports.updatePrintStatus = async (req, res) => {
    const { id } = req.params; // ID dari antrian yang sedang diproses
    const { status } = req.body; // status baru: 'completed' atau 'failed'

    if (!status) {
        return res.status(400).json({ message: 'Status wajib diisi (completed/failed)!' });
    }

    try {
        if (status === 'completed') {
            // Jika sukses dicetak, ubah status menjadi completed
            await db.query("UPDATE print_queue SET status = 'completed' WHERE id = ?", [id]);
            res.status(200).json({ message: `Status antrian ID ${id} berhasil diupdate menjadi completed.` });
            
        } else if (status === 'failed') {
            // Jika gagal, ubah status jadi failed dan tambah jumlah percobaan (retry_count)
            await db.query("UPDATE print_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id = ?", [id]);
            res.status(200).json({ message: `Print gagal, retry_count untuk antrian ID ${id} ditambah.` });
            
        } else {
            res.status(400).json({ message: 'Status tidak valid! Hanya menerima completed atau failed.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengupdate status print.' });
    }
};