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
