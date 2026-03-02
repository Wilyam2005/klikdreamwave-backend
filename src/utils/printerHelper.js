const { exec } = require('child_process');

exports.printFile = (filePath) => {
    return new Promise((resolve, reject) => {
        // Printer hanya bisa digunakan di Windows (kiosk fisik)
        if (process.platform !== 'win32') {
            console.warn('⚠️ Print dilewati: bukan lingkungan Windows.');
            return resolve(false);
        }

        // Menggunakan perintah PowerShell bawaan Windows untuk print gambar ke Default Printer
        const command = `powershell Start-Process -FilePath "${filePath}" -Verb Print`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                // Beri jeda 3 detik agar spooler Windows sempat memproses sebelum lanjut
                setTimeout(() => resolve(true), 3000);
            }
        });
    });
};