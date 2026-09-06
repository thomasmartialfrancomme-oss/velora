/**
 * Campaign attribution — the four UTM values a paid click carried, frozen into
 * whichever row that click produced: an access request, or the account itself.
 *
 * Why a cookie instead of reading the query string in the form handler: an advert
 * lands on a marketing page, but the conversion happens minutes or days later on a
 * different URL that no longer carries `?utm_*`. Reading the referer at submit time
 * gives you a domain and a lot of guesses; a click id that is not stored is a click
 * id that was paid for twice and learned from never.
 *
 * Deliberate limits, all of them load-bearing:
 *  • the cookie is httpOnly — no script on the landing page can read it or plant a
 *    fake one, and an ad network cannot be blamed for a value it never set;
 *  • the character filter is a whitelist, because this text ends up on a screen in
 *    the administrator console next to other people's names;
 *  • 30 days, so it survives a slow household decision without following somebody
 *    around the internet for a year;
 *  • no source, no row: organic visitors keep a null campaign, which is the honest
 *    answer, and it is what makes "6 accounts, all LinkedIn, none direct" mean
 *    something when you read the console in a month.
 *
 * Nothing here sends data anywhere. It reads a URL and writes two columns.
 */

export const CAMPAIGN_COOKIE = 'velora_campaign';

/** A click id is worth as much as the column it fits in; 64 is the UTM convention. */
const MAX_LENGTH = 64;

export interface Campaign {
  source: string;
  medium: string;
  name: string;
  content: string | null;
}

/** Strip anything that is not letter, digit, space or advertising punctuation. */
function clip(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[^A-Za-z0-9 ._:@/-]/g, '')
    .trim()
    .slice(0, MAX_LENGTH);
}

/** The four values a paid click carries, or `null` when no source was carried. */
export function campaignFromParams(params: URLSearchParams): Campaign | null {
  const source = clip(params.get('utm_source'));
  if (!source) return null;
  return {
    source,
    medium: clip(params.get('utm_medium')) || 'paid',
    name: clip(params.get('utm_campaign')) || 'unnamed',
    content: clip(params.get('utm_content')) || null,
  };
}

/** From an absolute or relative URL — used by the edge middleware on a landing. */
export function campaignFromUrl(url: string | { searchParams: URLSearchParams }): Campaign | null {
  if (typeof url === 'string') return campaignFromParams(new URL(url, 'http://velora.local').searchParams);
  return campaignFromParams(url.searchParams);
}

/**
 * Pipe-joined, and deliberately NOT percent-encoded here: Next encodes the cookie
 * value on its way out and decodes it on its way back in, so encoding twice is how a
 * campaign turns into `linkedin%257Cpaid`. `clip()` already guarantees the value holds
 * no separator, quote, comma or percent sign, which is the only reason the raw string
 * is safe to put in a header.
 */
export function encodeCampaign(campaign: Campaign): string {
  return [campaign.source, campaign.medium, campaign.name, campaign.content ?? ''].join('|');
}

export function decodeCampaign(value: string | null | undefined): Campaign | null {
  if (!value) return null;
  let decoded = '';
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null; // a hand-mangled cookie is not a campaign
  }
  const [source = '', medium = '', name = '', content = ''] = decoded.split('|');
  const clean = clip(source);
  if (!clean) return null;
  return { source: clean, medium: clip(medium) || 'paid', name: clip(name) || 'unnamed', content: clip(content) || null };
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1) || null;
  }
  return null;
}

/** Attribution inside a request handler, without reaching for `next/headers`. */
export function campaignFromRequest(request: { headers: Headers }): Campaign | null {
  return decodeCampaign(cookieValue(request.headers.get('cookie'), CAMPAIGN_COOKIE));
}

export function campaignColumns(campaign: Campaign | null): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
} {
  return {
    utm_source: campaign?.source ?? null,
    utm_medium: campaign?.medium ?? null,
    utm_campaign: campaign?.name ?? null,
    utm_content: campaign?.content ?? null,
  };
}

/** What a person reads in the console: `linkedin · paid · family-office-principal`. */
export function campaignLabel(campaign: Campaign | { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } | null): string | null {
  if (!campaign) return null;
  const source = 'source' in campaign ? campaign.source : campaign.utm_source;
  if (!source) return null;
  const medium = 'medium' in campaign ? campaign.medium : campaign.utm_medium;
  const name = 'name' in campaign ? campaign.name : campaign.utm_campaign;
  return [source, medium, name].filter(Boolean).join(' · ');
}
