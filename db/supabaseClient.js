const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    console.log('✔ Connected to Supabase Cloud Database:', supabaseUrl.replace(/https?:\/\//, '').split('.')[0] + '.supabase.co');
} else {
    console.log('ℹ Supabase credentials not detected in environment. Running with local SQLite database engine.');
}

function getSupabaseClient() {
    return supabase;
}

function isSupabaseConfigured() {
    return !!supabase;
}

module.exports = {
    getSupabaseClient,
    isSupabaseConfigured
};
