import { describe, it, expect } from 'vitest'
import {
  replaceVariables,
  extractVariables,
  findMissingVariables,
  AVAILABLE_VARIABLES,
} from '@/lib/email/template-variables'

/**
 * Email Template Variables Tests
 * ทดสอบ helper functions สำหรับ email template variables
 */

describe('Template Variables', () => {
  // ============================================================
  // replaceVariables Tests
  // ============================================================

  describe('replaceVariables', () => {
    it('should replace {{business_name}} with value', () => {
      const template = 'สวัสดี {{business_name}}'
      const data = { business_name: 'ร้านอาหาร ABC' }
      const result = replaceVariables(template, data)

      expect(result).toBe('สวัสดี ร้านอาหาร ABC')
    })

    it('should replace {{first_name}} with value', () => {
      const template = 'เรียนคุณ {{first_name}}'
      const data = { first_name: 'สมชาย' }
      const result = replaceVariables(template, data)

      expect(result).toBe('เรียนคุณ สมชาย')
    })

    it('should replace {{location}} with value', () => {
      const template = 'เรียนผู้ประกอบการที่ {{location}}'
      const data = { location: 'กรุงเทพมหานคร' }
      const result = replaceVariables(template, data)

      expect(result).toBe('เรียนผู้ประกอบการที่ กรุงเทพมหานคร')
    })

    it('should replace multiple variables in one template', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}} ที่ {{location}}'
      const data = {
        first_name: 'สมชาย',
        business_name: 'ร้านอาหาร ABC',
        location: 'กรุงเทพมหานคร',
      }
      const result = replaceVariables(template, data)

      expect(result).toBe('สวัสดี สมชาย จาก ร้านอาหาร ABC ที่ กรุงเทพมหานคร')
    })

    it('should handle missing variables gracefully by replacing with empty string', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}}'
      const data = { first_name: 'สมชาย' }
      const result = replaceVariables(template, data)

      expect(result).toBe('สวัสดี สมชาย จาก ')
    })

    it('should handle variables with spaces around name', () => {
      const template = 'สวัสดี {{  business_name  }}'
      const data = { business_name: 'ร้านอาหาร ABC' }
      const result = replaceVariables(template, data)

      expect(result).toBe('สวัสดี ร้านอาหาร ABC')
    })

    it('should handle empty data object', () => {
      const template = 'สวัสดี {{first_name}}'
      const result = replaceVariables(template, {})

      expect(result).toBe('สวัสดี ')
    })

    it('should handle template with no variables', () => {
      const template = 'สวัสดีครับ'
      const result = replaceVariables(template, {})

      expect(result).toBe('สวัสดีครับ')
    })

    it('should replace all occurrences of the same variable', () => {
      const template = '{{business_name}} เชิญ {{business_name}} มาร่วม'
      const data = { business_name: 'ร้านอาหาร ABC' }
      const result = replaceVariables(template, data)

      expect(result).toBe('ร้านอาหาร ABC เชิญ ร้านอาหาร ABC มาร่วม')
    })

    it('should handle variables with special characters in names', () => {
      const template = 'สวัสดี {{first_name_en}}'
      const data = { first_name_en: 'John' }
      const result = replaceVariables(template, data)

      expect(result).toBe('สวัสดี John')
    })
  })

  // ============================================================
  // extractVariables Tests
  // ============================================================

  describe('extractVariables', () => {
    it('should extract single variable from template', () => {
      const template = 'สวัสดี {{business_name}}'
      const result = extractVariables(template)

      expect(result).toContain('business_name')
      expect(result.length).toBe(1)
    })

    it('should extract multiple variables from template', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}} ที่ {{location}}'
      const result = extractVariables(template)

      expect(result).toContain('first_name')
      expect(result).toContain('business_name')
      expect(result).toContain('location')
      expect(result.length).toBe(3)
    })

    it('should handle variables with spaces', () => {
      const template = 'สวัสดี {{  business_name  }}'
      const result = extractVariables(template)

      expect(result).toContain('business_name')
    })

    it('should remove duplicates when variable is used multiple times', () => {
      const template = '{{business_name}} หรือ {{business_name}}'
      const result = extractVariables(template)

      expect(result).toContain('business_name')
      expect(result.filter((v) => v === 'business_name').length).toBe(1)
    })

    it('should return empty array when no variables found', () => {
      const template = 'สวัสดีครับ'
      const result = extractVariables(template)

      expect(result.length).toBe(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle templates with special characters', () => {
      const template = '{{email}} และ {{phone}} ที่ {{website}}'
      const result = extractVariables(template)

      expect(result).toContain('email')
      expect(result).toContain('phone')
      expect(result).toContain('website')
    })
  })

  // ============================================================
  // findMissingVariables Tests
  // ============================================================

  describe('findMissingVariables', () => {
    it('should return empty array when all variables have values', () => {
      const template = '{{first_name}} {{last_name}}'
      const data = { first_name: 'สมชาย', last_name: 'สมบูรณ์' }
      const result = findMissingVariables(template, data)

      expect(result.length).toBe(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should find missing variable', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}}'
      const data = { first_name: 'สมชาย' }
      const result = findMissingVariables(template, data)

      expect(result).toContain('business_name')
      expect(result.length).toBe(1)
    })

    it('should find multiple missing variables', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}} ที่ {{location}}'
      const data = { first_name: 'สมชาย' }
      const result = findMissingVariables(template, data)

      expect(result).toContain('business_name')
      expect(result).toContain('location')
      expect(result.length).toBe(2)
    })

    it('should consider empty string as missing value', () => {
      const template = 'สวัสดี {{first_name}}'
      const data = { first_name: '' }
      const result = findMissingVariables(template, data)

      expect(result).toContain('first_name')
    })

    it('should handle empty data object', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}}'
      const result = findMissingVariables(template, {})

      expect(result).toContain('first_name')
      expect(result).toContain('business_name')
      expect(result.length).toBe(2)
    })

    it('should return empty array when template has no variables', () => {
      const template = 'สวัสดีครับ'
      const data = {}
      const result = findMissingVariables(template, data)

      expect(result.length).toBe(0)
    })

    it('should detect missing variables even when some are present', () => {
      const template = 'สวัสดี {{first_name}} จาก {{business_name}} เบอร์ {{phone}}'
      const data = { first_name: 'สมชาย', business_name: 'ร้านอาหาร ABC' }
      const result = findMissingVariables(template, data)

      expect(result).toContain('phone')
      expect(result).not.toContain('first_name')
      expect(result).not.toContain('business_name')
    })
  })

  // ============================================================
  // AVAILABLE_VARIABLES Tests
  // ============================================================

  describe('AVAILABLE_VARIABLES', () => {
    it('should have standard business variables', () => {
      const names = AVAILABLE_VARIABLES.map((v) => v.name)

      expect(names).toContain('business_name')
      expect(names).toContain('first_name')
      expect(names).toContain('location')
      expect(names).toContain('category')
      expect(names).toContain('email')
      expect(names).toContain('phone')
      expect(names).toContain('website')
    })

    it('should have label for each variable', () => {
      AVAILABLE_VARIABLES.forEach((v) => {
        expect(v.label).toBeDefined()
        expect(v.label.length).toBeGreaterThan(0)
      })
    })

    it('should have unique variable names', () => {
      const names = AVAILABLE_VARIABLES.map((v) => v.name)
      const uniqueNames = new Set(names)

      expect(uniqueNames.size).toBe(names.length)
    })
  })

  // ============================================================
  // Integration Tests
  // ============================================================

  describe('Integration tests', () => {
    it('should validate template and replace variables correctly', () => {
      const template = 'เรียนคุณ {{first_name}} ผู้บริหาร {{business_name}}'
      const leadData = {
        first_name: 'สมชาย',
        business_name: 'ร้านอาหาร ABC',
        location: 'กรุงเทพมหานคร',
        category: 'Restaurant',
        email: 'contact@restaurant.com',
        phone: '08-1234-5678',
        website: 'https://restaurant.com',
      }

      const missingVars = findMissingVariables(template, leadData)
      expect(missingVars.length).toBe(0)

      const result = replaceVariables(template, leadData)
      expect(result).toBe('เรียนคุณ สมชาย ผู้บริหาร ร้านอาหาร ABC')
    })

    it('should handle incomplete lead data gracefully', () => {
      const template = 'เรียนคุณ {{first_name}} ผู้บริหาร {{business_name}} ที่ {{location}}'
      const incompleteData = {
        first_name: 'สมชาย',
        business_name: 'ร้านอาหาร ABC',
        // location is missing
      }

      const missingVars = findMissingVariables(template, incompleteData)
      expect(missingVars).toContain('location')

      // ยังสามารถแทนที่ variables ที่มีได้
      const result = replaceVariables(template, incompleteData)
      expect(result).toBe('เรียนคุณ สมชาย ผู้บริหาร ร้านอาหาร ABC ที่ ')
    })

    it('should support complex email templates with many variables', () => {
      const template = `
สวัสดี {{first_name}},

ขอเชิญ {{business_name}} ที่ {{location}} ({{category}})
ติดต่อ: {{email}} / {{phone}}
เว็บไซต์: {{website}}
      `

      const data = {
        first_name: 'สมชาย',
        business_name: 'ร้านอาหาร ABC',
        location: 'สุขุมวิท 39',
        category: 'Thai Restaurant',
        email: 'contact@restaurant.com',
        phone: '02-123-4567',
        website: 'https://restaurant.com',
      }

      const missingVars = findMissingVariables(template, data)
      expect(missingVars.length).toBe(0)

      const result = replaceVariables(template, data)
      expect(result).toContain('สมชาย')
      expect(result).toContain('ร้านอาหาร ABC')
      expect(result).toContain('สุขุมวิท 39')
    })
  })
})
