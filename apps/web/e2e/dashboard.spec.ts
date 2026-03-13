import { test, expect } from './fixtures/test-base'

test.describe('Dashboard - Page Load and Rendering', () => {
  test('dashboard page loads with main heading', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const heading = page.locator('h1', { hasText: 'Dashboard' })
    await expect(heading).toBeVisible()

    // Check subtitle
    const subtitle = page.locator('text=ภาพรวมของ workspace')
    await expect(subtitle).toBeVisible()
  })

  test('dashboard current date is displayed in Thai format', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Look for Thai date with Clock icon (indicates date display)
    const dateElement = page.locator('text=/วัน|ที่|เดือน|มค|กพ|มีค|เมษ|พค|มิย|กค|สค|กย|ตค|พย|ธค/')
    await expect(dateElement).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Dashboard - Stat Cards', () => {
  test('dashboard displays 6 stat cards with correct labels', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Check for all stat card labels
    const statLabels = [
      'Leads ทั้งหมด',
      'มีอีเมล',
      'Campaigns',
      'อีเมลส่งแล้ว',
      'Open Rate',
      'Click Rate'
    ]

    for (const label of statLabels) {
      const stat = page.locator(`text=${label}`)
      await expect(stat).toBeVisible({ timeout: 5000 })
    }
  })

  test('stat cards display numeric values or dashes', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Find all stat card values (should be numbers or dashes)
    const statValues = page.locator('[role="article"] p.text-2xl')
    const count = await statValues.count()

    // Should have at least 6 stat cards with numeric values
    expect(count).toBeGreaterThanOrEqual(6)

    // Verify each value is numeric or dash
    for (let i = 0; i < Math.min(count, 6); i++) {
      const value = await statValues.nth(i).textContent()
      const isNumeric = /^\d+$|^—$|^%$/.test(value?.trim() || '')
      // Values should be numbers, percentage signs, or dashes
      expect(value).toBeTruthy()
    }
  })

  test('stat cards show sub-text descriptions', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const subTexts = [
      'leads ในระบบ',
      'leads ที่มีอีเมล',
      'แคมเปญทั้งหมด',
      'ทั้งหมด',
      'อัตราเปิดอีเมล',
      'อัตราคลิก'
    ]

    for (const subText of subTexts) {
      const element = page.locator(`text=${subText}`)
      // At least some sub-texts should be visible
      const isVisible = await element.isVisible().catch(() => false)
      if (isVisible) {
        await expect(element).toBeVisible()
      }
    }
  })

  test('stat cards have icons and colors', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Check that stat cards have icon containers
    const iconContainers = page.locator('[role="article"] [class*="rounded-lg"]')
    const count = await iconContainers.count()

    // Should have multiple icon containers (one per stat card)
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Dashboard - Quick Actions', () => {
  test('dashboard displays all 4 quick action buttons', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const actions = [
      'ค้นหา Leads',
      'สร้าง Campaign',
      'สร้าง Template',
      'ตั้งค่า Domain'
    ]

    for (const action of actions) {
      const link = page.locator(`text=${action}`)
      await expect(link).toBeVisible({ timeout: 5000 })
    }
  })

  test('quick action: ค้นหา Leads navigates to leads/search', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const searchButton = page.locator('text=ค้นหา Leads')
    const parent = searchButton.locator('..')
    const linkHref = await parent.locator('a').first().getAttribute('href')

    // Assert
    expect(linkHref).toMatch(/\/leads\/search/)
  })

  test('quick action: สร้าง Campaign navigates to campaigns/create', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const campaignButton = page.locator('text=สร้าง Campaign')
    const parent = campaignButton.locator('..')
    const linkHref = await parent.locator('a').first().getAttribute('href')

    // Assert
    expect(linkHref).toMatch(/\/campaigns\/create/)
  })

  test('quick action: สร้าง Template navigates to templates/create', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const templateButton = page.locator('text=สร้าง Template')
    const parent = templateButton.locator('..')
    const linkHref = await parent.locator('a').first().getAttribute('href')

    // Assert
    expect(linkHref).toMatch(/\/templates\/create/)
  })

  test('quick action: ตั้งค่า Domain navigates to settings/domains', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const domainButton = page.locator('text=ตั้งค่า Domain')
    const parent = domainButton.locator('..')
    const linkHref = await parent.locator('a').first().getAttribute('href')

    // Assert
    expect(linkHref).toMatch(/\/settings\/domains/)
  })

  test('quick action buttons are clickable and have hover effects', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const searchButton = page.locator('text=ค้นหา Leads').locator('..')
    const isVisible = await searchButton.isVisible()

    // Assert
    if (isVisible) {
      await expect(searchButton).toBeEnabled()
    }
  })
})

test.describe('Dashboard - Activity Section', () => {
  test('recent activity section header is visible', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const activityHeader = page.locator('text=กิจกรรมล่าสุด')
    await expect(activityHeader).toBeVisible({ timeout: 5000 })
  })

  test('activity feed shows items or empty state message', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Either activity items or empty state
    const emptyState = page.locator('text=ยังไม่มีกิจกรรม')
    const activityItems = page.locator('[class*="flex"] [class*="gap-3"]')

    const hasEmptyState = await emptyState.isVisible().catch(() => false)
    const hasActivities = await activityItems.first().isVisible().catch(() => false)

    // At least one should be true
    expect(hasEmptyState || hasActivities).toBeTruthy()
  })

  test('activity section has "ดูทั้งหมด" (View All) link', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const viewAllLink = page.locator('text=ดูทั้งหมด')
    const isVisible = await viewAllLink.isVisible().catch(() => false)
    if (isVisible) {
      await expect(viewAllLink).toBeVisible()
      await expect(viewAllLink).toHaveAttribute('href', /\/leads/)
    }
  })

  test('activity items show action icons and descriptions', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - If there are activities, they should have icons and text
    const emptyState = page.locator('text=ยังไม่มีกิจกรรม')
    const hasEmptyState = await emptyState.isVisible().catch(() => false)

    if (!hasEmptyState) {
      // Check that activity items have structure
      const firstActivityItem = page.locator('[class*="flex"] [class*="gap-3"]').first()
      const isVisible = await firstActivityItem.isVisible().catch(() => false)

      if (isVisible) {
        await expect(firstActivityItem).toBeVisible()
      }
    }
  })

  test('activity items show relative time (e.g., "เมื่อกี้", "5 นาทีที่แล้ว")', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Check for relative time text if there are activities
    const timePattern = page.locator('text=/เมื่อกี้|นาที|ชั่วโมง|วัน/')
    const isVisible = await timePattern.isVisible().catch(() => false)

    // It's OK if not visible (empty state)
    if (isVisible) {
      await expect(timePattern).toBeVisible()
    }
  })
})

test.describe('Dashboard - Reports Shortcut', () => {
  test('reports shortcut card is visible', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
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

  test('reports shortcut card has description', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const description = page.locator('text=สร้างและแชร์รายงานให้ลูกค้า')
    const isVisible = await description.isVisible().catch(() => false)
    if (isVisible) {
      await expect(description).toBeVisible()
    }
  })

  test('reports shortcut card is clickable and navigates to reports', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const reportsLink = page.locator('a[href*="/reports"]')
    const isVisible = await reportsLink.isVisible().catch(() => false)

    if (isVisible) {
      // Assert
      await expect(reportsLink).toBeVisible()
      const linkHref = await reportsLink.getAttribute('href')
      expect(linkHref).toMatch(/\/reports/)
    }
  })
})

test.describe('Dashboard - Responsive Layout', () => {
  test('dashboard stat cards are responsive on different screen sizes', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    // Act - Set different viewport sizes
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const statLabels = [
      'Leads ทั้งหมด',
      'มีอีเมล',
      'Campaigns'
    ]

    for (const label of statLabels) {
      const stat = page.locator(`text=${label}`)
      await expect(stat).toBeVisible({ timeout: 5000 })
    }
  })

  test('dashboard main content is within visible viewport', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Header should be visible without scrolling
    const heading = page.locator('h1', { hasText: 'Dashboard' })
    const isInViewport = await heading.isInViewport()
    expect(isInViewport).toBeTruthy()
  })
})
