-- ═══════════════════════════════════════════════════════════════
--  Datenbank-Struktur der Tattoo-Terminbuchung
--  Postgres 14+ / Supabase
-- ═══════════════════════════════════════════════════════════════
--
--  Die Seite läuft ohne dieses Schema: der ausgelieferte Store
--  (src/lib/tattoo/store.ts) hält alles in EINEM JSON-Dokument, weil
--  ein Ein-Personen-Studio damit auskommt und die Seite so ohne
--  Fremd-Account startklar ist.
--
--  Dieses Schema ist der Umzugsweg für den Fall, dass mehr gebraucht
--  wird: echte Zugriffskontrolle statt "unerratbarer Dateiname",
--  Transaktionen statt prozesslokaler Serialisierung, Backups und
--  Point-in-time-Recovery. Die Spalten entsprechen 1:1 den Typen in
--  src/lib/tattoo/types.ts — zu ersetzen sind nur die Funktionen in
--  store.ts, kein Stück UI.
--
--  Einspielen: Supabase → SQL Editor → Inhalt einfügen → Run.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";   -- liefert gen_random_uuid()

-- ─── Statuswerte als Enum ────────────────────────────────────────
-- Enum statt text + CHECK: ein Tippfehler im Anwendungscode fliegt
-- schon beim INSERT auf, nicht erst wenn im Kalender ein Termin fehlt.
create type slot_status as enum ('open', 'requested', 'booked', 'blocked');
create type booking_status as enum ('pending', 'confirmed', 'declined', 'cancelled');

-- ─── Termine ─────────────────────────────────────────────────────
-- Ein Slot ist ein vom Inhaber freigegebener Zeitraum. Datum und
-- Uhrzeit stehen bewusst GETRENNT und ohne Zeitzone: der Kalender
-- eines Studios denkt in Tagen der eigenen Zeitzone. Mit timestamptz
-- würde die Sommerzeit-Umstellung Termine auf den Vortag schieben.
create table slots (
  id               uuid primary key default gen_random_uuid(),
  slot_date        date        not null,
  start_time       time        not null,
  duration_minutes int         not null check (duration_minutes between 15 and 720),
  status           slot_status not null default 'open',
  note             text,                       -- intern, nie an Kunden
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Verhindert doppelte Termine zur selben Uhrzeit. Genau die Regel,
  -- die im JSON-Store `createSlots` von Hand nachbaut.
  constraint slots_unique_moment unique (slot_date, start_time)
);

-- Der Kundenkalender fragt immer dasselbe: freie Termine ab heute.
create index slots_open_upcoming_idx
  on slots (slot_date, start_time)
  where status = 'open';

-- ─── Buchungsanfragen ────────────────────────────────────────────
create table bookings (
  id              uuid           primary key default gen_random_uuid(),
  -- on delete cascade: wird ein Termin gelöscht, verschwindet die
  -- daran hängende Anfrage mit. Eine Anfrage ohne Termin wäre eine
  -- Karteileiche, die niemand mehr beantworten kann.
  slot_id         uuid           not null references slots(id) on delete cascade,
  status          booking_status not null default 'pending',

  -- Kontakt
  full_name       text           not null check (length(full_name) between 2 and 80),
  email           text           not null check (email like '%_@_%.__%'),
  phone           text           not null,

  -- Tattoo-Wunsch (Werte stammen aus den Katalogen in types.ts)
  style           text           not null,
  size            text           not null,
  placement       text           not null,
  color_mode      text           not null,
  budget          text           not null,
  is_first_tattoo boolean        not null default false,
  idea            text           not null check (length(idea) between 10 and 2000),
  reference_url   text,

  consent_at      timestamptz    not null default now(),  -- DSGVO-Nachweis
  admin_note      text,
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now()
);

-- Höchstens EINE aktive Anfrage pro Termin. Das ist der Schutz gegen
-- Doppelbuchungen: zwei gleichzeitige Anfragen laufen in dieselbe
-- Unique-Verletzung, die zweite bekommt sauber ihren 409 — ganz ohne
-- Sperren im Anwendungscode.
create unique index bookings_one_active_per_slot
  on bookings (slot_id)
  where status in ('pending', 'confirmed');

create index bookings_inbox_idx on bookings (status, created_at desc);

-- ─── updated_at automatisch pflegen ──────────────────────────────
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger slots_touch    before update on slots
  for each row execute function touch_updated_at();
create trigger bookings_touch before update on bookings
  for each row execute function touch_updated_at();

-- ─── Slot-Status an die Buchung koppeln ──────────────────────────
-- Im JSON-Store macht das `setBookingStatus` von Hand. In Postgres
-- gehört es an die Daten selbst: dann kann kein Weg an der Regel
-- vorbei, auch nicht über den SQL-Editor.
create or replace function sync_slot_status() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update slots set status = 'requested' where id = new.slot_id;
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status = 'confirmed' then
      update slots set status = 'booked' where id = new.slot_id;
    elsif new.status in ('declined', 'cancelled') then
      -- Nur freigeben, wenn keine ANDERE aktive Anfrage darauf liegt.
      update slots set status = 'open'
      where id = new.slot_id
        and not exists (
          select 1 from bookings b
          where b.slot_id = new.slot_id
            and b.id <> new.id
            and b.status in ('pending', 'confirmed')
        );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger bookings_sync_slot
  after insert or update on bookings
  for each row execute function sync_slot_status();

-- ─── Zugriffsrechte (Supabase Row Level Security) ────────────────
-- Ohne RLS wäre über den anon-Key jede Kundenanfrage öffentlich
-- lesbar — Name, Telefonnummer, E-Mail inklusive.
alter table slots    enable row level security;
alter table bookings enable row level security;

-- Öffentlich sichtbar sind ausschließlich FREIE Termine ab heute.
-- Belegte oder gesperrte Termine bleiben unsichtbar: aus ihnen ließe
-- sich sonst der Kalender anderer Kunden rekonstruieren.
create policy "freie Termine sind öffentlich lesbar"
  on slots for select
  to anon
  using (status = 'open' and slot_date >= current_date);

-- Anfragen darf jeder ANLEGEN, aber niemand lesen. Der Inhaber
-- arbeitet mit dem service_role-Key, der RLS ohnehin umgeht.
create policy "Anfragen dürfen angelegt werden"
  on bookings for insert
  to anon
  with check (status = 'pending');

-- Kein SELECT-Policy für anon auf `bookings` — bewusst. Ohne Policy
-- ist die Tabelle für diese Rolle vollständig gesperrt.
