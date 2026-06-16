import { StyleSheet, Font } from '@react-pdf/renderer';

// Tipografía institucional IBM Plex Sans (recomendación skill UI/UX para finanzas/
// inversión). TTF servidos desde /public/fonts. Se registran como familias-alias
// que mapean 1:1 a los nombres que el código ya usaba (Helvetica → regular,
// Helvetica-Bold → bold), para un swap por valor sin tocar fontWeight.
// ?v=2 = cache-bust tras quitar la tabla GSUB (las ligaturas "fi" rompían el render).
Font.register({ family: 'IBM Plex Sans', src: '/fonts/IBMPlexSans-Regular.ttf?v=2' });
Font.register({ family: 'IBM Plex Sans Bold', src: '/fonts/IBMPlexSans-Bold.ttf?v=2' });

// Register a safe built-in font fallback — react-pdf bundles Helvetica
Font.registerHyphenationCallback((word) => [word]);

const DARK_BG   = '#0F1728';
const DARK_CARD = '#1E2B3E';
const ACCENT    = '#0EB5C6'; // teal de marca Validus
const ACCENT_LT = '#CCFBF1'; // teal-100
const WHITE     = '#FFFFFF';
const MUTED     = '#94A3B8';
const BORDER    = '#2A3A52';

export const colors = {
  darkBg:   DARK_BG,
  darkCard: DARK_CARD,
  accent:   ACCENT,
  accentLt: ACCENT_LT,
  white:    WHITE,
  muted:    MUTED,
  border:   BORDER,
  green:    '#10B981',
  amber:    '#F59E0B',
  red:      '#EF4444',
  blue:     '#3B82F6',
  purple:   '#7C3AED',
};

export const styles = StyleSheet.create({
  // ── Page ──────────────────────────────────────────────────────────────────
  page: {
    backgroundColor: DARK_BG,
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
    fontFamily: 'IBM Plex Sans',
    color: WHITE,
  },

  // ── Cover ─────────────────────────────────────────────────────────────────
  coverPage: {
    backgroundColor: DARK_BG,
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
    fontFamily: 'IBM Plex Sans',
    color: WHITE,
  },
  coverHero: {
    backgroundColor: DARK_CARD,
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 40,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 0,
  },
  coverBadge: {
    backgroundColor: ACCENT,
    color: WHITE,
    fontSize: 7,
    fontFamily: 'IBM Plex Sans Bold',
    letterSpacing: 2,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'IBM Plex Sans Bold',
    color: WHITE,
    marginBottom: 8,
    lineHeight: 1.15,
  },
  coverSubtitle: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 32,
    lineHeight: 1.5,
  },
  coverScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
  },
  coverScoreBig: {
    fontSize: 72,
    fontFamily: 'IBM Plex Sans Bold',
    lineHeight: 1,
  },
  coverScoreLabel: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverScoreBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
    width: 120,
    marginTop: 6,
  },
  coverScoreBarFill: {
    height: 6,
    borderRadius: 3,
  },
  coverMeta: {
    paddingHorizontal: 40,
    paddingTop: 28,
    flexDirection: 'row',
    gap: 32,
  },
  coverMetaItem: {
    flex: 1,
  },
  coverMetaLabel: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 3,
    fontFamily: 'IBM Plex Sans Bold',
  },
  coverMetaValue: {
    fontSize: 11,
    color: WHITE,
  },

  // ── Content pages ─────────────────────────────────────────────────────────
  contentPage: {
    backgroundColor: DARK_BG,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 40,
    fontFamily: 'IBM Plex Sans',
    color: WHITE,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pageTitle: {
    fontSize: 18,
    fontFamily: 'IBM Plex Sans Bold',
    color: WHITE,
  },
  pageLabel: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'IBM Plex Sans Bold',
  },

  // ── Two-column layout ─────────────────────────────────────────────────────
  twoCol: {
    flexDirection: 'row',
    gap: 16,
  },
  col: {
    flex: 1,
  },

  // ── Cards / sections ──────────────────────────────────────────────────────
  card: {
    backgroundColor: DARK_CARD,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: {
    fontSize: 8,
    fontFamily: 'IBM Plex Sans Bold',
    color: ACCENT,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 9.5,
    color: '#CBD5E1',
    lineHeight: 1.55,
  },

  // ── Section heading ───────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'IBM Plex Sans Bold',
    color: WHITE,
    marginBottom: 10,
    marginTop: 4,
  },

  // ── Pill / badge ──────────────────────────────────────────────────────────
  pill: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 8,
    fontFamily: 'IBM Plex Sans Bold',
    alignSelf: 'flex-start',
  },

  // ── Score row ─────────────────────────────────────────────────────────────
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    fontSize: 9,
    color: MUTED,
    width: 80,
  },
  scoreBar: {
    flex: 1,
    height: 5,
    backgroundColor: BORDER,
    borderRadius: 3,
    marginHorizontal: 8,
  },
  scoreBarFill: {
    height: 5,
    borderRadius: 3,
  },
  scoreValue: {
    fontSize: 9,
    fontFamily: 'IBM Plex Sans Bold',
    width: 28,
    textAlign: 'right',
  },

  // ── List items ────────────────────────────────────────────────────────────
  listItem: {
    flexDirection: 'row',
    marginBottom: 5,
    gap: 6,
  },
  bullet: {
    fontSize: 9.5,
    color: ACCENT,
    marginTop: 0.5,
  },
  listText: {
    fontSize: 9.5,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 1.5,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: MUTED,
  },

  // ── Placeholder (for charts not yet implemented) ──────────────────────────
  placeholder: {
    backgroundColor: '#1A2538',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 4,
  },
  placeholderText: {
    fontSize: 8,
    color: MUTED,
    textAlign: 'center',
  },
});
