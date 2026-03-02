const db = require('../config/db');
const ExcelJS = require('exceljs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

let cachedHardwareStatus = {
    camera: { name: 'Memeriksa...', status: 'Pinging', color: 'text-gray-400' },
    printer: { name: 'Memeriksa...', status: 'Pinging', color: 'text-gray-400' },
    db: { name: 'DB MySQL', status: 'Pinging', color: 'text-gray-400' }
};
let lastCheckTime = 0;
let isChecking = false;

const checkHardwareRealtime = async () => {
    if (isChecking) return;
    isChecking = true;

    const newStatus = { ...cachedHardwareStatus };

    try {
        // 1. Check DB
        await db.query('SELECT 1');
        newStatus.db = { name: 'DB MySQL', status: 'Active', color: 'text-green-400' };
    } catch (e) {
        newStatus.db = { name: 'DB MySQL', status: 'Disconnected', color: 'text-red-500' };
    }

    try {
        // Get device settings
        const [rows] = await db.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('active_printer', 'active_camera')");
        const settings = { active_printer: '', active_camera: '' };
        rows.forEach(r => settings[r.setting_key] = r.setting_value);

        // 2. Check Printer
        if (!settings.active_printer) {
            newStatus.printer = { name: 'Printer Status', status: 'Not Set', color: 'text-yellow-400' };
        } else if (settings.active_printer.includes('Simulasi')) {
            newStatus.printer = { name: settings.active_printer, status: 'Online', color: 'text-green-400' };
        } else {
            try {
                // Warning: checking printer status explicitly in windows is sometimes tricky, let's at least check if the object exists
                const { stdout } = await execPromise(`powershell -Command "Get-Printer -Name '${settings.active_printer}' | Select-Object -ExpandProperty PrinterStatus"`);
                const state = stdout.trim();
                newStatus.printer = {
                    name: settings.active_printer.substring(0, 20),
                    status: state ? state : 'Online',
                    color: (state && state.toLowerCase().includes('error')) ? 'text-red-500' : 'text-green-400'
                };
            } catch (e) {
                newStatus.printer = { name: settings.active_printer.substring(0, 20), status: 'Offline', color: 'text-red-500' };
            }
        }

        // 3. Check Camera
        if (!settings.active_camera) {
            newStatus.camera = { name: 'Kamera', status: 'Not Set', color: 'text-yellow-400' };
        } else if (settings.active_camera.includes('Canon DSLR')) {
            // Can't reliably check DSLR without calling the tool and capturing, assume online if configured for now. Or, ideally check USB properties. 
            // We'll assume Ready, but label it DSLR.
            newStatus.camera = { name: 'Canon DSLR', status: 'Ready', color: 'text-green-400' };
        } else {
            try {
                // It's a webcam UUID, verify if standard webcams exist in PnP
                const { stdout } = await execPromise(`powershell -Command "Get-PnpDevice -Class Camera,Image -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status"`);
                if (stdout.toLowerCase().includes('ok')) {
                    newStatus.camera = { name: 'USB Webcam', status: 'Ready', color: 'text-green-400' };
                } else {
                    newStatus.camera = { name: 'USB Webcam', status: 'Not Found', color: 'text-red-500' };
                }
            } catch (e) {
                newStatus.camera = { name: 'USB Webcam', status: 'Error/Offline', color: 'text-red-500' };
            }
        }

    } catch (e) {
        console.error("Hardware check error:", e);
    }

    cachedHardwareStatus = newStatus;
    lastCheckTime = Date.now();
    isChecking = false;
};

exports.getHardwareStatus = async (req, res) => {
    // If it's been more than 10 seconds, trigger a check in the background
    if (Date.now() - lastCheckTime > 10000) {
        checkHardwareRealtime(); // Don't await, let it update the cache in background to keep API fast
    }

    // If it's the very first time and we have no cache yet, wait for at least one check
    if (lastCheckTime === 0) {
        await checkHardwareRealtime();
    }

    res.json(cachedHardwareStatus);
};

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Total Pendapatan Bulan Ini (Hanya yang lunas)
        const [revenueMonth] = await db.query(`
            SELECT SUM(total_price) as total 
            FROM sessions 
            WHERE status = 'completed' 
            AND MONTH(created_at) = MONTH(CURRENT_DATE())
            AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);
        const monthlyRevenue = revenueMonth[0].total || 0;

        // 2. Total Transaksi QRIS (assuming qris is the only cashless for now)
        const [qrisResult] = await db.query(`
            SELECT SUM(amount) as total 
            FROM payments 
            WHERE status = 'paid' AND payment_method = 'QRIS'
        `);
        const totalQris = qrisResult[0].total || 0;

        // 3. Total Sesi Voucher
        const [voucherResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM sessions 
            WHERE voucher_id IS NOT NULL AND status = 'completed'
        `);
        const totalVoucherSessions = voucherResult[0].total || 0;

        // 4. Statistik Pendapatan Harian (untuk chart)
        const [dailyStats] = await db.query(`
            SELECT DATE(created_at) as date, SUM(total_price) as total
            FROM sessions
            WHERE status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 30
        `);

        // 5. Total Sesi Berhasil
        const [sessionResult] = await db.query("SELECT COUNT(*) as total FROM sessions WHERE status = 'completed'");
        const totalSessions = sessionResult[0].total || 0;

        res.status(200).json({
            monthlyRevenue,
            totalQris,
            totalVoucherSessions,
            totalSessions,
            dailyStats: dailyStats.reverse()
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ message: 'Gagal mengambil data statistik' });
    }
};

exports.exportTransactionsToExcel = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                s.id as session_id,
                s.session_code,
                s.total_price,
                s.status as session_status,
                s.created_at,
                f.name as frame_name,
                v.code as voucher_code,
                v.discount_type,
                p.payment_method,
                p.amount as paid_amount
            FROM sessions s
            LEFT JOIN frames f ON s.frame_id = f.id
            LEFT JOIN vouchers v ON s.voucher_id = v.id
            LEFT JOIN payments p ON s.id = p.session_id
            ORDER BY s.created_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transaksi Klikdreamwave');

        worksheet.columns = [
            { header: 'ID Sesi', key: 'session_id', width: 10 },
            { header: 'Kode Sesi', key: 'session_code', width: 25 },
            { header: 'Frame', key: 'frame_name', width: 20 },
            { header: 'Harga Total', key: 'total_price', width: 15 },
            { header: 'Metode Bayar', key: 'payment_method', width: 15 },
            { header: 'Terbayar', key: 'paid_amount', width: 15 },
            { header: 'Kode Voucher', key: 'voucher_code', width: 15 },
            { header: 'Status', key: 'session_status', width: 15 },
            { header: 'Tanggal', key: 'created_at', width: 20 }
        ];

        rows.forEach(row => {
            worksheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Laporan_Transaksi.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Export Excel Error:", error);
        res.status(500).json({ message: 'Gagal mengekspor data ke Excel' });
    }
};

exports.clearHistory = async (req, res) => {
    try {
        // Implementation to clear history cleanly without breaking relational constraints
        await db.query("DELETE FROM session_photos");
        await db.query("DELETE FROM payments");
        await db.query("DELETE FROM sessions");

        // Hapus fisik file-filenya juga agar bersih menyeluruh
        const dirs = ['uploads/sessions', 'uploads/photos', 'uploads/videos'];
        dirs.forEach(dir => {
            const dirPath = path.join(__dirname, '../../', dir);
            if (fs.existsSync(dirPath)) {
                fs.readdirSync(dirPath).forEach(file => {
                    const filePath = path.join(dirPath, file);
                    if (fs.lstatSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    }
                });
            }
        });

        res.status(200).json({ message: 'Riwayat transaksi & file fisik berhasil dibersihkan!' });
    } catch (error) {
        console.error("Clear History Error:", error);
        res.status(500).json({ message: 'Gagal membersihkan riwayat' });
    }
};