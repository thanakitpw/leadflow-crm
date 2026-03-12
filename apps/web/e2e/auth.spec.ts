import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page renders with form elements', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=LeadFlow')).toBeVisible()
    await expect(page.locator('text=เข้าสู่ระบบ')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows error message for invalid credentials', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')

    // Act - ป้อนข้อมูลผิด
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpassword123')
    await page.click('button[type="submit"]')

    // Assert - ต้องเห็นข้อความ error
    await expect(
      page.locator('text=/อีเมลหรือรหัสผ่านไม่ถูกต้อง/')
    ).toBeVisible({ timeout: 5000 })
  })

  test('email field accepts valid email format', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"]')

    // Assert
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('required')
  })

  test('password field is masked', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')
    const passwordInput = page.locator('input[type="password"]')

    // Assert
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await expect(passwordInput).toHaveAttribute('required')
  })

  test('forgot password link is present and clickable', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act & Assert
    const forgotLink = page.locator('a:has-text("ลืมรหัสผ่าน")')
    await expect(forgotLink).toBeVisible()
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password')
  })

  test('signup link navigates to signup page', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act
    await page.click('a:has-text("สมัครสมาชิก")')

    // Assert
    await expect(page).toHaveURL('/signup')
  })

  test('redirects unauthenticated user to login when accessing protected route', async ({ page }) => {
    // Arrange & Act
    // พยายามเข้าหน้า dashboard โดยไม่ login
    const workspaceId = 'test-workspace-id'
    await page.goto(`/${workspaceId}`)

    // Assert - ต้องเด้งไป login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('google sign-in button is visible', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')

    // Assert
    const googleButton = page.locator('button:has-text("เข้าสู่ระบบด้วย Google")')
    await expect(googleButton).toBeVisible()
  })

  test('email/password required for login form submission', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    const submitButton = page.locator('button[type="submit"]')

    // Act & Assert - ปุ่มควรมี disabled state
    // (depends on implementation - อาจจะเป็น HTML validation)
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toHaveAttribute('required')

    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toHaveAttribute('required')
  })
})

test.describe('Workspace Selection', () => {
  test('displays workspace selection page after login', async ({ page, context }) => {
    // Arrange - login ก่อน
    const testEmail = process.env.TEST_USER_EMAIL || 'test@leadflow.dev'
    const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!'

    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')

    // Act & Assert
    // ควรเห็น workspace selection หรือ workspace name ในหน้า
    await page.waitForURL(/\/(dashboard|$|[a-f0-9\-]{36})/, { timeout: 10000 })
    const heading = page.locator('text=LeadFlow')
    await expect(heading).toBeVisible()
  })
})
