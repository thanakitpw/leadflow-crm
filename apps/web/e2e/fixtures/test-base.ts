import { test as base, Page, expect } from '@playwright/test'

// ทดสอบ credentials
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@leadflow.dev',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  workspaceName: process.env.TEST_WORKSPACE_NAME || 'Test Workspace',
}

export const test = base.extend<{
  authenticatedPage: Page
  testUser: typeof TEST_USER
}>({
  testUser: async ({}, use) => {
    await use(TEST_USER)
  },

  authenticatedPage: async ({ page }, use) => {
    // ไปที่หน้า login
    await page.goto('/login')

    // รอให้ฟอร์ม login โหลด
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })

    // กรอก credentials
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)

    // กดปุ่ม submit
    await page.click('button[type="submit"]')

    // รอให้ redirect ไปหน้า workspace selection หรือ dashboard
    // อาจขึ้น workspace selection ถ้าเป็น user ครั้งแรก
    await page.waitForURL(/\/(dashboard|workspace|[a-f0-9\-]{36}|$)/, { timeout: 10000 })

    await use(page)

    // ออกจากระบบหลังจาก test
    // เมื่อ test เสร็จ ให้ logout (ถ้าต้องการ)
  },
})

export { expect }
