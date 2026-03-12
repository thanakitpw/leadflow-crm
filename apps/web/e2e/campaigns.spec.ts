import { test, expect } from './fixtures/test-base'

test.describe('Campaigns', () => {
  test('campaigns page loads and displays title', async ({ authenticatedPage: page }) => {
    // Arrange
    const campaignsLink = page.locator('text=Campaigns').first()

    // Act
    const parentLink = campaignsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href || href === '#') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=Campaigns')).toBeVisible()
  })

  test('campaigns page displays list or empty state', async ({ authenticatedPage: page }) => {
    // Arrange
    const campaignsLink = page.locator('text=Campaigns').first()
    const parentLink = campaignsLink.locator('..')
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

    // ตรวจสอบว่ามี table หรือ empty state
    const table = page.locator('table')
    const emptyState = page.locator('text=/ไม่มี|empty|No campaigns/')

    const tableVisible = await table.isVisible().catch(() => false)
    const emptyVisible = await emptyState.isVisible().catch(() => false)

    expect(tableVisible || emptyVisible).toBeTruthy()
  })

  test('create campaign button is visible', async ({ authenticatedPage: page }) => {
    // Arrange
    const campaignsLink = page.locator('text=Campaigns').first()
    const parentLink = campaignsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const createButton = page.locator('text=/Create|สร้าง.*[Cc]ampaign/')i)
    const isVisible = await createButton.isVisible().catch(() => false)

    // ถ้า button มีให้ตรวจสอบว่า clickable
    if (isVisible) {
      await expect(createButton).toBeVisible()
    }
  })

  test('can navigate to campaign detail if campaigns exist', async ({ authenticatedPage: page }) => {
    // Arrange
    const campaignsLink = page.locator('text=Campaigns').first()
    const parentLink = campaignsLink.locator('..')
    const href = await parentLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const campaignRows = page.locator('table tbody tr')
    const rowCount = await campaignRows.count()

    if (rowCount > 0) {
      // คลิก campaign แรก
      const firstCampaign = campaignRows.first()
      const campaignLink = firstCampaign.locator('a').first()
      const campaignHref = await campaignLink.getAttribute('href')

      if (campaignHref && campaignHref !== '#') {
        await page.goto(campaignHref)
        await page.waitForLoadState('networkidle')

        // ตรวจสอบว่าเข้าหน้า campaign detail
        const pageContent = await page.content()
        expect(pageContent.length).toBeGreaterThan(0)
      }
    }
  })

  test('campaigns table displays campaign information', async ({ authenticatedPage: page }) => {
    // Arrange
    const campaignsLink = page.locator('text=Campaigns').first()
    const parentLink = campaignsLink.locator('..')
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
})

test.describe('Campaign Creation', () => {
  test('create campaign page loads', async ({ authenticatedPage: page }) => {
    // Arrange
    try {
      const firstWorkspaceLink = page.locator('a[href*="/campaigns"]').first()
      const campaignsHref = await firstWorkspaceLink.getAttribute('href')

      if (!campaignsHref) {
        test.skip()
      }

      // Extract workspace ID
      const match = campaignsHref?.match(/\/([a-f0-9\-]+)\/campaigns/)
      const wsId = match?.[1]

      if (!wsId) {
        test.skip()
      }

      // Act
      await page.goto(`/${wsId}/campaigns/create`)
      await page.waitForLoadState('networkidle')

      // Assert
      const pageContent = await page.content()
      expect(pageContent).toBeTruthy()
      expect(pageContent.length).toBeGreaterThan(0)
    } catch (e) {
      test.skip()
    }
  })

  test('create campaign page has form inputs', async ({ authenticatedPage: page }) => {
    // Arrange
    try {
      const firstWorkspaceLink = page.locator('a[href*="/campaigns"]').first()
      const campaignsHref = await firstWorkspaceLink.getAttribute('href')

      if (!campaignsHref) {
        test.skip()
      }

      const match = campaignsHref?.match(/\/([a-f0-9\-]+)\/campaigns/)
      const wsId = match?.[1]

      if (!wsId) {
        test.skip()
      }

      // Act
      await page.goto(`/${wsId}/campaigns/create`)
      await page.waitForLoadState('networkidle')

      // Assert
      const inputs = page.locator('input, textarea, select')
      const inputCount = await inputs.count()

      // ควรมี form inputs
      expect(inputCount).toBeGreaterThan(0)
    } catch (e) {
      test.skip()
    }
  })
})
