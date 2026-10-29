<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores'; 
  import { supabase } from '$lib/supabaseClient';

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && $page.url.pathname !== '/login') {
      goto('/login');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && $page.url.pathname !== '/login') {
        goto('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  });
</script>

<slot />