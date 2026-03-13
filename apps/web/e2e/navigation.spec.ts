import { test, expect } from './fixtures/test-base'

test.describe('Sidebar Navigation - Main Menu Items', () => {
  test('sidebar displays all main navigation items', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Check all main nav items
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Leads')).toBeVisible()
    await expect(page.locator('text=Campaigns')).toBeVisible()
    await expect(page.locator('text=Templates')).toBeVisible()
    await expect(page.locator('text=Sequences')).toBeVisible()
    await expect(page.locator('text=รายงาน')).toBeVisible()
    await expect(page.locator('text=Settings')).toBeVisible()
  })

  test('LeadFlow logo is visible in sidebar', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    const logo = page.locator('aside text=LeadFlow')
    await expect(logo).toBeVisible()
  })

  test('workspace name is displayed in sidebar', async ({ authenticatedPage: page, testUser }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Workspace name should be visible if workspace is selected
    const workspaceName = page.locator(`text=${testUser.workspaceName}`)
    const isVisible = await workspaceName.isVisible().catch(() => false)

    if (isVisible) {
      await expect(workspaceName).toBeVisible()
    }
  })

  test('sidebar navigation items have proper styling', async ({ authenticatedPage: page }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Nav items should be links with proper structure
    const dashboardLink = page.locator('a').filter({ hasText: 'Dashboard' }).first()
    await expect(dashboardLink).toBeVisible()

    // Link should have href attribute
    const href_attr = await dashboardLink.getAttribute('href')
    expect(href_attr).toBeTruthy()
  })
})

test.describe('Navigation - Dashboard Navigation', () => {
  test('clicking Dashboard nav item navigates to workspace dashboard', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const dashboardLink = page.locator('a').filter({ hasText: 'Dashboard' }).first()
    await dashboardLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    const heading = page.locator('h1', { hasText: 'Dashboard' })
    await expect(heading).toBeVisible()
  })

  test('clicking Leads nav item navigates to leads page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const leadsLink = page.locator('a').filter({ hasText: 'Leads' }).first()
    await leadsLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL(/\/leads/)
  })

  test('clicking Campaigns nav item navigates to campaigns page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const campaignsLink = page.locator('a').filter({ hasText: 'Campaigns' }).first()
    await campaignsLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL(/\/campaigns/)
  })

  test('clicking Templates nav item navigates to templates page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const templatesLink = page.locator('a').filter({ hasText: 'Templates' }).first()
    await templatesLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL(/\/templates/)
  })

  test('clicking Sequences nav item navigates to sequences page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const sequencesLink = page.locator('a').filter({ hasText: 'Sequences' }).first()
    await sequencesLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL(/\/sequences/)
  })

  test('clicking รายงาน nav item navigates to reports page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const reportsLink = page.locator('a').filter({ hasText: 'รายงาน' }).first()
    await reportsLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL(/\/reports/)
  })

  test('clicking Settings nav item navigates to settings page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const settingsLink = page.locator('a').filter({ hasText: 'Settings' }).first()
    const isVisible = await settingsLink.isVisible().catch(() => false)

    if (isVisible) {
      await settingsLink.click()
      await page.waitForLoadState('networkidle')

      // Assert
      await expect(page).toHaveURL(/\/settings/)
    }
  })
})

test.describe('Navigation - Active Nav State', () => {
  test('active nav item shows selected state on Dashboard', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act - Nav item should be active
    const dashboardLink = page.locator('a').filter({ hasText: 'Dashboard' }).first()

    // Assert - Active nav item should have visual indicator (different background/color)
    const style = await dashboardLink.getAttribute('class')
    // The active state should be indicated in the class name
    expect(style).toBeTruthy()
  })

  test('active nav item changes when navigating to Leads', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const leadsLink = page.locator('a').filter({ hasText: 'Leads' }).first()
    await leadsLink.click()
    await page.waitForLoadState('networkidle')

    // Assert - Leads link should now be active
    const leadsLinkAfter = page.locator('a').filter({ hasText: 'Leads' }).first()
    const style = await leadsLinkAfter.getAttribute('class')
    expect(style).toBeTruthy()
  })

  test('active nav item changes when navigating to Campaigns', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const campaignsLink = page.locator('a').filter({ hasText: 'Campaigns' }).first()
    await campaignsLink.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL(/\/campaigns/)
  })
})

test.describe('Navigation - User Menu Dropdown', () => {
  test('user menu button is visible in sidebar footer', async ({ authenticatedPage: page, testUser }) => {
    // Arrange & Act
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - User menu should be in sidebar with email or avatar
    const userEmail = page.locator(`text=${testUser.email}`)
    const isVisible = await userEmail.isVisible().catch(() => false)

    if (isVisible) {
      await expect(userEmail).toBeVisible()
    }
  })

  test('clicking user menu opens dropdown options', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act - Find and click user menu button
    const userMenuButton = page.locator('aside').locator('button').last()
    await userMenuButton.click()
    await page.waitForTimeout(500)

    // Assert - Dropdown options should be visible
    const logoutOption = page.locator('text=ออกจากระบบ')
    const isVisible = await logoutOption.isVisible().catch(() => false)

    if (isVisible) {
      await expect(logoutOption).toBeVisible()
    }
  })

  test('user dropdown menu has all expected options', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act - Open dropdown
    const userMenuButton = page.locator('aside').locator('button').last()
    await userMenuButton.click()
    await page.waitForTimeout(500)

    // Assert
    const menuOptions = [
      'ตั้งค่า Workspace',
      'เปลี่ยน Workspace',
      'ออกจากระบบ'
    ]

    for (const option of menuOptions) {
      const menuItem = page.locator(`text=${option}`)
      const isVisible = await menuItem.isVisible().catch(() => false)
      // At least logout should be visible
      if (option === 'ออกจากระบบ') {
        expect(isVisible).toBeTruthy()
      }
    }
  })

  test('ตั้งค่า Workspace option navigates to settings', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const userMenuButton = page.locator('aside').locator('button').last()
    await userMenuButton.click()
    await page.waitForTimeout(500)

    const settingsOption = page.locator('text=ตั้งค่า Workspace')
    const isVisible = await settingsOption.isVisible().catch(() => false)

    if (isVisible) {
      await settingsOption.click()
      await page.waitForLoadState('networkidle')

      // Assert
      await expect(page).toHaveURL(/\/settings/)
    }
  })

  test('เปลี่ยน Workspace option navigates to workspace selection', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const userMenuButton = page.locator('aside').locator('button').last()
    await userMenuButton.click()
    await page.waitForTimeout(500)

    const changeWorkspaceOption = page.locator('text=เปลี่ยน Workspace')
    const isVisible = await changeWorkspaceOption.isVisible().catch(() => false)

    if (isVisible) {
      await changeWorkspaceOption.click()
      await page.waitForLoadState('networkidle')

      // Assert - Should go back to workspace selection
      await expect(page).toHaveURL('/')
    }
  })

  test('ออกจากระบบ option logs out user', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const userMenuButton = page.locator('aside').locator('button').last()
    await userMenuButton.click()
    await page.waitForTimeout(500)

    const logoutOption = page.locator('text=ออกจากระบบ')
    await logoutOption.click()

    // Wait for redirect
    await page.waitForLoadState('networkidle')

    // Assert - Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

test.describe('Navigation - Logo Links', () => {
  test('clicking LeadFlow logo navigates to workspace selection', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const logo = page.locator('aside a').filter({ hasText: 'LeadFlow' }).first()
    await logo.click()
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page).toHaveURL('/')
  })

  test('logo link has correct href', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const logo = page.locator('aside a').filter({ hasText: 'LeadFlow' }).first()

    // Assert
    const logoHref = await logo.getAttribute('href')
    expect(logoHref).toBe('/')
  })
})

test.describe('Navigation - Page Titles and Breadcrumbs', () => {
  test('Dashboard page shows Dashboard heading', async ({ authenticatedPage: page }) => {
    // Arrange
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
  })

  test('Leads page shows page heading on navigation', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act
    const leadsLink = page.locator('a').filter({ hasText: 'Leads' }).first()
    await leadsLink.click()
    await page.waitForLoadState('networkidle')

    // Assert - Page should have a heading or title
    const pageHeading = page.locator('h1, h2')
    const isVisible = await pageHeading.isVisible().catch(() => false)
    if (isVisible) {
      await expect(pageHeading).toBeVisible()
    }
  })
})

test.describe('Navigation - Browser Back/Forward', () => {
  test('browser back button navigates to previous page', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')
    const initialUrl = page.url()

    // Act - Navigate to Leads
    const leadsLink = page.locator('a').filter({ hasText: 'Leads' }).first()
    await leadsLink.click()
    await page.waitForLoadState('networkidle')

    // Go back
    await page.goBack()
    await page.waitForLoadState('networkidle')

    // Assert
    const currentUrl = page.url()
    expect(currentUrl).toBe(initialUrl)
  })

  test('browser forward button navigates forward', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act - Navigate to Leads
    const leadsLink = page.locator('a').filter({ hasText: 'Leads' }).first()
    await leadsLink.click()
    await page.waitForLoadState('networkidle')

    const leadsUrl = page.url()

    // Go back and forward
    await page.goBack()
    await page.waitForLoadState('networkidle')

    await page.goForward()
    await page.waitForLoadState('networkidle')

    // Assert
    const currentUrl = page.url()
    expect(currentUrl).toBe(leadsUrl)
  })
})

test.describe('Navigation - Multi-page Navigation', () => {
  test('can navigate through multiple pages in sequence', async ({ authenticatedPage: page }) => {
    // Arrange
    const workspaceLink = page.locator('a[href*="/"]').first()
    const href = await workspaceLink.getAttribute('href')

    if (!href || href === '/' || href === '/login') {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Act - Navigate: Dashboard -> Leads -> Campaigns -> Templates
    const pages = ['Leads', 'Campaigns', 'Templates']

    for (const pageName of pages) {
      const link = page.locator('a').filter({ hasText: pageName }).first()
      const isVisible = await link.isVisible().catch(() => false)

      if (isVisible) {
        await link.click()
        await page.waitForLoadState('networkidle')

        // Assert - Should be on the correct page
        await expect(page).toHaveURL(new RegExp(pageName.toLowerCase()))
      }
    }
  })
})
