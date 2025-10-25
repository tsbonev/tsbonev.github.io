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

		// Check view mode and render accordingly
		if (state.ui.viewMode === 'seatingChart') {
			renderSeatingChart();
		} else {
			renderCanvas();
		}

		// Common rendering tasks
		const seatInput = document.getElementById('seatCountInput');
		const sel = window.TablePlanner.state.tables.find(t => t.id === window.TablePlanner.state.ui.selectedTableId);
		if (seatInput) seatInput.value = sel ? String(sel.seats) : '';

		if (window.updateCounts) window.updateCounts();
		if (window.updateControlsVisibility) window.updateControlsVisibility();

		renderGuestSidebar();
		renderColorLegend();

		// Show table guests for selected table
		const selectedTableId = window.TablePlanner.state.ui.selectedTableId;
		if (selectedTableId && window.TablePlanner.showTableGuests) {
			window.TablePlanner.showTableGuests(selectedTableId);
		} else if (window.TablePlanner.clearTableGuests) {
			window.TablePlanner.clearTableGuests();
		}

		window.TablePlanner.bindInteractions();
	}

	function renderCanvas() {
		const { state } = window.TablePlanner;
		const canvas = document.getElementById('canvas');
		const seatingChart = document.getElementById('seatingChart');

		// Show canvas, hide seating chart
		canvas.style.display = 'block';
		seatingChart.style.display = 'none';

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
	}

	function renderSeatingChart() {
		const { state } = window.TablePlanner;
		const canvas = document.getElementById('canvas');
		const seatingChart = document.getElementById('seatingChart');

		// Hide canvas, show seating chart
		canvas.style.display = 'none';
		seatingChart.style.display = 'block';

		seatingChart.innerHTML = '';

		// Filter out separators and only show actual tables
		const actualTables = state.tables.filter(t => t.type === 'rect' || t.type === 'circle');

		if (actualTables.length === 0) {
			const emptyState = document.createElement('div');
			emptyState.className = 'seating-chart-empty';
			emptyState.innerHTML = `
				<div class="seating-chart-empty-icon">📋</div>
				<div>${window.i18n.t('seatingChartNoTables')}</div>
			`;
			seatingChart.appendChild(emptyState);
			return;
		}

		const grid = document.createElement('div');
		grid.className = 'seating-chart-grid';

		for (const table of actualTables) {
			const isSelected = state.ui.selectedTableIds.includes(table.id);
			const tableCard = createTableCard(table, isSelected);
			grid.appendChild(tableCard);
		}

		seatingChart.appendChild(grid);
	}

	function createTableCard(table, isSelected) {
		const card = document.createElement('div');
		card.className = `table-card ${isSelected ? 'selected' : ''}`;
		card.dataset.tableId = table.id;

		// Add subtle styling based on table type
		if (table.type === 'circle') {
			card.style.borderLeft = '4px solid #28a745'; // Green for round tables
		} else {
			card.style.borderLeft = '4px solid #007bff'; // Blue for rectangular tables
		}

		// Header with table name and seat count
		const header = document.createElement('div');
		header.className = 'table-card-header';

		const title = document.createElement('h3');
		title.className = 'table-card-title';
		title.textContent = table.label;

		const seats = document.createElement('div');
		seats.className = 'table-card-seats';
		const tableType = table.type === 'circle' ? window.i18n.t('tableTypeRound') : window.i18n.t('tableTypeRectangle');
		seats.textContent = `${table.seats} ${window.i18n.t('seatsLabel')} • ${tableType}`;

		header.appendChild(title);
		header.appendChild(seats);
		card.appendChild(header);

		// Guests section
		const guestsContainer = document.createElement('div');
		guestsContainer.className = 'table-card-guests';

		// Create seat assignments array
		const seatAssignments = [];
		for (let i = 0; i < table.seats; i++) {
			const guestId = table.assignments && table.assignments[String(i)];
			seatAssignments.push({ seatNumber: i + 1, guestId });
		}

		// Sort by seat number
		seatAssignments.sort((a, b) => a.seatNumber - b.seatNumber);

		// Create guest elements
		for (const assignment of seatAssignments) {
			const guestElement = document.createElement('div');

			if (assignment.guestId) {
				const guest = getGuestById(assignment.guestId);
				if (guest) {
					guestElement.className = 'table-card-guest assigned';

					// Seat number
					const seatNumber = document.createElement('div');
					seatNumber.className = 'table-card-guest-seat';
					seatNumber.textContent = assignment.seatNumber;
					guestElement.appendChild(seatNumber);

					// Guest picture/initials
					const pictureContainer = document.createElement('div');
					pictureContainer.className = `table-card-guest-picture ${guest.isChild ? 'child' : ''}`;

					if (guest.picture) {
						const img = document.createElement('img');
						img.src = guest.picture;
						img.alt = guest.name;
						img.title = guest.name;

						// Handle image loading errors
						img.addEventListener('error', () => {
							img.remove();
							const initials = document.createElement('div');
							initials.className = 'initials';
							initials.textContent = getInitials(guest.name);
							initials.style.backgroundColor = guest.color || '#6aa9ff';
							pictureContainer.appendChild(initials);
						});

						pictureContainer.appendChild(img);
					} else {
						const initials = document.createElement('div');
						initials.className = 'initials';
						initials.textContent = getInitials(guest.name);
						initials.style.backgroundColor = guest.color || '#6aa9ff';
						pictureContainer.appendChild(initials);
					}

					guestElement.appendChild(pictureContainer);

					// Guest info
					const guestInfo = document.createElement('div');
					guestInfo.className = 'table-card-guest-info';

					const guestName = document.createElement('div');
					guestName.className = 'table-card-guest-name';
					guestName.textContent = guest.name;
					guestInfo.appendChild(guestName);

					// Add color indicator
					const colorIndicator = document.createElement('div');
					colorIndicator.style.width = '8px';
					colorIndicator.style.height = '8px';
					colorIndicator.style.borderRadius = '50%';
					colorIndicator.style.backgroundColor = guest.color || '#6aa9ff';
					colorIndicator.style.marginTop = '4px';
					colorIndicator.title = `${window.i18n.t('colorLabel')} ${guest.color || '#6aa9ff'}`;
					guestInfo.appendChild(colorIndicator);

					if (guest.isChild) {
						const childLabel = document.createElement('div');
						childLabel.className = 'table-card-guest-child';
						childLabel.textContent = window.i18n.t('guestChildLabel');
						guestInfo.appendChild(childLabel);
					}

					guestElement.appendChild(guestInfo);
				} else {
					// Guest not found, show empty seat
					guestElement.className = 'table-card-empty-seat';
					guestElement.innerHTML = `
						<div class="table-card-empty-seat-icon">${assignment.seatNumber}</div>
						<div>${window.i18n.t('emptySeat')}</div>
					`;
				}
			} else {
				// Empty seat
				guestElement.className = 'table-card-empty-seat';
				guestElement.innerHTML = `
					<div class="table-card-empty-seat-icon">${assignment.seatNumber}</div>
					<div>${window.i18n.t('emptySeat')}</div>
				`;
			}

			guestsContainer.appendChild(guestElement);
		}

		card.appendChild(guestsContainer);

		// Footer with summary
		const footer = document.createElement('div');
		footer.className = 'table-card-footer';

		const assignedCount = seatAssignments.filter(a => a.guestId).length;
		const childCount = seatAssignments.filter(a => {
			const guest = getGuestById(a.guestId);
			return guest && guest.isChild;
		}).length;

		let summaryText = `${assignedCount}/${table.seats} ${window.i18n.t('assignedLabel')}`;
		if (childCount > 0) {
			summaryText += ` • ${childCount} ${window.i18n.t('childrenLabel')}`;
		}

		footer.textContent = summaryText;
		card.appendChild(footer);

		// Add click handler for selection
		card.addEventListener('click', (e) => {
			e.stopPropagation();
			window.TablePlanner.selectTable(table.id);
		});

		return card;
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

	function renderColorLegend() {
		const legendContent = document.getElementById('legendContent');
		if (!legendContent) return;

		const uniqueColors = window.TablePlanner.getUniqueGuestColors();

		// Calculate optimal dimensions
		const dimensions = calculateLegendDimensions(uniqueColors);

		// Apply dynamic sizing to the legend sidebar
		const legendSidebar = document.getElementById('legendSidebar');
		if (legendSidebar) {
			legendSidebar.style.width = dimensions.width + 'px';
			legendSidebar.style.height = dimensions.height + 'px';
		}

		// Clear existing content
		legendContent.innerHTML = '';

		// Prevent drops on the legend itself
		legendContent.addEventListener('dragover', (e) => {
			e.preventDefault();
		});

		legendContent.addEventListener('drop', (e) => {
			e.preventDefault();
		});

		if (uniqueColors.length === 0) {
			const emptyMessage = document.createElement('div');
			emptyMessage.className = 'legend-empty';
			emptyMessage.textContent = 'No colors assigned yet';
			emptyMessage.style.textAlign = 'center';
			emptyMessage.style.color = '#666';
			emptyMessage.style.fontStyle = 'italic';
			emptyMessage.style.padding = '20px';
			legendContent.appendChild(emptyMessage);

			// Update button position after content is rendered
			if (window.updateLegendButtonPosition) {
				// Use requestAnimationFrame to ensure DOM layout is complete
				requestAnimationFrame(() => {
					setTimeout(() => window.updateLegendButtonPosition(), 0);
				});
			}
			return;
		}

		for (const color of uniqueColors) {
			const legendItem = document.createElement('div');
			legendItem.className = 'legend-item';
			legendItem.style.display = 'flex';
			legendItem.style.alignItems = 'center';
			legendItem.style.gap = '12px';
			legendItem.style.marginBottom = '8px';

			// Color circle
			const colorCircle = document.createElement('div');
			colorCircle.className = 'legend-color-circle';
			colorCircle.style.width = '24px';
			colorCircle.style.height = '24px';
			colorCircle.style.borderRadius = '50%';
			colorCircle.style.backgroundColor = color;
			colorCircle.style.border = '2px solid rgba(0, 0, 0, 0.1)';
			colorCircle.style.flexShrink = '0';
			colorCircle.draggable = true;
			colorCircle.dataset.color = color;

			// Label input
			const labelInput = document.createElement('input');
			labelInput.type = 'text';
			labelInput.className = 'legend-label-input';
			labelInput.value = window.TablePlanner.state.colorLegend[color] || '';
			labelInput.placeholder = 'Enter label...';
			labelInput.style.flex = '1';
			labelInput.style.padding = '6px 8px';
			labelInput.style.border = '1px solid #d1d5db';
			labelInput.style.borderRadius = '4px';
			labelInput.style.fontSize = '14px';
			labelInput.style.width = dimensions.inputWidth + 'px';
			labelInput.dataset.color = color;

			// Add event listener for label changes
			labelInput.addEventListener('input', (e) => {
				const newLabel = e.target.value;
				window.TablePlanner.updateColorLegendLabel(color, newLabel);
			});

			// Add event listener for blur to re-sort when user finishes editing
			labelInput.addEventListener('blur', () => {
				// Re-render the color legend to update the order after user finishes editing
				if (window.TablePlanner && window.TablePlanner.renderColorLegend) {
					window.TablePlanner.renderColorLegend();
				}
			});

			// Add drag event listeners to color circle
			colorCircle.addEventListener('dragstart', (e) => {
				e.dataTransfer.setData('text/plain', color);
				e.dataTransfer.setData('application/legend-color', 'true');
				colorCircle.classList.add('dragging');
			});

			colorCircle.addEventListener('dragend', (e) => {
				colorCircle.classList.remove('dragging');
				// Remove all drop-target classes from table guest colors
				const tableGuestsList = document.getElementById('tableGuestsList');
				if (tableGuestsList) {
					tableGuestsList.querySelectorAll('.guest-color').forEach(dot => {
						dot.classList.remove('drop-target');
					});
				}
			});

			legendItem.appendChild(colorCircle);
			legendItem.appendChild(labelInput);
			legendContent.appendChild(legendItem);
		}

		// Update button position after all content is rendered
		if (window.updateLegendButtonPosition) {
			// Use requestAnimationFrame to ensure DOM layout is complete
			requestAnimationFrame(() => {
				setTimeout(() => window.updateLegendButtonPosition(), 0);
			});
		}
	}

	function calculateLegendDimensions(uniqueColors) {
		const canvasWrap = document.querySelector('.canvas-wrap');
		const canvasHeight = canvasWrap ? canvasWrap.clientHeight : window.innerHeight - 100;
		const canvasWidth = canvasWrap ? canvasWrap.clientWidth : window.innerWidth - 400;

		// Default dimensions
		const defaultWidth = 300; // 3/4 of main sidebar width
		const defaultHeight = Math.floor(canvasHeight * 0.33); // 1/3 of canvas height
		const defaultInputWidth = 200; // Default input width

		// Calculate optimal input width based on content
		let maxInputWidth = defaultInputWidth;
		for (const color of uniqueColors) {
			const label = window.TablePlanner.state.colorLegend[color] || '';
			const placeholderLength = 'Enter label...'.length;
			const contentLength = Math.max(label.length, placeholderLength);

			// Estimate width: ~8px per character + padding
			const estimatedWidth = Math.max(contentLength * 8 + 16, 120); // Minimum 120px
			maxInputWidth = Math.max(maxInputWidth, estimatedWidth);
		}

		// Limit input width to 2x default width
		const optimalInputWidth = Math.min(maxInputWidth, defaultInputWidth * 2);

		// Calculate total width: color circle + gap + input width + padding
		const colorCircleWidth = 24;
		const gap = 12;
		const horizontalPadding = 32; // 16px on each side
		const optimalWidth = colorCircleWidth + gap + optimalInputWidth + horizontalPadding;

		// Calculate optimal height based on number of colors
		const headerHeight = 48; // Approximate header height
		const itemHeight = 40; // Height per color item (including margin)
		const padding = 24; // Top and bottom padding
		const optimalHeight = headerHeight + (uniqueColors.length * itemHeight) + padding;

		// Limit height to 90% of canvas height
		const maxHeight = Math.floor(canvasHeight * 0.9);
		const finalHeight = Math.min(optimalHeight, maxHeight);

		// Ensure minimum dimensions
		const finalWidth = Math.max(optimalWidth, 200);
		const finalHeightMin = Math.max(finalHeight, 150);

		return {
			width: finalWidth,
			height: finalHeightMin,
			inputWidth: optimalInputWidth
		};
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

	function createSizeDisplay(table) {
		if (!table.size) return null;

		const sizeDisplay = document.createElement('div');
		sizeDisplay.className = 'table-size-display';
		sizeDisplay.style.position = 'absolute';
		sizeDisplay.style.top = '8px';
		sizeDisplay.style.right = '8px';
		sizeDisplay.style.fontSize = '11px';
		sizeDisplay.style.fontWeight = '500';
		sizeDisplay.style.color = '#666';
		sizeDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
		sizeDisplay.style.padding = '2px 6px';
		sizeDisplay.style.borderRadius = '4px';
		sizeDisplay.style.border = '1px solid rgba(0, 0, 0, 0.1)';
		sizeDisplay.style.pointerEvents = 'none';

		const unit = window.i18n.t('unitMeter');
		sizeDisplay.textContent = `${table.size.width.toFixed(1)}${unit} x ${table.size.height.toFixed(1)}${unit}`;

		return sizeDisplay;
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

		// Add size display
		const sizeDisplay = createSizeDisplay(table);
		if (sizeDisplay) {
			node.appendChild(sizeDisplay);
		}

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

		// Add size display
		const sizeDisplay = createSizeDisplay(table);
		if (sizeDisplay) {
			node.appendChild(sizeDisplay);
		}

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

	window.TablePlanner = Object.assign(window.TablePlanner || {}, {
		render,
		renderColorLegend,
		calculateLegendDimensions
	});
	window.updateCounts = window.updateCounts || function () { };
	window.updateControlsVisibility = window.updateControlsVisibility || function () { };
})();
