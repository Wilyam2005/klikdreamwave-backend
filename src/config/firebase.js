const admin = require('firebase-admin');
const path = require('path');

// NOTE: User must provide serviceAccountKey.json in the config folder
try {
    const serviceAccount = require('../config/firebase-service-account.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK Initialized');
} catch (error) {
    console.warn('⚠️ Firebase service account not found or invalid. Firebase auth will not work.');
}

module.exports = admin;
