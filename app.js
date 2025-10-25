(function () {
	function bootstrap() {
		const { render, addTableCircle, addTableRect, addSeparator, state, setLanguage } = window.TablePlanner;
		document.getElementById('addCircleTableBtn').addEventListener('click', addTableCircle);
		document.getElementById('addRectTableBtn').addEventListener('click', addTableRect);
		document.getElementById('addSeparatorBtn').addEventListener('click', addSeparator);
		document.getElementById('undoBtn').addEventListener('click', () => window.TablePlanner.undo());
		document.getElementById('redoBtn').addEventListener('click', () => window.TablePlanner.redo());
		document.getElementById('exportBtn').addEventListener('click', onExport);
		document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importInput').click());
		document.getElementById('importInput').addEventListener('change', onImport);
		document.getElementById('printSeatingChartBtn').addEventListener('click', () => {
			printSeatingChart();
		});
		document.getElementById('printBtn').addEventListener('click', () => {
			printCanvas();
		});

		document.getElementById('exportGuestsCsvBtn').addEventListener('click', onExportGuestsCsv);
		document.getElementById('importGuestsCsvBtn').addEventListener('click', () => document.getElementById('importGuestsCsvInput').click());
		document.getElementById('importGuestsCsvInput').addEventListener('change', onImportGuestsCsv);

		// Picture folder selection
		document.getElementById('selectPictureFolderBtn').addEventListener('click', onSelectPictureFolder);
		document.getElementById('scanPicturesBtn').addEventListener('click', onScanPictures);

		// Sidebar toggle
		document.getElementById('sidebarToggle').addEventListener('click', onSidebarToggle);

		// Legend sidebar toggle
		document.getElementById('legendToggle').addEventListener('click', onLegendToggle);

		// Language toggle
		document.getElementById('languageBtn').addEventListener('click', () => {
			const currentLang = state.ui.language || 'en';
			const newLang = currentLang === 'en' ? 'bg' : 'en';
			setLanguage(newLang);
			window.i18n.updateUI();
			document.getElementById('languageBtn').textContent = newLang === 'bg' ? '🇺🇸' : '🇧🇬';
		});

		// View toggle
		document.getElementById('viewToggleBtn').addEventListener('click', onViewToggle);

		const guestForm = document.getElementById('guestForm');
		guestForm.addEventListener('submit', onGuestAdd);
		document.getElementById('guestSortSelect').addEventListener('change', onGuestSort);
		document.getElementById('guestUnassignedOnly').addEventListener('change', onGuestFilter);
		document.getElementById('guestSearchInput').addEventListener('input', onGuestSearch);
		const guestList = document.getElementById('guestList');
		guestList.addEventListener('change', onGuestListChange);
		guestList.addEventListener('click', onGuestListClick);

		document.getElementById('applySeatCountBtn').addEventListener('click', onApplySeatCount);

		// table size controls
		document.getElementById('tableSizeWidthInput').addEventListener('change', onTableSizeChange);
		document.getElementById('tableSizeHeightInput').addEventListener('change', onTableSizeChange);
		document.getElementById('pixelsPerMeterInput').addEventListener('change', onPixelsPerMeterChange);
		document.getElementById('tieSizeToCanvasBtn').addEventListener('click', onTieSizeToCanvas);

		// rect controls
		document.getElementById('oneSidedToggle').addEventListener('change', onOneSidedToggle);
		document.getElementById('oneSideGroup').addEventListener('change', onOneSideChange);
		document.getElementById('oddExtraGroup').addEventListener('change', onOddExtraChange);

		// snap and grid controls
		const snapEl = document.getElementById('snapToggle');
		snapEl.addEventListener('change', onSnapChange);
		const gridEl = document.getElementById('gridSizeInput');
		gridEl.addEventListener('change', onGridChange);
		const showGridEl = document.getElementById('showGridToggle');
		showGridEl.addEventListener('change', onShowGridChange);

		document.addEventListener('keydown', onGlobalKeydown);

		// Expose helpers for render()
		window.updateCounts = updateCounts;
		window.updateControlsVisibility = updateControlsVisibility;
		window.updateToolbarVisibility = updateToolbarVisibility;
		window.updateLegendButtonPosition = updateLegendButtonPosition;

		// Initial UI sync then render
		syncGridControls();
		initializeSidebarState();
		initializeViewToggleButton();
		window.i18n.updateUI(); // Apply translations
		window.TablePlanner.render();
		updateCounts();
		updateControlsVisibility();
		updateToolbarVisibility();
		updatePictureFolderStatus();
		updateLegendButtonPosition(); // Initial button positioning
		requestAnimationFrame(() => {
			window.TablePlanner.render();
			updateCounts();
			updateControlsVisibility();
			updateToolbarVisibility();
			updateLegendButtonPosition(); // Update button position after render
		});
	}

	function updateCounts() {
		const s = window.TablePlanner.state;
		const actualTables = s.tables.filter(t => t.type === 'rect' || t.type === 'circle');
		const tables = actualTables.length;
		const guests = s.guests.length;
		let assigned = 0;
		for (const t of actualTables) { for (const k in (t.assignments || {})) { if (t.assignments[k]) assigned++; } }
		const unassigned = guests - new Set(actualTables.flatMap(t => Object.values(t.assignments || {}))).size;

		// Calculate total seats
		const totalSeats = actualTables.reduce((sum, t) => sum + (t.seats || 0), 0);

		const tableCount = document.getElementById('tableCount');
		if (tableCount) tableCount.textContent = window.i18n.t('tableCount', { count: tables });
		const seatCount = document.getElementById('seatCount');
		if (seatCount) seatCount.textContent = `| ${window.i18n.t('seatCount', { count: totalSeats })}`;
		const guestCounts = document.getElementById('guestCounts');
		if (guestCounts) guestCounts.textContent = window.i18n.t('guestCounts', { total: guests, assigned, unassigned });
	}

	function updateControlsVisibility() {
		const s = window.TablePlanner.state;
		const t = s.tables.find(t => t.id === s.ui.selectedTableId);
		const tableControls = document.getElementById('tableControls');
		const rectControls = document.getElementById('rectControls');
		const oneSideGroup = document.getElementById('oneSideGroup');
		const oddExtraGroup = document.getElementById('oddExtraGroup');
		if (!t || t.type === 'separator') {
			if (tableControls) tableControls.style.display = 'none';
			return;
		}
		if (tableControls) tableControls.style.display = '';
		if (rectControls) rectControls.style.display = (t.type === 'rect') ? '' : 'none';
		if (oneSideGroup) oneSideGroup.style.display = (t.type === 'rect' && t.rectOneSided) ? '' : 'none';
		const sides = t.type === 'rect' ? (t.rectOneSided ? [t.oneSide] : computeRectSeatSides(t)) : [];
		const twoSided = t.type === 'rect' && !t.rectOneSided && sides.length === 2;
		const isOdd = t && (t.seats % 2) === 1;
		if (oddExtraGroup) oddExtraGroup.style.display = (twoSided && isOdd) ? '' : 'none';

		// Sync size input values
		const widthInput = document.getElementById('tableSizeWidthInput');
		const heightInput = document.getElementById('tableSizeHeightInput');
		const pixelsPerMeterInput = document.getElementById('pixelsPerMeterInput');
		if (widthInput && heightInput && t.size) {
			widthInput.value = t.size.width.toFixed(1);
			heightInput.value = t.size.height.toFixed(1);
		}
		if (pixelsPerMeterInput) {
			pixelsPerMeterInput.value = window.TablePlanner.state.ui.pixelsPerMeter || 100;
		}

		// Update tie button state
		updateTieSizeButtonState();
	}

	function updateToolbarVisibility() {
		const s = window.TablePlanner.state;
		const isSeatingChartView = s.ui.viewMode === 'seatingChart';

		// Hide/show add table buttons
		const addCircleBtn = document.getElementById('addCircleTableBtn');
		const addRectBtn = document.getElementById('addRectTableBtn');
		const addSeparatorBtn = document.getElementById('addSeparatorBtn');

		if (addCircleBtn) addCircleBtn.style.display = isSeatingChartView ? 'none' : '';
		if (addRectBtn) addRectBtn.style.display = isSeatingChartView ? 'none' : '';
		if (addSeparatorBtn) addSeparatorBtn.style.display = isSeatingChartView ? 'none' : '';

		// Hide/show grid controls
		const snapToggle = document.getElementById('snapToggle');
		const gridSizeInput = document.getElementById('gridSizeInput');
		const showGridToggle = document.getElementById('showGridToggle');

		// Find the parent labels/containers to hide the entire control
		const snapLabel = snapToggle ? snapToggle.closest('label') : null;
		const gridSizeLabel = gridSizeInput ? gridSizeInput.closest('label') : null;
		const showGridLabel = showGridToggle ? showGridToggle.closest('label') : null;

		if (snapLabel) snapLabel.style.display = isSeatingChartView ? 'none' : '';
		if (gridSizeLabel) gridSizeLabel.style.display = isSeatingChartView ? 'none' : '';
		if (showGridLabel) showGridLabel.style.display = isSeatingChartView ? 'none' : '';

		// Hide/show print buttons based on view mode
		const printBtn = document.getElementById('printBtn');
		const printSeatingChartBtn = document.getElementById('printSeatingChartBtn');

		if (printBtn) printBtn.style.display = isSeatingChartView ? 'none' : '';
		if (printSeatingChartBtn) printSeatingChartBtn.style.display = isSeatingChartView ? '' : 'none';
	}

	function updateTieSizeButtonState() {
		const tieBtn = document.getElementById('tieSizeToCanvasBtn');
		if (!tieBtn) return;

		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) {
			tieBtn.classList.remove('active');
			tieBtn.textContent = window.i18n.t('tieSizeToCanvasBtn');
			return;
		}

		const table = window.TablePlanner.state.tables.find(t => t.id === sel);
		const isTied = table && table.sizeTiedToCanvas;

		if (isTied) {
			tieBtn.classList.add('active');
			tieBtn.textContent = window.i18n.t('tieSizeToCanvasBtnActive');
		} else {
			tieBtn.classList.remove('active');
			tieBtn.textContent = window.i18n.t('tieSizeToCanvasBtn');
		}
	}

	function computeRectSeatSides(table) {
		const useAllSides = (Math.max(table.width, table.height) / Math.min(table.width, table.height)) <= 1.05;
		const longerIsHorizontal = table.width >= table.height;
		return table.rectOneSided ? [table.oneSide] : (useAllSides ? ['top', 'right', 'bottom', 'left'] : (longerIsHorizontal ? ['top', 'bottom'] : ['left', 'right']));
	}

	// expose updateControlsVisibility for render()
	window.updateControlsVisibility = updateControlsVisibility;

	function validateImport(obj) {
		if (!obj || typeof obj !== 'object') return 'Root must be an object';
		if (!Array.isArray(obj.tables) || !Array.isArray(obj.guests)) return 'Missing tables or guests arrays';
		for (const t of obj.tables) {
			if (typeof t !== 'object') return 'Invalid table entry';
			if (!t.id) return 'Table missing id';
			if (t.type === 'separator') {
				if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.width) || !Number.isFinite(t.height)) return 'Invalid separator geometry';
			} else if (t.type === 'circle') {
				if (!t.label) return 'Circle table missing label';
				if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.radius)) return 'Invalid circle table geometry';
				if (!Number.isFinite(t.seats) || t.seats < 1 || t.seats > 64) return 'Invalid seats count';
			} else if (t.type === 'rect') {
				if (!t.label) return 'Rect table missing label';
				if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.width) || !Number.isFinite(t.height)) return 'Invalid rect table geometry';
				if (!Number.isFinite(t.seats) || t.seats < 1 || t.seats > 64) return 'Invalid seats count';
			} else {
				return 'Unknown table type';
			}
		}
		for (const g of obj.guests) {
			if (typeof g !== 'object' || !g.id || typeof g.name !== 'string') return 'Invalid guest entry';
		}
		return null;
	}

	function onGlobalKeydown(e) {
		if (!window.TablePlanner || !window.TablePlanner.undo) return;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			window.TablePlanner.undo();
			updateCounts();
		} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			window.TablePlanner.redo();
			updateCounts();
		}
	}

	function onSnapChange(e) { window.TablePlanner.setSnap(e.target.checked); }
	function onGridChange(e) {
		if (window.TablePlanner && window.TablePlanner.setGridSize) {
			window.TablePlanner.setGridSize(Number(e.target.value));
			window.TablePlanner.render();
		}
	}

	function onOneSidedToggle(e) {
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) return;
		window.TablePlanner.setRectOneSided(sel, e.target.checked);
	}
	function onOneSideChange(e) {
		if (e.target.name !== 'oneSide') return;
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) return;
		window.TablePlanner.setRectOneSide(sel, e.target.value);
	}
	function onOddExtraChange(e) {
		if (e.target.name !== 'oddExtraSide') return;
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) return;
		window.TablePlanner.setRectOddExtraSide(sel, e.target.value);
	}

	function onGuestAdd(e) {
		e.preventDefault();
		const name = document.getElementById('guestNameInput').value;
		const color = document.getElementById('guestColorInput').value;
		const isChild = document.getElementById('guestChildInput').checked;
		if (!name.trim()) return;
		window.TablePlanner.addGuest(name, color, isChild);
		document.getElementById('guestNameInput').value = '';
		document.getElementById('guestChildInput').checked = false;
		updateCounts();
	}
	function onGuestSort(e) { window.TablePlanner.setGuestSort(e.target.value); }
	function onGuestFilter(e) { window.TablePlanner.setGuestUnassignedOnly(e.target.checked); }
	function onGuestSearch(e) { window.TablePlanner.setGuestSearch(e.target.value); }

	function onGuestListChange(e) {
		const role = e.target.dataset.role;
		const row = e.target.closest('.guest-row');
		if (!row) return;
		const id = row.dataset.id;
		if (role === 'name') {
			window.TablePlanner.updateGuest(id, { name: e.target.value });
		} else if (role === 'color') {
			window.TablePlanner.updateGuest(id, { color: e.target.value });
		} else if (role === 'child') {
			window.TablePlanner.updateGuest(id, { isChild: e.target.checked });
		}
	}

	function onGuestListClick(e) {
		const btn = e.target.closest('[data-role="delete-guest"]');
		if (btn) {
			const row = btn.closest('.guest-row');
			if (!row) return;
			const id = row.dataset.id;
			const ok = window.confirm(window.i18n.t('deleteGuestConfirm'));
			if (!ok) return;
			window.TablePlanner.deleteGuest(id);
			updateCounts();
			return;
		}

		// Handle picture click to remove picture
		const pictureContainer = e.target.closest('.guest-picture-container');
		if (pictureContainer) {
			const row = pictureContainer.closest('.guest-row');
			if (!row) return;
			const id = row.dataset.id;
			const guest = window.TablePlanner.state.guests.find(g => g.id === id);

			if (guest && guest.picture) {
				const confirmRemove = window.confirm(window.i18n.t('pictureRemoveConfirm', { name: guest.name }));
				if (confirmRemove) {
					window.TablePlanner.removePictureFromGuest(id);
				}
			}
		}
	}

	function onApplySeatCount() {
		const input = document.getElementById('seatCountInput');
		const value = Number(input.value);
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) return;
		if (!Number.isFinite(value)) return;
		window.TablePlanner.setTableSeats(sel, value);
		updateCounts();
	}

	function onTableSizeChange(e) {
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) return;

		const widthInput = document.getElementById('tableSizeWidthInput');
		const heightInput = document.getElementById('tableSizeHeightInput');
		const width = Number(widthInput.value);
		const height = Number(heightInput.value);

		if (!Number.isFinite(width) || !Number.isFinite(height)) return;

		window.TablePlanner.updateTableSizeProperty(sel, width, height);
	}

	function onPixelsPerMeterChange(e) {
		const ratio = Number(e.target.value);
		if (!Number.isFinite(ratio) || ratio < 10 || ratio > 1000) return;

		window.TablePlanner.setPixelsPerMeter(ratio);

		// Update size values for ALL tables that have their size tied to canvas
		const state = window.TablePlanner.state;
		for (const table of state.tables) {
			if (table.sizeTiedToCanvas) {
				window.TablePlanner.syncSizeFromCanvas(table.id);
			}
		}

		// Update the controls visibility for the currently selected table
		if (window.updateControlsVisibility) {
			window.updateControlsVisibility();
		}
	}

	function onTieSizeToCanvas() {
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if (!sel) return;

		// Toggle the tie state for this specific table
		window.TablePlanner.toggleSizeTiedToCanvas(sel);

		// Update button appearance
		updateTieSizeButtonState();

		// If we just enabled tying, sync the current canvas dimensions to size
		const table = window.TablePlanner.state.tables.find(t => t.id === sel);
		if (table && table.sizeTiedToCanvas) {
			window.TablePlanner.syncSizeFromCanvas(sel);

			// Update the input fields to reflect the new values
			if (table.size) {
				const widthInput = document.getElementById('tableSizeWidthInput');
				const heightInput = document.getElementById('tableSizeHeightInput');
				if (widthInput) widthInput.value = table.size.width.toFixed(1);
				if (heightInput) heightInput.value = table.size.height.toFixed(1);
			}
		}
	}

	function syncGridControls() {
		if (!window.TablePlanner || !window.TablePlanner.state) return;
		const s = window.TablePlanner.state;
		const snapEl = document.getElementById('snapToggle'); if (snapEl) snapEl.checked = !!s.ui.snap;
		const gridEl = document.getElementById('gridSizeInput'); if (gridEl) gridEl.value = String(s.ui.grid || 64);
		const showGridEl = document.getElementById('showGridToggle'); if (showGridEl) showGridEl.checked = s.ui.showGrid !== false;
	}

	function onShowGridChange(e) {
		window.TablePlanner.state.ui.showGrid = !!e.target.checked;
		window.TablePlanner.save();
		window.TablePlanner.render();
	}

	function onExport() {
		const data = JSON.stringify(window.TablePlanner.state, null, 2);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const ts = new Date().toISOString().replace(/[:.]/g, '-');
		a.download = `table-planner-${ts}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function onImport(e) {
		const file = e.target.files && e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const obj = JSON.parse(String(reader.result));
				const err = validateImport(obj);
				if (err) { alert(window.i18n.t('importFailed', { error: err })); return; }

				// Apply migration to imported data to ensure all properties are initialized
				window.TablePlanner.migrate(obj);

				window.TablePlanner.state.version = obj.version || 1;
				window.TablePlanner.state.guests = Array.isArray(obj.guests) ? obj.guests : [];
				window.TablePlanner.state.tables = Array.isArray(obj.tables) ? obj.tables : [];
				window.TablePlanner.state.ui = Object.assign({ selectedTableId: null, zoom: 1, guestSort: 'unassignedFirst', guestUnassignedOnly: false, snap: false, grid: 12, showGrid: true }, obj.ui || {});
				window.TablePlanner.state.colorLegend = obj.colorLegend || {};

				// Initialize size properties for tables that don't have them
				initializeImportedTableSizes();

				window.TablePlanner.save();
				syncGridControls();
				window.TablePlanner.render();
				updateCounts();
				if (window.updateControlsVisibility) window.updateControlsVisibility();
			} catch (err) {
				alert(window.i18n.t('importFailedInvalidJson'));
			}
		};
		reader.readAsText(file);
		// reset so selecting the same file again will fire change
		e.target.value = '';
	}

	function printSeatingChart() {
		// Switch to seating chart view if not already there
		const currentMode = window.TablePlanner.state.ui.viewMode;
		if (currentMode !== 'seatingChart') {
			window.TablePlanner.setViewMode('seatingChart');
			window.TablePlanner.render();

			// Wait for render to complete, then print
			setTimeout(() => {
				printSeatingChartImpl();
			}, 100);
		} else {
			printSeatingChartImpl();
		}
	}

	function printCanvas() {
		// Calculate scale to fit canvas to page
		const canvas = document.getElementById('canvas');
		if (!canvas) return;

		// Create and add print heading
		const printHeading = document.createElement('div');
		printHeading.id = 'print-canvas-heading';
		printHeading.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			background: white;
			text-align: center;
			padding: 20px 0;
			font-size: 24px;
			font-weight: bold;
			color: #333;
			border-bottom: 2px solid #333;
			z-index: 10000;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		`;
		printHeading.textContent = window.i18n.t('canvasViewTitle');
		document.body.appendChild(printHeading);

		// Get the actual canvas content dimensions, not the displayed dimensions
		const canvasContentWidth = canvas.scrollWidth;
		const canvasContentHeight = canvas.scrollHeight;

		// Determine orientation based on canvas content aspect ratio
		const isPortrait = canvasContentHeight > canvasContentWidth;

		// Calculate scale factors for both dimensions
		const pageWidth = window.innerWidth;
		const pageHeight = window.innerHeight - 80; // Account for heading height
		const scaleX = pageWidth / canvasContentWidth;
		const scaleY = pageHeight / canvasContentHeight;

		// Use the smaller scale to ensure the entire canvas fits
		const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for some margin

		// Set the CSS custom property for the scale and orientation
		document.documentElement.style.setProperty('--print-scale', scale);
		document.documentElement.style.setProperty('--print-orientation', isPortrait ? 'portrait' : 'landscape');

		// Print
		window.print();

		// Clean up: remove heading and reset properties
		setTimeout(() => {
			if (printHeading.parentNode) {
				printHeading.parentNode.removeChild(printHeading);
			}
			document.documentElement.style.setProperty('--print-scale', '1');
			document.documentElement.style.setProperty('--print-orientation', 'auto');
		}, 1000);
	}

	function printSeatingChartImpl() {
		// Create a print-optimized version of the seating chart
		const printWindow = window.open('', '_blank');
		const { state } = window.TablePlanner;

		// Filter out separators and only show actual tables, then sort alphabetically
		const actualTables = state.tables.filter(t => t.type === 'rect' || t.type === 'circle');

		// Sort tables alphabetically by label, with natural sorting for numbers
		actualTables.sort((a, b) => {
			const labelA = String(a.label);
			const labelB = String(b.label);

			// Check if both labels are numeric
			const isNumericA = !isNaN(labelA) && !isNaN(parseFloat(labelA));
			const isNumericB = !isNaN(labelB) && !isNaN(parseFloat(labelB));

			if (isNumericA && isNumericB) {
				// Sort numerically
				return parseFloat(labelA) - parseFloat(labelB);
			} else {
				// Sort alphabetically (case-insensitive)
				return labelA.toLowerCase().localeCompare(labelB.toLowerCase());
			}
		});

		if (actualTables.length === 0) {
			alert(window.i18n.t('seatingChartNoTables'));
			return;
		}

		// Create HTML for print with explicit page breaks
		let printHTML = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>${window.i18n.t('viewToggleBtn')} - ${new Date().toLocaleDateString()}</title>
				<style>
					@page {
						size: A4;
						margin: 0.5cm;
					}
					
					* {
						box-sizing: border-box;
					}
					
					body {
						font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
						margin: 0;
						padding: 0;
						background: white;
						color: black;
						font-size: 12px;
						line-height: 1.2;
					}
					
					.page {
						width: 100%;
						page-break-after: always;
						page-break-inside: avoid;
						padding: 10px;
						overflow: visible;
					}
					
					.page:last-child {
						page-break-after: avoid;
					}
					
					.page-header {
						text-align: center;
						margin-bottom: 15px;
						padding-bottom: 8px;
						border-bottom: 2px solid #333;
						flex-shrink: 0;
					}
					
					.page-header h1 {
						margin: 0;
						font-size: 18px;
						color: #333;
					}
					
					.page-header .page-number {
						margin-top: 3px;
						font-size: 12px;
						color: #666;
					}
					
					.tables-container {
						column-count: 3;
						column-gap: 10px;
						column-fill: balance;
					}
					
					.table-card {
						background: white;
						border: 2px solid #333;
						border-radius: 6px;
						padding: 8px;
						box-shadow: 0 1px 3px rgba(0,0,0,0.1);
						display: block;
						height: auto;
						width: 100%;
						break-inside: avoid;
						margin-bottom: 10px;
					}
					
					.table-card.round {
						border-left: 3px solid #28a745;
					}
					
					.table-card.rect {
						border-left: 3px solid #007bff;
					}
					
					.table-header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 6px;
						padding-bottom: 4px;
						border-bottom: 1px solid #ccc;
						flex-shrink: 0;
					}
					
					.table-title {
						font-size: 12px;
						font-weight: 600;
						color: #333;
						margin: 0;
					}
					
					.table-seats {
						font-size: 9px;
						color: #666;
						background: #f8f9fa;
						padding: 2px 4px;
						border-radius: 2px;
					}
					
					.table-guests {
						display: flex;
						flex-direction: column;
						gap: 2px;
						overflow-y: visible;
					}
					
					.guest-item {
						display: flex;
						align-items: center;
						gap: 4px;
						padding: 3px;
						background: #f8f9fa;
						border-radius: 2px;
						border-left: 2px solid transparent;
						font-size: 9px;
					}
					
					.guest-item.assigned {
						background: #fff;
						border-left-color: #007bff;
					}
					
					.guest-seat {
						font-size: 8px;
						font-weight: 600;
						color: #666;
						min-width: 16px;
						text-align: center;
					}
					
					.guest-picture {
						width: 16px;
						height: 16px;
						border-radius: 50%;
						flex-shrink: 0;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 7px;
						font-weight: 600;
						color: white;
					}
					
					.guest-picture.child {
						border-radius: 0 0 50% 50%;
					}
					
					.guest-info {
						flex: 1;
						min-width: 0;
					}
					
					.guest-name {
						font-size: 8px;
						font-weight: 500;
						color: #333;
						margin: 0;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}
					
					.guest-child {
						font-size: 7px;
						color: #ff6b35;
						font-weight: 500;
						margin-top: 1px;
					}
					
					.empty-seat {
						display: flex;
						align-items: center;
						gap: 4px;
						padding: 3px;
						background: #f8f9fa;
						border-radius: 2px;
						border: 1px dashed #ccc;
						color: #6c757d;
						font-size: 8px;
					}
					
					.empty-seat-icon {
						width: 16px;
						height: 16px;
						border-radius: 50%;
						background: #e9ecef;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 8px;
						color: #6c757d;
					}
					
					.table-footer {
						margin-top: 4px;
						padding-top: 4px;
						border-top: 1px solid #e9ecef;
						font-size: 8px;
						color: #666;
						text-align: center;
						flex-shrink: 0;
					}
					
					@media print {
						body { 
							-webkit-print-color-adjust: exact; 
							print-color-adjust: exact; 
						}
						.page { 
							page-break-after: always;
							height: auto;
						}
						.page:last-child { 
							page-break-after: avoid; 
						}
						.table-card { 
							break-inside: avoid;
							page-break-inside: avoid;
						}
						.tables-container {
							page-break-inside: avoid;
						}
					}
				</style>
			</head>
			<body>
		`;

		// Group tables into pages with more flexible layout
		const tablesPerPage = 6; // Allow more tables per page for better space utilization
		const totalPages = Math.ceil(actualTables.length / tablesPerPage);

		for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
			const startIndex = pageIndex * tablesPerPage;
			const endIndex = Math.min(startIndex + tablesPerPage, actualTables.length);
			const pageTables = actualTables.slice(startIndex, endIndex);

			printHTML += `<div class="page">`;

			// Add header to each page
			printHTML += `
				<div class="page-header">
					<h1>${window.i18n.t('viewToggleBtn')}</h1>
					<div class="page-number">${window.i18n.t('pageText')} ${pageIndex + 1} of ${totalPages}</div>
				</div>
			`;

			printHTML += `<div class="tables-container">`;

			for (const table of pageTables) {
				printHTML += createPrintTableCard(table);
			}

			printHTML += `</div></div>`;
		}

		printHTML += `</body></html>`;

		printWindow.document.write(printHTML);
		printWindow.document.close();

		// Wait for content to load, then print
		printWindow.onload = () => {
			setTimeout(() => {
				printWindow.print();
				printWindow.close();
			}, 500);
		};
	}

	function createPrintTableCard(table) {
		const tableType = table.type === 'circle' ? 'round' : 'rect';
		const tableTypeLabel = table.type === 'circle' ? window.i18n.t('tableTypeRound') : window.i18n.t('tableTypeRectangle');

		let html = `
			<div class="table-card ${tableType}">
				<div class="table-header">
					<h3 class="table-title">${formatTableName(table.label)}</h3>
					<div class="table-seats">${table.seats} ${window.i18n.t('seatsLabel')} • ${tableTypeLabel}</div>
				</div>
				<div class="table-guests">
		`;

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
			if (assignment.guestId) {
				const guest = getGuestById(assignment.guestId);
				if (guest) {
					html += `
						<div class="guest-item assigned">
							<div class="guest-seat">${assignment.seatNumber}</div>
							<div class="guest-picture ${guest.isChild ? 'child' : ''}" style="background-color: ${guest.color || '#6aa9ff'}">
								${getInitials(guest.name)}
							</div>
							<div class="guest-info">
								<div class="guest-name">${guest.name}</div>
								${guest.isChild ? `<div class="guest-child">${window.i18n.t('guestChildLabel')}</div>` : ''}
							</div>
						</div>
					`;
				} else {
					html += `
						<div class="empty-seat">
							<div class="empty-seat-icon">${assignment.seatNumber}</div>
							<div>${window.i18n.t('emptySeat')}</div>
						</div>
					`;
				}
			} else {
				html += `
					<div class="empty-seat">
						<div class="empty-seat-icon">${assignment.seatNumber}</div>
						<div>${window.i18n.t('emptySeat')}</div>
					</div>
				`;
			}
		}

		const assignedCount = seatAssignments.filter(a => a.guestId).length;
		const childCount = seatAssignments.filter(a => {
			const guest = getGuestById(a.guestId);
			return guest && guest.isChild;
		}).length;

		let summaryText = `${assignedCount}/${table.seats} ${window.i18n.t('assignedLabel')}`;
		if (childCount > 0) {
			summaryText += ` • ${childCount} ${window.i18n.t('childrenLabel')}`;
		}

		html += `
				</div>
				<div class="table-footer">${summaryText}</div>
			</div>
		`;

		return html;
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

	function formatTableName(label) {
		const labelStr = String(label);
		const isNumeric = !isNaN(labelStr) && !isNaN(parseFloat(labelStr));
		if (isNumeric) {
			return window.i18n.t('tableTitle', { label: labelStr });
		} else {
			return labelStr;
		}
	}

	function onExportGuestsCsv() {
		const rows = window.TablePlanner.state.guests.map(g => g.name.replace(/"/g, '""'));
		const csv = 'name\n' + rows.map(n => `"${n}"`).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'guests.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function onImportGuestsCsv(e) {
		const file = e.target.files && e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const text = String(reader.result);
				const lines = text.split(/\r?\n/).filter(Boolean);
				let start = 0;
				if (lines[0] && /name/i.test(lines[0])) start = 1;
				for (let i = start; i < lines.length; i++) {
					const raw = lines[i];
					const name = raw.replace(/^\s*"?|"?\s*$/g, '').replace(/""/g, '"');
					if (name) window.TablePlanner.addGuest(name, '#6aa9ff');
				}
				updateCounts();
			} catch (err) {
				alert(window.i18n.t('importGuestsFailed'));
			}
			// reset input
			e.target.value = '';
		};
		reader.readAsText(file);
	}

	async function onSelectPictureFolder() {
		try {
			// Check if File System Access API is supported
			if ('showDirectoryPicker' in window) {
				const folderHandle = await window.showDirectoryPicker();
				window.TablePlanner.setPictureFolder(folderHandle);
				updatePictureFolderStatus();
			} else {
				// Fallback for browsers that don't support File System Access API
				alert(window.i18n.t('pictureFolderNotSupported'));
			}
		} catch (error) {
			if (error.name !== 'AbortError') {
				console.error('Error selecting folder:', error);
				alert(window.i18n.t('pictureFolderSelectFailed'));
			}
		}
	}

	async function onScanPictures() {
		// Check if a folder is selected before attempting to scan
		if (!window.TablePlanner.state.pictures.folderHandle) {
			alert(window.i18n.t('pictureFolderNotSelected'));
			return;
		}

		const scanBtn = document.getElementById('scanPicturesBtn');
		const originalText = scanBtn.textContent;

		try {
			scanBtn.textContent = window.i18n.t('pictureScanning');
			scanBtn.disabled = true;

			const matchesFound = await window.TablePlanner.scanFolderForPictures();

			if (matchesFound > 0) {
				alert(window.i18n.t('pictureScanSuccess', { count: matchesFound }));
			} else {
				alert(window.i18n.t('pictureScanNoMatches'));
			}
		} catch (error) {
			console.error('Error scanning pictures:', error);
			alert(window.i18n.t('pictureScanFailed'));
		} finally {
			scanBtn.textContent = originalText;
			scanBtn.disabled = false;
		}
	}

	function updatePictureFolderStatus() {
		const statusEl = document.getElementById('pictureFolderStatus');
		const scanBtn = document.getElementById('scanPicturesBtn');
		const folderPath = window.TablePlanner.state.pictures.folderPath;

		if (folderPath) {
			statusEl.textContent = `Selected: ${folderPath}`;
			statusEl.style.display = 'block';
			scanBtn.style.display = 'inline-block';
		} else {
			statusEl.style.display = 'none';
			scanBtn.style.display = 'none';
		}
	}

	function onSidebarToggle() {
		const layout = document.querySelector('.layout');
		const isCollapsed = layout.classList.contains('sidebar-collapsed');

		if (isCollapsed) {
			layout.classList.remove('sidebar-collapsed');
			window.TablePlanner.setSidebarCollapsed(false);
		} else {
			layout.classList.add('sidebar-collapsed');
			window.TablePlanner.setSidebarCollapsed(true);
		}

		// Update legend button position when main sidebar state changes
		updateLegendButtonPosition();
	}

	function onLegendToggle() {
		const legendSidebar = document.getElementById('legendSidebar');
		const isOpen = legendSidebar.classList.contains('open');

		if (isOpen) {
			legendSidebar.classList.remove('open');
		} else {
			legendSidebar.classList.add('open');
		}

		// Update button position after toggling
		updateLegendButtonPosition();
	}

	function onViewToggle() {
		const currentMode = window.TablePlanner.state.ui.viewMode;
		const newMode = currentMode === 'canvas' ? 'seatingChart' : 'canvas';

		window.TablePlanner.setViewMode(newMode);

		// Update button text and title
		const button = document.getElementById('viewToggleBtn');
		if (newMode === 'seatingChart') {
			button.textContent = '🗺️';
			button.title = window.i18n.t('canvasViewBtn');
		} else {
			button.textContent = '📋';
			button.title = window.i18n.t('viewToggleBtn');
		}

		// Update toolbar visibility based on new view mode
		updateToolbarVisibility();

		// Re-render
		window.TablePlanner.render();
	}

	function updateLegendButtonPosition() {
		const legendToggle = document.getElementById('legendToggle');
		const legendSidebar = document.getElementById('legendSidebar');
		const layout = document.querySelector('.layout');

		if (!legendToggle || !legendSidebar) return;

		const isLegendOpen = legendSidebar.classList.contains('open');
		const isMainSidebarCollapsed = layout.classList.contains('sidebar-collapsed');

		if (isLegendOpen) {
			// When legend is open, position button above it
			const legendHeight = legendSidebar.offsetHeight;
			const appliedHeight = legendSidebar.style.height;

			// Parse the applied height to get the numeric value
			const appliedHeightValue = appliedHeight ? parseInt(appliedHeight) : legendHeight;

			// Use the applied height if available, otherwise fall back to offsetHeight
			const finalHeight = appliedHeightValue || legendHeight;
			const buttonBottom = finalHeight + 30; // 20px from bottom + 10px gap

			legendToggle.style.bottom = buttonBottom + 'px';

			// Adjust right position based on main sidebar state
			if (isMainSidebarCollapsed) {
				legendToggle.style.right = '20px';
			} else {
				legendToggle.style.right = '420px';
			}
		} else {
			// When legend is closed, use default position
			legendToggle.style.bottom = '20px';

			if (isMainSidebarCollapsed) {
				legendToggle.style.right = '20px';
			} else {
				legendToggle.style.right = '420px';
			}
		}
	}

	function initializeSidebarState() {
		const layout = document.querySelector('.layout');
		if (window.TablePlanner.state.ui.sidebarCollapsed) {
			layout.classList.add('sidebar-collapsed');
		}
	}

	function initializeViewToggleButton() {
		const button = document.getElementById('viewToggleBtn');
		const currentMode = window.TablePlanner.state.ui.viewMode;

		if (currentMode === 'seatingChart') {
			button.textContent = '🗺️';
			button.title = window.i18n.t('canvasViewBtn');
		} else {
			button.textContent = '📋';
			button.title = window.i18n.t('viewToggleBtn');
		}
	}

	function initializeImportedTableSizes() {
		// The migration logic now handles size calculation and toggle state
		// This function is kept for any additional import-specific logic if needed
		// All tables should now have proper size properties and be toggled to canvas
	}

	document.addEventListener('DOMContentLoaded', bootstrap);
})();
