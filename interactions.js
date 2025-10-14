(function () {
	let drag = null;
	let resize = null;
	let popover = null;
	let dragSelect = null;

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
		let rectEl = document.getElementById('selection-rect');
		if (!rectEl) {
			rectEl = document.createElement('div');
			rectEl.id = 'selection-rect';
			rectEl.style.position = 'absolute';
			rectEl.style.border = '2px dashed #007bff';
			rectEl.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
			rectEl.style.pointerEvents = 'none';
			rectEl.style.zIndex = '1000';
			canvas.appendChild(rectEl);
		}
		rectEl.style.left = rect.x + 'px';
		rectEl.style.top = rect.y + 'px';
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

			// Debug: Log which table we're starting to resize
			if (t.type === 'circle' || t.type === 'rect' || t.type === 'separator') {
				console.log('Starting resize on table:', t.id, 'type:', t.type, 'dir:', dir);
			}

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
			openSeatPopover(seatNode, e.clientX, e.clientY);
			e.preventDefault();
			return;
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

			drag = {
				id,
				offsetX: e.clientX - t.x,
				offsetY: e.clientY - t.y,
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

		// Get canvas position
		const canvas = document.getElementById('canvas');
		const canvasRect = canvas.getBoundingClientRect();
		const startX = e.clientX - canvasRect.left;
		const startY = e.clientY - canvasRect.top;

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
		let x = e.clientX - drag.offsetX;
		let y = e.clientY - drag.offsetY;
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
		const canvas = document.getElementById('canvas');
		const canvasRect = canvas.getBoundingClientRect();
		dragSelect.endX = e.clientX - canvasRect.left;
		dragSelect.endY = e.clientY - canvasRect.top;

		const rect = createSelectionRect(dragSelect.startX, dragSelect.startY, dragSelect.endX, dragSelect.endY);
		updateSelectionRect(rect);
	}

	function onDragSelectUp(e) {
		if (!dragSelect) return;
		document.removeEventListener('mousemove', onDragSelectMove);
		document.removeEventListener('mouseup', onDragSelectUp);

		const rect = createSelectionRect(dragSelect.startX, dragSelect.startY, dragSelect.endX, dragSelect.endY);
		removeSelectionRect();

		// Find tables in selection rectangle
		const state = window.TablePlanner.state;
		const selectedIds = [];
		for (const table of state.tables) {
			if (isTableInSelectionRect(table, rect)) {
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

		// Debug: Ensure we're working with the correct table
		if (t.type === 'circle' || t.type === 'rect' || t.type === 'separator') {
			console.log('Resizing table:', t.id, 'type:', t.type, 'current size:', t.width || t.radius);
		}

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

	function bindInteractions() {
		if (interactionsBound) return; // Only bind once
		const canvas = document.getElementById('canvas');
		canvas.addEventListener('mousedown', onCanvasMouseDown);
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
