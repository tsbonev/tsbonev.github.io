(function () {
	const translations = {
		en: {
			// Page title
			'pageTitle': 'Table Planner',
			// Toolbar
			'addCircleTableBtn': 'Add Circular Table',
			'addRectTableBtn': 'Add Rectangular Table',
			'addSeparatorBtn': 'Add Separator',
			'snapToggle': 'Snap',
			'gridSizeInput': 'Grid',
			'showGridToggle': 'Show Grid',
			'undoBtn': 'Undo',
			'redoBtn': 'Redo',
			'exportBtn': 'Export Plan',
			'importBtn': 'Import Plan',
			'printSeatingChartBtn': 'Print Seating Chart',
			'printBtn': 'Print Page',
			'viewToggleBtn': 'Seating Chart',
			'canvasViewBtn': 'Canvas View',
			'recenterBtn': 'Re-center Canvas',

			// Seating Chart
			'seatingChartNoTables': 'No tables to display',
			'tableTypeRound': 'Round',
			'tableTypeRectangle': 'Rectangle',
			'seatsLabel': 'seats',
			'emptySeat': 'Empty seat',
			'assignedLabel': 'assigned',
			'childrenLabel': 'children',
			'colorLabel': 'Color:',

			// Sidebar
			'guestsTitle': 'Guests',
			'legendTitle': 'Color Legend',
			'toggleLegend': 'Toggle Color Legend',
			'exportGuestsCsvBtn': 'Export Guests CSV',
			'importGuestsCsvBtn': 'Import Guests CSV',
			'selectPictureFolderBtn': 'Select Picture Folder',
			'scanPicturesBtn': 'Scan for Pictures',
			'guestNameInput': 'Guest name',
			'guestChildLabel': 'Child',
			'guestFormSubmit': 'Add',
			'guestSortLabel': 'Sort:',
			'guestSortUnassignedFirst': 'Unassigned first',
			'guestSortAssignedFirst': 'Assigned first',
			'guestSortName': 'Name A–Z',
			'guestSortColor': 'Color',
			'guestSortChildFirst': 'Children first',
			'guestSortTableSeat': 'Table & Seat',
			'guestUnassignedOnly': 'Unassigned only',
			'guestSearchInput': 'Search guests...',
			'selectedInfo': 'Selected:',
			'tableControlsTitle': 'Selected Table',
			'tableGuestsTitle': 'Table Guests',
			'seatCountLabel': 'Seats:',
			'applySeatCountBtn': 'Apply',
			'oneSidedToggle': 'One-sided (rect only)',
			'seatSideLabel': 'Seat side:',
			'oddExtraSeatLabel': 'Odd extra seat to:',
			'sideTop': 'Top',
			'sideRight': 'Right',
			'sideBottom': 'Bottom',
			'sideLeft': 'Left',

			// Counts
			'tableCount': 'Tables: {count}',
			'seatCount': 'Seats: {count}',
			'guestCounts': 'Total: {total} | Assigned: {assigned} | Unassigned: {unassigned}',

			// Seat assignment popover
			'searchGuests': 'Search guests...',
			'assignBtn': 'Assign',
			'unassignBtn': 'Unassign',

			// Messages
			'deleteTableConfirm': 'Delete table "{label}" with {count} assigned guests?',
			'deleteGuestConfirm': 'Delete this guest and unassign from any seat?',
			'deleteMultipleTablesConfirm': 'Delete {count} selected table(s) with assigned guests?',
			'reduceSeatsConfirm': 'Reducing seats to {seats} will unassign {count} guest(s). Continue?',
			'importFailed': 'Import failed: {error}',
			'importFailedInvalidJson': 'Import failed: invalid JSON',
			'importGuestsFailed': 'Import guests failed: invalid CSV',
			'pictureFolderNotSupported': 'Your browser does not support folder selection. Please use Chrome or Edge for this feature.',
			'pictureFolderSelectFailed': 'Failed to select folder. Please try again.',
			'pictureFolderNotSelected': 'Please select a picture folder first.',
			'pictureScanning': 'Scanning...',
			'pictureScanSuccess': 'Found and assigned {count} picture(s) to guests.',
			'pictureScanNoMatches': 'No matching pictures found. Make sure PNG files have names that match guest names (case-insensitive, spaces/dashes normalized).',
			'pictureScanFailed': 'Failed to scan pictures. Please try again.',
			'pictureRemoveConfirm': 'Remove picture for {name}?',

			// Seat and status text
			'seat': 'Seat',
			'unassigned': 'Unassigned',
			'table': 'Table',
			'tableTitle': 'Table {label}',
			'separatorTitle': 'Separator',
			'seatNumber': 'Seat {number}',
			'toggleSidebar': 'Toggle Sidebar',
			'unitMeter': 'm',
			'tableSizeLabel': 'Size:',
			'tableSizeWidth': 'Width:',
			'tableSizeHeight': 'Height:',
			'tieSizeToCanvasBtn': '📏 Tie to Canvas',
			'tieSizeToCanvasBtnActive': '📏 Tied to Canvas',
			'pixelsPerMeterLabel': 'Pixels per meter:',
			'pageText': 'Page',
			'canvasViewTitle': 'Table Layout'
		},
		bg: {
			// Page title
			'pageTitle': 'Планиране на маси',
			// Toolbar
			'addCircleTableBtn': 'Добави Кръгла Маса',
			'addRectTableBtn': 'Добави Правоъгълна Маса',
			'addSeparatorBtn': 'Добави Разделител',
			'snapToggle': 'Прилепване',
			'gridSizeInput': 'Мрежа',
			'showGridToggle': 'Покажи Мрежа',
			'undoBtn': 'Отмени',
			'redoBtn': 'Повтори',
			'exportBtn': 'Експорт План',
			'importBtn': 'Импорт План',
			'printSeatingChartBtn': 'Печат Схема на Местата',
			'printBtn': 'Печат Схема на Масите',
			'viewToggleBtn': 'Схема на Местата',
			'canvasViewBtn': 'Изглед на Канваса',
			'recenterBtn': 'Центрирай Канваса',

			// Seating Chart
			'seatingChartNoTables': 'Няма маси за показване',
			'tableTypeRound': 'Кръгла',
			'tableTypeRectangle': 'Правоъгълна',
			'seatsLabel': 'места',
			'emptySeat': 'Празно място',
			'assignedLabel': 'разпределени',
			'childrenLabel': 'деца',
			'colorLabel': 'Цвят:',

			// Sidebar
			'guestsTitle': 'Гости',
			'legendTitle': 'Легенда Цветове',
			'toggleLegend': 'Превключи Легенда Цветове',
			'exportGuestsCsvBtn': 'Експорт Гости CSV',
			'importGuestsCsvBtn': 'Импорт Гости CSV',
			'selectPictureFolderBtn': 'Избери Папка със Снимки',
			'scanPicturesBtn': 'Сканирай за Снимки',
			'guestNameInput': 'Име на гост',
			'guestChildLabel': 'Дете',
			'guestFormSubmit': 'Добави',
			'guestSortLabel': 'Сортиране:',
			'guestSortUnassignedFirst': 'Неразпределени първи',
			'guestSortAssignedFirst': 'Разпределени първи',
			'guestSortName': 'Име А–Я',
			'guestSortColor': 'Цвят',
			'guestSortChildFirst': 'Деца първи',
			'guestSortTableSeat': 'Маса и Място',
			'guestUnassignedOnly': 'Само неразпределени',
			'guestSearchInput': 'Търси гости...',
			'selectedInfo': 'Избрано:',
			'tableControlsTitle': 'Избрана Маса',
			'tableGuestsTitle': 'Гости на Масата',
			'seatCountLabel': 'Места:',
			'applySeatCountBtn': 'Приложи',
			'oneSidedToggle': 'Едностранна (само правоъгълник)',
			'seatSideLabel': 'Страна за места:',
			'oddExtraSeatLabel': 'Нечетно допълнително място към:',
			'sideTop': 'Горе',
			'sideRight': 'Дясно',
			'sideBottom': 'Долу',
			'sideLeft': 'Ляво',

			// Counts
			'tableCount': 'Маси: {count}',
			'seatCount': 'Места: {count}',
			'guestCounts': 'Общо: {total} | Разпределени: {assigned} | Неразпределени: {unassigned}',

			// Seat assignment popover
			'searchGuests': 'Търси гости...',
			'assignBtn': 'Разпредели',
			'unassignBtn': 'Премахни',

			// Messages
			'deleteTableConfirm': 'Изтрий маса "{label}" с {count} разпределени гости?',
			'deleteGuestConfirm': 'Изтрий този гост и премахни от всяко място?',
			'deleteMultipleTablesConfirm': 'Изтрий {count} избрани маси с разпределени гости?',
			'reduceSeatsConfirm': 'Намаляването на местата до {seats} ще премахне {count} гост(а). Продължи?',
			'importFailed': 'Импорт неуспешен: {error}',
			'importFailedInvalidJson': 'Импорт неуспешен: невалиден JSON',
			'importGuestsFailed': 'Импорт на гости неуспешен: невалиден CSV',
			'pictureFolderNotSupported': 'Вашият браузър не поддържа избор на папка. Моля използвайте Chrome или Edge за тази функция.',
			'pictureFolderSelectFailed': 'Неуспешен избор на папка. Моля опитайте отново.',
			'pictureFolderNotSelected': 'Моля първо изберете папка със снимки.',
			'pictureScanning': 'Сканиране...',
			'pictureScanSuccess': 'Намерени и присвоени {count} снимка(и) на гости.',
			'pictureScanNoMatches': 'Не са намерени съответстващи снимки. Уверете се, че PNG файловете имат имена, които съответстват на имената на гостите (без значение на регистъра, интервалите/тиретата се нормализират).',
			'pictureScanFailed': 'Неуспешно сканиране на снимки. Моля опитайте отново.',
			'pictureRemoveConfirm': 'Премахни снимката за {name}?',

			// Seat and status text
			'seat': 'Място',
			'unassigned': 'Неразпределен',
			'table': 'Маса',
			'tableTitle': 'Маса {label}',
			'separatorTitle': 'Разделител',
			'seatNumber': 'Място {number}',
			'toggleSidebar': 'Превключи Страничната Лента',
			'unitMeter': 'м',
			'tableSizeLabel': 'Размер:',
			'tableSizeWidth': 'Ширина:',
			'tableSizeHeight': 'Височина:',
			'tieSizeToCanvasBtn': '📏 Свържи с Canvas',
			'tieSizeToCanvasBtnActive': '📏 Свързано с Canvas',
			'pixelsPerMeterLabel': 'Пиксели на метър:',
			'pageText': 'Страница',
			'canvasViewTitle': 'Схема на масите'
		}
	};

	function t(key, params = {}) {
		const lang = window.TablePlanner?.state?.ui?.language || 'en';
		let text = translations[lang]?.[key] || translations.en[key] || key;

		// Simple parameter replacement
		for (const [param, value] of Object.entries(params)) {
			text = text.replace(new RegExp(`{${param}}`, 'g'), value);
		}

		return text;
	}

	function updateUI() {
		const lang = window.TablePlanner?.state?.ui?.language || 'en';

		// Update page title
		const titleEl = document.querySelector('title[data-i18n]');
		if (titleEl) {
			const key = titleEl.getAttribute('data-i18n');
			document.title = t(key);
		}

		// Update all elements with data-i18n attributes
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			if (el.tagName === 'INPUT' && el.type === 'submit') {
				el.value = t(key);
			} else if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) {
				el.placeholder = t(key);
			} else if (el.tagName !== 'TITLE') { // Skip title as it's handled above
				el.textContent = t(key);
			}
		});

		// Update elements with data-i18n-attr attributes
		document.querySelectorAll('[data-i18n-attr]').forEach(el => {
			const [attr, key] = el.getAttribute('data-i18n-attr').split(':');
			el.setAttribute(attr, t(key));
		});

		// Update counts and dynamic content
		if (window.updateCounts) window.updateCounts();
	}

	window.i18n = { t, updateUI };
})();
