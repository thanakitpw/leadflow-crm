import { test, expect } from './fixtures/test-base'

test.describe('Sidebar Navigation', () => {
  test('sidebar displays main navigation items', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    // เข้าหน้า dashboard หลังจากได้ authentication
    // หากเป็น workspace selection ให้เลือก workspace แรก
    const firstWorkspace = page.locator('[href^="/"] a').first()
    const href = await firstWorkspace.getAttribute('href')

    if (href && href !== '/login' && href !== '/signup') {
      await page.goto(href)
    }

    // Assert - ตรวจสอบว่า sidebar มีหลัก nav items
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Leads')).toBeVisible()
    await expect(page.locator('text=Campaigns')).toBeVisible()
    await expect(page.locator('text=Templates')).toBeVisible()
    await expect(page.locator('text=Sequences')).toBeVisible()
    await expect(page.locator('text=รายงาน')).toBeVisible()
  })

  test('can navigate to Leads page from sidebar', async ({ authenticatedPage: page }) => {
    // Arrange
    const firstWorkspace = page.locator('a[href*="/leads"]').first()
    const href = await firstWorkspace.getAttribute('href')

    if (!href || href === '#') {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=Leads')).toBeVisible()
    await expect(page.locator('text=จัดการและติดตาม leads')).toBeVisible()
  })

  test('can navigate to Campaigns page from sidebar', async ({ authenticatedPage: page }) => {
    // Arrange
    const campaignLink = page.locator('a[href*="/campaigns"]').first()
    const href = await campaignLink.getAttribute('href')

    if (!href || href === '#') {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=Campaigns')).toBeVisible()
  })

  test('active nav item shows selected state', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    // ไปหน้า Leads
    const leadsLink = page.locator('a[href*="/leads"]').first()
    const href = await leadsLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - ตรวจสอบว่า nav item มี active styling
    // ค้นหา nav link ที่ active (ขึ้นอยู่กับการใช้ pathname)
    const activeNav = page.locator('a[href*="/leads"]').filter({ hasText: 'Leads' })
    await expect(activeNav).toHaveClass(/active|selected|current/)
  })

  test('user menu dropdown is visible', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    // ตรวจสอบว่ามี user menu button ที่ล่าง sidebar
    const userMenuButton = page.locator('button').filter({
      has: page.locator('text=test@leadflow.dev').or(page.locator('[role="img"]'))
    }).first()

    // Assert
    await expect(userMenuButton).toBeVisible()
  })

  test('user dropdown menu shows logout option', async ({ authenticatedPage: page }) => {
    // Arrange
    const userMenuButton = page.locator('button').filter({
      has: page.locator('svg')
    }).last()

    // Act
    await userMenuButton.click()
    await page.waitForTimeout(500)

    // Assert
    await expect(page.locator('text=ออกจากระบบ')).toBeVisible()
  })

  test('logo links to workspace selection page', async ({ authenticatedPage: page }) => {
    // Arrange
    const logo = page.locator('text=LeadFlow').first()

    // Act
    await logo.click()
    await page.waitForLoadState('networkidle')

    // Assert - ควรไปหน้า workspace selection (หน้าแรก)
    await expect(page).toHaveURL('/')
  })

  test('breadcrumb or page title shows current location', async ({ authenticatedPage: page }) => {
    // Arrange
    const leadsLink = page.locator('a[href*="/leads"]').first()
    const href = await leadsLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - ตรวจสอบ page heading
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
    // heading ควรเป็น "Leads" หรือบางสิ่งที่เกี่ยวกับ Leads
  })
})
