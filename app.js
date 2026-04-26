"use strict";

// ===== MESTA CINE - APP.JS =====
// Manages movies stored in localStorage, Google Drive embedding, and UI

(function () {
  'use strict';

  // ===== STORAGE =====
  var STORAGE_KEY = 'mestaCine_movies';
  function getMovies() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
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
    var fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];
    // Format: https://drive.google.com/open?id={ID}
    var openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) return openMatch[1];
    return null;
  }
  function getDriveEmbedUrl(fileId) {
    return "https://drive.google.com/file/d/".concat(fileId, "/preview");
  }
  function getDriveThumbnailUrl(fileId) {
    return "https://drive.google.com/thumbnail?id=".concat(fileId, "&sz=w400");
  }

  // ===== GENRE EMOJI MAP =====
  var genreEmojis = {
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
  var coverGradients = ['linear-gradient(135deg, #1e1b4b, #4c1d95)', 'linear-gradient(135deg, #1e3a5f, #0e7490)', 'linear-gradient(135deg, #3b1d4e, #7c3aed)', 'linear-gradient(135deg, #1a2744, #2563eb)', 'linear-gradient(135deg, #2d1b35, #be185d)', 'linear-gradient(135deg, #1c2e1c, #16a34a)', 'linear-gradient(135deg, #3d1f1f, #dc2626)', 'linear-gradient(135deg, #2e1a3f, #9333ea)'];

  // ===== DOM ELEMENTS =====
  var $searchInput = document.getElementById('search-input');
  var $moviesGrid = document.getElementById('movies-grid');
  var $emptyState = document.getElementById('empty-state');
  var $noResults = document.getElementById('no-results');
  var $movieCount = document.getElementById('movie-count');
  var $statMovies = document.getElementById('stat-movies');
  var $statGenres = document.getElementById('stat-genres');
  var $filtersContainer = document.querySelector('.filters-container');

  // Player modal
  var $playerModal = document.getElementById('player-modal');
  var $playerIframe = document.getElementById('player-iframe');
  var $playerTitle = document.getElementById('player-title');
  var $playerYear = document.getElementById('player-year');
  var $playerDescription = document.getElementById('player-description');
  var $playerGenres = document.getElementById('player-genres');

  // Admin modal
  var $adminModal = document.getElementById('admin-modal');
  var $movieForm = document.getElementById('movie-form');
  var $adminMoviesList = document.getElementById('admin-movies-list');
  var $fileImport = document.getElementById('file-import');

  // Password modal
  var $passwordModal = document.getElementById('password-modal');
  var $passwordForm = document.getElementById('password-form');
  var $inputPassword = document.getElementById('input-password');

  // State
  var currentFilter = 'all';
  var searchQuery = '';
  var editingMovieId = null;

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
    var samples = [{
      id: generateId(),
      title: 'Película Familiar - Ejemplo',
      driveLink: 'https://drive.google.com/file/d/1ycrwYGEst6qiY4EzvG8gIuDRPTPwCXro/view?usp=sharing',
      year: 2024,
      genre: 'Familiar',
      description: 'Esta es una película de ejemplo. ¡Puedes editarla o eliminarla desde el panel de administración!',
      cover: '',
      createdAt: Date.now()
    }];
    saveMovies(samples);
  }

  // ===== EVENTS =====
  function bindEvents() {
    // Search
    $searchInput.addEventListener('input', debounce(function () {
      searchQuery = this.value.trim().toLowerCase();
      renderMovies();
    }, 250));

    // Admin / Password buttons
    document.getElementById('btn-admin').addEventListener('click', openPasswordModal);
    document.getElementById('btn-add-first').addEventListener('click', openPasswordModal);
    document.getElementById('btn-close-admin').addEventListener('click', closeAdmin);
    document.getElementById('admin-backdrop').addEventListener('click', closeAdmin);
    document.getElementById('btn-close-password').addEventListener('click', closePasswordModal);
    document.getElementById('password-backdrop').addEventListener('click', closePasswordModal);
    $passwordForm.addEventListener('submit', handlePasswordSubmit);

    // Player
    document.getElementById('btn-close-player').addEventListener('click', closePlayer);
    document.getElementById('player-backdrop').addEventListener('click', closePlayer);

    // Form
    $movieForm.addEventListener('submit', handleFormSubmit);

    // Export / Import
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', function () {
      return $fileImport.click();
    });
    $fileImport.addEventListener('change', importData);

    // Brand click goes to top
    document.getElementById('brand-home').addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$playerModal.classList.contains('hidden')) closePlayer();else if (!$adminModal.classList.contains('hidden')) closeAdmin();
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
    var movies = getMovies();
    var filtered = movies;

    // Filter by genre
    if (currentFilter !== 'all') {
      filtered = filtered.filter(function (m) {
        return m.genre === currentFilter;
      });
    }

    // Search
    if (searchQuery) {
      filtered = filtered.filter(function (m) {
        return m.title.toLowerCase().includes(searchQuery) || m.genre && m.genre.toLowerCase().includes(searchQuery) || m.description && m.description.toLowerCase().includes(searchQuery);
      });
    }

    // Sort by most recent
    filtered.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    // Toggle states
    $moviesGrid.innerHTML = '';
    $emptyState.classList.toggle('hidden', movies.length > 0);
    $noResults.classList.toggle('hidden', filtered.length > 0 || movies.length === 0);
    $moviesGrid.classList.toggle('hidden', filtered.length === 0);

    // Update count
    $movieCount.textContent = "".concat(filtered.length, " pel\xEDcula").concat(filtered.length !== 1 ? 's' : '');

    // Render cards
    filtered.forEach(function (movie, index) {
      var card = createMovieCard(movie, index);
      $moviesGrid.appendChild(card);
    });
  }
  function createMovieCard(movie, index) {
    var fileId = extractDriveFileId(movie.driveLink);
    var card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = "".concat(Math.min(index * 0.05, 0.4), "s");
    var gradientIndex = hashString(movie.title) % coverGradients.length;
    var coverHTML;
    if (movie.cover) {
      coverHTML = "<img src=\"".concat(escapeHtml(movie.cover), "\" alt=\"").concat(escapeHtml(movie.title), "\" loading=\"lazy\" onerror=\"this.parentElement.innerHTML='<div class=\\'card-cover-placeholder\\' style=\\'background:").concat(coverGradients[gradientIndex], "\\'><span>\uD83C\uDFAC</span><span class=\\'placeholder-title\\'>").concat(escapeHtml(movie.title), "</span></div>'\">");
    } else if (fileId) {
      coverHTML = "<img src=\"".concat(getDriveThumbnailUrl(fileId), "\" alt=\"").concat(escapeHtml(movie.title), "\" loading=\"lazy\" onerror=\"this.parentElement.innerHTML='<div class=\\'card-cover-placeholder\\' style=\\'background:").concat(coverGradients[gradientIndex], "\\'><span>\uD83C\uDFAC</span><span class=\\'placeholder-title\\'>").concat(escapeHtml(movie.title), "</span></div>'\">");
    } else {
      coverHTML = "<div class=\"card-cover-placeholder\" style=\"background:".concat(coverGradients[gradientIndex], "\"><span>\uD83C\uDFAC</span><span class=\"placeholder-title\">").concat(escapeHtml(movie.title), "</span></div>");
    }
    card.innerHTML = "\n            <div class=\"card-cover\">\n                ".concat(coverHTML, "\n                <div class=\"card-cover-overlay\"></div>\n                <div class=\"card-play-btn\">\n                    <svg viewBox=\"0 0 24 24\" fill=\"currentColor\">\n                        <path d=\"M8 5v14l11-7z\"/>\n                    </svg>\n                </div>\n            </div>\n            <div class=\"card-info\">\n                <div class=\"card-title\">").concat(escapeHtml(movie.title), "</div>\n                <div class=\"card-meta\">\n                    ").concat(movie.year ? "<span>".concat(movie.year, "</span>") : '', "\n                    ").concat(movie.genre ? "<span class=\"card-genre\">".concat(genreEmojis[movie.genre] || '🎬', " ").concat(escapeHtml(movie.genre), "</span>") : '', "\n                </div>\n            </div>\n        ");
    card.addEventListener('click', function () {
      return openPlayer(movie);
    });
    return card;
  }

  // ===== RENDER FILTERS =====
  function renderFilters() {
    var movies = getMovies();
    var genres = Array.from(new Set(movies.map(function (m) {
      return m.genre;
    }).filter(Boolean))).sort();

    // Clear all but the "All" button
    var allBtn = $filtersContainer.querySelector('[data-genre="all"]');
    $filtersContainer.innerHTML = '';
    $filtersContainer.appendChild(allBtn);
    genres.forEach(function (genre) {
      var chip = document.createElement('button');
      chip.className = 'filter-chip' + (currentFilter === genre ? ' active' : '');
      chip.dataset.genre = genre;
      chip.textContent = "".concat(genreEmojis[genre] || '🎬', " ").concat(genre);
      chip.addEventListener('click', function () {
        currentFilter = genre;
        updateFilterActive();
        renderMovies();
      });
      $filtersContainer.appendChild(chip);
    });

    // Re-bind "All" button
    allBtn.addEventListener('click', function () {
      currentFilter = 'all';
      updateFilterActive();
      renderMovies();
    });
    allBtn.className = 'filter-chip' + (currentFilter === 'all' ? ' active' : '');
  }
  function updateFilterActive() {
    document.querySelectorAll('.filter-chip').forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.genre === currentFilter);
    });
  }

  // ===== RENDER STATS =====
  function renderStats() {
    var movies = getMovies();
    var genres = new Set(movies.map(function (m) {
      return m.genre;
    }).filter(Boolean));
    animateNumber($statMovies, movies.length);
    animateNumber($statGenres, genres.size);
  }
  function animateNumber(el, target) {
    var duration = 600;
    var start = parseInt(el.textContent) || 0;
    var diff = target - start;
    if (diff === 0) {
      el.textContent = target;
      return;
    }
    var startTime = performance.now();
    function step(now) {
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(start + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ===== RENDER ADMIN LIST =====
  function renderAdminList() {
    var movies = getMovies();
    $adminMoviesList.innerHTML = '';
    if (movies.length === 0) {
      $adminMoviesList.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;text-align:center;padding:20px;">No hay películas. ¡Agrega la primera!</p>';
      return;
    }
    movies.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }).forEach(function (movie) {
      var item = document.createElement('div');
      item.className = 'admin-movie-item';
      item.innerHTML = "\n                <div class=\"admin-movie-info\">\n                    <span class=\"admin-movie-title\">".concat(escapeHtml(movie.title), "</span>\n                    <span class=\"admin-movie-meta\">").concat(movie.year || '', " ").concat(movie.genre ? '• ' + movie.genre : '', "</span>\n                </div>\n                <div class=\"admin-movie-actions\">\n                    <button class=\"btn-icon-sm btn-edit\" title=\"Editar\" data-id=\"").concat(movie.id, "\">\u270F\uFE0F</button>\n                    <button class=\"btn-icon-sm\" title=\"Eliminar\" data-id=\"").concat(movie.id, "\">\uD83D\uDDD1\uFE0F</button>\n                </div>\n            ");

      // Edit button
      item.querySelector('.btn-edit').addEventListener('click', function (e) {
        e.stopPropagation();
        editMovie(movie.id);
      });

      // Delete button
      item.querySelector('.btn-icon-sm:not(.btn-edit)').addEventListener('click', function (e) {
        e.stopPropagation();
        deleteMovie(movie.id);
      });
      $adminMoviesList.appendChild(item);
    });
  }

  // ===== PLAYER =====
  function openPlayer(movie) {
    var link = movie.driveLink || '';
    
    $playerTitle.textContent = movie.title;
    $playerYear.textContent = movie.year || '';
    $playerDescription.textContent = movie.description || 'Sin descripción disponible.';
    $playerGenres.innerHTML = '';
    if (movie.genre) {
      var tag = document.createElement('span');
      tag.className = 'player-genre-tag';
      tag.textContent = "".concat(genreEmojis[movie.genre] || '🎬', " ").concat(movie.genre);
      $playerGenres.appendChild(tag);
    }
    
    var videoPlayer = document.getElementById('player-video');
    var btnNative = document.getElementById('btn-native-player');
    var fileId = extractDriveFileId(link);
    
    // Check if it is a direct video link
    if (link.toLowerCase().endsWith('.mp4') || link.toLowerCase().endsWith('.webm') || link.toLowerCase().endsWith('.mkv')) {
        $playerIframe.style.display = 'none';
        btnNative.style.display = 'none';
        videoPlayer.src = link;
        videoPlayer.style.display = 'block';
        videoPlayer.play().catch(function(e){});
    } else if (fileId) {
        // Intento forzado de Google Drive streaming
        $playerIframe.style.display = 'none';
        btnNative.style.display = 'none';
        videoPlayer.src = 'https://drive.google.com/uc?export=download&id=' + fileId;
        videoPlayer.style.display = 'block';
        videoPlayer.play().catch(function(e){});
    } else {
        showToast('❌ Link de película inválido', 'error');
        return;
    }

    $playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closePlayer() {
    $playerModal.classList.add('hidden');
    $playerIframe.src = '';
    
    var videoPlayer = document.getElementById('player-video');
    videoPlayer.pause();
    videoPlayer.src = '';
    
    document.body.style.overflow = '';
  }

  // ===== PASSWORD =====
  function openPasswordModal() {
    $inputPassword.value = '';
    $passwordModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      return $inputPassword.focus();
    }, 100);
  }
  function closePasswordModal() {
    $passwordModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function handlePasswordSubmit(e) {
    e.preventDefault();
    var pass = $inputPassword.value.trim();
    if (pass === 'C@r1ta24') {
      closePasswordModal();
      openAdmin();
    } else {
      showToast('❌ Clave incorrecta', 'error');
      $inputPassword.value = '';
      $inputPassword.focus();
    }
  }

  // ===== ADMIN =====
  function openAdmin() {
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
    var title = document.getElementById('input-title').value.trim();
    var driveLink = document.getElementById('input-drive-link').value.trim();
    var year = document.getElementById('input-year').value;
    var genre = document.getElementById('input-genre').value;
    var description = document.getElementById('input-description').value.trim();
    var cover = document.getElementById('input-cover').value.trim();
    if (!title || !driveLink) {
      showToast('⚠️ Completa título y link de Drive', 'error');
      return;
    }
    var fileId = extractDriveFileId(driveLink);
    if (!fileId) {
      showToast('❌ El link de Google Drive no es válido', 'error');
      return;
    }
    var movies = getMovies();
    if (editingMovieId) {
      // Update existing
      var idx = movies.findIndex(function (m) {
        return m.id === editingMovieId;
      });
      if (idx !== -1) {
        movies[idx].title = title;
        movies[idx].driveLink = driveLink;
        movies[idx].year = year ? parseInt(year) : null;
        movies[idx].genre = genre;
        movies[idx].description = description;
        movies[idx].cover = cover;
        showToast('✅ Película actualizada', 'success');
      }
      editingMovieId = null;
      document.getElementById('btn-submit-movie').querySelector('span').textContent = '➕ Agregar Película';
    } else {
      // Add new
      movies.push({
        id: generateId(),
        title: title,
        driveLink: driveLink,
        year: year ? parseInt(year) : null,
        genre: genre,
        description: description,
        cover: cover,
        createdAt: Date.now()
      });
      showToast('🎬 Película agregada', 'success');
    }
    saveMovies(movies);
    resetForm();
    renderAll();
  }
  function editMovie(id) {
    var movies = getMovies();
    var movie = movies.find(function (m) {
      return m.id === id;
    });
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
    $movieForm.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
  function deleteMovie(id) {
    if (!confirm('¿Eliminar esta película?')) return;
    var movies = getMovies().filter(function (m) {
      return m.id !== id;
    });
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
    var movies = getMovies();
    var blob = new Blob([JSON.stringify(movies, null, 2)], {
      type: 'application/json'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = "mestacine_backup_".concat(new Date().toISOString().slice(0, 10), ".json");
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Datos exportados', 'success');
  }
  function importData(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (event) {
      try {
        var data = JSON.parse(event.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        var existing = getMovies();
        var existingIds = new Set(existing.map(function (m) {
          return m.id;
        }));
        var added = 0;
        data.forEach(function (movie) {
          if (!movie.title || !movie.driveLink) return;
          if (!movie.id) movie.id = generateId();
          if (!existingIds.has(movie.id)) {
            existing.push(movie);
            added++;
          }
        });
        saveMovies(existing);
        renderAll();
        showToast("\uD83D\uDCE5 ".concat(added, " pel\xEDcula").concat(added !== 1 ? 's' : '', " importada").concat(added !== 1 ? 's' : ''), 'success');
      } catch (e) {
        showToast('❌ Error al importar datos', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ===== TOAST =====
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = "toast ".concat(type);
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 3000);
  }

  // ===== NAVBAR SCROLL =====
  function initNavbarScroll() {
    var navbar = document.getElementById('navbar');
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
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
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var _char = str.charCodeAt(i);
      hash = (hash << 5) - hash + _char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
  function debounce(fn, ms) {
    var timeout;
    return function () {
      var _this = this;
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        return fn.apply(_this, args);
      }, ms);
    };
  }

  // ===== START =====
  document.addEventListener('DOMContentLoaded', init);
})();
