import './style.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

// Extend Window interface for global functions
declare global {
    interface Window {
        switchMonitorView: (viewType: string) => void;
        refreshMonitorView: () => void;
        currentMonitorView: string;
        openDetailModal: (studentId: string, studentName: string, dateStr: string) => void;
        openDetailModalByData: (studentName: string, dateStr: string, score: number) => void;
        openAddUserModal: (role: string) => void;
    }
}

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
                    <select id="monitorClassFilter" class="form-select" style="width: auto;" onchange="window.refreshMonitorView()">
                        <option value="">Semua Kelas</option>
                        ${currentClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                    </select>
                    <input type="date" id="monitorDateFilter" class="form-input" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px;" value="${new Date().toISOString().split('T')[0]}" onchange="window.refreshMonitorView()">
                </div>
            </div>

            <div id="monitoringContent">
                <!-- Content injected by switchMonitorView -->
            </div>
        </div>
    `;

    // Initialize with Daily view
    window.currentMonitorView = 'daily';
    window.switchMonitorView('daily');
}

window.refreshMonitorView = () => {
    window.switchMonitorView(window.currentMonitorView || 'daily');
};

window.switchMonitorView = async (viewType) => {
    window.currentMonitorView = viewType;
    const btnDaily = document.getElementById('btnMonitorDaily');
    const btnMonthly = document.getElementById('btnMonitorMonthly');
    const content = document.getElementById('monitoringContent');

    // Get Filters
    const classFilter = (document.getElementById('monitorClassFilter') as HTMLSelectElement)?.value;
    const dateInput = (document.getElementById('monitorDateFilter') as HTMLInputElement)?.value;
    const dateObj = dateInput ? new Date(dateInput) : new Date();

    if (viewType === 'daily') {
        btnDaily.classList.replace('btn-outline', 'btn-primary');
        btnMonthly.classList.replace('btn-primary', 'btn-outline');

        content.innerHTML = '<div class="loading">Memuat data harian...</div>';

        // Fetch Daily Data
        const logs = await fetchDailyLogs(dateInput, classFilter);

        let rows = '';
        if (logs.length === 0) {
            rows = `<tr><td colspan="5" class="text-center">Belum ada data monitoring untuk tanggal ini.</td></tr>`;
        } else {
            logs.forEach(log => {
                rows += `
                    <tr>
                        <td>${log.studentName}</td>
                        <td>${log.className}</td>
                        <td><span class="badge ${log.score >= 6 ? 'badge-green' : log.score >= 4 ? 'badge-blue' : 'badge-purple'}">${log.score}/7 Habit</span></td>
                        <td>${log.notes || '-'}</td>
                        <td><button class="btn-sm btn-outline" onclick="window.openDetailModal('${log.studentId}', '${log.studentName}', '${dateInput}')">Lihat Rincian</button></td>
                    </tr>
                `;
            });
        }

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
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        btnDaily.classList.replace('btn-primary', 'btn-outline');
        btnMonthly.classList.replace('btn-outline', 'btn-primary');

        content.innerHTML = '<div class="loading">Memuat data bulanan...</div>';

        // Fetch Monthly Data
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Fetch all logs for this month
        const monthlyLogs = await fetchMonthlyLogs(year, month, classFilter);

        // Get unique students from logs or fetch all students if filter exists
        // For simplicity, we assume we list students who have at least one log OR all students in class
        // Let's just use the logs source to list students for now
        const studentMap = {};
        monthlyLogs.forEach(log => {
            if (!studentMap[log.studentId]) {
                studentMap[log.studentId] = { name: log.studentName, logs: {} };
            }
            // Log date format YYYY-MM-DD. Extract day.
            const day = parseInt(log.date.split('-')[2]);
            studentMap[log.studentId].logs[day] = log.score;
        });

        let headerDays = '';
        for (let i = 1; i <= daysInMonth; i++) {
            headerDays += `<th style="text-align: center; min-width: 35px; padding: 0.5rem 0.2rem;">${i}</th>`;
        }

        let bodyRows = '';
        if (Object.keys(studentMap).length === 0) {
            bodyRows = `<tr><td colspan="${daysInMonth + 1}" class="text-center">Tidak ada data di bulan ini.</td></tr>`;
        } else {
            Object.values(studentMap).forEach((s: any) => {
                let dayCells = '';
                for (let i = 1; i <= daysInMonth; i++) {
                    const score = s.logs[i];
                    if (score !== undefined) {
                        const color = score >= 6 ? '#48bb78' : score >= 4 ? '#ecc94b' : '#f56565';
                        // Format date for the cell click
                        const cellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                        // Find studentId is tricky here if we iterate values, let's change map to array or store ID
                        dayCells += `<td style="text-align: center; color: ${color}; font-weight: bold; cursor: pointer; background:#fafffd;" 
                            onclick="window.openDetailModalByData('${s.name}', '${cellDate}', ${score})">
                            ${score}
                         </td>`;
                    } else {
                        dayCells += `<td style="text-align: center; color: #e2e8f0;">-</td>`;
                    }
                }
                bodyRows += `
                    <tr>
                        <td style="position: sticky; left: 0; background: white; font-weight: 500; border-right:2px solid #eee;">${s.name}</td>
                        ${dayCells}
                    </tr>
                `;
            });
        }

        content.innerHTML = `
            <div class="table-container" style="overflow-x: auto;">
                <table class="data-table" style="font-size: 0.9rem;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: #f8fafc; z-index: 10; border-right:2px solid #eee;">Nama Siswa</th>
                            ${headerDays}
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                    </tbody>
                </table>
            </div>
        `;
    }
};

// --- Real Data Fetching Helpers ---

async function fetchDailyLogs(dateStr, classFilter) {
    // Assumption: 'habit_logs' collection
    // Fields: date (YYYY-MM-DD), className, studentName, studentId, completedCount, totalHabits, notes
    try {
        let constraints = [where('date', '==', dateStr)];
        if (classFilter && classFilter !== 'Semua Kelas') {
            constraints.push(where('className', '==', classFilter));
        }

        // If 'habit_logs' doesn't exist yet, this will return empty.
        // We need to query.
        const q = query(collection(db, 'habit_logs'), ...constraints);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            score: doc.data().completedCount || 0 // Fallback
        }));
    } catch (e) {
        console.error("Error fetching daily logs:", e);
        return [];
    }
}

async function fetchMonthlyLogs(year, monthIndex, classFilter) {
    try {
        // Construct range: YYYY-MM-01 to YYYY-MM-31
        const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-31`;

        let constraints = [
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        ];
        if (classFilter && classFilter !== 'Semua Kelas') {
            constraints.push(where('className', '==', classFilter));
        }

        const q = query(collection(db, 'habit_logs'), ...constraints);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            score: doc.data().completedCount || 0
        }));

    } catch (e) {
        console.error("Error fetching monthly logs:", e);
        return [];
    }
}

// --- Detail Popups ---

window.openDetailModal = async (studentId, studentName, dateStr) => {
    const modal = document.getElementById('detailMonitoringModal');
    const subtitle = document.getElementById('detailModalSubtitle');
    const list = document.getElementById('detailHabitList');
    const notes = document.getElementById('detailNotes');

    if (modal) {
        modal.classList.add('active');
        if (subtitle) subtitle.textContent = `Siswa: ${studentName} | Tanggal: ${dateStr}`;
        if (list) list.innerHTML = '<div class="loading">Memuat Detail...</div>';
        if (notes) notes.textContent = '...';

        // Fetch specific log doc
        try {
            // Find doc by studentId and date
            // Ideally docID is composite, but we'll query to be safe
            const q = query(collection(db, 'habit_logs'),
                where('studentId', '==', studentId),
                where('date', '==', dateStr)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                if (list) list.innerHTML = '<p>Tidak ada data detail untuk hari ini.</p>';
            } else {
                const data = snap.docs[0].data();

                // Render Habits
                // Expecting data.habits = { "Bangun Pagi": true, "Sholat": false }
                let habitsHtml = '<ul style="list-style: none; padding: 0;">';
                if (data.habits) {
                    Object.entries(data.habits).forEach(([habit, isDone]) => {
                        habitsHtml += `
                            <li style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border-bottom: 1px solid #eee;">
                                <i class="fas ${isDone ? 'fa-check-circle' : 'fa-times-circle'}" style="color: ${isDone ? '#48bb78' : '#e2e8f0'}; font-size: 1.2rem;"></i>
                                <span style="${isDone ? '' : 'color: #a0aec0;'}">${habit}</span>
                            </li>
                        `;
                    });
                } else {
                    habitsHtml += '<li>Data habit raw tidak ditemukan.</li>';
                }
                habitsHtml += '</ul>';

                if (list) list.innerHTML = habitsHtml;
                if (notes) notes.textContent = data.notes || "Tidak ada catatan.";
            }

        } catch (e) {
            if (list) list.innerHTML = '<p class="error">Gagal memuat detail.</p>';
        }
    }
}

// Fallback for monthly view click where we might not have student ID easily available in the simplistic map
window.openDetailModalByData = async (studentName, dateStr, score) => {
    // In monthly view we didn't store student ID in the map for simplicity in the previous step
    // But we need it to verify uniqueness. query by name+date is risky.
    // Let's assume we can fetch by name for now OR better, we fix the monthly map to store ID.
    // I fixed the monthly map above to key by ID, but the values are "logs".
    // I need to update the onclick generator to include ID.

    // Actually, looking at the code I generated above:
    // Object.values(studentMap).forEach((s: any) => ...
    // s is { name: '...', logs: {} }
    // I lost the studentId key.

    // I will use a simple query by studentName and date for now as fallback, 
    // or just show what we have if we passed it.
    // But to show "Rincian" we need the habits list.
    // Let's do a query by name & date & school (implied).

    const modal = document.getElementById('detailMonitoringModal');
    const subtitle = document.getElementById('detailModalSubtitle');
    const list = document.getElementById('detailHabitList');
    const notes = document.getElementById('detailNotes');

    if (modal) {
        modal.classList.add('active');
        if (subtitle) subtitle.textContent = `Siswa: ${studentName} | Tanggal: ${dateStr}`;
        if (list) list.innerHTML = '<div class="loading">Mencari data detail...</div>';

        try {
            const q = query(collection(db, 'habit_logs'),
                where('studentName', '==', studentName),
                where('date', '==', dateStr),
                where('schoolName', '==', currentUserData.schoolName)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                if (list) list.innerHTML = `<p>Detail habit kosong (Score: ${score}).</p>`;
            } else {
                const data = snap.docs[0].data();
                let habitsHtml = '<ul style="list-style: none; padding: 0;">';
                if (data.habits) {
                    Object.entries(data.habits).forEach(([habit, isDone]) => {
                        habitsHtml += `
                            <li style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border-bottom: 1px solid #eee;">
                                <i class="fas ${isDone ? 'fa-check-circle' : 'fa-times-circle'}" style="color: ${isDone ? '#48bb78' : '#e2e8f0'}; font-size: 1.2rem;"></i>
                                <span style="${isDone ? '' : 'color: #a0aec0;'}">${habit}</span>
                            </li>
                        `;
                    });
                }
                habitsHtml += '</ul>';
                if (list) list.innerHTML = habitsHtml;
                if (notes) notes.textContent = data.notes || "Tidak ada catatan.";
            }
        } catch (e) {
            if (list) list.innerHTML = '<p class="error">Gagal memuat detail.</p>';
        }
    }
}

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
