const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path');

// --- Test Configuration ---
const APP_URL = 'http://localhost:3000/scheduler.html';
const SAMPLE_DATA_PATH = path.join(__dirname, '..', 'sample_data.json');
const SERVER_START_TIMEOUT = 5000; // 5 seconds
const fs = require('fs');

let serverProcess;

// --- Helper Functions ---
async function startServer() {
    // Kill any process that might be listening on port 3000
    await new Promise(resolve => {
        exec('kill $(lsof -t -i:3000) 2>/dev/null || true', () => resolve());
    });

    return new Promise((resolve, reject) => {
        serverProcess = exec('python3 -m http.server 3000', (error, stdout, stderr) => {
            // This callback is only called when the process exits.
            // We can log errors here, but resolve is handled by the timeout.
            if (error && !error.killed) {
                console.error(`Server Error: ${error}`);
                reject(error);
            }
        });
        console.log('Starting local server...');
        // Wait a bit for the server to be ready
        setTimeout(() => {
            console.log('Server should be ready.');
            resolve(serverProcess);
        }, 2000);
    });
}

function stopServer() {
    if (serverProcess && !serverProcess.killed) {
        console.log('Stopping local server with SIGKILL...');
        const killed = serverProcess.kill('SIGKILL');
        console.log(`Server stop signal sent. Success: ${killed}`);
    } else {
        console.log('Server already stopped or doesn\'t exist.');
    }
}

// --- Test Suite ---
test.describe('Scheduler UI Fixes', () => {
    test.beforeAll(async () => {
        await startServer();
    }, SERVER_START_TIMEOUT);

    test.afterAll(() => {
        stopServer();
    });

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);

        // Read sample data
        const sampleData = JSON.parse(fs.readFileSync(SAMPLE_DATA_PATH, 'utf-8'));

        // Inject data directly into the application state
        await page.evaluate(data => {
            // Dismiss the intro barrier and simulate file connection
            document.getElementById('introBarrier').style.display = 'none';
            document.getElementById('mainContent').classList.add('active');
            window.fileHandle = { name: 'test.json' }; // Dummy file handle

            // Set state and render the calendar
            window.state.users = data.users;
            window.state.events = data.events;
            window.renderCalendar();
        }, sampleData);

        // Verify that the calendar has rendered
        await expect(page.locator('.day-cell').first()).toBeVisible();
        const cellCount = await page.locator('.day-cell').count();
        expect(cellCount).toBeGreaterThan(0); // Should have at least some days
    });

    test('Issue 1: Member Deletion', async ({ page }) => {
        const testUser = 'Test User Delete';

        // 1. Open the user modal
        await page.click('#btnUsers');
        await expect(page.locator('#userModal')).toHaveClass(/open/);

        // 2. Add a new user
        await page.fill('#newUserName', testUser);
        await page.click('#userModal .btn.primary');

        // 3. Verify the user is in the list
        await expect(page.locator('#userListDisplay')).toContainText(testUser);

        // 4. Set up dialog handler **before** clicking delete
        page.on('dialog', dialog => dialog.accept());

        // 5. Delete the user
        const userChip = page.locator('.user-chip', { hasText: testUser });
        await userChip.locator('.delete-btn').click();

        // 6. Verify the user is removed from the list
        await expect(page.locator('#userListDisplay')).not.toContainText(testUser);

        // 7. Verify the user is removed from the state
        const usersInState = await page.evaluate(() => window.state.users);
        expect(usersInState).not.toContain(testUser);
    });

    test('Issue 2: Long Event Title UI', async ({ page }) => {
        const longTitle = 'This is a very long event title to test text overflow and tooltip functionality';

        // 1. Open the add event modal for a specific day
        await page.locator('.day-cell:not(.other-month)').nth(15).click(); // Click on the 16th day
        await expect(page.locator('#eventModal')).toHaveClass(/open/);

        // 2. Fill in the event details
        await page.fill('#eventTitle', longTitle);

        // Monkey-patch the saveTransaction function to prevent file system errors
        await page.evaluate(() => {
            window.saveTransaction = async (actionCallback) => {
                const newEvents = actionCallback(window.state.events);
                window.state.events = newEvents;
                window.renderCalendar();
            };
        });

        await page.click('#eventModal .btn.primary');
        await page.waitForTimeout(500); // wait for save

        // 3. Verify the event chip exists and its text is truncated in the UI
        const eventChip = page.locator(`.event-chip[title*="${longTitle}"]`);
        await expect(eventChip).toBeVisible();
        const eventChipSpan = eventChip.locator('span').first(); // Target the first span which contains the title
        await expect(eventChipSpan).toHaveCSS('text-overflow', 'ellipsis');

        // 4. Verify the tooltip contains the full title and details
        const tooltip = await eventChip.getAttribute('title');
        expect(tooltip).toContain(longTitle);
        expect(tooltip).toContain('担当:'); // Check for details
    });

    test('Issue 3: Dynamic Calendar Grid Height', async ({ page }) => {
        const grid = page.locator('#calendarGrid');

        // Helper function to get the number of rows
        const getGridRowCount = async () => {
            const gridTemplateRows = await grid.evaluate(el => getComputedStyle(el).gridTemplateRows);
            // The format is "40px <...repeating rows...>"
            return gridTemplateRows.split(' ').length - 1; // Subtract the header row
        };

        // --- Test for a 6-week month (e.g., December 2028) ---
        await page.evaluate(() => {
            window.state.currentDate = new Date('2028-12-01');
            window.renderCalendar();
        });
        await page.waitForTimeout(500);
        expect(await getGridRowCount()).toBe(6);

        // --- Test for a 4-week month (e.g., February 2026) ---
        await page.evaluate(() => {
            window.state.currentDate = new Date('2026-02-01');
            window.renderCalendar();
        });
        await page.waitForTimeout(500);
        expect(await getGridRowCount()).toBe(4);

        // --- Test for a 5-week month (e.g., February 2027) ---
        await page.evaluate(() => {
            window.state.currentDate = new Date('2027-02-01');
            window.renderCalendar();
        });
        await page.waitForTimeout(500);
        expect(await getGridRowCount()).toBe(5);
    });
});
