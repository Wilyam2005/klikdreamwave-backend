const db = require('../config/db');
const videoHelper = require('../utils/videoHelper');
const path = require('path');
const fs = require('fs'); // Ditambahkan di sini agar rapi

exports.createSlideshow = async (req, res) => {
    const { session_id } = req.body;

    try {
        // 1. Ambil daftar foto dari sesi ini
        const [photos] = await db.query(
            'SELECT original_path FROM photos WHERE session_id = ? ORDER BY capture_order ASC', 
            [session_id]
        );
        
        if (photos.length === 0) {
            return res.status(404).json({ message: 'Tidak ada foto untuk sesi ini.' });
        }

        const photoPaths = photos.map(p => p.original_path);
        
        // --- BAGIAN YANG DIPERBARUI ---
        const outputFileName = `slideshow-final.mp4`;
        
        // Buat folder video khusus untuk sesi ini
        const videoDir = path.join(__dirname, `../../../uploads/sessions/${session_id}/video/`);
        
        if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir, { recursive: true });
        }
        
        const outputPath = path.join(videoDir, outputFileName);
        // --- AKHIR BAGIAN YANG DIPERBARUI ---

        // 2. Simpan status awal ke database (Path database juga disesuaikan ke folder sesi)
        const [videoRecord] = await db.query(
            'INSERT INTO slideshow_videos (session_id, video_path, status) VALUES (?, ?, ?)',
            [session_id, `uploads/sessions/${session_id}/video/${outputFileName}`, 'processing']
        );

        // 3. Proses video di Background (Sistem merespons API lebih dulu agar UI tidak loading lama)
        videoHelper.generateSlideshow(photoPaths, outputPath)
            .then(async () => {
                await db.query('UPDATE slideshow_videos SET status = ? WHERE id = ?', ['ready', videoRecord.insertId]);
                console.log(`✅ Video slideshow siap: ${outputPath}`);
            })
            .catch(async (err) => {
                await db.query('UPDATE slideshow_videos SET status = ? WHERE id = ?', ['failed', videoRecord.insertId]);
                console.error(`❌ Gagal membuat video:`, err);
            });

        // Balas ke Kiosk UI bahwa video sedang diproses
        res.status(202).json({ 
            message: 'Proses pembuatan video sedang berjalan di latar belakang...',
            video_id: videoRecord.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan server saat memproses video.' });
    }
};