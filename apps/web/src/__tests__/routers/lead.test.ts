import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { createTestCaller, createMockContext, createUnauthenticatedContext, createMockQueryChain, createMockSupabaseFrom, generateUUID } from '../helpers/trpc-test'

// Mock Supabase server client at module level
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Import the mocked createClient
import { createClient } from '@/lib/supabase/server'

// Track the mock for reuse in tests
const mockCreateClient = createClient as any

/**
 * Lead Router Tests
 * ทดสอบ behavior ของ lead router procedures
 * - Arrange: ตั้งค่า mock context และ input
 * - Act: เรียก procedure
 * - Assert: ตรวจสอบผลลัพธ์
 */

describe('lead router', () => {
  // ============================================================
  // lead.list Tests
  // ============================================================

  describe('lead.list', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.list({
          workspaceId: '00000000-0000-0000-0000-000000000001',
        }),
      ).rejects.toThrow()
    })

    it('should return leads for valid workspace', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'Business 1',
          status: 'new',
          email: 'b1@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: '00000000-0000-0000-0000-000000000001',
          lead_scores: [{ score: 85, reasoning: 'Good prospect', scored_at: new Date().toISOString() }],
        },
        {
          id: generateUUID(2),
          name: 'Business 2',
          status: 'qualified',
          email: null,
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: '00000000-0000-0000-0000-000000000001',
          lead_scores: [],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads, count: 2 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        page: 1,
        pageSize: 20,
      })

      expect(result.leads).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
      expect(result.leads[0].name).toBe('Business 1')
      expect(result.leads[0].status).toBe('new')
    })

    it('should throw FORBIDDEN when user is not workspace member', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: null },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())

      await expect(
        caller.lead.list({
          workspaceId: '00000000-0000-0000-0000-000000000001',
        }),
      ).rejects.toThrow()
    })

    it('should filter leads by status', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'Qualified Business',
          status: 'qualified',
          email: 'b1@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads, count: 1 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        status: 'qualified',
        page: 1,
        pageSize: 20,
      })

      expect(result.leads).toHaveLength(1)
      expect(result.leads[0].status).toBe('qualified')
    })

    it('should filter leads by hasEmail', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'Business with Email',
          status: 'new',
          email: 'b1@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads, count: 1 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        hasEmail: true,
        page: 1,
        pageSize: 20,
      })

      expect(result.leads).toHaveLength(1)
      expect(result.leads[0].email).toBe('b1@test.com')
    })

    it('should sort leads by score descending', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'High Score',
          status: 'new',
          email: 'b1@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [{ score: 90, reasoning: 'Excellent', scored_at: new Date().toISOString() }],
        },
        {
          id: generateUUID(2),
          name: 'Low Score',
          status: 'new',
          email: 'b2@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [{ score: 50, reasoning: 'Fair', scored_at: new Date().toISOString() }],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads, count: 2 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        sortBy: 'score_desc',
        page: 1,
        pageSize: 20,
      })

      expect(result.leads).toHaveLength(2)
      // High score should come first (sorted descending)
      expect(result.leads[0].score?.score).toBe(90)
      expect(result.leads[1].score?.score).toBe(50)
    })

    it('should paginate correctly with page and pageSize', async () => {
      const mockLeads = [
        {
          id: 'lead-11',
          name: 'Page 2 Business 1',
          status: 'new',
          email: 'b11@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads, count: 25 }, // Total 25 leads
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        page: 2,
        pageSize: 10,
      })

      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(10)
      expect(result.total).toBe(25)
      expect(result.totalPages).toBe(3) // Math.ceil(25 / 10) = 3
    })

    it('should filter by minScore', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'High Score Lead',
          status: 'new',
          email: 'b1@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [{ score: 75, reasoning: 'Good', scored_at: new Date().toISOString() }],
        },
        {
          id: generateUUID(2),
          name: 'Low Score Lead',
          status: 'new',
          email: 'b2@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          source_type: 'manual',
          place_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'test-workspace-id',
          lead_scores: [{ score: 45, reasoning: 'Fair', scored_at: new Date().toISOString() }],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads, count: 2 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        minScore: 60,
        page: 1,
        pageSize: 20,
      })

      // Should only include leads with score >= 60
      expect(result.leads).toHaveLength(1)
      expect(result.leads[0].score?.score).toBe(75)
    })
  })

  // ============================================================
  // lead.getById Tests
  // ============================================================

  describe('lead.getById', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.getById({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: '00000000-0000-0000-0000-000000000010',
        }),
      ).rejects.toThrow()
    })

    it('should return lead with scores and tags', async () => {
      const mockLead = {
        id: generateUUID(1),
        name: 'Business 1',
        email: 'b1@test.com',
        phone: '08-1234-5678',
        website: 'https://example.com',
        address: '123 Street',
        status: 'new',
        rating: 4.5,
        review_count: 50,
        category: 'Restaurant',
        source_type: 'places_api',
        place_id: 'ChIJN1blFe-O44ARN19QV-xL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        workspace_id: 'test-workspace-id',
        lead_scores: [
          { id: 'score-1', score: 85, reasoning: 'Good prospect', scored_at: new Date().toISOString() },
        ],
        lead_tags: [
          { id: 'tag-1', tag: 'vip-customer' },
          { id: 'tag-2', tag: 'hot-lead' },
        ],
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: mockLead },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.getById({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
      })

      expect(result.id).toBe(generateUUID(1))
      expect(result.name).toBe('Business 1')
      expect(result.email).toBe('b1@test.com')
      expect(Array.isArray(result.lead_scores)).toBe(true)
      expect(result.lead_scores).toHaveLength(1)
      expect(result.lead_scores[0].score).toBe(85)
      expect(Array.isArray(result.lead_tags)).toBe(true)
      expect(result.lead_tags).toHaveLength(2)
    })

    it('should throw NOT_FOUND for non-existent lead', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: null },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())

      await expect(
        caller.lead.getById({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: generateUUID(999),
        }),
      ).rejects.toThrow()
    })

    it('should throw FORBIDDEN when user is not workspace member', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: null },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())

      await expect(
        caller.lead.getById({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: generateUUID(1),
        }),
      ).rejects.toThrow()
    })
  })

  // ============================================================
  // lead.create Tests
  // ============================================================

  describe('lead.create', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.create({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          name: 'Test Business',
        }),
      ).rejects.toThrow()
    })

    it('should create a lead with valid data', async () => {
      const newLead = {
        id: 'new-lead-1',
        workspace_id: 'test-workspace-id',
        name: 'ร้านอาหารทดสอบ',
        email: 'restaurant@example.com',
        phone: '08-1234-5678',
        website: 'https://example.com',
        address: null,
        status: 'new',
        rating: null,
        review_count: null,
        category: null,
        source_type: 'manual',
        place_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: newLead },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.create({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        name: 'ร้านอาหารทดสอบ',
        email: 'restaurant@example.com',
        phone: '08-1234-5678',
        website: 'https://example.com',
      })

      expect(result.id).toBe('new-lead-1')
      expect(result.name).toBe('ร้านอาหารทดสอบ')
      expect(result.email).toBe('restaurant@example.com')
      expect(result.status).toBe('new')
    })

    it.skip('should accept optional fields', async () => {
      const newLead = {
        id: generateUUID(2),
        workspace_id: '00000000-0000-0000-0000-000000000001',
        name: 'ธุรกิจขนาดเล็ก',
        email: null,
        phone: null,
        website: null,
        address: null,
        status: 'new',
        rating: 4.5,
        review_count: 125,
        category: 'Restaurant',
        source_type: 'places_api',
        place_id: 'ChIJN1blFe-O44ARN19QV-xL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Manual mock for from() to handle multiple calls with different behaviors
      let leadsCallCount = 0
      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return createMockQueryChain({ role: 'agency_member' })
        }
        if (table === 'leads') {
          leadsCallCount++
          if (leadsCallCount === 1) {
            // First call: check for duplicates (maybeSingle should return null)
            return createMockQueryChain(null, null)
          } else {
            // Second call: insert new lead
            return createMockQueryChain(newLead)
          }
        }
        return createMockQueryChain(null)
      })

      const mockSupabaseClient = { from: fromMock }
      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.create({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        name: 'ธุรกิจขนาดเล็ก',
        placeId: 'ChIJN1blFe-O44ARN19QV-xL',
        rating: 4.5,
        reviewCount: 125,
        category: 'Restaurant',
      })

      expect(result.name).toBe('ธุรกิจขนาดเล็ก')
      expect(result.place_id).toBe('ChIJN1blFe-O44ARN19QV-xL')
      expect(result.rating).toBe(4.5)
      expect(result.review_count).toBe(125)
    })

    it('should validate email format', async () => {
      const caller = createTestCaller(createMockContext())

      await expect(
        caller.lead.create({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          name: 'Invalid Email',
          email: 'not-an-email',
        }),
      ).rejects.toThrow()
    })

    it('should reject duplicate place_id', async () => {
      const existingLead = {
        id: 'existing-lead-1',
        name: 'Existing Business',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: existingLead }, // Duplicate found
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())

      await expect(
        caller.lead.create({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          name: 'Duplicate Business',
          placeId: 'ChIJN1blFe-O44ARN19QV-xL',
        }),
      ).rejects.toThrow()
    })

    it('should not require email when not provided', async () => {
      const newLead = {
        id: 'new-lead-3',
        workspace_id: 'test-workspace-id',
        name: 'Business Without Email',
        email: null,
        phone: null,
        website: null,
        address: null,
        status: 'new',
        rating: null,
        review_count: null,
        category: null,
        source_type: 'manual',
        place_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: newLead },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.create({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        name: 'Business Without Email',
      })

      expect(result.email).toBeNull()
      expect(result.name).toBe('Business Without Email')
    })
  })

  // ============================================================
  // lead.createBulk Tests
  // ============================================================

  describe('lead.createBulk', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.createBulk({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leads: [{ name: 'Test' }],
        }),
      ).rejects.toThrow()
    })

    it('should create multiple leads', async () => {
      const createdLeads = [
        { id: generateUUID(1) },
        { id: generateUUID(2) },
        { id: generateUUID(3) },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: createdLeads },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.createBulk({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leads: [
          { name: 'Business 1', email: 'b1@example.com' },
          { name: 'Business 2', email: 'b2@example.com' },
          { name: 'Business 3', email: 'b3@example.com' },
        ],
      })

      expect(result.created).toBe(3)
      expect(result.skipped).toBe(0)
    })

    it('should reject more than 50 leads', async () => {
      const caller = createTestCaller(createMockContext())

      const tooManyLeads = Array.from({ length: 51 }, (_, i) => ({
        name: `Business ${i + 1}`,
      }))

      await expect(
        caller.lead.createBulk({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leads: tooManyLeads,
        }),
      ).rejects.toThrow()
    })

    it('should skip existing place_ids', async () => {
      const createdLeads = [{ id: generateUUID(1) }] // Only 1 created

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: createdLeads },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.createBulk({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leads: [
          { name: 'New Business', placeId: 'unique-place-1' },
          { name: 'Existing Business', placeId: 'existing-place-id' },
        ],
      })

      expect(result.created).toBe(1)
      expect(result.skipped).toBe(1)
    })
  })

  // ============================================================
  // lead.update Tests
  // ============================================================

  describe('lead.update', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.update({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: '00000000-0000-0000-0000-000000000010',
          status: 'qualified',
        }),
      ).rejects.toThrow()
    })

    it('should update lead status', async () => {
      const updatedLead = {
        id: generateUUID(1),
        name: 'Business 1',
        status: 'qualified',
        email: 'b1@test.com',
        phone: null,
        website: null,
        address: null,
        rating: null,
        review_count: null,
        category: null,
        source_type: 'manual',
        place_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        workspace_id: 'test-workspace-id',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: updatedLead },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.update({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
        status: 'qualified',
      })

      expect(result.status).toBe('qualified')
    })

    it('should update lead email', async () => {
      const updatedLead = {
        id: generateUUID(1),
        name: 'Business 1',
        status: 'new',
        email: 'newemail@example.com',
        phone: null,
        website: null,
        address: null,
        rating: null,
        review_count: null,
        category: null,
        source_type: 'manual',
        place_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        workspace_id: 'test-workspace-id',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: updatedLead },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.update({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
        email: 'newemail@example.com',
      })

      expect(result.email).toBe('newemail@example.com')
    })

    it('should update multiple fields at once', async () => {
      const updatedLead = {
        id: generateUUID(1),
        name: 'Business 1',
        status: 'contacted',
        email: 'updated@example.com',
        phone: '08-9999-8888',
        website: null,
        address: null,
        rating: null,
        review_count: null,
        category: null,
        source_type: 'manual',
        place_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        workspace_id: 'test-workspace-id',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: updatedLead },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.update({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
        status: 'contacted',
        email: 'updated@example.com',
        phone: '08-9999-8888',
      })

      expect(result.status).toBe('contacted')
      expect(result.email).toBe('updated@example.com')
      expect(result.phone).toBe('08-9999-8888')
    })
  })

  // ============================================================
  // lead.delete Tests
  // ============================================================

  describe('lead.delete', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.delete({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: '00000000-0000-0000-0000-000000000010',
        }),
      ).rejects.toThrow()
    })

    it('should delete a lead with agency_admin role', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_admin' } },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.delete({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
      })

      expect(result.success).toBe(true)
      expect(result.deletedId).toBe(generateUUID(1))
    })

    it('should reject deletion without proper role', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'viewer' } },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())

      await expect(
        caller.lead.delete({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: generateUUID(1),
        }),
      ).rejects.toThrow()
    })
  })

  // ============================================================
  // lead.deleteBulk Tests
  // ============================================================

  describe('lead.deleteBulk', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.deleteBulk({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadIds: ['00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012'],
        }),
      ).rejects.toThrow()
    })

    it('should delete multiple leads with proper role', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_admin' } },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const leadIds = [generateUUID(1), generateUUID(2), generateUUID(3)]
      const result = await caller.lead.deleteBulk({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadIds,
      })

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(3)
    })
  })

  // ============================================================
  // lead.addTag Tests
  // ============================================================

  describe('lead.addTag', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.addTag({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: '00000000-0000-0000-0000-000000000010',
          tag: 'hot-lead',
        }),
      ).rejects.toThrow()
    })

    it('should add tag to lead', async () => {
      const newTag = { id: 'tag-1', tag: 'vip-customer', lead_id: generateUUID(1) }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: { id: generateUUID(1) } },
          lead_tags: { single: newTag },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.addTag({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
        tag: 'vip-customer',
      })

      expect(result.id).toBe('tag-1')
      expect(result.tag).toBe('vip-customer')
    })
  })

  // ============================================================
  // lead.getEmailActivity Tests
  // ============================================================

  describe('lead.getEmailActivity', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.getEmailActivity({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          leadId: '00000000-0000-0000-0000-000000000010',
        }),
      ).rejects.toThrow()
    })

    it('should return email activity for lead', async () => {
      const mockActivityData = [
        {
          id: 'event-1',
          event_type: 'sent',
          occurred_at: new Date().toISOString(),
          campaign_emails: { id: 'email-1', subject: 'Welcome' },
        },
        {
          id: 'event-2',
          event_type: 'opened',
          occurred_at: new Date().toISOString(),
          campaign_emails: { id: 'email-1', subject: 'Welcome' },
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { single: { id: generateUUID(1) } },
          email_events: { data: mockActivityData },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.getEmailActivity({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        leadId: generateUUID(1),
        limit: 10,
      })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0].event_type).toBe('sent')
      expect(result[0].subject).toBe('Welcome')
    })
  })

  // ============================================================
  // lead.exportCsv Tests
  // ============================================================

  describe('lead.exportCsv', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.lead.exportCsv({
          workspaceId: '00000000-0000-0000-0000-000000000001',
        }),
      ).rejects.toThrow()
    })

    it('should return CSV data with headers and rows', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'Business 1',
          status: 'new',
          email: 'b1@test.com',
          phone: '08-1111-1111',
          website: 'https://b1.com',
          address: 'Address 1',
          rating: 4.5,
          review_count: 50,
          category: 'Restaurant',
          created_at: new Date().toISOString(),
          lead_scores: [{ score: 85, reasoning: 'Good', scored_at: new Date().toISOString() }],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.exportCsv({
        workspaceId: '00000000-0000-0000-0000-000000000001',
      })

      expect(result).toHaveProperty('headers')
      expect(result).toHaveProperty('rows')
      expect(Array.isArray(result.headers)).toBe(true)
      expect(result.headers.length).toBeGreaterThan(0)
      expect(Array.isArray(result.rows)).toBe(true)
      expect(result.rows).toHaveLength(1)
    })

    it('should filter export by status', async () => {
      const mockLeads = [
        {
          id: generateUUID(1),
          name: 'Qualified Business',
          status: 'qualified',
          email: 'b1@test.com',
          phone: null,
          website: null,
          address: null,
          rating: null,
          review_count: null,
          category: null,
          created_at: new Date().toISOString(),
          lead_scores: [],
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: mockLeads },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.lead.exportCsv({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        status: 'qualified',
      })

      expect(Array.isArray(result.rows)).toBe(true)
      expect(result.rows).toHaveLength(1)
    })
  })
})
