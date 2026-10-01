const admin = require("firebase-admin");
const crypto = require("crypto");

function initializeFirebase() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };

    return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

function generateSixDigitId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple hash function to avoid storing raw passwords/PINs
function hashValue(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Only POST method is allowed"
        });
    }

    try {
        initializeFirebase();

        const { name, username, mobile, password, pin } = req.body || {};

        // Validation for required fields
        if (!name || !username || !mobile || !password || !pin) {
            return res.status(400).json({
                success: false,
                message: "name, username, mobile, password, and pin are required"
            });
        }

        const cleanName = String(name).trim();
        const cleanUsername = String(username).trim();
        const cleanMobile = String(mobile).trim();
        const cleanPassword = String(password).trim();
        const cleanPin = String(pin).trim();

        if (!cleanName || !cleanUsername || !cleanMobile || !cleanPassword || !cleanPin) {
            return res.status(400).json({
                success: false,
                message: "Inputs cannot be empty"
            });
        }

        const db = admin.database();
        const usersRef = db.ref("movieUsers");

        // Generate a unique 6-digit ID key
        let randomId;
        let exists = true;

        while (exists) {
            randomId = generateSixDigitId();
            const snapshot = await usersRef.child(randomId).once("value");
            exists = snapshot.exists();
        }

        // Store directly under the 6-digit ID
        const userData = {
            id: randomId,
            name: cleanName,
            username: cleanUsername,
            mobile: cleanMobile,
            passwordHash: cleanPassword,
            pinHash: cleanPin,
            createdAt: new Date().toISOString()
        };

        await usersRef.child(randomId).set(userData);

        return res.status(200).json({
            success: true,
            message: "User saved successfully",
            data: {
                id: randomId,
                name: cleanName,
                username: cleanUsername,
                mobile: cleanMobile
            }
        });

    } catch (error) {
        console.error("Firebase error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};
