(function () {
	const SEAT_OFFSET = 24; // distance from table edge to seat ring (outside)
	const SIDE_MARGIN = 24; // margin from corners along edges for seat spacing
	const SQUARE_THRESHOLD = 1.0; // we will still use longer sides always; square uses all sides

	// Color conversion helper functions
	function hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : { r: 0, g: 0, b: 0 };
	}

	function rgbToHsl(r, g, b) {
		r /= 255;
		g /= 255;
		b /= 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h, s, l = (max + min) / 2;

		if (max === min) {
			h = s = 0; // achromatic
		} else {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}
		return { h: h * 360, s: s * 100, l: l * 100 };
	}

	function render() {
		const { state } = window.TablePlanner;
		const canvas = document.getElementById('canvas');
		canvas.innerHTML = '';

		// Calculate dynamic canvas bounds based on table positions
		let minX = 0, minY = 0, maxX = 1400, maxY = 900;
		const margin = 200; // Extra margin around tables

		for (const table of window.TablePlanner.state.tables) {
			if (table.type === 'circle') {
				minX = Math.min(minX, table.x - table.radius - margin);
				minY = Math.min(minY, table.y - table.radius - margin);
				maxX = Math.max(maxX, table.x + table.radius + margin);
				maxY = Math.max(maxY, table.y + table.radius + margin);
			} else if (table.type === 'separator' || table.type === 'rect') {
				minX = Math.min(minX, table.x - table.width / 2 - margin);
				minY = Math.min(minY, table.y - table.height / 2 - margin);
				maxX = Math.max(maxX, table.x + table.width / 2 + margin);
				maxY = Math.max(maxY, table.y + table.height / 2 + margin);
			}
		}

		// Ensure minimum canvas size and make it stable
		const canvasWidth = Math.max(1400, maxX - minX);
		const canvasHeight = Math.max(900, maxY - minY);

		// Set canvas size - position at (0,0) for stability
		canvas.style.width = canvasWidth + 'px';
		canvas.style.height = canvasHeight + 'px';
		canvas.style.left = '0px';
		canvas.style.top = '0px';

		// Use base grid size
		const baseGridSize = window.TablePlanner.state.ui.grid || 12;
		canvas.style.setProperty('--grid', baseGridSize + 'px');
		canvas.style.backgroundImage = window.TablePlanner.state.ui.showGrid === false ? 'none' : '';

		// Apply zoom and pan transforms
		const zoom = window.TablePlanner.state.ui.zoom || 1;
		const panX = window.TablePlanner.state.ui.panX || 0;
		const panY = window.TablePlanner.state.ui.panY || 0;
		canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

		// Update zoom level display
		const zoomLevelEl = document.getElementById('zoomLevel');
		if (zoomLevelEl) {
			zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
		}

		for (const table of window.TablePlanner.state.tables) {
			const isSelected = window.TablePlanner.state.ui.selectedTableIds.includes(table.id);
			if (table.type === 'rect') {
				renderRect(canvas, table, isSelected);
			} else if (table.type === 'separator') {
				renderSeparator(canvas, table, isSelected);
			} else {
				renderCircle(canvas, table, isSelected);
			}
		}

		const seatInput = document.getElementById('seatCountInput');
		const sel = window.TablePlanner.state.tables.find(t => t.id === window.TablePlanner.state.ui.selectedTableId);
		if (seatInput) seatInput.value = sel ? String(sel.seats) : '';

		if (window.updateCounts) window.updateCounts();
		if (window.updateControlsVisibility) window.updateControlsVisibility();

		renderGuestSidebar();

		// Show table guests for selected table
		const selectedTableId = window.TablePlanner.state.ui.selectedTableId;
		if (selectedTableId && window.TablePlanner.showTableGuests) {
			window.TablePlanner.showTableGuests(selectedTableId);
		} else if (window.TablePlanner.clearTableGuests) {
			window.TablePlanner.clearTableGuests();
		}

		window.TablePlanner.bindInteractions();
	}

	function getGuestById(id) {
		return window.TablePlanner.state.guests.find(g => g.id === id);
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

	function applySeatVisual(seatEl, table, index) {
		const gid = table.assignments && table.assignments[String(index)];
		if (!gid) {
			seatEl.classList.remove('assigned');
			seatEl.style.background = '#eceff1';
			seatEl.title = window.i18n.t('seat') + ' ' + (index + 1);
			seatEl.textContent = '';
			seatEl.innerHTML = '';
			return;
		}
		const g = getGuestById(gid);
		if (g) {
			seatEl.classList.add('assigned');
			seatEl.style.background = g.color || '#6aa9ff';
			seatEl.title = ''; // Remove tooltip since we have hover enlargement

			// Apply child styling if guest is a child
			if (g.isChild) {
				seatEl.classList.add('child');
			} else {
				seatEl.classList.remove('child');
			}

			// Clear previous content
			seatEl.innerHTML = '';

			if (g.picture) {
				const picture = document.createElement('img');
				picture.className = 'seat-picture';
				picture.src = g.picture;
				picture.alt = g.name;
				picture.title = ''; // Remove tooltip

				// Handle image loading errors (e.g., invalid blob URLs after reload)
				picture.addEventListener('error', () => {
					console.warn(`Failed to load picture for ${g.name}, falling back to initials`);
					// Remove the failed image and show initials instead
					picture.remove();
					seatEl.textContent = getInitials(g.name);
					// Clear the invalid picture URL from the guest
					window.TablePlanner.updateGuest(g.id, { picture: null });
				});

				seatEl.appendChild(picture);
			} else {
				seatEl.textContent = getInitials(g.name);
			}

			// Add guest name label that appears on hover
			const nameLabel = document.createElement('div');
			nameLabel.className = 'seat-name-label';
			nameLabel.textContent = g.name;
			seatEl.appendChild(nameLabel);
		} else {
			seatEl.classList.remove('assigned');
			seatEl.style.background = '#eceff1';
			seatEl.title = window.i18n.t('seat') + ' ' + (index + 1);
			seatEl.textContent = '';
			seatEl.innerHTML = '';
		}
	}

	function renderGuestSidebar() {
		const { state } = window.TablePlanner;
		const list = document.getElementById('guestList');
		if (!list) return;
		list.innerHTML = '';

		const guestIdToAssignment = buildGuestAssignmentIndex();

		let guests = window.TablePlanner.state.guests.slice();
		if (window.TablePlanner.state.ui.guestSort === 'name') {
			guests.sort((a, b) => a.name.localeCompare(b.name));
		} else if (window.TablePlanner.state.ui.guestSort === 'color') {
			guests.sort((a, b) => {
				// Convert hex colors to RGB for proper sorting
				const colorA = hexToRgb(a.color || '#6aa9ff');
				const colorB = hexToRgb(b.color || '#6aa9ff');

				// Sort by hue (primary), then saturation, then lightness
				const hueA = rgbToHsl(colorA.r, colorA.g, colorA.b).h;
				const hueB = rgbToHsl(colorB.r, colorB.g, colorB.b).h;

				if (hueA !== hueB) return hueA - hueB;

				// If same hue, sort by name
				return a.name.localeCompare(b.name);
			});
		} else if (window.TablePlanner.state.ui.guestSort === 'childFirst') {
			guests.sort((a, b) => {
				const aChild = a.isChild ? 1 : 0;
				const bChild = b.isChild ? 1 : 0;
				return bChild - aChild || a.name.localeCompare(b.name);
			});
		} else if (window.TablePlanner.state.ui.guestSort === 'tableSeat') {
			guests.sort((a, b) => {
				const aAssignment = guestIdToAssignment.get(a.id);
				const bAssignment = guestIdToAssignment.get(b.id);
				
				// Unassigned guests go to the end
				if (!aAssignment && !bAssignment) return a.name.localeCompare(b.name);
				if (!aAssignment) return 1;
				if (!bAssignment) return -1;
				
				// Sort by table label first (numeric if possible)
				const aTableNum = parseInt(aAssignment.tableLabel) || 999999;
				const bTableNum = parseInt(bAssignment.tableLabel) || 999999;
				
				if (aTableNum !== bTableNum) return aTableNum - bTableNum;
				
				// Then by seat number
				return aAssignment.seat - bAssignment.seat;
			});
		} else if (window.TablePlanner.state.ui.guestSort === 'assignedFirst') {
			guests.sort((a, b) => {
				const aAssigned = guestIdToAssignment.has(a.id) ? 1 : 0;
				const bAssigned = guestIdToAssignment.has(b.id) ? 1 : 0;
				return bAssigned - aAssigned || a.name.localeCompare(b.name);
			});
		} else { // unassignedFirst
			guests.sort((a, b) => {
				const aAssigned = guestIdToAssignment.has(a.id) ? 1 : 0;
				const bAssigned = guestIdToAssignment.has(b.id) ? 1 : 0;
				return aAssigned - bAssigned || a.name.localeCompare(b.name);
			});
		}

		if (window.TablePlanner.state.ui.guestUnassignedOnly) {
			guests = guests.filter(g => !guestIdToAssignment.has(g.id));
		}

		// Apply search filter
		const searchTerm = window.TablePlanner.state.ui.guestSearch;
		if (searchTerm && searchTerm.trim()) {
			const searchLower = searchTerm.toLowerCase().trim();
			guests = guests.filter(g => g.name.toLowerCase().includes(searchLower));
		}

		for (const g of guests) {
			const row = document.createElement('div');
			row.className = 'guest-row';
			row.dataset.id = g.id;

			// Guest picture or initials
			const pictureContainer = document.createElement('div');
			pictureContainer.className = 'guest-picture-container';
			if (g.isChild) {
				pictureContainer.classList.add('child');
			}
			if (g.picture) {
				const picture = document.createElement('img');
				picture.className = 'guest-picture';
				picture.src = g.picture;
				picture.alt = g.name;
				picture.title = g.name;

				// Handle image loading errors (e.g., invalid blob URLs after reload)
				picture.addEventListener('error', () => {
					console.warn(`Failed to load picture for ${g.name}, falling back to initials`);
					// Remove the failed image and show initials instead
					picture.remove();
					const initials = document.createElement('div');
					initials.className = 'guest-initials';
					initials.textContent = getInitials(g.name);
					initials.style.backgroundColor = g.color || '#6aa9ff';
					pictureContainer.appendChild(initials);
					// Clear the invalid picture URL from the guest
					window.TablePlanner.updateGuest(g.id, { picture: null });
				});

				pictureContainer.appendChild(picture);
			} else {
				const initials = document.createElement('div');
				initials.className = 'guest-initials';
				initials.textContent = getInitials(g.name);
				initials.style.backgroundColor = g.color || '#6aa9ff';
				pictureContainer.appendChild(initials);
			}

			const nameInput = document.createElement('input');
			nameInput.type = 'text';
			nameInput.value = g.name;
			nameInput.dataset.role = 'name';

			const colorInput = document.createElement('input');
			colorInput.type = 'color';
			colorInput.value = g.color || '#6aa9ff';
			colorInput.dataset.role = 'color';

			const childCheckbox = document.createElement('input');
			childCheckbox.type = 'checkbox';
			childCheckbox.checked = !!g.isChild;
			childCheckbox.dataset.role = 'child';

			const childLabel = document.createElement('label');
			childLabel.className = 'child-checkbox-label';
			childLabel.appendChild(childCheckbox);
			const labelSpan = document.createElement('span');
			labelSpan.textContent = window.i18n.t('guestChildLabel');
			childLabel.appendChild(labelSpan);

			const delBtn = document.createElement('button');
			delBtn.textContent = '✕';
			delBtn.dataset.role = 'delete-guest';

			const status = document.createElement('div');
			status.className = 'status';
			const assign = guestIdToAssignment.get(g.id);
			status.textContent = assign ? `${window.i18n.t('table')} ${assign.tableLabel} • ${window.i18n.t('seat')} ${assign.seat + 1}` : window.i18n.t('unassigned');

			row.appendChild(pictureContainer);
			row.appendChild(nameInput);
			row.appendChild(colorInput);
			row.appendChild(childLabel);
			row.appendChild(delBtn);
			row.appendChild(status);
			list.appendChild(row);
		}

		// controls state
		const sortSelect = document.getElementById('guestSortSelect');
		if (sortSelect) sortSelect.value = window.TablePlanner.state.ui.guestSort;
		const unassignedOnly = document.getElementById('guestUnassignedOnly');
		if (unassignedOnly) unassignedOnly.checked = !!window.TablePlanner.state.ui.guestUnassignedOnly;
	}

	function buildGuestAssignmentIndex() {
		const map = new Map();
		for (const t of window.TablePlanner.state.tables) {
			const assignments = t.assignments || {};
			for (const k in assignments) {
				const gid = assignments[k];
				if (!gid) continue;
				map.set(gid, { tableId: t.id, tableLabel: t.label, seat: Number(k) });
			}
		}
		return map;
	}

	function getFlatClassForSide(side) {
		return side === 'top' ? 'flat-top' : side === 'right' ? 'flat-right' : side === 'bottom' ? 'flat-bottom' : 'flat-left';
	}

	function addSelectionOutline(node, shape, dims) {
		const wrap = document.createElement('div');
		wrap.className = 'selection-outline';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		const pad = 6; // matches CSS offset
		if (shape === 'circle') {
			const r = dims.radius + pad;
			svg.setAttribute('viewBox', `${dims.cx - r} ${dims.cy - r} ${r * 2} ${r * 2}`);
			const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			c.setAttribute('cx', String(dims.cx));
			c.setAttribute('cy', String(dims.cy));
			c.setAttribute('r', String(r));
			svg.appendChild(c);
		} else if (shape === 'rect') {
			const x = dims.x - dims.w / 2 - pad;
			const y = dims.y - dims.h / 2 - pad;
			const w = dims.w + pad * 2;
			const h = dims.h + pad * 2;
			svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
			const rr = 8; // match base rect radius; flattened side will still look fine
			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y));
			rect.setAttribute('width', String(w)); rect.setAttribute('height', String(h));
			rect.setAttribute('rx', String(rr)); rect.setAttribute('ry', String(rr));
			svg.appendChild(rect);
		}
		wrap.appendChild(svg);
		node.appendChild(wrap);
	}

	function createLabel(table) {
		const label = document.createElement('div');
		label.style.position = 'absolute';
		label.style.left = '50%';
		label.style.top = '50%';
		label.style.transform = 'translate(-50%, -50%)';
		label.style.fontWeight = '600';
		const span = document.createElement('span');
		span.contentEditable = 'true';
		span.textContent = String(table.label);
		span.dataset.role = 'table-label';
		span.dataset.id = table.id;
		span.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); span.blur(); } });
		span.addEventListener('blur', () => { window.TablePlanner.commitTableLabel(span.dataset.id, span.textContent || ''); });
		label.appendChild(span);

		// Add seat count for tables
		if (table.seats > 0) {
			const seatCount = document.createElement('span');
			seatCount.textContent = ` (${table.seats})`;
			seatCount.style.color = '#666';
			seatCount.style.fontWeight = '400';
			label.appendChild(seatCount);
		}

		return label;
	}

	function renderCircle(canvas, table, isSelected) {
		const node = document.createElement('div');
		node.className = 'table circle' + (isSelected ? ' selected' : '');
		node.style.left = (table.x - table.radius) + 'px';
		node.style.top = (table.y - table.radius) + 'px';
		node.style.width = (table.radius * 2) + 'px';
		node.style.height = (table.radius * 2) + 'px';
		node.dataset.id = table.id;
		node.title = window.i18n.t('tableTitle', { label: table.label });

		node.appendChild(createLabel(table));
		if (isSelected) {
			addSelectionOutline(node, 'circle', { cx: table.x, cy: table.y, radius: table.radius });

			// Only show resize handles for the primary selected table
			if (window.TablePlanner.state.ui.selectedTableId === table.id) {
				const handleE = document.createElement('div');
				handleE.className = 'handle-e';
				handleE.dataset.id = table.id;
				handleE.dataset.dir = 'e';
				node.appendChild(handleE);
			}
		}

		const seats = table.seats;
		const angleStep = (Math.PI * 2) / seats;
		for (let i = 0; i < seats; i++) {
			const angle = -Math.PI / 2 + i * angleStep;
			const r = table.radius + SEAT_OFFSET;
			const seatX = table.x + r * Math.cos(angle);
			const seatY = table.y + r * Math.sin(angle);
			const seat = document.createElement('div');
			seat.className = 'seat';
			seat.style.left = seatX + 'px';
			seat.style.top = seatY + 'px';
			seat.dataset.tableId = table.id;
			seat.dataset.index = String(i);
			applySeatVisual(seat, table, i);
			canvas.appendChild(seat);
		}

		canvas.appendChild(node);
	}


	function renderRect(canvas, table, isSelected) {
		const node = document.createElement('div');
		let cls = 'table rect' + (isSelected ? ' selected' : '');
		if (table.rectOneSided) { cls += ' ' + getFlatClassForSide(table.oneSide); }
		node.className = cls;
		node.style.left = (table.x - table.width / 2) + 'px';
		node.style.top = (table.y - table.height / 2) + 'px';
		node.style.width = table.width + 'px';
		node.style.height = table.height + 'px';
		node.dataset.id = table.id;
		node.title = window.i18n.t('tableTitle', { label: table.label });

		node.appendChild(createLabel(table));
		if (isSelected) {
			addSelectionOutline(node, 'rect', { x: table.x, y: table.y, w: table.width, h: table.height });

			// Only show resize handles for the primary selected table
			if (window.TablePlanner.state.ui.selectedTableId === table.id) {
				const handleE = document.createElement('div');
				handleE.className = 'handle-e';
				handleE.dataset.id = table.id;
				handleE.dataset.dir = 'e';
				node.appendChild(handleE);
				const handleS = document.createElement('div');
				handleS.className = 'handle-s';
				handleS.dataset.id = table.id;
				handleS.dataset.dir = 's';
				node.appendChild(handleS);
			}
		}

		const sides = computeRectSeatSides(table);
		const perSide = distributeSeatsWithOdd(table.seats, sides.length, table.oddExtraSide, sides);
		const halfW = table.width / 2, halfH = table.height / 2;
		let seatIndex = 0;
		for (let s = 0; s < sides.length; s++) {
			const side = sides[s];
			const count = perSide[s];
			for (let i = 0; i < count; i++) {
				const t = count === 1 ? 0.5 : i / (count - 1);
				let seatX = table.x, seatY = table.y;
				if (side === 'top') {
					seatX = table.x - halfW + SIDE_MARGIN + t * (table.width - 2 * SIDE_MARGIN);
					seatY = table.y - halfH - SEAT_OFFSET;
				} else if (side === 'bottom') {
					seatX = table.x - halfW + SIDE_MARGIN + t * (table.width - 2 * SIDE_MARGIN);
					seatY = table.y + halfH + SEAT_OFFSET;
				} else if (side === 'left') {
					seatX = table.x - halfW - SEAT_OFFSET;
					seatY = table.y - halfH + SIDE_MARGIN + t * (table.height - 2 * SIDE_MARGIN);
				} else if (side === 'right') {
					seatX = table.x + halfW + SEAT_OFFSET;
					seatY = table.y - halfH + SIDE_MARGIN + t * (table.height - 2 * SIDE_MARGIN);
				}
				const seat = document.createElement('div');
				seat.className = 'seat';
				seat.style.left = seatX + 'px';
				seat.style.top = seatY + 'px';
				seat.dataset.tableId = table.id;
				seat.dataset.index = String(seatIndex);
				applySeatVisual(seat, table, seatIndex);
				canvas.appendChild(seat);
				seatIndex++;
			}
		}

		canvas.appendChild(node);
	}

	function renderSeparator(canvas, separator, isSelected) {
		const node = document.createElement('div');
		node.className = 'separator' + (isSelected ? ' selected' : '');
		node.style.left = (separator.x - separator.width / 2) + 'px';
		node.style.top = (separator.y - separator.height / 2) + 'px';
		node.style.width = separator.width + 'px';
		node.style.height = separator.height + 'px';
		node.dataset.id = separator.id;
		node.title = window.i18n.t('separatorTitle');

		if (isSelected) {
			addSelectionOutline(node, 'rect', { x: separator.x, y: separator.y, w: separator.width, h: separator.height });

			// Only show resize handles for the primary selected table
			if (window.TablePlanner.state.ui.selectedTableId === separator.id) {
				const handleE = document.createElement('div');
				handleE.className = 'handle-e';
				handleE.dataset.id = separator.id;
				handleE.dataset.dir = 'e';
				node.appendChild(handleE);
				const handleS = document.createElement('div');
				handleS.className = 'handle-s';
				handleS.dataset.id = separator.id;
				handleS.dataset.dir = 's';
				node.appendChild(handleS);
			}
		}

		canvas.appendChild(node);
	}

	function computeRectSeatSides(table) {
		if (table.rectOneSided) {
			return [table.oneSide];
		}
		const useAllSides = isSquareish(table.width, table.height);
		const longerIsHorizontal = table.width >= table.height;
		return useAllSides ? ['top', 'right', 'bottom', 'left'] : (longerIsHorizontal ? ['top', 'bottom'] : ['left', 'right']);
	}

	function distributeSeatsWithOdd(total, sidesCount, oddExtraSide, sidesOrder) {
		const base = Math.floor(total / sidesCount);
		let rem = total % sidesCount;
		const arr = new Array(sidesCount).fill(base);
		if (rem === 0) return arr;
		// put the first remainder on the configured side if present
		const idx = sidesOrder.indexOf(oddExtraSide);
		if (idx !== -1) { arr[idx] += 1; rem -= 1; }
		// distribute remaining if any, clockwise from that index
		let i = (idx === -1 ? 0 : (idx + 1));
		while (rem > 0) { arr[i % sidesCount] += 1; i++; rem--; }
		return arr;
	}

	function isSquareish(w, h) {
		const ratio = Math.max(w, h) / Math.min(w, h);
		return ratio <= 1.05;
	}

	window.TablePlanner = Object.assign(window.TablePlanner || {}, { render });
	window.updateCounts = window.updateCounts || function () { };
	window.updateControlsVisibility = window.updateControlsVisibility || function () { };
})();
