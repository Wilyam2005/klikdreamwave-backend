const db = require('../config/db');
const printerHelper = require('../utils/printerHelper');

const processPrintQueue = async () => {
    try {
        // Cari 1 file yang statusnya 'queued' ATAU 'failed' tapi retry_count masih di bawah 3
        const [jobs] = await db.query(
            `SELECT * FROM print_queue 
             WHERE status = 'queued' OR (status = 'failed' AND retry_count < 3) 
             ORDER BY created_at ASC LIMIT 1`
        );

        if (jobs.length === 0) return; // Jika tidak ada antrian, diam saja

        const job = jobs[0];
        console.log(`🖨️ Memproses print job ID: ${job.id} | File: ${job.file_path}`);

        // Update status jadi 'printing' agar tidak diproses ganda oleh worker lain
        await db.query('UPDATE print_queue SET status = ? WHERE id = ?', ['printing', job.id]);

        try {
            // Eksekusi perintah ke Printer Windows
            await printerHelper.printFile(job.file_path);
            
            // Jika sukses, update status ke 'success'
            await db.query('UPDATE print_queue SET status = ? WHERE id = ?', ['success', job.id]);
            console.log(`✅ Print sukses untuk job ID: ${job.id}`);
            
        } catch (printError) {
            console.error(`❌ Print gagal untuk job ID: ${job.id}`);
            // Jika gagal, kembalikan ke 'failed' dan tambah hitungan retry
            await db.query(
                'UPDATE print_queue SET status = ?, retry_count = retry_count + 1 WHERE id = ?', 
                ['failed', job.id]
            );
        }

    } catch (error) {
        console.error('Error pada Print Worker DB:', error);
    }
};

// Fungsi ini akan dipanggil di server.js untuk menjalankan worker setiap 5 detik (5000 ms)
exports.startWorker = () => {
    setInterval(processPrintQueue, 5000);
    console.log('⚙️ Print Worker berjalan (Cek antrian print tiap 5 detik)...');
};