import { vi } from 'vitest'
import { appRouter } from '@/server/routers/_app'
import type { TRPCContext } from '@/lib/trpc/context'
import type { User, Session } from '@supabase/supabase-js'

/**
 * สร้าง mock context สำหรับ tRPC tests
 * @param overrides - ค่า override สำหรับ context บางส่วน
 */
export function createMockContext(overrides?: Partial<TRPCContext>): TRPCContext {
  const defaultUser: User = {
    id: 'test-user-id-123',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    phone: null,
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {
      name: 'Test User',
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const defaultSession: Session = {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'test-refresh-token',
    user: defaultUser,
  }

  return {
    user: overrides?.user ?? defaultUser,
    session: overrides?.session ?? defaultSession,
  }
}

/**
 * สร้าง tRPC caller สำหรับการ test โดยตรง
 * @param context - tRPC context (ถ้าไม่ส่ง จะใช้ default mock context)
 */
export function createTestCaller(context?: TRPCContext) {
  const ctx = context ?? createMockContext()
  return appRouter.createCaller(ctx)
}

/**
 * สร้าง mock Supabase query chain ที่สนับสนุน fluent API
 * รองรับ chaining method calls และ terminal methods (single, maybeSingle, then)
 */
export function createMockQueryChain(
  resolveData: any = null,
  resolveError: any = null,
  resolveCount: number | null = null,
) {
  const chain: any = {}

  // Chainable methods — return chain itself for fluent API
  const chainMethods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'is', 'not', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'or', 'order', 'limit', 'range', 'textSearch']
  chainMethods.forEach(m => { chain[m] = vi.fn().mockReturnValue(chain) })

  // Terminal methods — resolve with data/error
  chain.single = vi.fn().mockResolvedValue({ data: resolveData, error: resolveError, status: 200, statusText: 'OK' })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: resolveData, error: resolveError, status: 200, statusText: 'OK' })

  // Support both await and .then() patterns
  chain.then = vi.fn((resolve: any) =>
    resolve({ data: resolveData, error: resolveError, count: resolveCount, status: 200, statusText: 'OK' }),
  )

  return chain
}

/**
 * สร้าง mock supabase.from() ที่ return query chain ตามชื่อ table
 * @param tableConfig - object ที่ map table name → {data?, error?, single?, count?}
 */
export function createMockSupabaseFrom(tableConfig: Record<string, { data?: any; error?: any; single?: any; count?: number }>) {
  return vi.fn().mockImplementation((table: string) => {
    const config = tableConfig[table] || {}
    const isSingleQuery = config.single !== undefined
    const data = isSingleQuery ? config.single : config.data ?? null
    const count = config.count ?? (Array.isArray(config.data) ? config.data.length : null)

    return createMockQueryChain(data, config.error || null, count)
  })
}

/**
 * Helper สำหรับสร้าง mock Supabase response
 * ใช้ร่วมกับ vi.mock('@/lib/supabase/server')
 */
export const mockSupabaseResponses = {
  /**
   * สร้าง successful query response
   * @example
   * mockSupabaseResponses.createSuccessResponse(testData)
   */
  createSuccessResponse(data: unknown, count: number | null = null) {
    return Promise.resolve({ data, error: null, count, status: 200, statusText: 'OK' })
  },

  /**
   * สร้าง error response
   */
  createErrorResponse(message: string, code = 'INTERNAL_SERVER_ERROR') {
    const error = new Error(message) as any
    error.code = code
    return Promise.resolve({ data: null, error })
  },

  /**
   * สร้าง builder สำหรับ fluent API (simulate Supabase query builder)
   */
  createQueryBuilder(mockData: unknown = null, mockError: any = null) {
    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: mockError, status: 200, statusText: 'OK' }),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: mockError, status: 200, statusText: 'OK' }),
      then: vi.fn((resolve) => resolve({ data: mockData, error: mockError, count: null, status: 200, statusText: 'OK' })),
    }
    return builder
  },
}

/**
 * Helper ตรวจสอบว่า context ต้องมี user
 * ใช้สำหรับ test protected procedures
 */
export function createUnauthenticatedContext(): TRPCContext {
  return {
    user: null,
    session: null,
  }
}

/**
 * Helper สร้าง mock workspace member ใน context
 */
export function createContextWithWorkspaceMember(workspaceMembership?: {
  workspaceId?: string
  role?: string
}) {
  const userId = 'workspace-member-user-id'
  const workspaceId = workspaceMembership?.workspaceId ?? 'test-workspace-id'
  const role = workspaceMembership?.role ?? 'agency_member'

  return {
    userId,
    workspaceId,
    role,
    context: createMockContext(),
  }
}

/**
 * Generate a valid UUID for testing
 */
export function generateUUID(seed: string | number = 0): string {
  const s = String(seed).padStart(12, '0')
  return `00000000-0000-0000-0000-${s.substring(0, 12)}`
}
