// Main application script
import './style.css';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Mobile menu toggle
  setupMobileMenu();

  // Smooth scroll for navigation
  setupSmoothScroll();

  // CTA button - scroll to pricing
  setupCTAButton();

  // Pricing package selection
  setupPricingButtons();

  // Modal close handlers
  setupModals();

  // Scroll animations
  setupScrollAnimations();

  // Navbar scroll effect
  setupNavbarScroll();

  // Registration Form Handler
  setupRegistrationForm();

  // Copy Buttons
  setupCopyButtons();
}

// Mobile menu toggle
function setupMobileMenu() {
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
    });

    // Close menu when clicking on a link
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
      });
    });
  }
}

// Smooth scroll for navigation links
function setupSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;

      e.preventDefault();
      const target = document.querySelector(href);

      if (target) {
        const offsetTop = target.offsetTop - 80; // Account for fixed navbar
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });
}

// CTA button - scroll to pricing section
function setupCTAButton() {
  const ctaButton = document.getElementById('ctaButton');

  if (ctaButton) {
    ctaButton.addEventListener('click', () => {
      const pricingSection = document.getElementById('pricing');
      if (pricingSection) {
        const offsetTop = pricingSection.offsetTop - 80;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });

        // Add pulse animation to pricing cards
        setTimeout(() => {
          const pricingCards = document.querySelectorAll('.pricing-card');
          pricingCards.forEach((card, index) => {
            setTimeout(() => {
              card.style.animation = 'bounceIn 0.5s ease-out';
            }, index * 100);
          });
        }, 500);
      }
    });
  }
}

// Pricing package selection
function setupPricingButtons() {
  const pricingButtons = document.querySelectorAll('.btn-pricing');

  pricingButtons.forEach(button => {
    button.addEventListener('click', () => {
      const packageType = button.getAttribute('data-package');
      const price = button.getAttribute('data-price');
      // const accounts = button.getAttribute('data-accounts'); // Not used right now but useful context

      console.log('Selected package:', packageType, price);
      openRegistrationModal(packageType, price);
    });
  });
}

function openRegistrationModal(packageType, price) {
  const modal = document.getElementById('registrationModal');
  const packageNameEl = document.getElementById('regPackageName');
  const packageTypeInput = document.getElementById('regPackageType') as HTMLInputElement;
  const packagePriceInput = document.getElementById('regPackagePrice') as HTMLInputElement;

  if (modal && packageNameEl && packageTypeInput && packagePriceInput) {
    packageNameEl.textContent = packageType.toUpperCase();
    packageTypeInput.value = packageType;
    packagePriceInput.value = price;
    modal.classList.add('active');
  }
}

// Modal handlers
function setupModals() {
  // Generic close handlers
  document.querySelectorAll('.modal-close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      const modal = (e.target as HTMLElement).closest('.modal');
      if (modal) modal.classList.remove('active');
    });
  });

  // Close on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

function setupRegistrationForm() {
  const form = document.getElementById('registrationForm') as HTMLFormElement;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitReg') as HTMLButtonElement;
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Memproses...';
    }

    try {
      const formData = new FormData(form);
      const email = formData.get('email') as string;
      const name = formData.get('name') as string;
      const school = formData.get('school') as string;
      const packageType = formData.get('packageType') as string;
      const price = formData.get('packagePrice') as string;

      // 1. Generate 8 digit code
      const password = generateRandomPassword();
      console.log("Generated Password (hidden):", password);

      // 2. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Determine max classes based on package
      let maxClasses = 1;
      if (packageType === 'kelas') maxClasses = 1;
      else if (packageType === 'angkatan') maxClasses = 15;
      else if (packageType === 'sekolah') maxClasses = 45;

      // 4. Save to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: email,
        name: name,
        schoolName: school,
        role: 'school_admin', // Assigning admin role for the registrant
        package: packageType,
        packagePrice: parseInt(price),
        status: 'unpaid',
        passwordCode: password, // Storing purely for reference if needed (security tradeoff acknowledged as per user request)
        maxClasses: maxClasses,
        createdAt: new Date()
      });

      // 5. Close Reg Modal & Open Payment Modal
      document.getElementById('registrationModal')?.classList.remove('active');
      const paymentModal = document.getElementById('paymentModal');
      if (paymentModal) {
        paymentModal.classList.add('active');

        // Update WA Button Link
        const btnConfirmWA = document.getElementById('btnConfirmWA') as HTMLAnchorElement;
        if (btnConfirmWA) {
          const message = `Halo, saya sudah melakukan pembayaran paket *${packageType.toUpperCase()}* sebesar *Rp ${parseInt(price).toLocaleString('id-ID')}*.\n\nNama: ${name}\nSekolah: ${school}\nEmail: ${email}`;
          btnConfirmWA.href = `https://wa.me/6289668379034?text=${encodeURIComponent(message)}`;
        }
      }

    } catch (error) {
      console.error('Registration Error:', error);
      alert('Terjadi kesalahan saat mendaftar: ' + error.message);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Lanjut ke Pembayaran';
      }
    }
  });
}

function generateRandomPassword() {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function setupCopyButtons() {
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const text = target.getAttribute('data-copy');
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          const originalText = target.textContent;
          const originalHTML = target.innerHTML;
          target.innerHTML = '✓ Tersalin!';
          target.style.background = 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)';
          setTimeout(() => {
            target.innerHTML = originalHTML;
            target.style.background = '';
          }, 2000);
        });
      }
    });
  });
}


// Scroll animations - fade in on scroll
function setupScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements
  const animatedElements = document.querySelectorAll(`
    .feature-card,
    .gallery-item,
    .testimonial-card,
    .pricing-card
  `);

  animatedElements.forEach((el, index) => {
    const element = el as HTMLElement;
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    element.style.transition = `all 0.6s ease-out ${index * 0.1}s`;
    observer.observe(element);
  });
}

// Navbar scroll effect
function setupNavbarScroll() {
  const navbar = document.querySelector('.navbar') as HTMLElement;
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      navbar.style.boxShadow = 'var(--shadow-md)';
    } else {
      navbar.style.boxShadow = 'var(--shadow-sm)';
    }
  });
}

console.log('Anak Hebat Landing Page initialized');
