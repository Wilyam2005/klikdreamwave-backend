const db = require('../config/db');
const QRCode = require('qrcode');
const GIFEncoder = require('gif-encoder-2');
const { createCanvas, loadImage } = require('skia-canvas');
const fs = require('fs');
const path = require('path');
const cameraHelper = require('../utils/cameraHelper');

// 1. Fungsi Menerima Upload Foto (Fallback if not using DSLR)
exports.uploadPhoto = async (req, res) => {
    const { session_id, capture_order } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada foto yang diunggah.' });
    }

    const originalPath = req.file.path.replace(/\\/g, "/");

    try {
        const [result] = await db.query(
            'INSERT INTO photos (session_id, capture_order, original_path) VALUES (?, ?, ?)',
            [session_id, capture_order, originalPath]
        );

        res.status(201).json({
            message: 'Foto berhasil disimpan!',
            photo_id: result.insertId,
            path: originalPath
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan data foto.' });
    }
};

// 2. [NEW] JEPret menggunakan Canon DSLR
exports.captureWithDSLR = async (req, res) => {
    const { session_id, capture_order } = req.body;
    const fileName = `capture-${session_id}-${capture_order}-${Date.now()}.jpg`;
    const relativePath = `uploads/photos/${fileName}`;
    const absolutePath = path.join(__dirname, '../../', relativePath);

    try {
        await cameraHelper.captureDSLR(absolutePath);

        const [result] = await db.query(
            'INSERT INTO photos (session_id, capture_order, original_path) VALUES (?, ?, ?)',
            [session_id, capture_order, relativePath]
        );

        res.status(201).json({
            message: 'Foto DSLR berhasil diambil!',
            photo_id: result.insertId,
            path: relativePath
        });
    } catch (error) {
        console.error("DSLR Capture Error:", error);
        res.status(500).json({ message: error.message || 'Gagal mengambil foto dari kamera Canon.' });
    }
};

exports.captureWebcam = async (req, res) => {
    console.log("Menangkap photo webcam dari req.body:", req.body);
    const { session_id, capture_order } = req.body;

    if (!req.file) {
        console.error("Tidak ada file yang diterima di req.file");
        return res.status(400).json({ message: 'Tidak ada foto webcam yang diterima.' });
    }

    const relativePath = req.file.path.replace(/\\/g, "/");
    console.log("File disimpan ke:", relativePath, "Untuk sesi:", session_id, "Order:", capture_order);

    try {
        const [result] = await db.query(
            'INSERT INTO photos (session_id, capture_order, original_path) VALUES (?, ?, ?)',
            [session_id, capture_order, relativePath]
        );

        console.log("Sukses menyimpan ke DB. ID:", result.insertId);
        res.status(201).json({
            message: 'Foto Webcam berhasil disimpan!',
            photo_id: result.insertId,
            path: relativePath
        });
    } catch (error) {
        console.error("Webcam Capture Error:", error);
        res.status(500).json({ message: 'Gagal menyimpan foto webcam.' });
    }
};

// 3. Fungsi Mengambil Semua Foto dalam 1 Sesi (is_selected = 1 yang tampil di frame)
exports.getSessionPhotos = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const [photos] = await db.query(
            'SELECT * FROM photos WHERE session_id = ? AND is_selected = 1 ORDER BY capture_order ASC',
            [sessionId]
        );
        res.status(200).json(photos);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data foto.' });
    }
};

// 3.1 Fungsi Menandai Foto Utama/Pilihan
exports.markChosen = async (req, res) => {
    const { chosen_id, unchosen_id } = req.body;
    try {
        if (chosen_id) await db.query('UPDATE photos SET is_selected = 1 WHERE id = ?', [chosen_id]);
        if (unchosen_id) await db.query('UPDATE photos SET is_selected = 0 WHERE id = ?', [unchosen_id]);
        res.status(200).json({ message: 'Pilihan foto disimpan.' });
    } catch (error) {
        console.error("markChosen error:", error);
        res.status(500).json({ message: 'Gagal update database foto.' });
    }
};

// 4. Update Result QR URL to use Mobile Download page
exports.generateResultQR = async (req, res) => {
    const { sessionId } = req.params;

    try {
        // Use the frontend URL for mobile download
        const downloadUrl = `http://${process.env.IP_ADRESS || 'localhost'}:5173/download/${sessionId}`;

        const qrImageBase64 = await QRCode.toDataURL(downloadUrl, {
            color: { dark: '#000000', light: '#ffffff' },
            width: 300,
            margin: 2
        });

        res.status(200).json({ qr_image_base64: qrImageBase64 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal membuat QR Code' });
    }
};

// 5. Fungsi Membuat GIF Animasi dengan Preset dan Folder Session
exports.generateSessionGif = async (req, res) => {
    const { sessionId } = req.params;

    try {
        // Ambil SEMUA foto untuk GIF animasi (dan simpan ke raw folder)
        const [allPhotos] = await db.query('SELECT * FROM photos WHERE session_id = ? ORDER BY capture_order ASC', [sessionId]);
        const [chosenPhotos] = await db.query('SELECT * FROM photos WHERE session_id = ? AND is_selected = 1 ORDER BY capture_order ASC', [sessionId]);

        const [sessionData] = await db.query(`
            SELECT s.*, f.file_path as frame_path, f.layout_coordinates, pr.file_path_xmp 
            FROM sessions s 
            JOIN frames f ON s.frame_id = f.id 
            LEFT JOIN presets pr ON s.preset_id = pr.id
            WHERE s.id = ?`, [sessionId]);

        if (allPhotos.length === 0 || sessionData.length === 0) {
            return res.status(404).json({ message: 'Data foto atau frame tidak ditemukan' });
        }

        const session = sessionData[0];
        const slots = JSON.parse(session.layout_coordinates || '[]');

        const frameImgPath = path.join(__dirname, '../../', session.frame_path);
        const frameImg = await loadImage(frameImgPath);
        const { width, height } = frameImg;

        // Bikin folder unik per sesi
        const sessionFolder = path.join(__dirname, `../../uploads/sessions/${sessionId}`);
        if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

        const rawFolder = path.join(sessionFolder, 'raw');
        if (!fs.existsSync(rawFolder)) fs.mkdirSync(rawFolder, { recursive: true });

        // Pindahkan / Salin file raw ke raw_folder supaya privasi terjaga
        for (let i = 0; i < allPhotos.length; i++) {
            const oldPath = path.join(__dirname, '../../', allPhotos[i].original_path);
            if (fs.existsSync(oldPath)) {
                fs.copyFileSync(oldPath, path.join(rawFolder, `raw_take_${i + 1}.jpg`));
            }
        }

        // ============================================
        // 1. GENERATE COMPOSITE PHOTO (Final Single Image)
        // ============================================
        const compositeCanvas = createCanvas(width, height);
        const compositeCtx = compositeCanvas.getContext('2d');
        compositeCtx.fillStyle = '#ffffff';
        compositeCtx.fillRect(0, 0, width, height);

        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const p = chosenPhotos[i] || chosenPhotos[0];
            if (!p) continue;

            const pImgPath = path.join(__dirname, '../../', p.original_path);
            const pImg = await loadImage(pImgPath);

            const x = (slot.x / 100) * width;
            const y = (slot.y / 100) * height;
            const w = (slot.width / 100) * width;
            const h = (slot.height / 100) * height;

            compositeCtx.save();
            if (slot.rotate) {
                compositeCtx.translate(x + w / 2, y + h / 2);
                compositeCtx.rotate((slot.rotate * Math.PI) / 180);
                compositeCtx.translate(-(x + w / 2), -(y + h / 2));
            }
            compositeCtx.drawImage(pImg, x, y, w, h);
            compositeCtx.restore();
        }

        compositeCtx.drawImage(frameImg, 0, 0, width, height);
        const compositePath = path.join(sessionFolder, 'final_composite.jpg');
        fs.writeFileSync(compositePath, await compositeCanvas.toBuffer('image/jpeg'));


        // ============================================
        // 2. GENERATE GIF (With Frame and Without Frame)
        // ============================================
        const canvasWithFrame = createCanvas(width, height);
        const ctxWith = canvasWithFrame.getContext('2d');

        const encoderWith = new GIFEncoder(width, height);
        encoderWith.start();
        encoderWith.setRepeat(0);
        encoderWith.setDelay(500);
        encoderWith.setQuality(10);

        const encoderWithout = new GIFEncoder(width, height);
        encoderWithout.start();
        encoderWithout.setRepeat(0);
        encoderWithout.setDelay(500);
        encoderWithout.setQuality(10);

        // Disini user minta GIF pakai semua jepretan foto walau tidak kepilih (allPhotos)
        for (let i = 0; i < allPhotos.length; i++) {
            const pImgPath = path.join(__dirname, '../../', allPhotos[i].original_path);
            const pImg = await loadImage(pImgPath);

            // Frame Without (Full screen image center cropped logic simulation simple drawing)
            const cWithout = createCanvas(width, height);
            const ctxWo = cWithout.getContext('2d');
            ctxWo.drawImage(pImg, 0, 0, width, height);
            encoderWithout.addFrame(ctxWo);

            // Frame With (Filling the slot logic, just simple single drawing for animation)
            ctxWith.fillStyle = '#ffffff';
            ctxWith.fillRect(0, 0, width, height);

            slots.forEach((slot) => {
                const x = (slot.x / 100) * width;
                const y = (slot.y / 100) * height;
                const w = (slot.width / 100) * width;
                const h = (slot.height / 100) * height;

                ctxWith.save();
                if (slot.rotate) {
                    ctxWith.translate(x + w / 2, y + h / 2);
                    ctxWith.rotate((slot.rotate * Math.PI) / 180);
                    ctxWith.translate(-(x + w / 2), -(y + h / 2));
                }
                ctxWith.drawImage(pImg, x, y, w, h);
                ctxWith.restore();
            });
            ctxWith.drawImage(frameImg, 0, 0, width, height);
            encoderWith.addFrame(ctxWith);
        }

        encoderWith.finish();
        encoderWithout.finish();

        fs.writeFileSync(path.join(sessionFolder, 'animation_frame.gif'), encoderWith.out.getData());
        fs.writeFileSync(path.join(sessionFolder, 'animation_raw.gif'), encoderWithout.out.getData());

        // Tandai sesi benar-benar selesai di Database sehingga masuk dan terhitung ke Dashboard
        const finalGifUrl = `/uploads/sessions/${sessionId}/animation_frame.gif`;
        await db.query("UPDATE sessions SET status = 'completed', video_path = ? WHERE id = ?", [finalGifUrl, sessionId]);

        res.status(200).json({
            message: 'Semua file (composite dan GIF) berhasil dibuat!',
            gif_url: finalGifUrl,
            composite_url: `/uploads/sessions/${sessionId}/final_composite.jpg`
        });

    } catch (error) {
        console.error("Error generating session assets:", error);
        res.status(500).json({ message: 'Gagal membuat file hasil sesi' });
    }
};