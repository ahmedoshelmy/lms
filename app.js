/**
 * Inite LMS Frontend Application Logic
 */

// Global State
const state = {
    apiUrl: localStorage.getItem('lms_api_url') || 'https://mv-api.inite.tech/api',
    users: [],
    courses: [],
    currentTab: 'overview',
    searchQuery: ''
};

// DOM Elements
const elements = {
    // Nav Items
    navItems: document.querySelectorAll('.nav-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    
    // Status Indicators
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    apiConfigBtn: document.getElementById('api-config-btn'),
    
    // Search
    globalSearch: document.getElementById('global-search'),
    
    // API Modal Elements
    apiModal: document.getElementById('api-modal'),
    apiUrlInput: document.getElementById('api-url-input'),
    saveApiConfigBtn: document.getElementById('save-api-config'),
    
    // Create Course Modal & Form
    courseModal: document.getElementById('course-modal'),
    openCourseModalBtn: document.getElementById('open-create-course-modal'),
    createCourseForm: document.getElementById('create-course-form'),
    courseTitle: document.getElementById('course-title'),
    courseDesc: document.getElementById('course-desc'),
    courseInstructor: document.getElementById('course-instructor'),
    
    // Create User Modal & Form
    userModal: document.getElementById('user-modal'),
    openUserModalBtn: document.getElementById('open-create-user-modal'),
    createUserForm: document.getElementById('create-user-form'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    userRole: document.getElementById('user-role'),
    
    // Quick Enroll Form
    quickEnrollForm: document.getElementById('quick-enroll-form'),
    enrollCourseSelect: document.getElementById('enroll-course-select'),
    enrollStudentSelect: document.getElementById('enroll-student-select'),
    
    // Overview Tab Displays
    statCoursesCount: document.getElementById('stat-courses-count'),
    statStudentsCount: document.getElementById('stat-students-count'),
    statInstructorsCount: document.getElementById('stat-instructors-count'),
    statEnrollmentsCount: document.getElementById('stat-enrollments-count'),
    recentCoursesList: document.getElementById('recent-courses-list'),
    refreshOverviewBtn: document.getElementById('refresh-overview'),
    
    // Courses Tab Displays
    coursesGridContainer: document.getElementById('courses-grid-container'),
    
    // Users Tab Displays
    instructorCountLabel: document.getElementById('instructor-count-label'),
    studentCountLabel: document.getElementById('student-count-label'),
    instructorsList: document.getElementById('instructors-list'),
    studentsList: document.getElementById('students-list'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-solid fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-message">${message}</div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// API Interaction Utilities
// ==========================================================================
async function apiFetch(endpoint, options = {}) {
    const url = `${state.apiUrl}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            let errorMsg = `HTTP Error ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson.message) errorMsg = errJson.message;
            } catch (e) {
                // Ignore json parse error and keep status string
            }
            throw new Error(errorMsg);
        }
        
        // Return null or text for empty/204 responses, otherwise json
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return await response.text();
    } catch (error) {
        console.error(`API Call failed on ${url}:`, error);
        throw error;
    }
}

// Check if Backend is Online and has CORS configured
async function checkBackendStatus() {
    try {
        // Fetch users to verify connectivity
        await fetch(`${state.apiUrl}/users`, { method: 'GET' });
        
        // Update Indicator UI
        elements.statusDot.className = 'status-dot online';
        elements.statusText.textContent = 'Online';
        return true;
    } catch (error) {
        elements.statusDot.className = 'status-dot offline';
        elements.statusText.textContent = 'Offline';
        return false;
    }
}

// ==========================================================================
// Data Loaders & Synchronizers
// ==========================================================================
async function loadAllData() {
    const isOnline = await checkBackendStatus();
    
    if (!isOnline) {
        showToast('Backend API is currently unreachable. Check endpoint or CORS configuration.', 'error');
        return;
    }
    
    try {
        // Fetch Users and Courses concurrently
        const [users, courses] = await Promise.all([
            apiFetch('/users'),
            apiFetch('/courses')
        ]);
        
        state.users = users || [];
        state.courses = courses || [];
        
        // Fetch enrollments count for each course to calculate global enrollments
        let totalEnrollmentsCount = 0;
        for (const course of state.courses) {
            try {
                const enrollments = await apiFetch(`/courses/${course.id}/enrollments`);
                course.enrollments = enrollments || [];
                totalEnrollmentsCount += course.enrollments.length;
            } catch (err) {
                course.enrollments = [];
            }
        }
        
        state.totalEnrollmentsCount = totalEnrollmentsCount;
        
        // Render updated data across views
        renderOverview();
        renderCourses();
        renderUsers();
        populateDropdowns();
        
    } catch (err) {
        showToast(`Failed to load data: ${err.message}`, 'error');
    }
}

// ==========================================================================
// UI Render Engines
// ==========================================================================
function populateDropdowns() {
    // Instructors Dropdown (for Create Course Form)
    const instructors = state.users.filter(u => u.role === 2); // Role 2 is Instructor
    elements.courseInstructor.innerHTML = '<option value="">-- Select Instructor --</option>';
    instructors.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.id;
        opt.textContent = `${inst.name} (${inst.email})`;
        elements.courseInstructor.appendChild(opt);
    });
    
    // Courses Dropdown (for Quick Enroll)
    elements.enrollCourseSelect.innerHTML = '<option value="">-- Choose Course --</option>';
    state.courses.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course.id;
        opt.textContent = course.title;
        elements.enrollCourseSelect.appendChild(opt);
    });
    
    // Students Dropdown (for Quick Enroll)
    const students = state.users.filter(u => u.role === 1); // Role 1 is Student
    elements.enrollStudentSelect.innerHTML = '<option value="">-- Choose Student --</option>';
    students.forEach(stud => {
        const opt = document.createElement('option');
        opt.value = stud.id;
        opt.textContent = `${stud.name} (${stud.email})`;
        elements.enrollStudentSelect.appendChild(opt);
    });
}

function renderOverview() {
    const students = state.users.filter(u => u.role === 1);
    const instructors = state.users.filter(u => u.role === 2);
    
    // Stats Counters
    elements.statCoursesCount.textContent = state.courses.length;
    elements.statStudentsCount.textContent = students.length;
    elements.statInstructorsCount.textContent = instructors.length;
    elements.statEnrollmentsCount.textContent = state.totalEnrollmentsCount || 0;
    
    // Recent Courses Table (latest 5)
    const sortedCourses = [...state.courses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    elements.recentCoursesList.innerHTML = '';
    
    if (sortedCourses.length === 0) {
        elements.recentCoursesList.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">No courses available. Create one to get started!</td>
            </tr>
        `;
        return;
    }
    
    sortedCourses.forEach(course => {
        const row = document.createElement('tr');
        const createdDate = new Date(course.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        
        row.innerHTML = `
            <td><strong>${escapeHtml(course.title)}</strong></td>
            <td><span class="text-muted"><i class="fa-solid fa-user-tie"></i> ${escapeHtml(course.instructorName || 'Unassigned')}</span></td>
            <td>${createdDate}</td>
            <td><span class="action-link view-course-action" data-id="${course.id}">Manage</span></td>
        `;
        
        // Add click listener to view details
        row.querySelector('.view-course-action').addEventListener('click', () => {
            switchTab('courses');
            // Filter query to highlight/scroll to this course card
            state.searchQuery = course.title;
            elements.globalSearch.value = course.title;
            renderCourses();
        });
        
        elements.recentCoursesList.appendChild(row);
    });
}

function renderCourses() {
    elements.coursesGridContainer.innerHTML = '';
    
    // Filter courses based on search query
    const filteredCourses = state.courses.filter(c => {
        const q = state.searchQuery.toLowerCase();
        return c.title.toLowerCase().includes(q) || 
               c.description.toLowerCase().includes(q) || 
               (c.instructorName && c.instructorName.toLowerCase().includes(q));
    });
    
    if (filteredCourses.length === 0) {
        elements.coursesGridContainer.innerHTML = `
            <div class="col-large text-center text-muted" style="grid-column: 1 / -1; padding: 40px;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 16px; display: block; color: var(--text-dark);"></i>
                No courses found matching "${escapeHtml(state.searchQuery)}".
            </div>
        `;
        return;
    }
    
    filteredCourses.forEach(course => {
        const card = document.createElement('article');
        card.className = 'course-card';
        
        const enrollmentCount = course.enrollments ? course.enrollments.length : 0;
        const creationDate = new Date(course.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short'
        });
        
        card.innerHTML = `
            <div class="course-cover">
                <span class="course-cover-overlay">${creationDate}</span>
            </div>
            <div class="course-body">
                <h3 class="course-title">${escapeHtml(course.title)}</h3>
                <p class="course-desc">${escapeHtml(course.description)}</p>
                <div class="course-meta">
                    <span class="course-instructor">
                        <i class="fa-solid fa-chalkboard-user"></i>
                        <span>${escapeHtml(course.instructorName || 'Unknown')}</span>
                    </span>
                    <span class="course-enroll-badge">
                        <i class="fa-solid fa-users-viewfinder"></i>
                        <span>${enrollmentCount} Enrolled</span>
                    </span>
                </div>
            </div>
        `;
        elements.coursesGridContainer.appendChild(card);
    });
}

function renderUsers() {
    // Filter users based on search query
    const filteredUsers = state.users.filter(u => {
        const q = state.searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
    
    const instructors = filteredUsers.filter(u => u.role === 2);
    const students = filteredUsers.filter(u => u.role === 1);
    
    // Update count labels
    elements.instructorCountLabel.textContent = `${instructors.length} total`;
    elements.studentCountLabel.textContent = `${students.length} total`;
    
    // Renders instructors list
    elements.instructorsList.innerHTML = '';
    if (instructors.length === 0) {
        elements.instructorsList.innerHTML = '<p class="text-center text-muted">No instructors found.</p>';
    } else {
        instructors.forEach(inst => {
            const row = createUserRow(inst, 'instructor');
            elements.instructorsList.appendChild(row);
        });
    }
    
    // Renders students list
    elements.studentsList.innerHTML = '';
    if (students.length === 0) {
        elements.studentsList.innerHTML = '<p class="text-center text-muted">No students found.</p>';
    } else {
        students.forEach(stud => {
            const row = createUserRow(stud, 'student');
            elements.studentsList.appendChild(row);
        });
    }
}

function createUserRow(user, roleType) {
    const row = document.createElement('div');
    row.className = 'user-row';
    
    // Get Initials for avatar
    const initials = user.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U';
    const joinedDate = new Date(user.createdAt).toLocaleDateString(undefined, {
        month: 'short', year: 'numeric'
    });
    
    row.innerHTML = `
        <div class="user-avatar-info">
            <div class="user-avatar avatar-${roleType}">${initials}</div>
            <div class="user-details">
                <span class="user-name">${escapeHtml(user.name)}</span>
                <span class="user-email">${escapeHtml(user.email)}</span>
            </div>
        </div>
        <div class="user-joined">
            Joined ${joinedDate}
        </div>
    `;
    return row;
}

// ==========================================================================
// Event Listeners & Controllers
// ==========================================================================

// Tab Switching
function switchTab(targetTab) {
    state.currentTab = targetTab;
    
    // Update Nav bar highlights
    elements.navItems.forEach(item => {
        if (item.getAttribute('data-tab') === targetTab) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update active pane displays
    elements.tabPanes.forEach(pane => {
        if (pane.id === `tab-${targetTab}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
    
    // Refresh context data (to ensure lists are synced)
    if (targetTab === 'overview') {
        renderOverview();
    } else if (targetTab === 'courses') {
        renderCourses();
    } else if (targetTab === 'users') {
        renderUsers();
    }
}

// Modals Utilities
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// ==========================================================================
// Form Submissions Actions
// ==========================================================================

// Create User
elements.createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const payload = {
        name: elements.userName.value.trim(),
        email: elements.userEmail.value.trim(),
        role: parseInt(elements.userRole.value, 10)
    };
    
    try {
        const newUser = await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        showToast(`Successfully added user: ${newUser.name}`);
        closeModal(elements.userModal);
        elements.createUserForm.reset();
        
        // Reload data
        await loadAllData();
        
    } catch (err) {
        showToast(`Failed to create user: ${err.message}`, 'error');
    }
});

// Create Course
elements.createCourseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const payload = {
        title: elements.courseTitle.value.trim(),
        description: elements.courseDesc.value.trim(),
        instructorId: elements.courseInstructor.value
    };
    
    try {
        const newCourse = await apiFetch('/courses', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        showToast(`Successfully created course: ${newCourse.title}`);
        closeModal(elements.courseModal);
        elements.createCourseForm.reset();
        
        // Reload data
        await loadAllData();
        
    } catch (err) {
        showToast(`Failed to create course: ${err.message}`, 'error');
    }
});

// Quick Enroll Student
elements.quickEnrollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const courseId = elements.enrollCourseSelect.value;
    const studentId = elements.enrollStudentSelect.value;
    
    try {
        // Route takes Guid studentId in Body
        const enrollment = await apiFetch(`/courses/${courseId}/enroll`, {
            method: 'POST',
            body: JSON.stringify(studentId) // Send Guid directly as JSON
        });
        
        showToast(`Enrolled ${enrollment.studentName} in "${enrollment.courseTitle}" successfully!`);
        elements.quickEnrollForm.reset();
        
        // Reload data
        await loadAllData();
        
    } catch (err) {
        showToast(`Failed to enroll student: ${err.message}`, 'error');
    }
});

// Save API Config
elements.saveApiConfigBtn.addEventListener('click', () => {
    let inputUrl = elements.apiUrlInput.value.trim();
    if (!inputUrl) return;
    
    // Remove trailing slash if present for predictability
    if (inputUrl.endsWith('/')) {
        inputUrl = inputUrl.slice(0, -1);
    }
    
    state.apiUrl = inputUrl;
    localStorage.setItem('lms_api_url', inputUrl);
    
    showToast('API Endpoint configured successfully!');
    closeModal(elements.apiModal);
    
    // Reload state from new endpoint
    loadAllData();
});

// ==========================================================================
// Init & Globals Events Bindings
// ==========================================================================

// Setup Tab Switching triggers
elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = item.getAttribute('data-tab');
        switchTab(targetTab);
    });
});

// Bind Overview "View All" action redirection
document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
        const destination = btn.getAttribute('data-goto');
        switchTab(destination);
    });
});

// Setup Modals handlers
elements.apiConfigBtn.addEventListener('click', () => {
    elements.apiUrlInput.value = state.apiUrl;
    openModal(elements.apiModal);
});

elements.openCourseModalBtn.addEventListener('click', () => {
    // Refresh user list in select prior to opening
    populateDropdowns();
    openModal(elements.courseModal);
});

elements.openUserModalBtn.addEventListener('click', () => openModal(elements.userModal));

// Bind modal close buttons
document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        closeModal(document.getElementById(modalId));
    });
});

// Close modal if background is clicked
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeModal(backdrop);
        }
    });
});

// Bind manual data refresh
elements.refreshOverviewBtn.addEventListener('click', loadAllData);

// Realtime search filtering
elements.globalSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    
    // Render current active tab with search queries filters applied
    if (state.currentTab === 'courses') {
        renderCourses();
    } else if (state.currentTab === 'users') {
        renderUsers();
    } else if (state.currentTab === 'overview') {
        // Simple search logic for overview: switch tabs if searching to help user see details
        if (state.searchQuery.trim().length > 0) {
            // Find if searching courses or users to decide best destination
            switchTab('courses');
        }
    }
});

// Helper: Escape HTML strings to guard against XSS injection
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// On Startup Load
window.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});
