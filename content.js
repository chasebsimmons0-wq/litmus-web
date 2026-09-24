// Fixed content, copied from PainCore so the web app says exactly what the native app
// says. If a string changes there it changes here.

export const SITES = [
  ['head', 'Head'], ['jaw', 'Jaw or face'], ['neck', 'Neck'], ['shoulders', 'Shoulders'],
  ['upperBack', 'Upper back'], ['lowerBack', 'Lower back'], ['chest', 'Chest or ribs'],
  ['abdomen', 'Abdomen'], ['pelvis', 'Pelvis'], ['hips', 'Hips'], ['arms', 'Arms'],
  ['hands', 'Hands or wrists'], ['legs', 'Legs'], ['knees', 'Knees'], ['feet', 'Feet or ankles'],
  ['widespread', 'All over'],
];

export const QUALITIES = [
  ['aching', 'Aching'], ['stiff', 'Stiff'], ['throbbing', 'Throbbing'], ['burning', 'Burning'],
  ['shooting', 'Shooting'], ['electric', 'Electric'], ['tingling', 'Pins and needles'],
  ['numb', 'Numb'], ['tender', 'Tender to touch'], ['crushing', 'Crushing'],
];
export const NERVE_QUALITIES = new Set(['burning', 'shooting', 'electric', 'tingling', 'numb']);

export const FACTORS = [
  ['brokenSleep', 'Sleep is broken most nights'],
  ['pushCrashPattern', 'I push hard, then crash'],
  ['mostlyResting', "I'm mostly resting these days"],
  ['lowMood', 'Mood has been low'],
  ['highStress', 'Stress has been high'],
  ['sensitivityToTouchLightSound', 'Sensitive to touch, light or sound'],
  ['fatigue', "Tired in a way sleep doesn't fix"],
];

export const RED_FLAGS = [
  ['unexplainedWeightLoss', "Weight loss I can't explain", false],
  ['feverOrNightSweats', 'Fever or night sweats alongside the pain', false],
  ['newWeaknessOrNumbness', 'New weakness or numbness in a limb', true],
  ['bladderOrBowelChange', 'A change in bladder or bowel control', true],
  ['unrelentingNightPain', "Pain that wakes me every night, whatever position I'm in", false],
  ['historyOfCancer', 'A history of cancer', false],
  ['recentSignificantTrauma', 'A significant fall or accident recently', false],
];

export const DIAGNOSES = [
  'Chronic low back pain', 'Neck pain', 'Osteoarthritis', 'Rheumatoid arthritis',
  'Fibromyalgia', 'Neuropathic pain', 'Sciatica', 'Migraine', 'Endometriosis',
  'Irritable bowel syndrome', 'Complex regional pain syndrome', 'Hypermobility or EDS',
  'Post-surgical pain', 'No clear diagnosis yet',
];

// Full outcome definitions, as the native app encodes them into an export.
export const OUTCOME_RECORDS = {
  'pain.intensity-nrs-11': {
    id: 'pain.intensity-nrs-11', displayName: 'Average daily pain',
    prompt: 'How has your pain been today?', lowerBound: 0, upperBound: 10, unit: 'points',
    lowerIsBetter: true, publishedImportantDifference: 2, publishedTrivialDifference: 1,
    evidenceNote: 'A change of about 2 points on an 11-point scale is the commonly cited minimal important difference for chronic pain intensity.',
  },
  'pain.interference-nrs-11': {
    id: 'pain.interference-nrs-11', displayName: 'How much pain interfered with your day',
    prompt: 'How much did pain get in the way of what you did today?', lowerBound: 0, upperBound: 10,
    unit: 'points', lowerIsBetter: true,
    evidenceNote: 'Interference items of this kind are standard in pain measurement, but no single minimal important difference is well enough established to quote, so the threshold is set from your own variability.',
  },
  'sleep.quality-nrs-11': {
    id: 'sleep.quality-nrs-11', displayName: 'Sleep quality',
    prompt: 'How well did you sleep last night?', lowerBound: 0, upperBound: 10, unit: 'points',
    lowerIsBetter: false,
    evidenceNote: 'Often steadier day to day than a pain rating, and frequently what changes first.',
  },
};

export const USUAL_CARE = { id: 'control.usual-care', category: 'other', displayName: 'Usual care (no added intervention)' };

export const LIBRARY = [
  { id: 'exercise.graded-activity', category: 'physicalExercise', displayName: 'Graded activity or exercise',
    evidenceNote: 'The most consistently recommended approach across clinical guidelines for long-standing musculoskeletal pain. Average benefits are real but modest, and which type of exercise matters less than doing it regularly.',
    evidenceSource: 'Clinical practice guidelines; Cochrane overviews of exercise for chronic pain',
    trialTip: "Pick one kind of activity and an amount you could manage even on a bad day, and do that same amount on every on-day. Building up during the trial would blur the comparison." },
  { id: 'pacing.activity-pacing', category: 'pacing', displayName: 'Activity pacing',
    evidenceNote: "Widely taught in pain services and commonly found helpful, but the trial evidence is thinner than its popularity suggests and 'pacing' is defined differently from study to study.",
    evidenceSource: 'Systematic reviews of activity pacing in chronic pain',
    trialTip: "Set your daily limits before you start and keep to them on on-days, good day or bad. Off-days are simply your usual pattern." },
  { id: 'sleep.sleep-schedule', category: 'sleep', displayName: 'A fixed sleep and wake time',
    evidenceNote: 'Sleep and pain influence each other in both directions, and poor sleep predicts worse pain the following day more reliably than the reverse. Sleep-focused treatment improves sleep clearly and pain more modestly.',
    evidenceSource: 'Reviews of sleep interventions in chronic pain populations',
    trialTip: "Choose a wake time you can keep every day, weekends included, during on-blocks. Sleep changes can take a few days to show, so longer blocks suit this one." },
  { id: 'electrotherapy.tens-conventional', category: 'electrotherapy', displayName: 'TENS',
    evidenceNote: 'Evidence is mixed and generally low-certainty. Trials are small, often unblinded, and disagree with one another. Some people report clear relief; the average across studies is unimpressive.',
    evidenceSource: 'Cochrane Database of Systematic Reviews',
    trialTip: "Keep the settings, pad placement and session length the same every on-day. You'll know when it's on, so expectation can't be ruled out — the result says so." },
  { id: 'thermal.heat', category: 'thermal', displayName: 'Heat',
    evidenceNote: 'Cheap, low-risk, and mostly studied for short-term relief rather than lasting change. Evidence for sustained benefit in long-standing pain is limited.',
    evidenceSource: 'Cochrane reviews of superficial heat and cold',
    trialTip: "Same method, same length, at about the same time each on-day — for example 20 minutes in the evening." },
  { id: 'mindbody.mindfulness-practice', category: 'mindBody', displayName: 'A daily mindfulness practice',
    evidenceNote: 'Mindfulness-based approaches show small to moderate improvements in how much pain interferes with life, often with less change in pain intensity itself. Effects on distress are generally clearer than effects on the pain.',
    evidenceSource: 'Meta-analyses of mindfulness-based interventions for chronic pain',
    trialTip: "A fixed practice of the same length each on-day. Its effects often show more in how much pain gets in the way than in the pain score, so that measure may suit it better." },
  { id: 'mindbody.somatic-tracking', category: 'mindBody', displayName: 'Somatic tracking',
    evidenceNote: 'Attending to a sensation with curiosity rather than alarm, on the understanding that pain is produced by the nervous system and can be amplified by fear of it. This is the central technique in pain reprocessing therapy, which produced some of the strongest recent results in the field — though in a trial of people whose back pain had no clear structural cause, delivered by trained clinicians over several weeks. Doing it alone from an app is not the same thing, which is exactly why it is worth testing rather than assuming.',
    evidenceSource: 'Randomised trial of pain reprocessing therapy for chronic back pain, JAMA Psychiatry 2022',
    trialTip: "A short practice at a set time each on-day. Effects may build slowly, so longer blocks give it a fairer chance." },
  { id: 'mindbody.graded-exposure', category: 'mindBody', displayName: 'Going back to one avoided movement',
    evidenceNote: 'Gradually returning to a specific movement you have been avoiding, at a level you can tolerate. Avoidance tends to shrink what you do faster than it protects you, and the fear itself contributes to the pain. Best chosen with a physio if there is any doubt about whether the movement is safe for you.',
    evidenceSource: 'Reviews of graded exposure and fear-avoidance in chronic musculoskeletal pain',
    trialTip: "The same chosen movement, at a level you can tolerate, on on-days only. If there's any doubt about whether it's safe for you, check with a physio first." },
  { id: 'manual.massage', category: 'manualTherapy', displayName: 'Massage',
    evidenceNote: 'Short-term relief is commonly reported; evidence for lasting change is weak, and studies are hard to blind.',
    evidenceSource: 'Cochrane reviews of massage for musculoskeletal pain',
    trialTip: "The same kind and length of massage on each on-day. Appointments are hard to switch on and off week by week, so self-massage is often easier to test." },
  { id: 'diet.caffeine-reduction', category: 'diet', displayName: 'Cutting back caffeine',
    evidenceNote: 'Studied mainly through its effect on sleep rather than on pain directly. There is no good evidence it reduces chronic pain by itself, which makes it an honest thing to actually test rather than assume.',
    evidenceSource: 'Reviews of caffeine and sleep quality',
    trialTip: "A set lower amount on on-days and your usual amount otherwise. Cutting down suddenly can bring headaches for a few days, so quiet days between blocks help." },
  { id: 'assistive.supportive-footwear', category: 'assistiveDevice', displayName: 'Different footwear or insoles',
    evidenceNote: 'Trial results are inconsistent and effects, where found, are small. A reasonable candidate for a personal test precisely because the average result says so little about any individual.',
    evidenceSource: 'Systematic reviews of foot orthoses for lower-limb and back pain',
    trialTip: "Wear the new footwear or insoles all day on on-days, and your usual ones on off-days." },
];

export function customIntervention(name) {
  const slug = name.toLowerCase().replaceAll(' ', '-').replace(/[^\p{L}\p{N}-]/gu, '');
  return { id: 'custom.' + slug, category: 'other', displayName: name };
}

export function widespreadFeatureCount(p) {
  let n = 0;
  if (p.sites.includes('widespread') || p.sites.length >= 4) n++;
  for (const f of ['brokenSleep', 'fatigue', 'sensitivityToTouchLightSound']) if (p.factors.includes(f)) n++;
  return n;
}

// Orders a menu; never recommends. Mirrors PainProfile.suggestedOrder.
export function suggestedOrder(p) {
  const hasRedFlags = p.redFlags.length > 0;
  const wide = widespreadFeatureCount(p);
  const score = (i) => {
    let s = 0;
    if (p.factors.includes('brokenSleep') && i.category === 'sleep') s += 3;
    if (p.factors.includes('pushCrashPattern') && i.category === 'pacing') s += 3;
    if (p.factors.includes('mostlyResting') && i.category === 'physicalExercise') s += 2;
    if (wide >= 2) {
      if (i.category === 'sleep' || i.category === 'pacing') s += 2;
      if (i.category === 'mindBody') s += 1;
    }
    return s;
  };
  return LIBRARY
    .filter((i) => !p.alreadyTried.includes(i.id))
    .filter((i) => !(hasRedFlags && (i.category === 'physicalExercise' || i.category === 'mindBody')))
    .map((i, k) => [i, score(i), k])
    .sort((x, y) => y[1] - x[1] || x[2] - y[2])
    .map(([i]) => i);
}

export const PRACTICES = [
  {
    id: 'practice.slow-breathing', title: 'Slower breathing', subtitle: 'Four minutes',
    note: "Breathing out for longer than you breathe in settles the body's alarm response. It won't change the pain itself, and it isn't meant to — it's for the minutes when everything is loud and you need something to do with your attention.",
    steps: [
      ['Sit or lie however hurts least. Nothing here needs you to be comfortable.', 15],
      ["Let your breath out slowly. Don't force it.", 10],
      ['Breathe in through your nose for four.', 4],
      ['Out, slowly, for six.', 6],
      ['In for four.', 4],
      ['Out for six.', 6],
      ['Keep going at that pace. In for four, out for six.', 60],
      ["If your mind wanders off, that's what minds do. Come back when you notice.", 60],
      ['Keep going. Nothing else to get right.', 60],
      ['Let the count go. Breathe however you like.', 20],
      ["That's it. Nothing to record unless you want to.", 10],
    ],
  },
  {
    id: 'practice.body-scan', title: 'A short body scan', subtitle: 'Six minutes',
    note: "Moving attention deliberately around the body, including the parts that hurt and the parts that don't. Mindfulness-based approaches tend to change how much pain interferes with life more than they change its intensity — worth knowing before you start, so it isn't judged against the wrong thing.",
    steps: [
      ['Settle somewhere you can stay for a few minutes.', 15],
      ['Start with your feet. Notice whatever is there — warmth, pressure, nothing much.', 40],
      ['Move up to your lower legs and knees.', 40],
      ['Your hips and lower back.', 40],
      ["If this is where it hurts, you don't have to stay. Move on whenever you want.", 30],
      ['Your stomach and chest. Notice them moving as you breathe.', 40],
      ['Your hands, then your arms.', 40],
      ["Your shoulders and neck — often holding more than you'd think.", 40],
      ['Your jaw, your face, the space behind your eyes.', 40],
      ['Now the whole body at once, as one thing.', 40],
      ["Come back when you're ready.", 15],
    ],
  },
  {
    id: 'practice.getting-through', title: 'Getting through a bad hour', subtitle: 'Three minutes',
    note: "For a flare. It doesn't try to reduce the pain, because in the middle of a flare that is usually not available. It's for keeping the hour survivable and stopping the spiral about what this means.",
    steps: [
      ["You don't have to fix this right now. The next few minutes are the only thing on.", 20],
      ["Find the least bad position available. That's the whole goal.", 30],
      ['Breathe out slowly, a few times. Longer out than in.', 30],
      ['Name three things you can see. Out loud if that helps.', 30],
      ['This is a flare. You have had them before and they have ended before.', 25],
      ["Nothing about today's score says anything about how the trial is going.", 25],
      ['Log the number when you can. A rough one is fine. Then put it down.', 20],
    ],
  },
];

export const PAIN_RAMP = [
  '#EFEAE0', '#EDE3D5', '#EBDCC9', '#E8D3BB', '#E4C9AC', '#DFBE9C',
  '#D9B28B', '#D2A47A', '#C99569', '#BF8558', '#B37447',
];

// Pain education, in the same voice as the rest of the app: explaining, never
// treating. Each lesson is short enough to read on a bad day. Sources are named so a
// reader (or a clinician) can check them.
export const LESSONS = [
  {
    id: 'lesson.pain-is-real', title: 'Your pain is real, and it’s made by your nervous system', minutes: 2,
    paras: [
      'Pain isn’t a reading taken from your tissues. It’s something your brain and nervous system produce, as a protective alarm, from everything they know: signals from the body, but also past experience, stress, sleep and what you expect to happen.',
      'That doesn’t make it imagined. All pain works this way — a broken bone too. It means the alarm can be turned up or down by more than just what’s happening in the tissue.',
      'This is also why two people with the same scan can hurt very differently, and why the same movement can hurt more on a stressed, sleepless week.',
    ],
    source: 'International Association for the Study of Pain, revised definition of pain (2020)',
  },
  {
    id: 'lesson.sensitisation', title: 'Why pain can outlast an injury', minutes: 3,
    paras: [
      'Most tissues heal within weeks or months. When pain carries on much longer, the nervous system itself has often become more sensitive: the alarm goes off sooner, louder, and over a wider area than it used to.',
      'Researchers call this sensitisation. A useful picture is a volume knob that’s been turned up. The pain is fully real; it has simply stopped being a reliable measure of damage.',
      'The hopeful part is that sensitivity can change in both directions. Sleep, stress, activity and understanding all nudge the volume — which is exactly why testing one of them at a time can be worthwhile.',
    ],
    source: 'Reviews of central sensitisation in chronic pain; NICE guideline NG193 (2021)',
  },
  {
    id: 'lesson.hurt-harm', title: 'Hurt doesn’t always mean harm', minutes: 2,
    paras: [
      'In long-standing pain, a flare during or after activity usually means the alarm is sensitive, not that you’ve done new damage. That distinction matters, because avoiding everything that hurts tends to shrink life faster than it protects the body.',
      'It doesn’t mean pushing through everything. New or different pain, pain after a fall, or any of the warning signs from the safety check should be looked at by a clinician.',
      'If you’re unsure whether a particular movement is safe for you, that’s a good question to bring to a physio or doctor.',
    ],
    source: 'Pain neuroscience education literature; reviews of fear-avoidance in chronic pain',
  },
  {
    id: 'lesson.pacing', title: 'Pacing: steady beats boom and bust', minutes: 3,
    paras: [
      'On a good day it’s natural to catch up on everything. Then comes the crash, a few days of recovery, and the cycle repeats. Over months, the good days often get fewer.',
      'Pacing means doing roughly the same amount on good days and bad: finding a level you can manage even on a harder day, splitting tasks up, and building up slowly from there.',
      'It’s widely taught and many people find it helps, though the research is thinner than its popularity suggests. That makes it a good candidate to test for yourself.',
    ],
    source: 'Systematic reviews of activity pacing in chronic pain',
  },
  {
    id: 'lesson.flares', title: 'Planning for a flare', minutes: 2,
    paras: [
      'Flares are part of living with chronic pain, not a sign that everything has failed. They are also when it’s hardest to think clearly, so the best time to plan for one is on a calmer day.',
      'A flare plan is a short note to your future self: the early signs, what usually helps, what you can safely drop for a few days, and who to tell.',
      'You can write yours below. On a day you mark as a flare, Litmus will show it to you.',
    ],
    source: 'Self-management guidance used in pain services',
    action: 'flarePlan',
  },
  {
    id: 'lesson.sleep', title: 'Sleep and pain feed each other', minutes: 2,
    paras: [
      'Pain makes sleep harder, and a poor night makes the next day’s pain worse. Studies that follow people day by day find the second link is often the stronger one.',
      'Regular sleep and wake times are one of the simplest things to change, and one you can test here. Sleep-focused treatment tends to improve sleep clearly and pain more modestly.',
    ],
    source: 'Reviews of sleep and pain in chronic pain populations',
  },
  {
    id: 'lesson.not-settled', title: 'Why a result can come back “not settled”', minutes: 3,
    paras: [
      'Pain moves around a lot from day to day on its own. To say something changed it, Litmus has to see a difference bigger than that ordinary movement — and see it again and again across the on and off weeks.',
      'When a trial says “not settled”, it isn’t a failure. It means the honest answer is “we can’t tell yet”: too few days, a flare that landed unevenly, or an effect too small to separate from the noise.',
      'A confident wrong answer would be worse. Telling you something didn’t work when it did could lead you to drop something that helps. The result screen always says what a cleaner re-run would look like.',
    ],
    source: 'How the n-of-1 analysis in this app works',
  },
  {
    id: 'lesson.appointments', title: 'Getting more from a short appointment', minutes: 2,
    paras: [
      'Appointments are short, and it’s easy to forget the one thing you meant to say. Bringing a written summary lets a clinician see months of history in a couple of minutes.',
      'Your care record collects what you’ve reported, what you’ve tested and what it showed, your medications, and questions to raise. Add your own questions as they come to you.',
    ],
    source: 'Patient-held records and question prompt lists in chronic illness care',
    action: 'record',
  },
];

// Routes to people, not just pages. Crisis lines live beside these in the app.
export const SUPPORT = [
  ['Your GP or family doctor', 'A good first stop, and the usual route to a specialist pain service or physiotherapy.'],
  ['Pain BC (Canada)', 'painbc.ca — education, a coaching phone line and peer support.', 'https://painbc.ca'],
  ['U.S. Pain Foundation', 'uspainfoundation.org — support groups and resources.', 'https://uspainfoundation.org'],
  ['Pain Concern (UK)', 'painconcern.org.uk — a helpline and information.', 'https://painconcern.org.uk'],
];
