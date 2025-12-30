import './style.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

// User State
let currentUserData = null;
let currentClasses = [];

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User logged in:", user.uid);
            await loadUserData(user.uid);
            setupDashboard();
            loadView('home');
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/login.html';
        }
    });
});

async function loadUserData(uid) {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            updateSidebarProfile();

            // Check for Super Admin
            if (currentUserData.role === 'super_admin') {
                renderSuperAdminSidebar();
            }

            await fetchClasses();
        } else {
            console.error("No such user document!");
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

async function fetchClasses() {
    if (!currentUserData || !currentUserData.schoolName) return;

    // In Firestore, the user said: "data akan masuk ke firestore collection sekolah document (nama sekolah) field (nama kelas) - value 40"
    // So we need to fetch the document `sekolah/{schoolName}`
    try {
        const schoolDocRef = doc(db, 'sekolah', currentUserData.schoolName);
        const schoolSnap = await getDoc(schoolDocRef);

        currentClasses = [];
        if (schoolSnap.exists()) {
            const data = schoolSnap.data();
            // Iterate over keys to find classes (assuming keys are class names)
            // Note: The structure described was "field (nama kelas) - value 40". 
            // We need to distinguish class fields from other potential metadata fields.
            // For now, we assume all fields that are numbers or strings looking like capacity are classes.
            Object.keys(data).forEach(key => {
                if (key !== 'createdAt' && key !== 'updatedAt' && key !== 'schoolName') {
                    currentClasses.push({ name: key, capacity: data[key] });
                }
            });
        }
        updateClassCount();
    } catch (e) {
        console.error("Error fetching classes:", e);
    }
}

function updateSidebarProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = currentUserData.name || 'User';
    if (roleEl) roleEl.textContent = currentUserData.role || 'Admin';
    if (avatarEl && currentUserData.name) avatarEl.textContent = currentUserData.name.charAt(0).toUpperCase();
}

function setupDashboard() {
    // Navigation
    const navItems = document.querySelectorAll('.sidebar-nav li');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active to current
            item.classList.add('active');

            const view = item.getAttribute('data-view');
            loadView(view);
        });
    });

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = '/index.html';
        });
    }

    // Modal Close
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = (e.target as HTMLElement).closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    // Add Class Form
    const addClassForm = document.getElementById('addClassForm');
    if (addClassForm) {
        addClassForm.addEventListener('submit', handleAddClass);
    }

    // Add Student Form
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAddUser(e, 'child');
        });
    }

    // Add Teacher Form
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAddUser(e, 'teacher');
        });
    }

    // Add Parent Form
    const addParentForm = document.getElementById('addParentForm');
    if (addParentForm) {
        addParentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAddUser(e, 'parent');
        });
    }
}

function loadView(viewName) {
    const contentArea = document.getElementById('contentArea');
    const pageTitle = document.getElementById('pageTitle');
    if (!contentArea) return;

    if (pageTitle) pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    switch (viewName) {
        case 'home':
            renderHome(contentArea);
            break;
        case 'classes':
            renderClasses(contentArea);
            break;
        case 'students':
            renderUsers(contentArea, 'child');
            break;
        case 'teachers':
            renderUsers(contentArea, 'teacher');
            break;
        case 'parents':
            renderUsers(contentArea, 'parent');
            break;
        case 'monitoring':
            renderMonitoring(contentArea);
            break;
        // Super Admin Views
        case 'all_schools':
            renderAllSchools(contentArea);
            break;
        case 'all_classes':
            renderAllClasses(contentArea);
            break;
        case 'all_students':
            renderAllUsers(contentArea, 'child');
            break;
        case 'all_teachers':
            renderAllUsers(contentArea, 'teacher');
            break;
        case 'all_parents':
            renderAllUsers(contentArea, 'parent');
            break;
        default:
            renderHome(contentArea);
    }
}

// --- Render Functions ---

function renderHome(container) {
    const isClassesEmpty = currentClasses.length === 0;

    let html = `
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-icon icon-blue"><i class="fas fa-chalkboard"></i></div>
                <div class="stat-info">
                    <h3>${currentClasses.length}</h3>
                    <p>Total Kelas</p>
                </div>
            </div>
            <div class="stat-card">
                 <div class="stat-icon icon-green"><i class="fas fa-user-graduate"></i></div>
                <div class="stat-info">
                     <h3>-</h3>
                    <p>Total Siswa</p>
                </div>
            </div>
             <div class="stat-card">
                 <div class="stat-icon icon-purple"><i class="fas fa-check-circle"></i></div>
                <div class="stat-info">
                     <h3>${currentUserData?.status?.toUpperCase() || 'UNPAID'}</h3>
                    <p>Status Paket</p>
                </div>
            </div>
        </div>

        <div class="welcome-section">
            <h3>Selamat Datang, ${currentUserData?.name}!</h3>
            <p>Anda login sebagai Admin Sekolah: <strong>${currentUserData?.schoolName}</strong></p>
    `;

    if (isClassesEmpty) {
        html += `
            <div class="empty-state">
                <img src="/assets/icons/rajin_belajar.png" alt="Empty" style="width:100px; opacity:0.5; margin-bottom:1rem;">
                <p>Belum ada kelas yang dibuat.</p>
                <button class="btn btn-primary" onclick="window.openAddClassModal()">
                    <i class="fas fa-plus"></i> Tambah Kelas Pertama
                </button>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function renderClasses(container) {
    let html = `
        <div class="action-bar">
            <button class="btn btn-primary" onclick="window.openAddClassModal()">
                <i class="fas fa-plus"></i> Tambah Kelas
            </button>
        </div>
        <div class="grid-container">
    `;

    if (currentClasses.length === 0) {
        html += `<p class="no-data">Belum ada kelas.</p>`;
    } else {
        currentClasses.forEach(cls => {
            html += `
                <div class="card class-card">
                    <div class="card-header">
                        <h3>${cls.name}</h3>
                        <span class="badge badge-blue">${cls.capacity} Siswa</span>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-sm">Lihat Detail</button>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

async function renderUsers(container, role) {
    container.innerHTML = '<div class="loading">Memuat data...</div>';

    try {
        // Query Users by Role and School
        const q = query(
            collection(db, 'users'),
            where('role', '==', role),
            where('schoolName', '==', currentUserData.schoolName)
        );

        const querySnapshot = await getDocs(q);
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push(doc.data());
        });

        let html = `
            <div class="action-bar">
                <button class="btn btn-primary" onclick="window.openAddUserModal('${role}')">
                    <i class="fas fa-plus"></i> Tambah ${role === 'child' ? 'Siswa' : role === 'teacher' ? 'Guru' : 'Orang Tua'}
                </button>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nama</th>
                            <th>Email</th>
                            ${role === 'child' ? '<th>Kelas</th><th>NIS</th>' : ''}
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (users.length === 0) {
            html += `<tr><td colspan="5" class="text-center">Belum ada data ${role}.</td></tr>`;
        } else {
            users.forEach(user => {
                html += `
                    <tr>
                        <td>${user.name || '-'}</td>
                        <td>${user.email}</td>
                        ${role === 'child' ? `<td>${user.grade || '-'}</td><td>${user.nis || '-'}</td>` : ''}
                        <td><span class="badge badge-green">Aktif</span></td>
                        <td>
                            <button class="btn-icon"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (e) {
        console.error("Error fetching users:", e);
        container.innerHTML = `<p class="error">Gagal memuat data: ${e.message}</p>`;
    }
}

function renderMonitoring(container) {
    container.innerHTML = `
        <div class="monitoring-dashboard">
            <div class="monitoring-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div class="monitor-controls" style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" id="btnMonitorDaily" onclick="window.switchMonitorView('daily')">Harian</button>
                    <button class="btn btn-outline" id="btnMonitorMonthly" onclick="window.switchMonitorView('monthly')">Bulanan</button>
                </div>
                 <div class="monitoring-filters" style="display: flex; gap: 0.5rem;">
                    <select class="form-select" style="width: auto;">
                        <option>Semua Kelas</option>
                        ${currentClasses.map(c => `<option>${c.name}</option>`).join('')}
                    </select>
                    <input type="date" class="form-input" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px;" value="${new Date().toISOString().split('T')[0]}">
                </div>
            </div>

            <div id="monitoringContent">
                <!-- Content injected by switchMonitorView -->
            </div>
        </div>
    `;

    // Initialize with Daily view
    window.switchMonitorView('daily');
}

window.switchMonitorView = (viewType) => {
    const btnDaily = document.getElementById('btnMonitorDaily');
    const btnMonthly = document.getElementById('btnMonitorMonthly');
    const content = document.getElementById('monitoringContent');

    if (viewType === 'daily') {
        btnDaily.classList.replace('btn-outline', 'btn-primary');
        btnMonthly.classList.replace('btn-primary', 'btn-outline');

        // Render Daily Table
        content.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nama Siswa</th>
                            <th>Kelas</th>
                            <th>Capaian Hari Ini</th>
                            <th>Catatan</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Adit Sopo</td>
                            <td>Kelas 1A</td>
                            <td><span class="badge badge-green">5/7 Habit</span></td>
                            <td>Semangat belajar perlu ditingkatkan.</td>
                            <td><button class="btn-sm btn-outline">Lihat Rincian</button></td>
                        </tr>
                        <tr>
                            <td>Jarwo Kuat</td>
                            <td>Kelas 1B</td>
                            <td><span class="badge badge-blue">7/7 Habit</span></td>
                            <td>Sangat baik hari ini!</td>
                            <td><button class="btn-sm btn-outline">Lihat Rincian</button></td>
                        </tr>
                        <!-- Mock Data -->
                    </tbody>
                </table>
            </div>
        `;
    } else {
        btnDaily.classList.replace('btn-primary', 'btn-outline');
        btnMonthly.classList.replace('btn-outline', 'btn-primary');

        // Render Monthly Table
        // Generate days for current month
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        let headerDays = '';
        for (let i = 1; i <= daysInMonth; i++) {
            headerDays += `<th style="text-align: center; min-width: 30px;">${i}</th>`;
        }

        content.innerHTML = `
            <div class="table-container" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: #f8fafc; z-index: 10;">Nama Siswa</th>
                            ${headerDays}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="position: sticky; left: 0; background: white; font-weight: 500;">Adit Sopo</td>
                            ${Array.from({ length: daysInMonth }, (_, i) => {
            const score = Math.floor(Math.random() * 8); // 0-7
            const color = score >= 6 ? '#48bb78' : score >= 4 ? '#ecc94b' : '#f56565';
            return `<td style="text-align: center; color: ${color}; font-weight: bold; cursor: pointer;" title="Klik untuk detail">${score}/7</td>`;
        }).join('')}
                        </tr>
                         <tr>
                            <td style="position: sticky; left: 0; background: white; font-weight: 500;">Jarwo Kuat</td>
                            ${Array.from({ length: daysInMonth }, (_, i) => {
            const score = Math.floor(Math.random() * 8); // 0-7
            const color = score >= 6 ? '#48bb78' : score >= 4 ? '#ecc94b' : '#f56565';
            return `<td style="text-align: center; color: ${color}; font-weight: bold; cursor: pointer;" title="Klik untuk detail">${score}/7</td>`;
        }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }
};

// --- Super Admin Functions ---

function renderSuperAdminSidebar() {
    const navUl = document.querySelector('.sidebar-nav ul');
    if (!navUl) return;

    // Clear existing or append? Better to replace or append distinctive section.
    // Let's add a divider and new items.

    // Check if duplicate execution
    if (document.querySelector('.super-admin-divider')) return;

    navUl.innerHTML += `
        <li class="super-admin-divider" style="margin: 1rem 0; font-size: 0.8rem; font-weight: bold; padding-left: 1rem; color: #a0aec0;">SUPER ADMIN</li>
        <li data-view="all_schools"><a href="#"><i class="fas fa-university"></i> Semua Sekolah</a></li>
        <li data-view="all_classes"><a href="#"><i class="fas fa-layer-group"></i> Semua Kelas</a></li>
        <li data-view="all_students"><a href="#"><i class="fas fa-users"></i> Semua Siswa</a></li>
        <li data-view="all_teachers"><a href="#"><i class="fas fa-chalkboard-teacher"></i> Semua Guru</a></li>
        <li data-view="all_parents"><a href="#"><i class="fas fa-user-friends"></i> Semua Ortu</a></li>
    `;

    // Re-attach listeners to new items
    setupDashboard(); // Re-run to catch new items
}

async function renderAllSchools(container) {
    container.innerHTML = '<div class="loading">Memuat data semua sekolah...</div>';
    try {
        const snapshot = await getDocs(collection(db, 'sekolah'));
        let html = `
            <div class="action-bar">
                 <button class="btn btn-primary" onclick="alert('Fitur tambah sekolah via Super Admin belum diimplementasikan.')"><i class="fas fa-plus"></i> Tambah Sekolah</button>
            </div>
            <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nama Sekolah</th>
                        <th>Email Admin</th>
                        <th>Paket</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <tr>
                    <td>${data.schoolName || doc.id}</td>
                    <td>${data.adminEmail || '-'}</td>
                    <td><span class="badge badge-purple">${data.package || 'Free'}</span></td>
                    <td><span class="badge badge-green">Aktif</span></td>
                    <td>
                        <button class="btn-icon"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}

async function renderAllClasses(container) {
    // Similar to fetchClasses but iterate all school docs
    container.innerHTML = '<div class="loading">Memuat semua kelas...</div>';
    try {
        const snapshot = await getDocs(collection(db, 'sekolah'));
        let html = `
             <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nama Sekolah</th>
                        <th>Kelas</th>
                        <th>Kapasitas</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snapshot.forEach(doc => {
            const data = doc.data();
            const schoolName = data.schoolName || doc.id;
            Object.keys(data).forEach(key => {
                if (key !== 'createdAt' && key !== 'updatedAt' && key !== 'schoolName' && key !== 'adminEmail' && key !== 'package') {
                    html += `
                        <tr>
                            <td>${schoolName}</td>
                            <td>${key}</td>
                            <td>${data[key]}</td>
                            <td><button class="btn-icon"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `;
                }
            });
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}

async function renderAllUsers(container, role) {
    container.innerHTML = `<div class="loading">Memuat semua data ${role}...</div>`;
    try {
        // Query all users with this role
        const q = query(collection(db, 'users'), where('role', '==', role));
        const snapshot = await getDocs(q);

        let html = `
            <div class="action-bar">
                 <button class="btn btn-primary" onclick="alert('Gunakan menu Admin Sekolah untuk tambah user spesifik.')"><i class="fas fa-plus"></i> Tambah Manual</button>
            </div>
             <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                         <th>Nama</th>
                        <th>Sekolah</th>
                        <th>Email</th>
                         <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snapshot.forEach(doc => {
            const u = doc.data();
            html += `
                <tr>
                    <td>${u.name}</td>
                    <td>${u.schoolName}</td>
                     <td>${u.email}</td>
                     <td>
                        <button class="btn-icon"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}

// --- Logic Functions ---

function updateClassCount() {
    // Determine limit
    let limit = 0;
    const pkg = currentUserData.package;
    if (pkg === 'siswa') limit = 0; // Or 1? Req said "individu - 1 kelas value 1"
    else if (pkg === 'kelas') limit = 1;
    else if (pkg === 'angkatan') limit = 15;
    else if (pkg === 'sekolah') limit = 45;
    else limit = 1; // Default

    // If custom, verify topup (not implemented yet, default logic)

    return limit;
}

window.openAddClassModal = () => {
    const modal = document.getElementById('addClassModal');
    const schoolInput = document.getElementById('schoolNameInput') as HTMLInputElement;
    const capacityDisplay = document.getElementById('classCapacityDisplay');

    if (modal && schoolInput) {
        schoolInput.value = currentUserData.schoolName;

        // Determine capacity based on package
        let cap = 40;
        if (currentUserData.package === 'siswa') cap = 1;

        if (capacityDisplay) capacityDisplay.textContent = `${cap} Siswa`;

        modal.classList.add('active');
    }
};

async function handleAddClass(e) {
    e.preventDefault();

    const classNameInput = document.getElementById('classNameInput') as HTMLInputElement;
    const className = classNameInput.value;

    if (!className) return;

    // Check limit
    const limit = updateClassCount();
    if (currentClasses.length >= limit) {
        alert(`Batas maksimum kelas tercapai untuk paket ${currentUserData.package} (${limit} kelas).`);
        return;
    }

    try {
        // Save to Firestore: sekolah/{schoolName} -> field {className}: capacity
        let capacity = 40;
        if (currentUserData.package === 'siswa') capacity = 1;

        const schoolDocRef = doc(db, 'sekolah', currentUserData.schoolName);

        // Use setDoc with merge to add a field to the document
        await setDoc(schoolDocRef, {
            [className]: capacity,
            updatedAt: serverTimestamp()
        }, { merge: true });

        alert('Kelas berhasil ditambahkan!');
        document.getElementById('addClassModal')?.classList.remove('active');
        classNameInput.value = '';

        // Refresh classes
        await fetchClasses();
        loadView('classes'); // Switch to classes view to see result

    } catch (e) {
        console.error("Error adding class:", e);
        alert('Gagal menambahkan kelas: ' + e.message);
    }
}

// --- Add User Functions ---

window.openAddUserModal = (role) => {
    let modalId = '';
    if (role === 'child') modalId = 'addStudentModal';
    else if (role === 'teacher') modalId = 'addTeacherModal';
    else if (role === 'parent') modalId = 'addParentModal';

    const modal = document.getElementById(modalId);
    if (modal) {
        // Populate Class Selects if applicable
        if (role === 'child' || role === 'teacher') {
            const selectId = role === 'child' ? 'studentClassSelect' : 'teacherClassSelect';
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = role === 'teacher' ? '<option value="">Bukan Wali Kelas</option>' : '<option value="">Pilih Kelas</option>';
                currentClasses.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = c.name;
                    select.appendChild(opt);
                });
            }
        }
        modal.classList.add('active');
    }
};

async function handleAddUser(e, role) {
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    try {
        let userData: any = {
            role: role,
            schoolName: currentUserData.schoolName, // All added users belong to this school
            createdAt: serverTimestamp(),
            status: 'active'
        };

        let modalId = '';
        let email = ''; // Must define
        let passwordCode = Math.floor(Math.random() * 900000 + 100000).toString(); // Simple generated password

        if (role === 'child') {
            modalId = 'addStudentModal';
            email = (document.getElementById('studentEmail') as HTMLInputElement).value || `siswa.${Date.now()}@anakhebat.id`;
            userData = {
                ...userData,
                name: (document.getElementById('studentName') as HTMLInputElement).value,
                email: email,
                nis: (document.getElementById('studentNis') as HTMLInputElement).value,
                grade: (document.getElementById('studentClassSelect') as HTMLInputElement).value,
                parentEmail: (document.getElementById('studentParentEmail') as HTMLInputElement).value,
                passwordCode: passwordCode
            };
        } else if (role === 'teacher') {
            modalId = 'addTeacherModal';
            email = (document.getElementById('teacherEmail') as HTMLInputElement).value;
            userData = {
                ...userData,
                name: (document.getElementById('teacherName') as HTMLInputElement).value,
                email: email,
                nip: (document.getElementById('teacherNip') as HTMLInputElement).value,
                classGuardian: (document.getElementById('teacherClassSelect') as HTMLInputElement).value,
                passwordCode: passwordCode
            };
        } else if (role === 'parent') {
            modalId = 'addParentModal';
            email = (document.getElementById('parentEmail') as HTMLInputElement).value;
            userData = {
                ...userData,
                name: (document.getElementById('parentName') as HTMLInputElement).value,
                email: email,
                phone: (document.getElementById('parentPhone') as HTMLInputElement).value,
                childNis: (document.getElementById('parentChildNis') as HTMLInputElement).value,
                passwordCode: passwordCode
            };
        }

        // NOTE: In a real app we would use Admin SDK to create Auth users. 
        // Since we are client-side only here, we'll creating the Firestore data directly.
        // We cannot create a Firebase Auth user for another person from client side without logging out.
        // For this demo/MVP, adding to Firestore is what displays them in the table.
        // The user would technically need to "Sign Up" themselves or we use a secondary app to create them.
        // OR we use a temporary "INVITE" sytem.
        // For simplicity: We just save to Firestore 'users' collection with a generated ID.
        // They won't be able to login unless they register with this email or we use createAuth (server side).

        // Simulating ID
        const fakeUid = role + '_' + Date.now();
        await setDoc(doc(db, 'users', fakeUid), userData);

        alert(`${role === 'child' ? 'Siswa' : role === 'teacher' ? 'Guru' : 'Orang Tua'} berhasil ditambahkan!`);
        document.getElementById(modalId)?.classList.remove('active');
        e.target.reset();

        // Refresh
        if (role === 'child') loadView('students');
        else if (role === 'teacher') loadView('teachers');
        else if (role === 'parent') loadView('parents');

    } catch (error) {
        console.error(`Error adding ${role}:`, error);
        alert(`Gagal menambahkan: ${error.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- Styles Injection ---
// Adding specific Dashboard CSS to styling
const style = document.createElement('style');
style.textContent = `
    /* Dashboard Specific Styles */
    .dashboard-body {
        background-color: #f7fafc;
        height: 100vh;
        overflow: hidden;
    }

    .dashboard-container {
        display: flex;
        height: 100%;
    }

    /* Sidebar */
    .sidebar {
        width: 260px;
        background: white;
        border-right: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        padding: 1.5rem;
        transition: transform 0.3s;
    }

    .sidebar-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 2rem;
    }

    .sidebar-logo {
        width: 40px;
        height: 40px;
        border-radius: 8px;
    }

    .sidebar-brand {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--primary-color, #FF6B6B);
    }

    .user-profile-mini {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        background: #f8fafc;
        border-radius: 12px;
        margin-bottom: 2rem;
    }

    .avatar {
        width: 40px;
        height: 40px;
        background: var(--gradient-primary, linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 1.2rem;
    }

    .user-info h4 {
        font-size: 0.9rem;
        margin: 0;
        color: #2d3748;
    }

    .user-info span {
        font-size: 0.75rem;
        color: #718096;
    }

    .sidebar-nav ul {
        list-style: none;
        padding: 0;
    }

    .sidebar-nav li {
        margin-bottom: 0.5rem;
    }

    .sidebar-nav a {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.875rem 1rem;
        color: #718096;
        text-decoration: none;
        border-radius: 10px;
        transition: all 0.2s;
        font-weight: 500;
    }

    .sidebar-nav li.active a,
    .sidebar-nav a:hover {
        background: #fff5f5;
        color: var(--primary-color, #FF6B6B);
    }

    .sidebar-footer {
        margin-top: auto;
    }

    .btn-logout {
        width: 100%;
        padding: 0.75rem;
        background: transparent;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        color: #718096;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: all 0.2s;
    }

    .btn-logout:hover {
        background: #edf2f7;
        color: #2d3748;
    }

    /* Main Content */
    .main-content {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .topbar {
        background: white;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .topbar h2 {
        font-size: 1.5rem;
        color: #2d3748;
    }

    .content-area {
        padding: 2rem;
        flex: 1;
    }

    /* Stats */
    .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .stat-card {
        background: white;
        padding: 1.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
    }

    .icon-blue { background: #EBF8FF; color: #4299E1; }
    .icon-green { background: #F0FFF4; color: #48BB78; }
    .icon-purple { background: #FAF5FF; color: #9F7AEA; }

    .stat-info h3 {
        font-size: 1.5rem;
        margin: 0;
        color: #2d3748;
    }

    .stat-info p {
        margin: 0;
        color: #718096;
        font-size: 0.9rem;
    }

    /* Welcome */
    .welcome-section {
        background: white;
        padding: 2rem;
        border-radius: 16px;
        margin-bottom: 2rem;
    }

    /* Empty State */
    .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        background: #fff;
        border-radius: 16px;
        border: 2px dashed #e2e8f0;
        margin-top: 2rem;
    }

    /* Grid & Cards */
    .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-top: 1.5rem;
    }

    .card {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        border: 1px solid #edf2f7;
    }

    /* Tables */
    .table-container {
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
    }

    .data-table th, .data-table td {
        padding: 1rem 1.5rem;
        text-align: left;
        border-bottom: 1px solid #edf2f7;
    }

    .data-table th {
        background: #f8fafc;
        font-weight: 600;
        color: #4a5568;
    }

    .badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .badge-blue { background: #ebf8ff; color: #4299e1; }
    .badge-green { background: #f0fff4; color: #48bb78; }

    /* Forms */
    .input-disabled {
        background-color: #f7fafc;
        color: #718096;
    }

    .form-info {
        margin-bottom: 1.5rem;
        padding: 0.75rem;
        background: #ebf8ff;
        border-radius: 8px;
        color: #2b6cb0;
        font-size: 0.9rem;
    }

    .form-select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background-color: white;
        font-family: inherit;
        font-size: 1rem;
        color: #4a5568;
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 0.5rem center;
        background-repeat: no-repeat;
        background-size: 1.5em 1.5em;
    }

    .btn-outline {
        background: transparent;
        border: 1px solid #cbd5e0;
        color: #4a5568;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 500;
        transition: all 0.2s;
        cursor: pointer;
    }

    .btn-outline:hover {
        background: #f7fafc;
        border-color: #a0aec0;
        color: #2d3748;
    }

    .btn-sm {
        font-size: 0.875rem;
        padding: 0.4rem 0.8rem;
    }
`;
document.head.appendChild(style);
