(function () {
	const STORAGE_KEY = 'tablePlanner:v1';
	const HISTORY_LIMIT = 50;

	function defaultState() {
		return {
			version: 1,
			guests: [],
			tables: [],
			ui: { selectedTableId: null, selectedTableIds: [], zoom: 1, panX: 0, panY: 0, guestSort: 'unassignedFirst', guestUnassignedOnly: true, snap: false, grid: 64, showGrid: true, language: 'bg', sidebarCollapsed: false, pixelsPerMeter: 100, viewMode: 'canvas' },
			pictures: { folderPath: null, folderHandle: null, imageCache: {} },
			colorLegend: {}, // Maps color hex codes to custom labels
			_history: { past: [], future: [], suppress: false }
		};
	}

	function migrate(obj) {
		if (!obj.ui) obj.ui = { selectedTableId: null, selectedTableIds: [], zoom: 1, panX: 0, panY: 0 };
		if (obj.ui.selectedTableIds === undefined) obj.ui.selectedTableIds = [];
		if (obj.ui.zoom === undefined) obj.ui.zoom = 1;
		if (obj.ui.panX === undefined) obj.ui.panX = 0;
		if (obj.ui.panY === undefined) obj.ui.panY = 0;
		if (obj.ui.guestSort === undefined) obj.ui.guestSort = 'unassignedFirst';
		if (obj.ui.guestUnassignedOnly === undefined) obj.ui.guestUnassignedOnly = true;
		if (obj.ui.snap === undefined) obj.ui.snap = false;
		if (obj.ui.grid === undefined) obj.ui.grid = 64;
		if (obj.ui.showGrid === undefined) obj.ui.showGrid = true;
		if (obj.ui.language === undefined) obj.ui.language = 'bg';
		if (obj.ui.sidebarCollapsed === undefined) obj.ui.sidebarCollapsed = false;
		if (obj.ui.pixelsPerMeter === undefined) obj.ui.pixelsPerMeter = 100;
		if (obj.ui.viewMode === undefined) obj.ui.viewMode = 'canvas';
		if (!obj.pictures) obj.pictures = { folderPath: null, folderHandle: null, imageCache: {} };
		if (!obj.colorLegend) obj.colorLegend = {};
		if (!obj._history) obj._history = { past: [], future: [], suppress: false };
		for (const t of (obj.tables || [])) {
			if (t.type === 'rect') {
				if (t.rectOneSided === undefined) t.rectOneSided = false;
				if (!t.oneSide) t.oneSide = 'top';
				if (!t.oddExtraSide) t.oddExtraSide = 'top';
			}
			// Add default size property if missing - calculate from canvas dimensions
			if (!t.size) {
				const ratio = obj.ui?.pixelsPerMeter || 100; // Use imported ratio or default
				if (t.type === 'circle') {
					const diameter = t.radius * 2;
					t.size = { width: diameter / ratio, height: diameter / ratio };
				} else if (t.type === 'rect') {
					t.size = { width: t.width / ratio, height: t.height / ratio };
				}
			}
			// Add default sizeTiedToCanvas property if missing - set to true for imported tables
			if (t.sizeTiedToCanvas === undefined) t.sizeTiedToCanvas = true;
		}
		// Migrate guests to add picture and isChild properties
		for (const g of (obj.guests || [])) {
			if (g.picture === undefined) g.picture = null;
			if (g.isChild === undefined) g.isChild = false;
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

			// Clear picture URLs on load since folderHandle can't be persisted
			// This prevents blob URL errors after page reload
			if (st.pictures && st.pictures.folderHandle === null) {
				for (const guest of st.guests) {
					if (guest.picture && guest.picture.startsWith('blob:')) {
						guest.picture = null;
					}
				}
				st.pictures.imageCache = {};
			}

			return st;
		} catch (e) {
			return defaultState();
		}
	}

	function save() {
		const persisted = {
			version: state.version,
			guests: state.guests,
			tables: state.tables,
			ui: state.ui,
			colorLegend: state.colorLegend
		};
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
			assignments: {},
			size: { width: 1.4, height: 1.4 }, // Default size in meters
			sizeTiedToCanvas: false
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
			oddExtraSide: 'top',
			size: { width: 1.6, height: 1.0 }, // Default size in meters
			sizeTiedToCanvas: false
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

		// If size is tied to canvas, update the size property
		if (t.sizeTiedToCanvas) {
			syncSizeFromCanvas(id);
		}

		save();
	}

	function updateTableSize(id, width, height, pushToHistory = true) {
		// Only push history if not in a history group and pushToHistory is true
		if (pushToHistory && !state._history.suppress) {
			pushHistory();
		}
		const t = state.tables.find(t => t.id === id);
		if (!t || (t.type !== 'rect' && t.type !== 'separator')) return;

		if (t.type === 'separator') {
			t.width = Math.max(40, Math.min(600, width));   // Smaller min width for separators
			t.height = Math.max(10, Math.min(600, height)); // Smaller min height for separators
		} else {
			t.width = Math.max(80, Math.min(600, width));   // Regular min width for rectangles
			t.height = Math.max(60, Math.min(600, height)); // Regular min height for rectangles
		}

		// If size is tied to canvas, update the size property
		if (t.sizeTiedToCanvas) {
			syncSizeFromCanvas(id);
		}

		save();
	}

	function setRectOneSided(id, flag) { pushHistory(); const t = state.tables.find(t => t.id === id && t.type === 'rect'); if (!t) return; t.rectOneSided = !!flag; save(); window.TablePlanner.render(); }
	function setRectOneSide(id, side) { pushHistory(); const t = state.tables.find(t => t.id === id && t.type === 'rect'); if (!t) return; if (!['top', 'right', 'bottom', 'left'].includes(side)) return; t.oneSide = side; save(); window.TablePlanner.render(); }
	function setRectOddExtraSide(id, side) { pushHistory(); const t = state.tables.find(t => t.id === id && t.type === 'rect'); if (!t) return; if (!['top', 'right', 'bottom', 'left'].includes(side)) return; t.oddExtraSide = side; save(); window.TablePlanner.render(); }

	function addGuest(name, color, isChild = false) { pushHistory(); const g = { id: 'g_' + Math.random().toString(36).slice(2, 8), name: name.trim(), color: color || '#6aa9ff', picture: null, isChild: !!isChild }; if (!g.name) return; state.guests.push(g); save(); window.TablePlanner.render(); if (window.updateLegendButtonPosition) window.updateLegendButtonPosition(); }
	function updateGuest(id, patch) { pushHistory(); const g = state.guests.find(g => g.id === id); if (!g) return; Object.assign(g, patch); save(); window.TablePlanner.render(); if (window.updateLegendButtonPosition) window.updateLegendButtonPosition(); }
	function deleteGuest(id) { pushHistory(); state.guests = state.guests.filter(g => g.id !== id); for (const t of state.tables) { for (const k in t.assignments) { if (t.assignments[k] === id) delete t.assignments[k]; } } save(); window.TablePlanner.render(); if (window.updateLegendButtonPosition) window.updateLegendButtonPosition(); }
	function updateTableSizeProperty(id, width, height) {
		pushHistory();
		const t = state.tables.find(t => t.id === id);
		if (!t) return;
		if (!t.size) t.size = { width: 1.0, height: 1.0 };
		t.size.width = Math.max(0.1, width);
		t.size.height = Math.max(0.1, height);

		// Also update canvas dimensions based on size using configurable ratio
		const ratio = state.ui.pixelsPerMeter || 100;
		if (t.type === 'circle') {
			const diameter = Math.max(t.size.width, t.size.height) * ratio;
			t.radius = Math.max(40, Math.min(220, diameter / 2));
		} else if (t.type === 'rect' || t.type === 'separator') {
			const canvasWidth = t.size.width * ratio;
			const canvasHeight = t.size.height * ratio;

			if (t.type === 'separator') {
				t.width = Math.max(40, Math.min(600, canvasWidth));
				t.height = Math.max(10, Math.min(600, canvasHeight));
			} else {
				t.width = Math.max(80, Math.min(600, canvasWidth));
				t.height = Math.max(60, Math.min(600, canvasHeight));
			}
		}

		save();
		window.TablePlanner.render();
	}

	function syncSizeFromCanvas(id) {
		const t = state.tables.find(t => t.id === id);
		if (!t) return;

		if (!t.size) t.size = { width: 1.0, height: 1.0 };

		// Convert canvas dimensions to size using configurable ratio
		const ratio = state.ui.pixelsPerMeter || 100;
		if (t.type === 'circle') {
			const diameter = t.radius * 2;
			t.size.width = diameter / ratio;
			t.size.height = diameter / ratio;
		} else if (t.type === 'rect' || t.type === 'separator') {
			t.size.width = t.width / ratio;
			t.size.height = t.height / ratio;
		}

		save();
	}

	function toggleSizeTiedToCanvas(tableId) {
		pushHistory();
		const t = state.tables.find(t => t.id === tableId);
		if (!t) return;
		t.sizeTiedToCanvas = !t.sizeTiedToCanvas;
		save();
	}

	function addGuest(name, color) { pushHistory(); const g = { id: 'g_' + Math.random().toString(36).slice(2, 8), name: name.trim(), color: color || '#6aa9ff', picture: null }; if (!g.name) return; state.guests.push(g); save(); window.TablePlanner.render(); }
	function updateGuest(id, patch) { pushHistory(); const g = state.guests.find(g => g.id === id); if (!g) return; Object.assign(g, patch); save(); window.TablePlanner.render(); }
	function deleteGuest(id) { pushHistory(); state.guests = state.guests.filter(g => g.id !== id); for (const t of state.tables) { for (const k in t.assignments) { if (t.assignments[k] === id) delete t.assignments[k]; } } save(); window.TablePlanner.render(); }
	function setGuestSort(sort) { state.ui.guestSort = sort; save(); window.TablePlanner.render(); }
	function setGuestUnassignedOnly(flag) { state.ui.guestUnassignedOnly = !!flag; save(); window.TablePlanner.render(); }
	function setGuestSearch(search) { state.ui.guestSearch = search; save(); window.TablePlanner.render(); }

	// Color legend functions
	function getUniqueGuestColors() {
		const colors = new Set();
		for (const guest of state.guests) {
			if (guest.color) {
				colors.add(guest.color);
			}
		}
		// Sort by label alphabetically, fallback to color hex if no label
		return Array.from(colors).sort((a, b) => {
			const labelA = state.colorLegend[a] || '';
			const labelB = state.colorLegend[b] || '';

			// If both have labels, sort by label
			if (labelA && labelB) {
				return labelA.localeCompare(labelB);
			}
			// If only one has a label, prioritize it
			if (labelA && !labelB) return -1;
			if (!labelA && labelB) return 1;
			// If neither has a label, sort by color hex
			return a.localeCompare(b);
		});
	}

	function updateColorLegendLabel(color, label) {
		pushHistory();
		if (label && label.trim()) {
			state.colorLegend[color] = label.trim();
		} else {
			delete state.colorLegend[color];
		}
		save();
		// Don't call render() here to avoid focus loss - just update the specific input
		updateLegendInputValue(color, label);
	}

	function updateLegendInputValue(color, label) {
		// Find the input field for this color and update its value without losing focus
		const legendContent = document.getElementById('legendContent');
		if (!legendContent) return;

		const input = legendContent.querySelector(`input[data-color="${color}"]`);
		if (input && document.activeElement !== input) {
			input.value = label || '';
		}

		// Recalculate dimensions if the label length might affect sizing
		const uniqueColors = getUniqueGuestColors();
		const dimensions = window.TablePlanner.calculateLegendDimensions ?
			window.TablePlanner.calculateLegendDimensions(uniqueColors) : null;

		if (dimensions) {
			const legendSidebar = document.getElementById('legendSidebar');
			if (legendSidebar) {
				legendSidebar.style.width = dimensions.width + 'px';
				legendSidebar.style.height = dimensions.height + 'px';
			}

			// Update input width if needed
			if (input) {
				input.style.width = dimensions.inputWidth + 'px';
			}

			// Update button position after dimensions change
			// Use requestAnimationFrame to ensure DOM layout is complete
			if (window.updateLegendButtonPosition) {
				requestAnimationFrame(() => {
					setTimeout(() => window.updateLegendButtonPosition(), 0);
				});
			}
		}
	}

	function assignGuestToSeat(tableId, seatIndex, guestId) { pushHistory(); const table = state.tables.find(t => t.id === tableId); if (!table) return; if (seatIndex < 0 || seatIndex >= table.seats) return; for (const t of state.tables) { for (const k in t.assignments) { if (t.assignments[k] === guestId) { delete t.assignments[k]; } } } table.assignments[String(seatIndex)] = guestId; save(); window.TablePlanner.render(); }
	function unassignSeat(tableId, seatIndex) { pushHistory(); const table = state.tables.find(t => t.id === tableId); if (!table) return; delete table.assignments[String(seatIndex)]; save(); window.TablePlanner.render(); }
	function setTableSeats(tableId, newSeats) { pushHistory(); const t = state.tables.find(t => t.id === tableId); if (!t) return false; const seats = Math.max(1, Math.min(32, Math.floor(newSeats))); if (seats === t.seats) return true; if (seats > t.seats) { t.seats = seats; save(); window.TablePlanner.render(); return true; } const lost = []; for (const k in t.assignments) { const idx = Number(k); if (idx >= seats) { lost.push({ seat: idx, guestId: t.assignments[k] }); } } if (lost.length) { const confirmMsg = window.i18n.t('reduceSeatsConfirm', { seats, count: lost.length }); if (!window.confirm(confirmMsg)) { state._history.past.pop(); return false; } for (const item of lost) { delete t.assignments[String(item.seat)]; } } t.seats = seats; save(); window.TablePlanner.render(); return true; }

	function setSnap(flag) {
		state.ui.snap = !!flag;
		save();
	}
	function setGridSize(size) {
		const n = Math.max(4, Math.min(64, Math.floor(size)));
		state.ui.grid = n;
		save();
	}

	function setZoom(zoom) {
		state.ui.zoom = Math.max(0.1, Math.min(5, zoom));
		save();
	}

	function setPan(x, y) {
		state.ui.panX = x;
		state.ui.panY = y;
		save();
	}

	function resetView() {
		state.ui.zoom = 1;
		state.ui.panX = 0;
		state.ui.panY = 0;
		save();
		window.TablePlanner.render();
	}

	function recenterCanvas() {
		// Calculate the center of all tables
		if (state.tables.length === 0) {
			// If no tables, reset to default view
			resetView();
			return;
		}

		// Calculate bounds of all tables
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const table of state.tables) {
			if (table.type === 'circle') {
				minX = Math.min(minX, table.x - table.radius);
				minY = Math.min(minY, table.y - table.radius);
				maxX = Math.max(maxX, table.x + table.radius);
				maxY = Math.max(maxY, table.y + table.radius);
			} else if (table.type === 'rect' || table.type === 'separator') {
				minX = Math.min(minX, table.x - table.width / 2);
				minY = Math.min(minY, table.y - table.height / 2);
				maxX = Math.max(maxX, table.x + table.width / 2);
				maxY = Math.max(maxY, table.y + table.height / 2);
			}
		}

		// Calculate center point
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		// Calculate content dimensions
		const contentWidth = maxX - minX;
		const contentHeight = maxY - minY;

		// Get canvas-wrap dimensions (approximate)
		const canvasWrap = document.querySelector('.canvas-wrap');
		const wrapWidth = canvasWrap ? canvasWrap.clientWidth : 800;
		const wrapHeight = canvasWrap ? canvasWrap.clientHeight : 600;

		// Calculate optimal zoom to fit content with some margin
		const margin = 50;
		const zoomX = (wrapWidth - margin * 2) / contentWidth;
		const zoomY = (wrapHeight - margin * 2) / contentHeight;
		const optimalZoom = Math.min(zoomX, zoomY, 2); // Cap at 2x zoom

		// Calculate pan to center the content
		const panX = wrapWidth / 2 - centerX * optimalZoom;
		const panY = wrapHeight / 2 - centerY * optimalZoom;

		// Apply the new view
		state.ui.zoom = Math.max(0.1, optimalZoom);
		state.ui.panX = panX;
		state.ui.panY = panY;

		save();
		window.TablePlanner.render();
	}

	function setSidebarCollapsed(collapsed) {
		state.ui.sidebarCollapsed = !!collapsed;
		save();
	}

	function setPixelsPerMeter(ratio) {
		state.ui.pixelsPerMeter = Math.max(10, Math.min(1000, ratio));
		save();
	}

	function setViewMode(mode) {
		state.ui.viewMode = mode;
		save();
	}

	const state = load();

	function setLanguage(lang) {
		state.ui.language = lang;
		save();
	}

	// Picture management functions
	function normalizeName(name) {
		const step1 = name.toLowerCase();
		const result = step1.replace(/[\s\-_]+/g, '_');
		return result;
	}

	function setPictureFolder(folderHandle) {
		pushHistory();
		state.pictures.folderHandle = folderHandle;
		state.pictures.folderPath = folderHandle ? folderHandle.name : null;
		state.pictures.imageCache = {}; // Clear cache when folder changes
		save();
		window.TablePlanner.render();
	}

	function assignPictureToGuest(guestId, imageUrl) {
		pushHistory();
		const guest = state.guests.find(g => g.id === guestId);
		if (guest) {
			guest.picture = imageUrl;
			save();
			window.TablePlanner.render();
		}
	}

	function removePictureFromGuest(guestId) {
		pushHistory();
		const guest = state.guests.find(g => g.id === guestId);
		if (guest) {
			guest.picture = null;
			save();
			window.TablePlanner.render();
		}
	}

	async function scanFolderForPictures() {
		if (!state.pictures.folderHandle) return;

		try {
			const files = [];
			for await (const [name, handle] of state.pictures.folderHandle.entries()) {
				if (handle.kind === 'file' && name.toLowerCase().endsWith('.png')) {
					files.push({ name: name.replace(/\.png$/i, ''), handle });
				}
			}
			// First, clear all existing pictures to ensure clean state
			for (const guest of state.guests) {
				if (guest.picture) {
					// Revoke the old object URL to free memory
					if (guest.picture.startsWith('blob:')) {
						URL.revokeObjectURL(guest.picture);
					}
					guest.picture = null;
				}
			}

			// Match files to guests - only assign if there's an exact match
			const matches = [];
			for (const guest of state.guests) {
				const normalizedGuestName = normalizeName(guest.name);

				for (const file of files) {
					const normalizedFileName = normalizeName(file.name);

					if (normalizedGuestName === normalizedFileName && normalizedGuestName.length > 0) {
						matches.push({ guest, file });
						break; // Take first match
					}
				}
			}

			// Assign pictures to guests only for exact matches
			for (const { guest, file } of matches) {
				try {
					const fileHandle = await state.pictures.folderHandle.getFileHandle(file.name + '.png');
					const fileObj = await fileHandle.getFile();
					const imageUrl = URL.createObjectURL(fileObj);
					guest.picture = imageUrl;
					state.pictures.imageCache[guest.id] = imageUrl;
				} catch (error) {
					console.warn(`Failed to load image for ${guest.name}:`, error);
					guest.picture = null; // Ensure no picture if loading fails
				}
			}

			save();
			window.TablePlanner.render();
			return matches.length;
		} catch (error) {
			console.error('Error scanning folder for pictures:', error);
			return 0;
		}
	}


	window.TablePlanner = Object.assign(window.TablePlanner || {}, {
		state,
		migrate,
		undo,
		redo,
		pushHistory,
		beginHistoryGroup,
		endHistoryGroup,
		commitTableLabel,
		// snapping
		setSnap,
		setGridSize,
		// zoom and pan
		setZoom,
		setPan,
		resetView,
		recenterCanvas,
		// sidebar
		setSidebarCollapsed,
		setPixelsPerMeter,
		setViewMode,
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
		updateTableSizeProperty,
		syncSizeFromCanvas,
		toggleSizeTiedToCanvas,
		setRectOneSided,
		setRectOneSide,
		setRectOddExtraSide,
		addGuest,
		updateGuest,
		deleteGuest,
		setGuestSort,
		setGuestUnassignedOnly,
		setGuestSearch,
		// color legend
		getUniqueGuestColors,
		updateColorLegendLabel,
		updateLegendInputValue,
		assignGuestToSeat,
		unassignSeat,
		setTableSeats,
		setLanguage,
		// picture management
		normalizeName,
		setPictureFolder,
		assignPictureToGuest,
		removePictureFromGuest,
		scanFolderForPictures,
		save
	});
})();
