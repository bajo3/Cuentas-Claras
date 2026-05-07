import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import type { Session, User } from '@supabase/supabase-js'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './index.css'
import { supabase, supabaseConfigured } from './lib/supabase'
import type {
  ActivityLogEntry,
  AppNotification,
  Category,
  Group,
  GroupInvitation,
  GroupMember,
  Installment,
  InstallmentPlan,
  Payment,
  PlanType,
  Profile,
  RecurrenceFrequency,
  RecurringExpense,
  SharedExpense,
  SharedExpenseSplit,
  Transaction,
  TransactionType,
} from './lib/types'
import { cn, formatARS, formatDateAR, monthInput, todayISO } from './lib/utils'

type View = 'dashboard' | 'movements' | 'groups' | 'installments' | 'settlement' | 'settings'
type Dialog = null | 'transaction' | 'group' | 'shared' | 'installment' | 'invite' | 'recurring' | 'convert-tx'
type SettingsTab = 'profile' | 'appearance' | 'categories' | 'recurring' | 'data'
type SplitMode = 'equal' | 'amount' | 'percentage'
type AuthMode = 'login' | 'register' | 'reset' | 'update-password'

const demoUser: Profile = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'demo@cuentasclaras.app',
  full_name: 'Demo Finanzas',
  avatar_url: null,
  created_at: todayISO(),
  updated_at: todayISO(),
}

const demoProfiles: Profile[] = [
  demoUser,
  { id: '22222222-2222-4222-8222-222222222222', email: 'ana@demo.com', full_name: 'Ana', avatar_url: null, created_at: todayISO(), updated_at: todayISO() },
  { id: '33333333-3333-4333-8333-333333333333', email: 'tomi@demo.com', full_name: 'Tomi', avatar_url: null, created_at: todayISO(), updated_at: todayISO() },
]

const demoCategories: Category[] = [
  { id: 'cat-food', user_id: null, name: 'Comida', color: '#0f9f6e', created_at: todayISO() },
  { id: 'cat-home', user_id: null, name: 'Casa', color: '#2563eb', created_at: todayISO() },
  { id: 'cat-fun', user_id: null, name: 'Salidas', color: '#d97706', created_at: todayISO() },
  { id: 'cat-pay', user_id: null, name: 'Sueldo', color: '#16a34a', created_at: todayISO() },
  { id: 'cat-travel', user_id: null, name: 'Viajes', color: '#7c3aed', created_at: todayISO() },
]

const demoGroups: Group[] = [
  { id: 'group-home', name: 'Depto Palermo', description: 'Gastos compartidos del mes', created_by: demoUser.id, created_at: todayISO() },
]

const demoMembers: GroupMember[] = [
  { id: 'gm-1', group_id: 'group-home', user_id: demoUser.id, role: 'owner', created_at: todayISO(), profile: demoProfiles[0] },
  { id: 'gm-2', group_id: 'group-home', user_id: demoProfiles[1].id, role: 'member', created_at: todayISO(), profile: demoProfiles[1] },
  { id: 'gm-3', group_id: 'group-home', user_id: demoProfiles[2].id, role: 'member', created_at: todayISO(), profile: demoProfiles[2] },
]

const now = new Date()
const ym = monthInput(now)

const demoTransactions: Transaction[] = [
  { id: 'tx-1', user_id: demoUser.id, title: 'Sueldo', amount: 1250000, occurred_on: `${ym}-01`, category_id: 'cat-pay', type: 'income', notes: '', created_at: todayISO() },
  { id: 'tx-2', user_id: demoUser.id, title: 'Supermercado', amount: 87000, occurred_on: `${ym}-03`, category_id: 'cat-food', type: 'expense', notes: 'Compra semanal', created_at: todayISO() },
  { id: 'tx-3', user_id: demoUser.id, title: 'Alquiler', amount: 390000, occurred_on: `${ym}-05`, category_id: 'cat-home', type: 'expense', notes: '', created_at: todayISO() },
]

const demoSharedExpenses: SharedExpense[] = [
  { id: 'se-1', group_id: 'group-home', title: 'Cena del grupo', amount: 96000, occurred_on: `${ym}-08`, category_id: 'cat-fun', paid_by: demoProfiles[1].id, split_mode: 'equal', created_by: demoProfiles[1].id, created_at: todayISO() },
]

const demoSplits: SharedExpenseSplit[] = [
  { id: 'split-1', group_id: 'group-home', shared_expense_id: 'se-1', installment_id: null, debtor_id: demoUser.id, creditor_id: demoProfiles[1].id, amount: 32000, percentage: null, status: 'pending', due_on: `${ym}-08`, paid_at: null, created_at: todayISO() },
  { id: 'split-2', group_id: 'group-home', shared_expense_id: 'se-1', installment_id: null, debtor_id: demoProfiles[2].id, creditor_id: demoProfiles[1].id, amount: 32000, percentage: null, status: 'pending', due_on: `${ym}-08`, paid_at: null, created_at: todayISO() },
]

const demoPlans: InstallmentPlan[] = [
  { id: 'plan-1', user_id: demoUser.id, group_id: 'group-home', title: 'Heladera', total_amount: 900000, installments_count: 6, installment_amount: 150000, start_date: `${ym}-10`, due_day: 10, paid_by: demoUser.id, created_at: todayISO(), plan_type: 'ARS', uva_count: null, uva_value_at_creation: null, uva_value_date: null },
  { id: 'plan-2', user_id: demoUser.id, group_id: null, title: 'Crédito UVA Demo', total_amount: 0, installments_count: 12, installment_amount: 0, start_date: `${ym}-01`, due_day: 1, paid_by: demoUser.id, created_at: todayISO(), plan_type: 'UVA', uva_count: 500, uva_value_at_creation: 1350.5, uva_value_date: ym + '-01' },
]

const demoInstallments: Installment[] = [
  { id: 'inst-1', plan_id: 'plan-1', number: 1, amount: 150000, due_on: `${ym}-10`, status: 'pending', paid_at: null, created_at: todayISO(), uva_count: null, uva_value: null },
  { id: 'inst-2', plan_id: 'plan-2', number: 1, amount: 675250, due_on: `${ym}-01`, status: 'paid', paid_at: todayISO(), created_at: todayISO(), uva_count: 500, uva_value: 1350.5 },
  { id: 'inst-3', plan_id: 'plan-2', number: 2, amount: 675250, due_on: `${ym}-01`, status: 'pending', paid_at: null, created_at: todayISO(), uva_count: 500, uva_value: 1350.5 },
]

const demoInvitations: GroupInvitation[] = [
  { id: 'inv-1', group_id: 'group-home', inviter_id: demoUser.id, invitee_email: 'carlos@demo.com', status: 'pending', created_at: todayISO(), responded_at: null },
]

const demoNotifications: AppNotification[] = [
  { id: 'notif-1', user_id: demoUser.id, type: 'invitation', title: 'Invitación al grupo', body: 'Te invitaron a Depto Palermo', data: null, is_read: false, created_at: todayISO() },
  { id: 'notif-2', user_id: demoUser.id, type: 'payment', title: 'Pago recibido', body: 'Ana marcó $32.000 como pagado', data: null, is_read: true, created_at: todayISO() },
]

const demoActivityLog: ActivityLogEntry[] = [
  { id: 'act-1', group_id: 'group-home', actor_id: demoProfiles[1].id, action_type: 'expense_created', data: { title: 'Cena del grupo', amount: 96000 }, created_at: todayISO() },
  { id: 'act-2', group_id: 'group-home', actor_id: demoUser.id, action_type: 'member_invited', data: { email: 'carlos@demo.com' }, created_at: todayISO() },
]

const demoRecurring: RecurringExpense[] = [
  { id: 'rec-1', user_id: demoUser.id, group_id: null, title: 'Netflix', amount: 6500, category_id: 'cat-fun', frequency: 'monthly', start_date: `${ym}-01`, next_due: `${ym}-01`, paid_by: demoUser.id, split_mode: 'equal', is_active: true, created_at: todayISO() },
  { id: 'rec-2', user_id: demoUser.id, group_id: 'group-home', title: 'Limpieza', amount: 45000, category_id: 'cat-home', frequency: 'monthly', start_date: `${ym}-01`, next_due: `${ym}-05`, paid_by: demoUser.id, split_mode: 'equal', is_active: true, created_at: todayISO() },
]

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'movements' as const, label: 'Movimientos', icon: Receipt },
  { id: 'groups' as const, label: 'Grupos', icon: Users },
  { id: 'installments' as const, label: 'Cuotas', icon: CreditCard },
  { id: 'settlement' as const, label: 'Liquidacion', icon: WalletCards },
  { id: 'settings' as const, label: 'Configuracion', icon: Settings },
]

const bottomNavItems = [
  { id: 'dashboard' as const, label: 'Inicio', icon: LayoutDashboard },
  { id: 'movements' as const, label: 'Gastos', icon: Receipt },
  { id: 'groups' as const, label: 'Grupos', icon: Users },
  { id: 'installments' as const, label: 'Cuotas', icon: CreditCard },
  { id: 'settlement' as const, label: 'Liquidar', icon: WalletCards },
]

const emptyTransaction = {
  title: '',
  amount: '',
  occurred_on: todayISO(),
  category_id: '',
  type: 'expense' as TransactionType,
  notes: '',
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState('group-home')
  const [inviteGroupId, setInviteGroupId] = useState('')
  const [notice, setNotice] = useState('')
  const [month, setMonth] = useState(ym)
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [txSearch, setTxSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | 'pending' | 'overdue' | 'paid' | 'uva' | 'ars'>('all')

  const [profiles, setProfiles] = useState<Profile[]>(demoProfiles)
  const [categories, setCategories] = useState<Category[]>(demoCategories)
  const [transactions, setTransactions] = useState<Transaction[]>(demoTransactions)
  const [groups, setGroups] = useState<Group[]>(demoGroups)
  const [members, setMembers] = useState<GroupMember[]>(demoMembers)
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>(demoSharedExpenses)
  const [splits, setSplits] = useState<SharedExpenseSplit[]>(demoSplits)
  const [plans, setPlans] = useState<InstallmentPlan[]>(demoPlans)
  const [installments, setInstallments] = useState<Installment[]>(demoInstallments)
  const [payments, setPayments] = useState<Payment[]>([])

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('cc-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null)
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<string | null>(null)
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<string | null>(null)
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set())
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const [invitations, setInvitations] = useState<GroupInvitation[]>(demoInvitations)
  const [notifications, setNotifications] = useState<AppNotification[]>(demoNotifications)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(demoActivityLog)
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(demoRecurring)

  const [showNotifications, setShowNotifications] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile')
  const [convertTxSource, setConvertTxSource] = useState<Transaction | null>(null)
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', color: '#0d9488' })
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editCategoryForm, setEditCategoryForm] = useState({ name: '', color: '#0d9488' })
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    amount: '',
    category_id: '',
    frequency: 'monthly' as RecurrenceFrequency,
    start_date: todayISO(),
    group_id: '',
    paid_by: demoUser.id,
    split_mode: 'equal' as SplitMode,
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('cc-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const [txForm, setTxForm] = useState(emptyTransaction)
  const [groupForm, setGroupForm] = useState({ name: '', description: '' })
  const [inviteEmail, setInviteEmail] = useState('')
  const [sharedForm, setSharedForm] = useState({
    group_id: 'group-home',
    title: '',
    amount: '',
    occurred_on: todayISO(),
    category_id: '',
    paid_by: demoUser.id,
    split_mode: 'equal' as SplitMode,
    custom: {} as Record<string, string>,
  })
  const [installmentForm, setInstallmentForm] = useState({
    title: '',
    total_amount: '',
    installments_count: '3',
    start_date: todayISO(),
    due_day: '10',
    paid_by: demoUser.id,
    group_id: '',
    split_mode: 'equal' as SplitMode,
    custom: {} as Record<string, string>,
    plan_type: 'ARS' as PlanType,
    uva_count: '',
  })
  const [editingPlan, setEditingPlan] = useState<InstallmentPlan | null>(null)
  const [editPlanForm, setEditPlanForm] = useState({
    title: '',
    total_amount: '',
    installments_count: '',
    due_day: '10',
    start_date: todayISO(),
    uva_count: '',
  })
  const [confirmRecalcPlan, setConfirmRecalcPlan] = useState(false)
  const [uvaValue, setUvaValue] = useState<number | null>(null)
  const [uvaDate, setUvaDate] = useState<string | null>(null)
  const [uvaLoading, setUvaLoading] = useState(false)
  const [uvaManual, setUvaManual] = useState('')

  const currentUser = profiles.find((profile) => profile.id === sessionUserId) ?? {
    ...demoUser,
    id: authUser?.id ?? demoUser.id,
    email: authUser?.email ?? demoUser.email,
    full_name: (authUser?.user_metadata?.full_name as string | undefined) ?? (authUser?.user_metadata?.name as string | undefined) ?? demoUser.full_name,
    avatar_url: (authUser?.user_metadata?.avatar_url as string | undefined) ?? null,
  }
  const isDemo = !supabaseConfigured || sessionUserId === demoUser.id

  useEffect(() => {
    let alive = true
    async function init() {
      if (!supabaseConfigured) {
        setSession(null)
        setAuthUser(null)
        setSessionUserId(demoUser.id)
        setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!alive) return
      setSession(data.session)
      setAuthUser(data.session?.user ?? null)
      setSessionUserId(data.session?.user.id ?? null)
      setLoading(false)

      const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession)
        setAuthUser(nextSession?.user ?? null)
        setSessionUserId(nextSession?.user.id ?? null)
        if (event === 'PASSWORD_RECOVERY') {
          setAuthMode('update-password')
          setAuthError('')
          setAuthSuccess('Ingresa tu nueva contrasena para completar la recuperacion.')
        }
      })

      return listener.subscription.unsubscribe
    }
    const cleanupPromise = init()
    return () => {
      alive = false
      void cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [])

  async function loadData(userId: string) {
    setLoading(true)
    await ensureCurrentProfile(userId)
    const [
      profilesRes,
      categoriesRes,
      txRes,
      groupsRes,
      membersRes,
      sharedRes,
      splitsRes,
      plansRes,
      installmentsRes,
      paymentsRes,
      invitationsRes,
      notificationsRes,
      activityRes,
      recurringRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('categories').select('*').or(`user_id.is.null,user_id.eq.${userId}`).order('name'),
      supabase.from('transactions').select('*').eq('user_id', userId).order('occurred_on', { ascending: false }),
      supabase.from('groups').select('*').order('created_at', { ascending: false }),
      supabase.from('group_members').select('*, profile:profiles(*)'),
      supabase.from('shared_expenses').select('*').order('occurred_on', { ascending: false }),
      supabase.from('shared_expense_splits').select('*').order('due_on', { ascending: true }),
      supabase.from('installment_plans').select('*').order('created_at', { ascending: false }),
      supabase.from('installments').select('*').order('due_on', { ascending: true }),
      supabase.from('payments').select('*').order('paid_at', { ascending: false }),
      supabase.from('group_invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }),
      supabase.from('recurring_expenses').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    if (profilesRes.data) setProfiles(profilesRes.data)
    if (categoriesRes.data) setCategories(categoriesRes.data)
    if (txRes.data) setTransactions(txRes.data)
    if (groupsRes.data) {
      setGroups(groupsRes.data)
      setSelectedGroupId((prev) => prev || groupsRes.data[0]?.id || '')
    }
    if (membersRes.data) setMembers(membersRes.data as GroupMember[])
    if (sharedRes.data) setSharedExpenses(sharedRes.data)
    if (splitsRes.data) setSplits(splitsRes.data)
    if (plansRes.data) setPlans(plansRes.data)
    if (installmentsRes.data) setInstallments(installmentsRes.data)
    if (paymentsRes.data) setPayments(paymentsRes.data)
    if (invitationsRes.data) setInvitations(invitationsRes.data)
    if (notificationsRes.data) setNotifications(notificationsRes.data)
    if (activityRes.data) setActivityLog(activityRes.data)
    if (recurringRes.data) setRecurringExpenses(recurringRes.data)
    setLoading(false)
  }

  useEffect(() => {
    if (!sessionUserId || isDemo) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(sessionUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, isDemo])

  // Auto-load UVA value once when entering installments view if there are UVA plans
  useEffect(() => {
    if (view !== 'installments') return
    const hasUva = plans.some((p) => p.plan_type === 'UVA')
    if (!hasUva || uvaValue !== null) return
    void fetchUvaValue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, plans])

  function logSupabaseError(scope: string, error: { code?: string; message?: string; details?: string; hint?: string } | null) {
    if (!error || !import.meta.env.DEV) return
    console.error(`[supabase:${scope}]`, {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })
  }

  async function ensureCurrentProfile(userId: string) {
    if (isDemo || !authUser || !supabaseConfigured) return

    const profilePayload = {
      id: userId,
      email: authUser.email ?? '',
      full_name:
        (authUser.user_metadata?.full_name as string | undefined) ??
        (authUser.user_metadata?.name as string | undefined) ??
        null,
      avatar_url:
        (authUser.user_metadata?.avatar_url as string | undefined) ??
        (authUser.user_metadata?.picture as string | undefined) ??
        null,
    }

    const { error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
    if (error) logSupabaseError('ensure-profile', error)
  }

  function getAppUrl() {
    const envUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return (envUrl || origin).replace(/\/$/, '')
  }

  function authRedirectUrl() {
    return getAppUrl()
  }

  const UVA_CACHE_KEY = 'cc-uva-cache'
  const UVA_CACHE_TTL = 60 * 60 * 1000 // 1 hour in ms

  function loadUvaFromCache(): boolean {
    try {
      const raw = localStorage.getItem(UVA_CACHE_KEY)
      if (!raw) return false
      const { value, date, ts } = JSON.parse(raw) as { value: number; date: string; ts: number }
      if (Date.now() - ts > UVA_CACHE_TTL) return false
      setUvaValue(value)
      setUvaDate(date)
      return true
    } catch { return false }
  }

  async function fetchUvaValue(forceRefresh = false) {
    if (!forceRefresh && loadUvaFromCache()) return
    setUvaLoading(true)
    try {
      const res = await fetch('/api/uva')
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; value?: number; date?: string }
        if (data.ok && data.value && data.date) {
          setUvaValue(data.value)
          setUvaDate(data.date)
          localStorage.setItem(UVA_CACHE_KEY, JSON.stringify({ value: data.value, date: data.date, ts: Date.now() }))
          setUvaLoading(false)
          return
        }
      }
    } catch { /* /api/uva unreachable — dev environment */ }
    setUvaLoading(false)
  }

  function openEditPlan(plan: InstallmentPlan) {
    setEditingPlan(plan)
    setEditPlanForm({
      title: plan.title,
      total_amount: String(plan.total_amount),
      installments_count: String(plan.installments_count),
      due_day: String(plan.due_day),
      start_date: plan.start_date,
      uva_count: plan.uva_count ? String(plan.uva_count) : '',
    })
    setConfirmRecalcPlan(false)
  }

  async function saveEditPlan(event: React.FormEvent) {
    event.preventDefault()
    if (!editingPlan) return
    const plan = editingPlan
    const title = editPlanForm.title.trim()
    const count = Number(editPlanForm.installments_count)
    const dueDay = Number(editPlanForm.due_day)
    const uvaCountVal = editPlanForm.uva_count ? Number(editPlanForm.uva_count) : null
    const total = Number(editPlanForm.total_amount)

    if (!title || !Number.isFinite(count) || count <= 0 || dueDay < 1 || dueDay > 31) {
      setNotice('Datos inválidos')
      return
    }

    const paidInsts = installments.filter((i) => i.plan_id === plan.id && i.status === 'paid')
    const pendingInsts = installments.filter((i) => i.plan_id === plan.id && i.status === 'pending')

    if (paidInsts.length > 0 && !confirmRecalcPlan) {
      setConfirmRecalcPlan(true)
      return
    }

    const effectiveUvaValue = uvaValue ?? (uvaManual ? Number(uvaManual) : null)
    const instAmount =
      plan.plan_type === 'UVA' && uvaCountVal && effectiveUvaValue
        ? Math.round(uvaCountVal * effectiveUvaValue * 100) / 100
        : Math.round((total / count) * 100) / 100

    const totalPendingCount = Math.max(0, count - paidInsts.length)

    const buildPending = () =>
      Array.from({ length: totalPendingCount }, (_, idx) => {
        const instNum = paidInsts.length + idx + 1
        const date = new Date(`${editPlanForm.start_date}T00:00:00`)
        date.setMonth(date.getMonth() + paidInsts.length + idx)
        date.setDate(Math.min(dueDay, 28))
        return {
          plan_id: plan.id,
          number: instNum,
          amount: instAmount,
          due_on: todayISO(date),
          status: 'pending' as const,
          paid_at: null,
          uva_count: plan.plan_type === 'UVA' ? uvaCountVal : null,
          uva_value: plan.plan_type === 'UVA' ? effectiveUvaValue : null,
        }
      })

    const updatedPlan: InstallmentPlan = {
      ...plan,
      title,
      total_amount: plan.plan_type === 'UVA' ? instAmount * count : total,
      installments_count: count,
      installment_amount: instAmount,
      start_date: editPlanForm.start_date,
      due_day: dueDay,
      uva_count: uvaCountVal,
    }

    if (isDemo) {
      const newPending = buildPending().map((i) => ({ id: crypto.randomUUID(), created_at: todayISO(), ...i }))
      setPlans((items) => items.map((p) => (p.id === plan.id ? updatedPlan : p)))
      setInstallments((items) => [
        ...items.filter((i) => i.plan_id !== plan.id || i.status === 'paid'),
        ...newPending,
      ])
    } else {
      const { error: planErr } = await supabase
        .from('installment_plans')
        .update({
          title,
          total_amount: updatedPlan.total_amount,
          installments_count: count,
          installment_amount: instAmount,
          start_date: editPlanForm.start_date,
          due_day: dueDay,
          uva_count: uvaCountVal,
        })
        .eq('id', plan.id)
      if (planErr) {
        logSupabaseError('edit-plan', planErr)
        setNotice('Error al guardar el plan')
        return
      }
      for (const inst of pendingInsts) {
        await supabase.from('installments').delete().eq('id', inst.id)
      }
      const toInsert = buildPending()
      if (toInsert.length > 0) {
        const { error: instsErr } = await supabase.from('installments').insert(toInsert)
        if (instsErr) {
          logSupabaseError('edit-plan-installments', instsErr)
          setNotice('Error al recalcular cuotas')
          return
        }
      }
      const newPending = buildPending().map((i) => ({ id: crypto.randomUUID(), created_at: todayISO(), ...i }))
      setPlans((items) => items.map((p) => (p.id === plan.id ? updatedPlan : p)))
      setInstallments((items) => [
        ...items.filter((i) => i.plan_id !== plan.id || i.status === 'paid'),
        ...newPending,
      ])
    }

    setEditingPlan(null)
    setConfirmRecalcPlan(false)
    setNotice('Plan actualizado')
  }

  function validateEmailPassword(email: string, password?: string) {
    if (!email.trim()) return 'El email es requerido.'
    if (password !== undefined && !password) return 'La contrasena es requerida.'
    if (password !== undefined && password.length < 6) return 'La contrasena debe tener al menos 6 caracteres.'
    return ''
  }

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    const validation = validateEmailPassword(authEmail, authPassword)
    if (validation) {
      setAuthError(validation)
      return
    }

    if (!supabaseConfigured) {
      setSessionUserId(demoUser.id)
      return
    }

    setAuthLoading(true)
    const payload = { email: authEmail, password: authPassword }
    const response =
      authMode === 'login'
        ? await supabase.auth.signInWithPassword(payload)
        : await supabase.auth.signUp({
            ...payload,
            options: {
              data: { full_name: authName.trim() || null },
              emailRedirectTo: authRedirectUrl(),
            },
          })
    setAuthLoading(false)

    if (response.error) {
      setAuthError(response.error.message)
      return
    }
    setAuthSuccess(authMode === 'register' ? 'Cuenta creada. Revisa tu email si Supabase pide confirmacion.' : '')
  }

  async function handlePasswordReset(event: React.FormEvent) {
    event.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    const validation = validateEmailPassword(authEmail)
    if (validation) {
      setAuthError(validation)
      return
    }
    if (!supabaseConfigured) {
      setAuthError('La recuperacion de contrasena requiere configurar Supabase.')
      return
    }

    setAuthLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: authRedirectUrl(),
    })
    setAuthLoading(false)

    if (error) {
      setAuthError(error.message)
      return
    }
    setAuthSuccess('Te enviamos un email con el link para recuperar tu contrasena.')
  }

  async function handlePasswordUpdate(event: React.FormEvent) {
    event.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    const validation = validateEmailPassword(authUser?.email ?? 'usuario@recuperacion.local', newPassword)
    if (validation) {
      setAuthError(validation)
      return
    }
    if (!supabaseConfigured) return

    setAuthLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setAuthLoading(false)

    if (error) {
      setAuthError(error.message)
      return
    }
    setNewPassword('')
    setAuthMode('login')
    setAuthSuccess('Contrasena actualizada. Ya podes seguir usando Cuentas Claras.')
  }

  async function handleGoogleLogin() {
    setAuthError('')
    setAuthSuccess('')
    if (!supabaseConfigured) {
      setAuthError('Google OAuth requiere configurar Supabase.')
      return
    }

    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUrl(),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    setAuthLoading(false)
    if (error) setAuthError(error.message)
  }

  async function logout() {
    if (supabaseConfigured && !isDemo) await supabase.auth.signOut()
    setSession(null)
    setAuthUser(null)
    setSessionUserId(supabaseConfigured ? null : demoUser.id)
    setAuthMode('login')
  }

  const visibleGroupIds = members.filter((member) => member.user_id === currentUser.id).map((member) => member.group_id)
  const monthTransactions = transactions.filter((tx) => tx.user_id === currentUser.id && tx.occurred_on.startsWith(month))
  const filteredTransactions = monthTransactions.filter((tx) => {
    const typeOk = typeFilter === 'all' || tx.type === typeFilter
    const categoryOk = categoryFilter === 'all' || tx.category_id === categoryFilter
    const searchOk = !txSearch.trim() || tx.title.toLowerCase().includes(txSearch.trim().toLowerCase())
    return typeOk && categoryOk && searchOk
  })
  const visibleSplits = splits.filter((split) => visibleGroupIds.includes(split.group_id))
  const receivable = visibleSplits.filter((split) => split.creditor_id === currentUser.id && split.status === 'pending')
  const payable = visibleSplits.filter((split) => split.debtor_id === currentUser.id && split.status === 'pending')
  const upcomingInstallments = installments
    .filter((installment) => installment.status === 'pending')
    .filter((installment) => {
      const plan = plans.find((item) => item.id === installment.plan_id)
      return plan?.user_id === currentUser.id || (plan?.group_id && visibleGroupIds.includes(plan.group_id))
    })
    .slice(0, 5)

  const stats = useMemo(() => {
    const income = monthTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0)
    const expense = monthTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0)
    const owedToMe = receivable.reduce((sum, split) => sum + Number(split.amount), 0)
    const iOwe = payable.reduce((sum, split) => sum + Number(split.amount), 0)
    return { income, expense, owedToMe, iOwe, balance: income - expense + owedToMe - iOwe }
  }, [monthTransactions, payable, receivable])

  const installmentStats = useMemo(() => {
    const today = todayISO()
    const currentUva = uvaValue ?? (uvaManual ? Number(uvaManual) : null)
    const userInstallments = installments.filter((i) => {
      const plan = plans.find((p) => p.id === i.plan_id)
      return plan?.user_id === currentUser.id || (plan?.group_id && visibleGroupIds.includes(plan.group_id))
    })
    const pending = userInstallments.filter((i) => i.status === 'pending')
    const totalPending = pending.reduce((sum, i) => {
      const plan = plans.find((p) => p.id === i.plan_id)
      if (plan?.plan_type === 'UVA' && currentUva && i.uva_count) {
        return sum + Math.round(Number(i.uva_count) * currentUva * 100) / 100
      }
      return sum + Number(i.amount)
    }, 0)
    const paidThisMonth = userInstallments
      .filter((i) => i.status === 'paid' && i.paid_at?.startsWith(month))
      .reduce((sum, i) => sum + Number(i.amount), 0)
    const sortedPending = [...pending].sort((a, b) => a.due_on.localeCompare(b.due_on))
    const nextDue = sortedPending[0] ?? null
    const overdueCount = pending.filter((i) => i.due_on < today).length
    const pendingUvaCuotas = pending.filter((i) => plans.find((p) => p.id === i.plan_id)?.plan_type === 'UVA').length
    return { totalPending, paidThisMonth, nextDue, overdueCount, pendingCount: pending.length, pendingUvaCuotas }
  }, [installments, plans, currentUser.id, visibleGroupIds, month, uvaValue, uvaManual])

  const chartData = categories
    .map((category) => ({
      name: category.name,
      total: monthTransactions
        .filter((tx) => tx.type === 'expense' && tx.category_id === category.id)
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    }))
    .filter((item) => item.total > 0)

  function groupMembers(groupId: string) {
    return members.filter((member) => member.group_id === groupId)
  }

  function profileName(userId: string) {
    const profile = profiles.find((item) => item.id === userId)
    return profile?.full_name || profile?.email || 'Usuario'
  }

  function categoryName(categoryId: string | null) {
    return categories.find((item) => item.id === categoryId)?.name || 'Sin categoria'
  }

  function openTransaction(tx?: Transaction) {
    setEditingTx(tx ?? null)
    setTxForm(
      tx
        ? {
            title: tx.title,
            amount: String(tx.amount),
            occurred_on: tx.occurred_on,
            category_id: tx.category_id || '',
            type: tx.type,
            notes: tx.notes || '',
          }
        : emptyTransaction,
    )
    setDialog('transaction')
  }

  async function saveTransaction(event: React.FormEvent) {
    event.preventDefault()
    const payload = {
      user_id: currentUser.id,
      title: txForm.title.trim(),
      amount: Number(txForm.amount),
      occurred_on: txForm.occurred_on,
      category_id: txForm.category_id || null,
      type: txForm.type,
      notes: txForm.notes.trim() || null,
    }
    if (!payload.title || payload.amount <= 0) return

    if (isDemo) {
      if (editingTx) {
        setTransactions((items) => items.map((item) => (item.id === editingTx.id ? { ...item, ...payload } : item)))
      } else {
        setTransactions((items) => [{ id: crypto.randomUUID(), created_at: todayISO(), ...payload }, ...items])
      }
    } else if (editingTx) {
      await supabase.from('transactions').update(payload).eq('id', editingTx.id)
      await loadData(currentUser.id)
    } else {
      await supabase.from('transactions').insert(payload)
      await loadData(currentUser.id)
    }
    setDialog(null)
  }

  async function deleteTransaction(id: string) {
    if (isDemo) {
      setTransactions((items) => items.filter((item) => item.id !== id))
      return
    }
    await supabase.from('transactions').delete().eq('id', id)
    await loadData(currentUser.id)
  }

  async function saveGroup(event: React.FormEvent) {
    event.preventDefault()
    const creatorId = session?.user.id ?? sessionUserId ?? currentUser.id
    const payload = {
      name: groupForm.name.trim(),
      description: groupForm.description.trim() || null,
      created_by: creatorId,
    }
    if (!payload.name) return
    if (isDemo) {
      const group: Group = { id: crypto.randomUUID(), created_at: todayISO(), ...payload }
      setGroups((items) => [group, ...items])
      setMembers((items) => [
        { id: crypto.randomUUID(), group_id: group.id, user_id: currentUser.id, role: 'owner', created_at: todayISO(), profile: currentUser },
        ...items,
      ])
      setSelectedGroupId(group.id)
    } else {
      await ensureCurrentProfile(payload.created_by)
      const { data, error } = await supabase.from('groups').insert(payload).select().single()
      if (error) {
        logSupabaseError('create-group', error)
        setNotice('No se pudo crear el grupo')
        return
      }
      if (data) setSelectedGroupId(data.id)
      await loadData(payload.created_by)
    }
    setGroupForm({ name: '', description: '' })
    setDialog(null)
  }

  function buildSplits(groupId: string, amount: number, paidBy: string, mode: SplitMode, custom: Record<string, string>, dueOn: string, sharedExpenseId?: string, installmentId?: string) {
    const debtors = groupMembers(groupId).filter((member) => member.user_id !== paidBy)
    const allMembers = groupMembers(groupId)
    if (mode === 'equal') {
      const share = amount / Math.max(allMembers.length, 1)
      return debtors.map((member) => splitPayload(groupId, member.user_id, paidBy, share, null, dueOn, sharedExpenseId, installmentId))
    }
    return debtors
      .map((member) => {
        const raw = Number(custom[member.user_id] || 0)
        const value = mode === 'percentage' ? (amount * raw) / 100 : raw
        return splitPayload(groupId, member.user_id, paidBy, value, mode === 'percentage' ? raw : null, dueOn, sharedExpenseId, installmentId)
      })
      .filter((split) => split.amount > 0)
  }

  function splitPayload(groupId: string, debtorId: string, creditorId: string, amount: number, percentage: number | null, dueOn: string, sharedExpenseId?: string, installmentId?: string) {
    return {
      group_id: groupId,
      shared_expense_id: sharedExpenseId ?? null,
      installment_id: installmentId ?? null,
      debtor_id: debtorId,
      creditor_id: creditorId,
      amount: Math.round(amount * 100) / 100,
      percentage,
      status: 'pending' as const,
      due_on: dueOn,
      paid_at: null,
    }
  }

  async function saveSharedExpense(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(sharedForm.amount)
    if (!sharedForm.group_id || !sharedForm.title.trim() || amount <= 0) return

    if (isDemo) {
      const expense: SharedExpense = {
        id: crypto.randomUUID(),
        group_id: sharedForm.group_id,
        title: sharedForm.title.trim(),
        amount,
        occurred_on: sharedForm.occurred_on,
        category_id: sharedForm.category_id || null,
        paid_by: sharedForm.paid_by,
        split_mode: sharedForm.split_mode,
        created_by: currentUser.id,
        created_at: todayISO(),
      }
      setSharedExpenses((items) => [expense, ...items])
      setSplits((items) => [
        ...items,
        ...buildSplits(expense.group_id, amount, expense.paid_by, expense.split_mode as SplitMode, sharedForm.custom, expense.occurred_on, expense.id).map((split) => ({
          id: crypto.randomUUID(),
          created_at: todayISO(),
          ...split,
        })),
      ])
    } else {
      const { data } = await supabase
        .from('shared_expenses')
        .insert({
          group_id: sharedForm.group_id,
          title: sharedForm.title.trim(),
          amount,
          occurred_on: sharedForm.occurred_on,
          category_id: sharedForm.category_id || null,
          paid_by: sharedForm.paid_by,
          split_mode: sharedForm.split_mode,
          created_by: currentUser.id,
        })
        .select()
        .single()
      if (data) {
        await supabase.from('shared_expense_splits').insert(buildSplits(data.group_id, amount, data.paid_by, data.split_mode as SplitMode, sharedForm.custom, data.occurred_on, data.id))
      }
      await loadData(currentUser.id)
    }
    setSharedForm({ ...sharedForm, title: '', amount: '', custom: {} })
    setDialog(null)
  }

  async function saveInstallmentPlan(event: React.FormEvent) {
    event.preventDefault()
    const isUva = installmentForm.plan_type === 'UVA'
    const count = Number(installmentForm.installments_count)
    const dueDay = Number(installmentForm.due_day)
    const ownerUserId = sessionUserId ?? currentUser.id
    const normalizedGroupId = installmentForm.group_id || null
    const normalizedPaidBy = normalizedGroupId ? installmentForm.paid_by || ownerUserId : ownerUserId
    const uvaCountVal = installmentForm.uva_count ? Number(installmentForm.uva_count) : null
    const effectiveUvaValue = uvaValue ?? (uvaManual ? Number(uvaManual) : null)

    if (!installmentForm.title.trim() || !Number.isFinite(count) || !Number.isFinite(dueDay) || count <= 0 || dueDay < 1 || dueDay > 31 || !normalizedPaidBy || !installmentForm.start_date) {
      setNotice('No se pudo crear la cuota')
      return
    }

    let installmentAmount: number
    let totalAmount: number
    if (isUva) {
      if (!uvaCountVal || !effectiveUvaValue) {
        setNotice('Para un plan UVA se requiere la cantidad de UVA y el valor UVA actual.')
        return
      }
      installmentAmount = Math.round(uvaCountVal * effectiveUvaValue * 100) / 100
      totalAmount = installmentAmount * count
    } else {
      const total = Number(installmentForm.total_amount)
      if (!Number.isFinite(total) || total <= 0) {
        setNotice('No se pudo crear la cuota')
        return
      }
      installmentAmount = Math.round((total / count) * 100) / 100
      totalAmount = total
    }

    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
      setNotice('No se pudo crear la cuota')
      return
    }

    const buildInstallments = (planId: string) =>
      Array.from({ length: count }, (_, index) => {
        const date = new Date(`${installmentForm.start_date}T00:00:00`)
        date.setMonth(date.getMonth() + index)
        date.setDate(Math.min(dueDay, 28))
        return {
          plan_id: planId,
          number: index + 1,
          amount: installmentAmount,
          due_on: todayISO(date),
          status: 'pending' as const,
          paid_at: null,
          uva_count: isUva ? uvaCountVal : null,
          uva_value: isUva ? effectiveUvaValue : null,
        }
      })

    if (isDemo) {
      const plan: InstallmentPlan = {
        id: crypto.randomUUID(),
        user_id: ownerUserId,
        group_id: normalizedGroupId,
        title: installmentForm.title.trim(),
        total_amount: totalAmount,
        installments_count: count,
        installment_amount: installmentAmount,
        start_date: installmentForm.start_date,
        due_day: dueDay,
        paid_by: normalizedPaidBy,
        created_at: todayISO(),
        plan_type: installmentForm.plan_type,
        uva_count: isUva ? uvaCountVal : null,
        uva_value_at_creation: isUva ? effectiveUvaValue : null,
        uva_value_date: isUva && uvaDate ? uvaDate : null,
      }
      const createdInstallments = buildInstallments(plan.id).map((item) => ({ id: crypto.randomUUID(), created_at: todayISO(), ...item }))
      setPlans((items) => [plan, ...items])
      setInstallments((items) => [...items, ...createdInstallments])
      if (plan.group_id) {
        setSplits((items) => [
          ...items,
          ...createdInstallments.flatMap((installment) =>
            buildSplits(plan.group_id!, installment.amount, plan.paid_by, installmentForm.split_mode, installmentForm.custom, installment.due_on, undefined, installment.id).map((split) => ({
              id: crypto.randomUUID(),
              created_at: todayISO(),
              ...split,
            })),
          ),
        ])
      }
    } else {
      await ensureCurrentProfile(ownerUserId)
      const planPayload = {
        user_id: ownerUserId,
        group_id: normalizedGroupId,
        title: installmentForm.title.trim(),
        total_amount: totalAmount,
        installments_count: count,
        installment_amount: installmentAmount,
        start_date: installmentForm.start_date,
        due_day: dueDay,
        paid_by: normalizedPaidBy,
        plan_type: installmentForm.plan_type,
        uva_count: isUva ? uvaCountVal : null,
        uva_value_at_creation: isUva ? effectiveUvaValue : null,
        uva_value_date: isUva && uvaDate ? uvaDate : null,
      }
      const { data, error } = await supabase
        .from('installment_plans')
        .insert(planPayload)
        .select()
        .single()
      if (error) {
        logSupabaseError('create-installment-plan', error)
        setNotice('No se pudo crear la cuota')
        return
      }
      if (data) {
        const { data: createdInstallments, error: installmentsError } = await supabase
          .from('installments')
          .insert(buildInstallments(data.id))
          .select()
        if (installmentsError) {
          logSupabaseError('create-installments', installmentsError)
          setNotice('No se pudo crear la cuota')
          return
        }
        if (data.group_id && createdInstallments) {
          const { error: splitsError } = await supabase
            .from('shared_expense_splits')
            .insert(
              createdInstallments.flatMap((installment) =>
                buildSplits(data.group_id!, Number(installment.amount), data.paid_by, installmentForm.split_mode, installmentForm.custom, installment.due_on, undefined, installment.id),
              ),
            )
          if (splitsError) {
            logSupabaseError('create-installment-splits', splitsError)
            setNotice('No se pudo crear la cuota')
            return
          }
        }
      }
      await loadData(ownerUserId)
    }
    setInstallmentForm({ ...installmentForm, title: '', total_amount: '', uva_count: '', custom: {} })
    setDialog(null)
  }

  async function markSplitPaid(split: SharedExpenseSplit) {
    setMarkingId(split.id)
    const prevSplits = splits
    const prevPayments = payments
    setSplits((items) => items.map((item) => (item.id === split.id ? { ...item, status: 'paid', paid_at: todayISO() } : item)))
    setPayments((items) => [
      { id: crypto.randomUUID(), split_id: split.id, payer_id: split.debtor_id, receiver_id: split.creditor_id, amount: split.amount, paid_at: todayISO(), notes: null },
      ...items,
    ])
    if (!isDemo) {
      const { error } = await supabase.from('shared_expense_splits').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', split.id)
      if (error) {
        setSplits(prevSplits)
        setPayments(prevPayments)
        logSupabaseError('mark-split-paid', error)
        setNotice('Error al marcar como pagado')
      } else {
        void supabase.from('payments').insert({ split_id: split.id, payer_id: split.debtor_id, receiver_id: split.creditor_id, amount: split.amount })
      }
    }
    setMarkingId(null)
  }

  async function markSplitUnpaid(split: SharedExpenseSplit) {
    setMarkingId(split.id)
    const prev = splits
    setSplits((items) => items.map((item) => (item.id === split.id ? { ...item, status: 'pending', paid_at: null } : item)))
    if (!isDemo) {
      const { error } = await supabase.from('shared_expense_splits').update({ status: 'pending', paid_at: null }).eq('id', split.id)
      if (error) {
        setSplits(prev)
        logSupabaseError('mark-split-unpaid', error)
        setNotice('Error al desmarcar pago')
      }
    }
    setMarkingId(null)
  }

  async function markInstallmentPaid(installment: Installment) {
    const prev = installments
    setInstallments((items) => items.map((item) => (item.id === installment.id ? { ...item, status: 'paid', paid_at: todayISO() } : item)))
    if (!isDemo) {
      const { error } = await supabase.from('installments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', installment.id)
      if (error) { setInstallments(prev); logSupabaseError('mark-inst-paid', error); setNotice('Error al marcar cuota') }
    }
  }

  async function markInstallmentUnpaid(installment: Installment) {
    const prev = installments
    setInstallments((items) => items.map((item) => (item.id === installment.id ? { ...item, status: 'pending', paid_at: null } : item)))
    if (!isDemo) {
      const { error } = await supabase.from('installments').update({ status: 'pending', paid_at: null }).eq('id', installment.id)
      if (error) { setInstallments(prev); logSupabaseError('mark-inst-unpaid', error); setNotice('Error al desmarcar cuota') }
    }
  }

  function toggleExpense(expenseId: string) {
    setExpandedExpenses((prev) => {
      const next = new Set(prev)
      if (next.has(expenseId)) next.delete(expenseId)
      else next.add(expenseId)
      return next
    })
  }

  async function deleteSharedExpense(expenseId: string) {
    const expSplitIds = splits.filter((s) => s.shared_expense_id === expenseId).map((s) => s.id)
    setSplits((items) => items.filter((s) => s.shared_expense_id !== expenseId))
    setSharedExpenses((items) => items.filter((e) => e.id !== expenseId))
    setConfirmDeleteExpense(null)
    if (!isDemo) {
      if (expSplitIds.length > 0) {
        await supabase.from('shared_expense_splits').delete().in('id', expSplitIds)
      }
      const { error } = await supabase.from('shared_expenses').delete().eq('id', expenseId)
      if (error) {
        logSupabaseError('delete-shared-expense', error)
        setNotice('Error al eliminar el gasto')
        await loadData(currentUser.id)
      }
    }
  }

  function togglePlan(planId: string) {
    setExpandedPlans((prev) => {
      const next = new Set(prev)
      if (next.has(planId)) next.delete(planId)
      else next.add(planId)
      return next
    })
  }

  async function deletePlan(planId: string) {
    if (isDemo) {
      const planInstallmentIds = installments.filter((i) => i.plan_id === planId).map((i) => i.id)
      setSplits((items) => items.filter((s) => !s.installment_id || !planInstallmentIds.includes(s.installment_id)))
      setInstallments((items) => items.filter((i) => i.plan_id !== planId))
      setPlans((items) => items.filter((p) => p.id !== planId))
      return
    }
    const planInstallments = installments.filter((i) => i.plan_id === planId)
    for (const inst of planInstallments) {
      await supabase.from('shared_expense_splits').delete().eq('installment_id', inst.id)
    }
    await supabase.from('installments').delete().eq('plan_id', planId)
    await supabase.from('installment_plans').delete().eq('id', planId)
    await loadData(currentUser.id)
  }

  async function removeGroupMember(memberId: string, groupId: string) {
    const groupMembersList = members.filter((m) => m.group_id === groupId)
    const ownerCount = groupMembersList.filter((m) => m.role === 'owner').length
    const memberToRemove = members.find((m) => m.id === memberId)
    if (memberToRemove?.role === 'owner' && ownerCount <= 1) {
      setNotice('No puedes eliminar al único owner del grupo.')
      setConfirmDeleteMember(null)
      return
    }
    if (isDemo) {
      setMembers((items) => items.filter((m) => m.id !== memberId))
      setConfirmDeleteMember(null)
      return
    }
    const { error } = await supabase.from('group_members').delete().eq('id', memberId)
    if (error) { setNotice(error.message); setConfirmDeleteMember(null); return }
    setMembers((items) => items.filter((m) => m.id !== memberId))
    setConfirmDeleteMember(null)
  }

  function openSharePlan(plan: InstallmentPlan) {
    setSharedForm({
      group_id: plan.group_id || groups[0]?.id || '',
      title: plan.title,
      amount: String(plan.installment_amount),
      occurred_on: todayISO(),
      category_id: '',
      paid_by: plan.paid_by || currentUser.id,
      split_mode: 'equal',
      custom: {},
    })
    setDialog('shared')
  }

  // ── Invitations ──────────────────────────────────────────────────────────

  async function sendInvitation(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteEmail || !inviteGroupId) return
    if (isDemo) {
      const inv: GroupInvitation = {
        id: crypto.randomUUID(),
        group_id: inviteGroupId,
        inviter_id: currentUser.id,
        invitee_email: inviteEmail.toLowerCase(),
        status: 'pending',
        created_at: todayISO(),
        responded_at: null,
      }
      setInvitations((items) => [...items, inv])
      setActivityLog((items) => [{
        id: crypto.randomUUID(),
        group_id: inviteGroupId,
        actor_id: currentUser.id,
        action_type: 'member_invited',
        data: { email: inviteEmail },
        created_at: todayISO(),
      }, ...items])
    } else {
      const { error } = await supabase.rpc('create_group_invitation', { target_group_id: inviteGroupId, target_email: inviteEmail })
      if (error) { setNotice(error.message); return }
      const { data } = await supabase.from('group_invitations').select('*').order('created_at', { ascending: false })
      if (data) setInvitations(data)
    }
    setInviteEmail('')
    setDialog(null)
  }

  async function acceptInvitation(invId: string) {
    if (isDemo) {
      const inv = invitations.find((i) => i.id === invId)
      if (!inv) return
      const profile = profiles.find((p) => p.email.toLowerCase() === inv.invitee_email) ?? {
        id: crypto.randomUUID(),
        email: inv.invitee_email,
        full_name: inv.invitee_email.split('@')[0],
        avatar_url: null,
        created_at: todayISO(),
        updated_at: todayISO(),
      }
      setProfiles((items) => items.some((p) => p.email.toLowerCase() === inv.invitee_email) ? items : [...items, profile])
      setMembers((items) => [...items, { id: crypto.randomUUID(), group_id: inv.group_id, user_id: profile.id, role: 'member', created_at: todayISO(), profile }])
      setInvitations((items) => items.map((i) => i.id === invId ? { ...i, status: 'accepted', responded_at: todayISO() } : i))
      return
    }
    const { error } = await supabase.rpc('accept_group_invitation', { invitation_id: invId })
    if (error) { setNotice(error.message); return }
    const [{ data: invData }, { data: memberData }] = await Promise.all([
      supabase.from('group_invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('group_members').select('*, profile:profiles(*)'),
    ])
    if (invData) setInvitations(invData)
    if (memberData) setMembers(memberData as GroupMember[])
  }

  async function declineInvitation(invId: string) {
    if (isDemo) {
      setInvitations((items) => items.map((i) => i.id === invId ? { ...i, status: 'declined', responded_at: todayISO() } : i))
      return
    }
    const { error } = await supabase.rpc('decline_group_invitation', { invitation_id: invId })
    if (error) { setNotice(error.message); return }
    const { data } = await supabase.from('group_invitations').select('*').order('created_at', { ascending: false })
    if (data) setInvitations(data)
  }

  async function cancelInvitation(invId: string) {
    if (isDemo) {
      setInvitations((items) => items.map((i) => i.id === invId ? { ...i, status: 'cancelled', responded_at: todayISO() } : i))
      return
    }
    await supabase.from('group_invitations').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('id', invId)
    const { data } = await supabase.from('group_invitations').select('*').order('created_at', { ascending: false })
    if (data) setInvitations(data)
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  function markNotificationRead(notifId: string) {
    setNotifications((items) => items.map((n) => n.id === notifId ? { ...n, is_read: true } : n))
    if (!isDemo) void supabase.from('notifications').update({ is_read: true }).eq('id', notifId)
  }

  function markAllNotificationsRead() {
    setNotifications((items) => items.map((n) => ({ ...n, is_read: true })))
    if (!isDemo) void supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id)
  }

  // ── Custom categories ─────────────────────────────────────────────────────

  async function saveNewCategory(event: React.FormEvent) {
    event.preventDefault()
    if (!newCategoryForm.name.trim()) return
    const payload = { user_id: currentUser.id, name: newCategoryForm.name.trim(), color: newCategoryForm.color }
    if (isDemo) {
      setCategories((items) => [...items, { id: crypto.randomUUID(), created_at: todayISO(), ...payload }])
    } else {
      const { data, error } = await supabase.from('categories').insert(payload).select().single()
      if (error) { setNotice(error.message); return }
      if (data) setCategories((items) => [...items, data])
    }
    setNewCategoryForm({ name: '', color: '#0d9488' })
  }

  async function deleteCategory(catId: string) {
    if (isDemo) {
      setCategories((items) => items.filter((c) => c.id !== catId))
      setConfirmDeleteCategory(null)
      return
    }
    const { error } = await supabase.from('categories').delete().eq('id', catId)
    if (error) { setNotice(error.message); return }
    setCategories((items) => items.filter((c) => c.id !== catId))
    setConfirmDeleteCategory(null)
  }

  async function saveEditCategory(event: React.FormEvent, catId: string) {
    event.preventDefault()
    if (!editCategoryForm.name.trim()) return
    const payload = { name: editCategoryForm.name.trim(), color: editCategoryForm.color }
    if (isDemo) {
      setCategories((items) => items.map((c) => (c.id === catId ? { ...c, ...payload } : c)))
    } else {
      const { error } = await supabase.from('categories').update(payload).eq('id', catId)
      if (error) { setNotice(error.message); return }
      setCategories((items) => items.map((c) => (c.id === catId ? { ...c, ...payload } : c)))
    }
    setEditingCategory(null)
  }

  // ── Recurring expenses ────────────────────────────────────────────────────

  function computeNextDue(currentDue: string, frequency: RecurrenceFrequency): string {
    const date = new Date(`${currentDue}T00:00:00`)
    switch (frequency) {
      case 'weekly':   date.setDate(date.getDate() + 7); break
      case 'biweekly': date.setDate(date.getDate() + 14); break
      case 'monthly':  date.setMonth(date.getMonth() + 1); break
      case 'annual':   date.setFullYear(date.getFullYear() + 1); break
    }
    return todayISO(date)
  }

  async function saveRecurring(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(recurringForm.amount)
    if (!recurringForm.title.trim() || amount <= 0) return
    const payload = {
      user_id: currentUser.id,
      group_id: recurringForm.group_id || null,
      title: recurringForm.title.trim(),
      amount,
      category_id: recurringForm.category_id || null,
      frequency: recurringForm.frequency,
      start_date: recurringForm.start_date,
      next_due: recurringForm.start_date,
      paid_by: recurringForm.paid_by || null,
      split_mode: recurringForm.split_mode,
      is_active: true,
    }
    if (isDemo) {
      setRecurringExpenses((items) => [{ id: crypto.randomUUID(), created_at: todayISO(), ...payload }, ...items])
    } else {
      const { data, error } = await supabase.from('recurring_expenses').insert(payload).select().single()
      if (error) { setNotice(error.message); return }
      if (data) setRecurringExpenses((items) => [data, ...items])
    }
    setRecurringForm({ title: '', amount: '', category_id: '', frequency: 'monthly', start_date: todayISO(), group_id: '', paid_by: demoUser.id, split_mode: 'equal' })
    setDialog(null)
  }

  async function generateRecurring(rec: RecurringExpense) {
    if (rec.group_id) {
      const expense: SharedExpense = {
        id: crypto.randomUUID(),
        group_id: rec.group_id,
        title: rec.title,
        amount: rec.amount,
        occurred_on: rec.next_due,
        category_id: rec.category_id,
        paid_by: rec.paid_by ?? currentUser.id,
        split_mode: rec.split_mode,
        created_by: currentUser.id,
        created_at: todayISO(),
      }
      if (isDemo) {
        setSharedExpenses((items) => [expense, ...items])
        setSplits((items) => [
          ...items,
          ...buildSplits(expense.group_id, expense.amount, expense.paid_by, expense.split_mode as SplitMode, {}, expense.occurred_on, expense.id)
            .map((s) => ({ id: crypto.randomUUID(), created_at: todayISO(), ...s })),
        ])
      } else {
        const { data, error } = await supabase.from('shared_expenses').insert({
          group_id: rec.group_id,
          title: rec.title,
          amount: rec.amount,
          occurred_on: rec.next_due,
          category_id: rec.category_id,
          paid_by: rec.paid_by ?? currentUser.id,
          split_mode: rec.split_mode,
          created_by: currentUser.id,
        }).select().single()
        if (error) { setNotice(error.message); return }
        if (data) await supabase.from('shared_expense_splits').insert(buildSplits(data.group_id, data.amount, data.paid_by, data.split_mode as SplitMode, {}, data.occurred_on, data.id))
        await loadData(currentUser.id)
        return
      }
    } else {
      const tx: Transaction = {
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        title: rec.title,
        amount: rec.amount,
        occurred_on: rec.next_due,
        category_id: rec.category_id,
        type: 'expense',
        notes: 'Generado desde recurrente',
        created_at: todayISO(),
      }
      if (isDemo) {
        setTransactions((items) => [tx, ...items])
      } else {
        await supabase.from('transactions').insert({ user_id: currentUser.id, title: rec.title, amount: rec.amount, occurred_on: rec.next_due, category_id: rec.category_id, type: 'expense', notes: 'Generado desde recurrente' })
        await loadData(currentUser.id)
        return
      }
    }
    const nextDate = computeNextDue(rec.next_due, rec.frequency)
    if (isDemo) {
      setRecurringExpenses((items) => items.map((r) => r.id === rec.id ? { ...r, next_due: nextDate } : r))
    } else {
      await supabase.from('recurring_expenses').update({ next_due: nextDate }).eq('id', rec.id)
      setRecurringExpenses((items) => items.map((r) => r.id === rec.id ? { ...r, next_due: nextDate } : r))
    }
    setNotice(`Generado: ${rec.title}`)
  }

  async function toggleRecurring(rec: RecurringExpense) {
    if (isDemo) {
      setRecurringExpenses((items) => items.map((r) => r.id === rec.id ? { ...r, is_active: !r.is_active } : r))
      return
    }
    await supabase.from('recurring_expenses').update({ is_active: !rec.is_active }).eq('id', rec.id)
    setRecurringExpenses((items) => items.map((r) => r.id === rec.id ? { ...r, is_active: !r.is_active } : r))
  }

  async function deleteRecurring(recId: string) {
    if (isDemo) {
      setRecurringExpenses((items) => items.filter((r) => r.id !== recId))
      return
    }
    await supabase.from('recurring_expenses').delete().eq('id', recId)
    setRecurringExpenses((items) => items.filter((r) => r.id !== recId))
  }

  // ── Smart settlement ──────────────────────────────────────────────────────

  function computeSmartSettlement(groupId: string) {
    const groupSplits = splits.filter((s) => s.group_id === groupId && s.status === 'pending')
    const balanceMap = new Map<string, number>()
    for (const split of groupSplits) {
      balanceMap.set(split.creditor_id, (balanceMap.get(split.creditor_id) ?? 0) + Number(split.amount))
      balanceMap.set(split.debtor_id, (balanceMap.get(split.debtor_id) ?? 0) - Number(split.amount))
    }
    const cbal = Array.from(balanceMap.entries()).filter(([, v]) => v > 0.01).sort(([, a], [, b]) => b - a).map(([id, bal]) => ({ id, bal }))
    const dbal = Array.from(balanceMap.entries()).filter(([, v]) => v < -0.01).sort(([, a], [, b]) => a - b).map(([id, bal]) => ({ id, bal }))
    const settlements: { from: string; to: string; amount: number }[] = []
    let ci = 0, di = 0
    while (ci < cbal.length && di < dbal.length) {
      const amount = Math.min(cbal[ci].bal, Math.abs(dbal[di].bal))
      if (amount > 0.01) settlements.push({ from: dbal[di].id, to: cbal[ci].id, amount })
      cbal[ci].bal -= amount
      dbal[di].bal += amount
      if (cbal[ci].bal < 0.01) ci++
      if (Math.abs(dbal[di].bal) < 0.01) di++
    }
    return settlements
  }

  // ── Convert transaction to shared expense ─────────────────────────────────

  function openConvertToShared(tx: Transaction) {
    setConvertTxSource(tx)
    setSharedForm({
      group_id: groups[0]?.id || 'group-home',
      title: tx.title,
      amount: String(tx.amount),
      occurred_on: tx.occurred_on,
      category_id: tx.category_id || '',
      paid_by: currentUser.id,
      split_mode: 'equal',
      custom: {},
    })
    setDialog('convert-tx')
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  function exportTransactionsCSV() {
    const rows = [
      ['Fecha', 'Titulo', 'Tipo', 'Monto', 'Categoria', 'Notas'],
      ...transactions
        .filter((tx) => tx.user_id === currentUser.id)
        .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
        .map((tx) => [
          tx.occurred_on,
          tx.title,
          tx.type === 'income' ? 'Ingreso' : 'Gasto',
          String(tx.amount),
          categoryName(tx.category_id),
          tx.notes ?? '',
        ]),
    ]
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cuentas-claras-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Activity helpers ──────────────────────────────────────────────────────

  function formatActivityAction(entry: ActivityLogEntry): string {
    switch (entry.action_type) {
      case 'expense_created': return `creó "${String(entry.data?.title ?? 'gasto')}" · ${formatARS(Number(entry.data?.amount ?? 0))}`
      case 'member_invited':  return `invitó a ${String(entry.data?.email ?? 'alguien')}`
      case 'payment_made':    return `registró un pago`
      default:                return entry.action_type
    }
  }

const unreadCount = notifications.filter((n) => !n.is_read && n.user_id === currentUser.id).length

  if (loading) {
    return <div className="center-screen">Cargando Cuentas Claras...</div>
  }

  if (!sessionUserId || authMode === 'update-password') {
    return (
      <AuthScreen
        mode={authMode}
        email={authEmail}
        password={authPassword}
        newPassword={newPassword}
        fullName={authName}
        error={authError}
        success={authSuccess}
        loading={authLoading}
        supabaseEnabled={supabaseConfigured}
        onModeChange={(mode) => {
          setAuthMode(mode)
          setAuthError('')
          setAuthSuccess('')
          setAuthPassword('')
          setNewPassword('')
        }}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onNewPasswordChange={setNewPassword}
        onFullNameChange={setAuthName}
        onSubmitAuth={handleAuth}
        onSubmitReset={handlePasswordReset}
        onSubmitUpdate={handlePasswordUpdate}
        onGoogleLogin={handleGoogleLogin}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className={cn('sidebar', sidebarOpen && 'open')}>
        <div className="sidebar-head">
          <span className="brand-mark">CC</span>
          <div>
            <strong>Cuentas Claras</strong>
            <small>Finanzas compartidas</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={cn('nav-item', view === item.id && 'active')} onClick={() => { setView(item.id); setSidebarOpen(false) }}>
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setDarkMode((d) => !d)} aria-label="Cambiar tema">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            {darkMode ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button className="nav-item logout" onClick={logout}>
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen((s) => !s)} aria-label="Menu">
              <Menu size={20} />
            </button>
            <div className="topbar-title">
              <h1>{navItems.find((item) => item.id === view)?.label}</h1>
              <p>{currentUser.email}{isDemo ? ' · demo' : ''}</p>
            </div>
          </div>
          <div className="topbar-right">
            <input className="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <div style={{ position: 'relative' }}>
              <button className="theme-toggle notif-btn" onClick={() => setShowNotifications((s) => !s)} aria-label="Notificaciones">
                <Bell size={17} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notif-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="notif-head">
                    <span>Notificaciones</span>
                    {unreadCount > 0 && <button className="link-btn" onClick={markAllNotificationsRead}>Marcar todas</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="empty" style={{ padding: '12px 16px' }}>Sin notificaciones</div>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className={`notif-item${!n.is_read ? ' unread' : ''}`} onClick={() => markNotificationRead(n.id)}>
                        <strong>{n.title}</strong>
                        {n.body && <span>{n.body}</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="theme-toggle" onClick={() => setDarkMode((d) => !d)} aria-label="Cambiar tema">
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {notice && <div className="notice banner">{notice}</div>}
        {view === 'dashboard' && renderDashboard()}
        {view === 'movements' && renderMovements()}
        {view === 'groups' && renderGroups()}
        {view === 'installments' && renderInstallments()}
        {view === 'settlement' && renderSettlement()}
        {view === 'settings' && renderSettings()}
      </main>

      {dialog === 'transaction' && (
        <Modal title={editingTx ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={() => setDialog(null)}>
          <form onSubmit={saveTransaction} className="form-grid">
            <label>Titulo<input value={txForm.title} onChange={(event) => setTxForm({ ...txForm, title: event.target.value })} required /></label>
            <label>Monto<input type="number" min="1" step="0.01" value={txForm.amount} onChange={(event) => setTxForm({ ...txForm, amount: event.target.value })} required /></label>
            <label>Fecha<input type="date" value={txForm.occurred_on} onChange={(event) => setTxForm({ ...txForm, occurred_on: event.target.value })} required /></label>
            <label>Tipo<select value={txForm.type} onChange={(event) => setTxForm({ ...txForm, type: event.target.value as TransactionType })}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>
            <label>Categoria<CategorySelect value={txForm.category_id} onChange={(value) => setTxForm({ ...txForm, category_id: value })} categories={categories} /></label>
            <label className="span-2">Notas<textarea value={txForm.notes} onChange={(event) => setTxForm({ ...txForm, notes: event.target.value })} /></label>
            <button className="btn primary span-2" type="submit">Guardar</button>
          </form>
        </Modal>
      )}

      {dialog === 'group' && (
        <Modal title="Nuevo grupo" onClose={() => setDialog(null)}>
          <form onSubmit={saveGroup} className="stack">
            <label>Nombre<input value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /></label>
            <label>Descripcion<textarea value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} /></label>
            <button className="btn primary" type="submit">Crear grupo</button>
          </form>
        </Modal>
      )}

      {dialog === 'invite' && (
        <Modal title="Invitar usuario" onClose={() => setDialog(null)}>
          <form onSubmit={(e) => void sendInvitation(e)} className="stack">
            <label>Grupo<select value={inviteGroupId} onChange={(event) => setInviteGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label>Email<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label>
            <button className="btn primary" type="submit">Enviar invitación</button>
          </form>
        </Modal>
      )}

      {dialog === 'recurring' && (
        <Modal title="Nuevo gasto recurrente" onClose={() => setDialog(null)}>
          <form onSubmit={(e) => void saveRecurring(e)} className="form-grid">
            <label>Título<input value={recurringForm.title} onChange={(e) => setRecurringForm((f) => ({ ...f, title: e.target.value }))} required /></label>
            <label>Monto<input type="number" min="1" step="0.01" value={recurringForm.amount} onChange={(e) => setRecurringForm((f) => ({ ...f, amount: e.target.value }))} required /></label>
            <label>Categoría<CategorySelect value={recurringForm.category_id} onChange={(v) => setRecurringForm((f) => ({ ...f, category_id: v }))} categories={categories} /></label>
            <label>Frecuencia<select value={recurringForm.frequency} onChange={(e) => setRecurringForm((f) => ({ ...f, frequency: e.target.value as RecurrenceFrequency }))}>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
            </select></label>
            <label>Fecha inicio<input type="date" value={recurringForm.start_date} onChange={(e) => setRecurringForm((f) => ({ ...f, start_date: e.target.value }))} /></label>
            <label>Grupo (opcional)<select value={recurringForm.group_id} onChange={(e) => setRecurringForm((f) => ({ ...f, group_id: e.target.value }))}>
              <option value="">Personal</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
            <button className="btn primary span-2" type="submit">Guardar</button>
          </form>
        </Modal>
      )}

      {dialog === 'convert-tx' && convertTxSource && (
        <Modal title="Compartir gasto" onClose={() => { setDialog(null); setConvertTxSource(null) }}>
          <form onSubmit={saveSharedExpense} className="form-grid">
            <label>Título<input value={sharedForm.title} readOnly style={{ opacity: 0.7 }} /></label>
            <label>Monto<input type="number" value={sharedForm.amount} readOnly style={{ opacity: 0.7 }} /></label>
            <label>Grupo<GroupSelect groups={groups} value={sharedForm.group_id} onChange={(v) => setSharedForm((f) => ({ ...f, group_id: v, paid_by: groupMembers(v)[0]?.user_id || currentUser.id }))} /></label>
            <label>Pagado por<MemberSelect members={groupMembers(sharedForm.group_id)} value={sharedForm.paid_by} onChange={(v) => setSharedForm((f) => ({ ...f, paid_by: v }))} profileName={profileName} /></label>
            <SplitControls members={groupMembers(sharedForm.group_id).filter((m) => m.user_id !== sharedForm.paid_by)} mode={sharedForm.split_mode} custom={sharedForm.custom} setMode={(sm) => setSharedForm((f) => ({ ...f, split_mode: sm }))} setCustom={(c) => setSharedForm((f) => ({ ...f, custom: c }))} profileName={profileName} amount={Number(sharedForm.amount)} />
            <button className="btn primary span-2" type="submit">Compartir gasto</button>
          </form>
        </Modal>
      )}

      {dialog === 'shared' && (
        <Modal title="Nuevo gasto compartido" onClose={() => setDialog(null)}>
          <form onSubmit={saveSharedExpense} className="form-grid">
            <label>Grupo<GroupSelect groups={groups} value={sharedForm.group_id} onChange={(value) => setSharedForm({ ...sharedForm, group_id: value, paid_by: groupMembers(value)[0]?.user_id || currentUser.id })} /></label>
            <label>Titulo<input value={sharedForm.title} onChange={(event) => setSharedForm({ ...sharedForm, title: event.target.value })} required /></label>
            <label>Monto<input type="number" min="1" step="0.01" value={sharedForm.amount} onChange={(event) => setSharedForm({ ...sharedForm, amount: event.target.value })} required /></label>
            <label>Fecha<input type="date" value={sharedForm.occurred_on} onChange={(event) => setSharedForm({ ...sharedForm, occurred_on: event.target.value })} /></label>
            <label>Categoria<CategorySelect value={sharedForm.category_id} onChange={(value) => setSharedForm({ ...sharedForm, category_id: value })} categories={categories} /></label>
            <label>Pagado por<MemberSelect members={groupMembers(sharedForm.group_id)} value={sharedForm.paid_by} onChange={(value) => setSharedForm({ ...sharedForm, paid_by: value })} profileName={profileName} /></label>
            <SplitControls members={groupMembers(sharedForm.group_id).filter((member) => member.user_id !== sharedForm.paid_by)} mode={sharedForm.split_mode} custom={sharedForm.custom} setMode={(split_mode) => setSharedForm({ ...sharedForm, split_mode })} setCustom={(custom) => setSharedForm({ ...sharedForm, custom })} profileName={profileName} amount={Number(sharedForm.amount)} />
            <button className="btn primary span-2" type="submit">Crear gasto</button>
          </form>
        </Modal>
      )}

      <BottomNav view={view} onNavigate={setView} />

      {dialog === 'installment' && (
        <Modal title="Nuevo plan de cuotas" onClose={() => setDialog(null)}>
          <form onSubmit={saveInstallmentPlan} className="form-grid">
            <label>Titulo<input value={installmentForm.title} onChange={(event) => setInstallmentForm({ ...installmentForm, title: event.target.value })} required /></label>
            <label>Tipo de plan
              <select value={installmentForm.plan_type} onChange={(event) => {
                const pt = event.target.value as PlanType
                setInstallmentForm({ ...installmentForm, plan_type: pt, total_amount: '', uva_count: '' })
                if (pt === 'UVA') void fetchUvaValue()
              }}>
                <option value="ARS">ARS — Pesos fijos</option>
                <option value="UVA">UVA — Unidad de Valor Adquisitivo</option>
              </select>
            </label>
            {installmentForm.plan_type === 'ARS' ? (
              <label>Monto total<input type="number" min="1" step="0.01" value={installmentForm.total_amount} onChange={(event) => setInstallmentForm({ ...installmentForm, total_amount: event.target.value })} required /></label>
            ) : (
              <>
                <label>UVA por cuota<input type="number" min="0.0001" step="0.0001" placeholder="ej. 500" value={installmentForm.uva_count} onChange={(event) => setInstallmentForm({ ...installmentForm, uva_count: event.target.value })} required /></label>
                <div className="uva-fetch-bar">
                  {uvaLoading ? (
                    <span>Cargando valor UVA…</span>
                  ) : uvaValue ? (
                    <span>Valor UVA: <strong>{formatARS(uvaValue)}</strong> ({uvaDate}){installmentForm.uva_count && <> · Cuota est.: <strong>{formatARS(Number(installmentForm.uva_count) * uvaValue)}</strong></>}</span>
                  ) : (
                    <span>
                      Valor UVA no disponible.{' '}
                      <button type="button" className="btn small ghost" onClick={() => void fetchUvaValue(true)}>Obtener</button>
                      {' '}o ingresar manualmente:
                      <input type="number" className="uva-manual-input" min="1" step="0.01" placeholder="ej. 1350" value={uvaManual} onChange={(e) => setUvaManual(e.target.value)} />
                    </span>
                  )}
                </div>
              </>
            )}
            <label>Cantidad de cuotas<input type="number" min="1" value={installmentForm.installments_count} onChange={(event) => setInstallmentForm({ ...installmentForm, installments_count: event.target.value })} required /></label>
            <label>Fecha inicio<input type="date" value={installmentForm.start_date} onChange={(event) => setInstallmentForm({ ...installmentForm, start_date: event.target.value })} /></label>
            <label>Dia vencimiento<input type="number" min="1" max="31" value={installmentForm.due_day} onChange={(event) => setInstallmentForm({ ...installmentForm, due_day: event.target.value })} /></label>
            <label>Grupo opcional<select value={installmentForm.group_id} onChange={(event) => setInstallmentForm({ ...installmentForm, group_id: event.target.value, paid_by: groupMembers(event.target.value)[0]?.user_id || currentUser.id })}><option value="">Privada</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            {installmentForm.group_id && <label>Pagado por<MemberSelect members={groupMembers(installmentForm.group_id)} value={installmentForm.paid_by} onChange={(value) => setInstallmentForm({ ...installmentForm, paid_by: value })} profileName={profileName} /></label>}
            {installmentForm.group_id && <SplitControls members={groupMembers(installmentForm.group_id).filter((member) => member.user_id !== installmentForm.paid_by)} mode={installmentForm.split_mode} custom={installmentForm.custom} setMode={(split_mode) => setInstallmentForm({ ...installmentForm, split_mode })} setCustom={(custom) => setInstallmentForm({ ...installmentForm, custom })} profileName={profileName} amount={Number(installmentForm.total_amount)} />}
            <button className="btn primary span-2" type="submit">Generar cuotas</button>
          </form>
        </Modal>
      )}

      {editingPlan && (
        <Modal title={`Editar: ${editingPlan.title}`} onClose={() => { setEditingPlan(null); setConfirmRecalcPlan(false) }}>
          <form onSubmit={saveEditPlan} className="form-grid">
            <label className="span-2">Nombre del plan<input value={editPlanForm.title} onChange={(e) => setEditPlanForm((f) => ({ ...f, title: e.target.value }))} required /></label>
            {editingPlan.plan_type === 'ARS' ? (
              <label>Monto total<input type="number" min="1" step="0.01" value={editPlanForm.total_amount} onChange={(e) => setEditPlanForm((f) => ({ ...f, total_amount: e.target.value }))} required /></label>
            ) : (
              <label>UVA por cuota<input type="number" min="0.0001" step="0.0001" value={editPlanForm.uva_count} onChange={(e) => setEditPlanForm((f) => ({ ...f, uva_count: e.target.value }))} /></label>
            )}
            <label>Cantidad de cuotas<input type="number" min="1" value={editPlanForm.installments_count} onChange={(e) => setEditPlanForm((f) => ({ ...f, installments_count: e.target.value }))} required /></label>
            <label>Fecha inicio<input type="date" value={editPlanForm.start_date} onChange={(e) => setEditPlanForm((f) => ({ ...f, start_date: e.target.value }))} /></label>
            <label>Dia vencimiento<input type="number" min="1" max="31" value={editPlanForm.due_day} onChange={(e) => setEditPlanForm((f) => ({ ...f, due_day: e.target.value }))} /></label>
            {editingPlan.plan_type === 'UVA' && (
              <div className="uva-fetch-bar span-2">
                {uvaLoading ? <span>Cargando…</span>
                  : uvaValue ? <span>UVA actual: <strong>{formatARS(uvaValue)}</strong> ({uvaDate})</span>
                  : <span>
                    Sin valor UVA.{' '}
                    <button type="button" className="btn small ghost" onClick={() => void fetchUvaValue(true)}>Obtener</button>
                    {' '}o manual:
                    <input type="number" className="uva-manual-input" min="1" step="0.01" placeholder="ej. 1350" value={uvaManual} onChange={(e) => setUvaManual(e.target.value)} />
                  </span>
                }
              </div>
            )}
            {(() => {
              const paidCount = installments.filter((i) => i.plan_id === editingPlan.id && i.status === 'paid').length
              if (paidCount === 0) return null
              return (
                <div className={cn('edit-plan-warning span-2', confirmRecalcPlan && 'edit-plan-warning--confirm')}>
                  {confirmRecalcPlan ? (
                    <>
                      <AlertCircle size={14} />
                      <span>Hay {paidCount} cuota{paidCount !== 1 ? 's' : ''} pagada{paidCount !== 1 ? 's' : ''} que se conservarán. Las pendientes se recalcularán. ¿Confirmar?</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} />
                      <span>{paidCount} cuota{paidCount !== 1 ? 's' : ''} pagada{paidCount !== 1 ? 's' : ''} — al guardar, solo se recalcularán las pendientes.</span>
                    </>
                  )}
                </div>
              )
            })()}
            <button className="btn primary span-2" type="submit">
              {confirmRecalcPlan ? 'Confirmar y recalcular' : 'Guardar cambios'}
            </button>
            {confirmRecalcPlan && (
              <button type="button" className="btn span-2" onClick={() => setConfirmRecalcPlan(false)}>Cancelar</button>
            )}
          </form>
        </Modal>
      )}
    </div>
  )

  function renderDashboard() {
    const chartFill   = darkMode ? '#2dd4bf' : '#0d9488'
    const gridStroke  = darkMode ? '#263c58' : '#e2e8e4'
    const axisColor   = darkMode ? '#64748b' : '#94a3b8'
    const tooltipBg   = darkMode ? '#182636' : '#ffffff'
    const tooltipBd   = darkMode ? '#263c58' : '#e2e8e4'
    const tooltipText = darkMode ? '#e2eff0' : '#0f172a'
    const nextDuePlan = installmentStats.nextDue ? plans.find((p) => p.id === installmentStats.nextDue?.plan_id) : null

    return (
      <section className="page-stack">
        <div className="metric-grid">
          <Metric title="Gastos personales" value={formatARS(stats.expense)} icon={ArrowDownRight} tone="danger" />
          <Metric title="Ingresos del mes" value={formatARS(stats.income)} icon={ArrowUpRight} tone="success" />
          <Metric title="Me deben" value={formatARS(stats.owedToMe)} icon={DollarSign} tone="info" />
          <Metric title="Debo" value={formatARS(stats.iOwe)} icon={WalletCards} tone="warning" />
          <Metric title="Cuotas pendientes" value={String(installmentStats.pendingCount)} icon={CalendarClock} tone="neutral" />
          <Metric title="Balance mensual" value={formatARS(stats.balance)} icon={BarChart3} tone={stats.balance >= 0 ? 'success' : 'danger'} />
        </div>

        {(installmentStats.totalPending > 0 || installmentStats.paidThisMonth > 0) && (
          <section className="panel">
            <div className="panel-head">
              <h2>Resumen de cuotas</h2>
              {installmentStats.overdueCount > 0 && (
                <Badge tone="danger"><AlertCircle size={11} style={{ marginRight: 4 }} />{installmentStats.overdueCount} vencida{installmentStats.overdueCount > 1 ? 's' : ''}</Badge>
              )}
            </div>
            <div className="inst-summary-grid">
              <div className="inst-summary-card warning">
                <span className="inst-summary-label">Pendiente total</span>
                <strong className="inst-summary-value">{formatARS(installmentStats.totalPending)}</strong>
                <span className="inst-summary-sub">{installmentStats.pendingCount} cuota{installmentStats.pendingCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="inst-summary-card success">
                <span className="inst-summary-label">Pagado este mes</span>
                <strong className="inst-summary-value">{formatARS(installmentStats.paidThisMonth)}</strong>
              </div>
              {installmentStats.nextDue && (
                <div className="inst-summary-card info">
                  <span className="inst-summary-label">Próx. vencimiento</span>
                  <strong className="inst-summary-value inst-summary-value--date">{formatDateAR(installmentStats.nextDue.due_on)}</strong>
                  <span className="inst-summary-sub">{nextDuePlan?.title} · {formatARS(installmentStats.nextDue.amount)}</span>
                </div>
              )}
              {installmentStats.overdueCount > 0 && (
                <div className="inst-summary-card danger">
                  <span className="inst-summary-label">Vencidas sin pagar</span>
                  <strong className="inst-summary-value">{installmentStats.overdueCount}</strong>
                  <span className="inst-summary-sub">Revisar cuotas</span>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Gastos por categoria</h2></div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} tickLine={false} axisLine={false} tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatARS(Number(value))}
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBd}`, borderRadius: 8, color: tooltipText, fontSize: 13 }}
                    cursor={{ fill: darkMode ? 'rgba(45,212,191,.07)' : 'rgba(13,148,136,.06)' }}
                  />
                  <Bar dataKey="total" fill={chartFill} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Cuotas por vencer</h2></div>
            {upcomingInstallments.length === 0 ? (
              <div className="empty">No hay cuotas pendientes.</div>
            ) : (
              <div className="inst-list">
                {upcomingInstallments.map((installment) => {
                  const plan = plans.find((item) => item.id === installment.plan_id)
                  return (
                    <div key={installment.id} className="inst-row">
                      <span className={cn('inst-num', installment.status === 'paid' && 'paid')}>{installment.number}</span>
                      <span className="inst-date">{plan?.title} · {formatDateAR(installment.due_on)}</span>
                      <span className="inst-amount">{formatARS(installment.amount)}</span>
                      <Status status={installment.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    )
  }

  function renderMovements() {
    return (
      <section className="page-stack">
        <div className="actions-row tx-filter-bar">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | TransactionType)}>
            <option value="all">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Todas las cats.</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <button className="btn primary push-right" onClick={() => { setConfirmDeleteTx(null); openTransaction() }}><Plus size={16} />Nuevo</button>
        </div>
        <section className="panel">
          {filteredTransactions.length === 0 ? (
            <div className="empty">No hay movimientos para estos filtros.</div>
          ) : (
            <div className="tx-list">
              {filteredTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.category_id)
                const isConfirming = confirmDeleteTx === tx.id
                return (
                  <div key={tx.id} className={cn('tx-row', isConfirming && 'confirming')}>
                    <div className="tx-icon" style={cat?.color ? { background: `${cat.color}18`, color: cat.color } : undefined}>
                      {tx.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="tx-body">
                      <div className="tx-title-row">
                        <span className="tx-title">{tx.title}</span>
                        <span className={cn('tx-amount', tx.type)}>
                          {tx.type === 'income' ? '+' : '-'}{formatARS(tx.amount)}
                        </span>
                      </div>
                      <div className="tx-tags">
                        {cat && <span className="tx-cat-dot" style={{ background: cat.color }} />}
                        <span className="tx-date">{formatDateAR(tx.occurred_on)}</span>
                        {cat && <span className="tx-meta">{cat.name}</span>}
                        <span className={cn('badge', tx.type === 'income' ? 'success' : 'neutral')} style={{ fontSize: 10, padding: '1px 7px', marginLeft: 'auto' }}>
                          {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </span>
                      </div>
                      {isConfirming ? (
                        <div className="tx-confirm-delete" style={{ marginTop: 8 }}>
                          <span>¿Eliminar?</span>
                          <button className="btn small danger" onClick={() => { void deleteTransaction(tx.id); setConfirmDeleteTx(null) }}>Sí</button>
                          <button className="btn small" onClick={() => setConfirmDeleteTx(null)}>No</button>
                        </div>
                      ) : (
                        <div className="tx-actions">
                          <button className="btn small ghost" onClick={() => openTransaction(tx)}><Edit3 size={12} />Editar</button>
                          {tx.type === 'expense' && groups.length > 0 && (
                            <button className="btn small ghost" onClick={() => openConvertToShared(tx)}><Users size={12} />Compartir</button>
                          )}
                          <button className="btn small ghost danger" onClick={() => setConfirmDeleteTx(tx.id)}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </section>
    )
  }

  function renderGroups() {
    const myPendingInvitations = invitations.filter(
      (inv) => inv.invitee_email.toLowerCase() === currentUser.email.toLowerCase() && inv.status === 'pending',
    )
    const groupPendingInvitations = invitations.filter((inv) => inv.group_id === selectedGroupId && inv.status === 'pending')
    const groupActivity = activityLog.filter((a) => a.group_id === selectedGroupId).slice(0, 8)

    return (
      <section className="page-stack">
        <div className="actions-row">
          <button className="btn primary" onClick={() => setDialog('group')}><Plus size={16} />Crear grupo</button>
          <button className="btn" onClick={() => { setInviteGroupId(groups[0]?.id || ''); setDialog('invite') }}><UserPlus size={16} />Invitar</button>
          <button className="btn" onClick={() => setDialog('shared')}><Receipt size={16} />Gasto compartido</button>
        </div>

        {myPendingInvitations.length > 0 && (
          <section className="panel">
            <div className="panel-head">
              <h2>Mis invitaciones</h2>
              <Badge tone="warning">{myPendingInvitations.length}</Badge>
            </div>
            <div className="invite-list">
              {myPendingInvitations.map((inv) => {
                const grp = groups.find((g) => g.id === inv.group_id)
                return (
                  <div key={inv.id} className="invite-card">
                    <div className="invite-avatar">{(grp?.name ?? 'G').slice(0, 1).toUpperCase()}</div>
                    <div className="invite-card-body">
                      <strong>{grp?.name ?? 'Grupo'}</strong>
                      <span>Invitado por {profileName(inv.inviter_id)}</span>
                    </div>
                    <div className="invite-actions">
                      <button className="btn small primary" onClick={() => void acceptInvitation(inv.id)}>Aceptar</button>
                      <button className="btn small" onClick={() => void declineInvitation(inv.id)}>Declinar</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="group-grid">
          {groups.map((group) => (
            <section key={group.id} className={cn('panel group-card', selectedGroupId === group.id && 'selected')} onClick={() => setSelectedGroupId(group.id)}>
              <div className="panel-head">
                <div><h2>{group.name}</h2><p>{group.description}</p></div>
                <Badge tone="info">{groupMembers(group.id).length} miembro{groupMembers(group.id).length !== 1 ? 's' : ''}</Badge>
              </div>
              <div className="avatar-row">
                {groupMembers(group.id).map((member) => <span key={member.id} className="avatar" title={profileName(member.user_id)}>{profileName(member.user_id).slice(0, 1)}</span>)}
              </div>
            </section>
          ))}
        </div>

        {(() => {
          const selectedMembers = members.filter((m) => m.group_id === selectedGroupId)
          const isOwner = selectedMembers.some((m) => m.user_id === currentUser.id && m.role === 'owner')
          return (
            <section className="panel">
              <div className="panel-head">
                <h2>Miembros</h2>
                <Badge tone="neutral">{selectedMembers.length}</Badge>
              </div>
              <div className="member-list">
                {selectedMembers.map((m) => (
                  <div key={m.id} className="member-row">
                    <span className="avatar">{profileName(m.user_id).slice(0, 1).toUpperCase()}</span>
                    <div className="member-info">
                      <strong>{profileName(m.user_id)}</strong>
                      <span className="member-email">{m.profile?.email ?? ''}</span>
                    </div>
                    <Badge tone={m.role === 'owner' ? 'info' : 'neutral'}>{m.role === 'owner' ? 'Owner' : 'Miembro'}</Badge>
                    {isOwner && m.user_id !== currentUser.id && (
                      confirmDeleteMember === m.id ? (
                        <div className="tx-confirm-delete">
                          <span>¿Eliminar?</span>
                          <button className="btn small danger" onClick={() => void removeGroupMember(m.id, m.group_id)}>Sí</button>
                          <button className="btn small" onClick={() => setConfirmDeleteMember(null)}>No</button>
                        </div>
                      ) : (
                        <button className="icon-btn sm danger" onClick={() => setConfirmDeleteMember(m.id)} aria-label="Eliminar miembro"><Trash2 size={13} /></button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        {groupPendingInvitations.length > 0 && (
          <section className="panel">
            <div className="panel-head"><h2>Invitaciones pendientes</h2><Badge tone="warning">{groupPendingInvitations.length}</Badge></div>
            <div className="invite-list">
              {groupPendingInvitations.map((inv) => (
                <div key={inv.id} className="invite-card">
                  <div className="invite-avatar">{inv.invitee_email.slice(0, 1).toUpperCase()}</div>
                  <div className="invite-card-body">
                    <strong>{inv.invitee_email}</strong>
                    <span>Enviada · {formatDateAR(inv.created_at.split('T')[0])}</span>
                  </div>
                  <button className="btn small danger" onClick={() => void cancelInvitation(inv.id)}>Cancelar</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Group balance summary */}
        {(() => {
          const gSplits = splits.filter((s) => s.group_id === selectedGroupId)
          const toMe   = gSplits.filter((s) => s.creditor_id === currentUser.id && s.status === 'pending').reduce((sum, s) => sum + Number(s.amount), 0)
          const iOwe   = gSplits.filter((s) => s.debtor_id === currentUser.id && s.status === 'pending').reduce((sum, s) => sum + Number(s.amount), 0)
          const paid   = gSplits.filter((s) => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount), 0)
          if (!toMe && !iOwe && !paid) return null
          return (
            <section className="panel">
              <div className="panel-head"><h2>Balance del grupo</h2></div>
              <div className="gbal-grid">
                {toMe > 0 && (
                  <div className="gbal-card positive">
                    <span className="gbal-label">Me deben</span>
                    <strong className="gbal-value">{formatARS(toMe)}</strong>
                  </div>
                )}
                {iOwe > 0 && (
                  <div className="gbal-card negative">
                    <span className="gbal-label">Debo</span>
                    <strong className="gbal-value">{formatARS(iOwe)}</strong>
                  </div>
                )}
                {paid > 0 && (
                  <div className="gbal-card neutral">
                    <span className="gbal-label">Liquidado</span>
                    <strong className="gbal-value">{formatARS(paid)}</strong>
                  </div>
                )}
              </div>
            </section>
          )
        })()}

        {/* Shared expenses — expense cards */}
        {(() => {
          const groupExpenses = sharedExpenses.filter((e) => e.group_id === selectedGroupId)
          return (
            <section className="panel">
              <div className="panel-head">
                <h2>Gastos compartidos</h2>
                <button className="btn small primary" onClick={() => {
                  setSharedForm((f) => ({ ...f, group_id: selectedGroupId, paid_by: currentUser.id, title: '', amount: '', custom: {} }))
                  setDialog('shared')
                }}><Plus size={14} />Nuevo</button>
              </div>
              {groupExpenses.length === 0 ? (
                <div className="empty">Sin gastos compartidos. Usá el botón "Nuevo" para agregar uno.</div>
              ) : (
                <div className="expense-list">
                  {groupExpenses.map((expense) => {
                    const expSplits = splits.filter((s) => s.shared_expense_id === expense.id)
                    const paidCount = expSplits.filter((s) => s.status === 'paid').length
                    const expStatus: 'pending' | 'partial' | 'paid' = paidCount === 0 ? 'pending' : paidCount === expSplits.length && expSplits.length > 0 ? 'paid' : 'partial'
                    const isExpanded = expandedExpenses.has(expense.id)
                    const isConfirmDel = confirmDeleteExpense === expense.id
                    const statusLabel = expStatus === 'paid' ? 'Pagado' : expStatus === 'partial' ? `${paidCount}/${expSplits.length} pagados` : `${expSplits.length} pendiente${expSplits.length !== 1 ? 's' : ''}`
                    const statusTone = expStatus === 'paid' ? 'success' : expStatus === 'partial' ? 'warning' : 'neutral'

                    return (
                      <div key={expense.id} className={`expense-card ${expStatus}`}>
                        <div className="expense-card-head" onClick={() => toggleExpense(expense.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleExpense(expense.id)}>
                          <div className="expense-card-icon">
                            <Receipt size={16} />
                          </div>
                          <div className="expense-card-info">
                            <div className="expense-card-title-row">
                              <strong className="expense-card-title">{expense.title}</strong>
                              <span className="expense-card-amount">{formatARS(expense.amount)}</span>
                            </div>
                            <div className="expense-card-meta">
                              <span>Pagó <strong>{profileName(expense.paid_by)}</strong></span>
                              <span>·</span>
                              <span>{formatDateAR(expense.occurred_on)}</span>
                              {expense.category_id && <><span>·</span><span>{categoryName(expense.category_id)}</span></>}
                            </div>
                          </div>
                          <div className="expense-card-right">
                            <Badge tone={statusTone}>{statusLabel}</Badge>
                            <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); toggleExpense(expense.id) }} aria-label={isExpanded ? 'Contraer' : 'Ver splits'}>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="expense-splits">
                            {expSplits.length === 0 ? (
                              <div className="empty" style={{ padding: '12px 16px', fontSize: 13 }}>Sin divisiones registradas.</div>
                            ) : (
                              expSplits.map((split) => (
                                <div key={split.id} className={`split-item ${split.status}`}>
                                  <span className="avatar sm">{profileName(split.debtor_id).slice(0, 1).toUpperCase()}</span>
                                  <div className="split-item-info">
                                    <strong>{profileName(split.debtor_id)}</strong>
                                    <span>→ {profileName(split.creditor_id)}</span>
                                  </div>
                                  <span className="split-item-amount">{formatARS(split.amount)}</span>
                                  <div className="split-item-actions">
                                    {split.status === 'pending' ? (
                                      <button
                                        className="btn small primary"
                                        disabled={markingId === split.id}
                                        onClick={() => void markSplitPaid(split)}
                                      >
                                        <Check size={12} />{markingId === split.id ? '…' : 'Pagar'}
                                      </button>
                                    ) : (
                                      <>
                                        <Badge tone="success">Pagado</Badge>
                                        <button
                                          className="icon-btn sm ghost"
                                          disabled={markingId === split.id}
                                          onClick={() => void markSplitUnpaid(split)}
                                          title="Desmarcar como pagado"
                                        >
                                          <RotateCcw size={13} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                            <div className="expense-card-footer">
                              {isConfirmDel ? (
                                <div className="tx-confirm-delete">
                                  <span>¿Eliminar gasto?</span>
                                  <button className="btn small danger" onClick={() => void deleteSharedExpense(expense.id)}>Sí</button>
                                  <button className="btn small" onClick={() => setConfirmDeleteExpense(null)}>No</button>
                                </div>
                              ) : (
                                <button className="icon-btn sm danger" onClick={() => setConfirmDeleteExpense(expense.id)} aria-label="Eliminar gasto compartido">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })()}

        {groupActivity.length > 0 && (
          <section className="panel">
            <div className="panel-head"><h2>Actividad reciente</h2></div>
            <div className="activity-list">
              {groupActivity.map((entry) => (
                <div key={entry.id} className="activity-item">
                  <div className="activity-icon">
                    {entry.action_type === 'expense_created' ? <Receipt size={13} /> :
                     entry.action_type === 'member_invited' ? <UserPlus size={13} /> :
                     entry.action_type === 'payment_made' ? <Check size={13} /> :
                     <Clock size={13} />}
                  </div>
                  <div className="activity-body">
                    <span className="activity-actor">{profileName(entry.actor_id)}</span>
                    {' '}
                    <span className="activity-action">{formatActivityAction(entry)}</span>
                    <span className="activity-time">{formatDateAR(entry.created_at.split('T')[0])}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    )
  }

  function renderInstallments() {
    const today = todayISO()
    const currentUva = uvaValue ?? (uvaManual ? Number(uvaManual) : null)
    const userPlans = plans.filter((p) => p.user_id === currentUser.id || (p.group_id && visibleGroupIds.includes(p.group_id)))
    const allUserInsts = installments.filter((i) => userPlans.some((p) => p.id === i.plan_id))
    const totalFinanciado = userPlans.reduce((s, p) => s + Number(p.total_amount), 0)
    const totalPagado = allUserInsts.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
    const totalPendiente = allUserInsts.filter((i) => i.status === 'pending').reduce((s, i) => {
      const plan = userPlans.find((p) => p.id === i.plan_id)
      if (plan?.plan_type === 'UVA' && currentUva && i.uva_count) {
        return s + Math.round(Number(i.uva_count) * currentUva * 100) / 100
      }
      return s + Number(i.amount)
    }, 0)
    const globalPaidCount = allUserInsts.filter((i) => i.status === 'paid').length
    const globalPendingCount = allUserInsts.filter((i) => i.status === 'pending').length
    const globalOverdueCount = allUserInsts.filter((i) => i.status === 'pending' && i.due_on < today).length
    const nextInstGlobal = allUserInsts.filter((i) => i.status === 'pending').sort((a, b) => a.due_on.localeCompare(b.due_on))[0] ?? null
    const totalMonths = userPlans.reduce((s, p) => s + p.installments_count, 0)
    const avgMonthly = totalMonths > 0 ? totalFinanciado / totalMonths : 0
    const hasUvaPlans = userPlans.some((p) => p.plan_type === 'UVA')

    return (
      <section className="page-stack">
        <div className="actions-row">
          <button className="btn primary" onClick={() => setDialog('installment')}><Plus size={16} />Nuevo plan</button>
        </div>

        {userPlans.length > 0 && (
          <section className="panel">
            <div className="panel-head">
              <h2>Resumen global</h2>
              {globalOverdueCount > 0 && <Badge tone="danger"><AlertCircle size={11} style={{ marginRight: 4 }} />{globalOverdueCount} vencida{globalOverdueCount > 1 ? 's' : ''}</Badge>}
            </div>
            <div className="inst-summary-grid">
              <div className="inst-summary-card neutral">
                <span className="inst-summary-label">Total financiado</span>
                <strong className="inst-summary-value">{formatARS(totalFinanciado)}</strong>
                <span className="inst-summary-sub">{userPlans.length} plan{userPlans.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="inst-summary-card success">
                <span className="inst-summary-label">Pagado</span>
                <strong className="inst-summary-value">{formatARS(totalPagado)}</strong>
                <span className="inst-summary-sub">{globalPaidCount} cuota{globalPaidCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="inst-summary-card warning">
                <span className="inst-summary-label">Pendiente</span>
                <strong className="inst-summary-value">{formatARS(totalPendiente)}</strong>
                <span className="inst-summary-sub">
                  {globalPendingCount} cuota{globalPendingCount !== 1 ? 's' : ''}
                  {hasUvaPlans && currentUva && ' · incl. UVA'}
                </span>
              </div>
              {nextInstGlobal ? (
                <div className="inst-summary-card info">
                  <span className="inst-summary-label">Próx. vencimiento</span>
                  <strong className="inst-summary-value inst-summary-value--date">{formatDateAR(nextInstGlobal.due_on)}</strong>
                  <span className="inst-summary-sub">{formatARS(nextInstGlobal.amount)}</span>
                </div>
              ) : (
                <div className="inst-summary-card neutral">
                  <span className="inst-summary-label">Promedio mensual</span>
                  <strong className="inst-summary-value">{formatARS(avgMonthly)}</strong>
                  <span className="inst-summary-sub">por plan activo</span>
                </div>
              )}
            </div>
            {hasUvaPlans && (
              <div className="uva-global-bar">
                {currentUva ? (
                  <>
                    <span>UVA actual: <strong>{formatARS(currentUva)}</strong> — {uvaDate ?? '—'}</span>
                    <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => void fetchUvaValue(true)} disabled={uvaLoading}>
                      {uvaLoading ? 'Cargando…' : 'Actualizar UVA'}
                    </button>
                  </>
                ) : (
                  <span className="uva-global-bar__missing">
                    {uvaLoading
                      ? 'Consultando valor UVA…'
                      : 'No se pudo obtener el valor UVA automáticamente.'}
                    {!uvaLoading && (
                      <>
                        <button className="btn small ghost" style={{ marginLeft: 8 }} onClick={() => void fetchUvaValue(true)}>
                          Reintentar
                        </button>
                        <span style={{ marginLeft: 8 }}>o ingresar manual:</span>
                        <input
                          type="number"
                          className="uva-manual-input"
                          min="1"
                          step="0.01"
                          placeholder="ej. 1350"
                          value={uvaManual}
                          onChange={(e) => setUvaManual(e.target.value)}
                        />
                      </>
                    )}
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        {plans.length === 0 ? (
          <div className="empty">No hay planes de cuotas. Crea uno para empezar.</div>
        ) : (
          <div className="plan-stack">
            {plans.map((plan) => {
              const isUva = plan.plan_type === 'UVA'
              const planInstallments = installments.filter((i) => i.plan_id === plan.id).sort((a, b) => a.number - b.number)
              const paidCount = planInstallments.filter((i) => i.status === 'paid').length
              const pendingList = planInstallments.filter((i) => i.status === 'pending')
              const nextInst = [...pendingList].sort((a, b) => a.due_on.localeCompare(b.due_on))[0] ?? null
              // For UVA: use current UVA value if available, else stored estimate
              const uvaCurrent = currentUva ?? null
              const totalPending = pendingList.reduce((sum, i) => {
                if (isUva && uvaCurrent && i.uva_count) return sum + Math.round(Number(i.uva_count) * uvaCurrent * 100) / 100
                return sum + Number(i.amount)
              }, 0)
              const totalUvaPendingCuotas = isUva && plan.uva_count ? pendingList.length * Number(plan.uva_count) : 0
              const overdueInPlan = pendingList.filter((i) => i.due_on < today).length
              const allPaid = paidCount === planInstallments.length && planInstallments.length > 0
              const progress = planInstallments.length > 0 ? (paidCount / planInstallments.length) * 100 : 0
              const isExpanded = expandedPlans.has(plan.id)
              const isConfirmingDelete = confirmDeletePlan === plan.id

              const planStatusTone = allPaid ? 'success' : overdueInPlan > 0 ? 'danger' : 'neutral'
              const planStatusLabel = allPaid ? 'Completada' : overdueInPlan > 0 ? `${overdueInPlan} vencida${overdueInPlan > 1 ? 's' : ''}` : 'Al dia'

              // Next installment amount in ARS (for UVA: recalculate with current value if available)
              const nextInstArs = nextInst
                ? isUva && uvaCurrent && nextInst.uva_count
                  ? Math.round(Number(nextInst.uva_count) * uvaCurrent * 100) / 100
                  : Number(nextInst.amount)
                : 0

              return (
                <div key={plan.id} className="plan-card">
                  {/* Header */}
                  <div className="plan-card-head">
                    <div className="plan-icon"><CreditCard size={18} /></div>
                    <div className="plan-info">
                      <strong>
                        {plan.title}
                        {isUva && <span className="uva-tag">UVA</span>}
                      </strong>
                      <span>{plan.group_id ? groups.find((g) => g.id === plan.group_id)?.name : 'Privada'}</span>
                    </div>
                    <Badge tone={planStatusTone}>{planStatusLabel}</Badge>
                    <button className="icon-btn sm" onClick={() => openEditPlan(plan)} aria-label="Editar plan">
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="icon-btn sm"
                      onClick={() => togglePlan(plan.id)}
                      aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="plan-progress-wrap">
                    <div className="plan-progress-bar" style={{ width: `${progress}%` }} />
                  </div>

                  {/* Summary (always visible) */}
                  <div className="plan-summary">
                    {nextInst ? (
                      <div className="plan-next-payment">
                        <span className="plan-next-label">Próximo pago</span>
                        <strong className="plan-next-amount">{formatARS(nextInstArs)}</strong>
                        {isUva && nextInst.uva_count && (
                          <span className="plan-next-uva">{Number(nextInst.uva_count).toLocaleString('es-AR')} UVA{uvaCurrent ? ` · $${uvaCurrent.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</span>
                        )}
                        <span className="plan-next-date">vence {formatDateAR(nextInst.due_on)}</span>
                      </div>
                    ) : allPaid ? (
                      <p className="plan-done-msg">¡Plan completado!</p>
                    ) : null}
                    <div className="plan-summary-footer">
                      <span className="plan-summary-text">
                        {paidCount}/{planInstallments.length} pagadas
                        {totalPending > 0 ? ` · Pendiente: ${formatARS(totalPending)}` : ''}
                        {isUva && totalUvaPendingCuotas > 0 ? ` (${totalUvaPendingCuotas.toLocaleString('es-AR')} UVA)` : ''}
                      </span>
                      <div className="plan-footer-actions">
                        {groups.length > 0 && !allPaid && (
                          <button className="btn small ghost" onClick={() => openSharePlan(plan)}><Users size={12} />Compartir</button>
                        )}
                        {isConfirmingDelete ? (
                          <div className="tx-confirm-delete">
                            <span>¿Eliminar?</span>
                            <button className="btn small danger" onClick={() => { void deletePlan(plan.id); setConfirmDeletePlan(null) }}>Sí</button>
                            <button className="btn small" onClick={() => setConfirmDeletePlan(null)}>No</button>
                          </div>
                        ) : (
                          <button className="icon-btn sm danger" onClick={() => setConfirmDeletePlan(plan.id)} aria-label="Eliminar plan"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Installment list (expandable) */}
                  {isExpanded && (
                    <div className="inst-list inst-list--expanded">
                      {planInstallments.map((inst) => {
                        const isOverdue = inst.status === 'pending' && inst.due_on < today
                        const instArs = isUva && uvaCurrent && inst.uva_count
                          ? Math.round(Number(inst.uva_count) * uvaCurrent * 100) / 100
                          : Number(inst.amount)
                        return (
                          <div key={inst.id} className="inst-row">
                            <span className={cn('inst-num', inst.status === 'paid' && 'paid', isOverdue && 'overdue')}>
                              {inst.number}
                            </span>
                            <div className="inst-date-block">
                              <span className="inst-date">{formatDateAR(inst.due_on)}</span>
                              {isUva && inst.uva_count && (
                                <span className="inst-uva-sub">{Number(inst.uva_count).toLocaleString('es-AR')} UVA</span>
                              )}
                            </div>
                            <div className="inst-amount-block">
                              <span className="inst-amount">{formatARS(instArs)}</span>
                              {isUva && uvaCurrent && inst.uva_value && Number(inst.uva_value) !== uvaCurrent && (
                                <span className="inst-uva-sub">est. al crear</span>
                              )}
                            </div>
                            {inst.status === 'paid' ? (
                              <Badge tone="success">Pagada</Badge>
                            ) : isOverdue ? (
                              <Badge tone="danger">Vencida</Badge>
                            ) : (
                              <Badge tone="warning">Pendiente</Badge>
                            )}
                            <div className="inst-action">
                              {inst.status === 'pending' && (
                                <button className="btn small" onClick={() => markInstallmentPaid(inst)}>
                                  <Check size={13} />Pagar
                                </button>
                              )}
                              {inst.status === 'paid' && (
                                <button className="btn small ghost" onClick={() => markInstallmentUnpaid(inst)} title="Desmarcar como pagada">
                                  <RotateCcw size={13} />Desmarcar
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  function renderSettlement() {
    const settlementGroupId = groups.length > 0 ? (selectedGroupId && groups.find((g) => g.id === selectedGroupId) ? selectedGroupId : groups[0]?.id) : null
    const allSplits = [...receivable, ...payable]
    const smartSettlements = settlementGroupId ? computeSmartSettlement(settlementGroupId) : []
    const selectedGroup = groups.find((g) => g.id === settlementGroupId)

    return (
      <section className="page-stack">
        {/* Summary metrics */}
        <div className="metric-grid compact">
          <Metric title="Me deben (total)" value={formatARS(stats.owedToMe)} icon={ArrowUpRight} tone="success" />
          <Metric title="Debo (total)" value={formatARS(stats.iOwe)} icon={ArrowDownRight} tone="danger" />
        </div>

        {groups.length === 0 && (
          <div className="empty">Sin grupos. La liquidación es para deudas dentro de grupos compartidos.</div>
        )}

        {groups.length > 0 && (
          <>
            {/* Group selector */}
            <section className="panel">
              <div className="panel-head"><h2>Grupo a liquidar</h2></div>
              <div className="settlement-group-tabs">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    className={cn('settlement-group-tab', settlementGroupId === g.id && 'active')}
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Smart settlement for selected group */}
            {selectedGroup && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Liquidación simplificada</h2>
                  <Badge tone="neutral">{selectedGroup.name}</Badge>
                  {smartSettlements.length > 0 && <Badge tone="info">{smartSettlements.length} pago{smartSettlements.length !== 1 ? 's' : ''}</Badge>}
                </div>
                {smartSettlements.length === 0 ? (
                  <div className="empty">Sin deudas pendientes en {selectedGroup.name}.</div>
                ) : (
                  <>
                    <p className="panel-desc">Mínimo de transacciones para saldar todas las deudas del grupo:</p>
                    <div className="settlement-list">
                      {smartSettlements.map((s, i) => (
                        <div key={i} className="settlement-item">
                          <div className="settlement-parties">
                            <span className="settlement-from">{profileName(s.from)}</span>
                            <span className="settlement-arrow">→</span>
                            <span className="settlement-to">{profileName(s.to)}</span>
                          </div>
                          <strong className="settlement-amount">{formatARS(s.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Balance by person for selected group */}
            {settlementGroupId && (() => {
              const groupSplits = splits.filter((s) => s.group_id === settlementGroupId && s.status === 'pending')
              const groupMembers = members.filter((m) => m.group_id === settlementGroupId)
              const memberProfiles = groupMembers.map((m) => profiles.find((p) => p.id === m.user_id)).filter(Boolean)
              const balances = memberProfiles.map((profile) => {
                if (!profile) return null
                const toMe = groupSplits.filter((s) => s.creditor_id === profile.id).reduce((sum, s) => sum + Number(s.amount), 0)
                const fromMe = groupSplits.filter((s) => s.debtor_id === profile.id).reduce((sum, s) => sum + Number(s.amount), 0)
                return { profile, net: toMe - fromMe }
              }).filter(Boolean)
              if (balances.length === 0) return null
              return (
                <section className="panel">
                  <div className="panel-head"><h2>Balance del grupo</h2><Badge tone="neutral">{selectedGroup?.name}</Badge></div>
                  <div className="balance-list">
                    {balances.map((item) => item && (
                      <div key={item.profile.id} className="balance-card">
                        <div className="balance-avatar">{profileName(item.profile.id).slice(0, 1).toUpperCase()}</div>
                        <div className="balance-info">
                          <strong>{profileName(item.profile.id)}</strong>
                          <span>{item.profile.email}</span>
                        </div>
                        <div className="balance-card-right">
                          <span className={cn('balance-net', item.net >= 0 ? 'positive' : 'negative')}>{formatARS(item.net)}</span>
                          <span className="balance-net-label">{item.net >= 0 ? 'le deben' : 'debe'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })()}
          </>
        )}

        {/* All pending splits with group + expense context */}
        <section className="panel">
          <div className="panel-head">
            <h2>Todas las deudas pendientes</h2>
            {allSplits.length > 0 && <Badge tone="warning">{allSplits.length}</Badge>}
          </div>
          {allSplits.length === 0 ? (
            <div className="empty">Todo liquidado.</div>
          ) : (
            <div className="split-list">
              {allSplits.map((split) => {
                const groupName = groups.find((g) => g.id === split.group_id)?.name
                const expenseTitle = split.shared_expense_id
                  ? sharedExpenses.find((e) => e.id === split.shared_expense_id)?.title
                  : split.installment_id
                    ? 'Cuota compartida'
                    : null
                return (
                  <div key={split.id} className="split-row">
                    <div className="split-row-body">
                      <strong>{profileName(split.debtor_id)} → {profileName(split.creditor_id)}</strong>
                      <span className="split-row-meta">
                        {groupName && <span className="split-group-badge">{groupName}</span>}
                        {expenseTitle && <>{expenseTitle} · </>}
                        {formatDateAR(split.due_on)}
                      </span>
                    </div>
                    <span className="split-amount">{formatARS(split.amount)}</span>
                    <Status status={split.status} />
                    <button
                      className="btn small"
                      onClick={() => markSplitPaid(split)}
                      disabled={markingId === split.id}
                    >
                      <Check size={13} />{markingId === split.id ? '…' : 'Liquidar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </section>
    )
  }

  function renderSettings() {
    const userCategories = categories.filter((c) => c.user_id === currentUser.id)
    const systemCategories = categories.filter((c) => c.user_id === null)
    const userRecurring = recurringExpenses.filter((r) => r.user_id === currentUser.id)
    const tabLabels: Record<SettingsTab, string> = { profile: 'Perfil', appearance: 'Apariencia', categories: 'Categorías', recurring: 'Recurrentes', data: 'Datos' }

    return (
      <section className="page-stack">
        <div className="settings-tabs">
          {(Object.keys(tabLabels) as SettingsTab[]).map((tab) => (
            <button key={tab} className={cn('settings-tab', settingsTab === tab && 'active')} onClick={() => setSettingsTab(tab)}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {settingsTab === 'profile' && (
          <section className="panel settings">
            <div className="profile-header">
              <div className="profile-avatar">{(currentUser.full_name ?? currentUser.email).slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{currentUser.full_name || 'Sin nombre'}</strong>
                <span style={{ color: 'var(--t2)', fontSize: 13 }}>{currentUser.email}</span>
                {isDemo && <div><Badge tone="warning">Modo demo</Badge></div>}
              </div>
            </div>
            <hr style={{ border: 0, borderTop: '1px solid var(--bd)', margin: '14px 0' }} />
            <div className="data-stats">
              <span>Supabase: <strong>{supabaseConfigured ? 'Conectado' : 'No configurado'}</strong></span>
              <span>Sesión: <strong>{session ? 'activa' : isDemo ? 'demo' : 'sin sesión'}</strong></span>
              <span>Pagos: <strong>{payments.length}</strong></span>
            </div>
          </section>
        )}

        {settingsTab === 'appearance' && (
          <section className="panel settings">
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Tema de la interfaz</h3>
            <div className="appearance-options">
              <button className={cn('appearance-btn', !darkMode && 'active')} onClick={() => setDarkMode(false)}>
                <Sun size={20} /><span>Claro</span>
              </button>
              <button className={cn('appearance-btn', darkMode && 'active')} onClick={() => setDarkMode(true)}>
                <Moon size={20} /><span>Oscuro</span>
              </button>
            </div>
          </section>
        )}

        {settingsTab === 'categories' && (
          <section className="panel settings">
            <div className="panel-head"><h3>Sistema</h3><Badge tone="neutral">{systemCategories.length}</Badge></div>
            <div className="cat-list">
              {systemCategories.map((cat) => (
                <div key={cat.id} className="cat-item">
                  <span className="cat-swatch" style={{ background: cat.color }} />
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-readonly">Sistema</span>
                </div>
              ))}
            </div>
            <hr style={{ border: 0, borderTop: '1px solid var(--bd)', margin: '14px 0' }} />
            <div className="panel-head"><h3>Mis categorías</h3><Badge tone="info">{userCategories.length}</Badge></div>
            <div className="cat-list">
              {userCategories.length === 0 && <div className="empty">Sin categorías personalizadas.</div>}
              {userCategories.map((cat) => (
                <div key={cat.id} className="cat-item cat-item--user">
                  {editingCategory === cat.id ? (
                    <form className="cat-edit-form" onSubmit={(e) => void saveEditCategory(e, cat.id)}>
                      <input
                        type="color"
                        value={editCategoryForm.color}
                        onChange={(e) => setEditCategoryForm((f) => ({ ...f, color: e.target.value }))}
                        className="color-picker"
                      />
                      <input
                        value={editCategoryForm.name}
                        onChange={(e) => setEditCategoryForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Nombre"
                        required
                        autoFocus
                      />
                      <button className="btn small primary" type="submit"><Check size={12} />Guardar</button>
                      <button className="btn small" type="button" onClick={() => setEditingCategory(null)}><X size={12} /></button>
                    </form>
                  ) : (
                    <>
                      <span className="cat-swatch" style={{ background: cat.color }} />
                      <span className="cat-name">{cat.name}</span>
                      <div className="cat-actions">
                        {confirmDeleteCategory === cat.id ? (
                          <div className="tx-confirm-delete">
                            <span>¿Eliminar?</span>
                            <button className="btn small danger" onClick={() => void deleteCategory(cat.id)}>Sí</button>
                            <button className="btn small" onClick={() => setConfirmDeleteCategory(null)}>No</button>
                          </div>
                        ) : (
                          <>
                            <button className="icon-btn sm" onClick={() => { setEditingCategory(cat.id); setEditCategoryForm({ name: cat.name, color: cat.color }) }} aria-label="Editar categoría"><Edit3 size={13} /></button>
                            <button className="icon-btn sm danger" onClick={() => setConfirmDeleteCategory(cat.id)} aria-label="Eliminar categoría"><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={(e) => void saveNewCategory(e)} className="cat-add-form">
              <input type="color" value={newCategoryForm.color} onChange={(e) => setNewCategoryForm((f) => ({ ...f, color: e.target.value }))} className="color-picker" />
              <input value={newCategoryForm.name} onChange={(e) => setNewCategoryForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nueva categoría…" required />
              <button className="btn primary" type="submit"><Plus size={14} />Agregar</button>
            </form>
          </section>
        )}

        {settingsTab === 'recurring' && (
          <section className="panel settings">
            <div className="actions-row" style={{ marginBottom: 16 }}>
              <button className="btn primary" onClick={() => setDialog('recurring')}><Plus size={16} />Nuevo recurrente</button>
            </div>
            {userRecurring.length === 0 ? (
              <div className="empty">Sin gastos recurrentes. Creá uno para automatizar tus gastos fijos.</div>
            ) : (
              <div className="recurring-list">
                {userRecurring.map((rec) => {
                  const freqLabel: Record<string, string> = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual', annual: 'Anual' }
                  return (
                    <div key={rec.id} className={cn('recurring-card', !rec.is_active && 'paused')}>
                      <div className="recurring-card-head">
                        <div className="recurring-info">
                          <Repeat size={15} />
                          <strong>{rec.title}</strong>
                          <Badge tone={rec.is_active ? 'success' : 'neutral'}>{rec.is_active ? 'Activo' : 'Pausado'}</Badge>
                          <Badge tone="info">{freqLabel[rec.frequency] ?? rec.frequency}</Badge>
                        </div>
                        <span className="recurring-amount">{formatARS(rec.amount)}</span>
                      </div>
                      <div className="recurring-card-footer">
                        <span className="recurring-next"><Clock size={12} /> Próx: {formatDateAR(rec.next_due)}</span>
                        <div className="recurring-actions">
                          <button className="btn small primary" onClick={() => void generateRecurring(rec)} disabled={!rec.is_active}><Plus size={12} />Generar</button>
                          <button className="btn small" onClick={() => void toggleRecurring(rec)}>{rec.is_active ? 'Pausar' : 'Activar'}</button>
                          <button className="icon-btn sm danger" onClick={() => void deleteRecurring(rec.id)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {settingsTab === 'data' && (
          <section className="panel settings">
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Exportar datos</h3>
            <p>Descargá tus movimientos en CSV para Excel u otras herramientas.</p>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={exportTransactionsCSV}>
              <Download size={16} />Exportar movimientos ({transactions.filter((t) => t.user_id === currentUser.id).length})
            </button>
            <hr style={{ border: 0, borderTop: '1px solid var(--bd)', margin: '18px 0 14px' }} />
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Estadísticas</h3>
            <div className="data-stats">
              <span>Movimientos: <strong>{transactions.filter((t) => t.user_id === currentUser.id).length}</strong></span>
              <span>Grupos: <strong>{groups.length}</strong></span>
              <span>Planes de cuotas: <strong>{plans.filter((p) => p.user_id === currentUser.id).length}</strong></span>
              <span>Recurrentes: <strong>{recurringExpenses.filter((r) => r.user_id === currentUser.id).length}</strong></span>
              <span>Pagos registrados: <strong>{payments.length}</strong></span>
              <span>Categorías propias: <strong>{userCategories.length}</strong></span>
            </div>
          </section>
        )}
      </section>
    )
  }
}

function BottomNav({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <nav className="bottom-nav">
      {bottomNavItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            className={cn('bottom-nav-item', view === item.id && 'active')}
            onClick={() => onNavigate(item.id)}
          >
            <span className="bottom-nav-icon"><Icon size={20} /></span>
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function AuthScreen({
  mode,
  email,
  password,
  newPassword,
  fullName,
  error,
  success,
  loading,
  supabaseEnabled,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onNewPasswordChange,
  onFullNameChange,
  onSubmitAuth,
  onSubmitReset,
  onSubmitUpdate,
  onGoogleLogin,
}: {
  mode: AuthMode
  email: string
  password: string
  newPassword: string
  fullName: string
  error: string
  success: string
  loading: boolean
  supabaseEnabled: boolean
  onModeChange: (mode: AuthMode) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onFullNameChange: (value: string) => void
  onSubmitAuth: (event: React.FormEvent) => void
  onSubmitReset: (event: React.FormEvent) => void
  onSubmitUpdate: (event: React.FormEvent) => void
  onGoogleLogin: () => void
}) {
  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const isReset = mode === 'reset'
  const isUpdate = mode === 'update-password'

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div>
          <span className="brand-mark">CC</span>
          <h1>Cuentas Claras</h1>
          <p>{isUpdate ? 'Actualiza tu contrasena para volver a entrar.' : 'Finanzas personales y gastos compartidos sin perder el hilo.'}</p>
        </div>

        {(isLogin || isRegister) && (
          <form onSubmit={onSubmitAuth} className="stack">
            {isRegister && (
              <label>
                Nombre
                <input value={fullName} onChange={(event) => onFullNameChange(event.target.value)} placeholder="Tu nombre" disabled={loading} />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="tu@email.com" required disabled={loading} />
            </label>
            <label>
              Contrasena
              <input type="password" minLength={6} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Minimo 6 caracteres" required disabled={loading} />
            </label>
            {error && <p className="error">{error}</p>}
            {success && <p className="notice">{success}</p>}
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Procesando...' : isLogin ? 'Ingresar' : 'Crear cuenta'}</button>
            <button className="btn google" type="button" onClick={onGoogleLogin} disabled={loading || !supabaseEnabled}>Continuar con Google</button>
            {!supabaseEnabled && <p className="auth-hint">Configura Supabase para habilitar login real y Google OAuth. Mientras tanto, la app usa modo demo.</p>}
            <div className="auth-links">
              <button className="link-btn" type="button" onClick={() => onModeChange(isLogin ? 'register' : 'login')} disabled={loading}>
                {isLogin ? 'Crear una cuenta nueva' : 'Ya tengo cuenta'}
              </button>
              <button className="link-btn" type="button" onClick={() => onModeChange('reset')} disabled={loading}>Olvide mi contrasena</button>
            </div>
          </form>
        )}

        {isReset && (
          <form onSubmit={onSubmitReset} className="stack">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="tu@email.com" required disabled={loading} />
            </label>
            {error && <p className="error">{error}</p>}
            {success && <p className="notice">{success}</p>}
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link de recuperacion'}</button>
            <button className="link-btn" type="button" onClick={() => onModeChange('login')} disabled={loading}>Volver al login</button>
          </form>
        )}

        {isUpdate && (
          <form onSubmit={onSubmitUpdate} className="stack">
            <label>
              Nueva contrasena
              <input type="password" minLength={6} value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} placeholder="Minimo 6 caracteres" required disabled={loading} />
            </label>
            {error && <p className="error">{error}</p>}
            {success && <p className="notice">{success}</p>}
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Actualizar contrasena'}</button>
          </form>
        )}
      </section>
    </main>
  )
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: string; icon: typeof DollarSign; tone: string }) {
  return (
    <section className={cn('metric', tone)}>
      <div className="metric-icon"><Icon size={19} /></div>
      <span>{title}</span>
      <strong>{value}</strong>
    </section>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={cn('badge', tone)}>{children}</span>
}

function Status({ status }: { status: string }) {
  return <Badge tone={status === 'paid' ? 'success' : 'warning'}>{status === 'paid' ? 'Pagado' : 'Pendiente'}</Badge>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

function CategorySelect({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Sin categoria</option>
      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
  )
}

function GroupSelect({ groups, value, onChange }: { groups: Group[]; value: string; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
}

function MemberSelect({ members, value, onChange, profileName }: { members: GroupMember[]; value: string; onChange: (value: string) => void; profileName: (id: string) => string }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{members.map((member) => <option key={member.id} value={member.user_id}>{profileName(member.user_id)}</option>)}</select>
}

function SplitControls({
  members,
  mode,
  custom,
  setMode,
  setCustom,
  profileName,
  amount = 0,
}: {
  members: GroupMember[]
  mode: SplitMode
  custom: Record<string, string>
  setMode: (mode: SplitMode) => void
  setCustom: (custom: Record<string, string>) => void
  profileName: (id: string) => string
  amount?: number
}) {
  const assigned = members.reduce((sum, m) => {
    const raw = Number(custom[m.user_id] || 0)
    return sum + (mode === 'percentage' ? (amount * raw) / 100 : raw)
  }, 0)
  const remaining = amount - assigned
  const isOver = remaining < -0.01
  const isExact = Math.abs(remaining) < 0.01

  function formatARS(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="span-2 split-box">
      <label>División<select value={mode} onChange={(event) => setMode(event.target.value as SplitMode)}>
        <option value="equal">Partes iguales</option>
        <option value="amount">Monto personalizado</option>
        <option value="percentage">Porcentaje</option>
      </select></label>
      {mode !== 'equal' && members.map((member) => (
        <label key={member.id}>{profileName(member.user_id)}
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={mode === 'percentage' ? '%' : 'Monto'}
            value={custom[member.user_id] || ''}
            onChange={(event) => setCustom({ ...custom, [member.user_id]: event.target.value })}
          />
        </label>
      ))}
      {mode !== 'equal' && amount > 0 && (
        <div className={`span-2 split-totals ${isOver ? 'over' : isExact ? 'exact' : ''}`}>
          <span>Asignado: <strong>{mode === 'percentage' ? `${members.reduce((s, m) => s + Number(custom[m.user_id] || 0), 0).toFixed(1)}%` : formatARS(assigned)}</strong></span>
          <span className={isOver ? 'split-over' : isExact ? 'split-ok' : 'split-remaining'}>
            {isOver ? `Excede en ${formatARS(Math.abs(remaining))}` : isExact ? '✓ Exacto' : `Falta: ${formatARS(remaining)}`}
          </span>
        </div>
      )}
    </div>
  )
}

export default App
