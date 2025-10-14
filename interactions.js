(function(){
	let drag = null;
	let resize = null;
	let popover = null;

	function intersects(a, b){
		if(a.type==='circle' && b.type==='circle'){
			const dx = a.x - b.x, dy = a.y - b.y;
			const dist = Math.hypot(dx, dy);
			return dist < (a.radius + b.radius);
		}
		// approximate with bounding boxes for mixed/rect/separator
		const ar = (a.type==='rect' || a.type==='separator') ? { x:a.x-a.width/2, y:a.y-a.height/2, w:a.width, h:a.height } : { x:a.x-a.radius, y:a.y-a.radius, w:a.radius*2, h:a.radius*2 };
		const br = (b.type==='rect' || b.type==='separator') ? { x:b.x-b.width/2, y:b.y-b.height/2, w:b.width, h:b.height } : { x:b.x-b.radius, y:b.y-b.radius, w:b.radius*2, h:b.radius*2 };
		return !(ar.x+ar.w < br.x || br.x+br.w < ar.x || ar.y+ar.h < br.y || br.y+br.h < ar.y);
	}

	function clearOverlapHighlights(){
		for(const el of document.querySelectorAll('.table.overlap, .separator.overlap')) el.classList.remove('overlap');
	}
	function updateOverlapHighlights(activeId){
		clearOverlapHighlights();
		const s = window.TablePlanner.state;
		const active = s.tables.find(t=>t.id===activeId);
		if(!active) return;
		for(const t of s.tables){
			if(t.id===activeId) continue;
			if(intersects(active, t)){
				const a = document.querySelector(`.table[data-id="${activeId}"], .separator[data-id="${activeId}"]`);
				const b = document.querySelector(`.table[data-id="${t.id}"], .separator[data-id="${t.id}"]`);
				if(a) a.classList.add('overlap');
				if(b) b.classList.add('overlap');
			}
		}
	}

	function hasAssignments(t){
		if(!t || !t.assignments) return false;
		for(const k in t.assignments){ if(t.assignments[k]) return true; }
		return false;
	}

	function clampPosition(t, x, y){
		// Don't clamp position - allow tables to move anywhere
		// The canvas will expand dynamically to accommodate them
		return { x, y };
	}


	function onCanvasMouseDown(e){
		const target = e.target;
		// If clicking into the editable label, allow text editing and do not start select/drag
		if(target.closest && target.closest('[data-role="table-label"]')){
			return; // let contentEditable handle focus and selection
		}
		const tableNode = target.closest && (target.closest('.table') || target.closest('.separator'));
		const handle = target.closest && (target.closest('.handle-e') || target.closest('.handle-s'));
		const seatNode = target.closest && target.closest('.seat');

		if(handle){
			const id = handle.dataset.id;
			const dir = handle.dataset.dir;
			const t = getTable(id);
			if(!t) return;
			
		// Debug: Log which table we're starting to resize
		if(t.type === 'circle' || t.type === 'rect' || t.type === 'separator') {
			console.log('Starting resize on table:', t.id, 'type:', t.type, 'dir:', dir);
		}
			
			closePopover();
			// Push initial state for resize history consolidation
			window.TablePlanner.pushHistory();
			resize = { id, dir, startX: e.clientX, startY: e.clientY, startRadius: t.radius, startW: t.width, startH: t.height };
			document.addEventListener('mousemove', onResizeMove);
			document.addEventListener('mouseup', onResizeUp);
			e.preventDefault();
			return;
		}

		if(seatNode){
			openSeatPopover(seatNode, e.clientX, e.clientY);
			e.preventDefault();
			return;
		}

		if(tableNode){
			const id = tableNode.dataset.id;
			const t = getTable(id);
			if(!t) return;
			window.TablePlanner.selectTable(id);
			closePopover();
			// start grouped history for drag
			window.TablePlanner.beginHistoryGroup();
			drag = { id, offsetX: e.clientX - t.x, offsetY: e.clientY - t.y };
			document.addEventListener('mousemove', onDragMove);
			document.addEventListener('mouseup', onDragUp);
			e.preventDefault();
			return;
		}

		window.TablePlanner.selectTable(null);
		closePopover();
	}

	function onKeyDown(e){
		if(e.key === 'Delete'){
			const sel = window.TablePlanner.state.ui.selectedTableId;
			if(sel){
				const t = getTable(sel);
				if(hasAssignments(t)){
					const ok = window.confirm(window.i18n.t('deleteTableConfirm', { label: t.label, count: Object.keys(t.assignments || {}).length }));
					if(!ok) return;
				}
				window.TablePlanner.removeTable(sel);
			}
			return;
		}
		const sel = window.TablePlanner.state.ui.selectedTableId;
		if(!sel) return;
		const t = getTable(sel);
		if(!t) return;
		const step = e.shiftKey ? 10 : 1;
		let dx = 0, dy = 0;
		if(e.key === 'ArrowLeft') dx = -step;
		else if(e.key === 'ArrowRight') dx = step;
		else if(e.key === 'ArrowUp') dy = -step;
		else if(e.key === 'ArrowDown') dy = step;
		else return;
		e.preventDefault();
		const ui = window.TablePlanner.state.ui;
		let nx = t.x + dx;
		let ny = t.y + dy;
		if(ui.snap){
			const g = ui.grid || 12;
			nx = Math.round(nx / g) * g;
			ny = Math.round(ny / g) * g;
		}
		const clamped = clampPosition(t, nx, ny);
		window.TablePlanner.updateTablePosition(sel, clamped.x, clamped.y);
		window.TablePlanner.render();
	}

	function onDragMove(e){
		if(!drag) return;
		let x = e.clientX - drag.offsetX;
		let y = e.clientY - drag.offsetY;
		const ui = window.TablePlanner.state.ui;
		if(ui.snap){ const g = ui.grid || 12; x = Math.round(x / g) * g; y = Math.round(y / g) * g; }
		const t = getTable(drag.id);
		const clamped = clampPosition(t, x, y);
		window.TablePlanner.updateTablePosition(drag.id, clamped.x, clamped.y);
		window.TablePlanner.render();
		// Don't show overlap highlights during drag - only when drag is complete
	}
	function onDragUp(){
		document.removeEventListener('mousemove', onDragMove);
		document.removeEventListener('mouseup', onDragUp);
		window.TablePlanner.endHistoryGroup();
		// Check for overlaps after drag is complete
		if(drag) {
			updateOverlapHighlights(drag.id);
		}
		drag = null;
	}

	function onResizeMove(e){
		if(!resize) return;
		const t = getTable(resize.id);
		if(!t) return;
		
		// Debug: Ensure we're working with the correct table
		if(t.type === 'circle' || t.type === 'rect' || t.type === 'separator') {
			console.log('Resizing table:', t.id, 'type:', t.type, 'current size:', t.width || t.radius);
		}
		
		if(t.type === 'circle' && resize.dir === 'e'){
			const dx = e.clientX - resize.startX;
			const newRadius = (resize.startRadius || t.radius) + dx;
			window.TablePlanner.updateTableRadius(resize.id, newRadius);
		}else if(t.type === 'rect' || t.type === 'separator'){
			let w = resize.startW || t.width;
			let h = resize.startH || t.height;
			if(resize.dir === 'e'){
				const dx = e.clientX - resize.startX;
				w = (resize.startW || t.width) + dx;
			}else if(resize.dir === 's'){
				const dy = e.clientY - resize.startY;
				h = (resize.startH || t.height) + dy;
			}
			window.TablePlanner.updateTableSize(resize.id, w, h);
		}
		// Use requestAnimationFrame to prevent excessive re-rendering
		if(!resize._renderScheduled) {
			resize._renderScheduled = true;
			requestAnimationFrame(() => {
				window.TablePlanner.render();
				resize._renderScheduled = false;
			});
		}
	}
	function onResizeUp(){
		document.removeEventListener('mousemove', onResizeMove);
		document.removeEventListener('mouseup', onResizeUp);
		resize = null;
	}

	function openSeatPopover(seatNode, clientX, clientY){
		closePopover();
		const tableId = seatNode.dataset.tableId;
		const index = Number(seatNode.dataset.index);
		const state = window.TablePlanner.state;
		const table = state.tables.find(t=>t.id===tableId);
		const currentGuestId = table && table.assignments ? table.assignments[String(index)] : undefined;

		const assignedSet = new Set();
		for(const t of state.tables){
			for(const k in (t.assignments||{})){
				const gid = t.assignments[k];
				if(gid) assignedSet.add(gid);
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

		function rebuildOptions(filter){
			select.innerHTML = '';
			const base = document.createElement('option'); base.value=''; base.textContent='-- ' + window.i18n.t('assignBtn') + ' --'; select.appendChild(base);
			for(const g of state.guests){
				if(filter && !g.name.toLowerCase().includes(filter.toLowerCase())) continue;
				const isAssigned = assignedSet.has(g.id);
				const isCurrent = currentGuestId && g.id === currentGuestId;
				if(isAssigned && !isCurrent) continue;
				const opt = document.createElement('option');
				opt.value = g.id;
				opt.textContent = g.name;
				if(isCurrent) opt.selected = true;
				select.appendChild(opt);
			}
		}
		rebuildOptions('');
		search.addEventListener('input', ()=> rebuildOptions(search.value));

		row1.appendChild(select);

		select.addEventListener('change', ()=>{
			const gid = select.value;
			if(gid){ window.TablePlanner.assignGuestToSeat(tableId, index, gid); }
			closePopover();
		});

		const row2 = document.createElement('div');
		row2.className = 'row';
		const unBtn = document.createElement('button');
		unBtn.textContent = window.i18n.t('unassignBtn');
		unBtn.disabled = !currentGuestId;
		unBtn.addEventListener('click', ()=>{
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
		setTimeout(()=>{
			document.addEventListener('mousedown', onDocClickClose, { once: true });
		}, 0);
	}

	function positionPopover(pop, clientX, clientY){
		const pad = 8;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const rect = pop.getBoundingClientRect();
		let x = clientX + 8;
		let y = clientY + 8;
		if(x + rect.width + pad > vw) x = vw - rect.width - pad;
		if(y + rect.height + pad > vh) y = vh - rect.height - pad;
		pop.style.left = x + 'px';
		pop.style.top = y + 'px';
	}

	function onDocClickClose(e){
		if(popover && !popover.contains(e.target)){
			closePopover();
		}
	}

	function closePopover(){
		if(popover){
			popover.remove();
			popover = null;
		}
	}

	function getTable(id){
		return window.TablePlanner.state.tables.find(t=>t.id===id);
	}

	let interactionsBound = false;
	
	function bindInteractions(){
		if(interactionsBound) return; // Only bind once
		const canvas = document.getElementById('canvas');
		canvas.addEventListener('mousedown', onCanvasMouseDown);
		document.addEventListener('keydown', onKeyDown);
		interactionsBound = true;
	}

	window.TablePlanner = Object.assign(window.TablePlanner || {}, { bindInteractions });
})();
