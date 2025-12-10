<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

  let operarios = [];
  let ordenes = [];
  let consumibles = [];
  let solicitudes = [];
  let loading = false;
  let hasSearched = false;

  let selectedOperario = '';
  let selectedOrden = '';
  let selectedFecha = new Date().toISOString().split('T')[0];
  
  let tipoFiltro = 'fecha';
  let filtroValor = '';

  let items = [{
    consumible_id: '',
    cantidad_requerida: 1,
    searchText: '',
    showSuggestions: false
  }];

  let editingId = null;
  let showConfirmModal = false;

  let showScanner = false;
  let html5QrCode; 
  let selectedSolicitudes = []; 

  let showPasswordModal = false;
  let newPassword = '';
  let confirmPassword = '';
  let passwordLoading = false;
  let showNewPassword = false;
  let showConfirmPasswordField = false;
  let passwordError = '';
  
  // Regex para validar contraseña: mayúscula, minúscula, número, 8-24 caracteres
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,24}$/;

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = '/login';

    await Promise.all([
      fetchOperarios(),
      fetchOrdenes(),
      fetchConsumibles(),
    ]);
  });

  async function fetchOperarios() {
    const { data, error } = await supabase.from('usuario').select('id, nombre, estado');
    if (error) console.error(error); else operarios = data;
  }

  async function fetchOrdenes() {
    const { data, error } = await supabase.from('orden_produccion').select('codigo_orden, fecha_emision, estado');
    if (error) console.error(error); else ordenes = data;
  }

  async function fetchConsumibles() {
    const { data, error } = await supabase.from('consumible').select('codigo_barra, nombre, bodega');
    if (error) console.error(error); else consumibles = data;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleChangePassword() {
    passwordError = '';
    
    // Validar que los campos no estén vacíos
    if (!newPassword || !confirmPassword) {
      passwordError = 'Por favor completa todos los campos.';
      return;
    }

    // Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      passwordError = 'Las contraseñas no coinciden.';
      return;
    }

    // Validar el formato de la contraseña
    if (!passwordRegex.test(newPassword)) {
      passwordError = 'La contraseña debe contener: mayúscula, minúscula, número y tener entre 8 y 24 caracteres.';
      return;
    }

    passwordLoading = true;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    passwordLoading = false;

    if (error) { 
      passwordError = 'Error: ' + error.message;
    } else { 
      alert("¡Contraseña actualizada!"); 
      showPasswordModal = false; 
      newPassword = ''; 
      confirmPassword = '';
      passwordError = '';
    }
  }

  function startScanner() {
    showScanner = true;
    setTimeout(() => {
        const formatsToSupport = [ Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.CODE_39 ];
        html5QrCode = new Html5Qrcode("reader", { verbose: false, formatsToSupport: formatsToSupport });
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 100 }, aspectRatio: 1.0 }, onScanSuccess, (errorMessage) => { })
        .catch(err => { alert("Error cámara: " + err); showScanner = false; });
    }, 100);
  }

  function stopScanner() {
    if (html5QrCode) { html5QrCode.stop().then(() => { html5QrCode.clear(); showScanner = false; }).catch(err => console.error(err)); } 
    else { showScanner = false; }
  }

  function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    const consumibleEncontrado = consumibles.find(c => c.codigo_barra.toString() === decodedText);
    
    if (consumibleEncontrado) {
        // Validación Anti-Duplicados en Escáner
        const yaExiste = items.some(i => i.consumible_id === consumibleEncontrado.codigo_barra);
        
        if (yaExiste) {
            alert(`⚠️ El ítem "${consumibleEncontrado.nombre}" YA ESTÁ en la lista.\n\nPor favor, aumente la cantidad manualmente.`);
            return;
        }

        const confirmar = confirm(`Item Encontrado:\n📦 ${consumibleEncontrado.nombre}\n📍 ${consumibleEncontrado.bodega || 'Central'}\n\n¿Agregar?`);
        if (confirmar) {
            const lastIdx = items.length - 1;
            if (items[lastIdx].consumible_id === '') { selectSuggestion(lastIdx, consumibleEncontrado); } 
            else {
                items = [...items, { consumible_id: consumibleEncontrado.codigo_barra, cantidad_requerida: 1, searchText: `${consumibleEncontrado.nombre} (Cód: ${consumibleEncontrado.codigo_barra})`, showSuggestions: false }];
            }
        }
    } else { alert(`Código ${decodedText} no encontrado.`); }
  }

  function addItem() { items = [...items, { consumible_id: '', cantidad_requerida: 1, searchText: '', showSuggestions: false }]; }
  function removeItem(index) { items = items.filter((_, i) => i !== index); }

  function getSuggestions(searchText) {
    if (!searchText) return [];
    const lower = searchText.toLowerCase();
    return consumibles.filter(c => 
      c.nombre.toLowerCase().includes(lower) || 
      c.codigo_barra.toString().toLowerCase().includes(lower)
    );
  }

  function selectSuggestion(index, consumible) {
    // --- LÓGICA ANTI-DUPLICADOS (TU PEDIDO) ---
    const yaExiste = items.some((item, i) => i !== index && item.consumible_id === consumible.codigo_barra);

    if (yaExiste) {
        alert(`⚠️ ATENCIÓN:\nEl ítem "${consumible.nombre}" ya está en la lista.\n\nPor favor, busque la fila existente y aumente la cantidad.`);
        
        // Limpiamos el intento actual para no dejar el duplicado
        items[index].searchText = '';
        items[index].consumible_id = '';
        items[index].showSuggestions = false;
        return; 
    }
    // ------------------------------------------

    items[index].consumible_id = consumible.codigo_barra;
    items[index].searchText = `${consumible.nombre} (Cód: ${consumible.codigo_barra})`;
    items[index].showSuggestions = false;
    items = items;
  }

  function handleSearchInput(index) { items[index].consumible_id = ''; items[index].showSuggestions = true; items = items; }
  function handleBlur(index) { setTimeout(() => { if (items[index]) items[index].showSuggestions = false; }, 200); }

  function resetForm() {
    selectedOperario = ''; selectedOrden = ''; selectedFecha = new Date().toISOString().split('T')[0];
    items = [{ consumible_id: '', cantidad_requerida: 1, searchText: '', showSuggestions: false }];
    editingId = null; showConfirmModal = false;
  }

  function openConfirmation() {
    if (!selectedOperario || !selectedOrden || items.length === 0) { alert('Complete los campos.'); return; }
    const validItems = items.filter(item => item.consumible_id && item.cantidad_requerida > 0);
    if (validItems.length === 0) { alert('Seleccione al menos un consumible.'); return; }
    showConfirmModal = true;
  }

  async function confirmAndSubmit() {
    const especificacionItems = items.filter(i => i.consumible_id && i.cantidad_requerida > 0)
      .map(i => ({ consumible_id: i.consumible_id, cantidad_requerida: i.cantidad_requerida }));

    if (editingId) {
      const { error: uErr } = await supabase.from('solicitud_consumible').update({ orden_id: selectedOrden, operario_id: selectedOperario, fecha_entrega: selectedFecha }).eq('codigo_solicitud', editingId);
      if (uErr) { alert('Error actualizando.'); return; }
      await supabase.from('especificacion').delete().eq('solicitud_id', editingId);
      const { error: iErr } = await supabase.from('especificacion').insert(especificacionItems.map(i => ({ ...i, solicitud_id: editingId })));
      if (iErr) alert('Error items.'); else alert('¡Solicitud ACTUALIZADA!');
    } else {
      const { data: sData, error: sErr } = await supabase.from('solicitud_consumible').insert({ orden_id: selectedOrden, operario_id: selectedOperario, fecha_entrega: selectedFecha }).select('codigo_solicitud').single();
      if (sErr) { alert('Error creando.'); return; }
      const { error: eErr } = await supabase.from('especificacion').insert(especificacionItems.map(i => ({ ...i, solicitud_id: sData.codigo_solicitud })));
      if (eErr) alert('Error items.'); else alert('¡Solicitud REGISTRADA!');
    }
    resetForm(); solicitudes = []; hasSearched = false;
  }
  
  async function handleEdit(solicitud) {
    editingId = solicitud.codigo; selectedOperario = solicitud.operario_id; selectedOrden = solicitud.orden_id; selectedFecha = solicitud.fecha;
    if (solicitud.expanded) solicitud.expanded = false;
    const { data, error } = await supabase.from('especificacion').select('consumible_id, cantidad_requerida').eq('solicitud_id', solicitud.codigo);
    if (!error && data) {
      items = data.map(d => ({ consumible_id: d.consumible_id, cantidad_requerida: d.cantidad_requerida, searchText: getConsumibleName(d.consumible_id) + ` (Cód: ${d.consumible_id})`, showSuggestions: false }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  function cancelEdit() { resetForm(); }

  async function handleFilter() {
    if (!filtroValor) { alert('Seleccione un valor.'); return; }
    loading = true; hasSearched = true; selectedSolicitudes = [];
    let query = supabase.from('solicitud_consumible').select('codigo_solicitud, orden_id, fecha_entrega, operario_id, usuario ( nombre )');
    if (tipoFiltro === 'fecha') query = query.eq('fecha_entrega', filtroValor); else query = query.eq('orden_id', filtroValor);
    const { data, error } = await query;
    if (error) console.error(error);
    else solicitudes = data.map(s => ({ codigo: s.codigo_solicitud, orden_id: s.orden_id, operario: s.usuario.nombre, operario_id: s.operario_id, fecha: s.fecha_entrega, expanded: false, loadingDetails: false, details: [], selected: false }));
    loading = false;
  }

  function clearFilter() { filtroValor = ''; solicitudes = []; hasSearched = false; selectedSolicitudes = []; }
  
  async function toggleDetalles(clickedSolicitud) {
    if (editingId) return;
    clickedSolicitud.expanded = !clickedSolicitud.expanded;
    if (clickedSolicitud.expanded && clickedSolicitud.details.length === 0) {
      clickedSolicitud.loadingDetails = true;
      const { data, error } = await supabase.from('especificacion').select(`cantidad_requerida, consumible ( nombre, codigo_barra )`).eq('solicitud_id', clickedSolicitud.codigo);
      if (!error) clickedSolicitud.details = data; else clickedSolicitud.expanded = false;
      clickedSolicitud.loadingDetails = false;
    }
    solicitudes = [...solicitudes];
  }

  async function generateAndDownloadFile(dataList, filename) {
    let content = "REPORTE DE SOLICITUDES - PACK SCANNER\n=====================================\n\n";
    for (const sol of dataList) {
        content += `SOLICITUD #${sol.codigo}\nOrden Prod: ${sol.orden_id}\nOperario: ${sol.operario}\nFecha: ${sol.fecha}\n--- Ítems ---\n`;
        let itemsToPrint = sol.details || [];
        if (itemsToPrint.length === 0) {
            const { data } = await supabase.from('especificacion').select(`cantidad_requerida, consumible ( nombre, codigo_barra )`).eq('solicitud_id', sol.codigo);
            itemsToPrint = data || [];
        }
        itemsToPrint.forEach(d => { content += `  [${d.consumible.codigo_barra}] ${d.consumible.nombre} ... Cant: ${d.cantidad_requerida}\n`; });
        content += "\n-------------------------------------\n\n";
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  async function handleDownloadSelected() {
    const selected = solicitudes.filter(s => s.selected);
    if (selected.length === 0) { alert("Seleccione al menos una solicitud."); return; }
    await generateAndDownloadFile(selected, `Reporte_Seleccion_${new Date().toISOString().split('T')[0]}.txt`);
  }

  async function handleDownloadToday() {
    const today = new Date().toISOString().split('T')[0];
    loading = true;
    const { data, error } = await supabase.from('solicitud_consumible').select('codigo_solicitud, orden_id, fecha_entrega, operario_id, usuario ( nombre )').eq('fecha_entrega', today);
    if (error || !data || data.length === 0) { alert("No hay solicitudes hoy."); loading = false; return; }
    const mappedData = data.map(s => ({ codigo: s.codigo_solicitud, orden_id: s.orden_id, operario: s.usuario.nombre, fecha: s.fecha_entrega, details: [] }));
    await generateAndDownloadFile(mappedData, `Reporte_Dia_${today}.txt`);
    loading = false;
  }

  function getOperarioName(id) { const op = operarios.find(o => o.id == id); return op ? op.nombre : id; }
  function getConsumibleName(codigo) { const cons = consumibles.find(c => c.codigo_barra == codigo); return cons ? cons.nombre : codigo; }
</script>

<header>
  <div class="logo-container">
    <img src="/logo1.jpg" alt="Logo" class="logo-img">
    <h1>Pack Scanner</h1>
  </div>
  <div class="user-controls">
     <button class="btn-header btn-key" on:click={() => showPasswordModal = true}>🔑 Clave</button>
     <button class="btn-header btn-out" on:click={handleLogout}>Salir</button>
  </div>
</header>

<main>
  <section class="card">
    <h2>{editingId ? `Editando Solicitud #${editingId}` : 'Crear Nueva Solicitud'}</h2>
    <form on:submit|preventDefault={openConfirmation}>
      
      <div class="form-grid">
        <div class="form-group">
          <label for="operario">Operario</label>
          <select id="operario" bind:value={selectedOperario} required>
            <option value="" disabled>Seleccione...</option>
            {#each operarios as op}
                <option value={op.id}>
                    {op.nombre} (ID: {op.id}) {op.estado ? `- ${op.estado}` : ''}
                </option>
            {/each}
          </select>
        </div>
        <div class="form-group">
          <label for="orden">Orden Producción</label>
          <select id="orden" bind:value={selectedOrden} required>
            <option value="" disabled>Seleccione...</option>
            {#each ordenes as orden}
                <option value={orden.codigo_orden}>
                    {orden.codigo_orden} {orden.estado ? `(${orden.estado})` : ''}
                </option>
            {/each}
          </select>
        </div>
        <div class="form-group">
          <label for="fecha">Fecha Entrega</label>
          <input type="date" id="fecha" bind:value={selectedFecha} required />
        </div>
      </div>

      <div class="items-section">
        <div class="items-header">
            <h3>Consumibles</h3>
            <button type="button" class="btn-scan" on:click={startScanner}>Escanear</button>
        </div>
        
        {#each items as item, index (index)}
          <div class="item-row">
            <div class="item-search">
              <input type="text" placeholder="Buscar por nombre o código..." bind:value={item.searchText} on:input={() => handleSearchInput(index)} on:blur={() => handleBlur(index)} required />
              {#if item.showSuggestions && item.searchText.length > 0}
                <ul class="suggestions">
                  {#each getSuggestions(item.searchText) as s}
                    <li on:mousedown={() => selectSuggestion(index, s)}>
                        {s.nombre} - <strong>[{s.codigo_barra}]</strong>
                        <br><small>{s.bodega || 'Central'}</small>
                    </li>
                  {:else}<li>No encontrado</li>{/each}
                </ul>
              {/if}
            </div>
            <input type="number" class="item-qty" bind:value={item.cantidad_requerida} min="1" required />
            <button type="button" class="btn-del" on:click={() => removeItem(index)}>✕</button>
          </div>
        {/each}
        <button type="button" class="btn-add" on:click={addItem}>Agregar Consumible</button>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-submit">{editingId ? 'Actualizar' : 'Registrar Solicitud'}</button>
        {#if editingId}<button type="button" class="btn-cancel" on:click={cancelEdit}>Cancelar</button>{/if}
      </div>
    </form>
  </section>

  <section class="card">
    <div class="history-header">
        <h2>Historial</h2>
        <button type="button" class="btn-secondary" on:click={handleDownloadToday}>Descargar Hoy</button>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <label>Filtrar por:</label>
        <select bind:value={tipoFiltro} on:change={() => filtroValor = ''}>
          <option value="fecha">Fecha</option>
          <option value="orden">Orden Prod.</option>
        </select>
      </div>
      <div class="filter-group grow">
        <label>Valor:</label>
        {#if tipoFiltro === 'fecha'}
          <input type="date" bind:value={filtroValor} />
        {:else}
          <select bind:value={filtroValor}>
            <option value="" disabled selected>Seleccione...</option>
            {#each ordenes as o}<option value={o.codigo_orden}>{o.codigo_orden}</option>{/each}
          </select>
        {/if}
      </div>
      <div class="filter-actions">
        <button class="btn-primary" on:click={handleFilter}>Buscar</button>
        <button class="btn-secondary" on:click={clearFilter}>Limpiar</button>
      </div>
    </div>

    {#if hasSearched && solicitudes.length > 0}
        <div class="bulk-actions">
            <button class="btn-dark" on:click={handleDownloadSelected}>💾 Descargar Seleccionados</button>
        </div>
    {/if}

    <div class="table-container">
      {#if !hasSearched}
        <p class="empty-msg">Use los filtros para buscar.</p>
      {:else if solicitudes.length === 0}
        <p class="empty-msg">No se encontraron resultados.</p>
      {:else}
        {#each solicitudes as sol (sol.codigo)}
          <div class="mobile-card">
             <div class="card-row header-row">
                <input type="checkbox" bind:checked={sol.selected} class="chk" />
                <strong>#{sol.codigo}</strong>
                <span class="date">{sol.fecha}</span>
             </div>
             <div class="card-row">
                <span>Orden: <strong>{sol.orden_id}</strong></span>
                <span>Op: {sol.operario}</span>
             </div>
             <div class="card-actions">
                <button class="btn-small" on:click={() => toggleDetalles(sol)}>{sol.expanded ? 'Ocultar' : 'Ver Items'}</button>
                <button class="btn-small edit" on:click={() => handleEdit(sol)}>Editar</button>
             </div>
             {#if sol.expanded}
               <div class="details-box">
                  {#if sol.loadingDetails}<small>Cargando...</small>
                  {:else}
                    <ul>{#each sol.details as d}<li>{d.consumible.nombre} <b>x{d.cantidad_requerida}</b></li>{/each}</ul>
                  {/if}
               </div>
             {/if}
          </div>
        {/each}
      {/if}
    </div>
  </section>

  {#if showPasswordModal}
    <div class="modal-bg">
      <div class="modal">
        <h3>Cambiar Clave</h3>
        
        <div class="form-group">
          <label for="newPassword">Nueva:</label>
          <div class="password-input-wrapper">
            {#if showNewPassword}
              <input type="text" id="newPassword" bind:value={newPassword} />
            {:else}
              <input type="password" id="newPassword" bind:value={newPassword} />
            {/if}
            <button 
              type="button" 
              class="btn-toggle-pwd"
              on:click={() => showNewPassword = !showNewPassword}
              title={showNewPassword ? 'Ocultar' : 'Mostrar'}
            >
              {showNewPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <small class="pwd-hint">Mayúscula, minúscula, número (8-24 caracteres)</small>
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirmar:</label>
          <div class="password-input-wrapper">
            {#if showConfirmPasswordField}
              <input type="text" id="confirmPassword" bind:value={confirmPassword} />
            {:else}
              <input type="password" id="confirmPassword" bind:value={confirmPassword} />
            {/if}
            <button 
              type="button" 
              class="btn-toggle-pwd"
              on:click={() => showConfirmPasswordField = !showConfirmPasswordField}
              title={showConfirmPasswordField ? 'Ocultar' : 'Mostrar'}
            >
              {showConfirmPasswordField ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        
        {#if passwordError}
          <div class="error-message">{passwordError}</div>
        {/if}
        
        <div class="modal-btns">
            <button class="btn-secondary" on:click={()=>{showPasswordModal=false; passwordError=''; newPassword=''; confirmPassword='';}}>Cancelar</button>
            <button class="btn-primary" on:click={handleChangePassword} disabled={passwordLoading}>{passwordLoading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if showConfirmModal}
    <div class="modal-bg">
      <div class="modal">
        <h3>Confirmar</h3>
        <p><strong>Operario:</strong> {getOperarioName(selectedOperario)}</p>
        <p><strong>Orden:</strong> {selectedOrden}</p>
        <ul>{#each items.filter(i=>i.consumible_id) as i}<li>{i.searchText} x{i.cantidad_requerida}</li>{/each}</ul>
        <div class="modal-btns">
            <button class="btn-secondary" on:click={()=>showConfirmModal=false}>Volver</button>
            <button class="btn-primary" on:click={confirmAndSubmit}>Confirmar</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showScanner}
    <div class="modal-bg">
        <div class="modal scanner-modal">
            <h3>Escáner</h3>
            <div id="reader"></div>
            <button class="btn-secondary full-width" on:click={stopScanner}>Cerrar</button>
        </div>
    </div>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
    background: #f4f6f8; 
    margin: 0; 
    padding-bottom: 3rem; 
    color: #333; 
    -webkit-tap-highlight-color: transparent;
  }

  button { 
    cursor: pointer; 
    border: none; 
    border-radius: 4px; 
    font-weight: 600; 
    padding: 0 1rem; 
    height: 44px; 
    font-size: 1rem; 
    transition: opacity 0.2s; 
    position: relative; 
    z-index: 2; 
  }
  button:active { opacity: 0.8; transform: scale(0.98); }
  
  input, select {
    width: 100%; 
    height: 44px; 
    padding: 0 0.8rem; 
    font-size: 16px; 
    border: 1px solid #ccc; 
    border-radius: 4px; 
    background-color: white; 
    color: #333;
    position: relative;
    z-index: 1; 
  }

  select {
    -webkit-appearance: none; 
    -moz-appearance: none; 
    appearance: none; 
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat; 
    background-position: right 1rem center; 
    background-size: 1em; 
    padding-right: 2.5rem;
    cursor: pointer;
  }

  header { background: #0076a3; color: white; padding: 0.8rem 1rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
  .logo-container { display: flex; align-items: center; gap: 0.5rem; }
  .logo-img { height: 32px; }
  header h1 { margin: 0; font-size: 1.2rem; }
  
  .user-controls { display: flex; gap: 0.5rem; }
  .btn-header { height: 36px; font-size: 0.85rem; padding: 0 0.8rem; color: white; }
  .btn-key { background: rgba(255,255,255,0.2); }
  .btn-out { background: #c0392b; }

  main { max-width: 1000px; margin: 1rem auto; padding: 0 1rem; }
  .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  h2, h3 { margin-top: 0; color: #2c3e50; }

  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .form-group label { display: block; font-size: 0.9rem; font-weight: 500; margin-bottom: 0.4rem; color: #555; }

  .items-section { background: #f9fafb; padding: 1rem; border-radius: 6px; border: 1px solid #e5e7eb; }
  .items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .btn-scan { background: #8e44ad; color: white; font-size: 0.9rem; height: 36px; }
  
  .item-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
  .item-search { flex-grow: 1; position: relative; }
  .item-qty { width: 70px; text-align: center; }
  .btn-del { width: 44px; background: #e74c3c; color: white; padding: 0; font-size: 1.2rem; }
  .btn-add { width: 100%; background: #27ae60; color: white; margin-top: 0.5rem; }

  .suggestions { position: absolute; top: 100%; width: 100%; background: white; border: 1px solid #ccc; list-style: none; padding: 0; margin: 0; z-index: 50; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .suggestions li { padding: 0.8rem; border-bottom: 1px solid #eee; cursor: pointer; }
  .suggestions li:hover { background: #f0f0f0; }

  .form-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
  .btn-submit { flex-grow: 1; background: #0076a3; color: white; font-size: 1.1rem; }
  .btn-cancel { background: #95a5a6; color: white; }

  .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
  
  .filter-bar { display: flex; flex-wrap: wrap; gap: 0.8rem; background: #f1f5f9; padding: 1rem; border-radius: 6px; align-items: flex-end; }
  .filter-group { flex: 1; min-width: 150px; }
  .filter-group.grow { flex: 2; min-width: 200px; }
  .filter-group label { display: block; font-size: 0.85rem; margin-bottom: 0.3rem; }
  
  .filter-actions { display: flex; gap: 0.5rem; }
  .btn-primary { background: #0076a3; color: white; }
  .btn-secondary { background: #64748b; color: white; }
  .btn-dark { background: #334155; color: white; width: 100%; margin-top: 1rem; }

  .table-container { margin-top: 1.5rem; }
  .mobile-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; position: relative; }
  .card-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .header-row { border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 0.8rem; }
  .chk { width: 24px; height: 24px; margin: 0; margin-right: 0.5rem; cursor: pointer; } 
  .date { color: #64748b; font-size: 0.9rem; }
  
  .card-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.8rem; }
  .btn-small { height: 32px; font-size: 0.85rem; border: 1px solid #cbd5e1; background: white; color: #475569; }
  .btn-small.edit { border-color: #f59e0b; color: #d97706; }

  .details-box { background: #f8fafc; padding: 0.8rem; margin-top: 0.8rem; border-radius: 4px; font-size: 0.9rem; border-left: 3px solid #0076a3; }
  .details-box ul { padding-left: 1.2rem; margin: 0; }

  .modal-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 1rem; }
  .modal { background: white; padding: 1.5rem; border-radius: 8px; width: 100%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
  .modal-btns { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
  .full-width { width: 100%; margin-top: 1rem; }

  .password-input-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    gap: 0.3rem;
  }

  .password-input-wrapper input {
    flex: 1;
    padding: 0.6rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 0.95rem;
  }

  .password-input-wrapper input:focus {
    border-color: #0076a3;
    outline: none;
  }

  .btn-toggle-pwd {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.3rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
  }

  .btn-toggle-pwd:hover {
    opacity: 1;
  }

  .pwd-hint {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.2rem;
  }

  .error-message {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    margin-top: 0.8rem;
  }

  @media (max-width: 768px) {
    select {
      -webkit-appearance: menulist; 
      -moz-appearance: menulist;
      appearance: menulist;
      background-image: none !important;
      padding-right: 0.8rem;
    }

    .filter-bar { flex-direction: column; align-items: stretch; }
    .filter-actions { justify-content: space-between; margin-top: 0.5rem; }
    .filter-actions button { width: 48%; }
    
    header h1 { font-size: 1rem; }
    .btn-header { font-size: 0.75rem; padding: 0 0.5rem; }
    
    .form-grid { grid-template-columns: 1fr; }
    
    button, input, select { min-height: 44px; }
  }
</style>