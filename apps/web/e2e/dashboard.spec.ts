import { test, expect } from './fixtures/test-base'

test.describe('Dashboard', () => {
  test('dashboard page loads and displays main heading', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    // ค้นหา workspace link แรก
    const workspaceLink = page.locator('a[href^="/"]').filter({
      hasNot: page.locator('svg:has-text("LeadFlow")')
    }).first()

    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    // ไปที่ workspace dashboard
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('dashboard shows stat cards', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').filter({
      hasNot: page.locator('svg')
    }).first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - ตรวจสอบการมีของ stat cards
    // ควรมีอย่างน้อย: Leads ทั้งหมด, มีอีเมล, Campaigns, เป็นต้น
    const statLabels = [
      'Leads ทั้งหมด',
      'มีอีเมล',
      'Campaigns',
      'อีเมลส่งแล้ว'
    ]

    for (const label of statLabels) {
      const stat = page.locator(`text=${label}`)
      await expect(stat).toBeVisible({ timeout: 5000 })
    }
  })

  test('stat cards display numeric values', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - ตรวจสอบว่า stat cards มีตัวเลข
    const numbers = page.locator('[role="article"] p.text-2xl')
    const count = await numbers.count()

    // ควรมีอย่างน้อยหลายตัวเลข
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('dashboard shows quick action buttons', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - ตรวจสอบ quick action buttons
    const actions = [
      'ค้นหา Leads',
      'สร้าง Campaign',
      'สร้าง Template'
    ]

    for (const action of actions) {
      const link = page.locator(`text=${action}`)
      await expect(link).toBeVisible({ timeout: 5000 })
    }
  })

  test('quick action buttons are clickable', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act - คลิก "ค้นหา Leads" button
    const searchButton = page.locator('text=ค้นหา Leads')
    const link = searchButton.locator('..')

    // Assert
    const href2 = await link.getAttribute('href')
    expect(href2).toMatch(/\/leads\/search/)
  })

  test('recent activity section is visible', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const activitySection = page.locator('text=กิจกรรมล่าสุด')
    await expect(activitySection).toBeVisible({ timeout: 5000 })
  })

  test('activity feed shows view all link', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const viewAllLink = page.locator('text=ดูทั้งหมด')
    await expect(viewAllLink).toBeVisible({ timeout: 5000 })
  })

  test('reports shortcut card is visible', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const reportsCard = page.locator('text=รายงาน')
    await expect(reportsCard).toBeVisible({ timeout: 5000 })
  })

  test('current date is displayed in dashboard header', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href^="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - ตรวจสอบว่ามีวันที่
    // Thai date format จะมี ค.ศ. หรือ วนัที่ดีกรี
    const dateElement = page.locator('text=/วัน|ที่|เดือน|พ\.ศ\.|ค\.ศ\./')
    await expect(dateElement).toBeVisible({ timeout: 5000 })
  })
})
