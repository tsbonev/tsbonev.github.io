(function(){
	const translations = {
		en: {
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
			
			// Sidebar
			'guestsTitle': 'Guests',
			'exportGuestsCsvBtn': 'Export Guests CSV',
			'importGuestsCsvBtn': 'Import Guests CSV',
			'guestNameInput': 'Guest name',
			'guestFormSubmit': 'Add',
			'guestSortLabel': 'Sort:',
			'guestSortUnassignedFirst': 'Unassigned first',
			'guestSortAssignedFirst': 'Assigned first',
			'guestSortName': 'Name A–Z',
			'guestUnassignedOnly': 'Unassigned only',
			'selectedInfo': 'Selected:',
			'tableControlsTitle': 'Selected Table',
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
			'importGuestsFailed': 'Import guests failed: invalid CSV'
		},
		bg: {
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
			
			// Sidebar
			'guestsTitle': 'Гости',
			'exportGuestsCsvBtn': 'Експорт Гости CSV',
			'importGuestsCsvBtn': 'Импорт Гости CSV',
			'guestNameInput': 'Име на гост',
			'guestFormSubmit': 'Добави',
			'guestSortLabel': 'Сортиране:',
			'guestSortUnassignedFirst': 'Неразпределени първи',
			'guestSortAssignedFirst': 'Разпределени първи',
			'guestSortName': 'Име А–Я',
			'guestUnassignedOnly': 'Само неразпределени',
			'selectedInfo': 'Избрано:',
			'tableControlsTitle': 'Избрана Маса',
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
			'importGuestsFailed': 'Импорт на гости неуспешен: невалиден CSV'
		}
	};

	function t(key, params = {}){
		const lang = window.TablePlanner?.state?.ui?.language || 'en';
		let text = translations[lang]?.[key] || translations.en[key] || key;
		
		// Simple parameter replacement
		for(const [param, value] of Object.entries(params)){
			text = text.replace(new RegExp(`{${param}}`, 'g'), value);
		}
		
		return text;
	}

	function updateUI(){
		const lang = window.TablePlanner?.state?.ui?.language || 'en';
		
		// Update all elements with data-i18n attributes
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			if(el.tagName === 'INPUT' && el.type === 'submit'){
				el.value = t(key);
			} else if(el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')){
				el.placeholder = t(key);
			} else {
				el.textContent = t(key);
			}
		});

		// Update elements with data-i18n-attr attributes
		document.querySelectorAll('[data-i18n-attr]').forEach(el => {
			const [attr, key] = el.getAttribute('data-i18n-attr').split(':');
			el.setAttribute(attr, t(key));
		});

		// Update counts and dynamic content
		if(window.updateCounts) window.updateCounts();
	}

	window.i18n = { t, updateUI };
})();
