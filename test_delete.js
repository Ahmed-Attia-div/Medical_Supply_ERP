import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', 'd2674181-abb8-48b4-bad7-d93da9732899');

    console.log("Delete result:", { data, error });
}
run();
