export type TransactionType = 'income' | 'expense'
export type SplitStatus = 'pending' | 'paid'
export type MemberRole = 'owner' | 'member'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  user_id: string | null
  name: string
  color: string
  created_at: string
}

export type Transaction = {
  id: string
  user_id: string
  title: string
  amount: number
  occurred_on: string
  category_id: string | null
  type: TransactionType
  notes: string | null
  created_at: string
}

export type Group = {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  role: MemberRole
  created_at: string
  profile?: Profile
}

export type SharedExpense = {
  id: string
  group_id: string
  title: string
  amount: number
  occurred_on: string
  category_id: string | null
  paid_by: string
  split_mode: string
  created_by: string
  created_at: string
}

export type SharedExpenseSplit = {
  id: string
  group_id: string
  shared_expense_id: string | null
  installment_id: string | null
  debtor_id: string
  creditor_id: string
  amount: number
  percentage: number | null
  status: SplitStatus
  due_on: string
  paid_at: string | null
  created_at: string
}

export type InstallmentPlan = {
  id: string
  user_id: string
  group_id: string | null
  title: string
  total_amount: number
  installments_count: number
  installment_amount: number
  start_date: string
  due_day: number
  paid_by: string
  created_at: string
}

export type Installment = {
  id: string
  plan_id: string
  number: number
  amount: number
  due_on: string
  status: SplitStatus
  paid_at: string | null
  created_at: string
}

export type Payment = {
  id: string
  split_id: string | null
  payer_id: string
  receiver_id: string
  amount: number
  paid_at: string
  notes: string | null
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type NotificationType = 'invitation' | 'payment' | 'overdue' | 'group_event'
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annual'

export type GroupInvitation = {
  id: string
  group_id: string
  inviter_id: string
  invitee_email: string
  status: InvitationStatus
  created_at: string
  responded_at: string | null
}

export type AppNotification = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export type ActivityLogEntry = {
  id: string
  group_id: string | null
  actor_id: string
  action_type: string
  data: Record<string, unknown> | null
  created_at: string
}

export type RecurringExpense = {
  id: string
  user_id: string
  group_id: string | null
  title: string
  amount: number
  category_id: string | null
  frequency: RecurrenceFrequency
  start_date: string
  next_due: string
  paid_by: string | null
  split_mode: string
  is_active: boolean
  created_at: string
}
