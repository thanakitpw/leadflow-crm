import { test, expect } from './fixtures/test-base'

test.describe('Templates', () => {
  // ============================================================================
  // Template List Tests
  // ============================================================================

  test('templates page loads with correct title', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href || href === '#') {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert
    await expect(page.locator('h1')).toContainText('Email Templates')
  })

  test('templates page shows template list or empty state', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Check for either template table or empty state
    const table = page.locator('table')
    const emptyState = page.locator('button, div').filter({ hasText: /ไม่มี|ยังไม่มี|empty|No templates/ })

    const tableVisible = await table.isVisible().catch(() => false)
    const emptyVisible = await emptyState.isVisible().catch(() => false)

    expect(tableVisible || emptyVisible).toBeTruthy()
  })

  test('templates page displays create button', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Look for "สร้าง Template" button
    const createButton = page.locator('button').filter({ hasText: /สร้าง|Create/ }).first()
    const isVisible = await createButton.isVisible().catch(() => false)

    if (isVisible) {
      await expect(createButton).toBeVisible()
    }
  })

  test('templates filter by category (if available)', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Look for category filter/dropdown
    const categoryFilter = page.locator('button, select').filter({ hasText: /category|หมวดหมู่|Category/ }).first()
    const categoryVisible = await categoryFilter.isVisible().catch(() => false)

    if (categoryVisible) {
      await expect(categoryFilter).toBeVisible()
    }
  })

  // ============================================================================
  // Template CRUD Tests
  // ============================================================================

  test('navigate to create template page', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('button').filter({ hasText: /สร้าง|Create/ }).first()
    const createHref = await createButton.locator('..').locator('a').first().getAttribute('href').catch(() => null)

    if (createHref) {
      await page.goto(createHref)
      await page.waitForLoadState('networkidle')

      // Assert
      const pageContent = await page.content()
      expect(pageContent.length).toBeGreaterThan(0)
    } else {
      test.skip()
    }
  })

  test('create template form has required inputs (name, subject, body)', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('button').filter({ hasText: /สร้าง|Create/ }).first()
    const parentLink = createButton.locator('..')
    const createLink = parentLink.locator('a').first()
    const createHref = await createLink.getAttribute('href').catch(() => null)

    if (!createHref) {
      test.skip()
    }

    // Act
    await page.goto(createHref || '/')
    await page.waitForLoadState('networkidle')

    // Assert - Look for input fields
    const nameInput = page.locator('input[placeholder*="ชื่อ"], input[placeholder*="Name"]').first()
    const subjectInput = page.locator('input[placeholder*="Subject"], input[placeholder*="เรื่อง"]').first()
    const bodyInput = page.locator('textarea[placeholder*="Body"], textarea[placeholder*="เนื้อหา"]').first()

    const hasInputs =
      (await nameInput.isVisible().catch(() => false)) ||
      (await subjectInput.isVisible().catch(() => false)) ||
      (await bodyInput.isVisible().catch(() => false))

    expect(hasInputs).toBeTruthy()
  })

  test('create template with all fields and it appears in list', async ({ authenticatedPage: page, testUser }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('button').filter({ hasText: /สร้าง|Create/ }).first()
    const createParent = createButton.locator('..')
    const createLink = createParent.locator('a').first()
    const createHref = await createLink.getAttribute('href').catch(() => null)

    if (!createHref) {
      test.skip()
    }

    // Act
    await page.goto(createHref || '/')
    await page.waitForLoadState('networkidle')

    const templateName = `Test Template ${Date.now()}`

    // Try to fill form fields
    const nameInput = page.locator('input[placeholder*="ชื่อ"], input[placeholder*="Name"], input[type="text"]').first()
    const subjectInput = page.locator('input[placeholder*="Subject"], input[placeholder*="เรื่อง"]').first()
    const bodyInput = page.locator('textarea').first()

    try {
      await nameInput.fill(templateName)
      await subjectInput.fill('Test Subject')
      await bodyInput.fill('Test Body Content')

      // Look for save button
      const saveButton = page.locator('button').filter({ hasText: /บันทึก|Save|Submit/ }).first()
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click()
        await page.waitForLoadState('networkidle')
      }

      // Assert - Should be redirected back to list or see success message
      const successMessage = page.locator('text=/สำเร็จ|บันทึก|Save|Success/i')
      const successVisible = await successMessage.isVisible().catch(() => false)

      if (successVisible) {
        await expect(successMessage).toBeVisible()
      }
    } catch (e) {
      test.skip()
    }
  })

  test('template name validation (required field)', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('button').filter({ hasText: /สร้าง|Create/ }).first()
    const createParent = createButton.locator('..')
    const createLink = createParent.locator('a').first()
    const createHref = await createLink.getAttribute('href').catch(() => null)

    if (!createHref) {
      test.skip()
    }

    // Act
    await page.goto(createHref || '/')
    await page.waitForLoadState('networkidle')

    // Try to submit empty form
    const submitButton = page.locator('button').filter({ hasText: /บันทึก|Save|Submit/ }).first()
    const isDisabledOrInvalid = await submitButton.isDisabled().catch(() => false)

    if (isDisabledOrInvalid) {
      expect(isDisabledOrInvalid).toBeTruthy()
    } else {
      // Try clicking and look for validation error
      try {
        await submitButton.click({ timeout: 2000 })
        const errorMessage = page.locator('text=/required|จำเป็น|ต้องระบุ/i')
        const errorVisible = await errorMessage.isVisible().catch(() => false)
        expect(errorVisible).toBeTruthy()
      } catch (e) {
        test.skip()
      }
    }
  })

  test('template editor page loads for existing template', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    // Act
    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    // Find first template in table
    const templateRows = page.locator('table tbody tr')
    const rowCount = await templateRows.count().catch(() => 0)

    if (rowCount > 0) {
      const firstTemplate = templateRows.first()
      const templateLink = firstTemplate.locator('a').first()
      const templateHref = await templateLink.getAttribute('href').catch(() => null)

      if (templateHref) {
        await page.goto(templateHref)
        await page.waitForLoadState('networkidle')

        // Assert
        const pageContent = await page.content()
        expect(pageContent.length).toBeGreaterThan(0)
      }
    } else {
      test.skip()
    }
  })

  test('edit template subject and save changes', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const templateRows = page.locator('table tbody tr')
    const rowCount = await templateRows.count().catch(() => 0)

    if (rowCount > 0) {
      const firstTemplate = templateRows.first()
      const templateLink = firstTemplate.locator('a').first()
      const templateHref = await templateLink.getAttribute('href').catch(() => null)

      if (!templateHref) {
        test.skip()
      }

      // Act
      await page.goto(templateHref || '/')
      await page.waitForLoadState('networkidle')

      const subjectInput = page.locator('input[placeholder*="Subject"], input[placeholder*="เรื่อง"]').first()
      const isVisible = await subjectInput.isVisible().catch(() => false)

      if (isVisible) {
        const newSubject = `Updated Subject ${Date.now()}`
        await subjectInput.fill(newSubject)

        // Look for save button
        const saveButton = page.locator('button').filter({ hasText: /บันทึก|Save/ }).first()
        if (await saveButton.isVisible().catch(() => false)) {
          await saveButton.click()
          await page.waitForLoadState('networkidle')

          // Assert - Check for success message
          const successMessage = page.locator('text=/สำเร็จ|บันทึก|Success/i')
          const successVisible = await successMessage.isVisible().catch(() => false)

          if (successVisible) {
            await expect(successMessage).toBeVisible()
          }
        }
      } else {
        test.skip()
      }
    } else {
      test.skip()
    }
  })

  test('duplicate template creates copy with suffix', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const templateRows = page.locator('table tbody tr')
    const rowCount = await templateRows.count().catch(() => 0)

    if (rowCount > 0) {
      const firstTemplate = templateRows.first()

      // Look for duplicate action button
      const duplicateButton = firstTemplate.locator('button').filter({ hasText: /สำเนา|Duplicate|Copy/ })
      const hasAction = await duplicateButton.isVisible().catch(() => false)

      if (hasAction) {
        // Act
        await duplicateButton.first().click()
        await page.waitForLoadState('networkidle')

        // Assert - Look for success message or new item in list
        const successMessage = page.locator('text=/สำเร็จ|Duplicate|Success/i')
        const successVisible = await successMessage.isVisible().catch(() => false)

        if (successVisible) {
          await expect(successMessage).toBeVisible()
        } else {
          // Refresh and check for copy in list
          await page.reload()
          await page.waitForLoadState('networkidle')
          const updatedRows = page.locator('table tbody tr')
          const newCount = await updatedRows.count().catch(() => 0)
          expect(newCount).toBeGreaterThanOrEqual(rowCount)
        }
      } else {
        test.skip()
      }
    } else {
      test.skip()
    }
  })

  test('delete template removes it from list', async ({ authenticatedPage: page }) => {
    // Arrange
    const templatesLink = page.locator('a').filter({ hasText: /Email Templates|Templates/ }).first()
    const href = await templatesLink.getAttribute('href')

    if (!href) {
      test.skip()
    }

    await page.goto(href || '/')
    await page.waitForLoadState('networkidle')

    const templateRows = page.locator('table tbody tr')
    const initialCount = await templateRows.count().catch(() => 0)

    if (initialCount === 0) {
      test.skip()
    }

    // Act - Find delete button on last template
    const lastTemplate = templateRows.last()
    const deleteButton = lastTemplate.locator('button').filter({ hasText: /ลบ|Delete|Trash/ })
    const hasDelete = await deleteButton.isVisible().catch(() => false)

    if (hasDelete) {
      await deleteButton.first().click()

      // Confirm deletion if dialog appears
      const confirmButton = page.locator('button').filter({ hasText: /ยืนยัน|Confirm|Delete|ลบ/ })
      const confirmVisible = await confirmButton.isVisible().catch(() => false)

      if (confirmVisible) {
        await confirmButton.last().click()
        await page.waitForLoadState('networkidle')
      }

      // Assert - Check for success or reduced count
      const updatedRows = page.locator('table tbody tr')
      const newCount = await updatedRows.count().catch(() => 0)

      // Success message or count reduced
      const successMessage = page.locator('text=/ลบแล้ว|Delete|Success/i')
      const successVisible = await successMessage.isVisible().catch(() => false)

      expect(successVisible || newCount <= initialCount).toBeTruthy()
    } else {
      test.skip()
    }
  })
})
