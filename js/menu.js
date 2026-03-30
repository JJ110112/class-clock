/* ══════════════════════════════════
   Menu – Hamburger, Settings, Editor
   ══════════════════════════════════ */

const MenuModule = (() => {
  let isOpen = false;
  let editorScheduleId = null; // null = new, string = editing

  // ── Toggle menu ──
  function toggle() {
    isOpen = !isOpen;
    document.getElementById('hamburgerBtn').classList.toggle('open', isOpen);
    document.getElementById('menuOverlay').classList.toggle('open', isOpen);
    document.getElementById('menuPanel').classList.toggle('open', isOpen);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.getElementById('hamburgerBtn').classList.remove('open');
    document.getElementById('menuOverlay').classList.remove('open');
    document.getElementById('menuPanel').classList.remove('open');
  }

  // ── Period settings ──
  function renderPeriodSettings() {
    const settings = ExamData.loadPeriodSettings();
    const grid = document.getElementById('periodGrid');
    grid.innerHTML = '';

    settings.periods.forEach((p, i) => {
      const label = document.createElement('label');
      label.textContent = `第 ${p.label} 節`;
      const input = document.createElement('input');
      input.type = 'time';
      input.value = `${String(p.start[0]).padStart(2, '0')}:${String(p.start[1]).padStart(2, '0')}`;
      input.dataset.idx = i;
      input.addEventListener('change', () => {
        const [h, m] = input.value.split(':').map(Number);
        settings.periods[i].start = [h, m];
        ExamData.savePeriodSettings(settings);
      });
      grid.appendChild(label);
      grid.appendChild(input);
    });

    // School end time
    const endLabel = document.createElement('label');
    endLabel.textContent = '月考放學';
    endLabel.style.color = 'var(--accent)';
    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.value = `${String(settings.schoolEnd[0]).padStart(2, '0')}:${String(settings.schoolEnd[1]).padStart(2, '0')}`;
    endInput.addEventListener('change', () => {
      const [h, m] = endInput.value.split(':').map(Number);
      settings.schoolEnd = [h, m];
      ExamData.savePeriodSettings(settings);
    });
    grid.appendChild(endLabel);
    grid.appendChild(endInput);
  }

  // ── Schedule list ──
  function renderScheduleList() {
    const list = document.getElementById('scheduleList');
    list.innerHTML = '';
    const schedules = ExamData.loadAllSchedules();
    const activeId = ExamData.getActiveScheduleId();

    schedules.forEach(s => {
      const isActive = s.id === activeId;
      const item = document.createElement('div');
      item.className = 'schedule-item' + (isActive ? ' active' : '');
      item.innerHTML = `
        <label class="sched-check">
          <input type="checkbox" ${isActive ? 'checked' : ''} />
          <span class="sched-checkmark"></span>
        </label>
        <span class="sched-name">${s.name}</span>
        <span class="sched-type ${s.type}">${s.type === 'monthly' ? '月考' : '模擬考'}</span>
        <button class="sched-edit" data-id="${s.id}">編輯</button>
        <button class="sched-delete" data-id="${s.id}">刪除</button>
      `;
      
      // Event listeners
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        ExamData.setActiveScheduleId(checkbox.checked ? s.id : null);
        renderScheduleList();
      });
      
      item.querySelector('.sched-edit').addEventListener('click', () => {
        openEditor(s.id);
      });
      
      item.querySelector('.sched-delete').addEventListener('click', () => {
        if (confirm(`確定刪除考程「${s.name}」？`)) {
          ExamData.deleteSchedule(s.id);
          renderScheduleList();
        }
      });
      
      list.appendChild(item);
    });thly' ? '月考' : '模擬'}</span>
        <div class="sched-actions">
          <button class="edit" title="編輯">✎</button>
          <button class="del" title="刪除">✕</button>
        </div>
      `;
      // Toggle active on checkbox
      item.querySelector('.sched-check input').addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) {
          ExamData.setActiveScheduleId(s.id);
        } else {
          ExamData.setActiveScheduleId(null);
        }
        renderScheduleList();
        ExamUI.updateStatus(new Date());
      });
      item.querySelector('.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor(s.id);
      });
      item.querySelector('.del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`確定刪除「${s.name}」？`)) {
          ExamData.deleteSchedule(s.id);
          renderScheduleList();
        }
      });
      list.appendChild(item);
    });
  }


  // ══════════════════════════════════
  //  Schedule Editor
  // ══════════════════════════════════

  let editorState = {
    name: '',
    type: 'monthly',
    startDate: '',
    days: [{ slots: [] }],
    earlySubmit: { ...ExamData.DEFAULT_EARLY_SUBMIT_MONTHLY },
    currentDay: 0,
  };

  function openEditor(scheduleId) {
    editorScheduleId = scheduleId || null;
    const overlay = document.getElementById('editorOverlay');

    if (scheduleId) {
      const s = ExamData.getScheduleById(scheduleId);
      if (!s) return;
      editorState = {
        name: s.name,
        type: s.type,
        startDate: s.dates[0] || '',
        days: JSON.parse(JSON.stringify(s.days)),
        earlySubmit: s.type === 'monthly'
          ? { ...(s.earlySubmit || ExamData.DEFAULT_EARLY_SUBMIT_MONTHLY) }
          : {},
        currentDay: 0,
      };
    } else {
      editorState = {
        name: '',
        type: 'monthly',
        startDate: '',
        days: [{ slots: [] }],
        earlySubmit: { ...ExamData.DEFAULT_EARLY_SUBMIT_MONTHLY },
        currentDay: 0,
      };
    }

    renderEditor();
    overlay.classList.add('open');
  }

  function closeEditor() {
    document.getElementById('editorOverlay').classList.remove('open');
  }

  function renderEditor() {
    // Basic fields
    document.getElementById('editorName').value = editorState.name;
    document.getElementById('editorType').value = editorState.type;
    document.getElementById('editorDate').value = editorState.startDate;

    renderDayTabs();
    renderScheduleGrid();
    renderEarlySubmitSettings();
  }

  function renderDayTabs() {
    const container = document.getElementById('dayTabs');
    container.innerHTML = '';

    editorState.days.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.className = 'day-tab' + (i === editorState.currentDay ? ' active' : '');
      btn.textContent = `第${i + 1}天`;
      btn.addEventListener('click', () => {
        editorState.currentDay = i;
        renderDayTabs();
        renderScheduleGrid();
        renderEarlySubmitSettings();
      });
      container.appendChild(btn);
    });

    // Add day button (max 3)
    if (editorState.days.length < 3) {
      const addBtn = document.createElement('button');
      addBtn.className = 'day-tab-add';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', () => {
        editorState.days.push({ slots: [] });
        editorState.currentDay = editorState.days.length - 1;
        renderDayTabs();
        renderScheduleGrid();
      });
      container.appendChild(addBtn);
    }

    // Remove day button (min 1)
    if (editorState.days.length > 1) {
      const rmBtn = document.createElement('button');
      rmBtn.className = 'day-tab-add';
      rmBtn.textContent = '−';
      rmBtn.title = '移除最後一天';
      rmBtn.addEventListener('click', () => {
        editorState.days.pop();
        if (editorState.currentDay >= editorState.days.length) {
          editorState.currentDay = editorState.days.length - 1;
        }
        renderDayTabs();
        renderScheduleGrid();
      });
      container.appendChild(rmBtn);
    }
  }

  function renderScheduleGrid() {
    const gridEl = document.getElementById('scheduleGrid');
    gridEl.innerHTML = '';

    const settings = ExamData.loadPeriodSettings();
    const daySlots = editorState.days[editorState.currentDay]?.slots || [];
    const isMock = editorState.type === 'mock';

    for (let p = 1; p <= 7; p++) {
      const period = settings.periods[p - 1];
      const slotEl = document.createElement('div');
      slotEl.className = 'grid-slot';
      slotEl.dataset.period = p;

      const timeStr = `${String(period.start[0]).padStart(2, '0')}:${String(period.start[1]).padStart(2, '0')}`;

      slotEl.innerHTML = `
        <span class="slot-label">第${p}節 ${timeStr}</span>
        <div class="slot-content" data-period="${p}"></div>
      `;

      // Find placed block for this period
      const placed = daySlots.find(s => s.period === p);
      if (placed) {
        const contentEl = slotEl.querySelector('.slot-content');
        contentEl.appendChild(createPlacedBlock(placed, p, isMock));
      }

      // Drop target
      slotEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        slotEl.classList.add('drag-over');
      });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        handleDrop(p, e);
      });

      gridEl.appendChild(slotEl);
    }
  }

  function createPlacedBlock(slot, period, isMock) {
    const block = document.createElement('div');
    block.className = 'placed-block' + (slot.isStudy ? ' study-block' : '');
    block.draggable = true;
    block.dataset.period = period;

    let content = slot.isStudy ? '自習' : `${slot.duration}分`;
    if (isMock && slot.subject && !slot.isStudy) {
      content = `${slot.subject} ${slot.duration}分`;
    }
    if (isMock && slot.start) {
      const t = `${String(slot.start[0]).padStart(2, '0')}:${String(slot.start[1]).padStart(2, '0')}`;
      content += ` (${t})`;
    }

    block.innerHTML = `
      <span>${content}</span>
      <button class="block-remove">✕</button>
    `;

    block.querySelector('.block-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeSlot(period);
    });

    block.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'move', fromPeriod: period }));
    });

    // Click to edit subject (mock only)
    if (isMock) {
      block.addEventListener('dblclick', () => {
        const name = prompt('請輸入科目名稱（例：國文、英文、數學、專業科目一）：', slot.subject || '');
        if (name !== null) {
          slot.subject = name;
          renderScheduleGrid();
        }
      });
    }

    return block;
  }

  function checkOverlap(daySlots, toPeriod, duration, excludePeriod) {
    const settings = ExamData.loadPeriodSettings();
    return ExamData.checkSlotOverlap(settings.periods, daySlots, toPeriod, duration, excludePeriod);
  }

  function handleDrop(toPeriod, e) {
    let data;
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }

    const daySlots = editorState.days[editorState.currentDay].slots;
    const isMock = editorState.type === 'mock';

    if (data.type === 'new') {
      // New block from palette
      const existing = daySlots.find(s => s.period === toPeriod);
      if (existing) return; // Slot already occupied

      // Check time overlap
      const overlap = checkOverlap(daySlots, toPeriod, data.duration, null);
      if (overlap) {
        alert(`時間衝突：${data.duration} 分鐘的區塊會與第 ${overlap.period} 節重疊`);
        return;
      }

      const settings = ExamData.loadPeriodSettings();
      const period = settings.periods[toPeriod - 1];

      const newSlot = { period: toPeriod, duration: data.duration, isStudy: !!data.isStudy };
      if (isMock) {
        let subject = data.isStudy ? '自習' : '';
        if (!data.isStudy) {
          subject = prompt('請輸入科目名稱（例：國文、英文、數學、專業科目一）：', '') || '';
        }
        newSlot.subject = subject;
        newSlot.start = [...period.start];
        newSlot.earlySubmit = 0;
      }
      daySlots.push(newSlot);

    } else if (data.type === 'move') {
      // Move existing block
      const fromPeriod = data.fromPeriod;
      if (fromPeriod === toPeriod) return;

      const existing = daySlots.find(s => s.period === toPeriod);
      if (existing) return;

      const slot = daySlots.find(s => s.period === fromPeriod);
      if (!slot) return;

      // Check time overlap (exclude the block being moved)
      const overlap = checkOverlap(daySlots, toPeriod, slot.duration, fromPeriod);
      if (overlap) {
        alert(`時間衝突：移動後會與第 ${overlap.period} 節重疊`);
        return;
      }

      slot.period = toPeriod;
      if (isMock) {
        const settings = ExamData.loadPeriodSettings();
        const period = settings.periods[toPeriod - 1];
        slot.start = [...period.start];
      }
    }

    renderScheduleGrid();
  }

  function removeSlot(period) {
    const daySlots = editorState.days[editorState.currentDay].slots;
    const idx = daySlots.findIndex(s => s.period === period);
    if (idx !== -1) daySlots.splice(idx, 1);
    renderScheduleGrid();
  }

  function renderEarlySubmitSettings() {
    const container = document.getElementById('earlySubmitSection');
    const grid = document.getElementById('earlySubmitGrid');

    if (editorState.type === 'monthly') {
      container.style.display = '';
      grid.innerHTML = '';
      for (let p = 1; p <= 7; p++) {
        const label = document.createElement('label');
        label.textContent = `第${p}節`;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '60';
        input.value = editorState.earlySubmit[p] ?? 15;
        input.addEventListener('change', () => {
          editorState.earlySubmit[p] = parseInt(input.value) || 0;
        });
        const unit = document.createElement('span');
        unit.className = 'unit';
        unit.textContent = '分鐘前';
        grid.appendChild(label);
        grid.appendChild(input);
        grid.appendChild(unit);
      }
    } else {
      // Mock: show per-slot early submit
      container.style.display = '';
      grid.innerHTML = '';
      const daySlots = editorState.days[editorState.currentDay]?.slots || [];
      if (daySlots.length === 0) {
        grid.innerHTML = '<span style="font-size:0.78rem;color:var(--dim);grid-column:1/-1">先拖曳區塊到節次</span>';
        return;
      }
      daySlots.forEach(slot => {
        const label = document.createElement('label');
        label.textContent = slot.subject || `第${slot.period}節`;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '60';
        input.value = slot.earlySubmit ?? 0;
        input.addEventListener('change', () => {
          slot.earlySubmit = parseInt(input.value) || 0;
        });
        const unit = document.createElement('span');
        unit.className = 'unit';
        unit.textContent = '分鐘前';
        grid.appendChild(label);
        grid.appendChild(input);
        grid.appendChild(unit);
      });
    }
  }

  function saveEditor() {
    const name = document.getElementById('editorName').value.trim();
    const type = document.getElementById('editorType').value;
    const startDate = document.getElementById('editorDate').value;

    if (!name) { alert('請輸入考程名稱'); return; }
    if (!startDate) { alert('請設定考試日期'); return; }

    // Generate dates array from start date
    const dates = [];
    for (let i = 0; i < editorState.days.length; i++) {
      dates.push(ExamData.addDays(startDate, i));
    }

    // For mock: ensure custom start times from inputs
    if (type === 'mock') {
      editorState.days.forEach(day => {
        day.slots.forEach(slot => {
          if (!slot.start) {
            const settings = ExamData.loadPeriodSettings();
            const p = settings.periods[slot.period - 1];
            slot.start = [...p.start];
          }
        });
      });
    }

    const data = {
      name,
      type,
      dates,
      days: editorState.days,
      earlySubmit: type === 'monthly' ? editorState.earlySubmit : undefined,
    };

    if (editorScheduleId) {
      ExamData.updateSchedule(editorScheduleId, data);
    } else {
      ExamData.createSchedule(data);
    }

    closeEditor();
    renderScheduleList();
    ExamUI.renderSelector();
  }

  // ── Type change handler ──
  function onTypeChange() {
    editorState.type = document.getElementById('editorType').value;
    if (editorState.type === 'monthly') {
      editorState.earlySubmit = editorState.earlySubmit || { ...ExamData.DEFAULT_EARLY_SUBMIT_MONTHLY };
    }
    renderScheduleGrid();
    renderEarlySubmitSettings();
  }

  // ── Init ──
  function init() {
    document.getElementById('hamburgerBtn').addEventListener('click', toggle);
    document.getElementById('menuOverlay').addEventListener('click', close);
    document.getElementById('editorClose').addEventListener('click', closeEditor);
    document.getElementById('btnNewSchedule').addEventListener('click', () => openEditor(null));
    document.getElementById('btnSaveEditor').addEventListener('click', saveEditor);
    document.getElementById('btnCancelEditor').addEventListener('click', closeEditor);
    document.getElementById('editorType').addEventListener('change', onTypeChange);

    // Drag palette
    document.querySelectorAll('.drag-block').forEach(block => {
      block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'new',
          duration: parseInt(block.dataset.duration),
          isStudy: block.dataset.study === 'true',
        }));
      });
    });

    renderPeriodSettings();
    renderScheduleList();
  }

  return { init, close, openEditor, renderScheduleList };
})();
