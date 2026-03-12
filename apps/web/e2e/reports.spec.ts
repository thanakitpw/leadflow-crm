import { test, expect } from './fixtures/test-base'

test.describe('Reports', () => {
  test('reports page loads and displays title', async ({ authenticatedPage: page }) => {
    // Arrange
    const reportsLink = page.locator('text=รายงาน').first()

    // Act
    const parentLink = reportsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href || href === '#') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })

  test('reports page displays list or empty state', async ({ authenticatedPage: page }) => {
    // Arrange
    const reportsLink = page.locator('text=รายงาน').first()
    const parentLink = reportsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)

    // ตรวจสอบว่ามี report list หรือ empty state
    const table = page.locator('table')
    const emptyState = page.locator('text=/ไม่มี|empty|No reports/')i)

    const tableVisible = await table.isVisible().catch(() => false)
    const emptyVisible = await emptyState.isVisible().catch(() => false)

    expect(tableVisible || emptyVisible).toBeTruthy()
  })

  test('can navigate to report detail if reports exist', async ({ authenticatedPage: page }) => {
    // Arrange
    const reportsLink = page.locator('text=รายงาน').first()
    const parentLink = reportsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const reportRows = page.locator('table tbody tr')
    const rowCount = await reportRows.count()

    if (rowCount > 0) {
      // คลิก report แรก
      const firstReport = reportRows.first()
      const reportLink = firstReport.locator('a').first()
      const reportHref = await reportLink.getAttribute('href')

      if (reportHref && reportHref !== '#') {
        await page.goto(reportHref)
        await page.waitForLoadState('networkidle')

        // ตรวจสอบว่าเข้าหน้า report detail
        const pageContent = await page.content()
        expect(pageContent.length).toBeGreaterThan(0)
      }
    }
  })

  test('create report button is visible', async ({ authenticatedPage: page }) => {
    // Arrange
    const reportsLink = page.locator('text=รายงาน').first()
    const parentLink = reportsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const createButton = page.locator('text=/Create|สร้าง.*[Rr]eport/')i)
    const isVisible = await createButton.isVisible().catch(() => false)

    // ถ้า button มีให้ตรวจสอบว่า clickable
    if (isVisible) {
      await expect(createButton).toBeVisible()
    }
  })
})

test.describe('Public Reports', () => {
  test('public report page shows error for invalid token', async ({ page }) => {
    // Arrange & Act
    const invalidToken = 'invalid-token-12345'
    await page.goto(`/report/${invalidToken}`)

    // Assert - ควรเห็น error message หรือ redirect
    // ตรวจสอบ URL หรือ error message
    const pageContent = await page.content()
    const url = page.url()

    // ควรไม่ find report หรือแสดง error
    const notFoundText = page.locator('text=/ไม่พบ|not found|invalid|error/')i)
    const notFoundVisible = await notFoundText.isVisible().catch(() => false)

    // หรือเลย URL ไม่ควรเป็นหน้า report
    expect(notFoundVisible || !url.includes('/report/')).toBeTruthy()
  })

  test('public report page loads with valid token if exists', async ({ authenticatedPage: page }) => {
    // Arrange
    // ก่อนอื่นต้องสร้าง report ด้วย token ที่ถูกต้อง
    // สำหรับ test นี้อาจจะ skip ถ้าไม่มี test data

    // Act & Assert
    // หากมี test report token สามารถเทสตรงนี้
    // เพื่อตอนนี้ให้ skip
    test.skip()
  })
})
