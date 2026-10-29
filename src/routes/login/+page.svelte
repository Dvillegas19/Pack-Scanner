<script>
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let loading = false;
  let errorMessage = '';
  let showPassword = false;

  async function handleLogin() {
    loading = true;
    errorMessage = '';
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      errorMessage = 'Usuario o contraseña incorrectos.';
      loading = false;
    } else {
      goto('/');
    }
  }
</script>

<div class="login-container">
  <div class="card login-card">
    <div class="logo-area">
        <img src="/logo1.jpg" alt="Logo Pesa Pack" />
    </div>
    <h2>Pack Scanner</h2>
    <p class="subtitle">Acceso Auxiliar de Almacén</p>
    
    <form on:submit|preventDefault={handleLogin}>
      <div class="input-group">
        <label for="email">Usuario (Email)</label>
        <input 
            type="email" 
            id="email" 
            bind:value={email} 
            placeholder="auxiliar@empresa.com" 
            required 
        />
      </div>
      
      <div class="input-group">
        <label for="password">Contraseña</label>
        <div class="password-wrapper">
          {#if showPassword}
            <input 
                type="text" 
                id="password" 
                bind:value={password} 
                placeholder="••••••••" 
                required 
            />
          {:else}
            <input 
                type="password" 
                id="password" 
                bind:value={password} 
                placeholder="••••••••" 
                required 
            />
          {/if}
          <button 
            type="button" 
            class="btn-toggle-password"
            on:click={() => showPassword = !showPassword}
            title={showPassword ? 'Ocultar' : 'Mostrar'}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </div>
      
      {#if errorMessage}
        <div class="error-msg">{errorMessage}</div>
      {/if}

      <button type="submit" disabled={loading} class="btn-login">
        {loading ? 'Validando...' : 'Iniciar Sesión'}
      </button>
    </form>
  </div>
</div>

<style>
  :global(body) { margin: 0; font-family: -apple-system, sans-serif; background-color: #f0f2f5; }
  
  .login-container {
    display: flex; justify-content: center; align-items: center;
    height: 100vh; padding: 1rem; box-sizing: border-box;
  }
  
  .login-card {
    background: white; width: 100%; max-width: 400px;
    padding: 2.5rem; border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center;
  }
  
  .logo-area img { height: 60px; margin-bottom: 1rem; }
  h2 { margin: 0; color: #0076a3; }
  .subtitle { color: #666; margin-bottom: 2rem; font-size: 0.95rem; }
  
  .input-group { text-align: left; margin-bottom: 1.2rem; }
  label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }
  
  .password-wrapper {
    display: flex;
    align-items: center;
    position: relative;
  }
  
  .password-wrapper input {
    flex: 1;
    padding-right: 2.5rem;
  }
  
  input {
    width: 100%; padding: 0.8rem; border: 1px solid #ccc;
    border-radius: 6px; font-size: 1rem; box-sizing: border-box;
  }
  input:focus { border-color: #0076a3; outline: none; }
  
  .btn-toggle-password {
    position: absolute;
    right: 0.8rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.3rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .btn-toggle-password:hover {
    opacity: 0.7;
  }
  
  .error-msg { color: #d32f2f; background: #ffebee; padding: 0.8rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.9rem; }
  
  .btn-login {
    width: 100%; padding: 0.9rem; background-color: #0076a3;
    color: white; border: none; border-radius: 6px;
    font-size: 1.1rem; cursor: pointer; font-weight: 600;
    transition: background 0.2s;
  }
  .btn-login:hover { background-color: #005f85; }
  .btn-login:disabled { background-color: #ccc; cursor: not-allowed; }
</style>