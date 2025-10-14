(function () {
	let drag = null;
	let resize = null;
	let popover = null;
	let dragSelect = null;
	let pan = null;
	let seatDrag = null;

	function intersects(a, b) {
		if (a.type === 'circle' && b.type === 'circle') {
			const dx = a.x - b.x, dy = a.y - b.y;
			const dist = Math.hypot(dx, dy);
			return dist < (a.radius + b.radius);
		}
		// approximate with bounding boxes for mixed/rect/separator
		const ar = (a.type === 'rect' || a.type === 'separator') ? { x: a.x - a.width / 2, y: a.y - a.height / 2, w: a.width, h: a.height } : { x: a.x - a.radius, y: a.y - a.radius, w: a.radius * 2, h: a.radius * 2 };
		const br = (b.type === 'rect' || b.type === 'separator') ? { x: b.x - b.width / 2, y: b.y - b.height / 2, w: b.width, h: b.height } : { x: b.x - b.radius, y: b.y - b.radius, w: b.radius * 2, h: b.radius * 2 };
		return !(ar.x + ar.w < br.x || br.x + br.w < ar.x || ar.y + ar.h < br.y || br.y + br.h < ar.y);
	}

	function clearOverlapHighlights() {
		for (const el of document.querySelectorAll('.table.overlap, .separator.overlap')) el.classList.remove('overlap');
	}
	function updateOverlapHighlights(activeId) {
		clearOverlapHighlights();
		const s = window.TablePlanner.state;
		const active = s.tables.find(t => t.id === activeId);
		if (!active) return;
		for (const t of s.tables) {
			if (t.id === activeId) continue;
			if (intersects(active, t)) {
				const a = document.querySelector(`.table[data-id="${activeId}"], .separator[data-id="${activeId}"]`);
				const b = document.querySelector(`.table[data-id="${t.id}"], .separator[data-id="${t.id}"]`);
				if (a) a.classList.add('overlap');
				if (b) b.classList.add('overlap');
			}
		}
	}

	function hasAssignments(t) {
		if (!t || !t.assignments) return false;
		for (const k in t.assignments) { if (t.assignments[k]) return true; }
		return false;
	}

	function clampPosition(t, x, y) {
		// Don't clamp position - allow tables to move anywhere
		// The canvas will expand dynamically to accommodate them
		return { x, y };
	}

	function getTableBounds(table) {
		if (table.type === 'circle') {
			return {
				x: table.x - table.radius,
				y: table.y - table.radius,
				width: table.radius * 2,
				height: table.radius * 2
			};
		} else {
			return {
				x: table.x - table.width / 2,
				y: table.y - table.height / 2,
				width: table.width,
				height: table.height
			};
		}
	}

	function isTableInSelectionRect(table, rect) {
		const bounds = getTableBounds(table);
		return !(bounds.x + bounds.width < rect.x ||
			rect.x + rect.width < bounds.x ||
			bounds.y + bounds.height < rect.y ||
			rect.y + rect.height < bounds.y);
	}

	function createSelectionRect(startX, startY, endX, endY) {
		const x = Math.min(startX, endX);
		const y = Math.min(startY, endY);
		const width = Math.abs(endX - startX);
		const height = Math.abs(endY - startY);
		return { x, y, width, height };
	}

	function updateSelectionRect(rect) {
		const canvas = document.getElementById('canvas');
		const canvasWrap = canvas.parentElement;
		let rectEl = document.getElementById('selection-rect');
		if (!rectEl) {
			rectEl = document.createElement('div');
			rectEl.id = 'selection-rect';
			rectEl.style.position = 'absolute';
			rectEl.style.border = '2px dashed #007bff';
			rectEl.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
			rectEl.style.pointerEvents = 'none';
			rectEl.style.zIndex = '1000';
			canvasWrap.appendChild(rectEl);
		}

		// Convert screen coordinates to canvas-wrap relative coordinates
		const canvasWrapRect = canvasWrap.getBoundingClientRect();
		const relativeX = rect.x - canvasWrapRect.left;
		const relativeY = rect.y - canvasWrapRect.top;

		// Position the selection rectangle relative to canvas-wrap
		rectEl.style.left = relativeX + 'px';
		rectEl.style.top = relativeY + 'px';
		rectEl.style.width = rect.width + 'px';
		rectEl.style.height = rect.height + 'px';
		rectEl.style.display = 'block';
	}

	function removeSelectionRect() {
		const rectEl = document.getElementById('selection-rect');
		if (rectEl) {
			rectEl.style.display = 'none';
		}
	}


	function onCanvasMouseDown(e) {
		const target = e.target;

		// Handle right-click or middle-click for panning
		if (e.button === 2 || e.button === 1) { // Right mouse button or middle mouse button
			e.preventDefault();
			pan = {
				startX: e.clientX,
				startY: e.clientY,
				startPanX: window.TablePlanner.state.ui.panX,
				startPanY: window.TablePlanner.state.ui.panY
			};
			// Add panning class to canvas and canvas-wrap
			const canvas = document.getElementById('canvas');
			const canvasWrap = canvas.parentElement;
			canvas.classList.add('panning');
			canvasWrap.classList.add('panning');
			document.addEventListener('mousemove', onPanMove);
			document.addEventListener('mouseup', onPanUp);
			document.addEventListener('contextmenu', (e) => e.preventDefault());
			return;
		}

		// If clicking into the editable label, allow text editing and do not start select/drag
		if (target.closest && target.closest('[data-role="table-label"]')) {
			return; // let contentEditable handle focus and selection
		}
		const tableNode = target.closest && (target.closest('.table') || target.closest('.separator'));
		const handle = target.closest && (target.closest('.handle-e') || target.closest('.handle-s'));
		const seatNode = target.closest && target.closest('.seat');

		if (handle) {
			const id = handle.dataset.id;
			const dir = handle.dataset.dir;
			const t = getTable(id);
			if (!t) return;

			closePopover();
			// Start history group for resize operations
			window.TablePlanner.beginHistoryGroup();
			resize = { id, dir, startX: e.clientX, startY: e.clientY, startRadius: t.radius, startW: t.width, startH: t.height };
			document.addEventListener('mousemove', onResizeMove);
			document.addEventListener('mouseup', onResizeUp);
			e.preventDefault();
			return;
		}

		if (seatNode) {
			// Check if this seat has a guest assigned
			const tableId = seatNode.dataset.tableId;
			const seatIndex = Number(seatNode.dataset.index);
			const table = getTable(tableId);
			const guestId = table && table.assignments ? table.assignments[String(seatIndex)] : null;

			if (guestId) {
				// Start seat drag for assigned guest
				startSeatDrag(seatNode, e.clientX, e.clientY, tableId, seatIndex, guestId);
				e.preventDefault();
				return;
			} else {
				// Open popover for unassigned seat
				openSeatPopover(seatNode, e.clientX, e.clientY);
				e.preventDefault();
				return;
			}
		}

		if (tableNode) {
			const id = tableNode.dataset.id;
			const t = getTable(id);
			if (!t) return;

			// Handle multi-selection with Ctrl/Cmd key
			if (e.ctrlKey || e.metaKey) {
				if (window.TablePlanner.isSelected(id)) {
					window.TablePlanner.removeFromSelection(id);
				} else {
					window.TablePlanner.addToSelection(id);
				}
			} else {
				// If clicking on a table that's not selected, select it
				if (!window.TablePlanner.isSelected(id)) {
					window.TablePlanner.selectTable(id);
				}
			}

			// Show table guests in sidebar
			showTableGuests(id);

			closePopover();
			// start grouped history for drag
			window.TablePlanner.beginHistoryGroup();

			// Store original positions of all selected tables
			const selectedTables = window.TablePlanner.getSelectedTables();
			const originalPositions = {};
			for (const table of selectedTables) {
				originalPositions[table.id] = { x: table.x, y: table.y };
			}

			// Calculate offset accounting for zoom and pan
			const canvas = document.getElementById('canvas');
			const canvasRect = canvas.getBoundingClientRect();
			const zoom = window.TablePlanner.state.ui.zoom || 1;
			const panX = window.TablePlanner.state.ui.panX || 0;
			const panY = window.TablePlanner.state.ui.panY || 0;
			const canvasX = (e.clientX - canvasRect.left) / zoom;
			const canvasY = (e.clientY - canvasRect.top) / zoom;

			drag = {
				id,
				offsetX: canvasX - t.x,
				offsetY: canvasY - t.y,
				originalPositions
			};
			document.addEventListener('mousemove', onDragMove);
			document.addEventListener('mouseup', onDragUp);
			e.preventDefault();
			return;
		}

		// Start drag selection if clicking on empty canvas
		if (!e.ctrlKey && !e.metaKey) {
			window.TablePlanner.clearSelection();
			clearTableGuests();
		}
		closePopover();

		// Store screen coordinates for drag selection
		const startX = e.clientX;
		const startY = e.clientY;

		dragSelect = { startX, startY, endX: startX, endY: startY };
		document.addEventListener('mousemove', onDragSelectMove);
		document.addEventListener('mouseup', onDragSelectUp);
		e.preventDefault();
	}

	function onKeyDown(e) {
		if (e.key === 'Delete') {
			const selectedIds = window.TablePlanner.state.ui.selectedTableIds;
			if (selectedIds.length > 0) {
				// Check if any selected tables have assignments
				let hasAnyAssignments = false;
				for (const id of selectedIds) {
					const t = getTable(id);
					if (hasAssignments(t)) {
						hasAnyAssignments = true;
						break;
					}
				}

				if (hasAnyAssignments) {
					const ok = window.confirm(`Delete ${selectedIds.length} selected table(s) with assigned guests?`);
					if (!ok) return;
				}

				// Group multiple table deletions into a single history entry
				window.TablePlanner.beginHistoryGroup();
				for (const id of selectedIds) {
					window.TablePlanner.removeTable(id);
				}
				window.TablePlanner.endHistoryGroup();
			}
			return;
		}

		// Handle Ctrl+A for select all
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
			e.preventDefault();
			const allTableIds = window.TablePlanner.state.tables.map(t => t.id);
			window.TablePlanner.selectMultipleTables(allTableIds);
			return;
		}

		// Handle Ctrl+0 or Cmd+0 for reset view
		if ((e.ctrlKey || e.metaKey) && e.key === '0') {
			e.preventDefault();
			window.TablePlanner.resetView();
			return;
		}

		// Handle arrow key movement for selected tables
		const selectedIds = window.TablePlanner.state.ui.selectedTableIds;
		if (selectedIds.length === 0) return;

		const step = e.shiftKey ? 10 : 1;
		let dx = 0, dy = 0;
		if (e.key === 'ArrowLeft') dx = -step;
		else if (e.key === 'ArrowRight') dx = step;
		else if (e.key === 'ArrowUp') dy = -step;
		else if (e.key === 'ArrowDown') dy = step;
		else return;

		e.preventDefault();
		const ui = window.TablePlanner.state.ui;
		const updates = [];

		for (const id of selectedIds) {
			const t = getTable(id);
			if (!t) continue;
			let nx = t.x + dx;
			let ny = t.y + dy;
			if (ui.snap) {
				const g = ui.grid || 12;
				nx = Math.round(nx / g) * g;
				ny = Math.round(ny / g) * g;
			}
			const clamped = clampPosition(t, nx, ny);
			updates.push({ id: t.id, x: clamped.x, y: clamped.y });
		}

		window.TablePlanner.updateMultipleTablePositions(updates);
		window.TablePlanner.render();
	}

	function onDragMove(e) {
		if (!drag) return;
		// Convert screen coordinates to canvas coordinates accounting for transform
		const canvas = document.getElementById('canvas');
		const canvasRect = canvas.getBoundingClientRect();
		const zoom = window.TablePlanner.state.ui.zoom || 1;
		const panX = window.TablePlanner.state.ui.panX || 0;
		const panY = window.TablePlanner.state.ui.panY || 0;
		const canvasX = (e.clientX - canvasRect.left) / zoom;
		const canvasY = (e.clientY - canvasRect.top) / zoom;

		let x = canvasX - drag.offsetX;
		let y = canvasY - drag.offsetY;
		const ui = window.TablePlanner.state.ui;
		if (ui.snap) { const g = ui.grid || 12; x = Math.round(x / g) * g; y = Math.round(y / g) * g; }

		const t = getTable(drag.id);
		const clamped = clampPosition(t, x, y);

		// Calculate the movement delta based on original position
		const originalPos = drag.originalPositions[drag.id];
		const dx = clamped.x - originalPos.x;
		const dy = clamped.y - originalPos.y;

		// Move all selected tables by the same delta from their original positions
		const updates = [];
		for (const tableId in drag.originalPositions) {
			const originalPos = drag.originalPositions[tableId];
			const newX = originalPos.x + dx;
			const newY = originalPos.y + dy;
			const clampedPos = clampPosition(getTable(tableId), newX, newY);
			updates.push({ id: tableId, x: clampedPos.x, y: clampedPos.y });
		}

		window.TablePlanner.updateMultipleTablePositions(updates);
		window.TablePlanner.render();
		// Don't show overlap highlights during drag - only when drag is complete
	}
	function onDragUp() {
		document.removeEventListener('mousemove', onDragMove);
		document.removeEventListener('mouseup', onDragUp);
		window.TablePlanner.endHistoryGroup();
		// Check for overlaps after drag is complete
		if (drag) {
			updateOverlapHighlights(drag.id);
		}
		drag = null;
	}

	function onDragSelectMove(e) {
		if (!dragSelect) return;
		// Update end coordinates in screen space
		dragSelect.endX = e.clientX;
		dragSelect.endY = e.clientY;

		const rect = createSelectionRect(dragSelect.startX, dragSelect.startY, dragSelect.endX, dragSelect.endY);


		updateSelectionRect(rect);
	}

	function onDragSelectUp(e) {
		if (!dragSelect) return;
		document.removeEventListener('mousemove', onDragSelectMove);
		document.removeEventListener('mouseup', onDragSelectUp);


		// Convert screen coordinates to canvas coordinates for table intersection detection
		const canvas = document.getElementById('canvas');
		const canvasRect = canvas.getBoundingClientRect();
		const zoom = window.TablePlanner.state.ui.zoom || 1;
		const panX = window.TablePlanner.state.ui.panX || 0;
		const panY = window.TablePlanner.state.ui.panY || 0;

		const startCanvasX = (dragSelect.startX - canvasRect.left) / zoom;
		const startCanvasY = (dragSelect.startY - canvasRect.top) / zoom;
		const endCanvasX = (dragSelect.endX - canvasRect.left) / zoom;
		const endCanvasY = (dragSelect.endY - canvasRect.top) / zoom;

		const rect = createSelectionRect(startCanvasX, startCanvasY, endCanvasX, endCanvasY);


		removeSelectionRect();

		// Find tables in selection rectangle
		const state = window.TablePlanner.state;
		const selectedIds = [];
		for (const table of state.tables) {
			const bounds = getTableBounds(table);
			const intersects = isTableInSelectionRect(table, rect);
			if (intersects) {
				selectedIds.push(table.id);
			}
		}

		if (selectedIds.length > 0) {
			window.TablePlanner.selectMultipleTables(selectedIds);
		}

		dragSelect = null;
	}

	function onResizeMove(e) {
		if (!resize) return;
		const t = getTable(resize.id);
		if (!t) return;

		if (t.type === 'circle' && resize.dir === 'e') {
			const dx = e.clientX - resize.startX;
			const newRadius = (resize.startRadius || t.radius) + dx;
			window.TablePlanner.updateTableRadius(resize.id, newRadius);
		} else if (t.type === 'rect' || t.type === 'separator') {
			let w = resize.startW || t.width;
			let h = resize.startH || t.height;
			if (resize.dir === 'e') {
				const dx = e.clientX - resize.startX;
				w = (resize.startW || t.width) + dx;
			} else if (resize.dir === 's') {
				const dy = e.clientY - resize.startY;
				h = (resize.startH || t.height) + dy;
			}
			window.TablePlanner.updateTableSize(resize.id, w, h);
		}
		// Use requestAnimationFrame to prevent excessive re-rendering
		if (!resize._renderScheduled) {
			resize._renderScheduled = true;
			requestAnimationFrame(() => {
				window.TablePlanner.render();
				resize._renderScheduled = false;
			});
		}
	}
	function onResizeUp() {
		document.removeEventListener('mousemove', onResizeMove);
		document.removeEventListener('mouseup', onResizeUp);
		// End history group for resize operations
		window.TablePlanner.endHistoryGroup();
		resize = null;
	}

	function onPanMove(e) {
		if (!pan) return;
		const deltaX = e.clientX - pan.startX;
		const deltaY = e.clientY - pan.startY;
		const newPanX = pan.startPanX + deltaX;
		const newPanY = pan.startPanY + deltaY;
		window.TablePlanner.setPan(newPanX, newPanY);
		window.TablePlanner.render();
	}

	function onPanUp() {
		if (!pan) return;
		// Remove panning class from canvas and canvas-wrap
		const canvas = document.getElementById('canvas');
		const canvasWrap = canvas.parentElement;
		canvas.classList.remove('panning');
		canvasWrap.classList.remove('panning');
		document.removeEventListener('mousemove', onPanMove);
		document.removeEventListener('mouseup', onPanUp);
		pan = null;
	}

	function startSeatDrag(seatNode, clientX, clientY, tableId, seatIndex, guestId) {
		closePopover();

		// Disable hover animations during drag
		const canvas = document.getElementById('canvas');
		canvas.classList.add('seat-dragging');

		// Create drag preview element
		const dragPreview = seatNode.cloneNode(true);
		dragPreview.style.position = 'fixed';
		dragPreview.style.pointerEvents = 'none';
		dragPreview.style.zIndex = '10000';
		dragPreview.style.transform = 'translate(-50%, -50%)';
		dragPreview.style.opacity = '0.8';
		dragPreview.classList.add('seat-drag-preview');
		document.body.appendChild(dragPreview);

		seatDrag = {
			seatNode,
			dragPreview,
			tableId,
			seatIndex,
			guestId,
			startX: clientX,
			startY: clientY,
			lastX: clientX,
			lastY: clientY
		};

		// Update drag preview position to follow cursor exactly
		updateSeatDragPreview(clientX, clientY);

		document.addEventListener('mousemove', onSeatDragMove);
		document.addEventListener('mouseup', onSeatDragUp);
	}

	function onSeatDragMove(e) {
		if (!seatDrag) return;

		// Use requestAnimationFrame for smoother updates
		if (!seatDrag.rafId) {
			seatDrag.rafId = requestAnimationFrame(() => {
				updateSeatDragPreview(seatDrag.lastX, seatDrag.lastY);
				updateSeatDropTargets(seatDrag.lastX, seatDrag.lastY);
				seatDrag.rafId = null;
			});
		}

		// Store the latest mouse position
		seatDrag.lastX = e.clientX;
		seatDrag.lastY = e.clientY;
	}

	function onSeatDragUp(e) {
		if (!seatDrag) return;

		// Cancel any pending animation frame
		if (seatDrag.rafId) {
			cancelAnimationFrame(seatDrag.rafId);
			seatDrag.rafId = null;
		}

		// Clean up drag preview
		if (seatDrag.dragPreview) {
			seatDrag.dragPreview.remove();
		}

		// Re-enable hover animations
		const canvas = document.getElementById('canvas');
		canvas.classList.remove('seat-dragging');

		// Clear all drop target highlights
		clearSeatDropTargets();

		// Find target seat
		const targetSeat = findSeatAtPosition(e.clientX, e.clientY);

		if (targetSeat && targetSeat !== seatDrag.seatNode) {
			const targetTableId = targetSeat.dataset.tableId;
			const targetSeatIndex = Number(targetSeat.dataset.index);

			// Check if target seat is occupied
			const targetTable = getTable(targetTableId);
			const targetGuestId = targetTable && targetTable.assignments ? targetTable.assignments[String(targetSeatIndex)] : null;

			if (targetGuestId) {
				// Swap guests
				window.TablePlanner.beginHistoryGroup();
				window.TablePlanner.assignGuestToSeat(targetTableId, targetSeatIndex, seatDrag.guestId);
				window.TablePlanner.assignGuestToSeat(seatDrag.tableId, seatDrag.seatIndex, targetGuestId);
				window.TablePlanner.endHistoryGroup();
			} else {
				// Move guest to empty seat
				window.TablePlanner.assignGuestToSeat(targetTableId, targetSeatIndex, seatDrag.guestId);
			}
		}

		document.removeEventListener('mousemove', onSeatDragMove);
		document.removeEventListener('mouseup', onSeatDragUp);
		seatDrag = null;
	}

	function updateSeatDragPreview(clientX, clientY) {
		if (!seatDrag || !seatDrag.dragPreview) return;

		// Position the drag preview exactly at the cursor
		seatDrag.dragPreview.style.left = clientX + 'px';
		seatDrag.dragPreview.style.top = clientY + 'px';

		// Log the position for debugging (only every 10th move to reduce spam)
		if (!seatDrag.logCounter) seatDrag.logCounter = 0;
		seatDrag.logCounter++;
		if (seatDrag.logCounter % 10 === 0) {
			const rect = seatDrag.dragPreview.getBoundingClientRect();
		}
	}

	function updateSeatDropTargets(clientX, clientY) {
		// Clear previous highlights
		clearSeatDropTargets();

		// Find seat under cursor
		const targetSeat = findSeatAtPosition(clientX, clientY);

		if (targetSeat && targetSeat !== seatDrag.seatNode) {
			targetSeat.classList.add('seat-drop-target');
		}
	}

	function clearSeatDropTargets() {
		const seats = document.querySelectorAll('.seat');
		seats.forEach(seat => seat.classList.remove('seat-drop-target'));
	}

	function findSeatAtPosition(clientX, clientY) {
		const canvas = document.getElementById('canvas');
		const canvasRect = canvas.getBoundingClientRect();
		const zoom = window.TablePlanner.state.ui.zoom || 1;
		const panX = window.TablePlanner.state.ui.panX || 0;
		const panY = window.TablePlanner.state.ui.panY || 0;

		// Convert screen coordinates to canvas coordinates
		const canvasX = (clientX - canvasRect.left) / zoom;
		const canvasY = (clientY - canvasRect.top) / zoom;

		// Find seat elements
		const seats = document.querySelectorAll('.seat');

		for (const seat of seats) {
			const seatRect = seat.getBoundingClientRect();
			const seatCenterX = seatRect.left + seatRect.width / 2;
			const seatCenterY = seatRect.top + seatRect.height / 2;

			// Convert seat position to canvas coordinates
			const seatCanvasX = (seatCenterX - canvasRect.left) / zoom;
			const seatCanvasY = (seatCenterY - canvasRect.top) / zoom;

			// Check if cursor is within seat bounds (with some tolerance)
			const tolerance = 20; // pixels
			const dx = Math.abs(canvasX - seatCanvasX);
			const dy = Math.abs(canvasY - seatCanvasY);

			if (dx <= tolerance && dy <= tolerance) {
				return seat;
			}
		}

		return null;
	}

	function openSeatPopover(seatNode, clientX, clientY) {
		closePopover();
		const tableId = seatNode.dataset.tableId;
		const index = Number(seatNode.dataset.index);
		const state = window.TablePlanner.state;
		const table = state.tables.find(t => t.id === tableId);
		const currentGuestId = table && table.assignments ? table.assignments[String(index)] : undefined;

		const assignedSet = new Set();
		for (const t of state.tables) {
			for (const k in (t.assignments || {})) {
				const gid = t.assignments[k];
				if (gid) assignedSet.add(gid);
			}
		}

		const pop = document.createElement('div');
		pop.className = 'popover';
		pop.innerHTML = '';

		const rowSearch = document.createElement('div');
		rowSearch.className = 'row';
		const search = document.createElement('input');
		search.type = 'text';
		search.placeholder = window.i18n.t('searchGuests');
		search.style.flex = '1';
		rowSearch.appendChild(search);

		const row1 = document.createElement('div');
		row1.className = 'row';
		const select = document.createElement('select');
		select.dataset.role = 'assign';
		select.size = 6;
		select.style.width = '100%';
		const unassignedOpt = document.createElement('option');
		unassignedOpt.value = '';
		unassignedOpt.textContent = '-- ' + window.i18n.t('assignBtn') + ' --';
		select.appendChild(unassignedOpt);

		function rebuildOptions(filter) {
			select.innerHTML = '';
			const base = document.createElement('option'); base.value = ''; base.textContent = '-- ' + window.i18n.t('assignBtn') + ' --'; select.appendChild(base);
			for (const g of state.guests) {
				if (filter && !g.name.toLowerCase().includes(filter.toLowerCase())) continue;
				const isAssigned = assignedSet.has(g.id);
				const isCurrent = currentGuestId && g.id === currentGuestId;
				if (isAssigned && !isCurrent) continue;
				const opt = document.createElement('option');
				opt.value = g.id;
				opt.textContent = g.name;
				if (isCurrent) opt.selected = true;
				select.appendChild(opt);
			}
		}
		rebuildOptions('');
		search.addEventListener('input', () => rebuildOptions(search.value));

		row1.appendChild(select);

		select.addEventListener('change', () => {
			const gid = select.value;
			if (gid) { window.TablePlanner.assignGuestToSeat(tableId, index, gid); }
			closePopover();
		});

		const row2 = document.createElement('div');
		row2.className = 'row';
		const unBtn = document.createElement('button');
		unBtn.textContent = window.i18n.t('unassignBtn');
		unBtn.disabled = !currentGuestId;
		unBtn.addEventListener('click', () => {
			window.TablePlanner.unassignSeat(tableId, index);
			closePopover();
		});
		row2.appendChild(unBtn);

		pop.appendChild(rowSearch);
		pop.appendChild(row1);
		pop.appendChild(row2);
		document.body.appendChild(pop);
		positionPopover(pop, clientX, clientY);
		popover = pop;
		setTimeout(() => {
			document.addEventListener('mousedown', onDocClickClose, { once: true });
		}, 0);
	}

	function positionPopover(pop, clientX, clientY) {
		const pad = 8;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const rect = pop.getBoundingClientRect();
		let x = clientX + 8;
		let y = clientY + 8;
		if (x + rect.width + pad > vw) x = vw - rect.width - pad;
		if (y + rect.height + pad > vh) y = vh - rect.height - pad;
		pop.style.left = x + 'px';
		pop.style.top = y + 'px';
	}

	function onDocClickClose(e) {
		if (popover && !popover.contains(e.target)) {
			closePopover();
		}
	}

	function closePopover() {
		if (popover) {
			popover.remove();
			popover = null;
		}
	}

	function getTable(id) {
		return window.TablePlanner.state.tables.find(t => t.id === id);
	}

	function getInitials(name) {
		if (!name) return '';
		const caps = (name.match(/[A-Z]/g) || []).join('');
		if (caps.length >= 2) return caps.slice(0, 2);
		if (caps.length === 1) return caps;
		const parts = name.trim().split(/\s+/);
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}

	function showTableGuests(tableId) {
		const tableGuestsEl = document.getElementById('tableGuests');
		const tableGuestsListEl = document.getElementById('tableGuestsList');

		if (!tableGuestsEl || !tableGuestsListEl) return;

		const table = getTable(tableId);
		if (!table || !table.assignments) {
			tableGuestsEl.style.display = 'none';
			return;
		}

		// Clear existing content
		tableGuestsListEl.innerHTML = '';

		// Get all assigned guests for this table
		const assignedGuests = [];
		for (const seatIndex in table.assignments) {
			const guestId = table.assignments[seatIndex];
			if (guestId) {
				const guest = window.TablePlanner.state.guests.find(g => g.id === guestId);
				if (guest) {
					assignedGuests.push({
						guest: guest,
						seatNumber: parseInt(seatIndex) + 1
					});
				}
			}
		}

		// Sort by seat number
		assignedGuests.sort((a, b) => a.seatNumber - b.seatNumber);

		// Show the section if there are guests
		if (assignedGuests.length > 0) {
			tableGuestsEl.style.display = 'block';

			// Create guest items
			for (const item of assignedGuests) {
				const guestItem = document.createElement('div');
				guestItem.className = 'table-guest-item';

				// Guest picture or initials
				const pictureContainer = document.createElement('div');
				pictureContainer.className = 'table-guest-picture-container';
				if (item.guest.picture) {
					const picture = document.createElement('img');
					picture.className = 'table-guest-picture';
					picture.src = item.guest.picture;
					picture.alt = item.guest.name;
					picture.title = item.guest.name;

					// Handle image loading errors (e.g., invalid blob URLs after reload)
					picture.addEventListener('error', () => {
						console.warn(`Failed to load picture for ${item.guest.name}, falling back to initials`);
						// Remove the failed image and show initials instead
						picture.remove();
						const initials = document.createElement('div');
						initials.className = 'table-guest-initials';
						initials.textContent = getInitials(item.guest.name);
						initials.style.backgroundColor = item.guest.color || '#6aa9ff';
						pictureContainer.appendChild(initials);
						// Clear the invalid picture URL from the guest
						window.TablePlanner.updateGuest(item.guest.id, { picture: null });
					});

					pictureContainer.appendChild(picture);
				} else {
					const initials = document.createElement('div');
					initials.className = 'table-guest-initials';
					initials.textContent = getInitials(item.guest.name);
					initials.style.backgroundColor = item.guest.color || '#6aa9ff';
					pictureContainer.appendChild(initials);
				}

				const colorDot = document.createElement('div');
				colorDot.className = 'guest-color';
				colorDot.style.backgroundColor = item.guest.color || '#6aa9ff';
				colorDot.draggable = true;
				colorDot.dataset.guestId = item.guest.id;

				const nameInput = document.createElement('input');
				nameInput.type = 'text';
				nameInput.className = 'guest-name';
				nameInput.value = item.guest.name;
				nameInput.dataset.guestId = item.guest.id;

				const seatSpan = document.createElement('span');
				seatSpan.className = 'seat-number';
				seatSpan.textContent = `Seat ${item.seatNumber}`;

				guestItem.appendChild(pictureContainer);
				guestItem.appendChild(colorDot);
				guestItem.appendChild(nameInput);
				guestItem.appendChild(seatSpan);

				tableGuestsListEl.appendChild(guestItem);
			}

			// Add event listeners for editing and drag & drop
			setupTableGuestsInteractions(tableGuestsListEl);
		} else {
			tableGuestsEl.style.display = 'none';
		}
	}

	function clearTableGuests() {
		const tableGuestsEl = document.getElementById('tableGuests');
		if (tableGuestsEl) {
			tableGuestsEl.style.display = 'none';
		}
	}

	function setupTableGuestsInteractions(container) {
		// Handle name editing
		const nameInputs = container.querySelectorAll('.guest-name');
		nameInputs.forEach(input => {
			input.addEventListener('blur', (e) => {
				const guestId = e.target.dataset.guestId;
				const newName = e.target.value.trim();
				if (newName && newName !== e.target.defaultValue) {
					window.TablePlanner.updateGuest(guestId, { name: newName });
					e.target.defaultValue = newName;
				}
			});

			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.target.blur();
				}
			});
		});

		// Handle color drag and drop
		const colorDots = container.querySelectorAll('.guest-color');
		colorDots.forEach(dot => {
			dot.addEventListener('dragstart', (e) => {
				e.dataTransfer.setData('text/plain', e.target.dataset.guestId);
				e.target.classList.add('dragging');
			});

			dot.addEventListener('dragend', (e) => {
				e.target.classList.remove('dragging');
				// Remove all drop-target classes
				container.querySelectorAll('.guest-color').forEach(d => {
					d.classList.remove('drop-target');
				});
			});

			dot.addEventListener('dragover', (e) => {
				e.preventDefault();
				e.target.classList.add('drop-target');
			});

			dot.addEventListener('dragleave', (e) => {
				e.target.classList.remove('drop-target');
			});

			dot.addEventListener('drop', (e) => {
				e.preventDefault();
				e.target.classList.remove('drop-target');

				const sourceGuestId = e.dataTransfer.getData('text/plain');
				const targetGuestId = e.target.dataset.guestId;

				if (sourceGuestId && targetGuestId && sourceGuestId !== targetGuestId) {
					// Copy color from source to target
					const sourceGuest = window.TablePlanner.state.guests.find(g => g.id === sourceGuestId);
					const targetGuest = window.TablePlanner.state.guests.find(g => g.id === targetGuestId);

					if (sourceGuest && targetGuest) {
						window.TablePlanner.updateGuest(targetGuestId, { color: sourceGuest.color });
					}
				}
			});

			// Handle color click to open color picker
			dot.addEventListener('click', (e) => {
				const guestId = e.target.dataset.guestId;
				const guest = window.TablePlanner.state.guests.find(g => g.id === guestId);
				if (guest) {
					openColorPicker(e.target, guest);
				}
			});
		});

		// Handle picture click to remove picture
		const pictureContainers = container.querySelectorAll('.table-guest-picture-container');
		pictureContainers.forEach(container => {
			container.addEventListener('click', (e) => {
				const guestItem = e.target.closest('.table-guest-item');
				if (!guestItem) return;

				const guestId = guestItem.querySelector('.guest-name').dataset.guestId;
				const guest = window.TablePlanner.state.guests.find(g => g.id === guestId);

				if (guest && guest.picture) {
					const confirmRemove = window.confirm(window.i18n.t('pictureRemoveConfirm', { name: guest.name }));
					if (confirmRemove) {
						window.TablePlanner.removePictureFromGuest(guestId);
					}
				}
			});
		});
	}

	function openColorPicker(colorElement, guest) {
		// Create a temporary color input
		const colorInput = document.createElement('input');
		colorInput.type = 'color';
		colorInput.value = guest.color || '#6aa9ff';
		colorInput.style.position = 'absolute';
		colorInput.style.left = '-9999px';
		colorInput.style.opacity = '0';

		document.body.appendChild(colorInput);
		colorInput.click();

		colorInput.addEventListener('change', (e) => {
			const newColor = e.target.value;
			window.TablePlanner.updateGuest(guest.id, { color: newColor });
			document.body.removeChild(colorInput);
		});

		colorInput.addEventListener('blur', () => {
			document.body.removeChild(colorInput);
		});
	}

	let interactionsBound = false;

	function onCanvasWheel(e) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
		const currentZoom = window.TablePlanner.state.ui.zoom;
		const newZoom = Math.max(0.1, Math.min(5, currentZoom * delta));

		// Get mouse position relative to canvas
		const canvas = document.getElementById('canvas');
		const canvasRect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - canvasRect.left;
		const mouseY = e.clientY - canvasRect.top;

		// Calculate zoom point in canvas coordinates
		const zoomPointX = (mouseX - window.TablePlanner.state.ui.panX) / currentZoom;
		const zoomPointY = (mouseY - window.TablePlanner.state.ui.panY) / currentZoom;

		// Update zoom
		window.TablePlanner.setZoom(newZoom);

		// Adjust pan to keep the zoom point under the mouse
		const newPanX = mouseX - zoomPointX * newZoom;
		const newPanY = mouseY - zoomPointY * newZoom;
		window.TablePlanner.setPan(newPanX, newPanY);

		window.TablePlanner.render();
	}

	function bindInteractions() {
		if (interactionsBound) return; // Only bind once
		const canvas = document.getElementById('canvas');
		canvas.addEventListener('mousedown', onCanvasMouseDown);
		canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
		document.addEventListener('keydown', onKeyDown);
		interactionsBound = true;
	}

	window.TablePlanner = Object.assign(window.TablePlanner || {}, {
		bindInteractions,
		showTableGuests,
		clearTableGuests,
		setupTableGuestsInteractions,
		openColorPicker
	});
})();
