import { describe, it, expect, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { createTestCaller, createMockContext, createUnauthenticatedContext, createMockSupabaseFrom, generateUUID } from '../helpers/trpc-test'

// Mock Supabase server client at module level
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Import the mocked createClient
import { createClient } from '@/lib/supabase/server'

// Track the mock for reuse in tests
const mockCreateClient = createClient as any

/**
 * Campaign Router Tests
 * ทดสอบ behavior ของ campaign router procedures
 */

describe('campaign router', () => {
  // ============================================================
  // campaign.list Tests
  // ============================================================

  describe('campaign.list', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.list({
          workspaceId: '00000000-0000-0000-0000-000000000001',
        }),
      ).rejects.toThrow()
    })

    it('should return campaigns for valid workspace', async () => {
      const mockCampaigns = [
        {
          id: generateUUID(10),
          name: 'Q1 Campaign',
          status: 'draft',
          scheduled_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          template_id: generateUUID(100),
          sending_domain_id: generateUUID(200),
          workspace_id: '00000000-0000-0000-0000-000000000001',
          email_templates: { name: 'Welcome Email' },
          sending_domains: { domain: 'noreply@example.com' },
        },
        {
          id: generateUUID(20),
          name: 'Q2 Campaign',
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          template_id: generateUUID(101),
          sending_domain_id: generateUUID(200),
          workspace_id: '00000000-0000-0000-0000-000000000001',
          email_templates: { name: 'Follow-up Email' },
          sending_domains: { domain: 'noreply@example.com' },
        },
      ]

      const mockCampaignContacts = [
        { campaign_id: generateUUID(10), status: 'sent' },
        { campaign_id: generateUUID(10), status: 'opened' },
        { campaign_id: generateUUID(20), status: 'pending' },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { data: mockCampaigns, count: 2 },
          campaign_contacts: { data: mockCampaignContacts },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        page: 1,
        pageSize: 20,
      })

      expect(result.campaigns).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
      expect(result.campaigns[0].name).toBe('Q1 Campaign')
    })

    it('should filter campaigns by status', async () => {
      const mockCampaigns = [
        {
          id: generateUUID(10),
          name: 'Draft Campaign',
          status: 'draft',
          scheduled_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          template_id: generateUUID(100),
          sending_domain_id: generateUUID(200),
          workspace_id: '00000000-0000-0000-0000-000000000001',
          email_templates: { name: 'Email' },
          sending_domains: { domain: 'noreply@example.com' },
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { data: mockCampaigns, count: 1 },
          campaign_contacts: { data: [] },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        status: 'draft',
        page: 1,
        pageSize: 20,
      })

      expect(result.campaigns).toHaveLength(1)
      expect(result.campaigns[0].status).toBe('draft')
    })

    it('should paginate campaigns correctly', async () => {
      const mockCampaigns = Array.from({ length: 10 }, (_, i) => ({
        id: generateUUID(300 + i),
        name: `Campaign ${i + 1}`,
        status: 'draft',
        scheduled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_id: generateUUID(100),
        sending_domain_id: generateUUID(200),
        workspace_id: '00000000-0000-0000-0000-000000000001',
        email_templates: { name: 'Email' },
        sending_domains: { domain: 'noreply@example.com' },
      }))

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { data: mockCampaigns, count: 25 },
          campaign_contacts: { data: [] },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.list({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        page: 2,
        pageSize: 10,
      })

      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(10)
      expect(result.total).toBe(25)
      expect(result.totalPages).toBe(3)
    })
  })

  // ============================================================
  // campaign.getById Tests
  // ============================================================

  describe('campaign.getById', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.getById({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          campaignId: '00000000-0000-0000-0000-000000000020',
        }),
      ).rejects.toThrow()
    })

    it('should return campaign details with stats', async () => {
      const mockCampaign = {
        id: generateUUID(10),
        name: 'Q1 Campaign',
        status: 'sending',
        scheduled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_id: generateUUID(100),
        sending_domain_id: generateUUID(200),
        workspace_id: '00000000-0000-0000-0000-000000000001',
        email_templates: { id: generateUUID(100), name: 'Welcome', subject: 'Welcome!', body_html: '<p>Welcome</p>' },
        sending_domains: { id: generateUUID(200), domain: 'noreply@example.com', status: 'verified' },
      }

      const mockStats = [
        { status: 'sent' },
        { status: 'sent' },
        { status: 'opened' },
        { status: 'pending' },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { single: mockCampaign },
          campaign_contacts: { data: mockStats },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.getById({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        campaignId: generateUUID(10),
      })

      expect(result.id).toBe(generateUUID(10))
      expect(result.name).toBe('Q1 Campaign')
      expect(result.status).toBe('sending')
      expect(result.stats).toHaveProperty('total')
      expect(result.stats).toHaveProperty('sent')
      expect(result.stats).toHaveProperty('opened')
    })
  })

  // ============================================================
  // campaign.create Tests
  // ============================================================

  describe('campaign.create', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.create({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          name: 'Test Campaign',
        }),
      ).rejects.toThrow()
    })

    it('should create campaign with valid data', async () => {
      const newCampaign = {
        id: generateUUID(11),
        name: 'New Campaign',
        status: 'draft',
        scheduled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_id: generateUUID(100),
        sending_domain_id: null,
        workspace_id: '00000000-0000-0000-0000-000000000001',
        audience_filter: null,
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { single: newCampaign },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.create({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        name: 'New Campaign',
      })

      expect(result.id).toBe(generateUUID(11))
      expect(result.name).toBe('New Campaign')
      expect(result.status).toBe('draft')
    })
  })

  // ============================================================
  // campaign.schedule Tests
  // ============================================================

  describe('campaign.schedule', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.schedule({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          campaignId: '00000000-0000-0000-0000-000000000020',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      ).rejects.toThrow()
    })

    it('should set scheduled_at for future date', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString()
      const scheduledCampaign = {
        id: generateUUID(10),
        name: 'Campaign',
        status: 'scheduled',
        scheduled_at: futureDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_id: generateUUID(100),
        sending_domain_id: generateUUID(200),
        workspace_id: '00000000-0000-0000-0000-000000000001',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { single: scheduledCampaign },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.schedule({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        campaignId: generateUUID(10),
        scheduledAt: futureDate,
      })

      expect(result.status).toBe('scheduled')
      expect(result.scheduled_at).toBe(futureDate)
    })
  })

  // ============================================================
  // campaign.getContacts Tests
  // ============================================================

  describe('campaign.getContacts', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.getContacts({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          campaignId: generateUUID(10),
        }),
      ).rejects.toThrow()
    })

    it('should return campaign contacts with pagination', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          status: 'sent',
          sent_at: new Date().toISOString(),
          opened_at: null,
          clicked_at: null,
          bounced_at: null,
          created_at: new Date().toISOString(),
          leads: { id: generateUUID(1), name: 'Business 1', email: 'b1@test.com' },
        },
        {
          id: 'contact-2',
          status: 'opened',
          sent_at: new Date().toISOString(),
          opened_at: new Date().toISOString(),
          clicked_at: null,
          bounced_at: null,
          created_at: new Date().toISOString(),
          leads: { id: generateUUID(2), name: 'Business 2', email: 'b2@test.com' },
        },
      ]

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaign_contacts: { data: mockContacts, count: 2 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.getContacts({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        campaignId: generateUUID(10),
        page: 1,
        pageSize: 20,
      })

      expect(result.contacts).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.contacts[0].status).toBe('sent')
      expect(result.contacts[1].status).toBe('opened')
    })
  })

  // ============================================================
  // campaign.previewAudience Tests
  // ============================================================

  describe('campaign.previewAudience', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.previewAudience({
          workspaceId: '00000000-0000-0000-0000-000000000001',
        }),
      ).rejects.toThrow()
    })

    it('should return matching leads count', async () => {
      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          leads: { data: Array(42).fill({}), count: 42 },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.previewAudience({
        workspaceId: '00000000-0000-0000-0000-000000000001',
      })

      expect(result).toHaveProperty('count')
      expect(result.count).toBe(42)
    })
  })

  // ============================================================
  // campaign.pause Tests
  // ============================================================

  describe('campaign.pause', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.pause({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          campaignId: '00000000-0000-0000-0000-000000000020',
        }),
      ).rejects.toThrow()
    })

    it('should pause a sending campaign', async () => {
      const pausedCampaign = {
        id: generateUUID(10),
        name: 'Campaign',
        status: 'paused',
        scheduled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_id: generateUUID(100),
        sending_domain_id: generateUUID(200),
        workspace_id: '00000000-0000-0000-0000-000000000001',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { single: pausedCampaign },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.pause({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        campaignId: generateUUID(10),
      })

      expect(result.status).toBe('paused')
    })
  })

  // ============================================================
  // campaign.cancel Tests
  // ============================================================

  describe('campaign.cancel', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      await expect(
        caller.campaign.cancel({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          campaignId: '00000000-0000-0000-0000-000000000020',
        }),
      ).rejects.toThrow()
    })

    it('should cancel a campaign', async () => {
      const cancelledCampaign = {
        id: generateUUID(10),
        name: 'Campaign',
        status: 'cancelled',
        scheduled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_id: generateUUID(100),
        sending_domain_id: generateUUID(200),
        workspace_id: '00000000-0000-0000-0000-000000000001',
      }

      const mockSupabaseClient = {
        from: createMockSupabaseFrom({
          workspace_members: { single: { role: 'agency_member' } },
          campaigns: { single: cancelledCampaign },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabaseClient)

      const caller = createTestCaller(createMockContext())
      const result = await caller.campaign.cancel({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        campaignId: generateUUID(10),
      })

      expect(result.status).toBe('cancelled')
    })
  })
})
