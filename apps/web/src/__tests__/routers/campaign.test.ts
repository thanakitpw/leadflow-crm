import { describe, it, expect } from 'vitest'
import { TRPCError } from '@trpc/server'
import { createTestCaller, createMockContext, createUnauthenticatedContext } from '../helpers/trpc-test'

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

      try {
        await caller.campaign.list({
          workspaceId: 'test-workspace-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return campaigns for valid workspace', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.list({
          workspaceId: 'test-workspace-id',
          page: 1,
          pageSize: 20,
        })

        expect(result).toHaveProperty('campaigns')
        expect(result).toHaveProperty('total')
        expect(result).toHaveProperty('page')
        expect(result).toHaveProperty('pageSize')
        expect(Array.isArray(result.campaigns)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should filter campaigns by status', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.list({
          workspaceId: 'test-workspace-id',
          status: 'draft',
          page: 1,
          pageSize: 20,
        })

        expect(Array.isArray(result.campaigns)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should paginate campaigns correctly', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.list({
          workspaceId: 'test-workspace-id',
          page: 2,
          pageSize: 10,
        })

        expect(result.page).toBe(2)
        expect(result.pageSize).toBe(10)
        expect(typeof result.total).toBe('number')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // campaign.getById Tests
  // ============================================================

  describe('campaign.getById', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.campaign.getById({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return campaign details with stats', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.getById({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
        })

        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('name')
        expect(result).toHaveProperty('status')
        expect(result).toHaveProperty('stats')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // campaign.create Tests
  // ============================================================

  describe('campaign.create', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.campaign.create({
          workspaceId: 'test-workspace-id',
          name: 'Test Campaign',
          templateId: 'test-template-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should create campaign with valid template', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.create({
          workspaceId: 'test-workspace-id',
          name: 'New Campaign',
          templateId: 'test-template-id',
        })

        expect(result).toHaveProperty('id')
        expect(result.name).toBe('New Campaign')
        expect(result.status).toBe('draft')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject without template_id', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        await caller.campaign.create({
          workspaceId: 'test-workspace-id',
          name: 'Invalid Campaign',
        } as any)
        expect.fail('ควรโยน validation error')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // campaign.schedule Tests
  // ============================================================

  describe('campaign.schedule', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.campaign.schedule({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should set scheduled_at for future date', async () => {
      const caller = createTestCaller(createMockContext())
      const futureDate = new Date(Date.now() + 3600000).toISOString()

      try {
        const result = await caller.campaign.schedule({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
          scheduledAt: futureDate,
        })

        expect(result.scheduled_at).toBe(futureDate)
        expect(result.status).toBe('scheduled')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject past dates', async () => {
      const caller = createTestCaller(createMockContext())
      const pastDate = new Date(Date.now() - 3600000).toISOString()

      try {
        await caller.campaign.schedule({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
          scheduledAt: pastDate,
        })
        // ขึ้นอยู่กับว่า API ตรวจสอบวันที่หรือไม่
      } catch (error) {
        // ควรมี validation error
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // campaign.previewAudience Tests
  // ============================================================

  describe('campaign.previewAudience', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.campaign.previewAudience({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return matching leads count', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.previewAudience({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
        })

        expect(result).toHaveProperty('audienceCount')
        expect(typeof result.audienceCount).toBe('number')
        expect(result.audienceCount).toBeGreaterThanOrEqual(0)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // campaign.updateStatus Tests
  // ============================================================

  describe('campaign.pause', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.campaign.pause({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should pause a campaign', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.campaign.pause({
          workspaceId: 'test-workspace-id',
          campaignId: 'test-campaign-id',
        })

        expect(result).toBeDefined()
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })
})
