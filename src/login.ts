import './style.css';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm') as HTMLFormElement;

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnLogin = document.getElementById('btnLogin') as HTMLButtonElement;
            const emailInput = document.getElementById('email') as HTMLInputElement;
            const passwordInput = document.getElementById('password') as HTMLInputElement;

            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.textContent = 'Memproses...';
            }

            try {
                const email = emailInput.value;
                const password = passwordInput.value;

                await signInWithEmailAndPassword(auth, email, password);

                // Redirect to dashboard on success
                window.location.href = '/dashboard.html';

            } catch (error) {
                console.error('Login Error:', error);
                alert('Gagal masuk. Periksa kembali email dan kode akses Anda.');
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.textContent = 'Masuk';
                }
            }
        });
    }
});

// Add specific styles for login page
const style = document.createElement('style');
style.textContent = `
    body {
        background: linear-gradient(135deg, #f6f8fb 0%, #e2e8f0 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .login-container {
        padding: 2rem;
        width: 100%;
        max-width: 480px;
    }
    
    .login-card {
        background: white;
        padding: 2.5rem;
        border-radius: 24px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        animation: fadeInUp 0.5s ease-out;
    }
    
    .login-header {
        text-align: center;
        margin-bottom: 2rem;
    }
    
    .login-logo {
        width: 80px;
        height: 80px;
        border-radius: 16px;
        margin-bottom: 1rem;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    
    .login-header h1 {
        font-size: 1.75rem;
        color: #1a1a2e;
        margin-bottom: 0.5rem;
    }
    
    .login-header p {
        color: #718096;
        font-size: 0.95rem;
    }
    
    .form-group {
        margin-bottom: 1.5rem;
    }
    
    .form-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #2d3748;
    }
    
    .form-group input {
        width: 100%;
        padding: 0.875rem 1rem;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        font-size: 1rem;
        font-family: 'Outfit', sans-serif;
        transition: all 0.2s;
    }
    
    .form-group input:focus {
        outline: none;
        border-color: #FF6B6B;
        box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.1);
    }
    
    .btn-block {
        width: 100%;
        padding: 1rem;
        border-radius: 12px;
        font-size: 1rem;
    }
    
    .login-footer {
        text-align: center;
        margin-top: 1.5rem;
    }
    
    .forgot-link {
        color: #718096;
        text-decoration: none;
        font-size: 0.9rem;
        transition: color 0.2s;
    }
    
    .forgot-link:hover {
        color: #FF6B6B;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
