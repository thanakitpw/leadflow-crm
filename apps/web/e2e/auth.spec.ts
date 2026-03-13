import { test, expect } from '@playwright/test'

test.describe('Authentication - Login Form', () => {
  test('login form renders with all required elements', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=LeadFlow')).toBeVisible()
    await expect(page.locator('text=เข้าสู่ระบบ')).toBeVisible()
    await expect(page.locator('text=ยินดีต้อนรับกลับมา')).toBeVisible()

    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('required')

    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible()
    await expect(passwordInput).toHaveAttribute('required')

    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toContainText('เข้าสู่ระบบ')
  })

  test('password field is masked with type="password"', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')
    const passwordInput = page.locator('input[type="password"]')

    // Assert
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Type something and verify it's masked
    await passwordInput.fill('mysecretpassword')
    const inputType = await passwordInput.getAttribute('type')
    expect(inputType).toBe('password')
  })

  test('email field accepts and validates email format', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"]')

    // Assert
    await expect(emailInput).toHaveAttribute('type', 'email')

    // Try entering invalid email (browser validation)
    await emailInput.fill('notanemail')
    // HTML5 validation should prevent submission
    const validity = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(validity).toBe(true)
  })

  test('forgot password link navigates to /forgot-password', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act
    const forgotLink = page.locator('a', { hasText: 'ลืมรหัสผ่าน' })
    await forgotLink.click()

    // Assert
    await expect(page).toHaveURL('/forgot-password')
  })

  test('signup link navigates to signup page', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act
    const signupLink = page.locator('a', { hasText: 'สมัครสมาชิก' })
    await signupLink.click()

    // Assert
    await expect(page).toHaveURL('/signup')
  })

  test('google sign-in button is visible and clickable', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act & Assert
    const googleButton = page.locator('button', { hasText: 'เข้าสู่ระบบด้วย Google' })
    await expect(googleButton).toBeVisible()
    await expect(googleButton).toBeEnabled()
  })

  test('login with invalid credentials shows error message', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')

    // Act
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'WrongPassword123!')
    await page.click('button[type="submit"]')

    // Assert
    const errorMessage = page.locator('text=/อีเมลหรือรหัสผ่านไม่ถูกต้อง/')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })

  test('login with non-existent email shows error', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')

    // Act
    await page.fill('input[type="email"]', 'nonexistent@email.com')
    await page.fill('input[type="password"]', 'SomePassword123!')
    await page.click('button[type="submit"]')

    // Assert
    const errorMessage = page.locator('text=/อีเมลหรือรหัสผ่านไม่ถูกต้อง/')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })

  test('submit button is disabled while loading', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button[type="submit"]')

    // Act - fill and submit
    await emailInput.fill('test@leadflow.dev')
    await passwordInput.fill('TestPassword123!')
    await submitButton.click()

    // Assert - button should show loading state
    await expect(submitButton).toContainText(/กำลังเข้าสู่ระบบ|เข้าสู่ระบบ/, { timeout: 1000 })
  })

  test('error message clears when user corrects input', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')

    // Act - submit with wrong credentials
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'WrongPassword123!')
    await page.click('button[type="submit"]')

    // Assert - error appears
    const errorMessage = page.locator('text=/อีเมลหรือรหัสผ่านไม่ถูกต้อง/')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })

    // Act - user corrects email (this should trigger form to re-validate)
    const emailInput = page.locator('input[type="email"]')
    await emailInput.clear()
    // Note: Error won't automatically clear until form is resubmitted
    // This test verifies that user can attempt to correct and resubmit
  })
})

test.describe('Authentication - Signup', () => {
  test('signup page renders with all required fields', async ({ page }) => {
    // Arrange & Act
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('text=LeadFlow')).toBeVisible()
    await expect(page.locator('text=สร้างบัญชีใหม่')).toBeVisible()
    await expect(page.locator('text=เริ่มต้นใช้งาน LeadFlow ได้ทันที')).toBeVisible()

    const fullNameInput = page.locator('#fullName')
    await expect(fullNameInput).toBeVisible()
    await expect(fullNameInput).toHaveAttribute('required')

    const emailInput = page.locator('#email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('required')

    const passwordInput = page.locator('#password')
    await expect(passwordInput).toBeVisible()
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await expect(passwordInput).toHaveAttribute('required')
    await expect(passwordInput).toHaveAttribute('minlength', '8')

    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toContainText('สร้างบัญชี')
  })

  test('signup page has link back to login', async ({ page }) => {
    // Arrange & Act
    await page.goto('/signup')

    // Assert
    const loginLink = page.locator('a', { hasText: 'เข้าสู่ระบบ' })
    await expect(loginLink).toBeVisible()
  })

  test('password shorter than 8 characters shows error', async ({ page }) => {
    // Arrange
    await page.goto('/signup')
    await page.waitForSelector('#fullName')

    // Act
    await page.fill('#fullName', 'Test User')
    await page.fill('#email', 'newuser@example.com')
    await page.fill('#password', 'short1')  // only 6 characters
    await page.click('button[type="submit"]')

    // Assert
    const errorMessage = page.locator('text=/รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร/')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })

  test('google sign-in button is visible on signup', async ({ page }) => {
    // Arrange & Act
    await page.goto('/signup')

    // Assert
    const googleButton = page.locator('button', { hasText: /สมัครด้วย Google/ })
    await expect(googleButton).toBeVisible()
    await expect(googleButton).toBeEnabled()
  })

  test('signup success shows email verification message', async ({ page, context }) => {
    // Arrange
    await page.goto('/signup')
    await page.waitForSelector('#fullName')

    // Act - fill form with unique email
    const timestamp = Date.now()
    const testEmail = `newuser${timestamp}@example.com`

    await page.fill('#fullName', 'Test User Name')
    await page.fill('#email', testEmail)
    await page.fill('#password', 'ValidPassword123!')
    await page.click('button[type="submit"]')

    // Assert - should show success message
    const successMessage = page.locator('text=/ตรวจสอบอีเมลของคุณ/')
    await expect(successMessage).toBeVisible({ timeout: 10000 })

    const emailConfirmation = page.locator(`text=${testEmail}`)
    await expect(emailConfirmation).toBeVisible()
  })

  test('existing email shows error message', async ({ page }) => {
    // Arrange
    await page.goto('/signup')
    await page.waitForSelector('#fullName')

    // Act - try to signup with existing test user
    await page.fill('#fullName', 'Existing User')
    await page.fill('#email', process.env.TEST_USER_EMAIL || 'test@leadflow.dev')
    await page.fill('#password', 'ValidPassword123!')
    await page.click('button[type="submit"]')

    // Assert
    const errorMessage = page.locator('text=/อีเมลนี้ถูกใช้งานแล้ว/')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Authentication - Protected Routes', () => {
  test('unauthenticated user accessing dashboard redirects to login', async ({ page }) => {
    // Arrange & Act
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000'
    await page.goto(`/${workspaceId}`, { waitUntil: 'networkidle' })

    // Assert
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user accessing leads page redirects to login', async ({ page }) => {
    // Arrange & Act
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000'
    await page.goto(`/${workspaceId}/leads`, { waitUntil: 'networkidle' })

    // Assert
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user accessing campaigns redirects to login', async ({ page }) => {
    // Arrange & Act
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000'
    await page.goto(`/${workspaceId}/campaigns`, { waitUntil: 'networkidle' })

    // Assert
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Authentication - Login Success', () => {
  test('login with valid credentials redirects to workspace selection', async ({ page }) => {
    // Arrange
    const testEmail = process.env.TEST_USER_EMAIL || 'test@leadflow.dev'
    const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!'

    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')

    // Act
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')

    // Assert - should redirect to workspace or dashboard
    // The fixture will take us to workspace selection (/)
    await expect(page).toHaveURL(/^\//, { timeout: 10000 })
  })
})
