import { expect, test, type Page } from "@playwright/test";

async function sitDown(page: Page, seatNumber: number, name: string) {
  await page.getByLabel(new RegExp(`^Seat ${seatNumber}\\b.*sit`, "i")).click();
  await page.getByPlaceholder("Your name").fill(name);
  await page.getByRole("button", { name: "Sit Down" }).click();
  await expect(page.getByLabel(`Open seat manager for ${name}`)).toBeVisible();
}

async function clickFirstEnabledAction(page: Page): Promise<boolean> {
  const labels = ["Check", "Call", "Fold"];
  for (const label of labels) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      const enabled = await button.isEnabled().catch(() => false);
      if (enabled) {
        await button.click({ force: true });
        return true;
      }
    }
  }
  return false;
}

test.describe("live browser smoke", () => {
  test("create, join, seat move, add chips, reconnect, and act through a live hand", async ({ browser, browserName }) => {
    test.setTimeout(60_000);
    test.skip(browserName === "webkit", "Chromium covers the live multi-client smoke path.");

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto("/");
    await hostPage.getByRole("button", { name: "Create Table" }).click();
    await hostPage.waitForURL(/\/t\/[A-Z0-9]{6}$/);

    const tableUrl = hostPage.url();
    const tableCode = tableUrl.split("/").at(-1);
    if (!tableCode) {
      throw new Error("Failed to capture table code from the created table URL.");
    }

    await sitDown(hostPage, 1, "Alice");

    await guestPage.goto("/");
    await guestPage.getByPlaceholder("Table code").fill(tableCode);
    await guestPage.getByRole("button", { name: "Join" }).click();
    await guestPage.waitForURL(new RegExp(`/t/${tableCode}$`));
    await sitDown(guestPage, 4, "Bob");

    await guestPage.getByLabel(/^Seat 5\b.*sit/i).click();
    await expect(guestPage.getByLabel(/^Seat 4\b.*sit/i)).toBeVisible();
    await expect(guestPage.getByLabel("Open seat manager for Bob")).toBeVisible();

    await hostPage.getByLabel("Open seat manager for Alice").click();
    const chipButton = hostPage.getByRole("button", { name: /Add (Chips|Next Hand)/ });
    await expect(chipButton).toBeVisible();
    await chipButton.click();
    await expect(chipButton).toBeHidden();

    await guestPage.reload();
    await expect(guestPage.getByLabel("Open seat manager for Bob")).toBeVisible();

    await hostPage.getByRole("button", { name: "Start Game" }).click();

    let actionTaken = false;
    for (let attempt = 0; attempt < 10 && !actionTaken; attempt += 1) {
      actionTaken = await clickFirstEnabledAction(hostPage);
      if (!actionTaken) {
        actionTaken = await clickFirstEnabledAction(guestPage);
      }
      if (!actionTaken) {
        await hostPage.waitForTimeout(500);
      }
    }

    expect(actionTaken).toBe(true);

    await expect(hostPage.getByText("Table not found")).toHaveCount(0);
    await expect(guestPage.getByText("Table not found")).toHaveCount(0);

    await hostContext.close();
    await guestContext.close();
  });
});
