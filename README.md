# Cuentas Claras

MVP SaaS de finanzas personales, grupos de gastos compartidos, compras en cuotas y liquidacion de deudas. Stack: React, Vite, TypeScript, TailwindCSS v4, componentes locales estilo shadcn/ui, Supabase Auth/Postgres/RLS y Recharts.

## Requisitos

- Node.js 24+
- npm
- Proyecto Supabase

## Instalacion local

```bash
npm install
cp .env.example .env
npm run dev
```

Completa `.env` con:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Si las variables no existen, la app arranca en modo demo local para revisar la UI y los flujos sin backend. Con variables configuradas, se muestra login real y se protege la app hasta que exista una sesion.

## Supabase

1. Crea un proyecto en Supabase.
2. En el SQL Editor ejecuta, en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_auth_profiles.sql`
3. En Authentication > Providers, habilita Email.
4. Copia la Project URL y la anon public key a `.env`.

Las migraciones crean:

- `profiles`
- `groups`
- `group_members`
- `categories`
- `transactions`
- `shared_expenses`
- `shared_expense_splits`
- `installment_plans`
- `installments`
- `payments`

Tambien activan RLS para que los gastos privados solo sean visibles por su usuario y los datos de grupo solo por miembros. La tabla `profiles` se crea automaticamente desde `auth.users` con `email`, `full_name`, `avatar_url`, `created_at` y `updated_at`.

## Auth URLs

En Supabase Dashboard > Authentication > URL Configuration:

- Site URL local sugerida: `http://localhost:5173`
- Additional Redirect URLs:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `http://127.0.0.1:5174`
  - tu URL de Vercel cuando deployes

Vite puede cambiar de puerto si el anterior esta ocupado. Si aparece otra URL en consola, agregala tambien en Supabase Auth Redirect URLs.

## Recuperacion de contrasena

La app usa `supabase.auth.resetPasswordForEmail` con `redirectTo` apuntando a la URL actual de la app. Para que funcione:

1. Configura las Auth URLs anteriores.
2. En Authentication > Email Templates, revisa el template de Recovery.
3. Asegurate de que el link de recuperacion redirija a una URL permitida.
4. Cuando el usuario vuelve desde el email, la app muestra el formulario para guardar la nueva contrasena con `supabase.auth.updateUser`.

## Google OAuth

Para habilitar "Continuar con Google":

1. En Google Cloud Console crea o selecciona un proyecto.
2. Configura OAuth consent screen.
3. Crea credenciales OAuth Client ID de tipo Web application.
4. Agrega como Authorized redirect URI la URL callback de Supabase:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

5. En Supabase Dashboard > Authentication > Providers > Google, habilita Google y carga Client ID y Client Secret.
6. Verifica que tus URLs locales y de deploy esten en Authentication > URL Configuration.

Si no hay variables de Supabase en `.env`, el boton queda deshabilitado y la app conserva modo demo.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Funcionalidades MVP

- Registro, login, recuperacion de contrasena, Google OAuth, sesion persistente y logout con Supabase Auth.
- Dashboard con gastos, ingresos, saldos, cuotas proximas y grafico por categoria.
- CRUD de movimientos personales con filtros por mes, tipo y categoria.
- Grupos con miembros, roles `owner/member` e invitacion por email registrado.
- Gastos compartidos con division igual, por monto o por porcentaje.
- Compras en cuotas privadas o compartidas con generacion automatica de cuotas y splits mensuales.
- Liquidacion con saldos por persona y marcado de deuda como pagada.
- Formato de moneda ARS y fechas argentinas.

## Deploy en Vercel

1. Importa el repositorio en Vercel.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Usa build command `npm run build` y output `dist`.
4. Agrega la URL de Vercel a Supabase Auth Redirect URLs.

Commit sugerido:

```bash
git add .
git commit -m "feat: add supabase auth flows"
```
