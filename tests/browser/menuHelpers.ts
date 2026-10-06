import type { Page } from "@playwright/test";

export async function chooseFileMenuItem(page: Page, name: string | RegExp) {
  const toolbar = page.locator(".top-bar");
  await toolbar.getByRole("button", { name: /File/ }).click();
  await page.getByRole("menuitem", { name }).click();
}

export async function openImportFiles(page: Page) {
  await chooseFileMenuItem(page, /Open\/import files|Import text scenes/i);
}

export async function openImportFolder(page: Page) {
  await chooseFileMenuItem(page, /Import scenes folder/i);
}

export async function exportChoiceScriptZip(page: Page) {
  await chooseFileMenuItem(page, /Export ChoiceScript ZIP/i);
}
