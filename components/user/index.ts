/**
 * The saved-cards page, selected under `@/components/user`.
 *
 * The page client and the state it falls back to are what `app/user/page.tsx`
 * imports; the masthead and the plates are composed inside the client, so they
 * are not on this interface.
 *
 * `SavedCard` and its link helpers live in `@/lib/cards/saved-card` rather than
 * here, because they build absolute URLs and so belong beside `@/lib/browser`.
 *
 * @source
 */
export { UserPageClient } from "./UserPageClient";
export { UserPageState } from "./UserPageState";
