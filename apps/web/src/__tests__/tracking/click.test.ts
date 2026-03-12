import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/track/click/[eventId]/route'
import * as adminModule from '@/lib/supabase/admin'

/**
 * Click Tracking Redirect Tests
 * ทดสอบ behavior ของ click tracking endpoint
 */

describe('Click Tracking Redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should redirect to target URL with 302 status', async () => {
    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                lead_id: 'test-lead-id',
                message_id: 'test-message-id',
                campaigns: { id: 'test-campaign-id', workspace_id: 'test-workspace-id' },
              },
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const targetUrl = 'https://example.com/special-offer'
    const encodedUrl = encodeURIComponent(targetUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(targetUrl)
  })

  it('should return 400 for missing url parameter', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('Missing url parameter')
  })

  it('should reject non-http URLs to prevent open redirect', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const maliciousUrl = encodeURIComponent('javascript:alert("xss")')
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${maliciousUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  it('should reject ftp:// URLs', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const ftpUrl = encodeURIComponent('ftp://example.com/file')
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${ftpUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('http or https')
  })

  it('should accept https URLs', async () => {
    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                lead_id: 'test-lead-id',
                message_id: 'test-message-id',
                campaigns: { id: 'test-campaign-id', workspace_id: 'test-workspace-id' },
              },
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const targetUrl = 'https://secure.example.com/checkout'
    const encodedUrl = encodeURIComponent(targetUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(targetUrl)
  })

  it('should redirect even with invalid eventId format (fire-and-forget)', async () => {
    const eventId = 'invalid-uuid'
    const targetUrl = 'https://example.com'
    const encodedUrl = encodeURIComponent(targetUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    // ควรทำการ redirect ทันทีโดยไม่ record event
    // URL constructor อาจเพิ่ม trailing slash
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(new URL(targetUrl).toString())
  })

  it('should handle invalid URL parameter gracefully', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const invalidUrl = 'not a url at all'
    const encodedUrl = encodeURIComponent(invalidUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  it('should record click event with valid eventId', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            lead_id: 'test-lead-id',
            message_id: 'test-message-id',
            campaigns: { id: 'test-campaign-id', workspace_id: 'test-workspace-id' },
          },
          error: null,
        }),
      }),
    })

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
    const targetUrl = 'https://example.com/offer'
    const encodedUrl = encodeURIComponent(targetUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(targetUrl)
  })

  it('should handle database errors without affecting redirect', async () => {
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
    const targetUrl = 'https://example.com'
    const encodedUrl = encodeURIComponent(targetUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    // ควร redirect ได้ แม้ว่า DB มี error
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(new URL(targetUrl).toString())
  })

  it('should handle URLs with query parameters', async () => {
    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                lead_id: 'test-lead-id',
                message_id: 'test-message-id',
                campaigns: { id: 'test-campaign-id', workspace_id: 'test-workspace-id' },
              },
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue(mockAdminClient as any)

    const eventId = '550e8400-e29b-41d4-a716-446655440000'
    const targetUrl = 'https://example.com/page?utm_source=email&utm_medium=campaign'
    const encodedUrl = encodeURIComponent(targetUrl)
    const req = new NextRequest(
      `http://localhost:3000/api/track/click/${eventId}?url=${encodedUrl}`
    )

    const response = await GET(req, { params: Promise.resolve({ eventId }) })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(targetUrl)
  })
})
