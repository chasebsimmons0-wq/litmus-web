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
    evidenceSource: 'Clinical practice guidelines; Cochrane overviews of exercise for chronic pain' },
  { id: 'pacing.activity-pacing', category: 'pacing', displayName: 'Activity pacing',
    evidenceNote: "Widely taught in pain services and commonly found helpful, but the trial evidence is thinner than its popularity suggests and 'pacing' is defined differently from study to study.",
    evidenceSource: 'Systematic reviews of activity pacing in chronic pain' },
  { id: 'sleep.sleep-schedule', category: 'sleep', displayName: 'A fixed sleep and wake time',
    evidenceNote: 'Sleep and pain influence each other in both directions, and poor sleep predicts worse pain the following day more reliably than the reverse. Sleep-focused treatment improves sleep clearly and pain more modestly.',
    evidenceSource: 'Reviews of sleep interventions in chronic pain populations' },
  { id: 'electrotherapy.tens-conventional', category: 'electrotherapy', displayName: 'TENS',
    evidenceNote: 'Evidence is mixed and generally low-certainty. Trials are small, often unblinded, and disagree with one another. Some people report clear relief; the average across studies is unimpressive.',
    evidenceSource: 'Cochrane Database of Systematic Reviews' },
  { id: 'thermal.heat', category: 'thermal', displayName: 'Heat',
    evidenceNote: 'Cheap, low-risk, and mostly studied for short-term relief rather than lasting change. Evidence for sustained benefit in long-standing pain is limited.',
    evidenceSource: 'Cochrane reviews of superficial heat and cold' },
  { id: 'mindbody.mindfulness-practice', category: 'mindBody', displayName: 'A daily mindfulness practice',
    evidenceNote: 'Mindfulness-based approaches show small to moderate improvements in how much pain interferes with life, often with less change in pain intensity itself. Effects on distress are generally clearer than effects on the pain.',
    evidenceSource: 'Meta-analyses of mindfulness-based interventions for chronic pain' },
  { id: 'mindbody.somatic-tracking', category: 'mindBody', displayName: 'Somatic tracking',
    evidenceNote: 'Attending to a sensation with curiosity rather than alarm, on the understanding that pain is produced by the nervous system and can be amplified by fear of it. This is the central technique in pain reprocessing therapy, which produced some of the strongest recent results in the field — though in a trial of people whose back pain had no clear structural cause, delivered by trained clinicians over several weeks. Doing it alone from an app is not the same thing, which is exactly why it is worth testing rather than assuming.',
    evidenceSource: 'Randomised trial of pain reprocessing therapy for chronic back pain, JAMA Psychiatry 2022' },
  { id: 'mindbody.graded-exposure', category: 'mindBody', displayName: 'Going back to one avoided movement',
    evidenceNote: 'Gradually returning to a specific movement you have been avoiding, at a level you can tolerate. Avoidance tends to shrink what you do faster than it protects you, and the fear itself contributes to the pain. Best chosen with a physio if there is any doubt about whether the movement is safe for you.',
    evidenceSource: 'Reviews of graded exposure and fear-avoidance in chronic musculoskeletal pain' },
  { id: 'manual.massage', category: 'manualTherapy', displayName: 'Massage',
    evidenceNote: 'Short-term relief is commonly reported; evidence for lasting change is weak, and studies are hard to blind.',
    evidenceSource: 'Cochrane reviews of massage for musculoskeletal pain' },
  { id: 'diet.caffeine-reduction', category: 'diet', displayName: 'Cutting back caffeine',
    evidenceNote: 'Studied mainly through its effect on sleep rather than on pain directly. There is no good evidence it reduces chronic pain by itself, which makes it an honest thing to actually test rather than assume.',
    evidenceSource: 'Reviews of caffeine and sleep quality' },
  { id: 'assistive.supportive-footwear', category: 'assistiveDevice', displayName: 'Different footwear or insoles',
    evidenceNote: 'Trial results are inconsistent and effects, where found, are small. A reasonable candidate for a personal test precisely because the average result says so little about any individual.',
    evidenceSource: 'Systematic reviews of foot orthoses for lower-limb and back pain' },
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
