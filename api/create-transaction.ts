import { VercelRequest, VercelResponse } from '@vercel/node';

const midtransClient = require('midtrans-client');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { packageType, customerInfo } = req.body;

        if (!packageType || !customerInfo) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Package prices
        const packages: { [key: string]: { name: string; price: number; accounts: number; description: string } } = {
            siswa: {
                name: 'Siswa',
                price: 50000,
                accounts: 1,
                description: 'Paket individual untuk 1 siswa'
            },
            kelas: {
                name: 'Kelas',
                price: 100000,
                accounts: 40,
                description: 'Paket untuk 1 kelas (40 akun)'
            },
            angkatan: {
                name: 'Angkatan',
                price: 500000,
                accounts: 600,
                description: 'Paket untuk 1 angkatan (15 kelas, 600 akun)'
            },
            sekolah: {
                name: 'Sekolah',
                price: 1000000,
                accounts: 1800,
                description: 'Paket untuk seluruh sekolah (45 kelas, 1800 akun)'
            }
        };

        const pkg = packages[packageType];
        if (!pkg) {
            return res.status(400).json({ error: 'Invalid package type' });
        }

        // Initialize Midtrans Snap
        const snap = new midtransClient.Snap({
            isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.MIDTRANS_CLIENT_KEY
        });

        // Generate unique order ID
        const orderId = `AHA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Create transaction parameter
        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: pkg.price
            },
            item_details: [
                {
                    id: packageType,
                    price: pkg.price,
                    quantity: 1,
                    name: `Paket ${pkg.name} - ${pkg.accounts} Akun`
                }
            ],
            customer_details: {
                first_name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone
            },
            callbacks: {
                finish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}?payment=success&order_id=${orderId}&package=${packageType}`
            }
        };

        // Create transaction token
        const transaction = await snap.createTransaction(parameter);

        return res.status(200).json({
            token: transaction.token,
            redirectUrl: transaction.redirect_url,
            orderId: orderId
        });

    } catch (error: any) {
        console.error('Error creating transaction:', error);
        return res.status(500).json({
            error: 'Failed to create transaction',
            message: error.message
        });
    }
}
