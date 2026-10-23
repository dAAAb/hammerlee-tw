-- One row per finished conversation. The id IS the conversation (decodable back into every message), the
-- serial is the short number printed on the 新北事民 badge. Both are unique, so no two people can ever hold
-- the same conversation or the same badge number.
create table if not exists public.chats (
  id          text primary key check (id ~ '^[0-9A-F]{8,80}$'),
  serial      text not null unique check (serial ~ '^[0-9A-F]{4}(-[0-9A-F]{4}){3}$'),
  topics      text[] not null default '{}',
  script      int not null default 1,
  og_image    text,
  finished_at timestamptz not null default now()
);

create index if not exists chats_finished_at_idx on public.chats (finished_at desc);

alter table public.chats enable row level security;

-- Anyone may add their own finished chat (the page has no login) and read one back by id for link previews.
-- Through the public key nothing can be deleted, and the only change allowed is attaching the share picture once.
create policy "insert finished chats" on public.chats for insert to anon with check (true);
create policy "read chats" on public.chats for select to anon using (true);
-- the share picture can be attached once, after the chat was saved
create policy "attach share picture once" on public.chats for update to anon using (og_image is null) with check (og_image like '%/storage/v1/object/public/og/og/%');
revoke update on public.chats from anon;
grant update (og_image) on public.chats to anon;

-- A running count for the page ("你是第 N 位跟川伯聊天的新北事民"), without exposing the table size math to clients.
create or replace function public.chat_count() returns bigint
language sql stable security definer set search_path = public as $$ select count(*) from public.chats $$;
grant execute on function public.chat_count() to anon;

-- Share pictures for link previews: a public bucket (files are fetched by their public URL, nobody can list
-- them), anyone may upload a new file, nobody may overwrite one. PNG only, at most 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('og', 'og', true, 2097152, array['image/png']) on conflict (id) do nothing;
create policy "upload share pictures" on storage.objects for insert to anon
  with check (bucket_id = 'og' and name ~ '^og/[0-9A-F-]{19}\.png$');
