
        const API_BASE = window.location.origin + '/api/v1';
        let token = localStorage.getItem('token');
        let currentUser = null;
        let html5QrCode = null;
        let isScanning = false;

        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
            status.classList.remove('hidden');
            setTimeout(() => status.classList.add('hidden'), 3000);
        }

        function checkAuth() {
            const storedToken = localStorage.getItem('token');
            console.log('checkAuth: token from storage =', storedToken ? 'exists' : 'null');
            if (storedToken) {
                token = storedToken;
                loadUserInfo();
            }
        }

        async function loadUserInfo() {
            console.log('loadUserInfo: token =', token ? 'exists' : 'null');
            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log('loadUserInfo: response status =', res.status);
                if (res.ok) {
                    const user = await res.json();
                    console.log('loadUserInfo: user =', user);
                    currentUser = user;
                    document.getElementById('userInfo').textContent = `${user.username} (${translateRole(user.role)})`;
                    document.getElementById('loginCard').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');
                    
                    // Show panel based on role
                    document.getElementById('developerPanel').classList.add('hidden');
                    document.getElementById('adminPanel').classList.add('hidden');
                    document.getElementById('studentPanel').classList.add('hidden');
                    
                    if (user.role === 'developer') {
                        document.getElementById('developerPanel').classList.remove('hidden');
                        loadUsers();
                    } else if (user.role === 'admin') {
                        document.getElementById('adminPanel').classList.remove('hidden');
                        loadQrCodes();
                        loadTodayAttendance();
                        loadStats();
                    } else if (user.role === 'student') {
                        document.getElementById('studentPanel').classList.remove('hidden');
                        loadMyAttendance();
                    }
                } else {
                    const err = await res.json();
                    console.error('loadUserInfo: error =', err);
                    logout();
                }
            } catch (e) {
                console.error('loadUserInfo: exception =', e);
            }
        }

        function translateRole(role) {
            const roles = { 'developer': 'Разработчик', 'admin': 'Админ', 'student': 'Студент' };
            return roles[role] || role;
        }

        // Developer functions
        async function loadUsers() {
            try {
                const res = await fetch(`${API_BASE}/auth/users`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const list = document.getElementById('userList');
                if (res.ok) {
                    const users = await res.json();
                    list.innerHTML = users.map(u => 
                        `<div class="user-list-item">
                            <strong>${u.username}</strong>
                            <span class="role-badge role-${u.role}">${translateRole(u.role)}</span>
                        </div>`
                    ).join('');
                } else {
                    list.innerHTML = '<p style="color: #6e6e73;">Не удалось загрузить</p>';
                }
            } catch (e) {
                document.getElementById('userList').innerHTML = '<p style="color: #6e6e73;">Ошибка</p>';
            }
        }

        document.getElementById('createUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('newUsername').value;
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;

            try {
                const res = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password, role })
                });

                if (res.ok) {
                    showStatus('Пользователь создан!', 'success');
                    document.getElementById('createUserForm').reset();
                    loadUsers();
                } else {
                    const err = await res.json();
                    showStatus(err.detail || 'Ошибка', 'error');
                }
            } catch (e) {
                showStatus('Ошибка соединения', 'error');
            }
        });

        // Admin functions
        async function loadQrCodes() {
            try {
                const res = await fetch(`${API_BASE}/attendance/qr/list`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const list = document.getElementById('qrList');
                console.log('QR response status:', res.status);
                if (res.ok) {
                    const qrs = await res.json();
                    console.log('QR codes:', qrs);
                    if (qrs.length === 0) {
                        list.innerHTML = '<p style="color: #6e6e73;">Нет QR-кодов. Создайте первый!</p>';
                    } else {
                        list.innerHTML = qrs.map(qr => 
                            `<div class="qr-item">
                                <div>
                                    <div class="qr-secret">${qr.secret}</div>
                                    <small>${qr.label || 'Без названия'} • ${qr.is_active ? '✅ Активен' : '❌ Неактивен'}</small>
                                </div>
                                <div class="qr-actions">
                                    ${qr.is_active 
                                        ? `<button class="btn-danger" onclick="deactivateQr('${qr.id}')">Отключить</button>`
                                        : `<button class="btn-success" onclick="activateQr('${qr.id}')">Включить</button>`
                                    }
                                    <button class="btn-danger" onclick="deleteQr('${qr.id}')">Удалить</button>
                                </div>
                            </div>`
                        ).join('');
                    }
                } else {
                    const err = await res.json();
                    console.error('QR load error:', err);
                    list.innerHTML = '<p style="color: #6e6e73;">Ошибка: ' + (err.detail || 'Не удалось загрузить') + '</p>';
                }
            } catch (e) {
                console.error('QR load exception:', e);
                document.getElementById('qrList').innerHTML = '<p style="color: #6e6e73;">Ошибка: ' + e.message + '</p>';
            }
        }

        document.getElementById('createQrForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const label = document.getElementById('qrLabel').value;

            try {
                const res = await fetch(`${API_BASE}/attendance/qr/generate`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ label })
                });

                if (res.ok) {
                    showStatus('QR-код создан!', 'success');
                    document.getElementById('createQrForm').reset();
                    loadQrCodes();
                } else {
                    const err = await res.json();
                    showStatus(err.detail || 'Ошибка', 'error');
                }
            } catch (e) {
                showStatus('Ошибка соединения', 'error');
            }
        });

        async function deactivateQr(id) {
            try {
                const res = await fetch(`${API_BASE}/attendance/qr/${id}/deactivate`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    showStatus('QR отключён', 'success');
                    loadQrCodes();
                }
            } catch (e) {
                showStatus('Ошибка', 'error');
            }
        }

        async function activateQr(id) {
            try {
                const res = await fetch(`${API_BASE}/attendance/qr/${id}/activate`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    showStatus('QR включён', 'success');
                    loadQrCodes();
                }
            } catch (e) {
                showStatus('Ошибка', 'error');
            }
        }

        async function deleteQr(id) {
            if (!confirm('Удалить QR-код?')) return;
            try {
                const res = await fetch(`${API_BASE}/attendance/qr/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    showStatus('QR удалён', 'success');
                    loadQrCodes();
                }
            } catch (e) {
                showStatus('Ошибка', 'error');
            }
        }

        async function loadTodayAttendance() {
            try {
                const res = await fetch(`${API_BASE}/attendance/today`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const list = document.getElementById('todayAttendance');
                if (res.ok) {
                    const records = await res.json();
                    if (records.length === 0) {
                        list.innerHTML = '<p style="color: #6e6e73;">Пока нет посещений</p>';
                    } else {
                        list.innerHTML = records.map(r => 
                            `<div class="stat-item">
                                <span>${r.username}</span>
                                <span>${new Date(r.timestamp).toLocaleTimeString('ru-RU')}</span>
                            </div>`
                        ).join('');
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function loadStats() {
            try {
                const res = await fetch(`${API_BASE}/attendance/percentage`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const div = document.getElementById('attendanceStats');
                if (res.ok) {
                    const stats = await res.json();
                    div.innerHTML = `
                        <div class="stat-item"><span>Всего студентов:</span><strong>${stats.total_registered_students}</strong></div>
                        <div class="stat-item"><span>Отметились:</span><strong>${stats.total_attended_students}</strong></div>
                        <div class="stat-item"><span>Процент:</span><strong>${stats.attendance_percentage}%</strong></div>
                    `;
                }
            } catch (e) {
                console.error(e);
            }
        }

        // Student functions
        async function loadMyAttendance() {
            try {
                const res = await fetch(`${API_BASE}/attendance/records`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const list = document.getElementById('myAttendance');
                if (res.ok) {
                    const records = await res.json();
                    if (records.length === 0) {
                        list.innerHTML = '<p style="color: #6e6e73;">Нет посещений</p>';
                    } else {
                        list.innerHTML = records.map(r => 
                            `<div class="stat-item">
                                <span>${new Date(r.timestamp).toLocaleDateString('ru-RU')}</span>
                                <span>${new Date(r.timestamp).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>`
                        ).join('');
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function startScan() {
            const scanBtn = document.getElementById('scanBtn');
            const qrVideo = document.getElementById('qrVideo');
            const qrReader = document.getElementById('qrReader');
            const scanHint = document.getElementById('scanHint');
            
            if (isScanning) {
                // Stop scanning
                if (html5QrCode) {
                    await html5QrCode.stop();
                    html5QrCode = null;
                }
                isScanning = false;
                scanBtn.textContent = '📷 Сканировать QR';
                scanBtn.style.background = '#0071e3';
                qrVideo.style.display = 'none';
                qrReader.style.display = 'none';
                return;
            }

            // Request camera access
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                
                // Camera permission granted
                qrVideo.style.display = 'block';
                qrVideo.srcObject = stream;
                qrReader.style.display = 'block';
                
                html5QrCode = new Html5Qrcode('qrReader');
                
                await html5QrCode.start(
                    { facingMode: 'environment' },
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    async (decodedText) => {
                        await scanQr(decodedText);
                    },
                    (error) => {
                        // Ignore scan errors, keep trying
                    }
                );
                
                isScanning = true;
                scanBtn.textContent = '⏹ Остановить';
                scanBtn.style.background = '#ff3b30';
                
            } catch (err) {
                console.error('Camera error:', err);
                scanHint.style.display = 'block';
                
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    showStatus('❌ Доступ к камере запрещён. Разрешите в настройках браузера.', 'error');
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    showStatus('❌ Камера не найдена', 'error');
                } else if (err.name === 'NotReadableError') {
                    showStatus('❌ Камера занята другим приложением', 'error');
                } else if (window.location.protocol === 'http:') {
                    showStatus('❌ Камера требует HTTPS. Используйте ручной ввод.', 'error');
                } else {
                    showStatus('❌ Ошибка камеры: ' + err.message, 'error');
                }
            }
        }

        async function manualScan() {
            const secret = document.getElementById('manualSecret').value;
            if (!secret) {
                showStatus('Введите секрет', 'error');
                return;
            }
            await scanQr(secret);
        }

        async function scanQr(secret) {
            // Stop camera if running
            if (html5QrCode) {
                try {
                    await html5QrCode.stop();
                } catch (e) {}
                html5QrCode = null;
            }
            const videoEl = document.getElementById('qrVideo');
            const stream = videoEl && videoEl.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (videoEl) videoEl.style.display = 'none';
            const readerEl = document.getElementById('qrReader');
            if (readerEl) readerEl.style.display = 'none';
            const scanBtnEl = document.getElementById('scanBtn');
            if (scanBtnEl) {
                scanBtnEl.textContent = '📷 Сканировать QR';
                scanBtnEl.style.background = '#0071e3';
            }
            isScanning = false;

            try {
                const res = await fetch(`${API_BASE}/attendance/scan`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ secret })
                });

                if (res.ok) {
                    showStatus('✅ Вы успешно отметились!', 'success');
                    const manualEl = document.getElementById('manualSecret');
                    if (manualEl) manualEl.value = '';
                    loadMyAttendance();
                } else {
                    let msg = 'Ошибка';
                    try {
                        const err = await res.json();
                        msg = err.detail || JSON.stringify(err);
                    } catch (e) {
                        msg = await res.text();
                    }
                    showStatus(msg || 'Ошибка', 'error');
                }
            } catch (e) {
                showStatus('Ошибка соединения', 'error');
            }
        }

        async function manualScan() {
            const secretEl = document.getElementById('manualSecret');
            const secret = secretEl ? secretEl.value : '';
            if (!secret) {
                showStatus('Введите секрет', 'error');
                return;
            }
            await scanQr(secret);
        }

        function logout() {
            // Stop camera if running
            if (html5QrCode) {
                html5QrCode.stop().catch(() => {});
                html5QrCode = null;
            }
            const stream = document.getElementById('qrVideo').srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            localStorage.removeItem('token');
            token = null;
            currentUser = null;
            document.getElementById('loginCard').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('loginForm').reset();
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            console.log('Login attempt:', username);

            try {
                // Use urlencoded form which is standard for OAuth2 form parsing
                const params = new URLSearchParams();
                params.append('username', username);
                params.append('password', password);

                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: params.toString()
                });

                console.log('Login response status:', res.status);
                if (res.ok) {
                    const data = await res.json();
                    console.log('Login response data:', data);
                    token = data.access_token;
                    localStorage.setItem('token', token);
                    console.log('Token saved to localStorage');
                    checkAuth();
                    showStatus('Вход выполнен!', 'success');
                } else {
                    let errMsg = 'Ошибка входа';
                    try {
                        const err = await res.json();
                        console.error('Login error:', err);
                        errMsg = err.detail || JSON.stringify(err);
                    } catch (parseErr) {
                        console.error('Failed to parse login error:', parseErr);
                        errMsg = await res.text();
                    }
                    showStatus(errMsg || 'Ошибка входа', 'error');
                }
            } catch (e) {
                console.error('Login exception:', e);
                showStatus('Ошибка соединения', 'error');
            }
        });

        checkAuth();
    