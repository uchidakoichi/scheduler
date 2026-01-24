const { test, expect } = require('@playwright/test');

test.describe('Scheduler fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/scheduler.html');
  });

  test('should add and delete a user with special characters', async ({ page }) => {
    // 1. Create a dummy file handle and load data
    await page.evaluate(() => {
      const state = {
        users: [],
        events: []
      };
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
      const file = new File([blob], 'test-data.json', { type: 'application/json' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.files = dataTransfer.files;
      window.showOpenFilePicker = async () => [
        {
          getFile: async () => file,
          createWritable: async () => ({
            write: async () => {},
            close: async () => {},
          }),
        },
      ];
    });

    await page.click('#introBarrier .btn.primary');

    // 2. Add a user with special characters
    await page.click('#btnUsers');
    const userName = 'Jules "The" Engineer';
    await page.fill('#newUserName', userName);
    await page.click('button:has-text("追加")');

    // 3. Verify user is added
    const userChip = page.locator(`.user-chip:has-text('${userName}')`);
    await expect(userChip).toBeVisible();

    // 4. Delete the user
    await page.on('dialog', dialog => dialog.accept());
    await userChip.locator('.delete-btn').click();


    // 5. Verify user is deleted
    await expect(userChip).not.toBeVisible();
  });

  test('should display a detailed tooltip for events', async ({ page }) => {
    // 1. Create a dummy file handle and load data
    await page.evaluate(() => {
      const state = {
        users: ['Test User'],
        events: [
          {
            id: '1',
            date: '2024-07-29',
            time: '10:00',
            title: 'This is a very long event title to test the tooltip functionality',
            desc: 'This is a detailed description of the event.',
            writers: ['Test User'],
            categoryId: 'cat_zen',
          },
        ],
      };
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
      const file = new File([blob], 'test-data.json', { type: 'application/json' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.files = dataTransfer.files;
      window.showOpenFilePicker = async () => [
        {
          getFile: async () => file,
          createWritable: async () => ({
            write: async () => {},
            close: async () => {},
          }),
        },
      ];
    });

    await page.click('#introBarrier .btn.primary');

    // 2. Navigate to the correct month
    await page.evaluate(() => {
      state.currentDate = new Date('2024-07-29');
      renderCalendar();
    });

    // 3. Hover over the event and check the tooltip
    const eventChip = page.locator('.event-chip');
    await eventChip.hover();
    const tooltipText = await eventChip.getAttribute('title');
    expect(tooltipText).toContain('時間: 10:00');
    expect(tooltipText).toContain('予定: This is a very long event title to test the tooltip functionality');
    expect(tooltipText).toContain('担当: Test User');
    expect(tooltipText).toContain('詳細: This is a detailed description of the event.');
  });

  test('should have dynamic row height', async ({ page }) => {
    // 1. Create a dummy file handle and load data
    await page.evaluate(() => {
      const state = {
        users: [],
        events: [
          { id: '1', date: '2024-07-29', time: '10:00', title: 'Event 1', categoryId: 'cat_zen' },
          { id: '2', date: '2024-07-29', time: '11:00', title: 'Event 2', categoryId: 'cat_zen' },
          { id: '3', date: '2024-07-29', time: '12:00', title: 'Event 3', categoryId: 'cat_zen' },
          { id: '4', date: '2024-07-29', time: '13:00', title: 'Event 4', categoryId: 'cat_zen' },
          { id: '5', date: '2024-07-29', time: '14:00', title: 'Event 5', categoryId: 'cat_zen' },
        ],
      };
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
      const file = new File([blob], 'test-data.json', { type: 'application/json' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.files = dataTransfer.files;
      window.showOpenFilePicker = async () => [
        {
          getFile: async () => file,
          createWritable: async () => ({
            write: async () => {},
            close: async () => {},
          }),
        },
      ];
    });

    await page.click('#introBarrier .btn.primary');

    // 2. Navigate to the correct month
    await page.evaluate(() => {
      state.currentDate = new Date('2024-07-29');
      renderCalendar();
    });

    // 3. Take a screenshot to visually verify the dynamic row height
    await page.screenshot({ path: 'calendar-screenshot.png' });
  });
});
