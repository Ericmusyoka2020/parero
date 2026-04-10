const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// === CONFIG ===
const AUTH_TOKEN = "Basic T2h5cWJBRXZSSkQ1dHhNc1F1bG06R29SRzgwTFFocW00Mm81TDBmMXAzQmU0bTgxVjFyYWRrcTlVUGhJbg==";
const ACCOUNT_ID = 5932;
const CHANNEL_ID = 6905;
const PAYHERO_URL = "https://backend.payhero.co.ke/api/v2/payments";

const CALLBACK_URL = "https://parero.vercel.app//api/callback";
// =================

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store latest callback
let latestCallback = null;

// Middleware for ngrok
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// ================= STK PUSH =================
app.post('/api/stk-push', async (req, res) => {
    try {
        let { amount, phone_number } = req.body;

        if (!amount || !phone_number) {
            return res.status(400).json({ success: false, error: "Missing amount or phone_number" });
        }

        // Format phone
        phone_number = String(phone_number).replace(/\D/g, '');
        if (phone_number.startsWith('0')) phone_number = '254' + phone_number.substring(1);
        else if (phone_number.startsWith('7')) phone_number = '254' + phone_number;

        const external_reference = "INV-" + Date.now();

        const payload = {
            account_id: ACCOUNT_ID,
            amount: Number(amount),
            phone_number: phone_number,
            channel_id: CHANNEL_ID,
            provider: "m-pesa",
            external_reference: external_reference,
            callback_url: CALLBACK_URL
        };

        const response = await axios.post(PAYHERO_URL, payload, {
            headers: {
                Authorization: AUTH_TOKEN,
                "Content-Type": "application/json"
            },
            timeout: 20000
        });

        // Reset status for new transaction
        latestCallback = null;

        res.json({
            success: true,
            message: "STK push sent",
            external_reference: external_reference
        });

    } catch (error) {
        console.error("STK PUSH ERROR:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "STK push failed" });
    }
});

// ================= CALLBACK =================
app.post('/api/callback', (req, res) => {
    console.log("PAYMENT CALLBACK RECEIVED");
    console.log(JSON.stringify(req.body, null, 2));

    latestCallback = req.body;

    if (req.body.response && req.body.response.ResultCode === 0) {
        console.log("✅ PAYMENT SUCCESS");
    } else if (req.body.response && req.body.response.ResultCode !== undefined) {
        console.log(`Payment status: ${req.body.response.ResultCode} - ${req.body.response.ResultDesc}`);
    }

    res.json({ received: true });
});

// ================= CHECK STATUS =================
app.get('/api/status', (req, res) => {
    if (!latestCallback) {
        return res.json({ status: false, message: "Waiting for callback..." });
    }
    res.json(latestCallback);   // Return exact callback structure
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
