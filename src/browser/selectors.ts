import { Page, Locator } from 'playwright';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

const COMMON_ROLES = ['button', 'link', 'searchbox', 'textbox', 'combobox', 'menuitem', 'tab', 'checkbox', 'radio', 'option', 'heading', 'img'] as const;

export async function resolveLocator(page: Page, role?: string, name?: string): Promise<Locator> {
  if (!name) {
    throw new Error('Element name is required to find an element.');
  }

  // If role is provided, use it directly
  if (role) {
    const locator = page.getByRole(role as any, { name, exact: false });
    const count = await locator.count();
    if (count > 0) {
      log(`Found ${count} element(s) with role="${role}" name="${name}"`);
      return locator.first();
    }
    throw new Error(`No element found with role="${role}" and name="${name}". Try using serge_read_page to see available elements.`);
  }

  // No role provided — try common roles in order of likelihood
  for (const tryRole of COMMON_ROLES) {
    const locator = page.getByRole(tryRole, { name, exact: false });
    const count = await locator.count();
    if (count > 0) {
      log(`Found element with role="${tryRole}" name="${name}"`);
      return locator.first();
    }
  }

  // Try aria-label
  const ariaLocator = page.locator(`[aria-label="${name}"]`);
  if (await ariaLocator.count() > 0) {
    log(`Found element with aria-label="${name}"`);
    return ariaLocator.first();
  }

  // Try text content
  const textLocator = page.getByText(name, { exact: false });
  if (await textLocator.count() > 0) {
    log(`Found element by text content: "${name}"`);
    return textLocator.first();
  }

  throw new Error(`No element found matching name="${name}". Use serge_read_page to see available elements on the page.`);
}
