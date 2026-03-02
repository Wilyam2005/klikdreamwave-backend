const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path ke DigiCamControl Remote CMD (prioritas utama)
const DIGICAM_PATHS = [
    'C:\\Program Files (x86)\\digiCamControl\\CameraControlRemoteCmd.exe',
    'C:\\Program Files\\digiCamControl\\CameraControlRemoteCmd.exe',
    'C:\\digiCamControl\\CameraControlRemoteCmd.exe',
];

// Path ke DSLRCam.exe (digiCamControl Virtual Webcam App)
const DSLRCAM_PATH = 'C:\\Program Files (x86)\\digiCamControl Virtual Webcam\\DSLRCam.exe';

function getDigiCamPath() {
    for (const p of DIGICAM_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function getDSLRCamPath() {
    if (fs.existsSync(DSLRCAM_PATH)) return DSLRCAM_PATH;
    return null;
}

/**
 * captureDSLR - Trigger Canon DSLR via USB
 * Metode 1: digiCamControl CameraControlRemoteCmd.exe
 * Metode 2: WIA (Windows Image Acquisition) via PowerShell
 * @param {string} savePath - Path absolut untuk menyimpan hasil foto
 * @returns {Promise<string>} - savePath jika berhasil
 */
exports.captureDSLR = (savePath) => {
    return new Promise((resolve, reject) => {
        // Pastikan folder tujuan ada
        const saveDir = path.dirname(savePath);
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const digicamExe = getDigiCamPath();

        if (digicamExe) {
            // ============================================================
            // METODE 1: digiCamControl CameraControlRemoteCmd.exe
            // ============================================================
            const command = `"${digicamExe}" /capture /filename "${savePath}"`;
            console.log(`📸 [DSLR-Method1] digiCamControl: ${command}`);

            exec(command, { timeout: 25000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ [DSLR-Method1] Error:`, error.message, stdout, stderr);
                    // Fallback ke WIA
                    return captureViaWIA(savePath, resolve, reject);
                }
                console.log(`✅ [DSLR-Method1] OK. STDOUT: ${stdout}`);
                waitForFile(savePath, resolve, reject);
            });
        } else {
            // ============================================================
            // METODE 2: WIA (Windows Image Acquisition) via PowerShell
            // Bisa trigger Canon EOS via USB tanpa software pihak ketiga
            // ============================================================
            captureViaWIA(savePath, resolve, reject);
        }
    });
};

/**
 * captureViaWIA - Trigger kamera via Windows Image Acquisition API
 * Menggunakan PowerShell untuk mengakses WIA device dan trigger capture
 */
function captureViaWIA(savePath, resolve, reject) {
    console.log(`📸 [DSLR-Method2] Mencoba WIA capture: ${savePath}`);

    // PowerShell script untuk trigger Canon EOS via WIA
    const psScript = `
$wia = New-Object -ComObject 'WIA.CommonDialog'
$device = $null

# Cari device kamera Canon
$devManager = New-Object -ComObject 'WIA.DeviceManager'
foreach ($info in $devManager.DeviceInfos) {
    if ($info.Properties['Name'].Value -like '*Canon*' -or $info.Properties['Name'].Value -like '*EOS*') {
        $device = $info.Connect()
        break
    }
}

if ($null -eq $device) {
    # Coba ambil semua device yang ada
    if ($devManager.DeviceInfos.Count -gt 0) {
        $device = $devManager.DeviceInfos.Item(1).Connect()
    }
}

if ($null -eq $device) {
    Write-Error "Tidak ada kamera WIA yang ditemukan. Pastikan Canon EOS terhubung via USB."
    exit 1
}

# Trigger capture via WIA
$item = $device.ExecuteCommand('{AF933CAC-ACAD-11D2-A093-00C04F72DC3C}')
$image = $item.Transfer()

# Simpan file
$image.SaveFile('${savePath.replace(/\\/g, '\\\\')}')
Write-Host "SUCCESS: File disimpan ke ${savePath.replace(/\\/g, '\\\\')}"
`.trim();

    const command = `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        const output = (stdout + stderr);
        console.log(`[WIA] Output: ${output.substring(0, 300)}`);

        if (error && !output.includes('SUCCESS')) {
            console.error(`❌ [WIA] Error:`, error.message);
            return reject(new Error(
                `Gagal trigger kamera via WIA.\n\n` +
                `Untuk fitur trigger shutter via USB, install:\n` +
                `digiCamControl (https://digicamcontrol.com) - GRATIS\n\n` +
                `Atau gunakan mode Webcam (Virtual Webcam dari DSLRCam).\n\n` +
                `Detail error: ${error.message}\n${output.substring(0, 200)}`
            ));
        }

        waitForFile(savePath, resolve, reject);
    });
}

/**
 * waitForFile - Tunggu file selesai ditulis ke disk
 */
function waitForFile(savePath, resolve, reject) {
    let waited = 0;
    const waitInterval = 500;
    const maxWait = 8000;

    const checkFile = setInterval(() => {
        waited += waitInterval;
        if (fs.existsSync(savePath)) {
            const stats = fs.statSync(savePath);
            if (stats.size > 5000) {
                clearInterval(checkFile);
                console.log(`✅ [DSLR] File siap: ${savePath} (${stats.size} bytes)`);
                resolve(savePath);
            } else if (waited >= maxWait) {
                clearInterval(checkFile);
                reject(new Error(`File foto terlalu kecil (${stats.size} bytes).`));
            }
        } else if (waited >= maxWait) {
            clearInterval(checkFile);
            reject(new Error(`File foto tidak tersimpan setelah ${maxWait / 1000} detik.`));
        }
    }, waitInterval);
}



/**
 * checkDSLRConnected - Cek apakah kamera DSLR tersambung
 * Mendukung: digiCamControl (CameraControlRemoteCmd.exe) dan deteksi USB Canon via WMI
 * @returns {Promise<boolean>}
 */
exports.checkDSLRConnected = () => {
    return new Promise((resolve) => {
        const digicamExe = getDigiCamPath();

        if (digicamExe) {
            // Gunakan digiCamControl /list cameras
            const command = `"${digicamExe}" /c list cameras`;
            exec(command, { timeout: 8000 }, (error, stdout, stderr) => {
                const output = (stdout + stderr).toLowerCase();
                if (error && !stdout) return resolve(false);

                const noCameraKeywords = ['no camera', '0 camera', 'not found'];
                if (noCameraKeywords.some(kw => output.includes(kw))) return resolve(false);

                const cameraKeywords = ['canon', 'nikon', 'sony', 'eos'];
                if (cameraKeywords.some(kw => output.includes(kw))) return resolve(true);
                if (!error && stdout.length > 5) return resolve(true);
                resolve(false);
            });
        } else {
            // Fallback: Cek USB camera via WMI (Windows)
            // Akan mendeteksi Canon EOS 550D terkoneksi via USB
            const wmiCmd = `powershell -NoProfile -Command "Get-PnpDevice | Where-Object { $_.FriendlyName -like '*Canon*' -or $_.FriendlyName -like '*EOS*' } | Select-Object Status, FriendlyName | ConvertTo-Json"`;
            exec(wmiCmd, { timeout: 10000 }, (error, stdout) => {
                if (error || !stdout || stdout.trim() === '') return resolve(false);
                try {
                    const parsed = JSON.parse(stdout.trim());
                    const devices = Array.isArray(parsed) ? parsed : [parsed];
                    const connected = devices.some(d =>
                        d.Status === 'OK' || d.Status === 'Unknown' || d.Status === 'Degraded'
                    );
                    if (connected) {
                        console.log('[DSLR Status] Canon EOS terdeteksi via USB:', stdout.trim().substring(0, 100));
                    }
                    resolve(connected);
                } catch {
                    // Jika output tidak JSON tapi ada konten → ada kamera
                    if (stdout.trim().length > 10) {
                        console.log('[DSLR Status] Canon terdeteksi (raw):', stdout.trim().substring(0, 100));
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            });
        }
    });
};

/**
 * isDigiCamInstalled - Cek apakah digiCamControl atau DSLRCam terinstall
 * @returns {boolean}
 */
exports.isDigiCamInstalled = () => {
    return !!getDigiCamPath() || !!getDSLRCamPath();
};

