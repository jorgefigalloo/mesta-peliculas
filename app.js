// ===== MESTA CINE - APP.JS =====
// Manages movies stored in localStorage, Google Drive embedding, and UI

(function () {
    'use strict';

    // ===== STORAGE =====
    const STORAGE_KEY = 'mestaCine_movies';

    function getMovies() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveMovies(movies) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
    }

    // ===== GOOGLE DRIVE HELPERS =====
    function extractDriveFileId(url) {
        if (!url) return null;
        // Format: https://drive.google.com/file/d/{ID}/view...
        const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileMatch) return fileMatch[1];
        // Format: https://drive.google.com/open?id={ID}
        const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (openMatch) return openMatch[1];
        return null;
    }

    function getDriveEmbedUrl(fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    function getDriveThumbnailUrl(fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }

    // ===== GENRE EMOJI MAP =====
    const genreEmojis = {
        'Acción': '🎯',
        'Aventura': '🗺️',
        'Animación': '🎨',
        'Comedia': '😂',
        'Drama': '🎭',
        'Familiar': '👨‍👩‍👧‍👦',
        'Fantasía': '🧙',
        'Terror': '👻',
        'Romance': '💕',
        'Ciencia Ficción': '🚀',
        'Suspenso': '🔍',
        'Documental': '📹'
    };

    // ===== COVER GRADIENTS (for movies without cover) =====
    const coverGradients = [
        'linear-gradient(135deg, #1e1b4b, #4c1d95)',
        'linear-gradient(135deg, #1e3a5f, #0e7490)',
        'linear-gradient(135deg, #3b1d4e, #7c3aed)',
        'linear-gradient(135deg, #1a2744, #2563eb)',
        'linear-gradient(135deg, #2d1b35, #be185d)',
        'linear-gradient(135deg, #1c2e1c, #16a34a)',
        'linear-gradient(135deg, #3d1f1f, #dc2626)',
        'linear-gradient(135deg, #2e1a3f, #9333ea)',
    ];

    // ===== DOM ELEMENTS =====
    const $searchInput = document.getElementById('search-input');
    const $moviesGrid = document.getElementById('movies-grid');
    const $emptyState = document.getElementById('empty-state');
    const $noResults = document.getElementById('no-results');
    const $movieCount = document.getElementById('movie-count');
    const $statMovies = document.getElementById('stat-movies');
    const $statGenres = document.getElementById('stat-genres');
    const $filtersContainer = document.querySelector('.filters-container');

    // Player modal
    const $playerModal = document.getElementById('player-modal');
    const $playerIframe = document.getElementById('player-iframe');
    const $playerTitle = document.getElementById('player-title');
    const $playerYear = document.getElementById('player-year');
    const $playerDescription = document.getElementById('player-description');
    const $playerGenres = document.getElementById('player-genres');

    // Admin modal
    const $adminModal = document.getElementById('admin-modal');
    const $movieForm = document.getElementById('movie-form');
    const $adminMoviesList = document.getElementById('admin-movies-list');
    const $fileImport = document.getElementById('file-import');

    // State
    let currentFilter = 'all';
    let searchQuery = '';
    let editingMovieId = null;

    // ===== INIT =====
    function init() {
        bindEvents();
        renderAll();
        initNavbarScroll();

        // Load sample data if first visit
        if (getMovies().length === 0) {
            loadSampleMovies();
            renderAll();
        }
    }

    function loadSampleMovies() {
        const samples = [
            {
                id: generateId(),
                title: 'Película Familiar - Ejemplo',
                driveLink: 'https://drive.google.com/file/d/1ycrwYGEst6qiY4EzvG8gIuDRPTPwCXro/view?usp=sharing',
                year: 2024,
                genre: 'Familiar',
                description: 'Esta es una película de ejemplo. ¡Puedes editarla o eliminarla desde el panel de administración!',
                cover: '',
                createdAt: Date.now()
            }
        ];
        saveMovies(samples);
    }

    // ===== EVENTS =====
    function bindEvents() {
        // Search
        $searchInput.addEventListener('input', debounce(function () {
            searchQuery = this.value.trim().toLowerCase();
            renderMovies();
        }, 250));

        // Admin button
        document.getElementById('btn-admin').addEventListener('click', openAdmin);
        document.getElementById('btn-close-admin').addEventListener('click', closeAdmin);
        document.getElementById('admin-backdrop').addEventListener('click', closeAdmin);

        // Player
        document.getElementById('btn-close-player').addEventListener('click', closePlayer);
        document.getElementById('player-backdrop').addEventListener('click', closePlayer);

        // Form
        $movieForm.addEventListener('submit', handleFormSubmit);

        // Add first movie button
        document.getElementById('btn-add-first').addEventListener('click', openAdmin);

        // Export / Import
        document.getElementById('btn-export').addEventListener('click', exportData);
        document.getElementById('btn-import').addEventListener('click', () => $fileImport.click());
        $fileImport.addEventListener('change', importData);

        // Brand click goes to top
        document.getElementById('brand-home').addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (!$playerModal.classList.contains('hidden')) closePlayer();
                else if (!$adminModal.classList.contains('hidden')) closeAdmin();
            }
        });
    }

    // ===== RENDER ALL =====
    function renderAll() {
        renderFilters();
        renderMovies();
        renderStats();
        renderAdminList();
    }

    // ===== RENDER MOVIES =====
    function renderMovies() {
        const movies = getMovies();
        let filtered = movies;

        // Filter by genre
        if (currentFilter !== 'all') {
            filtered = filtered.filter(m => m.genre === currentFilter);
        }

        // Search
        if (searchQuery) {
            filtered = filtered.filter(m =>
                m.title.toLowerCase().includes(searchQuery) ||
                (m.genre && m.genre.toLowerCase().includes(searchQuery)) ||
                (m.description && m.description.toLowerCase().includes(searchQuery))
            );
        }

        // Sort by most recent
        filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Toggle states
        $moviesGrid.innerHTML = '';
        $emptyState.classList.toggle('hidden', movies.length > 0);
        $noResults.classList.toggle('hidden', filtered.length > 0 || movies.length === 0);
        $moviesGrid.classList.toggle('hidden', filtered.length === 0);

        // Update count
        $movieCount.textContent = `${filtered.length} película${filtered.length !== 1 ? 's' : ''}`;

        // Render cards
        filtered.forEach((movie, index) => {
            const card = createMovieCard(movie, index);
            $moviesGrid.appendChild(card);
        });
    }

    function createMovieCard(movie, index) {
        const fileId = extractDriveFileId(movie.driveLink);
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;

        const gradientIndex = hashString(movie.title) % coverGradients.length;

        let coverHTML;
        if (movie.cover) {
            coverHTML = `<img src="${escapeHtml(movie.cover)}" alt="${escapeHtml(movie.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-cover-placeholder\\' style=\\'background:${coverGradients[gradientIndex]}\\'><span>🎬</span><span class=\\'placeholder-title\\'>${escapeHtml(movie.title)}</span></div>'">`;
        } else if (fileId) {
            coverHTML = `<img src="${getDriveThumbnailUrl(fileId)}" alt="${escapeHtml(movie.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-cover-placeholder\\' style=\\'background:${coverGradients[gradientIndex]}\\'><span>🎬</span><span class=\\'placeholder-title\\'>${escapeHtml(movie.title)}</span></div>'">`;
        } else {
            coverHTML = `<div class="card-cover-placeholder" style="background:${coverGradients[gradientIndex]}"><span>🎬</span><span class="placeholder-title">${escapeHtml(movie.title)}</span></div>`;
        }

        card.innerHTML = `
            <div class="card-cover">
                ${coverHTML}
                <div class="card-cover-overlay"></div>
                <div class="card-play-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>
            <div class="card-info">
                <div class="card-title">${escapeHtml(movie.title)}</div>
                <div class="card-meta">
                    ${movie.year ? `<span>${movie.year}</span>` : ''}
                    ${movie.genre ? `<span class="card-genre">${genreEmojis[movie.genre] || '🎬'} ${escapeHtml(movie.genre)}</span>` : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', () => openPlayer(movie));
        return card;
    }

    // ===== RENDER FILTERS =====
    function renderFilters() {
        const movies = getMovies();
        const genres = [...new Set(movies.map(m => m.genre).filter(Boolean))].sort();

        // Clear all but the "All" button
        const allBtn = $filtersContainer.querySelector('[data-genre="all"]');
        $filtersContainer.innerHTML = '';
        $filtersContainer.appendChild(allBtn);

        genres.forEach(genre => {
            const chip = document.createElement('button');
            chip.className = 'filter-chip' + (currentFilter === genre ? ' active' : '');
            chip.dataset.genre = genre;
            chip.textContent = `${genreEmojis[genre] || '🎬'} ${genre}`;
            chip.addEventListener('click', () => {
                currentFilter = genre;
                updateFilterActive();
                renderMovies();
            });
            $filtersContainer.appendChild(chip);
        });

        // Re-bind "All" button
        allBtn.addEventListener('click', () => {
            currentFilter = 'all';
            updateFilterActive();
            renderMovies();
        });
        allBtn.className = 'filter-chip' + (currentFilter === 'all' ? ' active' : '');
    }

    function updateFilterActive() {
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.genre === currentFilter);
        });
    }

    // ===== RENDER STATS =====
    function renderStats() {
        const movies = getMovies();
        const genres = new Set(movies.map(m => m.genre).filter(Boolean));
        animateNumber($statMovies, movies.length);
        animateNumber($statGenres, genres.size);
    }

    function animateNumber(el, target) {
        const duration = 600;
        const start = parseInt(el.textContent) || 0;
        const diff = target - start;
        if (diff === 0) { el.textContent = target; return; }
        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            el.textContent = Math.round(start + diff * eased);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // ===== RENDER ADMIN LIST =====
    function renderAdminList() {
        const movies = getMovies();
        $adminMoviesList.innerHTML = '';

        if (movies.length === 0) {
            $adminMoviesList.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;text-align:center;padding:20px;">No hay películas. ¡Agrega la primera!</p>';
            return;
        }

        movies.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach(movie => {
            const item = document.createElement('div');
            item.className = 'admin-movie-item';
            item.innerHTML = `
                <div class="admin-movie-info">
                    <span class="admin-movie-title">${escapeHtml(movie.title)}</span>
                    <span class="admin-movie-meta">${movie.year || ''} ${movie.genre ? '• ' + movie.genre : ''}</span>
                </div>
                <div class="admin-movie-actions">
                    <button class="btn-icon-sm btn-edit" title="Editar" data-id="${movie.id}">✏️</button>
                    <button class="btn-icon-sm" title="Eliminar" data-id="${movie.id}">🗑️</button>
                </div>
            `;

            // Edit button
            item.querySelector('.btn-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editMovie(movie.id);
            });

            // Delete button
            item.querySelector('.btn-icon-sm:not(.btn-edit)').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteMovie(movie.id);
            });

            $adminMoviesList.appendChild(item);
        });
    }

    // ===== PLAYER =====
    function openPlayer(movie) {
        const fileId = extractDriveFileId(movie.driveLink);
        if (!fileId) {
            showToast('❌ Link de Google Drive inválido', 'error');
            return;
        }

        $playerTitle.textContent = movie.title;
        $playerYear.textContent = movie.year || '';
        $playerDescription.textContent = movie.description || 'Sin descripción disponible.';

        $playerGenres.innerHTML = '';
        if (movie.genre) {
            const tag = document.createElement('span');
            tag.className = 'player-genre-tag';
            tag.textContent = `${genreEmojis[movie.genre] || '🎬'} ${movie.genre}`;
            $playerGenres.appendChild(tag);
        }

        $playerIframe.src = getDriveEmbedUrl(fileId);
        $playerModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closePlayer() {
        $playerModal.classList.add('hidden');
        $playerIframe.src = '';
        document.body.style.overflow = '';
    }

    // ===== ADMIN =====
    function openAdmin() {
        const pass = prompt('Introduce la clave de administración:');
        if (pass !== 'C@r1ta24') {
            if (pass !== null) {
                showToast('❌ Clave incorrecta', 'error');
            }
            return;
        }
        
        $adminModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        renderAdminList();
    }

    function closeAdmin() {
        $adminModal.classList.add('hidden');
        document.body.style.overflow = '';
        resetForm();
    }

    // ===== FORM =====
    function handleFormSubmit(e) {
        e.preventDefault();

        const title = document.getElementById('input-title').value.trim();
        const driveLink = document.getElementById('input-drive-link').value.trim();
        const year = document.getElementById('input-year').value;
        const genre = document.getElementById('input-genre').value;
        const description = document.getElementById('input-description').value.trim();
        const cover = document.getElementById('input-cover').value.trim();

        if (!title || !driveLink) {
            showToast('⚠️ Completa título y link de Drive', 'error');
            return;
        }

        const fileId = extractDriveFileId(driveLink);
        if (!fileId) {
            showToast('❌ El link de Google Drive no es válido', 'error');
            return;
        }

        const movies = getMovies();

        if (editingMovieId) {
            // Update existing
            const idx = movies.findIndex(m => m.id === editingMovieId);
            if (idx !== -1) {
                movies[idx] = {
                    ...movies[idx],
                    title,
                    driveLink,
                    year: year ? parseInt(year) : null,
                    genre,
                    description,
                    cover
                };
                showToast('✅ Película actualizada', 'success');
            }
            editingMovieId = null;
            document.getElementById('btn-submit-movie').querySelector('span').textContent = '➕ Agregar Película';
        } else {
            // Add new
            movies.push({
                id: generateId(),
                title,
                driveLink,
                year: year ? parseInt(year) : null,
                genre,
                description,
                cover,
                createdAt: Date.now()
            });
            showToast('🎬 Película agregada', 'success');
        }

        saveMovies(movies);
        resetForm();
        renderAll();
    }

    function editMovie(id) {
        const movies = getMovies();
        const movie = movies.find(m => m.id === id);
        if (!movie) return;

        editingMovieId = id;
        document.getElementById('input-title').value = movie.title;
        document.getElementById('input-drive-link').value = movie.driveLink;
        document.getElementById('input-year').value = movie.year || '';
        document.getElementById('input-genre').value = movie.genre || '';
        document.getElementById('input-description').value = movie.description || '';
        document.getElementById('input-cover').value = movie.cover || '';
        document.getElementById('btn-submit-movie').querySelector('span').textContent = '💾 Guardar Cambios';

        // Scroll to form
        $movieForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function deleteMovie(id) {
        if (!confirm('¿Eliminar esta película?')) return;
        const movies = getMovies().filter(m => m.id !== id);
        saveMovies(movies);
        renderAll();
        showToast('🗑️ Película eliminada', 'info');
    }

    function resetForm() {
        $movieForm.reset();
        editingMovieId = null;
        document.getElementById('btn-submit-movie').querySelector('span').textContent = '➕ Agregar Película';
    }

    // ===== EXPORT / IMPORT =====
    function exportData() {
        const movies = getMovies();
        const blob = new Blob([JSON.stringify(movies, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mestacine_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📤 Datos exportados', 'success');
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data)) throw new Error('Invalid format');

                const existing = getMovies();
                const existingIds = new Set(existing.map(m => m.id));

                let added = 0;
                data.forEach(movie => {
                    if (!movie.title || !movie.driveLink) return;
                    if (!movie.id) movie.id = generateId();
                    if (!existingIds.has(movie.id)) {
                        existing.push(movie);
                        added++;
                    }
                });

                saveMovies(existing);
                renderAll();
                showToast(`📥 ${added} película${added !== 1 ? 's' : ''} importada${added !== 1 ? 's' : ''}`, 'success');
            } catch {
                showToast('❌ Error al importar datos', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ===== TOAST =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // ===== NAVBAR SCROLL =====
    function initNavbarScroll() {
        const navbar = document.getElementById('navbar');
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    navbar.classList.toggle('scrolled', window.scrollY > 50);
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    // ===== UTILITIES =====
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function debounce(fn, ms) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);

})();
