const db = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.getAllFrames = async (req, res) => {
    try {
        const [frames] = await db.query('SELECT * FROM frames ORDER BY created_at DESC');
        res.status(200).json(frames);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data frame' });
    }
};

exports.addFrame = async (req, res) => {
    // Tangkap layout_coordinates dari form
    const { name, layout_type, capture_count, layout_coordinates } = req.body;
    let filePath = '/uploads/frames/dummy.png';

    if (req.file) filePath = '/' + req.file.path.replace(/\\/g, '/');

    try {
        const [result] = await db.query(
            'INSERT INTO frames (name, file_path, layout_type, capture_count, layout_coordinates) VALUES (?, ?, ?, ?, ?)',
            [name, filePath, layout_type, capture_count, layout_coordinates || '[]']
        );
        res.status(201).json({ id: result.insertId, message: 'Frame berhasil ditambahkan!' });
    } catch (error) {
        console.error("Add Frame error:", error);
        res.status(500).json({ message: 'Gagal menambahkan frame', error: error.message });
    }
};

exports.updateFrame = async (req, res) => {
    const { id } = req.params;
    const { name, layout_type, capture_count, layout_coordinates } = req.body;

    try {
        if (req.file) {
            const newFilePath = '/' + req.file.path.replace(/\\/g, '/');
            const [oldFrame] = await db.query('SELECT file_path FROM frames WHERE id = ?', [id]);
            if (oldFrame.length > 0 && oldFrame[0].file_path && oldFrame[0].file_path !== '/uploads/frames/dummy.png') {
                const oldPath = path.join(__dirname, '../../', oldFrame[0].file_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            await db.query(
                'UPDATE frames SET name = ?, layout_type = ?, capture_count = ?, layout_coordinates = ?, file_path = ? WHERE id = ?',
                [name, layout_type, capture_count, layout_coordinates || '[]', newFilePath, id]
            );
        } else {
            await db.query(
                'UPDATE frames SET name = ?, layout_type = ?, capture_count = ?, layout_coordinates = ? WHERE id = ?',
                [name, layout_type, capture_count, layout_coordinates || '[]', id]
            );
        }
        res.status(200).json({ message: 'Frame diperbarui!' });
    } catch (error) {
        console.error("Update Frame error:", error);
        res.status(500).json({ message: 'Gagal memperbarui frame', error: error.message });
    }
};

exports.deleteFrame = async (req, res) => {
    const { id } = req.params;
    try {
        const [frame] = await db.query('SELECT file_path FROM frames WHERE id = ?', [id]);
        if (frame.length > 0 && frame[0].file_path && frame[0].file_path !== '/uploads/frames/dummy.png') {
            const filePath = path.join(__dirname, '../../', frame[0].file_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await db.query('DELETE FROM frames WHERE id = ?', [id]);
        res.status(200).json({ message: 'Frame dihapus!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus frame' });
    }
};