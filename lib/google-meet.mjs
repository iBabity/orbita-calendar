// Only display provider-returned Google Meet URLs; never invent meeting codes.
export function googleMeetDetails(event, requested = false) {
 const conference = event?.conferenceData || event?.conference_data;
 const rawEntries = conference?.entryPoints || conference?.entry_points;
 const entries = Array.isArray(rawEntries) ? rawEntries : [];
 const candidates = [event?.hangoutLink, event?.hangout_link, event?.meet_link, event?.google_meet_url, ...entries.map(e => e?.uri)];
 for (const candidate of candidates) {
  if (typeof candidate !== 'string') continue;
  try { const url = new URL(candidate); if (url.protocol === 'https:' && url.hostname === 'meet.google.com' && !url.username && !url.password && url.pathname !== '/') return {meetUrl: url.href, meetStatus: 'ready'}; } catch {}
 }
 const request = conference?.createRequest || conference?.create_request;
 const status = request?.status?.statusCode || request?.status?.status_code;
 if (status === 'failure') return {meetStatus: 'failed'};
 return requested || status === 'pending' ? {meetStatus: 'pending'} : {};
}
