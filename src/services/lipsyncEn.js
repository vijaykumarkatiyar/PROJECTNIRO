/**
 * English lip-sync processor — text to Oculus viseme conversion
 * Adapted from met4citizen/TalkingHead (MIT License)
 * Original author: Mika Suominen
 * Rules adapted from NRL Report 7948 (1976)
 */

class LipsyncEn {
  constructor() {
    this.rules = {
      'A': [
        "[A] =aa", " [ARE] =aa RR", " [AR]O=aa RR", "[AR]#=E RR",
        " ^[AS]#=E SS", "[A]WA=aa", "[AW]=aa", " :[ANY]=E nn I",
        "[A]^+#=E", "#:[ALLY]=aa nn I", " [AL]#=aa nn", "[AGAIN]=aa kk E nn",
        "#:[AG]E=I kk", "[A]^+:#=aa", ":[A]^+ =E", "[A]^%=E",
        " [ARR]=aa RR", "[ARR]=aa RR", " :[AR] =aa RR", "[AR] =E",
        "[AR]=aa RR", "[AIR]=E RR", "[AI]=E", "[AY]=E", "[AU]=aa",
        "#:[AL] =aa nn", "#:[ALS] =aa nn SS", "[ALK]=aa kk", "[AL]^=aa nn",
        " :[ABLE]=E PP aa nn", "[ABLE]=aa PP aa nn", "[ANG]+=E nn kk", "[A]=aa"
      ],
      'B': [
        " [BE]^#=PP I", "[BEING]=PP I I nn", " [BOTH] =PP O TH",
        " [BUS]#=PP I SS", "[BUIL]=PP I nn", "[B]=PP"
      ],
      'C': [
        " [CH]^=kk", "^E[CH]=kk", "[CH]=CH", " S[CI]#=SS aa",
        "[CI]A=SS", "[CI]O=SS", "[CI]EN=SS", "[C]+=SS",
        "[CK]=kk", "[COM]%=kk aa PP", "[C]=kk"
      ],
      'D': [
        "#:[DED] =DD I DD", ".E[D] =DD", "#^:E[D] =DD", " [DE]^#=DD I",
        " [DO] =DD U", " [DOES]=DD aa SS", " [DOING]=DD U I nn",
        " [DOW]=DD aa", "[DU]A=kk U", "[D]=DD"
      ],
      'E': [
        "#:[E] =", "'^:[E] =", " :[E] =I", "#[ED] =DD", "#:[E]D =",
        "[EV]ER=E FF", "[E]^%=I", "[ERI]#=I RR I", "[ERI]=E RR I",
        "#:[ER]#=E", "[ER]#=E RR", "[ER]=E", " [EVEN]=I FF E nn",
        "#:[E]W=", "@[EW]=U", "[EW]=I U", "[E]O=I", "#:&[ES] =I SS",
        "#:[E]S =", "#:[ELY] =nn I", "#:[EMENT]=PP E nn DD", "[EFUL]=FF U nn",
        "[EE]=I", "[EARN]=E nn", " [EAR]^=E", "[EAD]=E DD", "#:[EA] =I aa",
        "[EA]SU=E", "[EA]=I", "[EIGH]=E", "[EI]=I", " [EYE]=aa", "[EY]=I",
        "[EU]=I U", "[E]=E"
      ],
      'F': [
        "[FUL]=FF U nn", "[F]=FF"
      ],
      'G': [
        "[GIV]=kk I FF", " [G]I^=kk", "[GE]T=kk E", "SU[GGES]=kk kk E SS",
        "[GG]=kk", " B#[G]=kk", "[G]+=kk", "[GREAT]=kk RR E DD",
        "#[GH]=", "[G]=kk"
      ],
      'H': [
        " [HAV]=I aa FF", " [HERE]=I I RR", " [HOUR]=aa EE", "[HOW]=I aa",
        "[H]#=I", "[H]="
      ],
      'I': [
        " [IN]=I nn", " [I] =aa", "[IN]D=aa nn", "[IER]=I E",
        "#:R[IED] =I DD", "[IED] =aa DD", "[IEN]=I E nn", "[IE]T=aa E",
        " :[I]%=aa", "[I]%=I", "[IE]=I", "[I]^+:#=I", "[IR]#=aa RR",
        "[IZ]%=aa SS", "[IS]%=aa SS", "[I]D%=aa", "+^[I]^+=I",
        "[I]T%=aa", "#^:[I]^+=I", "[I]^+=aa", "[IR]=E", "[IGH]=aa",
        "[ILD]=aa nn DD", "[IGN] =aa nn", "[IGN]^=aa nn", "[IGN]%=aa nn",
        "[IQUE]=I kk", "[I]=I"
      ],
      'J': ["[J]=kk"],
      'K': [" [K]N=", "[K]=kk"],
      'L': ["[LO]C#=nn O", "L[L]=", "#^:[L]%=aa nn", "[LEAD]=nn I DD", "[L]=nn"],
      'M': ["[MOV]=PP U FF", "[M]=PP"],
      'N': [
        "E[NG]+=nn kk", "[NG]R=nn kk", "[NG]#=nn kk", "[NGL]%=nn kk aa nn",
        "[NG]=nn", "[NK]=nn kk", " [NOW] =nn aa", "[N]=nn"
      ],
      'O': [
        "[OF] =aa FF", "[OROUGH]=E O", "#:[OR] =E", "#:[ORS] =E SS",
        "[OR]=aa RR", " [ONE]=FF aa nn", "[OW]=O", " [OVER]=O FF E",
        "[OV]=aa FF", "[O]^%=O", "[O]^EN=O", "[O]^I#=O", "[OL]D=O nn",
        "[OUGHT]=aa DD", "[OUGH]=aa FF", " [OU]=aa", "H[OU]S#=aa",
        "[OUS]=aa SS", "[OUR]=aa RR", "[OULD]=U DD", "^[OU]^L=aa",
        "[OUP]=U OO", "[OU]=aa", "[OY]=O", "[OING]=O I nn", "[OI]=O",
        "[OOR]=aa RR", "[OOK]=U kk", "[OOD]=U DD", "[OO]=U", "[O]E=O",
        "[O] =O", "[OA]=O", " [ONLY]=O nn nn I", " [ONCE]=FF aa nn SS",
        "[ON'T]=O nn DD", "C[O]N=aa", "[O]NG=aa", " ^:[O]N=aa",
        "I[ON]=aa nn", "#:[ON] =aa nn", "#^[ON]=aa nn", "[O]ST =O",
        "[OF]^=aa FF", "[OTHER]=aa TH E", "[OSS] =aa SS", "#^:[OM]=aa PP",
        "[O]=aa"
      ],
      'P': [
        "[PH]=FF", "[PEOP]=PP I PP", "[POW]=PP aa", "[PUT] =PP U DD",
        "[P]=PP"
      ],
      'Q': ["[QUAR]=kk FF aa RR", "[QU]=kk FF", "[Q]=kk"],
      'R': [" [RE]^#=RR I", "[R]=RR"],
      'S': [
        "[SH]=SS", "#[SION]=SS aa nn", "[SOME]=SS aa PP", "#[SUR]#=SS E",
        "[SUR]#=SS E", "#[SU]#=SS U", "#[SSU]#=SS U", "#[SED] =SS DD",
        "#[S]#=SS", "[SAID]=SS E DD", "^[SION]=SS aa nn", "[S]S=",
        ".[S] =SS", "#:.E[S] =SS", "#^:##[S] =SS", "#^:#[S] =SS",
        "U[S] =SS", " :#[S] =SS", " [SCH]=SS kk", "[S]C+=",
        "#[SM]=SS PP", "#[SN]'=SS aa nn", "[S]=SS"
      ],
      'T': [
        " [THE] =TH aa", "[TO] =DD U", "[THAT] =TH aa DD", " [THIS] =TH I SS",
        " [THEY]=TH E", " [THERE]=TH E RR", "[THER]=TH E", "[THEIR]=TH E RR",
        " [THAN] =TH aa nn", " [THEM] =TH E PP", "[THESE] =TH I SS",
        " [THEN]=TH E nn", "[THROUGH]=TH RR U", "[THOSE]=TH O SS",
        "[THOUGH] =TH O", " [THUS]=TH aa SS", "[TH]=TH", "#:[TED] =DD I DD",
        "S[TI]#N=CH", "[TI]O=SS", "[TI]A=SS", "[TIEN]=SS aa nn",
        "[TUR]#=CH E", "[TU]A=CH U", " [TWO]=DD U", "[T]=DD"
      ],
      'U': [
        " [UN]I=I U nn", " [UN]=aa nn", " [UPON]=aa PP aa nn",
        "@[UR]#=U RR", "[UR]#=I U RR", "[UR]=E", "[U]^ =aa",
        "[U]^^=aa", "[UY]=aa", " G[U]#=", "G[U]%=", "G[U]#=FF",
        "#N[U]=I U", "@[U]=I", "[U]=I U"
      ],
      'V': ["[VIEW]=FF I U", "[V]=FF"],
      'W': [
        " [WERE]=FF E", "[WA]S=FF aa", "[WA]T=FF aa", "[WHERE]=FF E RR",
        "[WHAT]=FF aa DD", "[WHOL]=I O nn", "[WHO]=I U", "[WH]=FF",
        "[WAR]=FF aa RR", "[WOR]^=FF E", "[WR]=RR", "[W]=FF"
      ],
      'X': [" [X]=SS", "[X]=kk SS"],
      'Y': [
        "[YOUNG]=I aa nn", " [YOU]=I U", " [YES]=I E SS", " [Y]=I",
        "#^:[Y] =I", "#^:[Y]I=I", " :[Y] =aa", " :[Y]#=aa",
        " :[Y]^+:#=I", " :[Y]^#=I", "[Y]=I"
      ],
      'Z': ["[Z]=SS"]
    }

    const ops = {
      '#': '[AEIOUY]+',
      '.': '[BDVGJLMNRWZ]',
      '%': '(?:ER|E|ES|ED|ING|ELY)',
      '&': '(?:[SCGZXJ]|CH|SH)',
      '@': '(?:[TSRDLZNJ]|TH|CH|SH)',
      '^': '[BCDFGHJKLMNPQRSTVWXZ]',
      '+': '[EIY]',
      ':': '[BCDFGHJKLMNPQRSTVWXZ]*',
      ' ': '\\b'
    }

    // Convert rules to regex
    Object.keys(this.rules).forEach(key => {
      this.rules[key] = this.rules[key].map(rule => {
        const posL = rule.indexOf('[')
        const posR = rule.indexOf(']')
        const posE = rule.indexOf('=')
        const strLeft = rule.substring(0, posL)
        const strLetters = rule.substring(posL + 1, posR)
        const strRight = rule.substring(posR + 1, posE)
        const strVisemes = rule.substring(posE + 1)

        const o = { regex: '', move: 0, visemes: [] }
        let exp = ''
        exp += [...strLeft].map(x => ops[x] || x).join('')
        const ctxLetters = [...strLetters]
        ctxLetters[0] = ctxLetters[0].toLowerCase()
        exp += ctxLetters.join('')
        o.move = ctxLetters.length
        exp += [...strRight].map(x => ops[x] || x).join('')
        o.regex = new RegExp(exp)

        if (strVisemes.length) {
          strVisemes.split(' ').forEach(viseme => {
            o.visemes.push(viseme)
          })
        }
        return o
      })
    })

    this.visemeDurations = {
      'aa': 0.95, 'E': 0.90, 'I': 0.92, 'O': 0.96, 'U': 0.95, 'PP': 1.08,
      'SS': 1.23, 'TH': 1, 'DD': 1.05, 'FF': 1.00, 'kk': 1.21, 'nn': 0.88,
      'RR': 0.88, 'CH': 1.05, 'sil': 1
    }

    this.specialDurations = { ' ': 1, ',': 3, '-': 0.5, "'": 0.5 }
  }

  /**
   * Convert a word to Oculus LipSync visemes with relative timing
   * @param {string} w - text to convert
   * @returns {{ visemes: string[], times: number[], durations: number[] }}
   */
  wordsToVisemes(w) {
    const o = { words: w.toUpperCase(), visemes: [], times: [], durations: [], i: 0 }
    let t = 0

    const chars = [...o.words]
    while (o.i < chars.length) {
      const c = chars[o.i]
      const ruleset = this.rules[c]
      if (ruleset) {
        let matched = false
        for (let i = 0; i < ruleset.length; i++) {
          const rule = ruleset[i]
          const test = o.words.substring(0, o.i) + c.toLowerCase() + o.words.substring(o.i + 1)
          const matches = test.match(rule.regex)
          if (matches) {
            rule.visemes.forEach(viseme => {
              if (o.visemes.length && o.visemes[o.visemes.length - 1] === viseme) {
                const d = 0.7 * (this.visemeDurations[viseme] || 1)
                o.durations[o.durations.length - 1] += d
                t += d
              } else {
                const d = this.visemeDurations[viseme] || 1
                o.visemes.push(viseme)
                o.times.push(t)
                o.durations.push(d)
                t += d
              }
            })
            o.i += rule.move
            matched = true
            break
          }
        }
        if (!matched) o.i++
      } else {
        o.i++
        t += this.specialDurations[c] || 0
      }
    }

    return o
  }
}

// Singleton instance
const lipsyncEn = new LipsyncEn()

/**
 * Generate a viseme timeline from text, scaled to a target duration.
 * @param {string} text - The text to lip-sync
 * @param {number} durationMs - Estimated speech duration in ms
 * @returns {{ visemes: string[], times: number[], durations: number[] }} - times/durations in ms
 */
export function textToVisemeTimeline(text, durationMs) {
  // Process each word and concatenate viseme sequences
  const words = text.replace(/[^\w\s',.-]/g, '').split(/\s+/).filter(Boolean)
  const allVisemes = []
  const allTimes = []
  const allDurations = []
  let totalRelative = 0

  for (const word of words) {
    const result = lipsyncEn.wordsToVisemes(word)
    for (let i = 0; i < result.visemes.length; i++) {
      allVisemes.push(result.visemes[i])
      allTimes.push(totalRelative + result.times[i])
      allDurations.push(result.durations[i])
    }
    // Total relative time for this word
    if (result.times.length > 0) {
      totalRelative += result.times[result.times.length - 1] + result.durations[result.durations.length - 1]
    }
    // Add word gap
    totalRelative += 1.0
  }

  // Scale relative times to actual ms duration
  if (totalRelative <= 0) return { visemes: ['sil'], times: [0], durations: [durationMs] }

  const scale = durationMs / totalRelative
  return {
    visemes: allVisemes,
    times: allTimes.map(t => t * scale),
    durations: allDurations.map(d => d * scale)
  }
}

// Map TalkingHead viseme codes to the morph target names in our GLB model
export const VISEME_TO_MORPH = {
  'aa': 'viseme_aa',
  'E': 'viseme_e',
  'I': 'viseme_i',
  'O': 'viseme_o',
  'U': 'viseme_u',
  'PP': 'viseme_pp',
  'SS': 'viseme_ss',
  'TH': 'viseme_th',
  'CH': 'viseme_ch',
  'FF': 'viseme_ff',
  'kk': 'viseme_kk',
  'nn': 'viseme_nn',
  'RR': 'viseme_rr',
  'DD': 'viseme_dd',
  'sil': 'viseme_sil',
}
