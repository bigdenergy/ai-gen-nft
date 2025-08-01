// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

console.log('Loading supabase.ts...');

const supabaseUrl = "https://rawdmabohbqdyanyezbd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhd2RtYWJvaGJxZHlhbnllemJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDA1MjIsImV4cCI6MjA2OTYxNjUyMn0.pqysisPxKTmoecasBot5VIqVda3zl8XOKJOyZAKV4XY";

export const supabase = createClient(
  supabaseUrl as string ?? "",
  supabaseKey as string ?? ""
  );
  
  console.log('Supabase client initialized');