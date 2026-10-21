-- ==============================================================================
-- PLANILHA INTELIGENTE IA — SCHEMA SUPABASE POSTGRESQL & POLÍTICAS RLS
-- Migration: 20250101_initial_schema.sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Extensão do auth.users com plano e regras de acesso)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. SUBSCRIPTIONS (Histórico e estado de assinaturas do Mercado Pago)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'canceled', 'paused', 'expired')),
    mp_preapproval_id TEXT,
    mp_payer_id TEXT,
    plan_id TEXT NOT NULL DEFAULT 'premium_monthly',
    price_cents INTEGER NOT NULL DEFAULT 2990,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. IMPORTS (Registro de arquivos importados e validação de cota)
CREATE TABLE IF NOT EXISTS public.imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('xlsx', 'xls', 'csv')),
    sheet_name TEXT,
    rows_count INTEGER NOT NULL DEFAULT 0,
    columns_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. DATASETS (Metadados dos datasets processados e normalizados)
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sheet_name TEXT,
    columns_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    rows_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. DASHBOARDS (Configurações dos dashboards salvos pelos usuários)
CREATE TABLE IF NOT EXISTS public.dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CHARTS (Gráficos vinculados ao dashboard)
CREATE TABLE IF NOT EXISTS public.charts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bar', 'horizontal_bar', 'line', 'area', 'pie', 'donut', 'scatter', 'table')),
    x_axis TEXT NOT NULL,
    y_axis TEXT NOT NULL,
    aggregation TEXT NOT NULL DEFAULT 'sum' CHECK (aggregation IN ('sum', 'avg', 'count', 'min', 'max')),
    color_palette TEXT NOT NULL DEFAULT 'blue',
    order_index INTEGER NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. USAGE_COUNTERS (Controle rigoroso dos limites mensais por plano)
CREATE TABLE IF NOT EXISTS public.usage_counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_year_month TEXT NOT NULL, -- Formato 'YYYY-MM'
    imports_count INTEGER NOT NULL DEFAULT 0,
    ai_queries_count INTEGER NOT NULL DEFAULT 0,
    dashboards_created_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_period UNIQUE(user_id, period_year_month)
);

-- 8. AI_INSIGHTS (Histórico de perguntas e análises da IA para auditoria e rate-limiting)
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    tokens_consumed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. AUDIT_LOGS (Trilha de auditoria para segurança e compliance)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_preapproval ON public.subscriptions(mp_preapproval_id);
CREATE INDEX IF NOT EXISTS idx_imports_user ON public.imports(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user ON public.datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user ON public.dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_dataset ON public.dashboards(dataset_id);
CREATE INDEX IF NOT EXISTS idx_charts_dashboard ON public.charts(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_period ON public.usage_counters(user_id, period_year_month);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON public.ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users see and edit own profile; admins can view all
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Subscriptions: User view own subscriptions; only service role / admin updates
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Imports: User can read/insert own imports
CREATE POLICY "Users can manage own imports"
    ON public.imports FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- Datasets: User can view and manage only their own datasets
CREATE POLICY "Users can manage own datasets"
    ON public.datasets FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- Dashboards: User can view own dashboards or public ones
CREATE POLICY "Users can manage own dashboards"
    ON public.dashboards FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public dashboards viewable"
    ON public.dashboards FOR SELECT
    USING (is_public = true);

-- Charts: Linked to dashboard ownership
CREATE POLICY "Users can manage charts in own dashboards"
    ON public.charts FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- Usage Counters: User can view their own counters
CREATE POLICY "Users can view own usage counters"
    ON public.usage_counters FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- AI Insights: User can view own insights
CREATE POLICY "Users can view own ai insights"
    ON public.ai_insights FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- Audit logs: Admins can view all, users can view own
CREATE POLICY "Audit logs visible to owner or admin"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());
