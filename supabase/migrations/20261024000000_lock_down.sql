-- Lock-down after the pre-launch security review (2026-10-24). Link previews no longer use uploaded pictures:
-- api/share.js works out the badge number and topics from the id itself. So the public key only needs to add
-- finished chats; it can no longer read rows, change them, or upload anything.

drop policy if exists "attach share picture once" on public.chats;
drop policy if exists "read chats" on public.chats;
revoke all on public.chats from anon, authenticated;
grant insert (id, serial, topics, script) on public.chats to anon;
alter table public.chats
  add constraint chats_topics_len check (cardinality(topics) <= 16),
  add constraint chats_script_range check (script between 1 and 9);

-- the running count was never used by the page
revoke execute on function public.chat_count() from anon, authenticated, public;

-- share pictures: no more uploads, and the bucket stops serving the old ones
drop policy if exists "upload share pictures" on storage.objects;
update storage.buckets set public = false where id = 'og';
