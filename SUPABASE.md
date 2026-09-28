# 🔐 Login y venta con Supabase

Actividapp puede pedir **inicio de sesión** y dar acceso solo a la gente que te pagó.
La lógica: cada persona se registra (email + contraseña); vos **habilitás** su cuenta cuando
paga. Si le sacás el acceso, la app se **bloquea sola** la próxima vez que la abra.

> Si NO configurás Supabase, la app funciona igual pero **sin login** (modo abierto).

## 1) Crear el proyecto

1. Entrá a [supabase.com](https://supabase.com) → creá un proyecto (gratis).
2. En **Project Settings → API** copiá:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
3. Pegalas en `web/.env` (copiá `web/.env.example`).

## 2) Crear la tabla de acceso (SQL)

En Supabase → **SQL Editor** → pegá y ejecutá esto una vez:

```sql
-- Una fila por usuario. active = tiene acceso pagado.
create table if not exists public.licenses (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  active     boolean not null default false,
  plan       text,
  expires_at timestamptz,           -- opcional: para suscripciones con vencimiento
  created_at timestamptz not null default now()
);

-- Cuando alguien se registra, se crea su fila (INACTIVA hasta que la habilites).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.licenses (user_id, email, active)
  values (new.id, new.email, false)
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seguridad: cada usuario solo puede LEER su propia licencia (nadie la edita desde la app).
alter table public.licenses enable row level security;
drop policy if exists "read own license" on public.licenses;
create policy "read own license" on public.licenses
  for select using (auth.uid() = user_id);
```

## 3) Vender / habilitar / revocar

- **Habilitar a quien pagó:** Supabase → **Table editor → licenses** → buscás su email → `active = true`.
  (Podés poner `expires_at` para que venza solo, ej. una suscripción mensual.)
- **Revocar:** `active = false`. La app lo detecta al volver a abrirla / cambiar de pestaña
  (revalida cada 5 min) y muestra la pantalla de "acceso pendiente".
- **Ver quién se registró:** la misma tabla `licenses` los lista a todos.

### Confirmación por email (opcional)
En **Authentication → Providers → Email**:
- Si dejás **"Confirm email" ON**: el usuario debe confirmar su correo antes de entrar (más seguro).
- Si lo ponés **OFF**: entra apenas se registra (pero igual queda `active = false` hasta que lo habilites).

Si preferís que **nadie se registre solo**, desactivá los signups (Authentication → Settings →
"Allow new users to sign up" OFF) y creá las cuentas vos desde el panel.

## 4) Compilar y distribuir

```bash
# con web/.env completo:
npm run build
npm start        # o pasás la carpeta / el dist a tu cliente
```

Las claves de Supabase quedan dentro del build (son **públicas** a propósito; la seguridad la da
el RLS de arriba). Cualquiera puede abrir la app, pero **solo entra quien tenga cuenta habilitada**.
