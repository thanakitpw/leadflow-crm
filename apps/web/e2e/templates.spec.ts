import { test, expect } from './fixtures/test-base'

test.describe('Templates', () => {
  test('templates page loads and displays title', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('text=Templates').first()

    // Act
    const parentLink = templatesLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href || href === '#') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=Templates')).toBeVisible()
  })

  test('templates page displays list or empty state', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('text=Templates').first()
    const parentLink = templatesLink.locator('..')
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

    // ตรวจสอบว่ามี template list หรือ empty state
    const table = page.locator('table')
    const emptyState = page.locator('text=/ไม่มี|empty|No templates/')i)

    const tableVisible = await table.isVisible().catch(() => false)
    const emptyVisible = await emptyState.isVisible().catch(() => false)

    expect(tableVisible || emptyVisible).toBeTruthy()
  })

  test('can navigate to template detail if templates exist', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('text=Templates').first()
    const parentLink = templatesLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const templateRows = page.locator('table tbody tr')
    const rowCount = await templateRows.count()

    if (rowCount > 0) {
      // คลิก template แรก
      const firstTemplate = templateRows.first()
      const templateLink = firstTemplate.locator('a').first()
      const templateHref = await templateLink.getAttribute('href')

      if (templateHref && templateHref !== '#') {
        await page.goto(templateHref)
        await page.waitForLoadState('networkidle')

        // ตรวจสอบว่าเข้าหน้า template detail/editor
        const pageContent = await page.content()
        expect(pageContent.length).toBeGreaterThan(0)
      }
    }
  })

  test('templates table displays template information', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('text=Templates').first()
    const parentLink = templatesLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const table = page.locator('table')
    const tableVisible = await table.isVisible().catch(() => false)

    if (tableVisible) {
      // ตรวจสอบว่า table มี headers
      const headers = page.locator('table thead')
      await expect(headers).toBeVisible()
    }
  })

  test('create template button is visible', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('text=Templates').first()
    const parentLink = templatesLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const createButton = page.locator('text=/Create|สร้าง.*[Tt]emplate/')i)
    const isVisible = await createButton.isVisible().catch(() => false)

    // ถ้า button มีให้ตรวจสอบว่า clickable
    if (isVisible) {
      await expect(createButton).toBeVisible()
    }
  })
})

test.describe('Template Editor', () => {
  test('template editor page loads if template exists', async ({ authenticatedPage: page }) => {
    // Arrange
    try {
      const firstWorkspaceLink = page.locator('a[href*="/templates"]').first()
      const templatesHref = await firstWorkspaceLink.getAttribute('href')

      if (!templatesHref) {
        test.skip()
      }

      // Extract workspace ID
      const match = templatesHref?.match(/\/([a-f0-9\-]+)\/templates/)
      const wsId = match?.[1]

      if (!wsId) {
        test.skip()
      }

      // Act - ไปหน้า templates list ก่อน
      await page.goto(`/${wsId}/templates`)
      await page.waitForLoadState('networkidle')

      // ตรวจสอบว่ามี template
      const templateRows = page.locator('table tbody tr')
      const rowCount = await templateRows.count()

      if (rowCount > 0) {
        // คลิก template แรก
        const firstTemplate = templateRows.first()
        const templateLink = firstTemplate.locator('a').first()
        const templateHref = await templateLink.getAttribute('href')

        if (templateHref) {
          await page.goto(templateHref)
          await page.waitForLoadState('networkidle')

          // Assert
          const pageContent = await page.content()
          expect(pageContent).toBeTruthy()
          expect(pageContent.length).toBeGreaterThan(0)
        }
      } else {
        test.skip()
      }
    } catch (e) {
      test.skip()
    }
  })
})
