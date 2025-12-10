import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://awbvivjfpqkfrdzpbber.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YnZpdmpmcHFrZnJkenBiYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzM3OTcsImV4cCI6MjA3ODY0OTc5N30.kBzqeoRyJH1Pq0pDeYkioKdmqdAAlmkpmnPE_IuOP9I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false 
  }
});