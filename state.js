(function () {
	const STORAGE_KEY = 'tablePlanner:v1';
	const HISTORY_LIMIT = 50;

	function defaultState() {
		return {
			version: 1,
			guests: [],
			tables: [],
			ui: { selectedTableId: null, selectedTableIds: [], zoom: 1, guestSort: 'unassignedFirst', guestUnassignedOnly: false, snap: false, grid: 64, showGrid: true, language: 'bg' },
			_history: { past: [], future: [], suppress: false }
		};
	}

	function migrate(obj) {
		if (!obj.ui) obj.ui = { selectedTableId: null, selectedTableIds: [], zoom: 1 };
		if (obj.ui.selectedTableIds === undefined) obj.ui.selectedTableIds = [];
		if (obj.ui.guestSort === undefined) obj.ui.guestSort = 'unassignedFirst';
		if (obj.ui.guestUnassignedOnly === undefined) obj.ui.guestUnassignedOnly = false;
		if (obj.ui.snap === undefined) obj.ui.snap = false;
		if (obj.ui.grid === undefined) obj.ui.grid = 64;
		if (obj.ui.showGrid === undefined) obj.ui.showGrid = true;
		if (obj.ui.language === undefined) obj.ui.language = 'bg';
		if (!obj._history) obj._history = { past: [], future: [], suppress: false };
		for (const t of (obj.tables || [])) {
			if (t.type === 'rect') {
				if (t.rectOneSided === undefined) t.rectOneSided = false;
				if (!t.oneSide) t.oneSide = 'top';
				if (!t.oddExtraSide) t.oddExtraSide = 'top';
			}
		}
		return obj;
	}

	function cloneShallow(obj) { return JSON.parse(JSON.stringify(obj)); }

	function pushHistory() {
		if (state._history.suppress) return;
		const snap = cloneShallow({ guests: state.guests, tables: state.tables, ui: state.ui });
		state._history.past.push(snap);
		if (state._history.past.length > HISTORY_LIMIT) state._history.past.shift();
		state._history.future = [];
	}

	function beginHistoryGroup() { pushHistory(); state._history.suppress = true; }
	function endHistoryGroup() { state._history.suppress = false; }

	function undo() {
		const past = state._history.past;
		if (!past.length) return;
		const current = cloneShallow({ guests: state.guests, tables: state.tables, ui: state.ui });
		const prev = past.pop();
		state._history.future.push(current);
		if (state._history.future.length > HISTORY_LIMIT) state._history.future.shift();
		state.guests = prev.guests;
		state.tables = prev.tables;
		state.ui = prev.ui;
		save();
		window.TablePlanner.render();
	}

	function redo() {
		const future = state._history.future;
		if (!future.length) return;
		const current = cloneShallow({ guests: state.guests, tables: state.tables, ui: state.ui });
		const next = future.pop();
		state._history.past.push(current);
		if (state._history.past.length > HISTORY_LIMIT) state._history.past.shift();
		state.guests = next.guests;
		state.tables = next.tables;
		state.ui = next.ui;
		save();
		window.TablePlanner.render();
	}

	function load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return defaultState();
			const parsed = JSON.parse(raw);
			const st = migrate(parsed);
			// ensure in-memory history exists
			if (!st._history) st._history = { past: [], future: [], suppress: false };
			return st;
		} catch (e) {
			return defaultState();
		}
	}

	function save() {
		const persisted = { version: state.version, guests: state.guests, tables: state.tables, ui: state.ui };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
	}

	function commitTableLabel(id, raw) {
		pushHistory();
		const t = state.tables.find(t => t.id === id);
		if (!t) return;
		let label = String(raw || '').trim();
		if (!label) label = t.label;
		const taken = new Set(state.tables.filter(x => x.id !== id).map(x => String(x.label)));
		if (!taken.has(label)) {
			t.label = label;
			save();
			window.TablePlanner.render();
			return;
		}
		const asNum = Number(label);
		if (Number.isFinite(asNum) && String(asNum) === label) {
			let n = asNum;
			while (taken.has(String(n))) n++;
			t.label = String(n);
		} else {
			let suffix = 2;
			while (taken.has(`${label}-${suffix}`)) suffix++;
			t.label = `${label}-${suffix}`;
		}
		save();
		window.TablePlanner.render();
	}

	function nextLabel(existing) {
		let n = 1;
		const labels = new Set(existing.map(t => String(t.label)));
		while (labels.has(String(n))) n++;
		return String(n);
	}

	function addTableCircle() {
		pushHistory();
		// Use consistent positioning - center of the initial canvas area
		const x = 700; // Center of 1400px width
		const y = 450; // Center of 900px height
		const table = {
			id: 't_' + Math.random().toString(36).slice(2, 8),
			type: 'circle',
			label: nextLabel(state.tables),
			x, y,
			radius: 70,
			seats: 8,
			assignments: {}
		};
		state.tables.push(table);
		state.ui.selectedTableId = table.id;
		save();
		window.TablePlanner.render();
	}

	function addTableRect() {
		pushHistory();
		// Use consistent positioning - center of the initial canvas area
		const x = 700; // Center of 1400px width
		const y = 450; // Center of 900px height
		const table = {
			id: 't_' + Math.random().toString(36).slice(2, 8),
			type: 'rect',
			label: nextLabel(state.tables),
			x, y,
			width: 160,
			height: 100,
			seats: 8,
			assignments: {},
			rectOneSided: false,
			oneSide: 'top',
			oddExtraSide: 'top'
		};
		state.tables.push(table);
		state.ui.selectedTableId = table.id;
		save();
		window.TablePlanner.render();
	}

	function addSeparator() {
		pushHistory();
		// Use consistent positioning - center of the initial canvas area
		const x = 700; // Center of 1400px width
		const y = 450; // Center of 900px height
		const separator = {
			id: 's_' + Math.random().toString(36).slice(2, 8),
			type: 'separator',
			x, y,
			width: 120,
			height: 20
		};
		state.tables.push(separator);
		state.ui.selectedTableId = separator.id;
		save();
		window.TablePlanner.render();
	}


	function selectTable(id) {
		state.ui.selectedTableId = id;
		state.ui.selectedTableIds = id ? [id] : [];
		save();
		window.TablePlanner.render();
	}

	function selectMultipleTables(ids) {
		state.ui.selectedTableIds = [...ids];
		state.ui.selectedTableId = ids.length === 1 ? ids[0] : null;
		save();
		window.TablePlanner.render();
	}

	function addToSelection(id) {
		if (!state.ui.selectedTableIds.includes(id)) {
			state.ui.selectedTableIds.push(id);
			state.ui.selectedTableId = state.ui.selectedTableIds.length === 1 ? id : null;
			save();
			window.TablePlanner.render();
		}
	}

	function removeFromSelection(id) {
		const index = state.ui.selectedTableIds.indexOf(id);
		if (index !== -1) {
			state.ui.selectedTableIds.splice(index, 1);
			state.ui.selectedTableId = state.ui.selectedTableIds.length === 1 ? state.ui.selectedTableIds[0] : null;
			save();
			window.TablePlanner.render();
		}
	}

	function clearSelection() {
		state.ui.selectedTableIds = [];
		state.ui.selectedTableId = null;
		save();
		window.TablePlanner.render();
	}

	function isSelected(id) {
		return state.ui.selectedTableIds.includes(id);
	}

	function getSelectedTables() {
		return state.tables.filter(t => state.ui.selectedTableIds.includes(t.id));
	}

	function removeTable(id) {
		// Only push history if not in a history group
		if (!state._history.suppress) {
			pushHistory();
		}
		const idx = state.tables.findIndex(t => t.id === id);
		if (idx === -1) return;
		state.tables.splice(idx, 1);
		// Remove from selection arrays
		state.ui.selectedTableIds = state.ui.selectedTableIds.filter(selectedId => selectedId !== id);
		if (state.ui.selectedTableId === id) {
			state.ui.selectedTableId = state.ui.selectedTableIds.length === 1 ? state.ui.selectedTableIds[0] : null;
		}
		save();
		window.TablePlanner.render();
	}

	function updateTablePosition(id, x, y) {
		// no pushHistory here; drag grouping will handle it
		const t = state.tables.find(t => t.id === id);
		if (!t) return;
		t.x = x; t.y = y;
		save();
	}

	function updateMultipleTablePositions(updates) {
		// no pushHistory here; drag grouping will handle it
		for (const { id, x, y } of updates) {
			const t = state.tables.find(t => t.id === id);
			if (t) {
				t.x = x;
				t.y = y;
			}
		}
		save();
	}

	function updateTableRadius(id, radius) {
		// Only push history if not in a history group
		if (!state._history.suppress) {
			pushHistory();
		}
		const t = state.tables.find(t => t.id === id);
		if (!t || t.type !== 'circle') return;
		t.radius = Math.max(40, Math.min(220, radius));
		save();
	}

	function updateTableSize(id, width, height, pushToHistory = true) {
		// Only push history if not in a history group and pushToHistory is true
		if (pushToHistory && !state._history.suppress) {
			pushHistory();
		}
		const t = state.tables.find(t => t.id === id);
		if (!t || (t.type !== 'rect' && t.type !== 'separator')) return;

		console.log('updateTableSize called for:', id, 'type:', t.type, 'new size:', width, 'x', height);

		if (t.type === 'separator') {
			t.width = Math.max(40, Math.min(600, width));   // Smaller min width for separators
			t.height = Math.max(10, Math.min(600, height)); // Smaller min height for separators
		} else {
			t.width = Math.max(80, Math.min(600, width));   // Regular min width for rectangles
			t.height = Math.max(60, Math.min(600, height)); // Regular min height for rectangles
		}
		save();
	}

	function setRectOneSided(id, flag) { pushHistory(); const t = state.tables.find(t => t.id === id && t.type === 'rect'); if (!t) return; t.rectOneSided = !!flag; save(); window.TablePlanner.render(); }
	function setRectOneSide(id, side) { pushHistory(); const t = state.tables.find(t => t.id === id && t.type === 'rect'); if (!t) return; if (!['top', 'right', 'bottom', 'left'].includes(side)) return; t.oneSide = side; save(); window.TablePlanner.render(); }
	function setRectOddExtraSide(id, side) { pushHistory(); const t = state.tables.find(t => t.id === id && t.type === 'rect'); if (!t) return; if (!['top', 'right', 'bottom', 'left'].includes(side)) return; t.oddExtraSide = side; save(); window.TablePlanner.render(); }

	function addGuest(name, color) { pushHistory(); const g = { id: 'g_' + Math.random().toString(36).slice(2, 8), name: name.trim(), color: color || '#6aa9ff' }; if (!g.name) return; state.guests.push(g); save(); window.TablePlanner.render(); }
	function updateGuest(id, patch) { pushHistory(); const g = state.guests.find(g => g.id === id); if (!g) return; Object.assign(g, patch); save(); window.TablePlanner.render(); }
	function deleteGuest(id) { pushHistory(); state.guests = state.guests.filter(g => g.id !== id); for (const t of state.tables) { for (const k in t.assignments) { if (t.assignments[k] === id) delete t.assignments[k]; } } save(); window.TablePlanner.render(); }
	function setGuestSort(sort) { state.ui.guestSort = sort; save(); window.TablePlanner.render(); }
	function setGuestUnassignedOnly(flag) { state.ui.guestUnassignedOnly = !!flag; save(); window.TablePlanner.render(); }

	function assignGuestToSeat(tableId, seatIndex, guestId) { pushHistory(); const table = state.tables.find(t => t.id === tableId); if (!table) return; if (seatIndex < 0 || seatIndex >= table.seats) return; for (const t of state.tables) { for (const k in t.assignments) { if (t.assignments[k] === guestId) { delete t.assignments[k]; } } } table.assignments[String(seatIndex)] = guestId; save(); window.TablePlanner.render(); }
	function unassignSeat(tableId, seatIndex) { pushHistory(); const table = state.tables.find(t => t.id === tableId); if (!table) return; delete table.assignments[String(seatIndex)]; save(); window.TablePlanner.render(); }
	function setTableSeats(tableId, newSeats) { pushHistory(); const t = state.tables.find(t => t.id === tableId); if (!t) return false; const seats = Math.max(1, Math.min(32, Math.floor(newSeats))); if (seats === t.seats) return true; if (seats > t.seats) { t.seats = seats; save(); window.TablePlanner.render(); return true; } const lost = []; for (const k in t.assignments) { const idx = Number(k); if (idx >= seats) { lost.push({ seat: idx, guestId: t.assignments[k] }); } } if (lost.length) { const confirmMsg = `Reducing seats to ${seats} will unassign ${lost.length} guest(s). Continue?`; if (!window.confirm(confirmMsg)) { state._history.past.pop(); return false; } for (const item of lost) { delete t.assignments[String(item.seat)]; } } t.seats = seats; save(); window.TablePlanner.render(); return true; }

	function setSnap(flag) {
		state.ui.snap = !!flag;
		save();
	}
	function setGridSize(size) {
		const n = Math.max(4, Math.min(64, Math.floor(size)));
		state.ui.grid = n;
		save();
	}

	const state = load();

	function setLanguage(lang) {
		state.ui.language = lang;
		save();
	}


	window.TablePlanner = Object.assign(window.TablePlanner || {}, {
		state,
		undo,
		redo,
		pushHistory,
		beginHistoryGroup,
		endHistoryGroup,
		commitTableLabel,
		// snapping
		setSnap,
		setGridSize,
		addTableCircle,
		addTableRect,
		addSeparator,
		selectTable,
		selectMultipleTables,
		addToSelection,
		removeFromSelection,
		clearSelection,
		isSelected,
		getSelectedTables,
		removeTable,
		updateTablePosition,
		updateMultipleTablePositions,
		updateTableRadius,
		updateTableSize,
		setRectOneSided,
		setRectOneSide,
		setRectOddExtraSide,
		addGuest,
		updateGuest,
		deleteGuest,
		setGuestSort,
		setGuestUnassignedOnly,
		assignGuestToSeat,
		unassignSeat,
		setTableSeats,
		setLanguage,
		save
	});
})();
