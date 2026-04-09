import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

/** Initialise PostHog — call once at app startup */
export function initAnalytics() {
  if (!KEY) return; // No key = analytics silently disabled (dev or missing config)
  posthog.init(KEY, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,      // We fire pageviews manually per hash-route change
    capture_pageleave: true,
    autocapture: true,            // Clicks, inputs, forms — all automatic
    session_recording: {
      maskAllInputs: true,        // Never record passwords / personal data
    },
  });
}

/** Identify a logged-in user */
export function identifyUser(id: number, email: string, plan: string) {
  if (!KEY) return;
  posthog.identify(String(id), { email, plan });
}

/** Reset on logout */
export function resetUser() {
  if (!KEY) return;
  posthog.reset();
}

/** Record a page view (called on every hash-route change) */
export function trackPageview(path: string) {
  if (!KEY) return;
  posthog.capture("$pageview", { $current_url: path });
}

/** Generic event helper */
export function track(event: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.capture(event, props);
}

// ── Named events ──────────────────────────────────────────────────────────────

export const Analytics = {
  // Auth
  signedUp: (plan: string) =>
    track("signed_up", { plan }),

  loggedIn: () =>
    track("logged_in"),

  loggedOut: () =>
    track("logged_out"),

  // Extraction
  extractionStarted: (method: "image" | "url" | "instagram_caption") =>
    track("extraction_started", { method }),

  extractionCompleted: (method: "image" | "url" | "instagram_caption", title: string) =>
    track("extraction_completed", { method, recipe_title: title }),

  extractionFailed: (method: "image" | "url" | "instagram_caption", error: string) =>
    track("extraction_failed", { method, error }),

  // Recipes
  recipeSaved: (title: string, method: string) =>
    track("recipe_saved", { recipe_title: title, source_method: method }),

  recipeViewed: (title: string) =>
    track("recipe_viewed", { recipe_title: title }),

  recipeDeleted: () =>
    track("recipe_deleted"),

  recipeFavourited: (isFav: boolean) =>
    track("recipe_favourited", { is_favourite: isFav }),

  // Collections
  collectionsViewed: () =>
    track("collections_viewed"),

  // Profile
  preferencesUpdated: (field: string) =>
    track("preferences_updated", { field }),

  upgradeCtaClicked: (billing: string) =>
    track("upgrade_cta_clicked", { billing_period: billing }),
};
