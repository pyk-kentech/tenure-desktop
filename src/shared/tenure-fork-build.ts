// tenure fork switches (DESIGN.md 36.23). electron-vite defines TENURE_FORK_BUILD for the app bundles;
// vitest has no define, so upstream tests keep seeing upstream names and paths.
declare const TENURE_FORK_BUILD: boolean | undefined
export const IS_TENURE_FORK_BUILD =
  // oxlint-disable-next-line unicorn/no-typeof-undefined -- the define is absent under vitest; a bare read would throw.
  typeof TENURE_FORK_BUILD !== 'undefined' && TENURE_FORK_BUILD === true

const UPSTREAM_PRODUCT_NAME = /(?<![A-Za-z])Orca(?![A-Za-z])/g

/** Shows the product as tenure in every UI string, including English call-site defaults no catalog covers. */
export function applyProductName(text: string): string {
  return IS_TENURE_FORK_BUILD ? text.replace(UPSTREAM_PRODUCT_NAME, 'tenure') : text
}

/** GitHub repo whose releases carry the installer and latest.yml (DESIGN.md 36.23 releases). */
export const RELEASES_REPO = IS_TENURE_FORK_BUILD ? 'pyk-kentech/tenure' : 'stablyai/orca'
