/**
 * firmazomog-utils.ts
 * FirmaMozog — B2B AI Knowledge Base (UI Demo)
 *
 * Utility functions extracted from the main screen component.
 * These are self-contained helpers covering:
 *   - Slovak localization (dates, greetings, pluralization)
 *   - Audio/image MIME detection for voice + photo capture
 *   - Intent classification and emoji mapping
 *   - Smart text truncation for feed cards
 *   - User ID → display name resolution
 *   - Daily digest builder from event rows
 *
 * Note: Internal API types are stubbed below for demo purposes.
 * Full source is private (commercial product).
 */

// ---------------------------------------------------------------------------
// Type stubs (simplified from internal firmamozog types)
// ---------------------------------------------------------------------------

export type FirmamozogRole = 'zamestnanec' | 'veduci' | 'admin';

export interface FirmamozogEventRow {
  intent: string;
  raw_text: string;
  extraction: Record<string, unknown> | null;
  flags?: { urgent?: boolean };
}

export interface FirmamozogTeamMember {
  suggestedUserId: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Filter chips — Mozog tab category filters
// Each chip filters knowledge entries by keyword regex
// ---------------------------------------------------------------------------

export const MOZOG_CHIPS: Array<{ key: string; label: string; keywords?: RegExp }> = [
  { key: 'all',  label: 'Všetko' },
  { key: 'pin',  label: 'Pripnuté' },
  { key: 'post', label: 'postupy',    keywords: /postup|návod|krok|montáž|montaz|ako na|workflow|proces/i },
  { key: 'dod',  label: 'dodávatelia', keywords: /dodávateľ|dodavatel|dodávka|objednáv|objednav|sklad|faktúr|faktur/i },
  { key: 'chy',  label: 'chyby',      keywords: /chyba|bug|nefunguje|padá|pada|error|výnimk|vynimk|zlyhalo/i },
  { key: 'nar',  label: 'náradie',    keywords: /náradie|naradie|nástroj|nastroj|vrtač|vrtac|brúsk|brusk|píl|pil|aku|skrutk/i },
];

// ---------------------------------------------------------------------------
// Audio & image MIME detection
// expo-av recordings differ by OS and file extension
// ---------------------------------------------------------------------------

/**
 * Returns the correct MIME type for an expo-av recording URI.
 * iOS typically records .m4a/.caf, Android uses .3gp or .webm.
 */
export function mimeTypeForRecordingUri(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith('.wav'))              return 'audio/wav';
  if (u.endsWith('.caf'))              return 'audio/x-caf';
  if (u.endsWith('.3gp'))              return 'audio/3gpp';
  if (u.endsWith('.webm'))             return 'audio/webm';
  if (u.endsWith('.mp4') || u.endsWith('.m4a')) return 'audio/m4a';
  // Platform fallback
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
    ? 'audio/mp4'
    : 'audio/m4a';
}

/**
 * Returns MIME type from an image picker URI.
 * Prefers the picker's own mimeType field; falls back to URI extension.
 */
export function imageMimeForVision(
  uri: string | null | undefined,
  pickerMime: string | null | undefined,
): string {
  const m = pickerMime?.trim().toLowerCase();
  if (m && m.startsWith('image/')) return m;
  if (!uri) return 'image/jpeg';
  const u = uri.toLowerCase();
  if (u.endsWith('.png'))  return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif'))  return 'image/gif';
  return 'image/jpeg';
}

// ---------------------------------------------------------------------------
// Slovak localization helpers
// ---------------------------------------------------------------------------

const DAYS_SK   = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
const MONTHS_SK = [
  'januára', 'februára', 'marca',    'apríla',   'mája',     'júna',
  'júla',    'augusta',  'septembra', 'októbra', 'novembra', 'decembra',
];

/** "Pondelok, 9 mája" — Slovak long date without trailing dot */
export function formatSkDateLong(d: Date): string {
  return `${DAYS_SK[d.getDay()]}, ${d.getDate()} ${MONTHS_SK[d.getMonth()]}`;
}

/** Time-of-day greeting in Slovak */
export function greetingForHour(d: Date): string {
  const h = d.getHours();
  if (h < 10) return 'Dobré ráno';
  if (h < 18) return 'Dobrý deň';
  return 'Dobrý večer';
}

/**
 * Slovak record count with correct plural forms.
 * Slovak has 3 plural forms: 1 / 2–4 / 5+
 */
export function skZaznamCount(n: number): string {
  if (n === 1)             return '1 záznam';
  if (n >= 2 && n <= 4)   return `${n} záznamy`;
  return `${n} záznamov`;
}

/** Short role label for role badge in header */
export function roleLabelShort(role: FirmamozogRole): string {
  if (role === 'admin')   return 'Admin';
  if (role === 'veduci')  return 'Vedúci';
  return 'Zamestnanec';
}

// ---------------------------------------------------------------------------
// Intent → emoji mapper (used in chat feed and notification badges)
// ---------------------------------------------------------------------------

export function chatFeedIntentEmoji(intent: string): string {
  switch (intent) {
    case 'material_request': return '🛒';
    case 'problem_report':   return '⚠️';
    case 'knowledge':        return '📚';
    case 'task_update':      return '✓';
    case 'expense':          return '€';
    case 'question':         return '💬';
    default:                 return '📋';
  }
}

// ---------------------------------------------------------------------------
// Event row text extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a short title from an event row.
 * Tries common extraction keys first; falls back to raw_text first line.
 * Avoids generic AI-generated titles like "Know-how" or "Znalosť".
 */
export function eventTitle(ev: FirmamozogEventRow): string {
  const ex = ev.extraction;
  if (ex && typeof ex === 'object') {
    for (const k of ['title', 'subject', 'summary', 'topic', 'headline']) {
      const v = ex[k];
      if (typeof v === 'string' && v.trim()) {
        const t = v.trim();
        const low = t.toLowerCase();
        // Skip generic AI-generated fallback titles
        if (['know-how', 'know how', 'znalosť', 'znalost', 'knowledge'].includes(low)) break;
        return t.slice(0, 88);
      }
    }
  }
  const line = ev.raw_text.trim().split(/\n/)[0] ?? '';
  return line.length > 88 ? `${line.slice(0, 86)}…` : line || ev.intent;
}

/**
 * Extracts body text from event extraction or falls back to raw_text.
 * Max 400 chars — feed cards use short previews only.
 */
export function eventBodyText(ev: FirmamozogEventRow): string {
  const ex = ev.extraction;
  if (ex && typeof ex === 'object') {
    for (const k of ['detail', 'description', 'text', 'notes', 'content']) {
      const v = ex[k];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 400);
    }
  }
  return ev.raw_text.trim().slice(0, 400);
}

// ---------------------------------------------------------------------------
// Feed card text truncation
// ---------------------------------------------------------------------------

/**
 * Returns a short title line for Mozog feed cards.
 * Strips trailing clauses after ":" or "—", limits to 6 words / 44 chars.
 */
export function mozogCardTitleLine(ev: FirmamozogEventRow): string {
  const rawTitle = eventTitle(ev).replace(/\s+/g, ' ').trim();
  if (!rawTitle) return 'Znalosť';
  const base  = rawTitle.replace(/[:—–-].*$/u, '').trim() || rawTitle;
  const words = base.split(/\s+/).filter(Boolean);
  const short = words.slice(0, 6).join(' ');
  const out   = short.length > 44 ? `${short.slice(0, 42)}…` : short;
  return out.length < 4
    ? (rawTitle.length > 60 ? `${rawTitle.slice(0, 58)}…` : rawTitle)
    : out;
}

/**
 * Returns body preview for Mozog feed card.
 * Deduplicates body vs title — avoids repeating the same sentence twice.
 */
export function mozogCardBodyLine(ev: FirmamozogEventRow): string | null {
  const title = eventTitle(ev).replace(/\s+/g, ' ').trim();
  let body = (eventBodyText(ev) || ev.raw_text || '').replace(/\s+$/g, '').trim();
  if (!body) return null;
  const bodyLines = body.split('\n');
  const firstLine = (bodyLines[0] || '').replace(/\s+/g, ' ').trim();
  if (firstLine && title && firstLine === title) {
    body = bodyLines.slice(1).join('\n').trim();
  } else if (title && body.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(title.toLowerCase())) {
    body = body.slice(title.length).replace(/^[:\s-]+/, '').trim();
  }
  if (!body) return null;
  return body.length > 400 ? `${body.slice(0, 398)}…` : body;
}

// ---------------------------------------------------------------------------
// User ID → display name resolution
// ---------------------------------------------------------------------------

/**
 * Converts a raw user ID to a human-readable display name.
 *
 * Handles:
 * - email addresses → first part before @
 * - technical IDs like "u1", "U_jano" → cleaned name
 * - underscore/hyphen/dot separators → spaces
 * - Falls back to "kolega" for unrecognizable IDs
 */
export function displayNameFromUserId(id: string): string {
  const t = id.trim();
  if (!t) return 'kolega';
  if (/^[a-z]\d+$/i.test(t) || /^u\d+$/i.test(t)) return 'kolega';
  const base    = t.includes('@') ? t.split('@')[0]!.trim() : t;
  if (!base) return 'kolega';
  const cleaned = base.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'kolega';
  const parts     = cleaned.split(' ').filter(Boolean);
  const coreParts =
    parts.length >= 2 && parts[0] && /^u$/i.test(parts[0])
      ? parts.slice(1)
      : parts;
  const core = coreParts.join(' ').trim();
  if (!core) return 'kolega';
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/**
 * Resolves a user ID to display name with team member lookup.
 * Priority: self → team member → displayNameFromUserId fallback.
 */
export function resolveUserDisplay(
  userRaw: string,
  selfUserId: string,
  selfDisplayName: string,
  team: FirmamozogTeamMember[],
): string {
  const uid = userRaw.trim();
  if (!uid) return '?';
  if (uid === selfUserId.trim() && selfDisplayName.trim()) return selfDisplayName.trim();
  const m = team.find((t) => t.suggestedUserId.trim() === uid);
  if (m?.displayName?.trim()) return m.displayName.trim();
  return displayNameFromUserId(uid);
}

/** Two-letter initials from a display name for avatar fallback */
export function contributorInitials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  if (t.length <= 2) return t.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Daily digest builder
// ---------------------------------------------------------------------------

/**
 * Builds a structured daily digest from the last N event rows.
 * Used as the greeting message when the user opens the app.
 * Counts events by intent category and formats them for Slovak readers.
 */
export function buildDailyDigestFromRowsSk(rows: FirmamozogEventRow[]): string {
  const week    = rows.slice(0, 200);
  const urgentN = week.filter((r) => r.flags?.urgent === true).length;
  const probN   = week.filter((r) => r.intent === 'problem_report').length;
  const matN    = week.filter((r) => r.intent === 'material_request').length;
  const tasksN  = week.filter((r) => r.intent === 'task_update').length;
  const knowN   = week.filter((r) => r.intent === 'knowledge').length;

  return [
    'Čo sa vo firme deje (posledné záznamy):',
    `• Urgent: ${urgentN}`,
    `• Problémy: ${probN}`,
    `• Chýba / nákup: ${matN}`,
    `• Hotovo: ${tasksN}`,
    `• Znalosti: ${knowN}`,
    '',
    'Napíš vetu čo riešiš — a ja navrhnem zaradenie, aby to fungovalo „samo".',
  ].join('\n');
}

/**
 * Full greeting reply with digest, or onboarding message if no records yet.
 */
export function greetingDigestReplySk(rows: FirmamozogEventRow[]): string {
  if (!rows || rows.length === 0) {
    return (
      'Ahoj! Som Firemný mozog.\n\n' +
      'Zatiaľ nemám dosť záznamov, aby som vedel zhrnúť dianie vo firme. ' +
      'Keď začneš zapisovať, automaticky z toho spravím prehľad.\n\n' +
      'Skús napríklad:\n' +
      '• „Olepovačka nefunguje"\n' +
      '• „Došli utierky"\n' +
      '• „Hotovo: montáž dverí pri projekte RajCentrum"'
    );
  }
  return `Ahoj!\n\n${buildDailyDigestFromRowsSk(rows)}`;
}

// ---------------------------------------------------------------------------
// Knowledge heuristic classifier
// ---------------------------------------------------------------------------

/**
 * Returns true if the event looks like operational noise rather than
 * reusable know-how. Used to filter Mozog tab content.
 *
 * Heuristics:
 * - Very short entries (≤38 chars) are likely quick status updates
 * - Entries starting with operational prefixes (urgent, chýba, hotovo…)
 * - Entries with status emojis (✅, ⚠️, 🛒)
 */
export function isOperationalishKnowledge(ev: FirmamozogEventRow): boolean {
  const t      = `${eventTitle(ev)}\n${String(ev.raw_text || '')}`.trim();
  if (!t) return true;
  const oneLine = t.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 38) return true;
  if (/^(urgent|chýba|chyba|problém|problem|bloček|blocek|hotovo|záznam|zaznam|nákup|nakup)\s*:/i.test(oneLine)) return true;
  if (/^(✅|⚠️|🚨|🛒)\s*/.test(oneLine)) return true;
  return false;
}
