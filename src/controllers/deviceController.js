const db = require('../config/db');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

exports.getPrinters = async (req, res) => {
    try {
        let stdoutData = "";
        try {
            const { stdout } = await execPromise(`powershell -Command "Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name; exit 0"`);
            stdoutData = stdout;
        } catch (execErr) {
            stdoutData = execErr.stdout || "";
        }

        const printers = stdoutData.split('\n').map(p => p.trim()).filter(p => p !== '');

        if (!printers.includes('Simulasi Printer')) {
            printers.push('Simulasi Printer (Debug)');
        }

        res.json({ printers });
    } catch (error) {
        console.error("Gagal membaca daftar printer:", error);
        res.status(500).json({ message: "Gagal membaca daftar printer sistem." });
    }
};

exports.getCameras = async (req, res) => {
    try {
        let stdoutData = "";
        try {
            const { stdout } = await execPromise(`powershell -Command "Get-PnpDevice -Class Camera,Image,WPD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FriendlyName; exit 0"`);
            stdoutData = stdout;
        } catch (execErr) {
            stdoutData = execErr.stdout || "";
        }

        const cameras = stdoutData.split('\n').map(c => c.trim()).filter(c => c !== '');

        // Add DSLR entry as static priority
        const options = ['Canon DSLR (DigiCamControl)', ...cameras];

        res.json({ cameras: [...new Set(options)] });
    } catch (error) {
        console.error("Gagal membaca daftar kamera:", error);
        res.status(500).json({ message: "Gagal membaca daftar kamera." });
    }
};

exports.getDeviceSettings = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('active_printer', 'active_camera', 'save_raw_photos')");
        const settings = {
            active_printer: '',
            active_camera: 'Canon DSLR (DigiCamControl)',
            save_raw_photos: 'true'
        };
        rows.forEach(r => {
            settings[r.setting_key] = r.setting_value;
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil pengaturan device." });
    }
};

exports.saveDeviceSettings = async (req, res) => {
    const { active_printer, active_camera, save_raw_photos } = req.body;
    try {
        const queries = [
            db.query("INSERT INTO settings (setting_key, setting_value) VALUES ('active_printer', ?) ON DUPLICATE KEY UPDATE setting_value = ?", [active_printer, active_printer]),
            db.query("INSERT INTO settings (setting_key, setting_value) VALUES ('active_camera', ?) ON DUPLICATE KEY UPDATE setting_value = ?", [active_camera, active_camera]),
            db.query("INSERT INTO settings (setting_key, setting_value) VALUES ('save_raw_photos', ?) ON DUPLICATE KEY UPDATE setting_value = ?", [String(save_raw_photos), String(save_raw_photos)])
        ];
        await Promise.all(queries);
        res.json({ message: "Pengaturan device berhasil disimpan." });
    } catch (error) {
        console.error("Save settings error:", error);
        res.status(500).json({ message: "Gagal menyimpan pengaturan device.", error: error.message });
    }
};

const getFileSizeInMB = (filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return (stats.size / (1024 * 1024)).toFixed(2);
    } catch (e) {
        return 0;
    }
};

exports.getFiles = async (req, res) => {
    try {
        const [sessions] = await db.query("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50");

        const filesData = await Promise.all(sessions.map(async (s) => {
            let totalMemory = 0;
            let fileCount = 0;
            const filesList = [];

            // Try check final layout
            if (s.final_image_path) {
                const cleanPath = s.final_image_path.replace(/^\//, '').replace(/^\\/, '');
                const absoluteFinal = path.join(__dirname, '../../', cleanPath);
                if (fs.existsSync(absoluteFinal)) {
                    const mb = parseFloat(getFileSizeInMB(absoluteFinal));
                    totalMemory += mb;
                    fileCount++;
                    filesList.push({ type: 'Final Render', path: s.final_image_path, size: mb });
                }
            }

            // Try check RAW photos
            const [photos] = await db.query("SELECT * FROM session_photos WHERE session_id = ?", [s.id]);
            for (const p of photos) {
                if (p.photo_path) {
                    const cleanPath = p.photo_path.replace(/^\//, '').replace(/^\\/, '');
                    const absolutePhoto = path.join(__dirname, '../../', cleanPath);
                    if (fs.existsSync(absolutePhoto)) {
                        const mb = parseFloat(getFileSizeInMB(absolutePhoto));
                        totalMemory += mb;
                        fileCount++;
                        filesList.push({ type: 'RAW Foto', path: p.photo_path, size: mb });
                    }
                }
            }

            // Try check Video/GIF
            if (s.video_path) {
                const cleanPath = s.video_path.replace(/^\//, '').replace(/^\\/, '');
                const absoluteVideo = path.join(__dirname, '../../', cleanPath);
                if (fs.existsSync(absoluteVideo)) {
                    const mb = parseFloat(getFileSizeInMB(absoluteVideo));
                    totalMemory += mb;
                    fileCount++;
                    filesList.push({ type: 'Video Animasi', path: s.video_path, size: mb });
                }
            }

            return {
                session_id: s.id,
                date: s.created_at,
                filesList,
                fileCount,
                totalMemory: totalMemory.toFixed(2),
                status: s.status
            };
        }));

        res.json({ sessionFiles: filesData });
    } catch (error) {
        console.error("Gagal mendapatkan file hasil:", error);
        res.status(500).json({ message: "Gagal memuat list file." });
    }
};

exports.deleteFiles = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const [sessions] = await db.query("SELECT * FROM sessions WHERE id = ?", [sessionId]);
        if (sessions.length === 0) return res.status(404).json({ message: "Session tidak ditemukan." });
        const s = sessions[0];

        // Delete Final
        if (s.final_image_path) {
            const cleanPath = s.final_image_path.replace(/^\//, '').replace(/^\\/, '');
            const tempPath = path.join(__dirname, '../../', cleanPath);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }

        // Delete Video
        if (s.video_path) {
            const cleanPath = s.video_path.replace(/^\//, '').replace(/^\\/, '');
            const tempPath = path.join(__dirname, '../../', cleanPath);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }

        // Delete from DB path records safely so we don't break session history but we free up disk
        await db.query("UPDATE sessions SET final_image_path = NULL, video_path = NULL WHERE id = ?", [sessionId]);

        // Delete RAWs
        const [photos] = await db.query("SELECT * FROM session_photos WHERE session_id = ?", [sessionId]);
        for (const p of photos) {
            if (p.photo_path) {
                const cleanPath = p.photo_path.replace(/^\//, '').replace(/^\\/, '');
                const absolutePhoto = path.join(__dirname, '../../', cleanPath);
                if (fs.existsSync(absolutePhoto)) fs.unlinkSync(absolutePhoto);
            }
        }
        await db.query("UPDATE session_photos SET photo_path = 'DELETED' WHERE session_id = ?", [sessionId]);

        res.json({ message: "File fisik beserta referensinya berhasil dibersihkan dari storage!" });
    } catch (error) {
        console.error("Gagal hapus file:", error);
        res.status(500).json({ message: "Terjadi kesalahan saat menghapus file." });
    }
};
