<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  let operarios = [];
  let ordenes = [];
  let consumibles = [];
  let solicitudes = [];
  let loading = true;

  let selectedOperario = '';
  let selectedOrden = '';
  let selectedFecha = new Date().toISOString().split('T')[0];
  

  let tipoFiltro = 'fecha'; 
  let filtroValor = '';     

  let items = [{ consumible_id: '', cantidad_requerida: 1 }];

  let consumibleSearchTerm = '';
  $: filteredConsumibles = getFilteredConsumibles(consumibleSearchTerm, consumibles);
  
  let editingId = null; 
  let showConfirmModal = false;

  onMount(async () => {
    loading = true;
    await Promise.all([
      fetchOperarios(),
      fetchOrdenes(),
      fetchConsumibles(),
      fetchSolicitudes(),
    ]);
    loading = false;
  });

  async function fetchOperarios() {
    const { data, error } = await supabase.from('usuario').select('id, nombre, estado');
    if (error) console.error(error);
    else operarios = data;
  }

  async function fetchSolicitudes() {
    const { data, error } = await supabase
      .from('solicitud_consumible')
      .select('codigo_solicitud, orden_id, fecha_entrega, operario_id, usuario ( nombre )');
    if (error) {
      console.error(error);
    } else {
      solicitudes = data.map((solicitud) => ({
        codigo: solicitud.codigo_solicitud,
        orden_id: solicitud.orden_id,
        operario: solicitud.usuario.nombre,
        operario_id: solicitud.operario_id,
        fecha: solicitud.fecha_entrega,
        expanded: false,
        loadingDetails: false,
        details: []
      }));
    }
  }

  async function fetchOrdenes() {
    const { data, error } = await supabase
      .from('orden_produccion')
      .select('codigo_orden, fecha_emision, estado');
    if (error) console.error(error);
    else ordenes = data;
  }

  async function fetchConsumibles() {
    const { data, error } = await supabase
      .from('consumible')
      .select('codigo_barra, nombre');
    if (error) console.error(error);
    else consumibles = data;
  }

  function addItem() {
    items = [...items, { consumible_id: '', cantidad_requerida: 1 }];
  }

  function removeItem(index) {
    items = items.filter((_, i) => i !== index);
  }
  
  function resetForm() {
    selectedOperario = '';
    selectedOrden = '';
    selectedFecha = new Date().toISOString().split('T')[0];
    items = [{ consumible_id: '', cantidad_requerida: 1 }];
    editingId = null;
    consumibleSearchTerm = ''; 
    showConfirmModal = false;
  }

  function openConfirmation() {
    if (!selectedOperario || !selectedOrden || items.length === 0) {
      alert('Por favor complete todos los campos de la solicitud.');
      return;
    }

    const validItems = items.filter(item => item.consumible_id && item.cantidad_requerida > 0);
    if (validItems.length === 0) {
      alert('Debe añadir al menos un consumible válido.');
      return;
    }

    showConfirmModal = true;
  }

  async function confirmAndSubmit() {
    const especificacionItems = items
      .filter(item => item.consumible_id && item.cantidad_requerida > 0)
      .map(item => ({
        consumible_id: item.consumible_id,
        cantidad_requerida: item.cantidad_requerida,
      }));

    if (editingId) {
      const { error: updateError } = await supabase
        .from('solicitud_consumible')
        .update({
          orden_id: selectedOrden,
          operario_id: selectedOperario,
          fecha_entrega: selectedFecha,
        })
        .eq('codigo_solicitud', editingId);

      if (updateError) {
        console.error(updateError);
        alert('Error al actualizar.');
        return;
      }

      const { error: deleteError } = await supabase
        .from('especificacion')
        .delete()
        .eq('solicitud_id', editingId);
        
      if (deleteError) console.error(deleteError);
      
      const { error: insertError } = await supabase
        .from('especificacion')
        .insert(especificacionItems.map(item => ({
          ...item,
          solicitud_id: editingId
        })));
        
      if (insertError) {
        console.error(insertError);
        alert('Error al actualizar los consumibles.');
        return;
      }
      
      alert('¡Solicitud ACTUALIZADA con éxito!');

    } else {
      const { data: solicitudData, error: solicitudError } = await supabase
        .from('solicitud_consumible')
        .insert({
          orden_id: selectedOrden,
          operario_id: selectedOperario,
          fecha_entrega: selectedFecha,
        })
        .select('codigo_solicitud')
        .single();

      if (solicitudError) {
        console.error(solicitudError);
        alert('Error creando la solicitud.');
        return;
      }

      const nuevaSolicitudId = solicitudData.codigo_solicitud;

      const { error: especificacionError } = await supabase
        .from('especificacion')
        .insert(especificacionItems.map(item => ({
          ...item,
          solicitud_id: nuevaSolicitudId
        })));

      if (especificacionError) {
        console.error(especificacionError);
        alert('Error guardando los consumibles de la solicitud.');
        return;
      }

      alert('¡Solicitud REGISTRADA con éxito!');
    }

    resetForm();
    await fetchSolicitudes();
  }
  
  async function handleEdit(solicitud) {
    editingId = solicitud.codigo;
    selectedOperario = solicitud.operario_id;
    selectedOrden = solicitud.orden_id;
    selectedFecha = solicitud.fecha;
    
    if (solicitud.expanded) {
      solicitud.expanded = false;
    }
    
    const { data, error } = await supabase
      .from('especificacion')
      .select('consumible_id, cantidad_requerida')
      .eq('solicitud_id', solicitud.codigo);
      
    if (error) {
      alert('Error al cargar los items para editar.');
      items = [{ consumible_id: '', cantidad_requerida: 1 }];
    } else {
      items = data.length > 0 ? data : [{ consumible_id: '', cantidad_requerida: 1 }];
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  function cancelEdit() {
    resetForm();
  }

  async function handleFilter() {
    if (!filtroValor) {
      alert('Por favor seleccione un valor para filtrar.');
      return;
    }
    loading = true;
    
    let query = supabase
      .from('solicitud_consumible')
      .select('codigo_solicitud, orden_id, fecha_entrega, operario_id, usuario ( nombre )');

    if (tipoFiltro === 'fecha') {
      query = query.eq('fecha_entrega', filtroValor);
    } else {
      query = query.eq('orden_id', filtroValor);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
    } else {
      solicitudes = data.map((solicitud) => ({
        codigo: solicitud.codigo_solicitud,
        orden_id: solicitud.orden_id,
        operario: solicitud.usuario.nombre,
        operario_id: solicitud.operario_id,
        fecha: solicitud.fecha_entrega,
        expanded: false,
        loadingDetails: false,
        details: []
      }));
    }
    loading = false;
  }

  async function clearFilter() {
    filtroValor = '';
    loading = true;
    await fetchSolicitudes();
    loading = false;
  }
  
  function getFilteredConsumibles(searchTerm, list) {
    if (!searchTerm) {
      return list;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return list.filter(c => 
      c.nombre.toLowerCase().includes(lowerSearch) || 
      c.codigo_barra.toString().includes(searchTerm)
    );
  }
  
  async function toggleDetalles(clickedSolicitud) {
    if (editingId) return;
    
    clickedSolicitud.expanded = !clickedSolicitud.expanded;

    if (clickedSolicitud.expanded && clickedSolicitud.details.length === 0) {
      clickedSolicitud.loadingDetails = true;
      const { data, error } = await supabase
        .from('especificacion')
        .select(`cantidad_requerida, consumible ( nombre, codigo_barra )`)
        .eq('solicitud_id', clickedSolicitud.codigo);

      if (error) {
        console.error(error);
        clickedSolicitud.expanded = false;
      } else {
        clickedSolicitud.details = data;
      }
      clickedSolicitud.loadingDetails = false;
    }
    solicitudes = [...solicitudes];
  }

  function getOperarioName(id) {
    const op = operarios.find(o => o.id == id);
    return op ? op.nombre : id;
  }
  function getConsumibleName(codigo) {
    const cons = consumibles.find(c => c.codigo_barra == codigo);
    return cons ? cons.nombre : codigo;
  }
</script>


<header>
  <div class="logo">
    <img src="/logo1.jpg" alt="Logo de PESA PACK">
  </div>
  <h1>Pack Scanner</h1>
  <div class="spacer" />
</header>

<main>
  <section class="card form-section">
    <h2>{editingId ? `Editando Solicitud #${editingId}` : 'Crear Nueva Solicitud'}</h2>

    <form on:submit|preventDefault={openConfirmation}>
      <div class="form-grid">
        <div>
          <label for="operario">Operario que solicita</label>
          <select id="operario" bind:value={selectedOperario} required>
            <option value="" disabled>Seleccione un operario...</option>
            {#each operarios as op}
              <option value={op.id}>
                {op.nombre} (ID: {op.id}) {op.estado ? `- ${op.estado}` : ''}
              </option>
            {/each}
          </select>
        </div>

        <div>
          <label for="orden">Orden de Producción</label>
          <select id="orden" bind:value={selectedOrden} required>
            <option value="" disabled>Seleccione una orden...</option>
            {#each ordenes as orden}
              <option value={orden.codigo_orden}>
                {orden.codigo_orden} {orden.estado ? `(${orden.estado})` : ''}
              </option>
            {/each}
          </select>
        </div>

        <div>
          <label for="fecha_entrega">Fecha de Entrega Requerida</label>
          <input type="date" id="fecha_entrega" bind:value={selectedFecha} required />
        </div>
      </div>

      <fieldset class="consumibles-list">
        <legend>Consumibles Requeridos</legend>
        
        <input 
          type="search" 
          class="consumible-search" 
          placeholder="Buscar consumible por nombre o código..."
          bind:value={consumibleSearchTerm}
        />

        {#each items as item, index (index)}
          <div class="consumible-item">
            <select bind:value={item.consumible_id} required>
              <option value="" disabled>Seleccione un consumible...</option>
              {#each filteredConsumibles as cons}
                <option value={cons.codigo_barra}>{cons.nombre} (Cód: {cons.codigo_barra})</option>
              {/each}
              {#if filteredConsumibles.length === 0 && consumibleSearchTerm}
                <option disabled>No se encontraron consumibles</option>
              {/if}
            </select>
            
            <input
              type="number"
              bind:value={item.cantidad_requerida}
              placeholder="Cant."
              min="1"
              required
            />
            
            <button type="button" class="btn-remove" on:click={() => removeItem(index)}>
              ×
            </button>
          </div>
        {/each}

        <button type="button" class="btn-add" on:click={addItem}>
          + Añadir Consumible
        </button>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn-submit">
          {editingId ? 'Revisar y Actualizar' : 'Revisar y Enviar'}
        </button>
        
        {#if editingId}
          <button type="button" class="btn-cancel" on:click={cancelEdit}>
            Cancelar Edición
          </button>
        {/if}
      </div>
    </form>
  </section>

  <section class="card table-section">
    <h2>Historial de Solicitudes</h2>

    <div class="filter-bar">
      <div class="filter-group">
        <label for="tipoFiltro">Buscar por:</label>
        <select id="tipoFiltro" bind:value={tipoFiltro} on:change={() => filtroValor = ''}>
          <option value="fecha">Fecha de Entrega</option>
          <option value="orden">Orden de Producción</option>
        </select>
      </div>

      <div class="filter-input-wrapper">
        {#if tipoFiltro === 'fecha'}
          <input type="date" bind:value={filtroValor} />
        {:else}
          <select bind:value={filtroValor}>
            <option value="" disabled selected>Seleccione una orden...</option>
            {#each ordenes as orden}
              <option value={orden.codigo_orden}>
                {orden.codigo_orden} {orden.estado ? `(${orden.estado})` : ''}
              </option>
            {/each}
          </select>
        {/if}
      </div>

      <div class="filter-buttons">
        <button type="button" class="btn-filter" on:click={handleFilter}>
          Filtrar
        </button>
        <button type="button" class="btn-clear" on:click={clearFilter}>
          Limpiar
        </button>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Cód. Solicitud</th>
          <th>Orden Producción</th>
          <th>Operario</th>
          <th>Fecha Entrega</th>
          <th>Acciones</th>
        </tr>
      </thead>
      
      {#if loading}
        <tbody>
          <tr><td colspan="5">Cargando datos desde Supabase...</td></tr>
        </tbody>
      {:else}
        {#each solicitudes as solicitud (solicitud.codigo)}
          <tbody class="solicitud-group">
            <tr>
              <td>{solicitud.codigo}</td>
              <td>{solicitud.orden_id}</td>
              <td>{solicitud.operario}</td>
              <td>{solicitud.fecha}</td>
              
              <td class="action-buttons">
                <button 
                  type="button" 
                  class="btn-details" 
                  on:click={() => toggleDetalles(solicitud)}
                  disabled={editingId}
                >
                  {solicitud.expanded ? 'Ocultar' : 'Ver Detalles'}
                </button>
                <button 
                  type="button" 
                  class="btn-edit" 
                  on:click={() => handleEdit(solicitud)}
                  disabled={editingId === solicitud.codigo}
                >
                  Editar
                </button>
              </td>
            </tr>

            {#if solicitud.expanded}
              <tr class="detalle-row">
                <td colspan="5">
                  <div class="detalle-contenido">
                    {#if solicitud.loadingDetails}
                      <p>Cargando detalles...</p>
                    {:else if solicitud.details.length === 0}
                      <p>Esta solicitud no tiene consumibles registrados.</p>
                    {:else}
                      <h5>Consumibles Solicitados:</h5>
                      <ul class="detalle-lista">
                        {#each solicitud.details as item}
                          <li>
                            <span class="item-nombre">{item.consumible.nombre} (Cód: {item.consumible.codigo_barra})</span>
                            <span class="item-cantidad">Cantidad: {item.cantidad_requerida}</span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        {/each}
      {/if}
    </table>
  </section>

  {#if showConfirmModal}
    <div class="modal-backdrop">
      <div class="modal-content">
        <h3>Confirmación de Solicitud</h3>
        <p>Por favor, verifique los datos antes de guardar.</p>
        
        <div class="confirm-details">
          <p><strong>Operario:</strong> {getOperarioName(selectedOperario)}</p>
          <p><strong>Orden:</strong> {selectedOrden}</p>
          <p><strong>Fecha Entrega:</strong> {selectedFecha}</p>
        </div>

        <h4>Items Solicitados:</h4>
        <ul class="confirm-items-list">
          {#each items as item}
            {#if item.consumible_id && item.cantidad_requerida > 0}
              <li>
                <span>{getConsumibleName(item.consumible_id)}</span>
                <strong>x{item.cantidad_requerida}</strong>
              </li>
            {/if}
          {/each}
        </ul>

        <div class="modal-actions">
          <button class="btn-cancel" on:click={() => showConfirmModal = false}>Volver</button>
          <button class="btn-submit" on:click={confirmAndSubmit}>Confirmar y Guardar</button>
        </div>
      </div>
    </div>
  {/if}
</main>
<style>
    :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
        Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f0f2f5;
    color: #333;
    margin: 0;
    line-height: 1.6;
    }

    main {
    max-width: 1400px;
    margin: 2rem auto;
    padding: 0 1rem;
    }

    .card {
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    padding: 1.5rem 2rem;
    margin-bottom: 2rem;
    }

    h1, h2, h3, h4 { font-weight: 600; color: #343a40; }
    h3 { margin-top: 0; }

    header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #0076a3;
    color: white;
    padding: 0.8rem 2rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    header h1 {
    margin: 0;
    font-size: 1.5rem;
    text-align: center;
    flex-grow: 1;
    color: white;
    }
    .logo {
    flex-basis: 200px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    }
    .logo img {
    height: 40px;
    width: auto;
    display: block;
    }
    .spacer {
    flex-basis: 200px;
    }

    .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    }

    label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: #555;
    }

    input[type='number'],
    input[type='date'],
    input[type='search'],
    select {
    width: 100%;
    padding: 0.75rem;
    font-size: 1rem;
    border: 1px solid #ced4da;
    border-radius: 6px;
    box-sizing: border-box; 
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    input:focus, select:focus {
    border-color: #3498db;
    outline: 0;
    box-shadow: 0 0 0 0.2rem rgba(52, 152, 219, 0.25);
    }

    .consumible-search {
    margin-bottom: 1.5rem;
    }

    .consumibles-list {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 1rem;
    margin-top: 2rem;
    }
    .consumibles-list legend {
    font-weight: 600;
    padding: 0 0.5rem;
    color: #343a40;
    }
    .consumible-item {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
    }
    .consumible-item select {
    flex-grow: 1;
    }
    .consumible-item input {
    flex-basis: 100px;
    }

    button {
    font-size: 1rem;
    padding: 0.7rem 1.2rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap; 
    }
    button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    }

    .btn-remove {
    background-color: #dc3545;
    color: white;
    font-size: 1.2rem;
    padding: 0.5rem 0.9rem;
    }
    .btn-remove:hover { background-color: #c82333; }

    .btn-add {
    background-color: #27ae60;
    color: white;
    }
    .btn-add:hover { background-color: #219150; }

    .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap; 
    }

    .btn-submit {
    background-color: #0076a3; 
    color: white;
    font-size: 1.1rem;
    padding: 0.8rem 1.5rem;
    flex-grow: 1; 
    }
    .btn-submit:hover { background-color: #005f82; } 

    .btn-cancel {
    background-color: #7f8c8d;
    color: white;
    }
    .btn-cancel:hover { background-color: #5a6268; }

    .filter-bar {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background-color: #ecf0f1;
    border-radius: 6px;
    flex-wrap: wrap; 
    }
    .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    }
    .filter-input-wrapper {
    flex-grow: 1;
    }
    .filter-buttons {
    display: flex;
    gap: 0.5rem;
    }

    .btn-filter {
    background-color: #7f8c8d;
    color: white;
    }
    .btn-filter:hover { background-color: #626f70; }
    .btn-clear {
    background-color: #e67e22; 
    color: white;
    }
    .btn-clear:hover { background-color: #d35400; }

    table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    }
    th, td {
    padding: 0.9rem 1rem;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
    }
    thead { background-color: #f8f9fa; }
    th {
    font-weight: 600;
    font-size: 0.9rem;
    color: #555;
    }
    .solicitud-group tr:first-child:hover {
    background-color: #f1f1f1;
    }
    td[colspan='5'] {
    text-align: center;
    color: #777;
    font-style: italic;
    }

    .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap; 
    }
    .btn-details {
    background: none;
    border: 1px solid #3498db;
    color: #3498db;
    font-size: 0.9rem;
    padding: 0.4rem 0.8rem;
    }
    .btn-details:hover {
    background-color: #3498db;
    color: white;
    }

    .btn-edit {
    background: none;
    border: 1px solid #e67e22;
    color: #e67e22;
    font-size: 0.9rem;
    padding: 0.4rem 0.8rem;
    }
    .btn-edit:hover {
    background-color: #e67e22;
    color: white;
    }

    .detalle-row td {
    background-color: #fdfdfd;
    padding: 0; 
    }
    .detalle-contenido {
    padding: 1rem 1.5rem 1.5rem 2.5rem;
    }
    .detalle-contenido h5 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #343a40;
    }
    .detalle-contenido p {
    margin: 0;
    color: #555;
    }
    .detalle-lista {
    list-style: none;
    padding-left: 0;
    margin: 0;
    }
    .detalle-lista li {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;
    }
    .detalle-lista li:last-child {
    border-bottom: none;
    }
    .item-nombre { font-weight: 500; }
    .item-cantidad { color: #333; }
    .solicitud-group:last-child tr:last-child td {
    border-bottom: 1px solid #e0e0e0;
    }

    .modal-backdrop {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 1rem;
    }
    .modal-content {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    max-height: 90vh;
    overflow-y: auto;
    }
    .confirm-details {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    }
    .confirm-details p { margin: 0.5rem 0; }
    .confirm-items-list {
    list-style: none;
    padding: 0;
    border-top: 1px solid #eee;
    }
    .confirm-items-list li {
    display: flex;
    justify-content: space-between;
    padding: 0.8rem 0;
    border-bottom: 1px solid #eee;
    }
    .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    }

    @media (max-width: 768px) {
    header {
        flex-direction: column;
        align-items: flex-start;
        padding: 0.8rem 1rem;
    }
    header h1 {
        font-size: 1.3rem;
        margin-top: 0.5rem;
        text-align: left;
        flex-grow: 0;
    }
    .logo, .spacer {
        flex-basis: auto;
        width: 100%;
        justify-content: flex-start;
    }
    .logo img { height: 35px; }
    .spacer { display: none; }

    main { margin: 1rem auto; padding: 0 0.5rem; }
    .card { padding: 1rem; }
    .form-grid { grid-template-columns: 1fr; gap: 1rem; }

    .consumible-item {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 6px;
    }
    .consumible-item select, .consumible-item input {
        width: 100%; 
        flex-basis: auto;
        margin-bottom: 0.5rem;
    }
    .consumible-item button { width: 100%; }

    .filter-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.8rem;
        padding: 0.8rem;
    }
    .filter-bar input, .filter-bar button, .filter-bar select { width: 100%; }
    .filter-buttons { width: 100%; justify-content: space-between; }
    .filter-buttons button { width: 48%; }

    table, thead, tbody, th, td, tr { display: block; }
    thead tr { position: absolute; top: -9999px; left: -9999px; }
    tr { border: 1px solid #dee2e6; margin-bottom: 0.75rem; border-radius: 6px; }
    td {
        border: none;
        position: relative;
        padding-left: 50%;
        text-align: right;
        border-bottom: 1px dashed #dee2e6;
    }
    td:last-child { border-bottom: none; }
    td:before {
        position: absolute;
        top: 0.9rem;
        left: 1rem;
        width: 45%;
        padding-right: 10px;
        white-space: nowrap;
        text-align: left;
        font-weight: 600;
        color: #495057;
    }
    td:nth-of-type(1):before { content: "Cód. Solicitud:"; }
    td:nth-of-type(2):before { content: "Orden Producción:"; }
    td:nth-of-type(3):before { content: "Operario:"; }
    td:nth-of-type(4):before { content: "Fecha Entrega:"; }
    td:nth-of-type(5):before { content: "Acciones:"; }

    .action-buttons { flex-direction: column; align-items: stretch; }
    .action-buttons button { width: 100%; margin-top: 0.5rem; }
    .detalle-contenido { padding: 0.8rem 1rem 1rem 1rem; }
    .detalle-lista li { flex-direction: column; align-items: flex-start; }
    .item-cantidad { margin-top: 0.2rem; font-size: 0.9rem; }

    .modal-actions { flex-direction: column-reverse; }
    .modal-actions button { width: 100%; }
    }
</style>

