const db = require('../config/db');
const axios = require('axios');

const generateXenditHeaders = () => {
    const secretKey = process.env.XENDIT_SECRET_KEY || 'xnd_development_xxxxxxxxxxxxxxxxxxxxxx';
    const base64Auth = Buffer.from(secretKey + ':').toString('base64');
    return {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/json'
    };
};

exports.createXenditPayment = async (req, res) => {
    const { amount, method, sessionId } = req.body;
    const externalId = `KLIKDW-${sessionId}-${Date.now()}`;
    const headers = generateXenditHeaders();

    try {
        if (method === 'QRIS') {
            // Xendit API menolak URL yang mengandung 'localhost'.
            // Jika Anda menjalankan Kiosk di localhost, kita gunakan placeholder Webhook URL.
            // Anda bisa menggunakan ngrok nanti agar Kiosk bisa menerima konfirmasi pembayaran.
            let callbackURL = `${process.env.BASE_URL}/api/payments/xendit-webhook`;
            if (callbackURL.includes('localhost')) {
                callbackURL = 'https://webhook.site/dummy-klikdreamwave-webhook';
            }

            const response = await axios.post('https://api.xendit.co/qr_codes', {
                external_id: externalId,
                type: 'DYNAMIC',
                amount: amount,
                callback_url: callbackURL
            }, { headers });

            const qr = response.data;

            await db.query(
                'INSERT INTO payments (session_id, doku_trx_id, amount, payment_method, status) VALUES (?, ?, ?, ?, ?)',
                [sessionId, qr.external_id, amount, 'QRIS', 'pending']
            );

            res.status(200).json({
                qr_string: qr.qr_string,
                external_id: qr.external_id
            });

        } else if (method === 'MANDIRI_VA') {
            const response = await axios.post('https://api.xendit.co/callback_virtual_accounts', {
                external_id: externalId,
                bank_code: 'MANDIRI',
                name: 'Pelanggan Klikdreamwave',
                expected_amount: amount,
                is_closed: true,
                is_single_use: true
            }, { headers });

            const account = response.data;

            await db.query(
                'INSERT INTO payments (session_id, doku_trx_id, amount, payment_method, status) VALUES (?, ?, ?, ?, ?)',
                [sessionId, account.external_id, amount, 'MANDIRI_VA', 'pending']
            );

            res.status(200).json({
                va_number: account.account_number,
                external_id: account.external_id
            });
        }
    } catch (error) {
        const errorDetail = error.response?.data || error.message;
        console.error('Xendit Payment Error:', JSON.stringify(errorDetail, null, 2));

        // Kirim detail error ke frontend agar tidak bingung
        let displayError = 'Gagal membuat pembayaran Xendit';
        if (error.response?.data?.message) {
            displayError = error.response.data.message;
        } else if (error.response?.data?.errors) {
            // Xendit kadang mengembalikan array `errors`
            displayError = JSON.stringify(error.response.data.errors);
        }

        res.status(500).json({ message: displayError, detail: errorDetail });
    }
};

exports.xenditWebhook = async (req, res) => {
    const { external_id, status } = req.body;

    try {
        const isPaid = (status === 'COMPLETED' || req.body.event === 'qr_code.paid' || req.body.event === 'va_fixed.paid' || status === 'PAID');

        if (isPaid) {
            const extId = external_id || req.body.data?.external_id;
            await db.query('UPDATE payments SET status = ?, paid_at = NOW() WHERE doku_trx_id = ?', ['paid', extId]);

            const [payment] = await db.query('SELECT session_id FROM payments WHERE doku_trx_id = ?', [extId]);
            if (payment.length > 0) {
                await db.query('UPDATE sessions SET status = ? WHERE id = ?', ['paid', payment[0].session_id]);
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Xendit Webhook Error:', error);
        res.status(500).send('Error');
    }
};

exports.checkPaymentStatus = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const [session] = await db.query('SELECT status FROM sessions WHERE id = ? OR (SELECT session_id FROM payments WHERE doku_trx_id = ?) = id', [sessionId, sessionId]);
        if (session.length === 0) return res.status(404).json({ message: 'Sesi tidak ditemukan' });
        res.status(200).json({ status: session[0].status });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengecek status' });
    }
};