// Deployment settings.
export const CONFIG = {
  // the public site; share links go through <publicUrl>s/<id> so LINE / Facebook show the share card
  publicUrl: 'https://hammerlee.tw/',
  // the claude.ai Artifact preview (share links there replay with #c-<id>)
  artifactUrl: 'https://claude.ai/artifact/1nBMLPFG1k6eSAowwYJkmN',
  // Supabase project hammerlee-tw (Tokyo). The anon key is public by design: row-level security decides what
  // it may do (add a finished chat, read one back, attach its share picture once).
  supabaseUrl: 'https://ksbsjodfubmtttklalob.supabase.co',
  gaId: 'G-0MRNRPCG0C',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzYnNqb2RmdWJtdHR0a2xhbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTEwNjYsImV4cCI6MjEwODMyNzA2Nn0.YyFQhLMJOYgnb8R73ZKPuqGDo-djvCvp9rvo3WMpP4E',
};

// Only the real site writes to the database; local testing and the Artifact preview never do.
export const onPublicSite = typeof location !== 'undefined' && !!CONFIG.publicUrl
  && location.hostname.replace(/^www\./, '') === new URL(CONFIG.publicUrl).hostname;
