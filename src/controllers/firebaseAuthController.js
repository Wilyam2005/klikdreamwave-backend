const admin = require('../config/firebase');
const db = require('../config/db');

exports.verifyFirebaseToken = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: 'Token ID Firebase diperlukan' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name } = decodedToken;

        // Sync with local admin_users table if necessary or just trust Firebase
        // Here we just return the user info
        res.status(200).json({
            message: 'Login Firebase Berhasil!',
            user: { uid, email, name }
        });
    } catch (error) {
        console.error('Firebase Auth Error:', error);
        res.status(401).json({ message: 'Token ID Firebase tidak valid atau kadaluarsa' });
    }
};

// Admin can manage settings via their Firebase account
// We can add a middleware to check if the user is an admin in Firebase custom claims
