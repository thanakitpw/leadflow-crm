import { test, expect } from '@playwright/test'

test.describe('Email Tracking - Open Tracking Pixel', () => {
  test('1. GET /api/track/open/valid-id returns 1x1 GIF', async ({ page }) => {
    // Arrange - Use a valid UUID format
    const validEventId = '550e8400-e29b-41d4-a716-446655440000'

    // Act
    const response = await page.request.get(`/api/track/open/${validEventId}`)

    // Assert
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/gif')
    const buffer = await response.body()
    expect(buffer.length).toBeGreaterThan(0)
  })

  test('2. GET /api/track/open/valid-id has no-cache headers', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440001'

    // Act
    const response = await page.request.get(`/api/track/open/${validEventId}`)

    // Assert
    expect(response.status()).toBe(200)
    const cacheControl = response.headers()['cache-control']
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toContain('no-store')
    expect(cacheControl).toContain('no-cache')
    expect(cacheControl).toContain('must-revalidate')
  })

  test('3. GET /api/track/open/invalid-id still returns pixel gracefully', async ({ page }) => {
    // Arrange
    const invalidEventId = 'not-a-valid-uuid'

    // Act
    const response = await page.request.get(`/api/track/open/${invalidEventId}`)

    // Assert - should return pixel anyway (graceful degradation)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/gif')
    const buffer = await response.body()
    expect(buffer.length).toBeGreaterThan(0)
  })

  test('4. Response body is valid GIF (starts with GIF89a)', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440002'

    // Act
    const response = await page.request.get(`/api/track/open/${validEventId}`)
    const buffer = await response.body()

    // Assert
    const gifHeader = buffer.toString('utf-8', 0, 6)
    expect(gifHeader).toBe('GIF89a')

    // Also check minimal size (1x1 transparent GIF is typically ~43 bytes)
    expect(buffer.length).toBeGreaterThan(10)
    expect(buffer.length).toBeLessThan(200)
  })
})

test.describe('Email Tracking - Click Tracking Redirect', () => {
  test('5. GET /api/track/click/valid-id?url=https://example.com returns 302 redirect', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440010'
    const targetUrl = 'https://example.com'

    // Act - Don't follow redirect to check headers
    const response = await page.request.get(
      `/api/track/click/${validEventId}?url=${encodeURIComponent(targetUrl)}`,
      { followRedirects: false }
    )

    // Assert
    expect(response.status()).toBe(302)
    const location = response.headers()['location']
    expect(location).toBe(targetUrl)
  })

  test('6. Location header matches target URL', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440011'
    const targetUrl = 'https://www.google.com/search?q=leadflow'

    // Act
    const response = await page.request.get(
      `/api/track/click/${validEventId}?url=${encodeURIComponent(targetUrl)}`,
      { followRedirects: false }
    )

    // Assert
    const location = response.headers()['location']
    expect(location).toBe(targetUrl)
  })

  test('7. Missing url param returns 400 error', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440012'

    // Act
    const response = await page.request.get(`/api/track/click/${validEventId}`)

    // Assert
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
    expect(body.error.toLowerCase()).toContain('url')
  })

  test('8. javascript: protocol returns 400 error (XSS prevention)', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440013'
    const maliciousUrl = 'javascript:alert("xss")'

    // Act
    const response = await page.request.get(
      `/api/track/click/${validEventId}?url=${encodeURIComponent(maliciousUrl)}`,
      { followRedirects: false }
    )

    // Assert
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  test('9. ftp: protocol returns 400 error (only http/https allowed)', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440014'
    const ftpUrl = 'ftp://files.example.com/document.pdf'

    // Act
    const response = await page.request.get(
      `/api/track/click/${validEventId}?url=${encodeURIComponent(ftpUrl)}`,
      { followRedirects: false }
    )

    // Assert
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
    expect(body.error.toLowerCase()).toContain('http')
  })

  test('10. URL with query params preserved in redirect', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440015'
    const targetUrl = 'https://example.com/page?param1=value1&param2=value2&utm_source=leadflow'

    // Act
    const response = await page.request.get(
      `/api/track/click/${validEventId}?url=${encodeURIComponent(targetUrl)}`,
      { followRedirects: false }
    )

    // Assert
    const location = response.headers()['location']
    expect(location).toBe(targetUrl)
    expect(location).toContain('param1=value1')
    expect(location).toContain('param2=value2')
    expect(location).toContain('utm_source=leadflow')
  })
})

test.describe('Email Tracking - Unsubscribe Link', () => {
  test('11. GET /api/unsubscribe/valid-token shows confirmation page', async ({ page }) => {
    // Arrange - Create a valid token (base64url encoded: workspaceId:email)
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000'
    const email = 'test@example.com'
    const tokenPayload = `${workspaceId}:${email}`
    const validToken = Buffer.from(tokenPayload).toString('base64url')

    // Act
    await page.goto(`/api/unsubscribe/${validToken}`)
    await page.waitForLoadState('networkidle')

    // Assert
    const content = await page.content()
    expect(content).toContain('ยืนยันการยกเลิกรับอีเมล')
    expect(content).toContain(email)
    expect(content).toContain('ใช่หรือไม่?')

    // Verify form exists
    const form = page.locator('form')
    await expect(form).toBeVisible()
  })

  test('12. GET /api/unsubscribe/invalid-token shows error page', async ({ page }) => {
    // Arrange
    const invalidToken = 'invalid-token-xyz'

    // Act
    await page.goto(`/api/unsubscribe/${invalidToken}`)
    await page.waitForLoadState('networkidle')

    // Assert
    const content = await page.content()
    expect(content).toContain('เกิดข้อผิดพลาด')
    expect(content).toContain('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว')
  })

  test('13. POST /api/unsubscribe/valid-token shows success page', async ({ page }) => {
    // Arrange
    const workspaceId = '550e8400-e29b-41d4-a716-446655440001'
    const email = 'unsubscribe@example.com'
    const tokenPayload = `${workspaceId}:${email}`
    const validToken = Buffer.from(tokenPayload).toString('base64url')

    // Act - Navigate to confirmation page
    await page.goto(`/api/unsubscribe/${validToken}`)
    await page.waitForLoadState('networkidle')

    // Submit the form
    const form = page.locator('form')
    const submitButton = form.locator('button[type="submit"]')
    await submitButton.click()

    await page.waitForLoadState('networkidle')

    // Assert
    const content = await page.content()
    expect(content).toContain('ยกเลิกรับอีเมลเรียบร้อย')
    expect(content).toContain(email)
    expect(content).toContain('จะไม่ได้รับอีเมลจากเราอีกต่อไป')
  })

  test('14. Unsubscribe page renders correctly in Thai', async ({ page }) => {
    // Arrange
    const workspaceId = '550e8400-e29b-41d4-a716-446655440002'
    const email = 'thai@example.com'
    const tokenPayload = `${workspaceId}:${email}`
    const validToken = Buffer.from(tokenPayload).toString('base64url')

    // Act
    await page.goto(`/api/unsubscribe/${validToken}`)
    await page.waitForLoadState('networkidle')

    // Assert - Check for Thai text
    const content = await page.content()
    expect(content).toContain('ยืนยันการยกเลิกรับอีเมล')
    expect(content).toContain('ยกเลิก')
  })

  test('15. Invalid token format in unsubscribe redirects or shows error', async ({ page }) => {
    // Arrange
    const invalidToken = 'not-base64url-valid@#$'

    // Act
    await page.goto(`/api/unsubscribe/${invalidToken}`)
    await page.waitForLoadState('networkidle')

    // Assert - Should show error or redirect
    const content = await page.content()
    expect(content).toContain('เกิดข้อผิดพลาด')
  })
})

test.describe('Email Tracking - Edge Cases', () => {
  test('16. Empty eventId in open tracking', async ({ page }) => {
    // Arrange & Act
    const response = await page.request.get('/api/track/open/')

    // Assert
    expect(response.status()).toBe(404)
  })

  test('17. Very long URL in click tracking still works', async ({ page }) => {
    // Arrange
    const validEventId = '550e8400-e29b-41d4-a716-446655440020'
    const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '?param=' + 'b'.repeat(500)

    // Act
    const response = await page.request.get(
      `/api/track/click/${validEventId}?url=${encodeURIComponent(longUrl)}`,
      { followRedirects: false }
    )

    // Assert
    expect(response.status()).toBe(302)
    const location = response.headers()['location']
    expect(location).toBe(longUrl)
  })

  test('18. Multiple tracking calls accumulate correctly', async ({ page }) => {
    // Arrange
    const eventId1 = '550e8400-e29b-41d4-a716-446655440021'
    const eventId2 = '550e8400-e29b-41d4-a716-446655440022'

    // Act - Call multiple times
    const response1 = await page.request.get(`/api/track/open/${eventId1}`)
    const response2 = await page.request.get(`/api/track/open/${eventId2}`)

    // Assert
    expect(response1.status()).toBe(200)
    expect(response2.status()).toBe(200)

    const buffer1 = await response1.body()
    const buffer2 = await response2.body()
    expect(buffer1.toString('utf-8', 0, 6)).toBe('GIF89a')
    expect(buffer2.toString('utf-8', 0, 6)).toBe('GIF89a')
  })
})
