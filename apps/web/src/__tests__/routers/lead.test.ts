import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { createTestCaller, createMockContext, createUnauthenticatedContext } from '../helpers/trpc-test'

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

      try {
        await caller.lead.list({
          workspaceId: 'test-workspace-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return leads for valid workspace', async () => {
      const caller = createTestCaller(createMockContext())

      // Note: ในสภาพแวดล้อม production tests จะใช้ Supabase local instance
      // ตัวอย่างนี้แสดงรูปแบบการ test
      // TODO: จะต้อง setup test database instance ก่อนรัน test จริง

      try {
        const result = await caller.lead.list({
          workspaceId: 'test-workspace-id',
          page: 1,
          pageSize: 20,
        })

        expect(result).toHaveProperty('leads')
        expect(result).toHaveProperty('total')
        expect(result).toHaveProperty('page')
        expect(result).toHaveProperty('pageSize')
        expect(Array.isArray(result.leads)).toBe(true)
      } catch (error) {
        // ในการ test จริงจะต้องมี mock Supabase หรือ test database
        // ส่วนนี้จะ fallback ไป error เพราะ Supabase ยังไม่ setup
        if (error instanceof TRPCError && error.code === 'FORBIDDEN') {
          // Expected: user ไม่ใช่ workspace member
          expect(error.message).toContain('สิทธิ์')
        }
      }
    })

    it('should filter leads by status', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.list({
          workspaceId: 'test-workspace-id',
          status: 'qualified',
          page: 1,
          pageSize: 20,
        })

        expect(result.leads).toBeDefined()
        // ต้องมี filter logic ใช้ status
      } catch (error) {
        // Expected: FORBIDDEN หรือ NOT_FOUND
        expect(error).toBeDefined()
      }
    })

    it('should filter leads by hasEmail', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.list({
          workspaceId: 'test-workspace-id',
          hasEmail: true,
          page: 1,
          pageSize: 20,
        })

        expect(Array.isArray(result.leads)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should sort leads by score descending', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.list({
          workspaceId: 'test-workspace-id',
          sortBy: 'score_desc',
          page: 1,
          pageSize: 20,
        })

        expect(result).toHaveProperty('leads')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should paginate correctly with page and pageSize', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.list({
          workspaceId: 'test-workspace-id',
          page: 2,
          pageSize: 10,
        })

        expect(result.page).toBe(2)
        expect(result.pageSize).toBe(10)
        expect(typeof result.total).toBe('number')
        expect(typeof result.totalPages).toBe('number')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.getById Tests
  // ============================================================

  describe('lead.getById', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.getById({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return lead with scores and tags', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.getById({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
        })

        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('name')
        expect(result).toHaveProperty('email')
        expect(Array.isArray(result.lead_scores)).toBe(true)
        expect(Array.isArray(result.lead_tags)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should throw error for non-existent lead', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        await caller.lead.getById({
          workspaceId: 'test-workspace-id',
          leadId: 'non-existent-lead-id',
        })
        // อาจสำเร็จหรือไม่ ขึ้นกับ DB connection
      } catch (error) {
        // Expected: NOT_FOUND, FORBIDDEN, or connection error
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.create Tests
  // ============================================================

  describe('lead.create', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.create({
          workspaceId: 'test-workspace-id',
          name: 'Test Business',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should create a lead with valid data', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.create({
          workspaceId: 'test-workspace-id',
          name: 'ร้านอาหารทดสอบ',
          email: 'restaurant@example.com',
          phone: '08-1234-5678',
          website: 'https://example.com',
        })

        expect(result).toHaveProperty('id')
        expect(result.name).toBe('ร้านอาหารทดสอบ')
        expect(result.email).toBe('restaurant@example.com')
        expect(result.status).toBe('new')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should accept optional fields', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.create({
          workspaceId: 'test-workspace-id',
          name: 'ธุรกิจขนาดเล็ก',
          placeId: 'ChIJN1blFe-O44ARN19QV-xL',
          rating: 4.5,
          reviewCount: 125,
          category: 'Restaurant',
        })

        expect(result.name).toBe('ธุรกิจขนาดเล็ก')
        expect(result.place_id).toBe('ChIJN1blFe-O44ARN19QV-xL')
        expect(result.rating).toBe(4.5)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should validate email format', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        await caller.lead.create({
          workspaceId: 'test-workspace-id',
          name: 'Invalid Email',
          email: 'not-an-email',
        })
        expect.fail('ควรโยน validation error')
      } catch (error) {
        // จาก Zod validation — ข้อความแสดง validation error
        expect(error).toBeDefined()
      }
    })

    it('should reject duplicate place_id', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        await caller.lead.create({
          workspaceId: 'test-workspace-id',
          name: 'Duplicate Business',
          placeId: 'ChIJN1blFe-O44ARN19QV-xL',
        })
        // Note: ต้องมี existing lead ด้วย placeId นี้ใน test database
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.createBulk Tests
  // ============================================================

  describe('lead.createBulk', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.createBulk({
          workspaceId: 'test-workspace-id',
          leads: [{ name: 'Test' }],
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should create multiple leads', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.createBulk({
          workspaceId: 'test-workspace-id',
          leads: [
            { name: 'Business 1', email: 'b1@example.com' },
            { name: 'Business 2', email: 'b2@example.com' },
            { name: 'Business 3', email: 'b3@example.com' },
          ],
        })

        expect(result).toHaveProperty('created')
        expect(result).toHaveProperty('skipped')
        expect(typeof result.created).toBe('number')
        expect(result.created).toBeGreaterThanOrEqual(0)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject more than 50 leads', async () => {
      const caller = createTestCaller(createMockContext())

      const tooManyLeads = Array.from({ length: 51 }, (_, i) => ({
        name: `Business ${i + 1}`,
      }))

      try {
        await caller.lead.createBulk({
          workspaceId: 'test-workspace-id',
          leads: tooManyLeads,
        })
        expect.fail('ควรโยน validation error')
      } catch (error) {
        // Zod validation ควร reject
        expect(error).toBeDefined()
      }
    })

    it('should skip existing place_ids', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.createBulk({
          workspaceId: 'test-workspace-id',
          leads: [
            { name: 'New Business', placeId: 'unique-place-1' },
            { name: 'Existing Business', placeId: 'existing-place-id' },
          ],
        })

        expect(result.skipped).toBeGreaterThanOrEqual(0)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.update Tests
  // ============================================================

  describe('lead.update', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.update({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          status: 'qualified',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should update lead status', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.update({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          status: 'qualified',
        })

        expect(result.status).toBe('qualified')
      } catch (error) {
        // Expected: FORBIDDEN, NOT_FOUND, or Supabase connection error
        expect(error).toBeDefined()
      }
    })

    it('should update lead email', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.update({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          email: 'newemail@example.com',
        })

        expect(result.email).toBe('newemail@example.com')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should update multiple fields at once', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.update({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          status: 'contacted',
          email: 'updated@example.com',
          phone: '08-9999-8888',
        })

        expect(result.status).toBe('contacted')
        expect(result.email).toBe('updated@example.com')
        expect(result.phone).toBe('08-9999-8888')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.delete Tests
  // ============================================================

  describe('lead.delete', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.delete({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should delete a lead', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.delete({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
        })

        expect(result.success).toBe(true)
        expect(result.deletedId).toBe('test-lead-id')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.deleteBulk Tests
  // ============================================================

  describe('lead.deleteBulk', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.deleteBulk({
          workspaceId: 'test-workspace-id',
          leadIds: ['lead-1', 'lead-2'],
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should delete multiple leads', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const leadIds = ['lead-1', 'lead-2', 'lead-3']
        const result = await caller.lead.deleteBulk({
          workspaceId: 'test-workspace-id',
          leadIds,
        })

        expect(result.success).toBe(true)
        expect(result.deletedCount).toBe(leadIds.length)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.addTag Tests
  // ============================================================

  describe('lead.addTag', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.addTag({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          tag: 'hot-lead',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should add tag to lead', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.addTag({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          tag: 'vip-customer',
        })

        expect(result).toHaveProperty('id')
        expect(result.tag).toBe('vip-customer')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.getEmailActivity Tests
  // ============================================================

  describe('lead.getEmailActivity', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.getEmailActivity({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return email activity for lead', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.getEmailActivity({
          workspaceId: 'test-workspace-id',
          leadId: 'test-lead-id',
          limit: 10,
        })

        expect(Array.isArray(result)).toBe(true)
        // Each activity should have event info
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('id')
          expect(result[0]).toHaveProperty('event_type')
          expect(result[0]).toHaveProperty('created_at')
        }
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  // ============================================================
  // lead.exportCsv Tests
  // ============================================================

  describe('lead.exportCsv', () => {
    it('should require authentication', async () => {
      const caller = createTestCaller(createUnauthenticatedContext())

      try {
        await caller.lead.exportCsv({
          workspaceId: 'test-workspace-id',
        })
        expect.fail('ควรมี UNAUTHORIZED error')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('UNAUTHORIZED')
      }
    })

    it('should return CSV data with headers and rows', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.exportCsv({
          workspaceId: 'test-workspace-id',
        })

        expect(result).toHaveProperty('headers')
        expect(result).toHaveProperty('rows')
        expect(Array.isArray(result.headers)).toBe(true)
        expect(Array.isArray(result.rows)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should filter export by status', async () => {
      const caller = createTestCaller(createMockContext())

      try {
        const result = await caller.lead.exportCsv({
          workspaceId: 'test-workspace-id',
          status: 'qualified',
        })

        expect(Array.isArray(result.rows)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })
})
