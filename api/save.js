const admin = require("firebase-admin");

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

module.exports = async (req, res) => {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

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

        const { name, username } = req.body || {};

        if (!name || !username) {
            return res.status(400).json({
                success: false,
                message: "name and username are required"
            });
        }

        const cleanName = String(name).trim();
        const cleanUsername = String(username).trim();

        if (!cleanName || !cleanUsername) {
            return res.status(400).json({
                success: false,
                message: "Invalid name or username"
            });
        }

        if (cleanName.length > 100 || cleanUsername.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Input is too long"
            });
        }

        const db = admin.database();
        const usersRef = db.ref("movieUsers");

        // Generate a 6 digit ID
        let randomId;
        let exists = true;

        // Make sure the generated ID isn't already being used
        while (exists) {
            randomId = generateSixDigitId();

            const snapshot = await usersRef
                .orderByChild("id")
                .equalTo(randomId)
                .limitToFirst(1)
                .once("value");

            exists = snapshot.exists();
        }

        // Firebase generated key
        const newUserRef = usersRef.push();

        await newUserRef.set({
            name: cleanName,
            username: cleanUsername,
            id: randomId
        });

        return res.status(200).json({
            success: true,
            message: "User saved successfully",
            data: {
                name: cleanName,
                username: cleanUsername,
                id: randomId
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
