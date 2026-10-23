// Deployment settings.
export const CONFIG = {
  // the public site; share links go through <publicUrl>s/<id> so LINE / Facebook show the share card
  publicUrl: 'https://hammerlee.tw/',
  // the claude.ai Artifact preview (share links there replay with #c-<id>)
  artifactUrl: 'https://claude.ai/artifact/1nBMLPFG1k6eSAowwYJkmN',
  // Supabase project hammerlee-tw (Tokyo). The anon key is public by design: it can only add a finished chat
  // (row-level security and column grants, supabase/migrations/), nothing else.
  supabaseUrl: 'https://ksbsjodfubmtttklalob.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzYnNqb2RmdWJtdHR0a2xhbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTEwNjYsImV4cCI6MjEwODMyNzA2Nn0.YyFQhLMJOYgnb8R73ZKPuqGDo-djvCvp9rvo3WMpP4E',
  // Google Analytics 4 (src/share/analytics.js), only on the public site and only if the visitor allows it
  gaId: 'G-0MRNRPCG0C',
  // who made and paid for this (a supporter's own fan project, not the campaign's), shown small on the page and every picture
  credit: '粉絲創作・dAAAb 個人出資製作',
};

// Only the real site writes to the database; local testing and the Artifact preview never do.
export const onPublicSite = typeof location !== 'undefined' && !!CONFIG.publicUrl
  && location.hostname.replace(/^www\./, '') === new URL(CONFIG.publicUrl).hostname;
