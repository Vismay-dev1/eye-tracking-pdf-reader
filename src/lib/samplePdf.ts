import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const TITLE = 'The Science of Effortless Reading'

const PARAGRAPHS: string[] = [
  'Reading is one of the most remarkable things a human brain can do. With a single glance, a pattern of ink on a page becomes a voice, an idea, a memory. Yet the physical act of reading has barely changed in five hundred years: we hold a document, we move our eyes, and every few seconds our hand reaches out to turn a page or drag a scrollbar. This document is different — it was generated to be read hands-free, scrolled by nothing more than your gaze.',
  'Eye tracking sounds like science fiction, but the underlying principles are surprisingly approachable. A camera observes your face. A machine learning model locates the fine structure of your eyes — the corners of each eyelid and the centre of each iris — many times per second. Because the iris moves as your gaze moves, its displacement inside the eye socket is a remarkably good proxy for where on the screen you are looking.',
  'Raw iris positions are noisy, so two mathematical tools make them usable. The first is calibration: the system shows you dots at known positions on the screen and learns a polynomial function that maps your personal eye geometry to screen coordinates. No two faces are alike, and this learned mapping absorbs everything from the distance between your eyes to the tilt of your webcam.',
  'The second tool is the One Euro filter, a beautiful piece of signal processing from the research community. It smooths your gaze heavily when you are fixating on a word — so the cursor sits rock still while you read — but the instant your eyes jump in a fast saccade, the filter opens up and follows with almost no lag. Stability when you need it, speed when you demand it.',
  'Once the computer knows where you are looking, reading becomes interactive in entirely new ways. Look toward the bottom of the page and the document glides downward, faster the deeper you gaze into the scroll zone. Glance back at the top edge and it rewinds. A soft highlight can follow the very word your eyes rest upon, and if you get distracted by a notification, a single keystroke returns the page to exactly where your attention left off.',
  'There are accessibility implications here too. For readers with limited hand mobility, for musicians whose hands are busy on an instrument, for surgeons consulting a reference mid-procedure, or simply for anyone eating lunch with both hands — a document that scrolls itself is not a gimmick. It is a small but genuine widening of who gets to read comfortably.',
  'You might wonder about privacy, and you would be right to. Everything in this reader happens locally inside your browser. The face analysis runs on your own machine with your own GPU through WebGL. No video frame, no image of your face, and no gaze coordinate ever leaves your computer. Closing the tab releases the camera and forgets everything.',
  'For best results, sit an arm\'s length from the screen with even lighting on your face, and keep your head fairly still while letting your eyes do the travelling. If the gaze dot drifts — and it will, slowly, as you shift in your chair — recalibration takes less than half a minute. Accuracy also improves noticeably if you complete calibration while relaxed and looking naturally, rather than straining.',
  'Your eyes never move smoothly while you read. They hop in rapid jumps called saccades, each lasting twenty to forty milliseconds, and pause in fixations of roughly a quarter of a second during which the brain actually takes in words. A skilled adult reader makes three or four fixations per second. Gaze-aware software leverages this rhythm: it must be patient during a fixation and instant during a saccade, which is exactly what adaptive filtering gives us.',
  'Why does automatic scrolling feel so natural once you get used to it? Because scrolling was always a tax on attention. Every reach for the mouse wheel breaks your concentration for a fraction of a second, and those fractions add up across a long document. Studies of reading comprehension consistently show that interruptions, even tiny motor ones, carry a measurable cost. Removing the scrollbar removes the tax.',
  'Typography quietly shapes how gaze behavior works too. Line length matters enormously: around sixty to seventy-five characters per line lets your eyes return to the left margin without hunting for the next line. Generous line spacing prevents the classic double-take where your saccade lands back on the line you just finished. This document uses those rules — notice how rarely you lose your place even while the page moves.',
  'There is a long tradition of machines trying to match the reader\'s pace. Speed-reading courses of the nineteen-fifties used mechanical shutters that swept down the page. Teleprompters hired human operators whose whole job was to match the speaker\'s tempo. Software can now do this more gently: teleprompter mode in this reader scrolls at a constant, adjustable rate and politely pauses the moment you scroll by hand.',
  'Digital eye strain is the other side of the story. Screens encourage a reduced blink rate — from a healthy fifteen blinks per minute down to five or six — which dries the ocular surface and tires the focusing muscles. Gaze interfaces can actually help here: because your hands stay still and your posture stays open, many readers find they lean back, relax, and blink more naturally than when hunched over a trackpad.',
  'The word-under-gaze highlight deserves a mention of its own. It is not magic: the PDF carries an invisible text layer above the rendered page, and the reader simply asks, sixty times a second, which span of text lives beneath your current gaze point. Small ideas like this compound into an interface that feels attentive, almost considerate, without ever interrupting you.',
  'Researchers have studied gaze-driven reading since the nineteen-seventies. What changed recently is cost and convenience: the camera is already in your laptop, and the neural networks that once required a laboratory now run inside a browser tab. The democratisation of eye tracking is a quiet revolution in how humans and documents will interact over the coming decade.',
  'Where does this go next? Calibration-free tracking keeps improving as models learn from more diverse faces. Attention-aware documents could one day reflow themselves around the paragraph you are reading, dim the rest of the page to reduce distraction, or notice rereading as a sign of confusion and offer a simpler explanation. The document stops being a static object and becomes something closer to a conversation.',
  'So keep reading — and notice what is happening. You have not touched the mouse. You have not reached for the keyboard. If you are reading these words and the page is sliding gently beneath your eyes in time with your own pace, then the two of us, writer and machine, have succeeded. Happy hands-free reading.',
]

const ENDING = [
  'Tips',
  '· Glance at the bottom edge of the window to scroll down.',
  '· Glance at the top edge to scroll back up.',
  '· Press R at any time to jump back to the last word you looked at.',
  '· Press Space to pause or resume automatic scrolling.',
  '· Open Settings to tune sensitivity, scroll-zone size and themes.',
  '· If the gaze cursor drifts, press C to recalibrate in seconds.',
]

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (s: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Generates a multi-page, readable sample PDF entirely client-side. */
export async function generateSamplePdf(): Promise<File> {
  const doc = await PDFDocument.create()
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)

  const PAGE_W = 612 // US Letter
  const PAGE_H = 792
  const MARGIN = 72
  const BODY = 12
  const LEADING = 18.5
  const maxWidth = PAGE_W - MARGIN * 2

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) newPage()
  }

  // Title page header
  page.drawText('Oculis Reader', {
    x: MARGIN,
    y: y,
    size: 12,
    font: serifBold,
    color: rgb(0.35, 0.45, 0.65),
  })
  y -= 44
  const titleLines = wrapText(TITLE, serifBold, 26, maxWidth)
  for (const line of titleLines) {
    page.drawText(line, { x: MARGIN, y, size: 26, font: serifBold, color: rgb(0.1, 0.1, 0.15) })
    y -= 34
  }
  page.drawText('A hands-free reading companion — generated sample document', {
    x: MARGIN,
    y: y - 6,
    size: 13,
    font: serif,
    color: rgb(0.45, 0.45, 0.5),
  })
  y -= 60

  let paraNumber = 0
  for (const para of PARAGRAPHS) {
    paraNumber++
    const lines = wrapText(para, serif, BODY, maxWidth)
    for (let i = 0; i < lines.length; i++) {
      ensureSpace(LEADING)
      page.drawText(lines[i], {
        x: MARGIN,
        y,
        size: BODY,
        font: serif,
        color: rgb(0.12, 0.12, 0.14),
      })
      y -= LEADING
    }
    y -= LEADING * 0.7
  }

  ensureSpace(LEADING * 10)
  y -= LEADING
  page.drawText(ENDING[0], { x: MARGIN, y, size: 16, font: serifBold, color: rgb(0.1, 0.1, 0.15) })
  y -= LEADING * 1.6
  for (let i = 1; i < ENDING.length; i++) {
    ensureSpace(LEADING)
    page.drawText(ENDING[i], { x: MARGIN, y, size: BODY, font: serif, color: rgb(0.2, 0.2, 0.25) })
    y -= LEADING
  }

  // Page numbers
  const count = doc.getPageCount()
  for (let i = 0; i < count; i++) {
    const p = doc.getPage(i)
    p.drawText(`— ${i + 1} —`, {
      x: PAGE_W / 2 - serif.widthOfTextAtSize(`— ${i + 1} —`, 9) / 2,
      y: 36,
      size: 9,
      font: serif,
      color: rgb(0.5, 0.5, 0.55),
    })
  }

  doc.setTitle(TITLE)
  doc.setAuthor('Oculis Reader')
  const bytes = await doc.save()
  return new File([bytes.slice()], 'sample-reading-companion.pdf', { type: 'application/pdf' })
}
