// For each keyword combo that verify-image-keywords.js flagged as falling
// back to loremflickr's random defaultImage, tries a list of narrower
// candidate replacements (dropping whichever tag is least likely to exist
// on Flickr) and reports the first candidate that actually resolves to a
// real photo.
//
// Usage: node scripts/fix-image-keywords.js

const https = require("https");

function resolveFinalUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(resolveFinalUrl(next, redirectsLeft - 1));
        } else {
          res.resume();
          resolve(url);
        }
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function check(keywords, attempt = 1) {
  const encoded = encodeURIComponent(keywords);
  const url = `https://loremflickr.com/900/600/${encoded}?lock=${Math.floor(Math.random() * 1000000)}`;
  try {
    const final = await resolveFinalUrl(url);
    return !final.includes("defaultImage");
  } catch (err) {
    if (attempt < 3) {
      await sleep(500 * attempt);
      return check(keywords, attempt + 1);
    }
    return false;
  }
}

// name -> ordered list of candidates to try, best/most-specific first.
const CANDIDATES = {
  "BIZ:spaza-shop": ["convenience,store", "corner,shop", "convenience,shop"],
  "BIZ:kota-shisanyama": ["braai,meat", "braai", "barbecue,meat"],
  "BIZ:bricklayers": ["brick,mason", "bricklaying", "brick,construction"],
  "BIZ:fencing-palisade-installation": ["fence,gate", "fencing", "fence,construction"],
  "BIZ:traditional-attire": ["african,dress", "african,clothing", "traditional,dress"],
  "BIZ:gifts": ["gift,present", "giftshop", "present,box"],
  "BIZ:security-services": ["security,guard", "security,alarm", "guard,uniform"],
  "BIZ:optometrist": ["glasses,eyewear", "glasses", "eyeglasses"],
  "BIZ:plumbers": ["plumber,pipes", "plumbing", "plumber"],
  "BIZ:tutors": ["tutor,books", "tutoring", "study,books"],
  "BIZ:car-wash-valet": ["car,wash", "car,valet", "carwashing"],
  "BIZ:panel-beating-spray-painting": ["car,bodywork", "car,paint", "spraypainting,car"],
  "BIZ:driving-school": ["driving,school", "car,driving", "learner,driver"],
  "BIZ:cv-writing-career-coaching": ["resume,writing", "office,desk", "career,coaching"],
};

async function main() {
  for (const [name, candidates] of Object.entries(CANDIDATES)) {
    let found = null;
    for (const candidate of candidates) {
      const ok = await check(candidate);
      if (ok) {
        found = candidate;
        break;
      }
      await sleep(150);
    }
    console.log(`${name}: ${found ? `OK -> "${found}"` : "ALL CANDIDATES FAILED"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
