# Deployment Guide - Anak Hebat Landing Page

## Prerequisites

- Node.js 18+ installed
- Vercel account (free tier works)
- Midtrans account with Server Key and Client Key

## Environment Variables

The following environment variables need to be configured:

```env
MIDTRANS_SERVER_KEY=Mid-server-wRE6v_AJ_F6l9wHX65FwvQ9p
MIDTRANS_CLIENT_KEY=Mid-client-kW08Q23TYi0gFUHj
MIDTRANS_IS_PRODUCTION=false
FRONTEND_URL=https://your-domain.vercel.app
```

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Update with your Midtrans credentials (already done)

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Test backend API locally:**
   
   The API endpoint will be available at `http://localhost:3000/api/create-transaction` when deployed to Vercel. For local testing of the API function, you can use Vercel CLI:
   
   ```bash
   npm install -g vercel
   vercel dev
   ```

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set environment variables in Vercel:**
   ```bash
   vercel env add MIDTRANS_SERVER_KEY
   vercel env add MIDTRANS_CLIENT_KEY
   vercel env add MIDTRANS_IS_PRODUCTION
   vercel env add FRONTEND_URL
   ```

5. **Deploy to production:**
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Dashboard

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit with Midtrans payment integration"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite configuration

3. **Configure Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add each variable:
     - `MIDTRANS_SERVER_KEY`: `Mid-server-wRE6v_AJ_F6l9wHX65FwvQ9p`
     - `MIDTRANS_CLIENT_KEY`: `Mid-client-kW08Q23TYi0gFUHj`
     - `MIDTRANS_IS_PRODUCTION`: `false`
     - `FRONTEND_URL`: Your Vercel deployment URL

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete

## Testing Payment Flow

### Test in Sandbox Mode

Midtrans Sandbox provides test payment methods:

**Test Credit Cards:**
- Card Number: `4811 1111 1111 1114`
- CVV: `123`
- Exp Date: Any future date
- 3D Secure OTP: `112233`

**Test E-Wallets:**
- GoPay: Use provided QR code (will auto-success in sandbox)
- OVO/DANA: Phone number - any number will work in sandbox

### Testing Steps

1. Open your deployed landing page
2. Click on any package pricing button
3. Fill in customer information form
4. Click "Lanjut ke Pembayaran"
5. Midtrans Snap popup should appear
6. Use test payment methods above
7. After successful payment:
   - Voucher code should be generated
   - Success modal should appear
   - Voucher should be saved to Firestore

## Switching to Production

When ready to accept real payments:

1. **Get Production Credentials:**
   - Login to Midtrans Dashboard
   - Go to Settings → Access Keys
   - Copy Production Server Key and Client Key

2. **Update Environment Variables:**
   ```bash
   vercel env add MIDTRANS_SERVER_KEY production
   # Enter your production server key
   
   vercel env add MIDTRANS_IS_PRODUCTION production
   # Enter: true
   ```

3. **Update index.html:**
   - Change Snap script URL from:
     ```html
     https://app.sandbox.midtrans.com/snap/snap.js
     ```
   - To:
     ```html
     https://app.midtrans.com/snap/snap.js
     ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

## Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` environment variable matches your deployment URL
- Check `vercel.json` CORS configuration

### Payment Popup Not Appearing
- Check browser console for errors
- Verify Midtrans Client Key is correct in `index.html`
- Ensure Snap script is loaded (check Network tab)

### Backend API Errors
- Check Vercel function logs: `vercel logs`
- Verify environment variables are set correctly
- Ensure Midtrans Server Key is valid

### Firestore Errors
- Verify Firebase configuration in `firebase.ts`
- Check Firestore rules allow writes to `vouchers` collection
- Ensure Firebase project is active

## Monitoring

- **Vercel Logs:** `vercel logs --follow`
- **Midtrans Dashboard:** Monitor transactions at dashboard.midtrans.com
- **Firebase Console:** Check voucher creation in Firestore

## Support

- Midtrans Documentation: https://docs.midtrans.com
- Vercel Documentation: https://vercel.com/docs
- Firebase Documentation: https://firebase.google.com/docs
