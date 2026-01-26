const { test, expect } from '@playwright/test';
const { execSync } = require('child_process');

test.describe('Scheduler Functional Verification', () => {
  let server;

  test.beforeAll(async () => {
    // Serve the scheduler.html file on port 3000
    server = execSync('python3 -m http.server 3000 &');
    // Wait for the server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test.afterAll(() => {
    // Kill the server process
    execSync('kill $(lsof -t -i:3000)');
  });

  test('should correctly delete a user', async ({ page }) => {
    await page.goto('http://localhost:3000/scheduler.html');

    // Dismiss the intro barrier
    await page.click('#introBarrier .btn.primary');

    // Open the user modal
    await page.click('#btnUsers');

    // Add a new user
    await page.fill('#newUserName', 'Test User');
    await page.click('.btn.primary:has-text("追加")');

    // Verify the user was added
    const userChip = page.locator('.user-chip:has-text("Test User")');
    await expect(userChip).toBeVisible();

    // Delete the user
    await userChip.locator('.delete-btn').click();

    // Verify the user was deleted
    await expect(userChip).not.toBeVisible();
  });

  test('should display a detailed tooltip on event hover', async ({ page }) => {
    await page.goto('http://localhost:3000/scheduler.html');

    // Dismiss the intro barrier
    await page.click('#introBarrier .btn.primary');

    // Inject test data
    await page.evaluate(() => {
      window.state.events = [
        {
          id: 'test-event-1',
          date: '2026-01-01',
          time: '10:00',
          title: 'Test Event',
          desc: 'This is a test event.',
          writers: ['Test User'],
          categoryId: 'cat_zen'
        }
      ];
      window.renderCalendar();
    });

    // Hover over the event
    const eventChip = page.locator('.event-chip:has-text("Test Event")');
    await eventChip.hover();

    // Verify the tooltip content
    const tooltip = await eventChip.getAttribute('title');
    expect(tooltip).toContain('[10:00] Test Event');
    expect(tooltip).toContain('担当: Test User');
    expect(tooltip).toContain('This is a test event.');
  });

  test('should have a dynamic grid height', async ({ page }) => {
    await page.goto('http://localhost:3000/scheduler.html');

    // Dismiss the intro barrier
    await page.click('#introBarrier .btn.primary');

    // Check the grid height for a 5-week month (e.g., February 2026)
    await page.evaluate(() => {
        window.state.currentDate = new Date('2026-02-01');
        window.renderCalendar();
    });
    const grid5Weeks = page.locator('#calendarGrid');
    const style5Weeks = await grid5Weeks.getAttribute('style');
    expect(style5Weeks).toContain('repeat(5, minmax(120px, auto))');

    // Check the grid height for a 6-week month (e.g., January 2026)
    await page.evaluate(() => {
        window.state.currentDate = new Date('2026-01-01');
        window.renderCalendar();
    });
    const grid6Weeks = page.locator('#calendarGrid');
    const style6Weeks = await grid6Weeks.getAttribute('style');
    expect(style6Weeks).toContain('repeat(6, minmax(120px, auto))');
  });
});
