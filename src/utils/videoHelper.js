const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

exports.generateSlideshow = (photoPaths, outputPath) => {
    return new Promise((resolve, reject) => {
        // 1. Buat file teks sementara berisi daftar foto untuk dibaca FFmpeg
        const listPath = path.join(__dirname, '../../../uploads/videos/list.txt');
        
        // Atur durasi tiap foto (misal: 1 detik per foto)
        const fileContent = photoPaths.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'\nduration 1`).join('\n');
        fs.writeFileSync(listPath, fileContent);

        // 2. Eksekusi FFmpeg
        ffmpeg()
            .input(listPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-vsync vfr', '-pix_fmt yuv420p'])
            .save(outputPath)
            .on('end', () => {
                // Hapus file teks sementara setelah video selesai dibuat
                if (fs.existsSync(listPath)) fs.unlinkSync(listPath); 
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('❌ FFmpeg Error:', err);
                reject(err);
            });
    });
};