'use client';
import { useEffect } from 'react';

export default function Home() {
    useEffect(() => {
        /* ═══════════════════════════════════════════════════════════
   BITSOTRON KANBAN — Application Logic
   ═══════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ═══════ CONFIG ═══════
    const TEAM = [
        { id: 'ceo',   name: 'Tamizharasan',   role: 'CEO',       color: '#6366F1', initials: 'TA', password: 'ceo@123' },
        { id: 'tl',    name: 'Harish',          role: 'Team Lead', color: '#8B5CF6', initials: 'HR', password: 'tl@123' },
        { id: 'sde1',  name: 'Keerthika',       role: 'SDE-1',     color: '#3B82F6', initials: 'KE', password: 'sde1@123' },
        { id: 'sde2',  name: 'Akilan',          role: 'SDE-2',     color: '#10B981', initials: 'AK', password: 'sde2@123' },
        { id: 'sde3',  name: 'Subhaharini',     role: 'SDE-3',     color: '#F59E0B', initials: 'SU', password: 'sde3@123' },
    ];

    const COLUMNS = [
        { id: 'backlog',  name: 'Backlog',      color: '#94A3B8' },
        { id: 'todo',     name: 'To Do',        color: '#3B82F6' },
        { id: 'progress', name: 'In Progress',  color: '#F59E0B' },
        { id: 'review',   name: 'Code Review',  color: '#8B5CF6' },
        { id: 'done',     name: 'Done',         color: '#10B981' },
    ];

    const STORAGE_KEY = 'bitsotron_kanban_tasks_v2';
    const PINS_KEY = 'bitsotron_kanban_pins_v2';
    const SESSION_KEY = 'bitsotron_kanban_user';
    const CHAT_KEY = 'bitsotron_kanban_chat_v2';
    const ONLINE_KEY = 'bitsotron_kanban_online_v2';
    const STATUS_UPDATES_KEY = 'bitsotron_kanban_daily_updates_v2';
    const STATUS_LOG_KEY = 'bitsotron_kanban_status_log_v2';
    const ONLINE_LOG_KEY = 'bitsotron_kanban_online_log_v2';
    const STATUS_REQUESTS_KEY = 'bitsotron_kanban_status_requests_v2';

    // ═══════ STATE ═══════
    let currentUser = null;
    let tasks = [];
    let pins = [];
    let chats = [];
    let onlineUsers = {};
    let dailyUpdates = [];
    let statusLogs = [];
    let onlineLogs = [];
    let filters = { search: '', assignee: '', priority: '', myTasks: false };
    let deleteTargetId = null;
    let pinsPanelOpen = false;
    let chatPanelOpen = false;
    let statusSidebarOpen = false;
    let unreadChatCount = 0;
    let heartbeatInterval = null;

    // ═══════ HELPERS ═══════
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const byId = (id) => document.getElementById(id);

    function uuid() {
        return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
    }

    function getMember(id) {
        return TEAM.find(m => m.id === id);
    }

    function hasWriteAccess() {
        return currentUser && (currentUser.role === 'CEO' || currentUser.role === 'Team Lead');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
            ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    function isOverdue(dueDate) {
        if (!dueDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(dueDate) < today;
    }

    function getColumnName(colId) {
        const col = COLUMNS.find(c => c.id === colId);
        return col ? col.name : colId;
    }

    // ═══════ STORAGE ═══════
    async function loadTasks() {
        try {
            const res = await fetch('/api/tasks');
            if (res.ok) {
                tasks = await res.json();
            } else {
                throw new Error('Neon DB load failed');
            }
        } catch (e) {
            console.warn('Neon tasks load failed, falling back to LocalStorage:', e);
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                tasks = data ? JSON.parse(data) : [];
            } catch {
                tasks = [];
            }
        }

        // Migrate array assignees and activity
        tasks.forEach(t => {
            if (t.assignee && !t.assignees) {
                t.assignees = [t.assignee];
            }
            if (!t.assignees) {
                t.assignees = [];
            }
            if (!t.activity) {
                t.activity = [];
            }
        });

        if (tasks.length === 0) {
            seedTasks();
        } else {
            checkDeadlines(); // Check deadlines on load
        }
    }

    function saveTasks(singleTaskToSync = null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        if (singleTaskToSync) {
            fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(singleTaskToSync)
            }).catch(err => console.error('Neon Task Sync Error:', err));
        } else {
            tasks.forEach(t => {
                fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(t)
                }).catch(err => console.error('Neon Task Sync Error:', err));
            });
        }
    }

    function loadSession() {
        try {
            const data = sessionStorage.getItem(SESSION_KEY);
            if (data) {
                currentUser = JSON.parse(data);
                return true;
            }
        } catch { /* ignore */ }
        return false;
    }

    function saveSession() {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    }

    function clearSession() {
        sessionStorage.removeItem(SESSION_KEY);
        currentUser = null;
    }

    // ═══════ SEED DATA ═══════
    function seedTasks() {
        tasks = [];
        saveTasks();
    }

    // ═══════ RENDER: LOGIN ═══════
    let selectedLoginUser = null;

    function renderLogin() {
        const container = byId('loginRoles');
        container.innerHTML = TEAM.map(member => `
            <div class="role-card" data-user-id="${member.id}">
                <div class="role-avatar" style="background:${member.color}">${member.initials}</div>
                <div class="role-card-name">${member.name}</div>
                <div class="role-card-role">${member.role}</div>
            </div>
        `).join('');

        container.querySelectorAll('.role-card').forEach(card => {
            card.addEventListener('click', () => {
                const userId = card.dataset.userId;
                selectedLoginUser = getMember(userId);
                showPasswordStep();
            });
        });

        // Back button
        byId('loginBackBtn').addEventListener('click', () => {
            selectedLoginUser = null;
            hidePasswordStep();
        });

        // Sign In button
        byId('loginSubmitBtn').addEventListener('click', attemptLogin);

        // Enter key on password field
        byId('loginPassword').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }

    function showPasswordStep() {
        if (!selectedLoginUser) return;
        const section = byId('loginPasswordSection');
        const userDisplay = byId('loginSelectedUser');

        userDisplay.innerHTML = `
            <div class="login-selected-avatar" style="background:${selectedLoginUser.color}">${selectedLoginUser.initials}</div>
            <div class="login-selected-info">
                <span class="login-selected-name">${selectedLoginUser.name}</span>
                <span class="login-selected-role">${selectedLoginUser.role}</span>
            </div>
        `;

        byId('loginRoles').classList.add('hidden');
        section.classList.remove('hidden');
        byId('loginPassword').value = '';
        byId('loginError').classList.add('hidden');
        byId('loginPassword').focus();
    }

    function hidePasswordStep() {
        byId('loginPasswordSection').classList.add('hidden');
        byId('loginRoles').classList.remove('hidden');
    }

    function attemptLogin() {
        if (!selectedLoginUser) return;
        const password = byId('loginPassword').value;
        const errorEl = byId('loginError');

        if (password === selectedLoginUser.password) {
            currentUser = selectedLoginUser;
            saveSession();
            showApp();
        } else {
            errorEl.classList.remove('hidden');
            // Re-trigger shake animation
            errorEl.style.animation = 'none';
            errorEl.offsetHeight; // force reflow
            errorEl.style.animation = '';
            byId('loginPassword').value = '';
            byId('loginPassword').focus();
        }
    }

    function showLogin() {
        stopHeartbeat();
        byId('loginScreen').classList.remove('hidden');
        byId('appContainer').classList.add('hidden');
        selectedLoginUser = null;
        hidePasswordStep();
    }

    function showApp() {
        byId('loginScreen').classList.add('hidden');
        byId('appContainer').classList.remove('hidden');
        setupHeader();
        renderBoard();
        
        // Pinned Items write access toggle
        const addPinBtn = byId('addPinBtn');
        if (addPinBtn) {
            if (hasWriteAccess()) {
                addPinBtn.classList.remove('hidden');
            } else {
                addPinBtn.classList.add('hidden');
            }
        }
        
        // Log online session
        if (currentUser) {
            if (!sessionStorage.getItem('logged_online_this_session')) {
                logOnlineSession(currentUser.id, 'login');
                sessionStorage.setItem('logged_online_this_session', 'true');
            }
        }
        
        startHeartbeat();
        checkStatusRequests(); // Check if updates are requested
    }

    // ═══════ RENDER: HEADER ═══════
    function setupHeader() {
        const member = currentUser;
        byId('userAvatar').textContent = member.initials;
        byId('userAvatar').style.background = member.color;
        byId('userName').textContent = member.name;
        byId('userRole').textContent = member.role;

        const newTaskBtn = byId('newTaskBtn');
        if (hasWriteAccess()) {
            newTaskBtn.classList.remove('hidden');
        } else {
            newTaskBtn.classList.add('hidden');
        }

        // Populate assignee filter
        const filterAssignee = byId('filterAssignee');
        filterAssignee.innerHTML = '<option value="">All Members</option>' +
            TEAM.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('');

        // Populate multi-assignee selection checkboxes
        populateAssigneesGrid();
    }

    // ═══════ RENDER: BOARD ═══════
    function renderBoard() {
        const board = byId('board');
        board.innerHTML = '';

        COLUMNS.forEach(col => {
            const colEl = document.createElement('div');
            colEl.className = 'column';
            colEl.dataset.column = col.id;

            const colTasks = getFilteredTasks(col.id);

            colEl.innerHTML = `
                <div class="column-header">
                    <div class="column-header-left">
                        <div class="column-dot" style="color:${col.color};background:${col.color}"></div>
                        <span class="column-name">${col.name}</span>
                    </div>
                    <span class="column-count">${colTasks.length}</span>
                </div>
                <div class="column-body" data-column="${col.id}">
                    ${colTasks.length === 0 ? `
                        <div class="column-empty">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.35;margin-bottom:0.15rem;">
                                <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
                            </svg>
                            <span>No tasks</span>
                        </div>
                    ` : ''}
                </div>
            `;

            const body = colEl.querySelector('.column-body');
            colTasks.forEach(task => {
                body.appendChild(createTaskCard(task));
            });

            // Drop target events
            if (hasWriteAccess()) {
                body.addEventListener('dragover', handleDragOver);
                body.addEventListener('dragenter', handleDragEnter);
                body.addEventListener('dragleave', handleDragLeave);
                body.addEventListener('drop', handleDrop);
            }

            board.appendChild(colEl);
        });
    }

    function getFilteredTasks(columnId) {
        return tasks.filter(t => {
            if (t.status !== columnId) return false;
            if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
            if (filters.assignee && !(t.assignees && t.assignees.includes(filters.assignee))) return false;
            if (filters.priority && t.priority !== filters.priority) return false;
            if (filters.myTasks && currentUser && !(t.assignees && t.assignees.includes(currentUser.id))) return false;
            return true;
        });
    }

    // ═══════ RENDER: TASK CARD ═══════
    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;

        const overdue = task.status !== 'done' && isOverdue(task.dueDate);
        if (overdue) card.classList.add('overdue');

        // Drag
        if (hasWriteAccess()) {
            card.draggable = true;
            card.classList.add('draggable-enabled');
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        }

        const priorityLabels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

        // Determine inline action buttons on hover/card bottom
        let cardActionHtml = '';
        const isUserAssignee = currentUser && task.assignees && task.assignees.includes(currentUser.id);
        if ((task.status === 'backlog' || task.status === 'todo') && isUserAssignee) {
            cardActionHtml = `
                <button class="btn-card-action accept" data-task-id="${task.id}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Accept
                </button>
            `;
        }

        const isTLorCEO = currentUser && (currentUser.role === 'Team Lead' || currentUser.role === 'CEO');
        if (task.status === 'review' && isTLorCEO) {
            cardActionHtml = `
                <button class="btn-card-action review" data-task-id="${task.id}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Review Done
                </button>
            `;
        }

        card.innerHTML = `
            <div class="task-card-top">
                <span class="priority-badge ${task.priority}">${priorityLabels[task.priority]}</span>
                ${task.dueDate ? `<span class="task-due ${overdue ? 'overdue' : ''}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    ${formatDate(task.dueDate)}
                </span>` : ''}
            </div>
            <div class="task-card-title">${escapeHtml(task.title)}</div>
            <div class="task-card-bottom">
                ${renderAvatarStack(task.assignees)}
                ${hasWriteAccess() ? `
                <div class="task-card-actions">
                    <button class="btn-icon btn-edit-card" data-task-id="${task.id}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-icon btn-delete-card" data-task-id="${task.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
                ` : ''}
            </div>
            ${cardActionHtml ? `<div class="task-card-action-bar">${cardActionHtml}</div>` : ''}
        `;

        // Click to view detail
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-card') || e.target.closest('.btn-delete-card') || e.target.closest('.btn-card-action')) return;
            openDetailModal(task.id);
        });

        // Edit button
        const editBtn = card.querySelector('.btn-edit-card');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(task.id);
            });
        }

        // Delete button
        const delBtn = card.querySelector('.btn-delete-card');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDeleteModal(task.id);
            });
        }

        // Accept task action
        const acceptAct = card.querySelector('.btn-card-action.accept');
        if (acceptAct) {
            acceptAct.addEventListener('click', (e) => {
                e.stopPropagation();
                acceptTask(task.id);
            });
        }

        // Review done action
        const reviewAct = card.querySelector('.btn-card-action.review');
        if (reviewAct) {
            reviewAct.addEventListener('click', (e) => {
                e.stopPropagation();
                completeTLReview(task.id);
            });
        }

        return card;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════ DRAG & DROP ═══════
    let draggedTaskId = null;

    function handleDragStart(e) {
        draggedTaskId = e.currentTarget.dataset.taskId;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
    }

    function handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        draggedTaskId = null;
        $$('.column').forEach(col => col.classList.remove('drag-over'));
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        const col = e.currentTarget.closest('.column');
        if (col) col.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        const col = e.currentTarget.closest('.column');
        if (col && !col.contains(e.relatedTarget)) {
            col.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetColumn = e.currentTarget.dataset.column;
        const taskId = e.dataTransfer.getData('text/plain');

        $$('.column').forEach(col => col.classList.remove('drag-over'));

        if (!taskId || !targetColumn) return;

        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status === targetColumn) return;

        const fromCol = task.status;
        const toCol = targetColumn;

        task.status = targetColumn;
        task.activity.push({
            text: `${currentUser.name} moved from ${getColumnName(fromCol)} → ${getColumnName(toCol)}`,
            time: Date.now()
        });

        logStatusChange(task.id, fromCol, toCol);
        saveTasks();
        renderBoard();
        showToast(`Moved to ${getColumnName(toCol)}`, 'success');
    }

    // ═══════ TASK MODAL (Create / Edit) ═══════
    function openCreateModal() {
        byId('modalTitle').textContent = 'New Task';
        byId('modalSubmitBtn').textContent = 'Create Task';
        byId('taskForm').reset();
        
        // Reset assignee checkboxes
        const checkboxes = document.querySelectorAll('input[name="taskAssignees"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.parentElement.classList.remove('active');
        });

        byId('taskId').value = '';
        byId('taskModal').classList.remove('hidden');
    }

    function openEditModal(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        byId('modalTitle').textContent = 'Edit Task';
        byId('modalSubmitBtn').textContent = 'Save Changes';
        byId('taskId').value = task.id;
        byId('taskTitle').value = task.title;
        byId('taskDescription').value = task.description || '';
        
        // Reset and check multi-assignee boxes
        const checkboxes = document.querySelectorAll('input[name="taskAssignees"]');
        checkboxes.forEach(cb => {
            cb.checked = task.assignees && task.assignees.includes(cb.value);
            cb.parentElement.classList.toggle('active', cb.checked);
        });

        byId('taskPriority').value = task.priority;
        byId('taskDueDate').value = task.dueDate || '';
        byId('taskModal').classList.remove('hidden');
    }

    function closeTaskModal() {
        byId('taskModal').classList.add('hidden');
    }

    function handleTaskSubmit(e) {
        e.preventDefault();

        const id = byId('taskId').value;
        const title = byId('taskTitle').value.trim();
        const description = byId('taskDescription').value.trim();
        
        // Read checked assignees
        const assigneeCbs = document.querySelectorAll('input[name="taskAssignees"]:checked');
        const assignees = Array.from(assigneeCbs).map(cb => cb.value);
        const priority = byId('taskPriority').value;
        const dueDate = byId('taskDueDate').value;

        if (!title || assignees.length === 0 || !priority) {
            showToast('Please fill out all required fields', 'error');
            return;
        }

        if (id) {
            // Edit
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            task.title = title;
            task.description = description;
            task.assignees = assignees;
            task.priority = priority;
            task.dueDate = dueDate;
            task.activity.push({ text: `${currentUser.name} edited this task`, time: Date.now() });
            showToast('Task updated', 'success');
        } else {
            // Create
            const newTask = {
                id: uuid(),
                title,
                description,
                assignees,
                priority,
                dueDate,
                status: 'backlog',
                createdBy: currentUser.id,
                createdAt: Date.now(),
                activity: [{ text: `Task created by ${currentUser.name}`, time: Date.now() }]
            };
            tasks.push(newTask);
            logStatusChange(newTask.id, 'none', 'backlog');
            showToast('Task created', 'success');
        }

        saveTasks();
        closeTaskModal();
        renderBoard();
    }

    // ═══════ DETAIL MODAL ═══════
    function openDetailModal(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const assigneesList = task.assignees && task.assignees.length > 0
            ? task.assignees.map(id => {
                const m = getMember(id);
                return m ? `${m.name} (${m.role})` : id;
              }).join(', ')
            : 'Unassigned';
        const creator = getMember(task.createdBy);
        const col = COLUMNS.find(c => c.id === task.status);

        // Priority badge
        const detailPriority = byId('detailPriority');
        detailPriority.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
        detailPriority.className = 'detail-priority-badge priority-badge ' + task.priority;

        // Status badge
        const detailStatus = byId('detailStatus');
        detailStatus.textContent = col ? col.name : task.status;
        if (col) detailStatus.style.color = col.color;

        byId('detailTitle').textContent = task.title;
        byId('detailDescription').textContent = task.description || '';
        byId('detailAssignee').textContent = assigneesList;
        byId('detailDueDate').textContent = task.dueDate ? formatDate(task.dueDate) : '—';
        byId('detailCreatedBy').textContent = creator ? `${creator.name} (${creator.role})` : '—';
        byId('detailCreatedAt').textContent = formatTime(task.createdAt);

        // Activity
        const activityList = byId('detailActivityList');
        if (task.activity && task.activity.length > 0) {
            activityList.innerHTML = task.activity.slice().reverse().map(a => `
                <div class="activity-item">
                    <div class="activity-dot"></div>
                    <span class="activity-text">${escapeHtml(a.text)}</span>
                    <span class="activity-time">${formatTime(a.time)}</span>
                </div>
            `).join('');
        } else {
            activityList.innerHTML = '<div class="activity-item" style="opacity:0.5;">No activity yet</div>';
        }

        // Action Buttons inside Detail Modal
        let customButtonsHtml = '';
        const isUserAssignee = task.assignees && task.assignees.includes(currentUser.id);
        if ((task.status === 'backlog' || task.status === 'todo') && isUserAssignee) {
            customButtonsHtml += `
                <button class="btn-detail-action accept" id="detailAcceptBtn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Accept Task
                </button>
            `;
        }

        const isTLorCEO = currentUser && (currentUser.role === 'Team Lead' || currentUser.role === 'CEO');
        if (task.status === 'review' && isTLorCEO) {
            customButtonsHtml += `
                <button class="btn-detail-action review" id="detailReviewBtn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    TL Review Done
                </button>
            `;
        }

        let editDeleteHtml = '';
        if (hasWriteAccess()) {
            editDeleteHtml = `
                <button class="btn-secondary btn-edit" id="detailEditBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                </button>
                <button class="btn-danger" id="detailDeleteBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                </button>
            `;
        }

        const actionsSection = byId('detailActions');
        actionsSection.innerHTML = customButtonsHtml + editDeleteHtml;
        actionsSection.classList.remove('hidden');

        // Bind clicks
        if (byId('detailAcceptBtn')) {
            byId('detailAcceptBtn').onclick = () => {
                acceptTask(taskId);
                closeDetailModal();
            };
        }
        if (byId('detailReviewBtn')) {
            byId('detailReviewBtn').onclick = () => {
                completeTLReview(taskId);
                closeDetailModal();
            };
        }
        if (byId('detailEditBtn')) {
            byId('detailEditBtn').onclick = () => {
                closeDetailModal();
                openEditModal(taskId);
            };
        }
        if (byId('detailDeleteBtn')) {
            byId('detailDeleteBtn').onclick = () => {
                closeDetailModal();
                openDeleteModal(taskId);
            };
        }

        byId('detailModal').classList.remove('hidden');
    }

    function closeDetailModal() {
        byId('detailModal').classList.add('hidden');
    }

    // ═══════ DELETE MODAL ═══════
    function openDeleteModal(taskId) {
        deleteTargetId = taskId;
        byId('deleteModal').classList.remove('hidden');
    }

    function closeDeleteModal() {
        deleteTargetId = null;
        byId('deleteModal').classList.add('hidden');
    }

    function confirmDelete() {
        if (!deleteTargetId) return;
        const targetId = deleteTargetId;
        tasks = tasks.filter(t => t.id !== targetId);
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        fetch(`/api/tasks/${targetId}`, { method: 'DELETE' })
            .catch(err => console.error('Neon Task Delete Error:', err));
        closeDeleteModal();
        renderBoard();
        showToast('Task deleted', 'error');
    }

    // ═══════ TOASTS ═══════
    function showToast(message, type = 'info') {
        const container = byId('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
            info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
        };

        toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    // ═══════ FILTERS ═══════
    function setupFilters() {
        byId('searchInput').addEventListener('input', (e) => {
            filters.search = e.target.value;
            renderBoard();
        });

        byId('filterAssignee').addEventListener('change', (e) => {
            filters.assignee = e.target.value;
            renderBoard();
        });

        byId('filterPriority').addEventListener('change', (e) => {
            filters.priority = e.target.value;
            renderBoard();
        });

        byId('myTasksBtn').addEventListener('click', () => {
            filters.myTasks = !filters.myTasks;
            byId('myTasksBtn').classList.toggle('active', filters.myTasks);
            renderBoard();
        });
    }

    // ═══════ EVENT BINDINGS ═══════
    function bindEvents() {
        // New task
        byId('newTaskBtn').addEventListener('click', openCreateModal);

        // Task form
        byId('taskForm').addEventListener('submit', handleTaskSubmit);
        byId('modalCloseBtn').addEventListener('click', closeTaskModal);
        byId('modalCancelBtn').addEventListener('click', closeTaskModal);

        // Detail modal
        byId('detailCloseBtn').addEventListener('click', closeDetailModal);

        // Delete modal
        byId('deleteCancelBtn').addEventListener('click', closeDeleteModal);
        byId('deleteConfirmBtn').addEventListener('click', confirmDelete);

        // Daily Status Modal Event listeners
        byId('dailyStatusCloseBtn').addEventListener('click', closeDailyStatusModal);
        byId('dailyStatusCancelBtn').addEventListener('click', closeDailyStatusModal);
        byId('dailyStatusForm').addEventListener('submit', handleDailyStatusSubmit);

        // Request Status Modal Event listeners
        byId('requestStatusCloseBtn').addEventListener('click', closeRequestStatusModal);
        byId('requestStatusCancelBtn').addEventListener('click', closeRequestStatusModal);
        byId('requestStatusForm').addEventListener('submit', handleRequestStatusSubmit);

        // Logout
        byId('logoutBtn').addEventListener('click', () => {
            if (currentUser) {
                logOnlineSession(currentUser.id, 'logout');
                sessionStorage.removeItem('logged_online_this_session');
                sessionStorage.removeItem('status_prompted_this_session');
            }
            clearSession();
            showLogin();
        });

        // Close modals on overlay click
        ['taskModal', 'detailModal', 'deleteModal', 'pinModal', 'dailyStatusModal', 'requestStatusModal', 'pinDetailModal'].forEach(id => {
            const modal = byId(id);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                        if (id === 'deleteModal') deleteTargetId = null;
                    }
                });
            }
        });

        // Keyboard: Escape to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeTaskModal();
                closeDetailModal();
                closeDeleteModal();
                closePinModal();
                closePinDetailModal();
                closeDailyStatusModal();
                closeRequestStatusModal();
            }
        });

        // Sidebar tab toggles
        document.querySelectorAll('.status-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.status-tab-pane').forEach(p => p.classList.remove('active'));
                
                btn.classList.add('active');
                const paneId = btn.dataset.tab === 'updates' ? 'paneUpdates'
                             : btn.dataset.tab === 'status-logs' ? 'paneStatusLogs'
                             : 'paneOnlineLogs';
                byId(paneId).classList.add('active');
            });
        });

        setupFilters();
        setupPins();
        setupChat();
        setupStatusSidebar();
    }

    // ═══════ PINS MODULE ═══════
    const SEED_PINS = [];

    function loadPins() {
        try {
            const data = localStorage.getItem(PINS_KEY);
            pins = data ? JSON.parse(data) : [];
        } catch { pins = []; }
        if (pins.length === 0) {
            pins = SEED_PINS;
        }
    }



    function renderPins() {
        const grid = byId('pinnedGrid');
        const badge = byId('pinCountBadge');
        badge.textContent = pins.length;

        if (pins.length === 0) {
            grid.innerHTML = '<div class="pinned-empty">No pinned items yet</div>';
            return;
        }

        grid.innerHTML = '';
        pins.forEach(pin => {
            const card = document.createElement('div');
            card.className = 'pin-card';
            card.style.setProperty('--pin-color', pin.color);
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                openPinDetailModal(pin);
            });

            const creator = getMember(pin.createdBy);
            const typeLabels = { note: 'Note', link: 'Link', api: 'API' };

            let urlHtml = '';
            if ((pin.type === 'link' || pin.type === 'api') && pin.url) {
                const methodBadge = pin.type === 'api' && pin.method
                    ? `<span class="pin-method-badge ${pin.method.toLowerCase()}">${pin.method}</span>` : '';
                urlHtml = `<a class="pin-card-url" href="${escapeHtml(pin.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                    ${methodBadge}
                    <span>${escapeHtml(pin.url)}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>`;
            }

            card.innerHTML = `
                <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${pin.color};border-radius:4px 0 0 4px;"></div>
                <div class="pin-card-header">
                    <span class="pin-type-badge ${pin.type}">${typeLabels[pin.type] || pin.type}</span>
                    ${hasWriteAccess() ? `
                    <div class="pin-card-actions">
                        <button class="btn-icon btn-edit-pin" data-pin-id="${pin.id}" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon btn-delete-pin" data-pin-id="${pin.id}" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="pin-card-title">${escapeHtml(pin.title)}</div>
                ${pin.content ? `<div class="pin-card-content">${escapeHtml(pin.content)}</div>` : ''}
                ${urlHtml}
                <div class="pin-card-footer">
                    <span class="pin-card-author">by ${creator ? creator.name : 'Unknown'}</span>
                </div>
            `;

            // Edit pin
            const editBtn = card.querySelector('.btn-edit-pin');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openPinModal(pin.id);
                });
            }

            // Delete pin
            const delBtn = card.querySelector('.btn-delete-pin');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pinId = pin.id;
                    pins = pins.filter(p => p.id !== pinId);
                    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
                    fetch(`/api/pins/${pinId}`, { method: 'DELETE' })
                        .catch(err => console.error('Neon delete pin error:', err));
                    renderPins();
                    showToast('Pin removed', 'info');
                });
            }

            grid.appendChild(card);
        });
    }

    function openPinModal(editId) {
        const form = byId('pinForm');
        form.reset();
        byId('pinId').value = '';
        byId('pinColor').value = '#6366F1';
        byId('pinUrlGroup').style.display = 'none';
        byId('pinMethodGroup').style.display = 'none';

        // Reset color swatches
        $$('#pinColorPicker .pin-color-swatch').forEach(s => s.classList.remove('active'));
        const defaultSwatch = document.querySelector('#pinColorPicker .pin-color-swatch[data-color="#6366F1"]');
        if (defaultSwatch) defaultSwatch.classList.add('active');

        if (editId) {
            const pin = pins.find(p => p.id === editId);
            if (!pin) return;
            byId('pinModalTitle').textContent = 'Edit Pin';
            byId('pinSubmitBtn').textContent = 'Save Changes';
            byId('pinId').value = pin.id;
            byId('pinType').value = pin.type;
            byId('pinTitle').value = pin.title;
            byId('pinContent').value = pin.content || '';
            byId('pinUrl').value = pin.url || '';
            byId('pinMethod').value = pin.method || 'GET';
            byId('pinColor').value = pin.color || '#6366F1';

            if (pin.type === 'link' || pin.type === 'api') byId('pinUrlGroup').style.display = '';
            if (pin.type === 'api') byId('pinMethodGroup').style.display = '';

            $$('#pinColorPicker .pin-color-swatch').forEach(s => {
                s.classList.toggle('active', s.dataset.color === pin.color);
            });
        } else {
            byId('pinModalTitle').textContent = 'Add Pin';
            byId('pinSubmitBtn').textContent = 'Add Pin';
            byId('pinType').value = 'link';
            byId('pinUrlGroup').style.display = '';
        }

        byId('pinModal').classList.remove('hidden');
    }

    function closePinModal() {
        byId('pinModal').classList.add('hidden');
    }

    function openPinDetailModal(pin) {
        const creator = getMember(pin.createdBy);
        const typeLabels = { note: 'Note', link: 'Link', api: 'API' };
        
        const badge = byId('pinDetailType');
        if (badge) {
            badge.className = `pin-type-badge ${pin.type}`;
            badge.textContent = typeLabels[pin.type] || pin.type;
        }
        
        const titleEl = byId('pinDetailTitle');
        if (titleEl) titleEl.textContent = pin.title;
        
        const contentEl = byId('pinDetailContent');
        if (contentEl) {
            contentEl.textContent = pin.content || '';
            contentEl.style.display = pin.content ? '' : 'none';
        }
        
        const urlSection = byId('pinDetailUrlSection');
        if (urlSection) {
            if ((pin.type === 'link' || pin.type === 'api') && pin.url) {
                urlSection.style.display = '';
                const urlLink = byId('pinDetailUrl');
                if (urlLink) urlLink.href = pin.url;
                const urlText = byId('pinDetailUrlText');
                if (urlText) urlText.textContent = pin.url;
                
                const methodBadge = byId('pinDetailMethod');
                if (methodBadge) {
                    if (pin.type === 'api' && pin.method) {
                        methodBadge.style.display = '';
                        methodBadge.className = `pin-method-badge ${pin.method.toLowerCase()}`;
                        methodBadge.textContent = pin.method;
                    } else {
                        methodBadge.style.display = 'none';
                    }
                }
            } else {
                urlSection.style.display = 'none';
            }
        }
        
        const authorEl = byId('pinDetailAuthor');
        if (authorEl) authorEl.textContent = `by ${creator ? creator.name : 'Unknown'}`;
        
        const dateEl = byId('pinDetailDate');
        if (dateEl) dateEl.textContent = formatDate(pin.createdAt);
        
        const modalObj = byId('pinDetailModal');
        if (modalObj) {
            const innerModal = modalObj.querySelector('.modal');
            if (innerModal) innerModal.style.borderLeft = `5px solid ${pin.color}`;
            modalObj.classList.remove('hidden');
        }
    }

    function closePinDetailModal() {
        const modal = byId('pinDetailModal');
        if (modal) modal.classList.add('hidden');
    }

    function handlePinSubmit(e) {
        e.preventDefault();
        const id = byId('pinId').value;
        const type = byId('pinType').value;
        const title = byId('pinTitle').value.trim();
        const content = byId('pinContent').value.trim();
        const url = byId('pinUrl').value.trim();
        const method = byId('pinMethod').value;
        const color = byId('pinColor').value;

        if (!type || !title) return;

        let pinToSave;
        if (id) {
            pinToSave = pins.find(p => p.id === id);
            if (!pinToSave) return;
            Object.assign(pinToSave, { type, title, content, url, method, color });
            showToast('Pin updated', 'success');
        } else {
            pinToSave = {
                id: uuid(), type, title, content, url, method, color,
                createdBy: currentUser.id, createdAt: Date.now()
            };
            pins.push(pinToSave);
            showToast('Pin added', 'success');
        }

        savePins(pinToSave);
        closePinModal();
        renderPins();
    }

    function setupPins() {
        loadPins();

        // Toggle panel
        byId('pinnedToggleBtn').addEventListener('click', () => {
            pinsPanelOpen = !pinsPanelOpen;
            const panel = byId('pinnedPanel');
            const btn = byId('pinnedToggleBtn');
            if (pinsPanelOpen) {
                panel.classList.remove('hidden');
                requestAnimationFrame(() => panel.classList.add('visible'));
                btn.classList.add('active');
                renderPins();
            } else {
                panel.classList.remove('visible');
                btn.classList.remove('active');
                setTimeout(() => panel.classList.add('hidden'), 400);
            }
        });

        // Add pin button (bind click unconditionally; visibility toggled in showApp)
        const addPinBtn = byId('addPinBtn');
        if (addPinBtn) {
            addPinBtn.addEventListener('click', () => openPinModal());
        }

        // Pin form
        byId('pinForm').addEventListener('submit', handlePinSubmit);
        byId('pinModalCloseBtn').addEventListener('click', closePinModal);
        byId('pinCancelBtn').addEventListener('click', closePinModal);
        const closeDetailBtn = byId('pinDetailCloseBtn');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', closePinDetailModal);
        }

        // Type change → show/hide URL and Method fields
        byId('pinType').addEventListener('change', (e) => {
            const val = e.target.value;
            byId('pinUrlGroup').style.display = (val === 'link' || val === 'api') ? '' : 'none';
            byId('pinMethodGroup').style.display = val === 'api' ? '' : 'none';
        });

        // Color picker
        $$('#pinColorPicker .pin-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                $$('#pinColorPicker .pin-color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                byId('pinColor').value = swatch.dataset.color;
            });
        });

        // Close pin modal on overlay
        byId('pinModal').addEventListener('click', (e) => {
            if (e.target === byId('pinModal')) closePinModal();
        });

        renderPins();
    }

    // ═══════ CHAT MODULE ═══════
    function loadChats() {
        try {
            const data = localStorage.getItem(CHAT_KEY);
            chats = data ? JSON.parse(data) : [];
        } catch { chats = []; }
    }

    function saveChats() {
        localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
    }

    function loadOnlineStatuses() {
        try {
            const data = localStorage.getItem(ONLINE_KEY);
            onlineUsers = data ? JSON.parse(data) : {};
        } catch { onlineUsers = {}; }
    }

    function saveOnlineStatus() {
        if (!currentUser) return;
        loadOnlineStatuses();
        onlineUsers[currentUser.id] = Date.now();
        localStorage.setItem(ONLINE_KEY, JSON.stringify(onlineUsers));
    }

    function startHeartbeat() {
        saveOnlineStatus();
        renderChatMembers();
        heartbeatInterval = setInterval(() => {
            saveOnlineStatus();
            renderChatMembers();
            checkDeadlines();
            checkStatusRequests();
            
            if (statusSidebarOpen) {
                renderStatusSidebar();
            }
        }, 5000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    function renderChatMembers() {
        loadOnlineStatuses();
        const container = byId('chatMembersList');
        if (!container) return;

        const now = Date.now();
        container.innerHTML = TEAM.map(m => {
            const lastActive = onlineUsers[m.id] || 0;
            const isOnline = (now - lastActive) < 15000; // 15 seconds threshold
            return `
                <div class="chat-member-pill ${isOnline ? 'online' : ''}">
                    <span class="chat-member-status-dot"></span>
                    <span>${m.name}</span>
                </div>
            `;
        }).join('');
    }

    function renderChats() {
        const container = byId('chatMessages');
        if (!container) return;

        if (chats.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-tertiary);font-size:0.8rem;font-weight:500;">No messages yet. Say hi!</div>';
            return;
        }

        container.innerHTML = chats.map(msg => {
            const isMe = msg.userId === currentUser.id;
            const author = getMember(msg.userId);
            const timeStr = new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="chat-msg-wrapper ${isMe ? 'me' : ''}">
                    <div class="chat-msg-meta">
                        <span>${isMe ? 'You' : (author ? author.name : msg.userName)}</span>
                        <span>(${msg.role})</span>
                    </div>
                    <div class="chat-msg-bubble">
                        ${escapeHtml(msg.text)}
                        <div class="chat-msg-time" style="text-align:${isMe ? 'right' : 'left'};margin-top:0.25rem;">
                            ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    function handleChatSubmit(e) {
        e.preventDefault();
        const input = byId('chatInput');
        const text = input.value.trim();
        if (!text || !currentUser) return;

        const newMsg = {
            id: uuid(),
            userId: currentUser.id,
            userName: currentUser.name,
            role: currentUser.role,
            text,
            timestamp: Date.now()
        };

        chats.push(newMsg);
        saveChats();
        input.value = '';
        renderChats();
    }

    function setupChat() {
        loadChats();

        // Toggle chat drawer
        byId('chatToggleBtn').addEventListener('click', () => {
            chatPanelOpen = !chatPanelOpen;
            const sidebar = byId('chatSidebar');
            const btn = byId('chatToggleBtn');
            const unreadBadge = byId('chatUnreadBadge');

            if (chatPanelOpen) {
                sidebar.classList.remove('hidden');
                btn.classList.add('active');
                unreadChatCount = 0;
                unreadBadge.classList.add('hidden');
                renderChats();
                renderChatMembers();
            } else {
                sidebar.classList.add('hidden');
                btn.classList.remove('active');
            }
        });

        // Chat submit
        byId('chatForm').addEventListener('submit', handleChatSubmit);

        // Listen for updates from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === CHAT_KEY) {
                loadChats();
                if (chatPanelOpen) {
                    renderChats();
                } else {
                    unreadChatCount++;
                    const unreadBadge = byId('chatUnreadBadge');
                    unreadBadge.textContent = unreadChatCount;
                    unreadBadge.classList.remove('hidden');
                }
            } else if (e.key === ONLINE_KEY) {
                renderChatMembers();
            } else if (e.key === STATUS_UPDATES_KEY || e.key === STATUS_LOG_KEY || e.key === ONLINE_LOG_KEY) {
                if (statusSidebarOpen) {
                    renderStatusSidebar();
                }
            } else if (e.key === STATUS_REQUESTS_KEY) {
                checkStatusRequests();
            }
        });

        renderChatMembers();
    }

    // ═══════ UPGRADE FEATURES (MULTIPLE ASSIGNEES, AUTO ACTIONS, DAILY STATUS) ═══════
    async function loadLogs() {
        try {
            const [updatesRes, statusRes, onlineRes, pinsRes] = await Promise.all([
                fetch('/api/daily-updates'),
                fetch('/api/status-logs'),
                fetch('/api/online-logs'),
                fetch('/api/pins')
            ]);
            
            if (updatesRes.ok) dailyUpdates = await updatesRes.json();
            if (statusRes.ok) statusLogs = await statusRes.json();
            if (onlineRes.ok) onlineLogs = await onlineRes.json();
            if (pinsRes.ok) pins = await pinsRes.json();
        } catch (e) {
            console.warn('Neon logs load failed, falling back to LocalStorage:', e);
            try {
                dailyUpdates = JSON.parse(localStorage.getItem(STATUS_UPDATES_KEY)) || [];
                statusLogs = JSON.parse(localStorage.getItem(STATUS_LOG_KEY)) || [];
                onlineLogs = JSON.parse(localStorage.getItem(ONLINE_LOG_KEY)) || [];
                pins = JSON.parse(localStorage.getItem(PINS_KEY)) || [];
            } catch {
                dailyUpdates = [];
                statusLogs = [];
                onlineLogs = [];
                pins = [];
            }
        }
        
        if (pins.length === 0) {
            pins = SEED_PINS;
            savePins();
        }
    }

    function saveDailyUpdates(singleUpdate = null) {
        localStorage.setItem(STATUS_UPDATES_KEY, JSON.stringify(dailyUpdates));
        const itemToSync = singleUpdate || (dailyUpdates.length > 0 ? dailyUpdates[0] : null);
        if (itemToSync) {
            fetch('/api/daily-updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemToSync)
            }).catch(err => console.error('Neon save daily update error:', err));
        }
    }

    function saveStatusLogs(singleLog = null) {
        localStorage.setItem(STATUS_LOG_KEY, JSON.stringify(statusLogs));
        const itemToSync = singleLog || (statusLogs.length > 0 ? statusLogs[0] : null);
        if (itemToSync) {
            fetch('/api/status-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemToSync)
            }).catch(err => console.error('Neon save status log error:', err));
        }
    }

    function saveOnlineLogs(singleLog = null) {
        localStorage.setItem(ONLINE_LOG_KEY, JSON.stringify(onlineLogs));
        const itemToSync = singleLog || (onlineLogs.length > 0 ? onlineLogs[0] : null);
        if (itemToSync) {
            fetch('/api/online-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemToSync)
            }).catch(err => console.error('Neon save online log error:', err));
        }
    }

    function savePins(singlePin = null) {
        localStorage.setItem(PINS_KEY, JSON.stringify(pins));
        const itemToSync = singlePin || (pins.length > 0 ? pins[0] : null);
        if (itemToSync) {
            fetch('/api/pins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemToSync)
            }).catch(err => console.error('Neon save pin error:', err));
        }
    }

    function renderAvatarStack(assigneeIds) {
        if (!assigneeIds || assigneeIds.length === 0) {
            return `
                <div class="task-assignee">
                    <div class="task-assignee-avatar" style="background:#94A3B8">?</div>
                    <span class="task-assignee-name">Unassigned</span>
                </div>
            `;
        }

        const members = assigneeIds.map(getMember).filter(Boolean);
        const initialsList = members.map(m => m.name).join(', ');

        if (members.length === 1) {
            const m = members[0];
            return `
                <div class="task-assignee" title="${m.name} (${m.role})">
                    <div class="task-assignee-avatar" style="background:${m.color}">${m.initials}</div>
                    <span class="task-assignee-name">${m.name}</span>
                </div>
            `;
        }

        const stackHtml = members.map(m => `
            <div class="task-assignee-avatar" style="background:${m.color}" title="${m.name} (${m.role})">${m.initials}</div>
        `).join('');

        return `
            <div class="task-assignee" title="${initialsList}">
                <div class="avatar-stack">
                    ${stackHtml}
                </div>
            </div>
        `;
    }

    function populateAssigneesGrid() {
        const grid = byId('taskAssigneesGrid');
        if (!grid) return;

        loadOnlineStatuses();
        const now = Date.now();

        grid.innerHTML = TEAM.map(m => {
            const lastActive = onlineUsers[m.id] || 0;
            const isOnline = (now - lastActive) < 15000;
            return `
                <label class="assignee-checkbox-card ${isOnline ? 'online' : ''}" data-user-id="${m.id}">
                    <input type="checkbox" name="taskAssignees" value="${m.id}" onchange="this.parentElement.classList.toggle('active', this.checked)">
                    <div class="checkbox-avatar" style="background:${m.color}">${m.initials}</div>
                    <span class="checkbox-label" title="${m.name}">${m.name}</span>
                    <span class="checkbox-indicator" title="Online"></span>
                </label>
            `;
        }).join('');
    }

    function checkDeadlines() {
        let changed = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        tasks.forEach(t => {
            if (t.dueDate && t.status !== 'done' && t.status !== 'backlog') {
                const due = new Date(t.dueDate);
                if (due < today) {
                    const oldStatus = t.status;
                    t.status = 'backlog';
                    t.activity.push({
                        text: `Deadline passed. Automatically moved from ${getColumnName(oldStatus)} → Backlog`,
                        time: Date.now()
                    });
                    logStatusChange(t.id, oldStatus, 'backlog', 'System (Deadline Passed)');
                    changed = true;
                    showToast(`Task "${t.title}" moved to Backlog (missed deadline)`, 'error');
                }
            }
        });

        if (changed) {
            saveTasks();
            renderBoard();
        }
    }

    function acceptTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const oldStatus = task.status;
        task.status = 'progress';
        task.activity.push({
            text: `${currentUser.name} accepted the task (moved to In Progress)`,
            time: Date.now()
        });

        logStatusChange(task.id, oldStatus, 'progress');
        saveTasks();
        renderBoard();
        showToast('Task accepted', 'success');
    }

    function completeTLReview(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const oldStatus = task.status;
        task.status = 'done';
        task.activity.push({
            text: `TL Offline Review Completed by ${currentUser.name} (marked Done automatically)`,
            time: Date.now()
        });

        logStatusChange(task.id, oldStatus, 'done');
        saveTasks();
        renderBoard();
        showToast('Review completed. Task marked Done!', 'success');
    }

    // Daily Status Logs
    function logStatusChange(taskId, fromCol, toCol, userNameOverride = null) {
        loadLogs();
        const task = tasks.find(t => t.id === taskId);
        const name = userNameOverride || (currentUser ? currentUser.name : 'Unknown');
        const fromName = fromCol === 'none' ? 'None (Created)' : getColumnName(fromCol);
        
        const newLog = {
            id: uuid(),
            taskId,
            taskTitle: task ? task.title : 'Deleted Task',
            userName: name,
            fromStatus: fromName,
            toStatus: getColumnName(toCol),
            timestamp: Date.now()
        };
        statusLogs.unshift(newLog);
        
        if (statusLogs.length > 50) statusLogs.pop();
        saveStatusLogs(newLog);
        if (statusSidebarOpen) renderStatusSidebar();
    }

    function logOnlineSession(userId, type, details = '') {
        loadLogs();
        const member = getMember(userId);
        
        const newLog = {
            id: uuid(),
            userName: member ? member.name : 'Unknown',
            type,
            details,
            timestamp: Date.now()
        };
        onlineLogs.unshift(newLog);
        
        if (onlineLogs.length > 50) onlineLogs.pop();
        saveOnlineLogs(newLog);
        if (statusSidebarOpen) renderStatusSidebar();
    }

    function checkStatusRequests() {
        if (!currentUser) return;
        try {
            const requests = JSON.parse(localStorage.getItem(STATUS_REQUESTS_KEY)) || {};
            const lastSubmit = parseInt(localStorage.getItem('last_status_submit_' + currentUser.id) || '0');
            const requestTime = requests[currentUser.id] || 0;
            
            const indicator = byId('statusBadgeIndicator');
            if (requestTime > lastSubmit) {
                if (indicator) indicator.classList.remove('hidden');
                
                if (!sessionStorage.getItem('status_prompted_this_session')) {
                    sessionStorage.setItem('status_prompted_this_session', 'true');
                    toggleStatusSidebar(true);
                    openDailyStatusModal();
                }
            } else {
                if (indicator) indicator.classList.add('hidden');
            }
        } catch { /* ignore */ }
    }

    function renderStatusSidebar() {
        loadLogs();
        
        // Render Updates
        const updatesList = byId('statusUpdatesList');
        if (updatesList) {
            if (dailyUpdates.length === 0) {
                updatesList.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-tertiary);font-size:0.8rem;">No status updates submitted today.</div>';
            } else {
                updatesList.innerHTML = dailyUpdates.map(upd => {
                    const member = getMember(upd.userId);
                    return `
                        <div class="daily-status-card">
                            <div class="daily-status-card-header">
                                <div class="daily-status-user">
                                    <div class="daily-status-avatar" style="background:${member ? member.color : '#94A3B8'}">${member ? member.initials : '?'}</div>
                                    <span class="daily-status-name">${member ? member.name : 'Unknown'}</span>
                                </div>
                                <span class="daily-status-time">${formatTime(upd.timestamp)}</span>
                            </div>
                            <div class="daily-status-text">${escapeHtml(upd.text)}</div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Action Box
        const actionBox = byId('statusActionBox');
        if (actionBox && currentUser) {
            const isTLorCEO = currentUser.role === 'Team Lead' || currentUser.role === 'CEO';
            let actionHtml = `
                <span class="status-actions-title">My Actions</span>
                <button class="btn-primary btn-sm" id="btnSubmitStatus" style="width:100%;justify-content:center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    Submit My Status
                </button>
            `;
            if (isTLorCEO) {
                actionHtml += `
                    <button class="btn-secondary btn-sm" id="btnRequestStatus" style="width:100%;justify-content:center;margin-top:0.35rem;border-color:rgba(99,102,241,0.2)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        Request Status Updates
                    </button>
                `;
            }
            actionBox.innerHTML = actionHtml;
            
            byId('btnSubmitStatus').onclick = openDailyStatusModal;
            if (isTLorCEO && byId('btnRequestStatus')) {
                byId('btnRequestStatus').onclick = openRequestStatusModal;
            }
        }

        // Render Status Change Log
        const statusLogsList = byId('statusLogsList');
        if (statusLogsList) {
            if (statusLogs.length === 0) {
                statusLogsList.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-tertiary);font-size:0.8rem;">No status activity logged yet.</div>';
            } else {
                statusLogsList.innerHTML = statusLogs.map(log => `
                    <div class="log-item">
                        <div class="log-dot move"></div>
                        <div class="log-text">
                            <strong>${escapeHtml(log.userName)}</strong> updated <strong>${escapeHtml(log.taskTitle)}</strong>: 
                            <span style="opacity:0.85;">${escapeHtml(log.fromStatus)} &rarr; ${escapeHtml(log.toStatus)}</span>
                        </div>
                        <span class="log-time">${formatTime(log.timestamp)}</span>
                    </div>
                `).join('');
            }
        }

        // Render Online/Activity Log
        const onlineLogsList = byId('onlineLogsList');
        if (onlineLogsList) {
            if (onlineLogs.length === 0) {
                onlineLogsList.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-tertiary);font-size:0.8rem;">No login activity logged yet.</div>';
            } else {
                onlineLogsList.innerHTML = onlineLogs.map(log => {
                    if (log.type === 'request') {
                        return `
                            <div class="log-item">
                                <div class="log-dot request"></div>
                                <div class="log-text">
                                    <strong>${escapeHtml(log.userName)}</strong> ${escapeHtml(log.details || 'requested status updates')}
                                </div>
                                <span class="log-time">${formatTime(log.timestamp)}</span>
                            </div>
                        `;
                    }
                    const dotClass = log.type === 'login' ? 'online' : 'offline';
                    const actionWord = log.type === 'login' ? 'logged in' : 'logged out';
                    return `
                        <div class="log-item">
                            <div class="log-dot ${dotClass}"></div>
                            <div class="log-text">
                                <strong>${escapeHtml(log.userName)}</strong> ${actionWord}
                            </div>
                            <span class="log-time">${formatTime(log.timestamp)}</span>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    function toggleStatusSidebar(forceOpen = null) {
        const sidebar = byId('statusSidebar');
        const btn = byId('statusToggleBtn');
        if (!sidebar || !btn) return;

        const open = forceOpen !== null ? forceOpen : !statusSidebarOpen;
        statusSidebarOpen = open;

        if (open) {
            if (chatPanelOpen) {
                chatPanelOpen = false;
                byId('chatSidebar').classList.add('hidden');
                byId('chatToggleBtn').classList.remove('active');
            }
            
            sidebar.classList.remove('hidden');
            btn.classList.add('active');
            renderStatusSidebar();
        } else {
            sidebar.classList.add('hidden');
            btn.classList.remove('active');
        }
    }

    function openDailyStatusModal() {
        byId('dailyStatusForm').reset();
        byId('dailyStatusModal').classList.remove('hidden');
    }

    function closeDailyStatusModal() {
        byId('dailyStatusModal').classList.add('hidden');
    }

    function handleDailyStatusSubmit(e) {
        e.preventDefault();
        const text = byId('dailyStatusText').value.trim();
        if (!text) return;

        const newUpdate = {
            id: uuid(),
            userId: currentUser.id,
            text,
            timestamp: Date.now()
        };
        dailyUpdates.unshift(newUpdate);

        if (dailyUpdates.length > 50) dailyUpdates.pop();
        saveDailyUpdates(newUpdate);

        localStorage.setItem('last_status_submit_' + currentUser.id, Date.now());

        // Remove request
        try {
            const requests = JSON.parse(localStorage.getItem(STATUS_REQUESTS_KEY)) || {};
            delete requests[currentUser.id];
            localStorage.setItem(STATUS_REQUESTS_KEY, JSON.stringify(requests));
        } catch { /* ignore */ }

        closeDailyStatusModal();
        renderStatusSidebar();
        checkStatusRequests();
        showToast('Daily status submitted successfully!', 'success');
    }

    function openRequestStatusModal() {
        const grid = byId('requestStatusGrid');
        if (!grid) return;

        grid.innerHTML = TEAM.filter(m => m.id !== currentUser.id).map(m => `
            <label class="assignee-checkbox-card" data-user-id="${m.id}">
                <input type="checkbox" name="requestMembers" value="${m.id}" onchange="this.parentElement.classList.toggle('active', this.checked)">
                <div class="checkbox-avatar" style="background:${m.color}">${m.initials}</div>
                <span class="checkbox-label" title="${m.name}">${m.name}</span>
            </label>
        `).join('');

        byId('requestStatusForm').reset();
        byId('requestStatusModal').classList.remove('hidden');
    }

    function closeRequestStatusModal() {
        byId('requestStatusModal').classList.add('hidden');
    }

    function handleRequestStatusSubmit(e) {
        e.preventDefault();
        const checked = document.querySelectorAll('input[name="requestMembers"]:checked');
        const memberIds = Array.from(checked).map(cb => cb.value);

        if (memberIds.length === 0) {
            showToast('Please select at least one team member', 'error');
            return;
        }

        try {
            const requests = JSON.parse(localStorage.getItem(STATUS_REQUESTS_KEY)) || {};
            const names = memberIds.map(id => {
                const m = getMember(id);
                requests[id] = Date.now();
                return m ? m.name : id;
            }).join(', ');

            localStorage.setItem(STATUS_REQUESTS_KEY, JSON.stringify(requests));

            logOnlineSession(currentUser.id, 'request', `requested daily status from ${names}`);
            
            // Dispatch storage event to alert other tabs
            localStorage.setItem('bitsotron_trigger_request_sync', Date.now());
        } catch { /* ignore */ }

        closeRequestStatusModal();
        showToast('Daily status requested from team members!', 'success');
    }

    function setupStatusSidebar() {
        loadLogs();
        
        // Chat Toggle overrides Status Sidebar
        byId('chatToggleBtn').addEventListener('click', () => {
            if (chatPanelOpen && statusSidebarOpen) {
                statusSidebarOpen = false;
                byId('statusSidebar').classList.add('hidden');
                byId('statusToggleBtn').classList.remove('active');
            }
        });
        
        // Status Toggle button event listener
        byId('statusToggleBtn').addEventListener('click', () => {
            toggleStatusSidebar();
        });

        renderStatusSidebar();
    }

    // ═══════ INIT ═══════
    async function init() {
        await loadTasks();
        await loadLogs();
        renderLogin();
        bindEvents();

        if (loadSession()) {
            showApp();
        } else {
            showLogin();
        }
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

    }, []);

    return (
        <div dangerouslySetInnerHTML={{ __html: `


    <!-- ═══════════════ LOGIN SCREEN ═══════════════ -->
    <div id="loginScreen" class="login-screen">
        <div class="login-container">
            <div class="login-brand">
                <div class="brand-icon">
                    <img src="Logo.png" alt="Bitsotron" class="brand-logo">
                </div>
                <h1 class="brand-title">Bitsotron Kanban</h1>
                <p class="brand-subtitle">Select your profile to continue</p>
            </div>
            <div class="login-roles" id="loginRoles">
                <!-- Rendered by JS -->
            </div>
            <div class="login-password-section hidden" id="loginPasswordSection">
                <div class="login-selected-user" id="loginSelectedUser"></div>
                <div class="login-password-field">
                    <input type="password" id="loginPassword" class="form-input login-pass-input" placeholder="Enter password" autocomplete="off">
                    <span class="login-error hidden" id="loginError">Incorrect password</span>
                </div>
                <div class="login-password-actions">
                    <button type="button" class="btn-secondary" id="loginBackBtn">Back</button>
                    <button type="button" class="btn-primary" id="loginSubmitBtn">Sign In</button>
                </div>
            </div>
        </div>
        <div class="login-mesh-bg"></div>
    </div>

    <!-- ═══════════════ MAIN APP ═══════════════ -->
    <div id="appContainer" class="app-container hidden">

        <!-- ── Header ── -->
        <header class="app-header">
            <div class="header-left">
                <div class="header-brand">
                    <img src="Logo.png" alt="Bitsotron" class="header-logo">
                    <span class="header-title">Bitsotron Kanban</span>
                </div>
            </div>
            <div class="header-center">
                <div class="search-bar">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input type="text" id="searchInput" class="search-input" placeholder="Search tasks…">
                </div>
            </div>
            <div class="header-right">
                <div class="header-filters">
                    <select id="filterAssignee" class="filter-select">
                        <option value="">All Members</option>
                    </select>
                    <select id="filterPriority" class="filter-select">
                        <option value="">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <button id="myTasksBtn" class="btn-filter-toggle" title="My Tasks">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>My Tasks</span>
                    </button>
                </div>
                <button id="pinnedToggleBtn" class="btn-filter-toggle" title="Pinned Items">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L12 12"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><circle cx="12" cy="2" r="1" fill="currentColor"/></svg>
                    <span>Pinned</span>
                    <span class="pin-count-badge" id="pinCountBadge">0</span>
                </button>
                <button id="chatToggleBtn" class="btn-filter-toggle" title="Public Chat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>Chat</span>
                    <span class="chat-unread-badge hidden" id="chatUnreadBadge">0</span>
                </button>
                <button id="statusToggleBtn" class="btn-filter-toggle" title="Daily Status">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>Status</span>
                    <span class="status-badge hidden" id="statusBadgeIndicator"></span>
                </button>
                <button id="newTaskBtn" class="btn-primary hidden" title="New Task">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    <span>New Task</span>
                </button>
                <div class="user-badge" id="userBadge">
                    <div class="user-avatar" id="userAvatar"></div>
                    <div class="user-info">
                        <span class="user-name" id="userName"></span>
                        <span class="user-role" id="userRole"></span>
                    </div>
                </div>
                <button id="logoutBtn" class="btn-icon" title="Logout">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
            </div>
        </header>

        <!-- ── Pinned Panel ── -->
        <div id="pinnedPanel" class="pinned-panel hidden">
            <div class="pinned-panel-header">
                <h3 class="pinned-panel-title">Pinned Items</h3>
                <button id="addPinBtn" class="btn-primary btn-sm hidden" title="Add Pin">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    <span>Add Pin</span>
                </button>
            </div>
            <div class="pinned-grid" id="pinnedGrid">
                <!-- Rendered by JS -->
            </div>
        </div>

        <!-- ── Layout wrapper ── -->
        <div class="app-layout">
            <!-- ── Board ── -->
            <main class="board" id="board">
                <!-- Columns rendered by JS -->
            </main>

            <!-- ── Chat Sidebar ── -->
            <aside id="chatSidebar" class="chat-sidebar hidden">
                <div class="chat-sidebar-header">
                    <h3 class="chat-sidebar-title">Public Chat</h3>
                </div>
                
                <div class="chat-members-section">
                    <div class="chat-members-list" id="chatMembersList">
                        <!-- Rendered by JS -->
                    </div>
                </div>

                <div class="chat-messages" id="chatMessages">
                    <!-- Rendered by JS -->
                </div>

                <form id="chatForm" class="chat-input-area">
                    <input type="text" id="chatInput" placeholder="Type a message..." maxlength="200" required autocomplete="off">
                    <button type="submit" class="btn-primary btn-chat-send" title="Send">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </form>
            </aside>

            <!-- ── Daily Status Sidebar ── -->
            <aside id="statusSidebar" class="status-sidebar hidden">
                <div class="status-sidebar-header">
                    <h3 class="status-sidebar-title">Daily Status & Logs</h3>
                </div>
                <div class="status-tabs">
                    <button class="status-tab-btn active" data-tab="updates">Updates</button>
                    <button class="status-tab-btn" data-tab="status-logs">Status Log</button>
                    <button class="status-tab-btn" data-tab="online-logs">Online Log</button>
                </div>
                <div class="status-tab-content">
                    <!-- Updates Tab -->
                    <div class="status-tab-pane active" id="paneUpdates">
                        <div class="status-actions-box" id="statusActionBox">
                            <!-- Populated by JS -->
                        </div>
                        <div id="statusUpdatesList" style="display:flex;flex-direction:column;gap:0.75rem;">
                            <!-- Rendered by JS -->
                        </div>
                    </div>
                    <!-- Status Log Tab -->
                    <div class="status-tab-pane" id="paneStatusLogs">
                        <div id="statusLogsList" style="display:flex;flex-direction:column;gap:0.5rem;">
                            <!-- Rendered by JS -->
                        </div>
                    </div>
                    <!-- Online Log Tab -->
                    <div class="status-tab-pane" id="paneOnlineLogs">
                        <div id="onlineLogsList" style="display:flex;flex-direction:column;gap:0.5rem;">
                            <!-- Rendered by JS -->
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    </div>

    <!-- ═══════════════ TASK MODAL (Create/Edit) ═══════════════ -->
    <div id="taskModal" class="modal-overlay hidden">
        <div class="modal glass-panel">
            <div class="modal-header">
                <h2 id="modalTitle">New Task</h2>
                <button class="btn-icon modal-close" id="modalCloseBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <form id="taskForm" class="modal-body">
                <input type="hidden" id="taskId">
                <div class="form-group">
                    <label for="taskTitle">Title <span class="required">*</span></label>
                    <input type="text" id="taskTitle" class="form-input" placeholder="e.g. Fix authentication bug" required maxlength="100">
                </div>
                <div class="form-group">
                    <label for="taskDescription">Description</label>
                    <textarea id="taskDescription" class="form-input form-textarea" placeholder="Add details, context, or instructions…" rows="3" maxlength="500"></textarea>
                </div>
                <div class="form-group">
                    <label>Assignees <span class="required">*</span></label>
                    <div class="assignees-grid" id="taskAssigneesGrid">
                        <!-- Populated by JS -->
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="taskPriority">Priority <span class="required">*</span></label>
                        <select id="taskPriority" class="form-input" required>
                            <option value="">Select priority</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="taskDueDate">Due Date</label>
                        <input type="date" id="taskDueDate" class="form-input">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="modalCancelBtn">Cancel</button>
                    <button type="submit" class="btn-primary" id="modalSubmitBtn">Create Task</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ═══════════════ TASK DETAIL MODAL ═══════════════ -->
    <div id="detailModal" class="modal-overlay hidden">
        <div class="modal glass-panel modal-detail">
            <div class="modal-header">
                <div class="detail-header-left">
                    <span class="detail-priority-badge" id="detailPriority"></span>
                    <span class="detail-status-badge" id="detailStatus"></span>
                </div>
                <button class="btn-icon modal-close" id="detailCloseBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="modal-body detail-body">
                <h2 class="detail-title" id="detailTitle"></h2>
                <p class="detail-description" id="detailDescription"></p>

                <div class="detail-meta">
                    <div class="meta-item">
                        <span class="meta-label">Assignee</span>
                        <div class="meta-value" id="detailAssignee"></div>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Due Date</span>
                        <div class="meta-value" id="detailDueDate"></div>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Created By</span>
                        <div class="meta-value" id="detailCreatedBy"></div>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Created At</span>
                        <div class="meta-value" id="detailCreatedAt"></div>
                    </div>
                </div>

                <div class="detail-activity">
                    <h3 class="activity-heading">Activity Log</h3>
                    <div class="activity-list" id="detailActivityList">
                        <!-- Rendered by JS -->
                    </div>
                </div>
            </div>
            <div class="modal-footer detail-footer" id="detailActions">
                <button class="btn-secondary btn-edit" id="detailEditBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                </button>
                <button class="btn-danger" id="detailDeleteBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                </button>
            </div>
        </div>
    </div>

    <!-- ═══════════════ DELETE CONFIRMATION ═══════════════ -->
    <div id="deleteModal" class="modal-overlay hidden">
        <div class="modal glass-panel modal-sm">
            <div class="modal-body" style="text-align:center;padding:2rem;">
                <div class="delete-icon-wrap">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                </div>
                <h3 style="margin:1rem 0 .5rem;font-weight:700;">Delete this task?</h3>
                <p style="color:var(--text-secondary);font-size:.9rem;">This action cannot be undone.</p>
            </div>
            <div class="modal-footer" style="justify-content:center;gap:1rem;padding-bottom:1.5rem;">
                <button class="btn-secondary" id="deleteCancelBtn">Cancel</button>
                <button class="btn-danger" id="deleteConfirmBtn">Delete</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════ PIN MODAL (Create/Edit) ═══════════════ -->
    <div id="pinModal" class="modal-overlay hidden">
        <div class="modal glass-panel modal-pin">
            <div class="modal-header">
                <h2 id="pinModalTitle">Add Pin</h2>
                <button class="btn-icon modal-close" id="pinModalCloseBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <form id="pinForm" class="modal-body">
                <input type="hidden" id="pinId">
                <div class="form-group">
                    <label for="pinType">Type <span class="required">*</span></label>
                    <select id="pinType" class="form-input" required>
                        <option value="">Select type</option>
                        <option value="note">Note</option>
                        <option value="link">Link</option>
                        <option value="api">API</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="pinTitle">Title <span class="required">*</span></label>
                    <input type="text" id="pinTitle" class="form-input" placeholder="e.g. Production DB credentials" required maxlength="80">
                </div>
                <div class="form-group" id="pinUrlGroup" style="display:none;">
                    <label for="pinUrl">URL <span class="required">*</span></label>
                    <input type="url" id="pinUrl" class="form-input" placeholder="https://...">
                </div>
                <div class="form-group" id="pinMethodGroup" style="display:none;">
                    <label for="pinMethod">Method</label>
                    <select id="pinMethod" class="form-input">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="pinContent">Content</label>
                    <textarea id="pinContent" class="form-input form-textarea" placeholder="Details, description, or notes..." rows="3" maxlength="500"></textarea>
                </div>
                <div class="form-group">
                    <label for="pinColor">Color</label>
                    <div class="pin-color-picker" id="pinColorPicker">
                        <button type="button" class="pin-color-swatch active" data-color="#6366F1" style="background:#6366F1"></button>
                        <button type="button" class="pin-color-swatch" data-color="#3B82F6" style="background:#3B82F6"></button>
                        <button type="button" class="pin-color-swatch" data-color="#10B981" style="background:#10B981"></button>
                        <button type="button" class="pin-color-swatch" data-color="#F59E0B" style="background:#F59E0B"></button>
                        <button type="button" class="pin-color-swatch" data-color="#EF4444" style="background:#EF4444"></button>
                        <button type="button" class="pin-color-swatch" data-color="#EC4899" style="background:#EC4899"></button>
                        <button type="button" class="pin-color-swatch" data-color="#94A3B8" style="background:#94A3B8"></button>
                    </div>
                    <input type="hidden" id="pinColor" value="#6366F1">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="pinCancelBtn">Cancel</button>
                    <button type="submit" class="btn-primary" id="pinSubmitBtn">Add Pin</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ═══════════════ DAILY STATUS MODAL ═══════════════ -->
    <div id="dailyStatusModal" class="modal-overlay hidden">
        <div class="modal glass-panel modal-sm">
            <div class="modal-header">
                <h2>Daily Status Update</h2>
                <button class="btn-icon modal-close" id="dailyStatusCloseBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <form id="dailyStatusForm" class="modal-body">
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="dailyStatusText">What did you accomplish today? <span class="required">*</span></label>
                    <textarea id="dailyStatusText" class="form-input form-textarea" placeholder="Describe your tasks, progress, or blockers..." required maxlength="300" rows="4"></textarea>
                </div>
                <div class="modal-footer" style="padding:0;">
                    <button type="button" class="btn-secondary" id="dailyStatusCancelBtn">Cancel</button>
                    <button type="submit" class="btn-primary">Submit Status</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ═══════════════ REQUEST STATUS MODAL ═══════════════ -->
    <div id="requestStatusModal" class="modal-overlay hidden">
        <div class="modal glass-panel modal-sm">
            <div class="modal-header">
                <h2>Request Daily Status</h2>
                <button class="btn-icon modal-close" id="requestStatusCloseBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <form id="requestStatusForm" class="modal-body">
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>Select Team Members <span class="required">*</span></label>
                    <div class="assignees-grid" id="requestStatusGrid">
                        <!-- Checkboxes populated by JS -->
                    </div>
                </div>
                <div class="modal-footer" style="padding:0;">
                    <button type="button" class="btn-secondary" id="requestStatusCancelBtn">Cancel</button>
                    <button type="submit" class="btn-primary">Send Request</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ═══════════════ PIN DETAIL MODAL ═══════════════ -->
    <div id="pinDetailModal" class="modal-overlay hidden">
        <div class="modal glass-panel modal-sm" style="border-radius: var(--radius-xl); overflow: hidden;">
            <div class="modal-header">
                <span id="pinDetailType" class="pin-type-badge note">Note</span>
                <button class="btn-icon modal-close" id="pinDetailCloseBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: 0 1.5rem 1.5rem 1.5rem;">
                <h2 id="pinDetailTitle" style="margin: 0.5rem 0 1rem 0; font-size: 1.3rem; font-weight: 700; color: var(--text-primary); line-height: 1.4; word-wrap: break-word;">Pin Title</h2>
                <div id="pinDetailContent" style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; margin-bottom: 1.5rem; word-break: break-word;">Pin content goes here...</div>
                <div id="pinDetailUrlSection" style="margin-bottom: 1.5rem; display: none;">
                    <span style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Reference Link</span>
                    <a id="pinDetailUrl" href="#" target="_blank" rel="noopener" class="pin-card-url" style="display: inline-flex; width: 100%;">
                        <span id="pinDetailMethod" class="pin-method-badge get" style="margin-right: 8px; display: none;">GET</span>
                        <span id="pinDetailUrlText" style="word-break: break-all;">https://...</span>
                    </a>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem; font-size: 0.8rem; color: var(--text-tertiary);">
                    <span id="pinDetailAuthor">by Unknown</span>
                    <span id="pinDetailDate">June 12, 2026</span>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══════════════ TOAST CONTAINER ═══════════════ -->
    <div id="toastContainer" class="toast-container"></div>

    

        ` }} />
    );
}
