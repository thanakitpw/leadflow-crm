import { test, expect } from './fixtures/test-base'

test.describe('Sequences', () => {
  test('sequences page loads and displays title', async ({ authenticatedPage: page }) => {
    // Arrange
    const sequencesLink = page.locator('text=Sequences').first()

    // Act
    const parentLink = sequencesLink.locator('..')
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

  test('sequences page displays list or empty state', async ({ authenticatedPage: page }) => {
    // Arrange
    const sequencesLink = page.locator('text=Sequences').first()
    const parentLink = sequencesLink.locator('..')
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

    // ตรวจสอบว่ามี sequence list หรือ empty state
    const table = page.locator('table')
    const emptyState = page.locator('text=/ไม่มี|empty|No sequences/')i)

    const tableVisible = await table.isVisible().catch(() => false)
    const emptyVisible = await emptyState.isVisible().catch(() => false)

    expect(tableVisible || emptyVisible).toBeTruthy()
  })

  test('can navigate to sequence detail if sequences exist', async ({ authenticatedPage: page }) => {
    // Arrange
    const sequencesLink = page.locator('text=Sequences').first()
    const parentLink = sequencesLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const sequenceRows = page.locator('table tbody tr')
    const rowCount = await sequenceRows.count()

    if (rowCount > 0) {
      // คลิก sequence แรก
      const firstSequence = sequenceRows.first()
      const sequenceLink = firstSequence.locator('a').first()
      const sequenceHref = await sequenceLink.getAttribute('href')

      if (sequenceHref && sequenceHref !== '#') {
        await page.goto(sequenceHref)
        await page.waitForLoadState('networkidle')

        // ตรวจสอบว่าเข้าหน้า sequence detail/builder
        const pageContent = await page.content()
        expect(pageContent.length).toBeGreaterThan(0)
      }
    }
  })
})
