import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables or use defaults
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://izaioowtbzcghkerrpmk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YWlvb3d0YnpjZ2hrZXJycG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODc1MDUsImV4cCI6MjA4NjI2MzUwNX0.y2DeJBoqkSXc7_Jx3dcenPrFKBHv_iH3yT_8uFRb5Dw';

console.log('🔧 Supabase Config:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey?.substring(0, 20) + '...',
  envUrl: import.meta.env.VITE_SUPABASE_URL,
  envKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
});

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We handle auth separately
  },
});

// Storage bucket name for reports
export const REPORTS_BUCKET = 'merchandiser-reports';

// Storage bucket name for avatars
export const AVATARS_BUCKET = 'avatars';

/**
 * Get public URL for an avatar from the 'avatars' bucket.
 * Accepts a full Supabase storage URL or just a filename / relative path.
 */
export const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return null;

  let filePath = avatarPath.trim().replace(/\?$/, '');

  console.log('🔍 getAvatarUrl input:', filePath);

  // If it's a full Supabase storage URL, extract just the file path after any bucket name
  const storagePrefix = '/storage/v1/object/public/';
  const idx = filePath.indexOf(storagePrefix);
  if (idx !== -1) {
    const afterPrefix = filePath.substring(idx + storagePrefix.length);
    // afterPrefix = "bucketName/path/to/file.jpg"
    // Remove the bucket name (first segment) to get just the file path
    const slashIdx = afterPrefix.indexOf('/');
    if (slashIdx !== -1) {
      filePath = afterPrefix.substring(slashIdx + 1);
    } else {
      // The whole thing is just a filename in the root of a bucket
      filePath = afterPrefix;
    }
  } else if (filePath.startsWith('http')) {
    // Non-Supabase URL (e.g. Django media URL) — extract just the filename
    try {
      const url = new URL(filePath);
      const segments = url.pathname.split('/').filter(Boolean);
      filePath = segments[segments.length - 1];
    } catch {
      // Not a valid URL, use as-is
    }
  }

  console.log('🔍 getAvatarUrl resolved filePath:', filePath);

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  console.log('🔍 getAvatarUrl output:', data?.publicUrl);
  return data?.publicUrl || null;
};
