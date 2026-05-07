-- ══════════════════════════════════════════════
-- 007_fix_categories_dedup.sql
-- Elimina categorías de sistema duplicadas y agrega
-- índice único parcial para evitar duplicados futuros.
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- Idempotente: seguro de correr más de una vez.
-- ══════════════════════════════════════════════

-- ── 1. Eliminar duplicados de sistema ────────────────────────────────────────
-- Causa raíz: UNIQUE(user_id, name) con user_id=NULL no previene duplicados
-- porque NULL != NULL en Postgres. Las migraciones 001 y 005 insertan las
-- mismas categorías con ON CONFLICT DO NOTHING que tampoco ayuda sin índice.
-- Mantenemos la instancia más antigua (created_at ASC) de cada nombre.

DELETE FROM public.categories a
USING public.categories b
WHERE a.user_id IS NULL
  AND b.user_id IS NULL
  AND lower(a.name) = lower(b.name)
  AND a.created_at > b.created_at;

-- Si hay varios con el mismo created_at, conservar el de menor ctid
DELETE FROM public.categories a
USING public.categories b
WHERE a.user_id IS NULL
  AND b.user_id IS NULL
  AND lower(a.name) = lower(b.name)
  AND a.ctid > b.ctid;

-- ── 2. Índice único parcial para categorías de sistema ───────────────────────
-- Previene que futuras seeds o migraciones dupliquen categorías globales.

CREATE UNIQUE INDEX IF NOT EXISTS categories_system_name_uix
  ON public.categories (lower(name))
  WHERE user_id IS NULL;

-- ── 3. También asegurar índice para categorías de usuario ────────────────────
-- El UNIQUE(user_id, name) original ya cubre esto, pero si no existe
-- por alguna razón, lo recreamos.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_user_id_name_key'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_uix
      ON public.categories (user_id, lower(name))
      WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- ── 4. Verificación ──────────────────────────────────────────────────────────
SELECT
  user_id IS NULL AS is_system,
  lower(name) AS name_lower,
  count(*) AS count
FROM public.categories
GROUP BY is_system, name_lower
HAVING count(*) > 1;

-- Si esta query no devuelve filas, no hay más duplicados.
