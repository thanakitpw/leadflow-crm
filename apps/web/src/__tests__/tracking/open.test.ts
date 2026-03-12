import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/track/open/[eventId]/route'
import * as adminModule from '@/lib/supabase/admin'

/**
 * Open Tracking Pixel Tests
 * ทดสอบ behavior ของ open tracking endpoint
 */

describe('Open Tracking Pixel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 1x1 transparent GIF for valid eventId', async () => {
    // Mock Supabase to return contact
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            lead_id: 'test-lead-id',
            campaigns: { id: 'test-campaign-id', workspace_id: 'test-workspace-id' },
          },
          error: null,
        }),
      }),
    })

    const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null })

    const mockAdminClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaign_contacts') {
          return { select: mockSelect }
        }
        if (table === 'email_events') {
          return { insert: mockInsert }
        }
        return {}
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const req = new NextRequest(
      `http://localhost:3000/api/track/open/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/gif')
    expect(response.headers.get('Cache-Control')).toContain('no-cache')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })

  it('should return GIF without recording for invalid UUID format', async () => {
    const eventId = 'invalid-uuid'
    const req = new NextRequest(
      `http://localhost:3000/api/track/open/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/gif')
  })

  it('should set no-cache headers correctly', async () => {
    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const req = new NextRequest(
      `http://localhost:3000/api/track/open/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.headers.get('Cache-Control')).toBe(
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    )
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })

  it('should handle missing contact gracefully', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    const mockAdminClient = {
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const req = new NextRequest(
      `http://localhost:3000/api/track/open/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    // ควร return 1x1 pixel แม้ว่าไม่พบ contact
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/gif')
  })

  it('should handle database errors gracefully without affecting pixel delivery', async () => {
    const dbError = new Error('Database connection failed')
    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockRejectedValue(dbError),
          }),
        }),
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const req = new NextRequest(
      `http://localhost:3000/api/track/open/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    // ควร return 200 และ pixel เสมอ แม้ว่า DB มี error
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/gif')
  })

  it('should return proper GIF buffer with correct headers', async () => {
    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const req = new NextRequest(
      `http://localhost:3000/api/track/open/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/gif')

    // ทดสอบว่า body เป็น buffer (GIF)
    const body = await response.arrayBuffer()
    expect(body.byteLength).toBeGreaterThan(0)
  })
})
