const db = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.getActivePresets = async (req, res) => {
    try {
        const [presets] = await db.query('SELECT * FROM presets WHERE is_active = 1');
        res.status(200).json(presets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil preset filter' });
    }
};

exports.getAllPresets = async (req, res) => {
    try {
        const [presets] = await db.query('SELECT * FROM presets');
        res.status(200).json(presets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil preset filter' });
    }
};

exports.addPreset = async (req, res) => {
    const { name, is_active } = req.body;
    let file_path_xmp = null;
    let file_path_lut = null;

    if (req.files && req.files.file_xmp) file_path_xmp = '/' + req.files.file_xmp[0].path.replace(/\\/g, '/');
    if (req.files && req.files.file_lut) file_path_lut = '/' + req.files.file_lut[0].path.replace(/\\/g, '/');

    try {
        const [result] = await db.query(
            'INSERT INTO presets (name, file_path_xmp, file_path_lut, default_strength, is_active) VALUES (?, ?, ?, ?, ?)',
            [name, file_path_xmp, file_path_lut, 100, is_active === '1' || is_active === true || is_active === 'true' ? 1 : 0]
        );
        res.status(201).json({ id: result.insertId, message: 'Preset ditambahkan' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menambah preset' });
    }
};

exports.updatePreset = async (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;

    try {
        let updateQuery = 'UPDATE presets SET name = ?, is_active = ?';
        let queryParams = [name, is_active === '1' || is_active === true || is_active === 'true' ? 1 : 0];

        if (req.files) {
            if (req.files.file_xmp) {
                updateQuery += ', file_path_xmp = ?';
                queryParams.push('/' + req.files.file_xmp[0].path.replace(/\\/g, '/'));
            }
            if (req.files.file_lut) {
                updateQuery += ', file_path_lut = ?';
                queryParams.push('/' + req.files.file_lut[0].path.replace(/\\/g, '/'));
            }
        }

        updateQuery += ' WHERE id = ?';
        queryParams.push(id);

        await db.query(updateQuery, queryParams);
        res.status(200).json({ message: 'Preset diupdate' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal update preset' });
    }
};

exports.deletePreset = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM presets WHERE id = ?', [id]);
        res.status(200).json({ message: 'Preset dihapus' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal hapus preset' });
    }
};
