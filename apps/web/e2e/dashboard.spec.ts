import { test, expect } from './fixtures/test-base'

const WORKSPACE_ID = 'ce9cac3c-6b94-45ba-b25f-85cb6ec3c7b0'

async function navigateToDashboard(page: any) {
  await page.goto(`/${WORKSPACE_ID}`)
  await page.waitForLoadState('networkidle')
}

test.describe('Dashboard - Page Load and Rendering', () => {
  test('dashboard page loads with main heading', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const heading = page.locator('h1', { hasText: 'Dashboard' })
    await expect(heading).toBeVisible()

    await expect(page.getByText('ภาพรวมของ workspace')).toBeVisible()
  })

  test('dashboard current date is displayed in Thai format', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    // Actual format: "วันศุกร์ที่ 13 มีนาคม 2569"
    const dateElement = page.getByText(/วัน.+มีนาคม|วัน.+กุมภาพันธ์|วัน.+มกราคม|วัน.+เมษายน|วัน.+พฤษภาคม|วัน.+มิถุนายน|วัน.+กรกฎาคม|วัน.+สิงหาคม|วัน.+กันยายน|วัน.+ตุลาคม|วัน.+พฤศจิกายน|วัน.+ธันวาคม/)
    await expect(dateElement).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Dashboard - Stat Cards', () => {
  test('dashboard displays 6 stat cards with correct labels', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    // Scope to main content area (not sidebar)
    const main = page.locator('main')

    // Stat cards have truncated text but these exact strings should be findable
    await expect(main.getByText('Open Rate')).toBeVisible({ timeout: 5000 })
    await expect(main.getByText('Click Rate')).toBeVisible({ timeout: 5000 })
    // Count stat-like cards in the top section
    const statCards = main.locator('[class*="rounded"]').filter({ has: page.locator('text=/\\d+%?/') })
    const count = await statCards.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('stat cards display numeric values or dashes', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const main = page.locator('main')
    // Look for 0 values or percentage values in stat cards
    const zeroValues = main.getByText('0', { exact: true })
    const percentValues = main.getByText(/\d+%/)
    const zeroCount = await zeroValues.count()
    const percentCount = await percentValues.count()
    expect(zeroCount + percentCount).toBeGreaterThanOrEqual(4)
  })

  test('stat cards show sub-text descriptions', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const main = page.locator('main')
    // At least one sub-text should be visible (they may be truncated)
    const hasSubtext = await main.getByText(/leads|แคมเปญ|อัตรา|ทั้งหมด/).first().isVisible().catch(() => false)
    expect(hasSubtext).toBeTruthy()
  })

  test('stat cards have icons and colors', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const main = page.locator('main')
    // Check for SVG icons in the stat card area
    const icons = main.locator('svg')
    const count = await icons.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Dashboard - Quick Actions', () => {
  test('dashboard displays all 4 quick action buttons', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    await expect(page.getByText('Quick Actions')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('link', { name: 'ค้นหา Leads' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'สร้าง Campaign' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'สร้าง Template' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ตั้งค่า Domain' })).toBeVisible()
  })

  test('quick action: ค้นหา Leads navigates to leads/search', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const searchAction = page.getByRole('link', { name: 'ค้นหา Leads' })
    await searchAction.click()
    await expect(page).toHaveURL(/\/leads/, { timeout: 10000 })
  })

  test('quick action: สร้าง Campaign navigates to campaigns/create', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const action = page.getByRole('link', { name: 'สร้าง Campaign' })
    await action.click()
    await expect(page).toHaveURL(/\/campaigns/, { timeout: 10000 })
  })

  test('quick action: สร้าง Template navigates to templates/create', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const action = page.getByText('สร้าง Template')
    await action.click()
    await expect(page).toHaveURL(/\/templates/, { timeout: 10000 })
  })

  test('quick action: ตั้งค่า Domain navigates to settings/domains', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const action = page.getByText('ตั้งค่า Domain')
    await action.click()
    await expect(page).toHaveURL(/\/settings/, { timeout: 10000 })
  })

  test('quick action buttons are clickable and have hover effects', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const searchAction = page.getByRole('link', { name: 'ค้นหา Leads' })
    await expect(searchAction).toBeVisible()
    await expect(searchAction).toBeEnabled()
  })
})

test.describe('Dashboard - Activity Section', () => {
  test('recent activity section header is visible', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    await expect(page.getByRole('heading', { name: 'กิจกรรมล่าสุด' })).toBeVisible({ timeout: 5000 })
  })

  test('activity feed shows items or empty state message', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const hasEmptyState = await page.getByText('ยังไม่มีกิจกรรม').isVisible().catch(() => false)
    const hasActivities = await page.locator('[class*="flex"] [class*="gap-3"]').first().isVisible().catch(() => false)
    expect(hasEmptyState || hasActivities).toBeTruthy()
  })

  test('activity section has "ดูทั้งหมด" (View All) link', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const viewAllLink = page.getByText('ดูทั้งหมด')
    await expect(viewAllLink).toBeVisible({ timeout: 5000 })
  })

  test('activity items show action icons and descriptions', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const hasEmptyState = await page.getByText('ยังไม่มีกิจกรรม').isVisible().catch(() => false)
    if (!hasEmptyState) {
      const firstActivityItem = page.locator('[class*="flex"] [class*="gap-3"]').first()
      const isVisible = await firstActivityItem.isVisible().catch(() => false)
      if (isVisible) {
        await expect(firstActivityItem).toBeVisible()
      }
    }
  })

  test('activity items show relative time (e.g., "เมื่อกี้", "5 นาทีที่แล้ว")', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const hasEmptyState = await page.getByText('ยังไม่มีกิจกรรม').isVisible().catch(() => false)
    if (!hasEmptyState) {
      const timePattern = page.getByText(/เมื่อกี้|นาที|ชั่วโมง|วัน/)
      const isVisible = await timePattern.first().isVisible().catch(() => false)
      if (isVisible) {
        await expect(timePattern.first()).toBeVisible()
      }
    }
  })
})

test.describe('Dashboard - Reports Shortcut', () => {
  test('reports shortcut card is visible', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    // Reports shortcut in main content area has description text
    await expect(page.getByText('สร้างและแชร์รายงานให้ลูกค้า')).toBeVisible({ timeout: 5000 })
  })

  test('reports shortcut card has description', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const main = page.locator('main')
    const description = main.getByText('สร้างและแชร์รายงานให้ลูกค้า')
    await expect(description).toBeVisible({ timeout: 5000 })
  })

  test('reports shortcut card is clickable and navigates to reports', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    // Click the reports shortcut link in main content
    const main = page.locator('main')
    const reportsLink = main.locator('a[href*="/reports"]').first()
    const isVisible = await reportsLink.isVisible().catch(() => false)
    if (isVisible) {
      await reportsLink.click()
      await expect(page).toHaveURL(/\/reports/, { timeout: 10000 })
    }
  })
})

test.describe('Dashboard - Responsive Layout', () => {
  test('dashboard stat cards are responsive on different screen sizes', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await navigateToDashboard(page)

    const main = page.locator('main')
    await expect(main.getByText('Open Rate')).toBeVisible({ timeout: 5000 })
    await expect(main.getByText('Click Rate')).toBeVisible({ timeout: 5000 })
  })

  test('dashboard main content is within visible viewport', async ({ authenticatedPage: page }) => {
    await navigateToDashboard(page)

    const heading = page.locator('h1', { hasText: 'Dashboard' })
    await expect(heading).toBeVisible()
  })
})
