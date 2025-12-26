// Mad libs-style caption generation for realistic stock photo captions
// Templates with variable substitution for generating variant but realistic captions

export interface CaptionVariables {
  person: string[];
  action: string[];
  location: string[];
  time: string[];
  emotion: string[];
  doing: string[];
  object: string[];
  activity: string[];
  setting: string[];
  with: string[];
  pose: string[];
  style: string[];
}

// Variable pools - ~100 options each for 12 variables
export const variables: CaptionVariables = {
  person: [
    "woman", "man", "young woman", "young man", "businessman", "businesswoman",
    "teenager", "child", "elderly woman", "elderly man", "boy", "girl",
    "professional", "student", "doctor", "nurse", "teacher", "chef", "athlete",
    "artist", "musician", "engineer", "scientist", "farmer", "pilot", "soldier",
    "firefighter", "police officer", "construction worker", "waiter", "barista",
    "photographer", "designer", "writer", "lawyer", "accountant", "manager",
    "executive", "entrepreneur", "mother", "father", "grandmother", "grandfather",
    "couple", "friends", "family", "colleagues", "team", "group", "crowd",
    "person", "individual", "adult", "senior", "youth", "toddler", "baby",
    "teen", "young adult", "middle-aged person", "senior citizen", "professional",
    "worker", "employee", "volunteer", "patient", "customer", "client", "visitor",
    "traveler", "tourist", "passenger", "driver", "cyclist", "runner", "walker",
    "shopper", "diner", "student", "graduate", "intern", "trainee", "apprentice",
    "mentor", "coach", "instructor", "guide", "assistant", "helper", "caregiver",
    "parent", "guardian", "sibling", "cousin", "aunt", "uncle", "neighbor"
  ],

  action: [
    "smiling", "looking at camera", "holding", "using", "standing", "sitting",
    "walking", "running", "jumping", "dancing", "laughing", "talking", "listening",
    "reading", "writing", "typing", "pointing", "waving", "shaking hands",
    "hugging", "kissing", "embracing", "high-fiving", "clapping", "thumbs up",
    "thumbs down", "nodding", "shaking head", "thinking", "concentrating",
    "focusing", "working", "studying", "learning", "teaching", "explaining",
    "presenting", "demonstrating", "showing", "displaying", "examining",
    "inspecting", "checking", "reviewing", "analyzing", "planning", "organizing",
    "arranging", "preparing", "cooking", "baking", "serving", "eating", "drinking",
    "pouring", "stirring", "mixing", "cutting", "chopping", "peeling", "washing",
    "cleaning", "tidying", "organizing", "sorting", "filing", "stacking",
    "carrying", "lifting", "pushing", "pulling", "opening", "closing", "locking",
    "unlocking", "turning", "rotating", "twisting", "bending", "stretching",
    "reaching", "grabbing", "catching", "throwing", "kicking", "hitting",
    "swinging", "climbing", "descending", "ascending", "entering", "exiting",
    "approaching", "leaving", "arriving", "departing", "waiting", "resting"
  ],

  location: [
    "outdoors", "in office", "at home", "on beach", "in city", "in park",
    "in garden", "in kitchen", "in bedroom", "in living room", "in bathroom",
    "in garage", "in basement", "in attic", "in studio", "in classroom",
    "in library", "in restaurant", "in cafe", "in bar", "in hotel", "in airport",
    "in train station", "in bus stop", "in subway", "in car", "in bus", "in train",
    "in plane", "in boat", "in hospital", "in clinic", "in pharmacy", "in gym",
    "in fitness center", "in yoga studio", "in spa", "in salon", "in shop",
    "in store", "in mall", "in market", "in supermarket", "in warehouse",
    "in factory", "in workshop", "in laboratory", "in museum", "in gallery",
    "in theater", "in cinema", "in concert hall", "in stadium", "in arena",
    "in field", "in forest", "in mountains", "in desert", "in countryside",
    "in village", "in town", "in suburb", "in downtown", "in neighborhood",
    "in street", "in alley", "in square", "in plaza", "in courtyard",
    "in backyard", "in front yard", "in driveway", "in parking lot", "in garage",
    "on sidewalk", "on road", "on path", "on trail", "on bridge", "on pier",
    "on deck", "on balcony", "on terrace", "on rooftop", "on platform",
    "on stage", "on podium", "on floor", "on ground", "on grass", "on sand",
    "on snow", "on ice", "on water", "on beach", "on shore", "on coast"
  ],

  time: [
    "during day", "at sunset", "in morning", "at night", "at dawn", "at dusk",
    "in afternoon", "in evening", "at noon", "at midnight", "early morning",
    "late morning", "early afternoon", "late afternoon", "early evening",
    "late evening", "early night", "late night", "in spring", "in summer",
    "in autumn", "in winter", "on weekday", "on weekend", "on holiday",
    "during work hours", "after work", "before work", "during break",
    "during lunch", "during dinner", "during breakfast", "during snack time",
    "during rush hour", "off peak hours", "during peak season", "off season",
    "in good weather", "in bad weather", "in rain", "in snow", "in sunshine",
    "in shade", "in bright light", "in dim light", "in natural light",
    "in artificial light", "during event", "during celebration", "during meeting",
    "during conference", "during presentation", "during workshop", "during class",
    "during lesson", "during training", "during practice", "during rehearsal",
    "during performance", "during game", "during match", "during competition",
    "during race", "during marathon", "during festival", "during concert",
    "during party", "during gathering", "during reunion", "during wedding",
    "during birthday", "during holiday", "during vacation", "during travel",
    "during commute", "during journey", "during trip", "during adventure",
    "during exploration", "during discovery", "during learning", "during growth",
    "during change", "during transition", "during transformation", "during progress",
    "during development", "during improvement", "during achievement", "during success",
    "during challenge", "during struggle", "during effort", "during work",
    "during rest", "during relaxation", "during meditation", "during reflection"
  ],

  emotion: [
    "happy", "confident", "serious", "relaxed", "focused", "excited", "joyful",
    "cheerful", "content", "satisfied", "pleased", "delighted", "thrilled",
    "enthusiastic", "energetic", "lively", "vibrant", "optimistic", "hopeful",
    "positive", "upbeat", "bright", "sunny", "radiant", "glowing", "beaming",
    "smiling", "laughing", "grinning", "chuckling", "giggling", "amused",
    "entertained", "amused", "playful", "funny", "humorous", "witty", "clever",
    "intelligent", "wise", "thoughtful", "contemplative", "reflective", "pensive",
    "meditative", "calm", "peaceful", "tranquil", "serene", "quiet", "still",
    "gentle", "soft", "tender", "warm", "friendly", "welcoming", "inviting",
    "approachable", "open", "accessible", "available", "present", "attentive",
    "alert", "aware", "conscious", "mindful", "observant", "watchful", "vigilant",
    "careful", "cautious", "prudent", "wise", "smart", "sharp", "keen", "acute",
    "perceptive", "insightful", "understanding", "compassionate", "empathetic",
    "sympathetic", "caring", "loving", "affectionate", "tender", "gentle",
    "kind", "generous", "giving", "helpful", "supportive", "encouraging",
    "inspiring", "motivating", "empowering", "uplifting", "elevating"
  ],

  doing: [
    "working", "relaxing", "exercising", "cooking", "reading", "writing",
    "studying", "learning", "teaching", "explaining", "presenting", "discussing",
    "meeting", "conferencing", "collaborating", "cooperating", "coordinating",
    "organizing", "planning", "strategizing", "analyzing", "evaluating",
    "assessing", "reviewing", "examining", "inspecting", "checking", "verifying",
    "confirming", "validating", "testing", "experimenting", "researching",
    "investigating", "exploring", "discovering", "finding", "searching",
    "looking", "watching", "observing", "monitoring", "tracking", "following",
    "pursuing", "chasing", "hunting", "seeking", "questing", "journeying",
    "traveling", "wandering", "roaming", "strolling", "walking", "hiking",
    "trekking", "climbing", "ascending", "descending", "jumping", "leaping",
    "running", "sprinting", "racing", "competing", "competing", "playing",
    "gaming", "sporting", "exercising", "training", "practicing", "rehearsing",
    "performing", "acting", "dancing", "singing", "playing music", "creating",
    "making", "building", "constructing", "assembling", "crafting", "designing",
    "drawing", "painting", "sculpting", "carving", "engraving", "etching",
    "photographing", "filming", "recording", "documenting", "capturing"
  ],

  object: [
    "phone", "laptop", "coffee cup", "book", "camera", "tablet", "keyboard",
    "mouse", "monitor", "screen", "display", "printer", "scanner", "headphones",
    "earbuds", "microphone", "speaker", "remote", "controller", "gamepad",
    "pen", "pencil", "marker", "highlighter", "notebook", "notepad", "paper",
    "document", "file", "folder", "briefcase", "bag", "backpack", "purse",
    "wallet", "keys", "watch", "glasses", "sunglasses", "hat", "cap", "helmet",
    "umbrella", "coat", "jacket", "sweater", "shirt", "pants", "shoes",
    "boots", "sneakers", "sandals", "flip-flops", "slippers", "gloves",
    "scarf", "tie", "belt", "jewelry", "necklace", "bracelet", "ring",
    "earrings", "brooch", "pin", "badge", "tag", "label", "sticker",
    "tape", "glue", "scissors", "knife", "fork", "spoon", "plate", "bowl",
    "cup", "mug", "glass", "bottle", "can", "jar", "container", "box",
    "package", "parcel", "envelope", "letter", "card", "postcard", "ticket",
    "pass", "voucher", "coupon", "receipt", "invoice", "bill", "check",
    "money", "cash", "coins", "credit card", "debit card", "gift card",
    "toy", "doll", "ball", "puzzle", "game", "board game", "card game",
    "puzzle", "riddle", "mystery", "secret", "surprise", "gift", "present"
  ],

  activity: [
    "working", "studying", "exercising", "socializing", "relaxing", "resting",
    "sleeping", "eating", "drinking", "cooking", "baking", "cleaning",
    "tidying", "organizing", "arranging", "sorting", "filing", "stacking",
    "storing", "retrieving", "fetching", "carrying", "transporting", "moving",
    "shifting", "relocating", "transferring", "delivering", "distributing",
    "sharing", "giving", "receiving", "taking", "grabbing", "catching",
    "throwing", "kicking", "hitting", "striking", "punching", "slapping",
    "tapping", "touching", "feeling", "sensing", "perceiving", "noticing",
    "observing", "watching", "viewing", "seeing", "looking", "gazing",
    "staring", "glancing", "peeking", "peering", "examining", "inspecting",
    "checking", "reviewing", "analyzing", "evaluating", "assessing",
    "judging", "rating", "ranking", "comparing", "contrasting", "matching",
    "pairing", "grouping", "categorizing", "classifying", "organizing",
    "structuring", "arranging", "ordering", "sequencing", "prioritizing",
    "scheduling", "planning", "preparing", "arranging", "setting up",
    "installing", "configuring", "adjusting", "calibrating", "tuning",
    "fixing", "repairing", "maintaining", "servicing", "upgrading",
    "improving", "enhancing", "optimizing", "refining", "polishing"
  ],

  setting: [
    "beach", "office", "park", "home", "city street", "countryside", "forest",
    "mountains", "desert", "ocean", "lake", "river", "stream", "pond",
    "waterfall", "cave", "canyon", "valley", "hill", "cliff", "shore",
    "coast", "island", "peninsula", "bay", "harbor", "port", "marina",
    "dock", "pier", "wharf", "boardwalk", "promenade", "boulevard",
    "avenue", "street", "road", "lane", "path", "trail", "track", "route",
    "highway", "freeway", "expressway", "bridge", "overpass", "tunnel",
    "subway", "metro", "station", "stop", "terminal", "depot", "garage",
    "parking lot", "parking garage", "parking structure", "lot", "space",
    "spot", "area", "zone", "section", "region", "territory", "domain",
    "realm", "world", "universe", "cosmos", "galaxy", "solar system",
    "planet", "earth", "land", "ground", "soil", "dirt", "sand", "gravel",
    "rock", "stone", "boulder", "pebble", "cobble", "shingle", "shell",
    "coral", "seaweed", "kelp", "algae", "moss", "lichen", "fungus",
    "mushroom", "toadstool", "plant", "flower", "blossom", "bud", "petal",
    "leaf", "stem", "branch", "twig", "trunk", "bark", "root", "seed"
  ],

  with: [
    "with", "holding", "using", "near", "beside", "next to", "alongside",
    "along", "by", "at", "on", "in", "inside", "within", "within", "among",
    "amongst", "amid", "amidst", "between", "betwixt", "among", "through",
    "throughout", "across", "over", "under", "beneath", "below", "above",
    "beyond", "past", "behind", "after", "before", "ahead", "forward",
    "backward", "back", "front", "side", "left", "right", "center", "middle",
    "edge", "corner", "end", "beginning", "start", "finish", "completion",
    "conclusion", "ending", "termination", "cessation", "stop", "halt",
    "pause", "break", "interruption", "disruption", "disturbance", "interference",
    "obstruction", "blockage", "barrier", "obstacle", "hindrance", "impediment",
    "difficulty", "challenge", "problem", "issue", "trouble", "complication",
    "complexity", "intricacy", "sophistication", "refinement", "elegance",
    "grace", "beauty", "charm", "appeal", "attraction", "allure", "magnetism",
    "fascination", "captivation", "enchantment", "spell", "magic", "wonder",
    "marvel", "miracle", "phenomenon", "occurrence", "event", "incident",
    "happening", "situation", "circumstance", "condition", "state", "status"
  ],

  pose: [
    "standing", "sitting", "kneeling", "crouching", "squatting", "lying",
    "reclining", "leaning", "bending", "stretching", "reaching", "extending",
    "raising", "lifting", "lowering", "dropping", "falling", "landing",
    "jumping", "leaping", "hopping", "skipping", "running", "sprinting",
    "dashing", "racing", "chasing", "pursuing", "following", "trailing",
    "tracking", "hunting", "seeking", "searching", "looking", "watching",
    "observing", "monitoring", "surveilling", "guarding", "protecting",
    "defending", "shielding", "covering", "hiding", "concealing", "masking",
    "disguising", "camouflaging", "blending", "merging", "combining",
    "uniting", "joining", "connecting", "linking", "bonding", "attaching",
    "fastening", "securing", "fixing", "anchoring", "grounding", "rooting",
    "planting", "establishing", "founding", "creating", "making", "building",
    "constructing", "assembling", "putting together", "taking apart",
    "dismantling", "disassembling", "breaking", "destroying", "ruining",
    "damaging", "harming", "hurting", "injuring", "wounding", "cutting",
    "slicing", "chopping", "dicing", "mincing", "grinding", "crushing",
    "smashing", "shattering", "breaking", "splitting", "dividing", "separating"
  ],

  style: [
    "casual", "formal", "professional", "business", "corporate", "executive",
    "managerial", "administrative", "clerical", "secretarial", "receptionist",
    "customer service", "sales", "marketing", "advertising", "promotion",
    "publicity", "public relations", "media", "journalism", "reporting",
    "broadcasting", "television", "radio", "podcasting", "streaming",
    "content creation", "social media", "blogging", "vlogging", "influencing",
    "affiliate marketing", "sponsorship", "endorsement", "testimonial",
    "review", "rating", "feedback", "comment", "opinion", "viewpoint",
    "perspective", "outlook", "attitude", "approach", "method", "technique",
    "strategy", "tactic", "plan", "scheme", "design", "blueprint", "layout",
    "arrangement", "organization", "structure", "framework", "system",
    "process", "procedure", "protocol", "guideline", "rule", "regulation",
    "law", "statute", "ordinance", "decree", "edict", "command", "order",
    "directive", "instruction", "direction", "guidance", "advice", "counsel",
    "recommendation", "suggestion", "tip", "hint", "clue", "indication",
    "sign", "signal", "mark", "token", "symbol", "emblem", "badge", "insignia"
  ]
};

// Caption templates - ~30 templates with variable placeholders
export const templates = [
  "A {person} {action} {location} {time}",
  "Close-up of {person} {emotion} {doing} {object}",
  "{Person} {activity} {setting} {with} {object}",
  "Portrait of {person} {emotion} {location}",
  "{Person} {action} {object} {setting}",
  "{Person} {pose} {location} {time}",
  "A {person} {doing} {with} {object} {location}",
  "{Person} {emotion} {action} {setting}",
  "Side view of {person} {doing} {location}",
  "{Person} {activity} {with} {object} {time}",
  "Group of {person} {action} {location}",
  "{Person} {pose} {with} {object} {setting}",
  "A {person} {emotion} {doing} {location} {time}",
  "{Person} {action} {setting} {with} {object}",
  "Close-up portrait of {person} {emotion}",
  "{Person} {doing} {activity} {location}",
  "A {person} {pose} {location} {with} {object}",
  "{Person} {action} {object} {time}",
  "Professional {person} {doing} {location}",
  "{Person} {emotion} {pose} {setting}",
  "A {person} {doing} {with} {object}",
  "{Person} {activity} {location} {time}",
  "Portrait shot of {person} {emotion} {location}",
  "{Person} {action} {setting} {time}",
  "A {person} {pose} {with} {object}",
  "{Person} {doing} {activity} {with} {object}",
  "Close-up of {person} {action} {location}",
  "{Person} {emotion} {doing} {setting}",
  "A {person} {activity} {location} {with} {object}",
  "{Person} {pose} {doing} {location} {time}"
];

import seedrandom from 'seedrandom';

/**
 * Generate a caption using mad libs style template substitution
 * @param imageId - Image ID for deterministic generation
 * @param seed - Random seed for reproducibility
 * @returns Generated caption string
 */
export function generateCaption(imageId: number, seed: string): string {
  // Create deterministic RNG for this image
  const rng = seedrandom(`${seed}-${imageId}-caption`);
  
  // Select template
  const templateIndex = Math.floor(rng() * templates.length);
  let caption = templates[templateIndex];
  
  // Extract variable names from template
  const variableMatches = caption.match(/\{(\w+)\}/g);
  if (!variableMatches) return caption;
  
  // Replace each variable
  for (const match of variableMatches) {
    const varName = match.slice(1, -1); // Remove { and }
    const varPool = variables[varName as keyof CaptionVariables];
    
    if (varPool && varPool.length > 0) {
      const valueIndex = Math.floor(rng() * varPool.length);
      let value = varPool[valueIndex];
      
      // Capitalize if it's {Person} (capitalized placeholder)
      if (match[1] === 'P') {
        value = value.charAt(0).toUpperCase() + value.slice(1);
      }
      
      caption = caption.replace(match, value);
    }
  }
  
  // Capitalize first letter
  return caption.charAt(0).toUpperCase() + caption.slice(1);
}

