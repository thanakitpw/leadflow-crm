// Shared types for LeadFlow CRM

// ============ User & Auth ============
export type UserRole = 'agency_admin' | 'agency_member' | 'client_viewer'

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

// ============ Workspace ============
export interface Agency {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Workspace {
  id: string
  agency_id: string
  name: string
  type: 'agency' | 'client'
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: UserRole
  created_at: string
}

// ============ Lead ============
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'

export interface Lead {
  id: string
  workspace_id: string
  place_id?: string
  business_name: string
  address?: string
  phone?: string
  website?: string
  email?: string
  email_confidence?: number
  category?: string
  status: LeadStatus
  score?: number
  score_reasoning?: string
  created_at: string
  updated_at: string
}

// ============ Email ============
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
export type EmailEventType = 'sent' | 'opened' | 'clicked' | 'bounced' | 'complained'

export interface EmailTemplate {
  id: string
  workspace_id: string
  name: string
  subject: string
  body_html: string
  variables: string[]
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  template_id: string
  status: CampaignStatus
  scheduled_at?: string
  sent_count: number
  open_count: number
  click_count: number
  created_at: string
}

// ============ API ============
export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}
