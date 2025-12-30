// Payment integration with Midtrans
import { generateVoucherCode, saveVoucher, packages } from './firebase';

// Type declarations for Midtrans Snap
declare global {
    interface Window {
        snap: {
            pay: (token: string, callbacks: {
                onSuccess?: (result: any) => void;
                onPending?: (result: any) => void;
                onError?: (result: any) => void;
                onClose?: () => void;
            }) => void;
        };
    }
}

// IMPORTANT: Replace with your actual Midtrans Client Key
const MIDTRANS_CLIENT_KEY = 'Mid-client-kW08Q23TYi0gFUHj';
const MIDTRANS_ENVIRONMENT = 'sandbox'; // Change to 'production' when ready

// Check if Midtrans Snap is loaded
function isMidtransLoaded() {
    return typeof window.snap !== 'undefined';
}

// Generate unique order ID
function generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `AHA-${timestamp}-${random}`;
}

// Initialize payment with Midtrans Snap
export async function initializePayment(packageType: string, customerInfo: any = {}) {
    if (!isMidtransLoaded()) {
        console.error('Midtrans Snap is not loaded');
        alert('Payment system is not ready. Please refresh the page and try again.');
        return;
    }

    const pkg = packages[packageType as keyof typeof packages];
    if (!pkg) {
        console.error('Invalid package type:', packageType);
        return;
    }

    const orderId = generateOrderId();

    // IMPORTANT: In production, this token should be generated from your backend
    // This is a demo implementation that will work in sandbox mode

    // For demo purposes, we'll use Midtrans Snap without backend
    // In production, you MUST create a backend API to generate the transaction token

    try {
        // Demo: Create payment directly (NOT SECURE for production)
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
                first_name: customerInfo.name || 'Sekolah',
                email: customerInfo.email || 'sekolah@example.com',
                phone: customerInfo.phone || '081234567890'
            }
        };

        console.log('Payment parameter:', parameter);

        // NOTE: For demo purposes, we'll simulate the payment
        // In production with proper backend, you would call:
        // const response = await fetch('/api/create-transaction', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ packageType, customerInfo })
        // });
        // const { token } = await response.json();

        // Demo: Show modal to get customer info first
        showCustomerInfoModal(packageType, parameter);

    } catch (error) {
        console.error('Error initializing payment:', error);
        alert('Terjadi kesalahan. Silakan coba lagi.');
    }
}

// Show customer info modal before payment
function showCustomerInfoModal(packageType: string, parameter: any) {
    const pkg = packages[packageType as keyof typeof packages];
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
    <div class="payment-form">
      <div class="package-summary">
        <h3>${pkg.name}</h3>
        <p>${pkg.description}</p>
        <div class="price-summary">
          <span>Total:</span>
          <strong>Rp ${pkg.price.toLocaleString('id-ID')}</strong>
        </div>
      </div>
      
      <form id="customerForm">
        <div class="form-group">
          <label>Nama Sekolah / Pembeli *</label>
          <input type="text" id="customerName" required placeholder="Contoh: SD Negeri 1 Jakarta">
        </div>
        
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="customerEmail" required placeholder="email@sekolah.com">
        </div>
        
        <div class="form-group">
          <label>Nomor HP/WhatsApp *</label>
          <input type="tel" id="customerPhone" required placeholder="081234567890">
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="cancelPayment">Batal</button>
          <button type="submit" class="btn btn-primary">Lanjut ke Pembayaran</button>
        </div>
      </form>
    </div>
  `;

    const modal = document.getElementById('paymentModal');
    modal.classList.add('active');

    // Handle form submission
    const form = document.getElementById('customerForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const customerInfo = {
            name: document.getElementById('customerName').value,
            email: document.getElementById('customerEmail').value,
            phone: document.getElementById('customerPhone').value
        };

        modal.classList.remove('active');

        // Update customer details in parameter
        parameter.customer_details = {
            first_name: customerInfo.name,
            email: customerInfo.email,
            phone: customerInfo.phone
        };

        // Process real payment with Midtrans
        processPayment(packageType, parameter, customerInfo);
    });

    // Handle cancel
    document.getElementById('cancelPayment').addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

// Process real payment with Midtrans
async function processPayment(packageType: string, _parameter: any, customerInfo: any) {
    try {
        // Show loading state
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;
        loadingDiv.innerHTML = '<div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;"><h3>Memproses pembayaran...</h3></div>';
        document.body.appendChild(loadingDiv);

        // Call backend API to get transaction token
        const apiUrl = import.meta.env.PROD
            ? '/api/create-transaction'
            : 'http://localhost:3000/api/create-transaction';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                packageType,
                customerInfo
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create transaction');
        }

        const { token, orderId } = await response.json();

        // Remove loading
        document.body.removeChild(loadingDiv);

        // Open Midtrans Snap popup
        (window).snap.pay(token, {
            onSuccess: function (result) {
                console.log('Payment success:', result);
                handlePaymentSuccess(packageType, orderId, customerInfo);
            },
            onPending: function (result) {
                console.log('Payment pending:', result);
                handlePaymentPending();
            },
            onError: function (result) {
                console.error('Payment error:', result);
                handlePaymentError(result);
            },
            onClose: function () {
                console.log('Payment popup closed');
                handlePaymentClose();
            }
        });

    } catch (error) {
        console.error('Error processing payment:', error);
        alert('Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.');
    }
}

// Handle successful payment
async function handlePaymentSuccess(packageType: string, orderId: string, customerInfo: any) {
    try {
        const pkg = packages[packageType as keyof typeof packages];
        const voucherCode = generateVoucherCode();

        // Save voucher to Firestore
        const voucherData = {
            code: voucherCode,
            package: packageType,
            packageName: pkg.name,
            price: pkg.price,
            accounts: pkg.accounts,
            orderId: orderId,
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone
        };

        await saveVoucher(voucherData);

        // Show success modal with voucher code
        showSuccessModal(voucherCode);

        // Send email notification (in production)
        // await sendVoucherEmail(customerInfo.email, voucherCode);

    } catch (error) {
        console.error('Error handling payment success:', error);
        alert('Pembayaran berhasil, tetapi terjadi kesalahan saat membuat voucher. Silakan hubungi support.');
    }
}

// Show success modal with voucher code
function showSuccessModal(voucherCode: string) {
    const voucherCodeElement = document.getElementById('voucherCode');
    voucherCodeElement.textContent = voucherCode;

    const successModal = document.getElementById('successModal');
    successModal.classList.add('active');

    // Handle close
    document.getElementById('closeSuccessModal').addEventListener('click', () => {
        successModal.classList.remove('active');

        // Copy to clipboard
        navigator.clipboard.writeText(voucherCode).then(() => {
            alert('Kode voucher telah disalin ke clipboard!');
        });
    });
}

// Handle payment pending
function handlePaymentPending() {
    alert('Pembayaran Anda sedang diproses. Kami akan mengirimkan kode voucher melalui email setelah pembayaran dikonfirmasi.');
}

// Handle payment error
function handlePaymentError(error: any) {
    console.error('Payment error:', error);
    alert('Pembayaran gagal. Silakan coba lagi.');
}

// Handle payment close (user closed the popup)
function handlePaymentClose() {
    console.log('Payment popup closed');
}

// Export functions
export {
    handlePaymentSuccess,
    handlePaymentPending,
    handlePaymentError,
    handlePaymentClose
};
