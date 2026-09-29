/**
 * Google Calendar Style - Mobile Web App
 * Calendário de Datas Comemorativas & Feriados
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
const state = {
  data: null,
  currentYear: 2026,
  currentMonth: 0, // 0 = Jan, 11 = Dez
  selectedDate: null, // "YYYY-MM-DD"
  activeView: 'month', // 'month' | 'agenda' | 'favorites'
  activeCategoryFilter: 'Todas',
  searchQuery: '',
  favorites: new Set(),
  theme: localStorage.getItem('cal_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  touchStartX: 0,
  touchStartY: 0
};

// Nomes dos meses em português
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

// Helper: remover acentos para pesquisa rápida
function normalizeText(text) {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadData();
  initFavorites();
  initTodayDate();
  setupEventListeners();
  renderMonthSliderCounts();
  updateView();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[PWA] Service Worker registado com sucesso:', reg.scope))
        .catch(err => console.log('[PWA] Registo de Service Worker falhou:', err));
    });
  }
}

// Carregar dados de data.js ou datas.json
async function loadData() {
  if (window.CALENDAR_DATA) {
    state.data = window.CALENDAR_DATA;
    console.log('Dados carregados via data.js:', state.data.totalItems, 'eventos');
    return;
  }
  
  try {
    const res = await fetch('datas.json');
    if (res.ok) {
      state.data = await res.json();
      console.log('Dados carregados via datas.json:', state.data.totalItems, 'eventos');
    }
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
  }
}

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.textContent = state.theme === 'dark' ? 'light_mode' : 'dark_mode';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('cal_theme', state.theme);
  initTheme();
}

function initFavorites() {
  try {
    const saved = localStorage.getItem('cal_favs');
    if (saved) {
      state.favorites = new Set(JSON.parse(saved));
    }
  } catch (e) {
    state.favorites = new Set();
  }
  updateFavoritesCount();
}

function toggleFavorite(itemId) {
  if (state.favorites.has(itemId)) {
    state.favorites.delete(itemId);
  } else {
    state.favorites.add(itemId);
  }
  localStorage.setItem('cal_favs', JSON.stringify(Array.from(state.favorites)));
  updateFavoritesCount();
}

function updateFavoritesCount() {
  const el = document.getElementById('drawerFavoritesCount');
  if (el) el.textContent = state.favorites.size;
}

function initTodayDate() {
  const now = new Date();
  const dayNum = now.getDate();
  const brandDay = document.getElementById('brandDayNumber');
  const drawerBrandDay = document.getElementById('drawerBrandDay');
  if (brandDay) brandDay.textContent = dayNum;
  if (drawerBrandDay) drawerBrandDay.textContent = dayNum;
  
  // O ano padrão é 2026 (onde se concentram as datas comemorativas detalhadas)
  // Mas selecionamos o mês e dia atuais para conveniência
  state.currentMonth = now.getMonth();
  const m = String(state.currentMonth + 1).padStart(2, '0');
  const d = String(dayNum).padStart(2, '0');
  state.selectedDate = `${state.currentYear}-${m}-${d}`;
}

// ============================================================================
// EVENT LISTENERS & GESTURES
// ============================================================================
function setupEventListeners() {
  // Theme toggle
  document.getElementById('btnToggleTheme').addEventListener('click', toggleTheme);

  // Botão Hoje
  document.getElementById('btnToday').addEventListener('click', () => {
    jumpToToday();
  });

  // Navegação de mês (setas)
  document.getElementById('btnPrevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('btnNextMonth').addEventListener('click', () => changeMonth(1));

  // Slider de meses (botões pílula)
  const track = document.getElementById('monthSliderTrack');
  track.addEventListener('click', (e) => {
    const pill = e.target.closest('.month-pill-btn');
    if (pill) {
      const monthIdx = parseInt(pill.dataset.month, 10);
      setMonth(monthIdx);
    }
  });

  // Range Scrubber
  const scrubber = document.getElementById('monthRangeScrubber');
  scrubber.addEventListener('input', (e) => {
    const m = parseInt(e.target.value, 10);
    setMonth(m, false);
  });

  // Alternador de Vistas (Mês vs Programação)
  document.getElementById('btnViewMonth').addEventListener('click', () => switchView('month'));
  document.getElementById('btnViewAgenda').addEventListener('click', () => switchView('agenda'));

  // Abas Inferiores
  document.getElementById('tabMonth').addEventListener('click', () => switchView('month'));
  document.getElementById('tabAgenda').addEventListener('click', () => switchView('agenda'));
  document.getElementById('tabSearch').addEventListener('click', () => openSearch());
  document.getElementById('tabFavorites').addEventListener('click', () => switchView('favorites'));

  // Drawer
  document.getElementById('btnOpenDrawer').addEventListener('click', openDrawer);
  document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);
  document.getElementById('drawerNavAll').addEventListener('click', () => {
    closeDrawer();
    state.activeCategoryFilter = 'Todas';
    switchView('month');
  });
  document.getElementById('drawerNavHolidays').addEventListener('click', () => {
    closeDrawer();
    filterCategoryFromDrawer('Feriado Nacional');
  });
  document.getElementById('drawerNavCurious').addEventListener('click', () => {
    closeDrawer();
    filterCategoryFromDrawer('Dia Curioso');
  });
  document.getElementById('drawerNavFavorites').addEventListener('click', () => {
    closeDrawer();
    switchView('favorites');
  });
  document.getElementById('drawerNavToday').addEventListener('click', () => {
    closeDrawer();
    jumpToToday();
  });
  document.getElementById('drawerNavSearch').addEventListener('click', () => {
    closeDrawer();
    openSearch();
  });

  // Search Modal
  document.getElementById('btnOpenSearch').addEventListener('click', openSearch);
  document.getElementById('btnCloseSearch').addEventListener('click', closeSearch);
  
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('btnClearSearch');
  
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.style.display = val ? 'block' : 'none';
    executeSearch(val);
  });
  
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    executeSearch('');
    searchInput.focus();
  });

  // Filtros de Pesquisa (chips)
  document.getElementById('searchFilterChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (chip) {
      document.querySelectorAll('#searchFilterChips .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeCategoryFilter = chip.dataset.category;
      executeSearch(searchInput.value);
    }
  });

  // Bottom Sheet
  document.getElementById('btnCloseSheet').addEventListener('click', closeBottomSheet);
  document.getElementById('sheetBackdrop').addEventListener('click', closeBottomSheet);
  document.getElementById('btnPrevDaySheet').addEventListener('click', () => navigateDay(-1));
  document.getElementById('btnNextDaySheet').addEventListener('click', () => navigateDay(1));

  // Gestos de Swipe no Bottom Sheet para avançar/recuar dias
  const sheetEl = document.getElementById('dayBottomSheet');
  let sheetTouchStartX = 0;
  let sheetTouchStartY = 0;
  let sheetTouchStartTime = 0;

  sheetEl.addEventListener('touchstart', (e) => {
    sheetTouchStartX = e.touches[0].clientX;
    sheetTouchStartY = e.touches[0].clientY;
    sheetTouchStartTime = Date.now();
  }, { passive: true });

  sheetEl.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - sheetTouchStartX;
    const diffY = e.changedTouches[0].clientY - sheetTouchStartY;
    const timeElapsed = Date.now() - sheetTouchStartTime;

    // Detectar swipe horizontal nítido (mínimo 40px, mais horizontal que vertical e com tempo razoável)
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.25 && timeElapsed < 800) {
      if (diffX < 0) {
        navigateDay(1); // Swipe esquerda -> Dia seguinte
      } else {
        navigateDay(-1); // Swipe direita -> Dia anterior
      }
    }
  }, { passive: true });

  // Teclas de seta no teclado quando o Bottom Sheet está aberto
  document.addEventListener('keydown', (e) => {
    if (!sheetEl.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') {
      navigateDay(-1);
    } else if (e.key === 'ArrowRight') {
      navigateDay(1);
    } else if (e.key === 'Escape') {
      closeBottomSheet();
    }
  });

  // Gestos de Swipe no Calendário (Mudar mês com o dedo)
  const container = document.getElementById('mainViewContainer');
  container.addEventListener('touchstart', (e) => {
    state.touchStartX = e.touches[0].clientX;
    state.touchStartY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (state.activeView !== 'month') return;
    const diffX = e.changedTouches[0].clientX - state.touchStartX;
    const diffY = e.changedTouches[0].clientY - state.touchStartY;

    // Detectar gesto horizontal nítido (mínimo 50px e mais horizontal que vertical)
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX < 0) {
        changeMonth(1); // Swipe esquerda -> Próximo mês
      } else {
        changeMonth(-1); // Swipe direita -> Mês anterior
      }
    }
  }, { passive: true });
}

// ============================================================================
// NAVEGAÇÃO ENTRE MESES & HOJE
// ============================================================================
function changeMonth(delta) {
  let newMonth = state.currentMonth + delta;
  if (newMonth < 0) {
    newMonth = 11;
    state.currentYear--;
  } else if (newMonth > 11) {
    newMonth = 0;
    state.currentYear++;
  }
  setMonth(newMonth);
}

function setMonth(monthIndex, syncScrubber = true) {
  state.currentMonth = monthIndex;
  
  if (syncScrubber) {
    const scrubber = document.getElementById('monthRangeScrubber');
    if (scrubber) scrubber.value = monthIndex;
  }

  // Atualizar botões pílula
  document.querySelectorAll('#monthSliderTrack .month-pill-btn').forEach(btn => {
    const m = parseInt(btn.dataset.month, 10);
    if (m === monthIndex) {
      btn.classList.add('active');
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } else {
      btn.classList.remove('active');
    }
  });

  updateView();
}

function jumpToToday() {
  const now = new Date();
  state.currentYear = 2026; // Base year principal
  state.currentMonth = now.getMonth();
  
  const m = String(state.currentMonth + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  state.selectedDate = `${state.currentYear}-${m}-${d}`;
  
  setMonth(state.currentMonth);

  // Efeito de pulso no botão Hoje
  const btnToday = document.getElementById('btnToday');
  btnToday.classList.add('pulse');
  setTimeout(() => btnToday.classList.remove('pulse'), 600);

  if (state.activeView === 'agenda') {
    setTimeout(() => {
      const todayGroup = document.querySelector(`.agenda-day-group[data-date="${state.selectedDate}"]`);
      if (todayGroup) {
        todayGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  } else {
    // Abrir os detalhes do dia de hoje para conveniência
    setTimeout(() => {
      openDayDetails(state.selectedDate);
    }, 150);
  }
}

function renderMonthSliderCounts() {
  if (!state.data || !state.data.byDate) return;
  
  const counts = Array(12).fill(0);
  for (const [dateStr, events] of Object.entries(state.data.byDate)) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        counts[mIdx] += events.length;
      }
    }
  }

  for (let i = 0; i < 12; i++) {
    const countEl = document.getElementById(`count-m${i}`);
    if (countEl) {
      countEl.textContent = counts[i];
    }
  }
}

// ============================================================================
// GESTÃO DE VISTAS (MÊS / PROGRAMAÇÃO / FAVORITOS)
// ============================================================================
function switchView(viewName) {
  state.activeView = viewName;

  // Atualizar segment control
  const btnMonth = document.getElementById('btnViewMonth');
  const btnAgenda = document.getElementById('btnViewAgenda');
  btnMonth.classList.toggle('active', viewName === 'month');
  btnAgenda.classList.toggle('active', viewName === 'agenda');

  // Atualizar abas inferiores
  document.querySelectorAll('.bottom-nav-bar .nav-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (viewName === 'month') document.getElementById('tabMonth').classList.add('active');
  if (viewName === 'agenda') document.getElementById('tabAgenda').classList.add('active');
  if (viewName === 'favorites') document.getElementById('tabFavorites').classList.add('active');

  const monthView = document.getElementById('monthView');
  const agendaView = document.getElementById('agendaView');

  if (viewName === 'month') {
    monthView.style.display = 'flex';
    agendaView.style.display = 'none';
    renderMonthGrid();
  } else {
    monthView.style.display = 'none';
    agendaView.style.display = 'block';
    renderAgendaView(viewName === 'favorites');
  }

  updateHeaderTitle();
}

function updateHeaderTitle() {
  const label = document.getElementById('currentMonthYearLabel');
  if (state.activeView === 'favorites') {
    label.textContent = 'Favoritos';
  } else {
    label.textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;
  }

  // Estatísticas rápidas
  const quickStats = document.getElementById('quickStatsSummary');
  if (quickStats && state.data) {
    if (state.activeView === 'favorites') {
      quickStats.textContent = `${state.favorites.size} datas guardadas`;
    } else {
      const monthPrefix = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;
      let monthEventsCount = 0;
      let holidaysCount = 0;
      for (const [date, events] of Object.entries(state.data.byDate)) {
        if (date.startsWith(monthPrefix)) {
          monthEventsCount += events.length;
          events.forEach(e => { if (e.isHoliday) holidaysCount++; });
        }
      }
      quickStats.textContent = `${monthEventsCount} datas • ${holidaysCount} feriados`;
    }
  }
}

function updateView() {
  updateHeaderTitle();
  if (state.activeView === 'month') {
    renderMonthGrid();
  } else {
    renderAgendaView(state.activeView === 'favorites');
  }
}

// ============================================================================
// RENDERIZAÇÃO: VISTA DE MÊS (GRELHA COMPLETA)
// ============================================================================
function renderMonthGrid() {
  const grid = document.getElementById('calendarDaysGrid');
  grid.innerHTML = '';

  const year = state.currentYear;
  const month = state.currentMonth;

  // Primeiro dia do mês (0 = Domingo, 1 = Segunda, ...)
  const firstDay = new Date(year, month, 1);
  // Ajustar para semana a começar na Segunda-feira (0 = Segunda, 6 = Domingo)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 1. Dias do mês anterior
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = createDayCell(day, dateStr, true, todayStr);
    grid.appendChild(cell);
  }

  // 2. Dias do mês atual
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = createDayCell(day, dateStr, false, todayStr);
    grid.appendChild(cell);
  }

  // 3. Dias do mês seguinte para completar as linhas (até múltiplo de 7)
  const totalCells = startDayOfWeek + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = createDayCell(day, dateStr, true, todayStr);
    grid.appendChild(cell);
  }
}

function createDayCell(dayNum, dateStr, isOtherMonth, todayStr) {
  const cell = document.createElement('div');
  cell.className = 'calendar-day-cell';
  cell.dataset.date = dateStr;

  if (isOtherMonth) cell.classList.add('other-month');
  if (dateStr === todayStr) cell.classList.add('is-today');
  if (dateStr === state.selectedDate) cell.classList.add('selected');

  // Buscar eventos para este dia
  const events = getEventsForDate(dateStr);
  const hasHoliday = events.some(e => e.isHoliday);
  if (hasHoliday) cell.classList.add('has-holiday');

  // Header do dia
  const header = document.createElement('div');
  header.className = 'day-cell-header';

  const numSpan = document.createElement('span');
  numSpan.className = 'day-number';
  numSpan.textContent = dayNum;
  header.appendChild(numSpan);

  if (events.length > 0) {
    const countBadge = document.createElement('span');
    countBadge.className = 'day-badge-count';
    countBadge.textContent = events.length;
    header.appendChild(countBadge);
  }
  cell.appendChild(header);

  // Lista de Chips de Eventos (Máx 2 no mobile para ficar super limpo e elegante)
  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'day-events-list';

  // Priorizar feriados primeiro, depois outros
  const sortedEvents = [...events].sort((a, b) => (b.isHoliday ? 1 : 0) - (a.isHoliday ? 1 : 0));
  const maxDisplay = 2;
  const displayEvents = sortedEvents.slice(0, maxDisplay);

  displayEvents.forEach(evt => {
    const chip = document.createElement('div');
    chip.className = 'event-chip';
    if (evt.isHoliday) {
      chip.classList.add('chip-holiday');
    } else if (evt.category === 'Dia Curioso') {
      chip.classList.add('chip-curious');
    } else {
      chip.classList.add('chip-default');
    }
    chip.title = evt.title;
    chip.textContent = evt.title;
    eventsContainer.appendChild(chip);
  });

  if (events.length > maxDisplay) {
    const moreInd = document.createElement('div');
    moreInd.className = 'event-more-indicator';
    moreInd.textContent = `+${events.length - maxDisplay} mais`;
    eventsContainer.appendChild(moreInd);
  }

  cell.appendChild(eventsContainer);

  // Ao clicar, seleciona o dia e abre o Bottom Sheet
  cell.addEventListener('click', () => {
    document.querySelectorAll('.calendar-day-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    state.selectedDate = dateStr;
    openDayDetails(dateStr);
  });

  return cell;
}

function getEventsForDate(dateStr) {
  if (!state.data) return [];
  // Procura por data exata ISO ("YYYY-MM-DD")
  if (state.data.byDate && state.data.byDate[dateStr]) {
    return state.data.byDate[dateStr];
  }
  // Fallback: procura por mês-dia ("MM-DD")
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const md = `${parts[1]}-${parts[2]}`;
    if (state.data.byMonthDay && state.data.byMonthDay[md]) {
      return state.data.byMonthDay[md];
    }
  }
  return [];
}

// ============================================================================
// RENDERIZAÇÃO: VISTA DE PROGRAMAÇÃO (AGENDA CONTÍNUA ESTILO GOOGLE CALENDAR)
// ============================================================================
function renderAgendaView(onlyFavorites = false) {
  const container = document.getElementById('agendaView');
  container.innerHTML = '';

  if (!state.data) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Se apenas favoritos
  if (onlyFavorites) {
    renderFavoritesView(container);
    return;
  }

  // Agrupar por meses começando no mês selecionado atual
  const startMonth = state.currentMonth;

  for (let m = 0; m < 12; m++) {
    const monthIdx = (startMonth + m) % 12;
    const year = state.currentYear + (startMonth + m >= 12 ? 1 : 0);
    const monthNumStr = String(monthIdx + 1).padStart(2, '0');
    const monthPrefix = `${year}-${monthNumStr}`;

    // Obter todos os dias com eventos deste mês
    const monthDates = Object.keys(state.data.byDate)
      .filter(d => d.startsWith(`${state.currentYear}-${monthNumStr}`))
      .sort();

    if (monthDates.length === 0) continue;

    const monthSection = document.createElement('div');
    monthSection.className = 'agenda-month-section';

    const monthHeader = document.createElement('div');
    monthHeader.className = 'agenda-month-header';
    monthHeader.innerHTML = `
      <span>${MONTH_NAMES[monthIdx]} ${year}</span>
      <span class="agenda-month-badge">${monthDates.length} dias festivos</span>
    `;
    monthSection.appendChild(monthHeader);

    monthDates.forEach(dateStr => {
      const events = state.data.byDate[dateStr];
      if (!events || events.length === 0) return;

      const parts = dateStr.split('-');
      const dayNum = parseInt(parts[2], 10);
      const dObj = new Date(year, monthIdx, dayNum);
      const weekdayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dObj.getDay()];

      const dayGroup = document.createElement('div');
      dayGroup.className = 'agenda-day-group';
      dayGroup.dataset.date = dateStr;
      if (dateStr === todayStr) dayGroup.classList.add('is-today');

      // Coluna da data (esquerda)
      const dateCol = document.createElement('div');
      dateCol.className = 'agenda-date-col';
      dateCol.innerHTML = `
        <div class="agenda-date-number">${dayNum}</div>
        <div class="agenda-date-weekday">${weekdayShort}</div>
      `;
      dayGroup.appendChild(dateCol);

      // Coluna dos cards de eventos (direita)
      const eventsCol = document.createElement('div');
      eventsCol.className = 'agenda-events-col';

      events.forEach(evt => {
        const card = createAgendaEventCard(evt);
        eventsCol.appendChild(card);
      });

      dayGroup.appendChild(eventsCol);
      monthSection.appendChild(dayGroup);
    });

    container.appendChild(monthSection);
  }
}

function createAgendaEventCard(evt) {
  const card = document.createElement('div');
  card.className = 'agenda-event-card';
  card.style.setProperty('--card-accent', evt.color);
  card.style.setProperty('--card-bg', evt.badgeBg);

  const isFav = state.favorites.has(evt.id);

  card.innerHTML = `
    <div class="agenda-card-icon">
      <span class="material-symbols-rounded">${evt.icon || 'event'}</span>
    </div>
    <div class="agenda-card-content">
      <div class="agenda-card-title">
        <span>${escapeHtml(evt.title)}</span>
        ${evt.isHoliday ? '<span class="agenda-card-category" style="background:#fce8e6; color:#c5221f;">Feriado</span>' : ''}
      </div>
      <div>
        <span class="agenda-card-category">${escapeHtml(evt.category)}</span>
      </div>
      ${evt.url ? `<div class="agenda-card-link-hint"><span class="material-symbols-rounded" style="font-size:14px;">open_in_new</span> Ver no Calendarr</div>` : ''}
    </div>
    <button class="icon-btn btn-fav" style="width:32px; height:32px; color:${isFav ? '#f9ab00' : 'var(--text-subtle)'};" title="Guardar nos Favoritos">
      <span class="material-symbols-rounded" style="font-size:20px;">${isFav ? 'star' : 'star_border'}</span>
    </button>
  `;

  // Favoritar
  const favBtn = card.querySelector('.btn-fav');
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(evt.id);
    const starIcon = favBtn.querySelector('.material-symbols-rounded');
    const nowFav = state.favorites.has(evt.id);
    starIcon.textContent = nowFav ? 'star' : 'star_border';
    favBtn.style.color = nowFav ? '#f9ab00' : 'var(--text-subtle)';
  });

  // Clicar no card abre detalhes do dia
  card.addEventListener('click', () => {
    openDayDetails(evt.date);
  });

  return card;
}

function renderFavoritesView(container) {
  if (state.favorites.size === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 60px 20px;">
        <span class="material-symbols-rounded" style="font-size: 56px; color: #f9ab00; opacity: 0.8;">star_border</span>
        <h3 style="margin-top: 14px; font-weight: 600; color: var(--text-main);">Ainda não tens favoritos</h3>
        <p style="font-size: 0.85rem; margin-top: 6px;">Toca na estrela de qualquer data comemorativa para a guardares aqui e acederes rapidamente!</p>
      </div>
    `;
    return;
  }

  const allItems = state.data.items.filter(item => state.favorites.has(item.id));
  
  const header = document.createElement('div');
  header.className = 'agenda-month-header';
  header.innerHTML = `
    <span>Minhas Datas Favoritas</span>
    <span class="agenda-month-badge">${allItems.length} guardadas</span>
  `;
  container.appendChild(header);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '10px';
  list.style.marginTop = '12px';

  allItems.forEach(evt => {
    const card = createAgendaEventCard(evt);
    list.appendChild(card);
  });

  container.appendChild(list);
}

// ============================================================================
// BOTTOM SHEET (PAINEL DESLIZANTE DE DETALHES DO DIA)
// ============================================================================
function getAdjacentDate(dateStr, deltaDays) {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);
  dateObj.setDate(dateObj.getDate() + deltaDays);

  const newY = dateObj.getFullYear();
  const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const newD = String(dateObj.getDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
}

function navigateDay(deltaDays) {
  if (!state.selectedDate) return;
  const newDateStr = getAdjacentDate(state.selectedDate, deltaDays);
  const parts = newDateStr.split('-');
  const newYear = parseInt(parts[0], 10);
  const newMonthIdx = parseInt(parts[1], 10) - 1;

  state.selectedDate = newDateStr;

  // Se o mês mudou ao avançar/recuar dia, sincroniza o calendário de fundo
  if (newMonthIdx !== state.currentMonth || newYear !== state.currentYear) {
    state.currentYear = newYear;
    state.currentMonth = newMonthIdx;
    setMonth(newMonthIdx, true);
  } else {
    // Sincronizar célula selecionada na grelha do mês
    document.querySelectorAll('.calendar-day-cell.selected').forEach(c => c.classList.remove('selected'));
    const cell = document.querySelector(`.calendar-day-cell[data-date="${newDateStr}"]`);
    if (cell) cell.classList.add('selected');
  }

  // Atualizar conteúdo do Bottom Sheet com animação de direção
  const animDir = deltaDays > 0 ? 'next' : 'prev';
  renderBottomSheetContent(newDateStr, animDir);
}

function openDayDetails(dateStr) {
  state.selectedDate = dateStr;
  renderBottomSheetContent(dateStr);
  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('dayBottomSheet').classList.add('open');
}

function renderBottomSheetContent(dateStr, animDirection = null) {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const dObj = new Date(year, monthIdx, day);
  const weekday = WEEKDAY_NAMES[dObj.getDay()];

  const events = getEventsForDate(dateStr);

  document.getElementById('sheetTitle').textContent = `${day} de ${MONTH_NAMES[monthIdx]} de ${year}`;
  document.getElementById('sheetWeekday').textContent = weekday;
  document.getElementById('sheetEventsCount').textContent = `${events.length} comemoraç${events.length === 1 ? 'ão' : 'ões'}`;

  const listEl = document.getElementById('sheetEventsList');
  listEl.innerHTML = '';

  // Animação de transição suave se estiver a navegar
  listEl.classList.remove('slide-next', 'slide-prev');
  if (animDirection) {
    void listEl.offsetWidth; // Forçar reflow para reiniciar animação
    listEl.classList.add(animDirection === 'next' ? 'slide-next' : 'slide-prev');
  }

  if (events.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px;">
        <span class="material-symbols-rounded" style="font-size: 40px; opacity: 0.4;">event_busy</span>
        <p style="margin-top: 8px;">Sem datas comemorativas específicas neste dia.</p>
      </div>
    `;
  } else {
    events.forEach(evt => {
      const item = document.createElement('div');
      item.className = 'sheet-event-item';
      
      const isFav = state.favorites.has(evt.id);

      // Links Google Calendar e iCal
      const gCalUrl = generateGoogleCalendarUrl(evt, dateStr);

      item.innerHTML = `
        <div class="sheet-event-top">
          <div class="sheet-event-title-group">
            <div class="sheet-event-icon-circle" style="background:${evt.badgeBg}; color:${evt.color};">
              <span class="material-symbols-rounded">${evt.icon || 'event'}</span>
            </div>
            <div>
              <div class="sheet-event-title">${escapeHtml(evt.title)}</div>
              <span class="agenda-card-category" style="background:${evt.badgeBg}; color:${evt.color}; margin-top:2px;">
                ${escapeHtml(evt.category)}
              </span>
            </div>
          </div>
          <button class="icon-btn btn-fav-sheet" style="color:${isFav ? '#f9ab00' : 'var(--text-subtle)'};" title="Favorito">
            <span class="material-symbols-rounded">${isFav ? 'star' : 'star_border'}</span>
          </button>
        </div>

        <div class="sheet-event-actions">
          ${evt.url ? `
            <a href="${evt.url}" target="_blank" rel="noopener noreferrer" class="sheet-action-btn">
              <span class="material-symbols-rounded" style="font-size:16px;">open_in_new</span>
              Saber Mais
            </a>
          ` : ''}

          <a href="${gCalUrl}" target="_blank" rel="noopener noreferrer" class="sheet-action-btn" title="Adicionar ao Google Calendar">
            <span class="material-symbols-rounded" style="font-size:16px; color:#1a73e8;">add_to_drive</span>
            Google Calendar
          </a>

          <button class="sheet-action-btn btn-download-ics" title="Descarregar ficheiro .ics">
            <span class="material-symbols-rounded" style="font-size:16px;">download</span>
            .iCal
          </button>

          <button class="sheet-action-btn btn-share" title="Partilhar Data">
            <span class="material-symbols-rounded" style="font-size:16px;">share</span>
            Partilhar
          </button>
        </div>
      `;

      // Event listener Favorito no modal
      const favBtn = item.querySelector('.btn-fav-sheet');
      favBtn.addEventListener('click', () => {
        toggleFavorite(evt.id);
        const nowFav = state.favorites.has(evt.id);
        favBtn.querySelector('.material-symbols-rounded').textContent = nowFav ? 'star' : 'star_border';
        favBtn.style.color = nowFav ? '#f9ab00' : 'var(--text-subtle)';
        updateView();
      });

      // Event listener download iCal
      item.querySelector('.btn-download-ics').addEventListener('click', () => {
        downloadIcsFile(evt, dateStr);
      });

      // Event listener partilha
      item.querySelector('.btn-share').addEventListener('click', () => {
        shareEvent(evt, dateStr);
      });

      listEl.appendChild(item);
    });
  }
}

function closeBottomSheet() {
  document.getElementById('sheetBackdrop').classList.remove('open');
  document.getElementById('dayBottomSheet').classList.remove('open');
}

// ============================================================================
// PESQUISA RÁPIDA INSTANTÂNEA
// ============================================================================
function openSearch() {
  const modal = document.getElementById('searchModal');
  modal.classList.add('open');
  const input = document.getElementById('searchInput');
  setTimeout(() => input.focus(), 150);
}

function closeSearch() {
  const modal = document.getElementById('searchModal');
  modal.classList.remove('open');
}

function executeSearch(query) {
  const resultsContainer = document.getElementById('searchResultsList');
  const cleanQ = normalizeText(query);
  const selectedCat = state.activeCategoryFilter;

  if (!state.data || (!cleanQ && selectedCat === 'Todas')) {
    resultsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
        <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">manage_search</span>
        <p style="margin-top: 10px; font-weight: 500;">Escreve qualquer palavra-chave</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Ex: "Paz", "Mãe", "Mulher", "Chocolate", "Feriado", "Música"</p>
      </div>
    `;
    return;
  }

  // Filtrar
  let matches = state.data.items.filter(item => {
    // Filtro de Categoria
    if (selectedCat !== 'Todas') {
      if (selectedCat === 'Feriado Nacional' && !item.isHoliday) return false;
      if (selectedCat !== 'Feriado Nacional' && item.category !== selectedCat) return false;
    }

    if (!cleanQ) return true;

    const titleNorm = normalizeText(item.title);
    const catNorm = normalizeText(item.category);
    const monthNorm = normalizeText(item.monthName);
    return titleNorm.includes(cleanQ) || catNorm.includes(cleanQ) || monthNorm.includes(cleanQ);
  });

  if (matches.length === 0) {
    resultsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
        <span class="material-symbols-rounded" style="font-size: 44px; opacity: 0.4;">search_off</span>
        <p style="margin-top: 10px; font-weight: 500;">Nenhuma comemoração encontrada</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Tenta pesquisar por outra palavra ou remover filtros.</p>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = '';
  // Limitar resultados para desempenho mobile instantâneo
  const limitedMatches = matches.slice(0, 50);

  limitedMatches.forEach(item => {
    const el = document.createElement('div');
    el.className = 'search-result-item';

    const highlightedTitle = highlightMatch(item.title, cleanQ);

    el.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:600; font-size:0.95rem; margin-bottom:3px;">${highlightedTitle}</div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="agenda-card-category" style="background:${item.badgeBg}; color:${item.color};">
            ${escapeHtml(item.category)}
          </span>
          <span style="font-size:0.75rem; color:var(--text-subtle);">• ${item.day} de ${item.monthName}</span>
        </div>
      </div>
      <div class="search-result-date">
        <span>${item.day}/${String(item.month).padStart(2, '0')}</span>
        <span class="material-symbols-rounded" style="font-size:18px;">chevron_right</span>
      </div>
    `;

    el.addEventListener('click', () => {
      closeSearch();
      state.currentMonth = item.month - 1;
      state.selectedDate = item.date;
      setMonth(state.currentMonth);
      setTimeout(() => {
        openDayDetails(item.date);
      }, 200);
    });

    resultsContainer.appendChild(el);
  });
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="highlight-match">$1</span>');
}

// ============================================================================
// DRAWER
// ============================================================================
function openDrawer() {
  document.getElementById('drawerBackdrop').classList.add('open');
  document.getElementById('sideDrawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawerBackdrop').classList.remove('open');
  document.getElementById('sideDrawer').classList.remove('open');
}

function filterCategoryFromDrawer(category) {
  openSearch();
  const chip = document.querySelector(`#searchFilterChips .filter-chip[data-category="${category}"]`);
  if (chip) {
    document.querySelectorAll('#searchFilterChips .filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.activeCategoryFilter = category;
    executeSearch('');
  }
}

// ============================================================================
// EXPORTAÇÕES (GOOGLE CALENDAR, .ICS, PARTILHA)
// ============================================================================
function generateGoogleCalendarUrl(evt, dateStr) {
  const compactDate = dateStr.replace(/-/g, '');
  const start = compactDate;
  // Próximo dia para evento de dia inteiro
  const nextD = new Date(dateStr);
  nextD.setDate(nextD.getDate() + 1);
  const end = `${nextD.getFullYear()}${String(nextD.getMonth() + 1).padStart(2, '0')}${String(nextD.getDate()).padStart(2, '0')}`;

  const title = encodeURIComponent(evt.title);
  const details = encodeURIComponent(`Data Comemorativa: ${evt.title} (${evt.category})\nMais informações: ${evt.url || 'Calendário de Datas'}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

function downloadIcsFile(evt, dateStr) {
  const compactDate = dateStr.replace(/-/g, '');
  const nextD = new Date(dateStr);
  nextD.setDate(nextD.getDate() + 1);
  const end = `${nextD.getFullYear()}${String(nextD.getMonth() + 1).padStart(2, '0')}${String(nextD.getDate()).padStart(2, '0')}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Calendar Style Datas//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${compactDate}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${evt.title}`,
    `DESCRIPTION:${evt.category}${evt.url ? ' - ' + evt.url : ''}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${evt.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function shareEvent(evt, dateStr) {
  const shareData = {
    title: evt.title,
    text: `📅 ${evt.title} em ${dateStr}! (${evt.category})`,
    url: evt.url || window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (e) {
      // Ignorar cancelamento
    }
  } else {
    // Copiar para clipboard
    navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
    alert('Copiado para a área de transferência!');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
